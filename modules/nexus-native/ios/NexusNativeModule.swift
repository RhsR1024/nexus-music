import ExpoModulesCore

public final class NexusNativeModule: Module {
  private let runtimeQueue = DispatchQueue(label: "nexus.lx.registry")
  private let probeQueue = DispatchQueue(label: "nexus.source.health")
  private var runtimes: [String: (revision: Int, runtime: ScriptRuntime)] = [:]
  private var diagnosticRuntimes: [String: ScriptRuntime] = [:]
  private var revisions: [String: Int] = [:]
  private var downloads: [String: (client: ScriptHTTP, promise: Promise)] = [:]
  private var probes: [String: AudioURLProbe] = [:]
  private let coverQueue = CoverCache.queue
  private let covers = CoverCache.shared
  private var coverRequests: [String: (client: ScriptHTTP, promises: [Promise])] = [:]

  public func definition() -> ModuleDefinition {
    Name("NexusNative")
    View(NexusMaterialView.self) {
      Prop("dark") { (view: NexusMaterialView, dark: Bool) in view.setDark(dark) }
    }
    View(NexusAmbientView.self) {
      ViewName("Ambient")
      Prop("colors") { (view: NexusAmbientView, colors: [String]) in view.setColors(colors) }
      Prop("identity") { (view: NexusAmbientView, identity: String) in view.setIdentity(identity) }
      Prop("moving") { (view: NexusAmbientView, moving: Bool) in view.setMoving(moving) }
    }
    AsyncFunction("decodeImportText") { (base64: String) throws -> String in try ScriptUtilities.perform("importText", ["input": base64]) as! String }.runOnQueue(runtimeQueue)
    AsyncFunction("probeAudioURL") { (id: String, url: String, promise: Promise) in
      guard self.probes[id] == nil, self.probes.count < 2 else { promise.reject("PROBE_BUSY", "请等待其他检查完成"); return }
      let client = AudioURLProbe(queue: self.probeQueue); self.probes[id] = client
      client.start(url) { [weak self] result in self?.probes.removeValue(forKey: id); promise.resolve(result) }
    }.runOnQueue(probeQueue)
    AsyncFunction("cancelAudioProbe") { (id: String) in self.probes[id]?.cancel() }.runOnQueue(probeQueue)
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
    AsyncFunction("initializeHealthSource") { (id: String, name: String, script: String, promise: Promise) in
      guard self.diagnosticRuntimes[id] == nil, self.diagnosticRuntimes.count < 2, script.utf8.count <= 8 * 1024 * 1024,
            let bootstrap = self.bootstrapText() else { promise.reject("HEALTH_SOURCE_BUSY", "诊断初始化失败，请稍后重试"); return }
      let runtime = ScriptRuntime(id: "diagnostic:\(id)", revision: 1); self.diagnosticRuntimes[id] = runtime
      runtime.initialize(script: script, name: name, bootstrap: bootstrap) { result in self.complete(promise, result) }
    }.runOnQueue(runtimeQueue)
    AsyncFunction("requestHealthSource") { (id: String, requestID: String, payload: String, promise: Promise) in
      guard let runtime = self.diagnosticRuntimes[id] else { promise.reject("HEALTH_SOURCE_ENDED", "诊断会话已结束"); return }
      runtime.request(id: requestID, payloadJSON: payload) { result in self.complete(promise, result) }
    }.runOnQueue(runtimeQueue)
    AsyncFunction("cancelHealthRequest") { (id: String, requestID: String) in self.diagnosticRuntimes[id]?.cancel(id: requestID) }.runOnQueue(runtimeQueue)
    AsyncFunction("destroyHealthSource") { (id: String) in self.diagnosticRuntimes.removeValue(forKey: id)?.destroy() }.runOnQueue(runtimeQueue)

    OnDestroy {
      self.probeQueue.async { [self] in for probe in Array(probes.values) { probe.cancel() }; probes.removeAll() }
      self.coverQueue.async { [self] in
        for pending in coverRequests.values { pending.client.destroy(); for promise in pending.promises { promise.reject("COVER_CANCELLED", "封面加载已结束") } }
        coverRequests.removeAll()
      }
      self.runtimeQueue.async { [self] in
        for runtime in diagnosticRuntimes.values { runtime.destroy() }; diagnosticRuntimes.removeAll()
        for entry in runtimes.values { entry.runtime.destroy() }
        runtimes.removeAll(); revisions.removeAll()
        for entry in downloads.values { entry.client.destroy(); entry.promise.reject("SOURCE_DESTROYED", "操作已结束") }
        downloads.removeAll()
      }
    }
  }
  private func bootstrapText() -> String? {
    guard let bundleURL = Bundle(for: NexusNativeModule.self).url(forResource: "NexusNative", withExtension: "bundle"),
          let bundle = Bundle(url: bundleURL), let path = bundle.url(forResource: "bootstrap", withExtension: "js") else { return nil }
    return try? String(contentsOf: path, encoding: .utf8)
  }
  private func complete(_ promise: Promise, _ result: Result<String, ScriptRuntimeError>) {
    switch result {
    case .success(let json): promise.resolve(json)
    case .failure(let error): promise.reject(error.rawValue, "音源操作失败，请重试或更换音源")
    }
  }
}
