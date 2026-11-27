import AVFoundation
import AVKit
import ExpoModulesCore
import UIKit
import WebKit

/// Native AVPlayer-backed inline/fullscreen video player for direct MV MP4/HLS streams.
final class NexusNativeVideoView: ExpoView {
  let onState = EventDispatcher()
  private let playerController = AVPlayerViewController()
  private var player: AVPlayer?
  private var timeObserver: Any?
  private var statusObservation: NSKeyValueObservation?
  private var rateObservation: NSKeyValueObservation?
  private var endObserver: NSObjectProtocol?

  var source = ""
  var active = true
  var paused = false
  var seekTo: Double = -1
  private var appliedSource = ""
  private var appliedSeek: Double = -1

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    backgroundColor = .black
    playerController.showsPlaybackControls = true
    playerController.videoGravity = .resizeAspect
    playerController.allowsPictureInPicturePlayback = true
    playerController.view.backgroundColor = .black
    addSubview(playerController.view)

    let center = NotificationCenter.default
    for name in [UIApplication.willResignActiveNotification, UIApplication.didEnterBackgroundNotification] {
      center.addObserver(self, selector: #selector(handleBackground), name: name, object: nil)
    }
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
    teardownPlayer()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    playerController.view.frame = bounds
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      player?.pause()
    } else if active, !paused {
      player?.play()
    }
  }

  @objc private func handleBackground() {
    player?.pause()
  }

  func applyProps() {
    if source != appliedSource {
      appliedSource = source
      teardownPlayer()
      guard let url = Self.validatedStreamURL(source) else {
        if !source.isEmpty {
          onState(["phase": "error", "error": "不支持的视频地址"])
        }
        return
      }
      configurePlayer(url: url)
    }
    if seekTo >= 0, abs(seekTo - appliedSeek) > 0.25, let player {
      appliedSeek = seekTo
      let target = CMTime(seconds: seekTo, preferredTimescale: 600)
      player.seek(to: target, toleranceBefore: .zero, toleranceAfter: .zero)
    }
    if !active || paused || window == nil {
      player?.pause()
    } else {
      player?.play()
    }
  }

  private func configurePlayer(url: URL) {
    onState(["phase": "loading", "playing": false])
    do {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.playback, mode: .moviePlayback, options: [])
      try session.setActive(true)
    } catch {}
    let headers = [
      "Referer": "https://music.163.com/",
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"
    ]
    let asset = AVURLAsset(url: url, options: ["AVURLAssetHTTPHeaderFieldsKey": headers])
    let item = AVPlayerItem(asset: asset)
    let avPlayer = AVPlayer(playerItem: item)
    player = avPlayer
    playerController.player = avPlayer

    statusObservation = item.observe(\.status, options: [.new]) { [weak self] item, _ in
      DispatchQueue.main.async {
        guard let self, self.player?.currentItem === item else { return }
        switch item.status {
        case .readyToPlay:
          let dur = item.duration.seconds
          self.onState([
            "phase": "ready",
            "playing": (self.player?.rate ?? 0) > 0,
            "duration": dur.isFinite && dur > 0 ? dur : 0,
            "position": avPlayer.currentTime().seconds.isFinite ? max(0, avPlayer.currentTime().seconds) : 0
          ])
          if self.active && !self.paused && self.window != nil {
            self.player?.play()
          }
        case .failed:
          self.onState(["phase": "error", "playing": false, "error": "视频流暂时无法播放"])
        default:
          break
        }
      }
    }

    rateObservation = avPlayer.observe(\.rate, options: [.new]) { [weak self] player, _ in
      DispatchQueue.main.async {
        guard let self, self.player === player else { return }
        let pos = player.currentTime().seconds
        let dur = player.currentItem?.duration.seconds ?? 0
        self.onState([
          "playing": player.rate > 0,
          "position": pos.isFinite && pos >= 0 ? pos : 0,
          "duration": dur.isFinite && dur > 0 ? dur : 0
        ])
      }
    }

    endObserver = NotificationCenter.default.addObserver(
      forName: .AVPlayerItemDidPlayToEndTime,
      object: item,
      queue: .main
    ) { [weak self] _ in
      guard let self else { return }
      let dur = item.duration.seconds
      self.onState(["phase": "ended", "playing": false, "position": dur.isFinite ? dur : 0, "duration": dur.isFinite ? dur : 0])
    }

    timeObserver = avPlayer.addPeriodicTimeObserver(forInterval: CMTime(seconds: 0.5, preferredTimescale: 600), queue: .main) { [weak self] time in
      guard let self, let player = self.player else { return }
      let pos = time.seconds
      let dur = player.currentItem?.duration.seconds ?? 0
      self.onState([
        "playing": player.rate > 0,
        "position": pos.isFinite && pos >= 0 ? pos : 0,
        "duration": dur.isFinite && dur > 0 ? dur : 0
      ])
    }

    if active && !paused && window != nil {
      avPlayer.play()
    }
  }

  private func teardownPlayer() {
    if let observer = timeObserver, let player {
      player.removeTimeObserver(observer)
    }
    timeObserver = nil
    statusObservation?.invalidate()
    statusObservation = nil
    rateObservation?.invalidate()
    rateObservation = nil
    if let endObserver {
      NotificationCenter.default.removeObserver(endObserver)
    }
    endObserver = nil
    player?.pause()
    playerController.player = nil
    player = nil
  }

  private static func validatedStreamURL(_ raw: String) -> URL? {
    let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty, trimmed.count <= 4096,
          let components = URLComponents(string: trimmed),
          let scheme = components.scheme?.lowercased(),
          scheme == "https" || scheme == "http",
          components.user == nil, components.password == nil,
          let host = components.host, !host.isEmpty else {
      return nil
    }
    return components.url
  }
}

