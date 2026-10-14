import ExpoModulesCore

public final class NexusNativeModule: Module {
  private let runtimeQueue = DispatchQueue(label: "nexus.lx.registry")
  private var runtimes: [String: (revision: Int, runtime: ScriptRuntime)] = [:]
  private var revisions: [String: Int] = [:]

  public func definition() -> ModuleDefinition {
    Name("NexusNative")
    AsyncFunction("initializeSource") { (id: String, revision: Int, name: String, script: String, promise: Promise) in
      guard revision > (self.revisions[id] ?? 0), self.runtimes[id] != nil || self.runtimes.count < 32,
            let bundleURL = Bundle(for: NexusNativeModule.self).url(forResource: "NexusNative", withExtension: "bundle"),
            let bundle = Bundle(url: bundleURL), let path = bundle.url(forResource: "bootstrap", withExtension: "js"),
            let bootstrap = try? String(contentsOf: path, encoding: .utf8) else {
        promise.reject("SOURCE_INITIALIZATION_INVALID", "音源初始化失败"); return
      }
      self.runtimes[id]?.runtime.destroy()
      self.revisions[id] = revision
      let runtime = ScriptRuntime(id: id, revision: revision)
      self.runtimes[id] = (revision, runtime)
      runtime.initialize(script: script, name: name, bootstrap: bootstrap) { result in self.complete(promise, result) }
    }.runOnQueue(runtimeQueue)

    AsyncFunction("requestSource") { (id: String, revision: Int, requestID: String, payload: String, promise: Promise) in
      guard let current = self.runtimes[id], current.revision == revision else {
        promise.reject("SOURCE_STALE", "音源已更新或停用"); return
      }
      current.runtime.request(id: requestID, payloadJSON: payload) { result in self.complete(promise, result) }
    }.runOnQueue(runtimeQueue)

    AsyncFunction("cancelRequest") { (id: String, revision: Int, requestID: String) in
      if let current = self.runtimes[id], current.revision == revision { current.runtime.cancel(id: requestID) }
    }.runOnQueue(runtimeQueue)

    AsyncFunction("destroySource") { (id: String, revision: Int) in
      if let current = self.runtimes[id], current.revision == revision {
        current.runtime.destroy(); self.runtimes.removeValue(forKey: id)
      }
    }.runOnQueue(runtimeQueue)

    OnDestroy {
      self.runtimeQueue.async { [self] in
        for entry in runtimes.values { entry.runtime.destroy() }
        runtimes.removeAll(); revisions.removeAll()
      }
    }
  }
  private func complete(_ promise: Promise, _ result: Result<String, ScriptRuntimeError>) {
    switch result {
    case .success(let json): promise.resolve(json)
    case .failure(let error): promise.reject(error.rawValue, "音源操作失败，请重试或更换音源")
    }
  }
}
