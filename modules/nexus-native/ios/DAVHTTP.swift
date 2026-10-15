import Foundation

struct DAVScope {
  let root: URL
  private let prefix: String
  init(_ raw: String) throws {
    guard let root = URL(string: raw), let parts = URLComponents(url: root, resolvingAgainstBaseURL: false),
          ["http", "https"].contains(parts.scheme ?? ""), parts.host != nil,
          parts.user == nil, parts.password == nil, parts.query == nil, parts.fragment == nil,
          parts.percentEncodedPath.hasSuffix("/"), DAVScope.safePath(parts.percentEncodedPath) else { throw DAVHTTP.failure(1) }
    self.root = root; prefix = parts.percentEncodedPath
  }
  static func safePath(_ path: String) -> Bool {
    if path.contains("\\") { return false }
    for part in path.components(separatedBy: "/") {
      guard let value = part.removingPercentEncoding, value != ".", value != "..",
            !value.contains("/"), !value.contains("\\"), !value.contains("%"),
            !value.unicodeScalars.contains(where: { $0.value < 32 || $0.value == 127 }) else { return false }
    }
    return true
  }
  func contains(_ url: URL) -> Bool {
    guard let parts = URLComponents(url: url, resolvingAgainstBaseURL: false), let base = URLComponents(url: root, resolvingAgainstBaseURL: false),
          parts.user == nil, parts.password == nil, parts.query == nil, parts.fragment == nil,
          parts.scheme == base.scheme, parts.host?.lowercased() == base.host?.lowercased(),
          (parts.port ?? (parts.scheme == "https" ? 443 : 80)) == (base.port ?? (base.scheme == "https" ? 443 : 80)),
          DAVScope.safePath(parts.percentEncodedPath), parts.percentEncodedPath.hasPrefix(prefix) else { return false }
    return true
  }
  func url(_ path: String) throws -> URL {
    guard !path.hasPrefix("/"), DAVScope.safePath(path), let value = URL(string: root.absoluteString + path), contains(value) else { throw DAVHTTP.failure(2) }
    return value
  }
}

// One bounded ephemeral request. No response body, URL or credential is logged.
// Codes: 1 configuration, 2 scope/redirect, 3 network, 4 body/protocol limit.
final class DAVHTTP: NSObject, URLSessionDataDelegate {
  static func failure(_ code: Int) -> NSError { NSError(domain: "NexusWebDAV", code: code, userInfo: [NSLocalizedDescriptionKey: "WebDAV request failed (\(code))"]) }
  private let scope: DAVScope
  private let request: URLRequest
  private let operations = OperationQueue()
  private var session: URLSession?
  private var completion: ((Result<[String: Any], Error>) -> Void)?
  private var data = Data()
  private var status = 0
  private var redirects = 0
  private static let properties = "<?xml version=\"1.0\" encoding=\"utf-8\"?><d:propfind xmlns:d=\"DAV:\"><d:prop><d:displayname/><d:resourcetype/><d:getcontentlength/><d:getlastmodified/><d:getetag/><d:getcontenttype/></d:prop></d:propfind>"
  init(root: String, path: String, username: String, password: String, depth: Int) throws {
    scope = try DAVScope(root)
    guard [0, 1].contains(depth), !username.isEmpty, !username.contains(":"), !password.isEmpty,
          !username.unicodeScalars.contains(where: { $0.value < 32 || $0.value == 127 }) else { throw DAVHTTP.failure(1) }
    var outgoing = URLRequest(url: try scope.url(path)); outgoing.httpMethod = "PROPFIND"
    outgoing.setValue("Basic " + Data((username + ":" + password).utf8).base64EncodedString(), forHTTPHeaderField: "Authorization")
    outgoing.setValue(String(depth), forHTTPHeaderField: "Depth")
    outgoing.setValue("application/xml; charset=utf-8", forHTTPHeaderField: "Content-Type")
    outgoing.setValue("application/xml, text/xml", forHTTPHeaderField: "Accept")
    outgoing.httpBody = Data(DAVHTTP.properties.utf8); request = outgoing
    super.init(); operations.maxConcurrentOperationCount = 1
  }
  func start(_ completion: @escaping (Result<[String: Any], Error>) -> Void) {
    self.completion = completion
    let configuration = URLSessionConfiguration.ephemeral
    configuration.urlCache = nil; configuration.httpCookieStorage = nil
    configuration.timeoutIntervalForRequest = 20; configuration.timeoutIntervalForResource = 45
    let session = URLSession(configuration: configuration, delegate: self, delegateQueue: operations)
    self.session = session; session.dataTask(with: request).resume()
  }
  func cancel() { operations.addOperation { self.finish(.failure(URLError(.cancelled))) } }
  private func finish(_ result: Result<[String: Any], Error>) {
    guard let completion else { return }; self.completion = nil
    session?.invalidateAndCancel(); session = nil; data.removeAll(); completion(result)
  }
  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                  newRequest: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
    redirects += 1
    guard redirects <= 5, let target = newRequest.url, scope.contains(target) else { completionHandler(nil); finish(.failure(DAVHTTP.failure(2))); return }
    var next = request; next.url = target
    // Preserve PROPFIND and body; URLSession may otherwise turn a 303 into GET.
    completionHandler(next)
  }
  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse,
                  completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
    guard let http = response as? HTTPURLResponse, response.expectedContentLength <= 2097152 else { completionHandler(.cancel); finish(.failure(DAVHTTP.failure(4))); return }
    status = http.statusCode; completionHandler(.allow)
  }
  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive chunk: Data) {
    guard data.count <= 2097152 - chunk.count else { finish(.failure(DAVHTTP.failure(4))); return }; data.append(chunk)
  }
  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    if error != nil { finish(.failure(DAVHTTP.failure(3))); return }
    guard let body = String(data: data, encoding: .utf8) else { finish(.failure(DAVHTTP.failure(4))); return }
    finish(.success(["status": status, "body": body]))
  }
}
