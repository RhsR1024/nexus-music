import Foundation

// Each runtime owns an ephemeral session and a serial delegate queue. Response
// limits are checked while receiving data, before buffering a complete body.
final class ScriptHTTP: NSObject, URLSessionDataDelegate {
  final class Job {
    let id: Int
    let binary: Bool
    var response: HTTPURLResponse?
    var data = Data()
    let completion: (String?, [String: Any]?) -> Void
    init(id: Int, binary: Bool, completion: @escaping (String?, [String: Any]?) -> Void) {
      self.id = id; self.binary = binary; self.completion = completion
    }
  }
  private var session: URLSession!
  private var jobs: [Int: Job] = [:]
  private var taskIDs: [Int: URLSessionDataTask] = [:]
  private let maxBytes = 8 * 1024 * 1024

  init(queue: DispatchQueue) {
    super.init()
    let configuration = URLSessionConfiguration.ephemeral
    configuration.httpCookieStorage = nil
    configuration.urlCache = nil
    configuration.httpMaximumConnectionsPerHost = 4
    configuration.timeoutIntervalForRequest = 20
    configuration.timeoutIntervalForResource = 60
    let delegateQueue = OperationQueue()
    delegateQueue.maxConcurrentOperationCount = 1
    delegateQueue.underlyingQueue = queue
    session = URLSession(configuration: configuration, delegate: self, delegateQueue: delegateQueue)
  }
  func start(id: Int, url: String, optionsJSON: String, completion: @escaping (String?, [String: Any]?) -> Void) {
    do {
      guard taskIDs.count < 16, let target = URL(string: url),
            ["https", "http"].contains(target.scheme?.lowercased() ?? ""), target.host != nil,
            let json = optionsJSON.data(using: .utf8),
            let options = try JSONSerialization.jsonObject(with: json) as? [String: Any] else { throw ScriptUtilityError.invalidInput }
      var request = URLRequest(url: target)
      request.httpMethod = (options["method"] as? String ?? "GET").uppercased()
      let timeout = (options["timeout"] as? Double ?? 20000) / 1000
      request.timeoutInterval = min(60, max(0.1, timeout))
      if let headers = options["headers"] as? [String: Any] {
        for (key, value) in headers { request.setValue(String(describing: value), forHTTPHeaderField: key) }
      }
      if let body = options["body"], !(body is NSNull) {
        if let text = body as? String { request.httpBody = Data(text.utf8) }
        else if let bytes = body as? [Int] { request.httpBody = Data(try ScriptUtilities.bytes(bytes)) }
        else {
          request.httpBody = try JSONSerialization.data(withJSONObject: body)
          if request.value(forHTTPHeaderField: "Content-Type") == nil { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        }
      } else if let form = options["form"] as? [String: Any] {
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~")
        func escape(_ value: String) -> String { value.addingPercentEncoding(withAllowedCharacters: allowed)! }
        request.httpBody = Data(form.keys.sorted().map { "\(escape($0))=\(escape(String(describing: form[$0]!)))" }.joined(separator: "&").utf8)
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
      } else if let form = options["formData"] as? [String: Any] {
        let boundary = "Nexus-\(UUID().uuidString)"
        var body = Data()
        for key in form.keys.sorted() {
          // Restrict disposition tokens; never interpolate raw CR/LF or quotes.
          guard !key.contains(where: { "\r\n\"".contains($0) }) else { throw ScriptUtilityError.invalidInput }
          var value = form[key]!, filename: String?, contentType = "application/octet-stream"
          if let part = value as? [String: Any], let partValue = part["value"] {
            value = partValue
            if let metadata = part["options"] as? [String: Any] {
              filename = metadata["filename"] as? String
              contentType = metadata["contentType"] as? String ?? contentType
            }
          }
          guard !(filename ?? "").contains(where: { "\r\n\"".contains($0) }), !contentType.contains(where: { "\r\n".contains($0) }) else { throw ScriptUtilityError.invalidInput }
          var header = "--\(boundary)\r\nContent-Disposition: form-data; name=\"\(key)\""
          if let filename { header += "; filename=\"\(filename)\"\r\nContent-Type: \(contentType)" }
          body.append(Data((header + "\r\n\r\n").utf8))
          if let values = value as? [Int] { body.append(Data(try ScriptUtilities.bytes(values))) }
          else { body.append(Data(String(describing: value).utf8)) }
          body.append(Data("\r\n".utf8))
          guard body.count <= maxBytes else { throw ScriptUtilityError.limitExceeded }
        }
        body.append(Data("--\(boundary)--\r\n".utf8))
        request.httpBody = body
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
      }
      guard (request.httpBody?.count ?? 0) <= maxBytes else { throw ScriptUtilityError.limitExceeded }
      let task = session.dataTask(with: request)
      jobs[task.taskIdentifier] = Job(id: id, binary: options["binary"] as? Bool == true, completion: completion)
      taskIDs[id] = task
      task.resume()
    } catch { completion("HTTP_REQUEST_INVALID", nil) }
  }
  func cancel(_ id: Int) {
    guard let task = taskIDs.removeValue(forKey: id) else { return }
    jobs.removeValue(forKey: task.taskIdentifier)
    task.cancel()
  }
  func destroy() {
    jobs.removeAll(); taskIDs.removeAll()
    session.invalidateAndCancel()
  }
  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse,
                  completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
    guard let job = jobs[dataTask.taskIdentifier], let http = response as? HTTPURLResponse,
          response.expectedContentLength <= maxBytes else {
      fail(dataTask, code: "HTTP_RESPONSE_TOO_LARGE"); completionHandler(.cancel); return
    }
    job.response = http
    completionHandler(.allow)
  }
  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
    guard let job = jobs[dataTask.taskIdentifier] else { return }
    guard job.data.count + data.count <= maxBytes else { fail(dataTask, code: "HTTP_RESPONSE_TOO_LARGE"); return }
    job.data.append(data)
  }
  private func fail(_ task: URLSessionTask, code: String) {
    if let job = jobs.removeValue(forKey: task.taskIdentifier) {
      taskIDs.removeValue(forKey: job.id); job.completion(code, nil)
    }
    task.cancel()
  }
  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    guard let job = jobs.removeValue(forKey: task.taskIdentifier) else { return }
    taskIDs.removeValue(forKey: job.id)
    guard error == nil, let response = job.response else { job.completion("HTTP_REQUEST_FAILED", nil); return }
    let body: Any = job.binary ? job.data.base64EncodedString() :
      ((try? JSONSerialization.jsonObject(with: job.data, options: [.fragmentsAllowed])) ?? String(decoding: job.data, as: UTF8.self))
    var headers: [String: String] = [:]
    for (key, value) in response.allHeaderFields { headers[String(describing: key).lowercased()] = String(describing: value) }
    job.completion(nil, ["statusCode": response.statusCode, "statusMessage": HTTPURLResponse.localizedString(forStatusCode: response.statusCode),
                         "headers": headers, "body": body, "__binary": job.binary])
  }
}
