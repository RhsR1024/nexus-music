import ExpoModulesCore
import UIKit
import WebKit

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
