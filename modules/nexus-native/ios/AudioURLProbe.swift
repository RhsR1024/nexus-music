import Foundation

// A bounded response/header check. It never creates a player, audio session,
// cache entry or NowPlaying state and never returns the private media URL.
final class AudioURLProbe: NSObject, URLSessionDataDelegate, URLSessionTaskDelegate {
  private let queue: DispatchQueue
  private var session: URLSession?
  private var task: URLSessionDataTask?
  private var timer: DispatchWorkItem?
  private var completion: (([String: Any]) -> Void)?
  private var bytes = Data()
  private var status = 0
  private var redirects = 0
  init(queue: DispatchQueue) { self.queue = queue }
  func start(_ value: String, completion: @escaping ([String: Any]) -> Void) {
    self.completion = completion
    guard value.utf8.count <= 8192, let url = URL(string: value), Self.allowed(url) else { finish("invalid-url"); return }
    let config = URLSessionConfiguration.ephemeral
    config.urlCache = nil; config.urlCredentialStorage = nil; config.httpCookieStorage = nil; config.httpShouldSetCookies = false
    config.requestCachePolicy = .reloadIgnoringLocalCacheData
    config.timeoutIntervalForRequest = 8; config.timeoutIntervalForResource = 12
    let delegates = OperationQueue(); delegates.maxConcurrentOperationCount = 1; delegates.underlyingQueue = queue
    session = URLSession(configuration: config, delegate: self, delegateQueue: delegates)
    let timeout = DispatchWorkItem { [weak self] in self?.finish("timeout") }; timer = timeout
    queue.asyncAfter(deadline: .now() + 12, execute: timeout)
    task = session?.dataTask(with: Self.request(url)); task?.resume()
  }
  func cancel() { finish("cancelled") }
  private static func allowed(_ url: URL) -> Bool {
    guard let scheme = url.scheme?.lowercased(), ["https", "http"].contains(scheme), let host = url.host, !host.isEmpty else { return false }
    return url.user == nil && url.password == nil && url.absoluteString.utf8.count <= 8192
  }
  private static func request(_ url: URL) -> URLRequest {
    var request = URLRequest(url: url); request.httpMethod = "GET"
    request.setValue("bytes=0-4095", forHTTPHeaderField: "Range")
    request.setValue("identity", forHTTPHeaderField: "Accept-Encoding")
    request.httpShouldHandleCookies = false
    return request
  }
  private func finish(_ state: String, format: String? = nil) {
    guard let callback = completion else { return }; completion = nil
    timer?.cancel(); timer = nil; task?.cancel(); task = nil
    session?.invalidateAndCancel(); session = nil
    var value: [String: Any] = ["state": state, "bytes": bytes.count]
    if status > 0 { value["status"] = status }; if let format { value["format"] = format }
    callback(value)
  }
  static func mediaHeader(_ data: Data) -> String? {
    let b = [UInt8](data)
    func has(_ text: String, _ offset: Int = 0) -> Bool { let v = Array(text.utf8); return b.count >= offset + v.count && Array(b[offset..<offset+v.count]) == v }
    if has("fLaC") { return "flac" }
    if has("RIFF") && has("WAVE", 8) { return "wav" }
    if has("FORM") && (has("AIFF", 8) || has("AIFC", 8)) { return "aiff" }
    if has("OggS") { return "ogg" }
    if has("ftyp", 4) { return "mp4" }
    if b.count >= 10 && has("ID3") && (2...4).contains(b[3]) { return "id3" }
    if b.count >= 4 && b[0] == 255 && b[1] & 0xf6 == 0xf0 { return "aac" }
    if b.count >= 4 && b[0] == 255 && b[1] & 0xe0 == 0xe0 && b[1] & 6 != 0 && b[2] & 0xf0 != 0xf0 && b[2] & 0x0c != 0x0c { return "mpeg" }
    return nil
  }
  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
    redirects += 1
    guard completion != nil, redirects <= 5, let url = request.url, Self.allowed(url), !(response.url?.scheme?.lowercased() == "https" && url.scheme?.lowercased() == "http") else { completionHandler(nil); finish("redirect-error"); return }
    completionHandler(Self.request(url))
  }
  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse, completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
    guard completion != nil, let http = response as? HTTPURLResponse else { completionHandler(.cancel); finish("network-error"); return }
    status = http.statusCode
    guard status == 200 || status == 206 else { completionHandler(.cancel); finish("http-error"); return }
    if status == 206 {
      let value = http.value(forHTTPHeaderField: "Content-Range") ?? ""
      let regex = try! NSRegularExpression(pattern: #"^bytes 0-([0-9]+)/([0-9]+|\*)$"#)
      guard let match = regex.firstMatch(in: value, range: NSRange(value.startIndex..., in: value)),
            let endRange = Range(match.range(at: 1), in: value), let end = Int64(value[endRange]),
            let totalRange = Range(match.range(at: 2), in: value), end >= 0,
            value[totalRange] == "*" || (Int64(value[totalRange]).map { $0 > end } ?? false) else { completionHandler(.cancel); finish("range-error"); return }
    }
    completionHandler(.allow)
  }
  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
    guard completion != nil else { return }
    bytes.append(data.prefix(max(0, 4096 - bytes.count)))
    if let format = Self.mediaHeader(bytes) { finish("header", format: format) }
    else if bytes.count >= 4096 { finish("unrecognized") }
  }
  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    guard completion != nil else { return }
    if let error = error as NSError? { finish(error.code == NSURLErrorTimedOut ? "timeout" : "network-error") }
    else if let format = Self.mediaHeader(bytes) { finish("header", format: format) }
    else { finish("unrecognized") }
  }
}
