import ExpoModulesCore
import UIKit
import WebKit

public final class NexusMusicAuthModule: Module {
  private var sessions: [String: MusicWebLoginSession] = [:]

  public func definition() -> ModuleDefinition {
    Name("NexusMusicAuth")
    AsyncFunction("open") { (id: String, provider: String, url: String, promise: Promise) in
      DispatchQueue.main.async { [weak self] in
        guard let self else { promise.reject("AUTH_UNAVAILABLE", "登录模块已结束"); return }
        guard provider == "wy", url == "https://music.163.com/m/login" else {
          promise.reject("AUTH_UNSUPPORTED", "该平台登录尚未接入")
          return
        }
        guard self.sessions[id] == nil, self.sessions.count < 2 else {
          promise.reject("AUTH_BUSY", "已有登录窗口正在打开")
          return
        }
        guard let presenter = Self.presenter else {
          promise.reject("AUTH_UNAVAILABLE", "暂时无法打开登录页面")
          return
        }
        let session = MusicWebLoginSession(id: id, initialURL: url) { [weak self] id, result in
          self?.sessions.removeValue(forKey: id)
          switch result {
          case .success(let json): promise.resolve(json)
          case .cancelled: promise.reject("AUTH_CANCELLED", "登录已取消")
          case .expired: promise.reject("AUTH_EXPIRED", "登录已过期")
          case .failed: promise.reject("AUTH_FAILED", "登录失败，请重试")
          }
        }
        self.sessions[id] = session
        session.start(from: presenter)
      }
    }
    AsyncFunction("cancel") { (id: String) in
      DispatchQueue.main.async { [weak self] in self?.sessions.removeValue(forKey: id)?.cancel() }
    }
    OnDestroy {
      for session in Array(self.sessions.values) { session.cancel() }
      self.sessions.removeAll()
    }
  }

  private static var presenter: UIViewController? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let window = scenes.flatMap(\.windows).first(where: { $0.isKeyWindow }) ?? scenes.flatMap(\.windows).first
    var controller = window?.rootViewController
    while let presented = controller?.presentedViewController { controller = presented }
    return controller
  }
}

private final class MusicWebLoginSession: NSObject, WKNavigationDelegate, WKUIDelegate {
  enum Result { case success(String), cancelled, expired, failed }

  private let id: String
  private let initialURL: String
  private let completion: (String, Result) -> Void
  private var dataStore: WKWebsiteDataStore?
  private var webView: WKWebView?
  private var presenter: UIViewController?
  private var pollTimer: Timer?
  private var expiryTimer: Timer?
  private var finished = false
  private var pageReady = false

  init(id: String, initialURL: String, completion: @escaping (String, Result) -> Void) {
    self.id = id
    self.initialURL = initialURL
    self.completion = completion
  }

  func start(from presenter: UIViewController) {
    guard let url = URL(string: initialURL) else { finish(.failed); return }
    self.presenter = presenter
    let dataStore = WKWebsiteDataStore.nonPersistent()
    self.dataStore = dataStore
    let configuration = WKWebViewConfiguration()
    configuration.websiteDataStore = dataStore
    let webView = WKWebView(frame: .zero, configuration: configuration)
    webView.navigationDelegate = self
    webView.uiDelegate = self
    webView.allowsBackForwardNavigationGestures = true
    self.webView = webView

    let controller = UIViewController()
    controller.title = "网易云登录"
    controller.view.backgroundColor = .systemBackground
    controller.navigationItem.leftBarButtonItem = UIBarButtonItem(title: "关闭", style: .plain, target: self, action: #selector(cancelPressed))
    webView.translatesAutoresizingMaskIntoConstraints = false
    controller.view.addSubview(webView)
    NSLayoutConstraint.activate([
      webView.leadingAnchor.constraint(equalTo: controller.view.leadingAnchor),
      webView.trailingAnchor.constraint(equalTo: controller.view.trailingAnchor),
      webView.topAnchor.constraint(equalTo: controller.view.safeAreaLayoutGuide.topAnchor),
      webView.bottomAnchor.constraint(equalTo: controller.view.bottomAnchor),
    ])
    let navigation = UINavigationController(rootViewController: controller)
    navigation.modalPresentationStyle = .fullScreen
    presenter.present(navigation, animated: true)
    webView.load(URLRequest(url: url))
    pollTimer = Timer.scheduledTimer(withTimeInterval: 0.8, repeats: true) { [weak self] _ in
      self?.pollCookies()
    }
    expiryTimer = Timer.scheduledTimer(withTimeInterval: 600, repeats: false) { [weak self] _ in
      self?.finish(.expired)
    }
  }

  func cancel() { finish(.cancelled) }

  @objc private func cancelPressed() { cancel() }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    pageReady = true
    pollCookies()
  }

  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
    finish(.failed)
  }

  func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
    finish(.failed)
  }

  func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
    guard let url = navigationAction.request.url else { decisionHandler(.cancel); finish(.failed); return }
    if url.scheme == "about" && url.absoluteString == "about:blank" {
      decisionHandler(.allow)
      return
    }
    guard url.scheme == "https", let host = url.host?.lowercased(), host == "music.163.com" || host.hasSuffix(".music.163.com") else {
      decisionHandler(.cancel)
      return
    }
    decisionHandler(.allow)
  }

  func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
    if navigationAction.targetFrame == nil { webView.load(navigationAction.request) }
    return nil
  }

  private func pollCookies() {
    guard !finished else { return }
    dataStore?.httpCookieStore.getAllCookies { [weak self] cookies in
      guard let self, !self.finished else { return }
      var values: [String: String] = [:]
      for cookie in cookies {
        let domain = cookie.domain.lowercased()
        if domain == "music.163.com" || domain.hasSuffix(".music.163.com") { values[cookie.name] = cookie.value }
      }
      guard let auth = values["MUSIC_U"], !auth.isEmpty, self.pageReady else { return }
      guard JSONSerialization.isValidJSONObject(values), let data = try? JSONSerialization.data(withJSONObject: values), let json = String(data: data, encoding: .utf8) else {
        self.finish(.failed)
        return
      }
      self.finish(.success(json))
    }
  }

  private func finish(_ result: Result) {
    if finished { return }
    finished = true
    pollTimer?.invalidate()
    expiryTimer?.invalidate()
    pollTimer = nil
    expiryTimer = nil
    let presenter = self.presenter
    let webView = self.webView
    self.presenter = nil
    self.webView = nil
    DispatchQueue.main.async {
      presenter?.dismiss(animated: true) {
        webView?.navigationDelegate = nil
        webView?.uiDelegate = nil
        webView?.stopLoading()
        self.completion(self.id, result)
      }
      if presenter == nil { self.completion(self.id, result) }
    }
  }
}
