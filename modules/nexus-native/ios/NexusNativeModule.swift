import ExpoModulesCore
import UIKit

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
  private let exportCovers = CoverCache(directory: FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("NexusExportCovers"), maximumBytes: 16 * 1024 * 1024)
  private var coverRequests: [String: (client: ScriptHTTP, promises: [Promise])] = [:]
  private var powerObserver: NSObjectProtocol?
  private let dlnaService = NativeDlnaService()
  private let audioMatch = NativeAudioMatch()

  public func definition() -> ModuleDefinition {
    Name("NexusNative")
    Events("onPowerStateChange", "onSourceUpdateAlert", "onAudioMatchLevel", "onCarCommand")
    OnStartObserving("onCarCommand") {
      NexusCarBridgeStore.shared.setCommandHandler { [weak self] cmd in
        self?.sendEvent("onCarCommand", cmd)
      }
    }
    OnStopObserving("onCarCommand") {
      NexusCarBridgeStore.shared.setCommandHandler(nil)
    }
    OnStartObserving("onPowerStateChange") {
      self.startPowerObservation()
    }
    OnStopObserving("onPowerStateChange") {
      self.stopPowerObservation()
    }
    Function("isLowPowerModeEnabled") {
      ProcessInfo.processInfo.isLowPowerModeEnabled
    }
    AsyncFunction("setKeepScreenOn") { (enabled: Bool) in
      UIApplication.shared.isIdleTimerDisabled = enabled
    }.runOnQueue(.main)
    Function("convertChinese") { (text: String, mode: String) -> String in
      guard mode == "simplified" || mode == "traditional", !text.isEmpty else { return text }
      let mutable = NSMutableString(string: text) as CFMutableString
      let transform = (mode == "traditional" ? "Simplified-Traditional" : "Traditional-Simplified") as CFString
      CFStringTransform(mutable, nil, transform, false)
      return mutable as String
    }
    View(NexusMaterialView.self) {
      Prop("dark") { (view: NexusMaterialView, dark: Bool) in view.setDark(dark) }
      Prop("variant") { (view: NexusMaterialView, variant: String) in view.setVariant(variant) }
      Prop("radius") { (view: NexusMaterialView, radius: Double) in view.setRadius(radius) }
      Prop("intensity") { (view: NexusMaterialView, intensity: Int) in view.setIntensity(intensity) }
    }
    View(NexusPublicMVView.self) {
      ViewName("PublicMV")
      Events("onState")
      Prop("source") { (view: NexusPublicMVView, value: String) in view.source = value }
      Prop("active") { (view: NexusPublicMVView, value: Bool) in view.active = value }
      OnViewDidUpdateProps { (view: NexusPublicMVView) in view.applyProps() }
    }
    View(NexusNativeVideoView.self) {
      ViewName("NativeVideo")
      Events("onState")
      Prop("source") { (view: NexusNativeVideoView, value: String) in view.source = value }
      Prop("active") { (view: NexusNativeVideoView, value: Bool) in view.active = value }
      Prop("paused") { (view: NexusNativeVideoView, value: Bool) in view.paused = value }
      Prop("seekTo") { (view: NexusNativeVideoView, value: Double) in view.seekTo = value }
      OnViewDidUpdateProps { (view: NexusNativeVideoView) in view.applyProps() }
    }
    View(NexusRadioGlobeView.self) {
      ViewName("RadioGlobe")
      Events("onSelect")
      Prop("html") { (view: NexusRadioGlobeView, value: String) in view.html = value }
      Prop("pointsJson") { (view: NexusRadioGlobeView, value: String) in view.pointsJson = value }
      Prop("commandJson") { (view: NexusRadioGlobeView, value: String) in view.commandJson = value }
      OnViewDidUpdateProps { (view: NexusRadioGlobeView) in view.applyProps() }
    }
    View(NexusLocalCanvasView.self) {
      ViewName("LocalCanvas")
      Events("onAction")
      Prop("html") { (view: NexusLocalCanvasView, value: String) in view.html = value }
      Prop("stateJson") { (view: NexusLocalCanvasView, value: String) in view.stateJson = value }
      OnViewDidUpdateProps { (view: NexusLocalCanvasView) in view.applyProps() }
    }
    View(NexusVinylPivotView.self) {
      ViewName("VinylPivot")
    }
    View(NexusVinylReflectionView.self) {
      ViewName("VinylReflection")
    }
    View(NexusPhotoMaskView.self) {
      ViewName("PhotoMask")
      OnViewDidUpdateProps { (view: NexusPhotoMaskView) in view.applyMask() }
    }
    View(NexusRoutePickerView.self) {
      ViewName("RoutePicker")
      Prop("tint") { (view: NexusRoutePickerView, value: String) in view.setTint(value) }
      Prop("activeTint") { (view: NexusRoutePickerView, value: String) in view.setActiveTint(value) }
    }
    View(NexusDeviceVolumeView.self) {
      ViewName("DeviceVolume")
      Prop("tint") { (view: NexusDeviceVolumeView, value: String) in view.setTint(value) }
    }
    View(NexusLyricGestureView.self) {
      ViewName("LyricGesture")
      Events("onDoubleTap", "onLongPress")
    }
    View(NexusAmbientView.self) {
      ViewName("Ambient")
      Prop("colors") { (view: NexusAmbientView, colors: [String]) in view.setColors(colors) }
      Prop("identity") { (view: NexusAmbientView, identity: String) in view.setIdentity(identity) }
      Prop("moving") { (view: NexusAmbientView, moving: Bool) in view.setMoving(moving) }
      Prop("pending") { (view: NexusAmbientView, pending: Bool) in view.setPending(pending) }
      Prop("dark") { (view: NexusAmbientView, dark: Bool) in view.setDark(dark) }
      OnViewDidUpdateProps { (view: NexusAmbientView) in view.applyProps() }
    }
    View(NexusMeshView.self) {
      ViewName("Mesh")
      Prop("colors") { (view: NexusMeshView, colors: [String]) in view.setColors(colors) }
      Prop("identity") { (view: NexusMeshView, identity: String) in view.setIdentity(identity) }
      Prop("moving") { (view: NexusMeshView, moving: Bool) in view.setMoving(moving) }
      Prop("pending") { (view: NexusMeshView, pending: Bool) in view.setPending(pending) }
      Prop("dark") { (view: NexusMeshView, dark: Bool) in view.setDark(dark) }
      OnViewDidUpdateProps { (view: NexusMeshView) in view.applyProps() }
    }
    Function("launchArgument") { (name: String) -> String? in
      ProcessInfo.processInfo.environment[name] ?? UserDefaults.standard.string(forKey: name)
    }
#if targetEnvironment(simulator)
    AsyncFunction("themeObservationSnapshot") { () -> [[String: Any]] in
      NexusAmbientView.observationSnapshot()
    }.runOnQueue(.main)
#endif
    AsyncFunction("decodeImportText") { (base64: String) throws -> String in try ScriptUtilities.perform("importText", ["input": base64]) as! String }.runOnQueue(runtimeQueue)
    AsyncFunction("probeAudioURL") { (id: String, url: String, promise: Promise) in
      guard self.probes[id] == nil, self.probes.count < 2 else { promise.reject("PROBE_BUSY", "请等待其他检查完成"); return }
      let client = AudioURLProbe(queue: self.probeQueue); self.probes[id] = client
      client.start(url) { [weak self] result in self?.probes.removeValue(forKey: id); promise.resolve(result) }
    }.runOnQueue(probeQueue)
    AsyncFunction("cancelAudioProbe") { (id: String) in self.probes[id]?.cancel() }.runOnQueue(probeQueue)
    AsyncFunction("decodeKRC") { (base64: String) throws -> String in try ScriptUtilities.perform("krcDecode", ["input": base64]) as! String }.runOnQueue(runtimeQueue)
    AsyncFunction("decodeQRC") { (hex: String) throws -> String in try ScriptUtilities.perform("qrcDecode", ["input": hex]) as! String }.runOnQueue(runtimeQueue)
    AsyncFunction("coverStatistics") {
      let normal = self.covers.statistics(), exported = self.exportCovers.statistics()
      return ["files": (normal["files"] as? Int ?? 0) + (exported["files"] as? Int ?? 0), "bytes": (normal["bytes"] as? Int ?? 0) + (exported["bytes"] as? Int ?? 0)]
    }.runOnQueue(coverQueue)
    AsyncFunction("clearCovers") { self.covers.clear(); self.exportCovers.clear() }.runOnQueue(coverQueue)
    AsyncFunction("fetchCover") { (key: String, url: String, maxPixelSize: Int, promise: Promise) in
      self.fetchCover(key, url: url, maximum: maxPixelSize, exporting: false, promise: promise)
    }.runOnQueue(coverQueue)
    AsyncFunction("fetchExportCover") { (key: String, url: String, maxPixelSize: Int, promise: Promise) in
      self.fetchCover(key, url: url, maximum: maxPixelSize, exporting: true, promise: promise)
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
      runtime.onUpdateAlert = { [weak self] payload in
        self?.sendEvent("onSourceUpdateAlert", [
          "id": id,
          "revision": revision,
          "payload": payload,
        ])
      }
      self.runtimes[id] = (revision, runtime)
      runtime.initialize(script: script, name: name, bootstrap: bootstrap) { result in self.complete(promise, result) }
    }.runOnQueue(runtimeQueue)

    AsyncFunction("probeSourceUpdateAlert") { (id: String, name: String, script: String, waitMs: Int, promise: Promise) in
      guard script.utf8.count <= 8 * 1024 * 1024, let bootstrap = self.bootstrapText() else {
        promise.resolve(NSNull()); return
      }
      let runtime = ScriptRuntime(id: "update-probe:\(id)", revision: 1)
      let boundedWait = min(max(Double(waitMs) / 1000.0, 1.5), 12.0)
      var settled = false
      var timeoutWork: DispatchWorkItem?
      let finishProbe: (String?) -> Void = { payload in
        self.runtimeQueue.async {
          guard !settled else { return }
          settled = true
          timeoutWork?.cancel()
          timeoutWork = nil
          runtime.destroy()
          if let payload { promise.resolve(payload) } else { promise.resolve(NSNull()) }
        }
      }
      runtime.onUpdateAlert = { payload in
        finishProbe(payload)
      }
      let work = DispatchWorkItem { finishProbe(nil) }
      timeoutWork = work
      self.runtimeQueue.asyncAfter(deadline: .now() + boundedWait, execute: work)
      runtime.initialize(script: script, name: name, bootstrap: bootstrap) { result in
        if case .failure = result {
          // Some scripts emit updateAlert slightly after/before init failure; keep a brief grace window.
          self.runtimeQueue.asyncAfter(deadline: .now() + 1.5) { finishProbe(nil) }
        }
      }
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

    AsyncFunction("dlnaDiscover") { (timeoutMs: Int, promise: Promise) in
      self.dlnaService.discover(timeoutMs: timeoutMs) { devices in
        promise.resolve(devices)
      }
    }
    AsyncFunction("dlnaStartRelay") { (sourceUrl: String, headersJSON: String) throws -> [String: String] in
      try self.dlnaService.startRelay(sourceUrl: sourceUrl, headersJSON: headersJSON)
    }
    AsyncFunction("dlnaStopRelay") {
      self.dlnaService.stopRelay()
    }
    AsyncFunction("dlnaSetKeepAlive") { (enabled: Bool) in
      self.dlnaService.setKeepAlive(enabled)
    }
    AsyncFunction("audioMatchPermission") { () -> String in
      self.audioMatch.permissionStatus()
    }
    AsyncFunction("audioMatchRequestPermission") { (promise: Promise) in
      self.audioMatch.requestPermission { granted in
        promise.resolve(granted)
      }
    }
    AsyncFunction("audioMatchStart") { (durationMs: Int, promise: Promise) in
      self.audioMatch.startCapture(
        durationMs: durationMs,
        onLevel: { [weak self] event in
          self?.sendEvent("onAudioMatchLevel", event)
        },
        completion: { result in
          switch result {
          case .success(let payload): promise.resolve(payload)
          case .failure(let error): promise.reject("AUDIO_MATCH_FAILED", error.localizedDescription)
          }
        }
      )
    }
    AsyncFunction("audioMatchStop") {
      self.audioMatch.stopCapture()
    }
    AsyncFunction("updateCarCatalog") { (json: String) in
      NexusCarBridgeStore.shared.updateCatalog(json: json)
    }
    AsyncFunction("consumePendingCarCommands") { () -> [[String: Any]] in
      NexusCarBridgeStore.shared.consumePendingCommands()
    }
    AsyncFunction("carIntegrationStatus") { () -> [String: Any] in
      NexusCarBridgeStore.shared.statusSnapshot()
    }

    OnDestroy {
      NexusCarBridgeStore.shared.setCommandHandler(nil)
      self.dlnaService.stopRelay()
      self.dlnaService.setKeepAlive(false)
      self.audioMatch.stopCapture()
      self.stopPowerObservation()
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
  private func startPowerObservation() {
    guard powerObserver == nil else { return }
    powerObserver = NotificationCenter.default.addObserver(
      forName: Notification.Name.NSProcessInfoPowerStateDidChange,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      guard let self else { return }
      self.sendEvent("onPowerStateChange", [
        "lowPowerModeEnabled": ProcessInfo.processInfo.isLowPowerModeEnabled
      ])
    }
  }
  private func stopPowerObservation() {
    guard let powerObserver else { return }
    NotificationCenter.default.removeObserver(powerObserver)
    self.powerObserver = nil
  }
  private func resizedNeteaseCoverURL(_ raw: String, maximum: Int) -> String? {
    guard let comps = URLComponents(string: raw),
          let host = comps.host?.lowercased(),
          host.hasSuffix(".music.126.net"),
          comps.query == nil || comps.query?.isEmpty == true else { return nil }
    let ext = (comps.path as NSString).pathExtension.lowercased()
    guard ["jpg", "jpeg", "png", "webp"].contains(ext) else { return nil }
    var updated = comps
    updated.query = "param=\(maximum)y\(maximum)"
    return updated.string
  }
  private func fetchCover(_ key: String, url: String, maximum: Int, exporting: Bool, promise: Promise) {
    guard (exporting ? [256,500,512,1000,1024,1200,2048] : [512,1024]).contains(maximum) else { promise.reject("COVER_SIZE", "封面尺寸无效"); return }
    let cache = exporting ? exportCovers : covers, requestKey = (exporting ? "export:" : "display:") + key
    if let hit = cache.hit(key) { promise.resolve(hit); return }
    if var pending = coverRequests[requestKey] { pending.promises.append(promise); coverRequests[requestKey] = pending; return }
    guard coverRequests.count < 12 else { promise.reject("COVER_BUSY", "封面加载繁忙"); return }
    let client = ScriptHTTP(queue: coverQueue, maxBytes: 24 * 1024 * 1024), epoch = cache.epoch
    coverRequests[requestKey] = (client, [promise])
    let resized = exporting ? nil : resizedNeteaseCoverURL(url, maximum: maximum)
    let initialURL = resized ?? url
    let finish: (String?) -> Void = { [weak self] result in
      guard let self, let pending = self.coverRequests.removeValue(forKey: requestKey) else { return }
      pending.client.destroy()
      for p in pending.promises { if let result { p.resolve(result) } else { p.reject("COVER_FAILED", "封面暂不可用") } }
    }
    let attempt: (String, Bool) -> Void = { targetURL, canFallback in
      client.start(id: canFallback ? 1 : 2, url: targetURL, optionsJSON: "{\"binary\":true,\"timeout\":15000}") { [weak self] error, response in
        guard let self, self.coverRequests[requestKey] != nil else { return }
        let status = response?["statusCode"] as? Int ?? 0
        let data = (response?["body"] as? String).flatMap { Data(base64Encoded: $0) }
        let result = error == nil && epoch == cache.epoch && (200..<300).contains(status) ? data.flatMap { cache.store($0, key: key, maxPixelSize: maximum, exporting: exporting) } : nil
        if let result { finish(result); return }
        if canFallback && targetURL != url {
          client.start(id: 2, url: url, optionsJSON: "{\"binary\":true,\"timeout\":15000}") { [weak self] retryErr, retryResp in
            guard let self, self.coverRequests[requestKey] != nil else { return }
            let retryStatus = retryResp?["statusCode"] as? Int ?? 0
            let retryData = (retryResp?["body"] as? String).flatMap { Data(base64Encoded: $0) }
            let retryResult = retryErr == nil && epoch == cache.epoch && (200..<300).contains(retryStatus) ? retryData.flatMap { cache.store($0, key: key, maxPixelSize: maximum, exporting: exporting) } : nil
            finish(retryResult)
          }
          return
        }
        finish(nil)
      }
    }
    attempt(initialURL, resized != nil)
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