final class NexusPublicMVView: ExpoView, WKNavigationDelegate, WKUIDelegate {
  let onState = EventDispatcher()
  private let web: WKWebView
  private var root: URL?
  private var navigation: WKNavigation?
  var source = ""
  var active = true
  private var appliedSource: String?
  private var needsLoad = false
  private var suspended: Bool?
  private var documentCommitted = false
  private var preservingDocumentAfterRejection = false
  private var documentGeneration = 0
  private var rulesReady = false
  private var rulesFailed = false
  private var mediaTimer: Timer?
  private var mediaPlayback = "none"
  private var fullscreen = "inline"
  private var fullscreenObservation: NSKeyValueObservation?

  required init(appContext: AppContext? = nil) {
    let configuration = WKWebViewConfiguration()
    configuration.websiteDataStore = .nonPersistent()
    configuration.allowsInlineMediaPlayback = true
    configuration.mediaTypesRequiringUserActionForPlayback = .all
    web = WKWebView(frame: .zero, configuration: configuration)
    super.init(appContext: appContext)
    web.navigationDelegate = self; web.uiDelegate = self
    web.accessibilityIdentifier = "mv-public-webview"
    addSubview(web)
    if #available(iOS 16.0, *) {
      fullscreenObservation = web.observe(\.fullscreenState, options: [.new]) { [weak self] web, _ in
        DispatchQueue.main.async {
          guard let self else { return }
          self.fullscreen = Self.fullscreenName(web.fullscreenState)
          self.sendMediaState()
        }
      }
    }
    WKContentRuleListStore.default().compileContentRuleList(forIdentifier: "nexus-public-mv-privacy-v1", encodedContentRuleList: PublicMVPolicy.privacyRules) { [weak self] rules, _ in
      DispatchQueue.main.async {
        guard let self else { return }
        if let rules { self.web.configuration.userContentController.add(rules); self.rulesReady = true }
        else { self.rulesFailed = true }
        self.syncPlayback()
      }
    }
    let center = NotificationCenter.default
    for name in [UIApplication.willResignActiveNotification, UIApplication.didEnterBackgroundNotification, UIApplication.didBecomeActiveNotification] {
      center.addObserver(self, selector: #selector(syncPlayback), name: name, object: nil)
    }
  }
  deinit {
    NotificationCenter.default.removeObserver(self)
    mediaTimer?.invalidate()
    fullscreenObservation?.invalidate()
    web.stopLoading()
  }
  override func layoutSubviews() { super.layoutSubviews(); web.frame = bounds }
  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil, web.isLoading { needsLoad = true; navigation = nil; web.stopLoading() }
    syncPlayback()
  }
  func applyProps() {
    if source != appliedSource {
      appliedSource = source
      guard let url = PublicMVPolicy.initialURL(source) else {
        documentGeneration += 1; documentCommitted = false
        navigation = nil; root = nil; needsLoad = false
        stopMediaPolling()
        mediaPlayback = "none"; fullscreen = "inline"
        web.stopLoading(); web.isHidden = true
        onState(["phase":"blocked"]); return
      }
      web.isHidden = false
      stopMediaPolling()
      mediaPlayback = "none"; fullscreen = "inline"
      root = url; needsLoad = true
    }
    syncPlayback()
  }
  @objc private func syncPlayback() {
    if rulesFailed { onState(["phase":"error"]); return }
    let allowed = active && window != nil && UIApplication.shared.applicationState == .active
    if suspended != !allowed {
      if !allowed { web.pauseAllMediaPlayback(completionHandler: nil) }
      // A paused page remains paused when it becomes visible again.
      web.setAllMediaPlaybackSuspended(!allowed) { [weak self] in
        DispatchQueue.main.async {
          guard let self else { return }
          self.requestMediaState()
          if self.mediaAllowed() { self.startMediaPolling() } else { self.stopMediaPolling() }
        }
      }
      suspended = !allowed
    }
    if allowed, rulesReady, needsLoad, let root {
      needsLoad = false
      onState(["phase":"loading"])
      navigation = web.load(URLRequest(url: root, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30))
    }
  }
  func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
    documentGeneration += 1
    documentCommitted = false
    self.navigation = navigation; onState(["phase":"loading"])
  }
  func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
    guard navigation === self.navigation else { return }
    documentCommitted = true
    checkDocument(generation: documentGeneration, remaining: 120)
  }
  // DOM readiness does not depend on every third-party image or analytics
  // request finishing. Read only the browser's lifecycle state; never inject
  // content, credentials, or a message bridge into the public document.
  private func checkDocument(generation: Int, remaining: Int) {
    guard generation == documentGeneration, window != nil else { return }
    guard remaining > 0 else { onState(["phase":"error"]); return }
    web.evaluateJavaScript("document.readyState") { [weak self] state, _ in
      guard let self, generation == self.documentGeneration, self.window != nil else { return }
      if let state = state as? String, state == "interactive" || state == "complete" {
        self.onState(["phase":"ready"])
        self.startMediaPolling()
      } else {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { [weak self] in
          self?.checkDocument(generation: generation, remaining: remaining - 1)
        }
      }
    }
  }
  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    guard navigation === self.navigation else { return }
    onState(["phase":"ready"])
    startMediaPolling()
  }
  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { failed(navigation, error) }
  func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { failed(navigation, error) }
  private func failed(_ navigation: WKNavigation?, _ error: Error) {
    guard navigation === self.navigation else { return }
    let code = (error as NSError).code
    if documentCommitted && preservingDocumentAfterRejection && (code == 102 || code == NSURLErrorCancelled) {
      preservingDocumentAfterRejection = false
      checkDocument(generation: documentGeneration, remaining: 120); return
    }
    guard code != NSURLErrorCancelled else { return }
    documentGeneration += 1; documentCommitted = false
    stopMediaPolling()
    onState(["phase":"error"])
  }
  private func rejected(_ action: WKNavigationAction) {
    guard action.targetFrame?.isMainFrame != false else { return }
    if documentCommitted {
      preservingDocumentAfterRejection = true
      // A page's automatic app-launch attempt must not replace document state.
      if action.navigationType == .linkActivated { onState(["notice":"blocked-navigation"]) }
    } else { onState(["phase":"blocked"]) }
  }
  func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
    if action.shouldPerformDownload { rejected(action); decisionHandler(.cancel); return }
    guard let url = action.request.url, let root, PublicMVPolicy.allowsNavigation(url, from: root) else {
      rejected(action)
      decisionHandler(.cancel); return
    }
    if action.targetFrame?.isMainFrame != false { preservingDocumentAfterRejection = false }
    decisionHandler(.allow)
  }
  func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
    let status = (response.response as? HTTPURLResponse)?.statusCode
    // Redirect bodies can have an octet-stream MIME type. The destination still
    // passes the independent HTTPS/platform navigation policy before loading.
    if let status, (300..<400).contains(status) { decisionHandler(.allow); return }
    if response.isForMainFrame, let status, status >= 400 {
      onState(["phase":"error"]); decisionHandler(.cancel); return
    }
    if !response.canShowMIMEType { if response.isForMainFrame { onState(["phase":"blocked"]) }; decisionHandler(.cancel); return }
    decisionHandler(.allow)
  }
  func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
    documentGeneration += 1; documentCommitted = false
    onState(["phase":"error"])
  }
  func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
    if let url = action.request.url, let root, PublicMVPolicy.allowsNavigation(url, from: root) { navigation = web.load(action.request) }
    else { rejected(action) }
    return nil
  }
  @available(iOS 15.0, *)
  func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) { decisionHandler(.deny) }

  private func mediaAllowed() -> Bool {
    active && window != nil && UIApplication.shared.applicationState == .active
  }
  private func startMediaPolling() {
    guard rulesReady, documentCommitted, mediaAllowed() else { return }
    mediaTimer?.invalidate()
    requestMediaState()
    let timer = Timer(timeInterval: 1, repeats: true) { [weak self] _ in self?.requestMediaState() }
    RunLoop.main.add(timer, forMode: .common)
    mediaTimer = timer
    sendMediaState()
  }
  private func stopMediaPolling() {
    mediaTimer?.invalidate()
    mediaTimer = nil
  }
  private func requestMediaState() {
    guard documentCommitted, window != nil else { return }
    let generation = documentGeneration
    web.requestMediaPlaybackState { [weak self] state in
      DispatchQueue.main.async {
        guard let self, generation == self.documentGeneration, self.window != nil else { return }
        self.mediaPlayback = Self.mediaName(state)
        self.sendMediaState()
      }
    }
  }
  private func sendMediaState() {
    onState(["media":mediaPlayback,"fullscreen":fullscreen])
  }
  private static func mediaName(_ state: WKMediaPlaybackState) -> String {
    switch state {
    case .none:return "none"
    case .playing:return "playing"
    case .paused:return "paused"
    case .suspended:return "suspended"
    @unknown default:return "unknown"
    }
  }
  @available(iOS 16.0, *)
  private static func fullscreenName(_ state: WKWebView.FullscreenState) -> String {
    switch state {
    case .notInFullscreen:return "inline"
    case .enteringFullscreen:return "entering"
    case .inFullscreen:return "fullscreen"
    case .exitingFullscreen:return "exiting"
    @unknown default:return "unknown"
    }
  }
}

