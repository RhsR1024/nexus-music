import ExpoModulesCore

public final class NexusNativeModule: Module {
  private let runtimeQueue = DispatchQueue(label: "nexus.lx.registry")
  private var runtimes: [String: (revision: Int, runtime: ScriptRuntime)] = [:]
  private var revisions: [String: Int] = [:]
  private var downloads: [String: (client: ScriptHTTP, promise: Promise)] = [:]
  private let coverQueue = DispatchQueue(label: "nexus.covers")
  private let covers = CoverCache()
  private var coverRequests: [String: (client: ScriptHTTP, promises: [Promise])] = [:]

  public func definition() -> ModuleDefinition {
    Name("NexusNative")
    AsyncFunction("decodeImportText") { (base64: String) throws -> String in try ScriptUtilities.perform("importText", ["input": base64]) as! String }.runOnQueue(runtimeQueue)
    AsyncFunction("decodeKRC") { (base64: String) throws -> String in try ScriptUtilities.perform("krcDecode", ["input": base64]) as! String }.runOnQueue(runtimeQueue)
    AsyncFunction("decodeQRC") { (hex: String) throws -> String in try ScriptUtilities.perform("qrcDecode", ["input": hex]) as! String }.runOnQueue(runtimeQueue)
    AsyncFunction("coverStatistics") { self.covers.statistics() }.runOnQueue(coverQueue)
    AsyncFunction("clearCovers") { self.covers.clear() }.runOnQueue(coverQueue)
    AsyncFunction("fetchCover") { (key: String, url: String, promise: Promise) in
      if let hit = self.covers.hit(key) { promise.resolve(hit); return }
      if var pending = self.coverRequests[key] { pending.promises.append(promise); self.coverRequests[key] = pending; return }
      guard self.coverRequests.count < 4 else { promise.reject("COVER_BUSY", "封面加载繁忙"); return }
      let client = ScriptHTTP(queue: self.coverQueue)
      let epoch = self.covers.epoch
      self.coverRequests[key] = (client, [promise])
      client.start(id: 1, url: url, optionsJSON: "{\"binary\":true,\"timeout\":10000}") { [weak self] error, response in
        guard let self, let pending = self.coverRequests.removeValue(forKey: key) else { return }
        pending.client.destroy()
        let status = response?["statusCode"] as? Int ?? 0
        let data = (response?["body"] as? String).flatMap { Data(base64Encoded: $0) }
        let result = error == nil && epoch == self.covers.epoch && (200..<300).contains(status) ? data.flatMap { self.covers.store($0, key: key) } : nil
        for promise in pending.promises { if let result { promise.resolve(result) } else { promise.reject("COVER_FAILED", "封面暂不可用") } }
      }
    }.runOnQueue(coverQueue)
    AsyncFunction("fetchScript") { (url: String, promise: Promise) in
      guard self.downloads.count < 4 else { promise.reject("DOWNLOAD_LIMIT", "请等待其他导入完成"); return }
      let id = UUID().uuidString, client = ScriptHTTP(queue: self.runtimeQueue)
      self.downloads[id] = (client, promise)
      client.start(id: 1, url: url, optionsJSON: "{\"timeout\":15000}") { [weak self] error, response in
        guard let self, let pending = self.downloads.removeValue(forKey: id) else { return }
        pending.client.destroy()
        guard error == nil, let status = response?["statusCode"] as? Int, (200..<300).contains(status),
              let script = response?["body"] as? String, !script.isEmpty else {
          pending.promise.reject("SOURCE_DOWNLOAD_FAILED", "无法下载有效音源，请检查地址或网络"); return
        }
        pending.promise.resolve(script)
      }
    }.runOnQueue(runtimeQueue)
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
      self.coverQueue.async { [self] in
        for pending in coverRequests.values { pending.client.destroy(); for promise in pending.promises { promise.reject("COVER_CANCELLED", "封面加载已结束") } }
        coverRequests.removeAll()
      }
      self.runtimeQueue.async { [self] in
        for entry in runtimes.values { entry.runtime.destroy() }
        runtimes.removeAll(); revisions.removeAll()
        for entry in downloads.values { entry.client.destroy(); entry.promise.reject("SOURCE_DESTROYED", "操作已结束") }
        downloads.removeAll()
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
