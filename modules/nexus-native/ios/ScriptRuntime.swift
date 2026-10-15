import Foundation
import JavaScriptCore

enum ScriptRuntimeError: String, Error {
  case destroyed = "SOURCE_DESTROYED", invalid = "SCRIPT_INVALID", timeout = "SCRIPT_TIMEOUT"
  case request = "SCRIPT_REQUEST_FAILED", notReady = "SOURCE_NOT_READY", cancelled = "REQUEST_CANCELLED"
}

final class ScriptRuntime {
  typealias Completion = (Result<String, ScriptRuntimeError>) -> Void
  private let queue: DispatchQueue
  private var context: JSContext?
  private var http: ScriptHTTP?
  private var timers: [Int: DispatchWorkItem] = [:]
  private var requests: [String: Completion] = [:]
  private var deadlines: [String: DispatchWorkItem] = [:]
  private var initialized = false
  private var destroyed = false
  private var initialization: Completion?
  private var initializationDeadline: DispatchWorkItem?

  init(id: String, revision: Int) { queue = DispatchQueue(label: "nexus.lx.\(id).\(revision)") }
  func initialize(script: String, name: String, bootstrap: String, completion: @escaping Completion) {
    queue.async { [self] in
      guard !destroyed && context == nil && script.utf8.count <= 8 * 1024 * 1024 else { completion(.failure(.invalid)); return }
      initialization = completion
      http = ScriptHTTP(queue: queue)
      let context = JSContext()!
      self.context = context
      context.exceptionHandler = { [weak self] _, _ in self?.scriptException() }
      let emit: @convention(block) (String, String) -> Void = { [weak self] event, json in self?.event(event, json) }
      let httpStart: @convention(block) (Int, String, String) -> Void = { [weak self] id, url, options in
        self?.http?.start(id: id, url: url, optionsJSON: options) { [weak self] error, response in
          guard let self, !self.destroyed else { return }
          self.context?.objectForKeyedSubscript("__nexusHttp")?.call(withArguments: [id, error as Any? ?? NSNull(), response as Any? ?? NSNull()])
        }
      }
      let abort: @convention(block) (Int) -> Void = { [weak self] id in self?.http?.cancel(id) }
      let timer: @convention(block) (Int, Double) -> Void = { [weak self] id, delay in self?.timer(id, delay) }
      let clear: @convention(block) (Int) -> Void = { [weak self] id in self?.timers.removeValue(forKey: id)?.cancel() }
      let utility: @convention(block) (String, String) -> String = { ScriptUtilities.call($0, $1) }
      context.setObject(["emit": emit, "http": httpStart, "abortHttp": abort, "timer": timer, "clearTimer": clear, "utility": utility], forKeyedSubscript: "__nexusNative" as NSString)
      var info = ["name": name, "version": "", "author": "", "description": "", "rawScript": script]
      let header = String(script.prefix(16384))
      for field in ["version", "author", "description", "homepage"] {
        if let expression = try? NSRegularExpression(pattern: "@\(field)\\s+([^\\r\\n]*)"),
           let match = expression.firstMatch(in: header, range: NSRange(header.startIndex..., in: header)),
           let range = Range(match.range(at: 1), in: header) { info[field] = String(header[range]).replacingOccurrences(of: "*/", with: "").trimmingCharacters(in: .whitespaces) }
      }
      context.setObject(info, forKeyedSubscript: "__nexusScriptInfo" as NSString)
      let deadline = DispatchWorkItem { [weak self] in
        guard let self, let pending = self.initialization else { return }
        self.initialization = nil; pending(.failure(.timeout)); self.teardown()
      }
      initializationDeadline = deadline
      queue.asyncAfter(deadline: .now() + 20, execute: deadline)
      context.evaluateScript(bootstrap)
      if context.exception == nil { context.evaluateScript(script) }
    }
  }
  func request(id: String, payloadJSON: String, completion: @escaping Completion) {
    queue.async { [self] in
      guard initialized && !destroyed else { completion(.failure(.notReady)); return }
      guard requests[id] == nil, requests.count < 32, payloadJSON.utf8.count <= 1024 * 1024,
            let payload = try? JSONSerialization.jsonObject(with: Data(payloadJSON.utf8)) else { completion(.failure(.invalid)); return }
      requests[id] = completion
      let deadline = DispatchWorkItem { [weak self] in self?.finish(id, .failure(.timeout)) }
      deadlines[id] = deadline; queue.asyncAfter(deadline: .now() + 15, execute: deadline)
      context?.objectForKeyedSubscript("__nexusInvoke")?.call(withArguments: [id, payload])
    }
  }
  func cancel(id: String) { queue.async { [self] in finish(id, .failure(.cancelled)) } }
  func destroy() { queue.async { [self] in teardown() } }
  private func timer(_ id: Int, _ delay: Double) {
    guard timers.count < 256 && delay.isFinite else { scriptException(); return }
    let item = DispatchWorkItem { [weak self] in
      guard let self, !self.destroyed, self.timers.removeValue(forKey: id) != nil else { return }
      self.context?.objectForKeyedSubscript("__nexusTimer")?.call(withArguments: [id])
    }
    timers[id] = item
    queue.asyncAfter(deadline: .now() + min(60, max(0, delay / 1000)), execute: item)
  }
  private func event(_ event: String, _ json: String) {
    guard !destroyed, json.utf8.count <= 1024 * 1024,
          let object = try? JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any] else { scriptException(); return }
    switch event {
    case "inited":
      guard !initialized, let pending = initialization, object["sources"] is [String: Any] else { return }
      initialized = true; initialization = nil; initializationDeadline?.cancel(); initializationDeadline = nil
      pending(.success(json))
    case "requestSucceeded":
      guard let id = object["id"] as? String else { return }
      finish(id, .success(ScriptUtilities.json(object["result"] ?? NSNull())))
    case "requestFailed":
      if let id = object["id"] as? String { finish(id, .failure(.request)) }
    default: break
    }
  }
  private func finish(_ id: String, _ result: Result<String, ScriptRuntimeError>) {
    deadlines.removeValue(forKey: id)?.cancel()
    requests.removeValue(forKey: id)?(result)
  }
  private func scriptException() {
    if let pending = initialization { initialization = nil; pending(.failure(.invalid)) }
    // An uncaught exception can invalidate script-owned state. Fail all work
    // and release this runtime rather than letting future requests hang.
    teardown()
  }
  private func teardown() {
    guard !destroyed else { return }; destroyed = true; initialized = false
    initializationDeadline?.cancel(); initializationDeadline = nil
    let pending = initialization; initialization = nil; pending?(.failure(.destroyed))
    for item in timers.values { item.cancel() }; timers.removeAll()
    for item in deadlines.values { item.cancel() }; deadlines.removeAll()
    let callbacks = requests.values; requests.removeAll()
    for callback in callbacks { callback(.failure(.destroyed)) }
    http?.destroy(); http = nil
    context?.exceptionHandler = nil; context = nil
  }
}