/// Offline-safe local HTML WebView host for the Global Radio 3D interactive globe.
final class NexusRadioGlobeView: ExpoView, WKScriptMessageHandler, WKNavigationDelegate {
  let onSelect = EventDispatcher()
  private let web: WKWebView
  private var loaded = false
  private var appliedHtmlHash = 0
  private var appliedPoints = ""
  private var appliedCommand = ""

  var html = ""
  var pointsJson = "[]"
  var commandJson = ""

  required init(appContext: AppContext? = nil) {
    let config = WKWebViewConfiguration()
    config.websiteDataStore = .nonPersistent()
    let ucc = WKUserContentController()
    config.userContentController = ucc
    web = WKWebView(frame: .zero, configuration: config)
    super.init(appContext: appContext)
    web.isOpaque = false
    web.backgroundColor = UIColor(red: 0.027, green: 0.071, blue: 0.118, alpha: 1)
    web.scrollView.isScrollEnabled = false
    web.scrollView.bounces = false
    web.navigationDelegate = self
    ucc.add(self, name: "RadioGlobe")
    addSubview(web)
  }

  deinit {
    web.configuration.userContentController.removeScriptMessageHandler(forName: "RadioGlobe")
    web.stopLoading()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    web.frame = bounds
  }

  func applyProps() {
    let h = html.hashValue
    if !html.isEmpty && h != appliedHtmlHash {
      appliedHtmlHash = h
      loaded = false
      web.loadHTMLString(html, baseURL: nil)
      return
    }
    if loaded {
      pushDataIfNeeded()
      pushCommandIfNeeded()
    }
  }

