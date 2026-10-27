import ExpoModulesCore
import UIKit
import WebKit

// Official entry from pinned Q-music-android 5db858f/login.ts. NexusMusic
// owns the WebKit session; no reference app bridge, callback or patch is copied.
enum MusicWebLoginPolicy {
  static let qqURL = "https://graph.qq.com/oauth2.0/authorize?client_id=100497308&redirect_uri=https%3A%2F%2Fy.qq.com%2Fportal%2Fwx_redirect.html%3Flogin_type%3D1%26surl%3Dhttps%253A%252F%252Fy.qq.com%252F&response_type=code&scope=all"
  static func initialURL(_ provider: String, state: String? = nil) -> String? {
    switch provider {
    case "wy": return "https://music.163.com/m/login"
    case "tx":
      guard let state else { return qqURL }
      guard state.range(of: "^[A-Za-z0-9-]{1,128}$", options: .regularExpression) != nil else { return nil }
      return qqURL + "&state=" + state
    default: return nil
    }
  }
  static func matchesCallback(_ url: URL, state: String) -> Bool {
    guard allows(url, provider: "tx"), url.host?.lowercased() == "y.qq.com", url.path == "/portal/wx_redirect.html",
      let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems else { return false }
    return items.filter { $0.name == "state" }.map(\.value) == [state] &&
      items.filter { $0.name == "login_type" }.map(\.value) == ["1"] &&
      items.filter { $0.name == "code" }.count == 1 &&
      items.contains { $0.name == "code" && !($0.value ?? "").isEmpty }
  }
  static func allows(_ url: URL, provider: String) -> Bool {
    if url.absoluteString == "about:blank" { return true }
    guard url.scheme == "https", url.user == nil, url.password == nil,
      url.port == nil || url.port == 443, let host = url.host?.lowercased() else { return false }
    return provider == "tx" ? host == "qq.com" || host.hasSuffix(".qq.com") :
      provider == "wy" && (host == "music.163.com" || host.hasSuffix(".music.163.com"))
  }
  static func cookieNames(_ provider: String) -> Set<String> {
    provider == "tx" ? ["qqmusic_key", "qm_keyst", "musickey", "qqmusic_uin", "uin", "musicid", "login_type", "wxuin"] :
      ["MUSIC_U", "MUSIC_A_T", "MUSIC_R_T", "MUSIC_SNS", "__csrf", "NMTID", "_ntes_nuid"]
  }
  static func ready(_ values: [String: String], provider: String) -> Bool {
    if provider == "wy" { return !(values["MUSIC_U"] ?? "").isEmpty }
    guard provider == "tx", values["login_type"] == nil || values["login_type"] == "1" else { return false }
    let keys = ["qqmusic_key", "qm_keyst", "musickey"].compactMap { values[$0] }.filter { !$0.isEmpty }
    if values["login_type"] == nil && (values["wxuin"] != nil || keys.contains(where: { $0.hasPrefix("W_X") })) { return false }
    return keys.contains(where: { !$0.hasPrefix("W_X") }) &&
      ["qqmusic_uin", "uin", "musicid"].compactMap { values[$0] }.contains(where: {
        $0.range(of: "^o?[0-9]{1,20}$", options: [.regularExpression, .caseInsensitive]) != nil &&
        $0.range(of: "[1-9]", options: .regularExpression) != nil
      })
  }
}

public final class NexusMusicAuthModule: Module {
  private var sessions: [String: MusicWebLoginSession] = [:]

  public func definition() -> ModuleDefinition {
    Name("NexusMusicAuth")
    AsyncFunction("open") { (id: String, provider: String, url: String, promise: Promise) in
      DispatchQueue.main.async { [weak self] in
        guard let self else { promise.reject("AUTH_UNAVAILABLE", "登录模块已结束"); return }
        guard MusicWebLoginPolicy.initialURL(provider, state: id) == url else {
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
        let session = MusicWebLoginSession(id: id, provider: provider, initialURL: url) { [weak self] id, result in
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
  private let provider: String
  private let initialURL: String
  private let completion: (String, Result) -> Void
  private var dataStore: WKWebsiteDataStore?
  private var webView: WKWebView?
  private var presenter: UIViewController?
  private var pollTimer: Timer?
  private var expiryTimer: Timer?
  private var loadingIndicator: UIActivityIndicatorView?
  private weak var loginController: UIViewController?
  private var finished = false
  private var pageReady = false
  private var callbackValidated = false

  init(id: String, provider: String, initialURL: String, completion: @escaping (String, Result) -> Void) {
    self.id = id
    self.provider = provider
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
    webView.accessibilityIdentifier = "music-web-login-\(provider)"
    if provider == "tx" {
      // Request the official website's desktop login controls. The mobile
      // presentation offers only an unsupported QQ-app launch in this host.
      webView.customUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
    }
    webView.navigationDelegate = self
    webView.uiDelegate = self
    webView.allowsBackForwardNavigationGestures = true
    self.webView = webView

    let controller = UIViewController()
    loginController = controller
    controller.title = provider == "tx" ? "QQ 音乐登录" : "网易云登录"
    controller.view.backgroundColor = .systemBackground
    controller.navigationItem.leftBarButtonItem = UIBarButtonItem(title: "关闭", style: .plain, target: self, action: #selector(cancelPressed))
    let loading = UIActivityIndicatorView(style: .medium)
    loading.hidesWhenStopped = true
    loading.isAccessibilityElement = true
    loading.accessibilityLabel = "正在载入登录网页"
    loading.accessibilityIdentifier = "music-web-login-loading-\(provider)"
    loading.startAnimating()
    loadingIndicator = loading
    controller.navigationItem.rightBarButtonItem = UIBarButtonItem(customView: loading)
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

  func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
    pageReady = false
    loadingIndicator?.startAnimating()
    if let loading = loadingIndicator { loginController?.navigationItem.rightBarButtonItem = UIBarButtonItem(customView: loading) }
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    pageReady = true
    loadingIndicator?.stopAnimating()
    loginController?.navigationItem.rightBarButtonItem = nil
    pollCookies()
  }

  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
    if (error as NSError).code == NSURLErrorCancelled { return }
    finish(.failed)
  }

  func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
    if (error as NSError).code == NSURLErrorCancelled { return }
    finish(.failed)
  }

  func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
    guard let url = navigationAction.request.url else { decisionHandler(.cancel); finish(.failed); return }
    guard MusicWebLoginPolicy.allows(url, provider: provider) else {
      decisionHandler(.cancel)
      return
    }
    if provider == "tx", url.host?.lowercased() == "y.qq.com", url.path == "/portal/wx_redirect.html" {
      guard MusicWebLoginPolicy.matchesCallback(url, state: id) else {
        decisionHandler(.cancel); finish(.failed); return
      }
      callbackValidated = true
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
        let domain = cookie.domain.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: "."))
        let allowed = self.provider == "tx" ? domain == "qq.com" || domain.hasSuffix(".qq.com") :
          domain == "music.163.com" || domain.hasSuffix(".music.163.com")
        if allowed, MusicWebLoginPolicy.cookieNames(self.provider).contains(cookie.name),
          cookie.expiresDate == nil || cookie.expiresDate! > Date() { values[cookie.name] = cookie.value }
      }
      guard MusicWebLoginPolicy.ready(values, provider: self.provider), self.pageReady,
        self.provider != "tx" || self.callbackValidated else { return }
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
    let loading = loadingIndicator
    loadingIndicator = nil
    loginController = nil
    self.presenter = nil
    self.webView = nil
    DispatchQueue.main.async {
      loading?.stopAnimating()
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
