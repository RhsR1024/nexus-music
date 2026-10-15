import ExpoModulesCore

public final class NexusDAVModule: Module {
  private let queue = DispatchQueue(label: "nexus.webdav.requests")
  private var requests: [String: DAVHTTP] = [:]
  private var inspections: [String: Task<Void, Never>] = [:]
  private func propfind(_ token: String, _ root: String, _ path: String, _ username: String, _ password: String, _ depth: Int, _ promise: Promise) {
    guard UUID(uuidString: token) != nil, requests[token] == nil, requests.count < 6 else { promise.reject("DAV_LIMIT", "WebDAV request limit"); return }
    do {
      let request = try DAVHTTP(root: root, path: path, username: username, password: password, depth: depth)
      requests[token] = request
      request.start { result in
        self.queue.async {
          self.requests.removeValue(forKey: token)
          switch result {
          case .success(let value): promise.resolve(value)
          case .failure(let error): promise.reject("DAV_\((error as NSError).code)", "WebDAV request failed")
          }
        }
      }
    } catch { promise.reject("DAV_\((error as NSError).code)", "WebDAV configuration invalid") }
  }
  private func inspect(_ token: String, _ root: String, _ path: String, _ username: String, _ password: String, _ key: String, _ etag: String, _ promise: Promise) {
    guard UUID(uuidString: token) != nil, inspections[token] == nil, inspections.count < 2 else { promise.reject("DAV_LIMIT", "WebDAV metadata limit"); return }
    inspections[token] = Task {
      do {
        var media = try DAVHTTP.media(root: root, path: path, username: username, password: password)
        if !etag.isEmpty { guard etag.first == "\"", etag.last == "\"", !etag.unicodeScalars.contains(where: { $0.value < 32 || $0.value == 127 }) else { throw DAVHTTP.failure(1) }; var headers = media["headers"] as! [String: String]; headers["If-Match"] = etag; media["headers"] = headers }
        let result = try await RemoteAudioMetadata.inspect(media, key: key)
        try Task.checkCancellation(); promise.resolve(result)
      } catch { promise.reject("DAV_METADATA", "Remote audio metadata unavailable") }
      self.queue.async { self.inspections.removeValue(forKey: token) }
    }
  }
  public func definition() -> ModuleDefinition {
    Name("NexusWebDAV")
    AsyncFunction("propfind") { (token: String, root: String, path: String, username: String, password: String, depth: Int, promise: Promise) in self.propfind(token, root, path, username, password, depth, promise) }.runOnQueue(queue)
    AsyncFunction("prepare") { (root: String, path: String, username: String, password: String) throws -> [String: Any] in try DAVHTTP.media(root: root, path: path, username: username, password: password) }.runOnQueue(queue)
    AsyncFunction("inspect") { (token: String, root: String, path: String, username: String, password: String, key: String, etag: String, promise: Promise) in self.inspect(token, root, path, username, password, key, etag, promise) }.runOnQueue(queue)
    AsyncFunction("cancel") { (token: String) in self.requests[token]?.cancel(); self.inspections[token]?.cancel() }.runOnQueue(queue)
    OnDestroy { self.queue.async { self.requests.values.forEach { $0.cancel() }; self.inspections.values.forEach { $0.cancel() }; self.inspections.removeAll() } }
  }
}