  private func pushDataIfNeeded() {
    guard pointsJson != appliedPoints, !pointsJson.isEmpty else { return }
    appliedPoints = pointsJson
    web.evaluateJavaScript("window.nexusGlobe && window.nexusGlobe.setData(\(pointsJson));", completionHandler: nil)
  }

  private func pushCommandIfNeeded() {
    guard commandJson != appliedCommand, !commandJson.isEmpty else { return }
    appliedCommand = commandJson
    web.evaluateJavaScript("window.nexusGlobe && window.nexusGlobe.command(\(commandJson));", completionHandler: nil)
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    loaded = true
    appliedPoints = ""
    appliedCommand = ""
    pushDataIfNeeded()
    pushCommandIfNeeded()
  }

  func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
    if navigationAction.request.url?.scheme == "about" || navigationAction.request.url == nil {
      decisionHandler(.allow)
    } else {
      decisionHandler(.cancel)
    }
  }

  func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    guard message.name == "RadioGlobe", let body = message.body as? [String: Any] else { return }
    onSelect(body)
  }
}

/// Offline-safe local HTML5 Canvas host for high-DPI interactive player skins (Groove 2 / Teletype 2).
final class NexusLocalCanvasView: ExpoView, WKScriptMessageHandler, WKNavigationDelegate {
  let onAction = EventDispatcher()
  private let web: WKWebView
  private var loaded = false
  private var appliedHtmlHash = 0
  private var appliedState = ""

