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
  deinit { NotificationCenter.default.removeObserver(self); web.stopLoading() }
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
        web.stopLoading(); web.isHidden = true
        onState(["phase":"blocked"]); return
      }
      web.isHidden = false
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
      web.setAllMediaPlaybackSuspended(!allowed, completionHandler: nil)
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
}