  var html = ""
  var stateJson = "{}"

  required init(appContext: AppContext? = nil) {
    let config = WKWebViewConfiguration()
    config.websiteDataStore = .nonPersistent()
    let ucc = WKUserContentController()
    config.userContentController = ucc
    web = WKWebView(frame: .zero, configuration: config)
    super.init(appContext: appContext)
    isOpaque = false
    backgroundColor = .clear
    web.isOpaque = false
    web.backgroundColor = .clear
    web.scrollView.backgroundColor = .clear
    web.scrollView.isScrollEnabled = false
    web.scrollView.bounces = false
    web.navigationDelegate = self
    ucc.add(self, name: "NexusCanvas")
    addSubview(web)
  }

  deinit {
    web.configuration.userContentController.removeScriptMessageHandler(forName: "NexusCanvas")
    web.stopLoading()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    web.frame = bounds
  }

  func applyProps() {
    let h = html.hashValue
    if !html.isEmpty && h != appliedHtmlHash {
      appliedHtmlHash = h
      loaded = false
      web.loadHTMLString(html, baseURL: nil)
      return
    }
    if loaded {
      pushStateIfNeeded()
    }
  }

  private func pushStateIfNeeded() {
    guard stateJson != appliedState, !stateJson.isEmpty else { return }
    appliedState = stateJson
    web.evaluateJavaScript("window.nexusCanvas && window.nexusCanvas.setState(\(stateJson));", completionHandler: nil)
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    loaded = true
    appliedState = ""
    pushStateIfNeeded()
  }

  func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
    if navigationAction.request.url?.scheme == "about" || navigationAction.request.url == nil {
      decisionHandler(.allow)
    } else {
      decisionHandler(.cancel)
    }
  }

  func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    guard message.name == "NexusCanvas", let body = message.body as? [String: Any] else { return }
    onAction(body)
  }
}
