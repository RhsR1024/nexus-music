import ExpoModulesCore
import UIKit
import WebKit
import CoreImage
import Photos
import CryptoKit
import Security
import AVFoundation

// Official entry from pinned Q-music-android 5db858f/login.ts. NexusMusic
// owns the WebKit session; no reference app bridge, callback or patch is copied.
enum MusicWebLoginPolicy {
  static let dailyURL = "https://y.qq.com/n/ryqq_v2/qqmusic_skills"
  static func dailyOrigin(_ url: URL) -> Bool {
    url.scheme == "https" && url.user == nil && url.password == nil &&
      (url.port == nil || url.port == 443) && ["y.qq.com", "a.qq.com", "a.y.qq.com", "i2.y.qq.com"].contains(url.host?.lowercased() ?? "")
  }
  static let qqURL = "https://graph.qq.com/oauth2.0/authorize?client_id=100497308&redirect_uri=https%3A%2F%2Fy.qq.com%2Fportal%2Fwx_redirect.html%3Flogin_type%3D1%26surl%3Dhttps%253A%252F%252Fy.qq.com%252F&response_type=code&scope=all"
  static let qishuiURL = "https://music.douyin.com/qishui"
  static func initialURL(_ provider: String, state: String? = nil) -> String? {
    switch provider {
    case "wy": return "https://music.163.com/m/login"
    case "tx":
      guard let state else { return qqURL }
      guard state.range(of: "^[A-Za-z0-9-]{1,128}$", options: .regularExpression) != nil else { return nil }
      return qqURL + "&state=" + state
    case "qishui": return qishuiURL
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
    if provider == "tx" { return host == "qq.com" || host.hasSuffix(".qq.com") }
    if provider == "wy" {
      return ["163.com", "163yun.com", "127.net", "126.net", "netease.com"].contains {
        host == $0 || host.hasSuffix(".\($0)")
      }
    }
    if provider == "qishui" {
      return ["douyin.com", "qishui.com", "bytedance.com", "snssdk.com", "iesdouyin.com", "toutiao.com", "zijieapi.com", "bytegoofy.com", "douyinpic.com", "douyincdn.com", "byteimg.com", "yhgfb-cn-static.com", "bytetos.com", "bytegecko.com", "amemv.com"].contains {
        host == $0 || host.hasSuffix(".\($0)")
      }
    }
    return false
  }
  static func cookieNames(_ provider: String) -> Set<String> {
    if provider == "tx" {
      return ["qqmusic_key", "qm_keyst", "musickey", "qqmusic_uin", "uin", "musicid", "login_type", "wxuin", "euin"]
    }
    if provider == "qishui" {
      return ["sessionid", "sessionid_ss", "sid_tt", "uid_tt", "uid_tt_ss", "passport_csrf_token", "passport_csrf_token_default", "ttwid", "odin_tt", "sid_guard", "ssid_ucp_v1", "session_tlb_tag"]
    }
    return ["MUSIC_U", "MUSIC_A_T", "MUSIC_R_T", "MUSIC_SNS", "__csrf", "NMTID", "_ntes_nuid"]
  }
  static func documentReady(_ value: Any?, observedEpoch: Int, currentEpoch: Int, committedEpoch: Int?) -> Bool {
    guard observedEpoch == currentEpoch, committedEpoch == currentEpoch,
      let value = value as? [String: Any], let state = value["state"] as? String,
      let body = value["body"] as? Bool else { return false }
    return body && (state == "interactive" || state == "complete")
  }
  static func ready(_ values: [String: String], provider: String) -> Bool {
    if provider == "wy" { return !(values["MUSIC_U"] ?? "").isEmpty }
    if provider == "qishui" {
      let hasPrimary = !(values["sessionid"] ?? "").isEmpty || !(values["sessionid_ss"] ?? "").isEmpty
      let hasLegacy = !(values["sid_tt"] ?? "").isEmpty &&
        (!(values["uid_tt"] ?? "").isEmpty || !(values["uid_tt_ss"] ?? "").isEmpty || !(values["sid_guard"] ?? "").isEmpty)
      return hasPrimary || hasLegacy
    }
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

private protocol LoginSessionHandle: AnyObject {
  func cancel()
}

public final class NexusMusicAuthModule: Module {
  private var sessions: [String: LoginSessionHandle] = [:]
  private var transfer: AccountTransferRequest?
  private var scanner: AccountTransferScanner?

  public func definition() -> ModuleDefinition {
    Name("NexusMusicAuth")
    AsyncFunction("scanQQTransfer") { (id:String,promise:Promise) in
      guard UUID(uuidString:id) != nil,self.sessions.isEmpty,self.transfer==nil,self.scanner==nil,let presenter=Self.presenter else {promise.reject("TRANSFER_BUSY","暂时无法打开扫码");return}
      let scanner=AccountTransferScanner(id:id){[weak self] result in
        self?.scanner=nil
        switch result {case .success(let code):promise.resolve(code);case .failure:promise.reject("TRANSFER_CAMERA","无法使用相机，请改用配对码")}
      };self.scanner=scanner;presenter.present(scanner,animated:true)
    }.runOnQueue(.main)
    AsyncFunction("receiveQQTransfer") { (id:String,code:String,promise:Promise) in
      guard self.sessions.isEmpty,self.transfer==nil,self.scanner==nil else { promise.reject("TRANSFER_BUSY","已有登录正在进行");return }
      do {
        let request=try AccountTransferRequest(id:id,code:code);self.transfer=request
        request.start{[weak self] result in
          self?.transfer=nil
          switch result {
          case .success(let payload):promise.resolve(payload)
          case .failure(let failure):
            let code=failure == .cancelled ? "TRANSFER_CANCELLED":failure == .expired ? "TRANSFER_EXPIRED":failure == .network ? "TRANSFER_NETWORK":"TRANSFER_INVALID"
            promise.reject(code,"未能验证电脑配对，请重新生成配对码")
          }
        }
      }catch { promise.reject("TRANSFER_INVALID","配对码无效") }
    }.runOnQueue(.main)
    AsyncFunction("cancelQQTransfer") { (id:String) in if self.transfer?.id==id { self.transfer?.cancel() };if self.scanner?.id==id { self.scanner?.cancel() } }.runOnQueue(.main)

    AsyncFunction("open") { (id: String, provider: String, url: String, promise: Promise) in
      DispatchQueue.main.async { [weak self] in
        guard let self else { promise.reject("AUTH_UNAVAILABLE", "登录模块已结束"); return }
        guard MusicWebLoginPolicy.initialURL(provider, state: id) == url else {
          promise.reject("AUTH_UNSUPPORTED", "该平台登录尚未接入")
          return
        }
        guard self.sessions[id] == nil, self.sessions.isEmpty, self.transfer==nil,self.scanner==nil else {
          promise.reject("AUTH_BUSY", "已有登录窗口正在打开")
          return
        }
        guard let presenter = Self.presenter else {
          promise.reject("AUTH_UNAVAILABLE", "暂时无法打开登录页面")
          return
        }
        if provider == "qishui" {
          let session = QishuiQrLoginSession(id: id) { [weak self] id, result in
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
    AsyncFunction("openQQDaily") { (id: String, promise: Promise) in
      DispatchQueue.main.async { [weak self] in
        guard let self, self.sessions.isEmpty, self.transfer==nil,self.scanner==nil, let presenter = Self.presenter,
          id.range(of: "^[A-Za-z0-9-]{1,128}$", options: .regularExpression) != nil else {
          promise.reject("AUTH_UNAVAILABLE", "暂时无法打开授权页面"); return
        }
        let session = MusicWebLoginSession(id: id, provider: "tx", initialURL: MusicWebLoginPolicy.dailyURL, daily: true) { [weak self] id, result in
          self?.sessions.removeValue(forKey: id)
          switch result {
          case .success(let json): promise.resolve(json)
          case .cancelled: promise.reject("AUTH_CANCELLED", "授权已取消")
          case .expired: promise.reject("AUTH_EXPIRED", "授权已过期")
          case .failed: promise.reject("AUTH_FAILED", "授权失败，请重试")
          }
        }
        self.sessions[id] = session; session.start(from: presenter)
      }
    }
    AsyncFunction("neteaseQrRequest") { (path: String, formBody: String, cookieHeader: String, promise: Promise) in
      let allowedPaths: Set<String> = ["/weapi/login/qrcode/unikey", "/weapi/login/qrcode/client/login"]
      guard allowedPaths.contains(path), formBody.utf8.count <= 65536, cookieHeader.utf8.count <= 8192,
            let url = URL(string: "https://music.163.com\(path)") else {
        promise.reject("QR_INVALID", "网易云扫码请求参数无效"); return
      }
      let config = URLSessionConfiguration.ephemeral
      config.httpCookieStorage = nil
      config.httpShouldSetCookies = false
      config.urlCache = nil
      config.timeoutIntervalForRequest = 12
      config.timeoutIntervalForResource = 15
      var req = URLRequest(url: url)
      req.httpMethod = "POST"
      req.httpShouldHandleCookies = false
      req.setValue("application/x-www-form-urlencoded; charset=UTF-8", forHTTPHeaderField: "Content-Type")
      req.setValue("https://music.163.com/", forHTTPHeaderField: "Referer")
      req.setValue("https://music.163.com", forHTTPHeaderField: "Origin")
      req.setValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", forHTTPHeaderField: "User-Agent")
      if !cookieHeader.isEmpty { req.setValue(cookieHeader, forHTTPHeaderField: "Cookie") }
      req.httpBody = Data(formBody.utf8)
      let session = URLSession(configuration: config)
      let task = session.dataTask(with: req) { data, response, error in
        session.finishTasksAndInvalidate()
        if let error {
          promise.reject("QR_NETWORK", error.localizedDescription); return
        }
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
              let data, data.count <= 2 * 1024 * 1024,
              let bodyText = String(data: data, encoding: .utf8) else {
          promise.reject("QR_HTTP", "网易云扫码服务暂时不可用"); return
        }
        var headerFields: [String: String] = [:]
        for (k, v) in http.allHeaderFields {
          headerFields[String(describing: k)] = String(describing: v)
        }
        var setCookies: [String] = []
        let parsedCookies = HTTPCookie.cookies(withResponseHeaderFields: headerFields, for: url)
        for c in parsedCookies {
          setCookies.append("\(c.name)=\(c.value)")
        }
        for (k, v) in headerFields where k.lowercased() == "set-cookie" {
          setCookies.append(v)
        }
        let payload: [String: Any] = ["bodyText": bodyText, "setCookies": setCookies]
        guard let jsonData = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: jsonData, encoding: .utf8) else {
          promise.reject("QR_PARSE", "网易云扫码响应无效"); return
        }
        promise.resolve(json)
      }
      task.resume()
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

private final class MusicWebLoginSession: NSObject, WKNavigationDelegate, WKUIDelegate, LoginSessionHandle {
  enum Result { case success(String), cancelled, expired, failed }

  private let id: String
  private let provider: String
  private let initialURL: String
  private let daily: Bool
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
  private var navigationEpoch = 0
  private var committedEpoch: Int?
  private var documentProbeEpoch: Int?
  private var currentNavigation: WKNavigation?
  private var dailyInspecting = false

  init(id: String, provider: String, initialURL: String, daily: Bool = false, completion: @escaping (String, Result) -> Void) {
    self.id = id
    self.provider = provider
    self.initialURL = initialURL
    self.daily = daily
    self.completion = completion
  }

  func start(from presenter: UIViewController) {
    guard let url = URL(string: initialURL) else { finish(.failed); return }
    self.presenter = presenter
    let dataStore = WKWebsiteDataStore.nonPersistent()
    self.dataStore = dataStore
    let configuration = WKWebViewConfiguration()
    configuration.websiteDataStore = dataStore
    configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
    configuration.allowsInlineMediaPlayback = true
    if daily {
      let captureSource = #"(() => {if(window.__nexusDailyCaptureHooked)return;window.__nexusDailyCaptureHooked=true;const re=/\bqmk-[A-Za-z0-9_-]{12,1024}\b/;const grab=v=>{try{const s=typeof v==='string'?v:JSON.stringify(v);const m=s&&s.match(re);if(m&&m[0])window.__nexusCapturedDailyKey=m[0];}catch{}};try{if(navigator.clipboard&&navigator.clipboard.writeText){const orig=navigator.clipboard.writeText.bind(navigator.clipboard);navigator.clipboard.writeText=function(t){grab(t);return orig(t);};}}catch{}try{const origFetch=window.fetch;if(typeof origFetch==='function'){window.fetch=function(...args){return origFetch.apply(this,args).then(res=>{try{res.clone().text().then(grab).catch(()=>{});}catch{}return res;});};}}catch{}try{const origSend=XMLHttpRequest.prototype.send;XMLHttpRequest.prototype.send=function(...args){this.addEventListener('load',()=>{try{grab(this.responseText);}catch{}});return origSend.apply(this,args);};}catch{}})();"#
      configuration.userContentController.addUserScript(WKUserScript(source: captureSource, injectionTime: .atDocumentStart, forMainFrameOnly: false))
    }
    let webView = WKWebView(frame: .zero, configuration: configuration)
    webView.accessibilityIdentifier = daily ? "qq-daily-authorization-web" : "music-web-login-\(provider)"
    if provider == "tx" {
      // Request the official website's desktop login controls. The mobile
      // presentation offers only an unsupported QQ-app launch in this host.
      webView.customUserAgent = daily ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
    } else if provider == "wy" {
      // Align with Sollin: Chrome mobile UA keeps NetEase on /m/login and avoids iOS app-handoff dead ends.
      webView.customUserAgent = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
    } else if provider == "qishui" {
      // Desktop UA keeps music.douyin.com/qishui on the official Douyin QR-code login experience.
      webView.customUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    }
    webView.navigationDelegate = self
    webView.uiDelegate = self
    webView.allowsBackForwardNavigationGestures = true
    self.webView = webView

    let controller = UIViewController()
    loginController = controller
    controller.title = daily ? "QQ 每日推荐授权" : provider == "tx" ? "QQ 音乐登录" : provider == "qishui" ? "汽水音乐登录" : "网易云登录"
    controller.view.backgroundColor = .systemBackground
    controller.navigationItem.leftBarButtonItem = UIBarButtonItem(title: "关闭", style: .plain, target: self, action: #selector(cancelPressed))
    let loading = UIActivityIndicatorView(style: .medium)
    loading.hidesWhenStopped = true
    loading.isAccessibilityElement = true
    loading.accessibilityLabel = "正在载入登录网页"
    loading.accessibilityIdentifier = daily ? "qq-daily-authorization-loading" : "music-web-login-loading-\(provider)"
    loading.startAnimating()
    loadingIndicator = loading
    controller.navigationItem.rightBarButtonItem = UIBarButtonItem(customView: loading)
    webView.translatesAutoresizingMaskIntoConstraints = false
    if daily || provider == "qishui" {
      let banner = UILabel()
      banner.text = daily
        ? "登录后请点击「快速配置」生成或复制 qmk- 密钥，将自动识别并保存"
        : "点击页面「登录」，用抖音/汽水 App 扫码或手机号登录后将自动保存会话"
      banner.font = .systemFont(ofSize: 12.5, weight: .medium)
      banner.textColor = .secondaryLabel
      banner.textAlignment = .center
      banner.numberOfLines = 2
      banner.backgroundColor = .secondarySystemBackground
      banner.translatesAutoresizingMaskIntoConstraints = false
      controller.view.addSubview(banner)
      controller.view.addSubview(webView)
      NSLayoutConstraint.activate([
        banner.leadingAnchor.constraint(equalTo: controller.view.leadingAnchor),
        banner.trailingAnchor.constraint(equalTo: controller.view.trailingAnchor),
        banner.topAnchor.constraint(equalTo: controller.view.safeAreaLayoutGuide.topAnchor),
        banner.heightAnchor.constraint(greaterThanOrEqualToConstant: 36),
        webView.leadingAnchor.constraint(equalTo: controller.view.leadingAnchor),
        webView.trailingAnchor.constraint(equalTo: controller.view.trailingAnchor),
        webView.topAnchor.constraint(equalTo: banner.bottomAnchor),
        webView.bottomAnchor.constraint(equalTo: controller.view.bottomAnchor),
      ])
    } else {
      controller.view.addSubview(webView)
      NSLayoutConstraint.activate([
        webView.leadingAnchor.constraint(equalTo: controller.view.leadingAnchor),
        webView.trailingAnchor.constraint(equalTo: controller.view.trailingAnchor),
        webView.topAnchor.constraint(equalTo: controller.view.safeAreaLayoutGuide.topAnchor),
        webView.bottomAnchor.constraint(equalTo: controller.view.bottomAnchor),
      ])
    }
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
    guard !finished, self.webView === webView else { return }
    navigationEpoch += 1
    currentNavigation = navigation
    committedEpoch = nil
    pageReady = false
    loadingIndicator?.startAnimating()
    if let loading = loadingIndicator { loginController?.navigationItem.rightBarButtonItem = UIBarButtonItem(customView: loading) }
  }

  func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
    guard !finished, self.webView === webView, let navigation, navigation === currentNavigation else { return }
    committedEpoch = navigationEpoch
    inspectDocument()
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    guard !finished, self.webView === webView, let navigation, navigation === currentNavigation,
      committedEpoch == navigationEpoch else { return }
    markDocumentReady(webView)
  }

  private func isPolicyInterruption(_ error: Error) -> Bool {
    let ns = error as NSError
    if ns.domain == NSURLErrorDomain && ns.code == NSURLErrorCancelled { return true }
    return (ns.domain == "WebKitErrorDomain" || ns.domain == WKErrorDomain) && ns.code == 102
  }

  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
    guard self.webView === webView, let navigation, navigation === currentNavigation else { return }
    if isPolicyInterruption(error) { pollCookies(); return }
    finish(.failed)
  }

  func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
    guard self.webView === webView, let navigation, navigation === currentNavigation else { return }
    if isPolicyInterruption(error) { pollCookies(); return }
    finish(.failed)
  }

  func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
    guard let url = navigationAction.request.url else { decisionHandler(.cancel); finish(.failed); return }
    if url.absoluteString == "about:srcdoc", navigationAction.targetFrame?.isMainFrame == false {
      decisionHandler(.allow)
      return
    }
    guard MusicWebLoginPolicy.allows(url, provider: provider) else {
      pollCookies()
      decisionHandler(.cancel)
      return
    }
    if !daily, provider == "tx", url.host?.lowercased() == "y.qq.com", url.path == "/portal/wx_redirect.html" {
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
    if !pageReady { inspectDocument() }
    if daily {
      inspectDaily()
      return
    }
    guard let webView else { return }
    dataStore?.httpCookieStore.getAllCookies { [weak self] cookies in
      guard let self, !self.finished, self.webView === webView else { return }
      var values: [String: String] = [:]
      let orderedCookies = cookies.sorted {
        $0.domain.trimmingCharacters(in: CharacterSet(charactersIn: ".")).count <
          $1.domain.trimmingCharacters(in: CharacterSet(charactersIn: ".")).count
      }
      for cookie in orderedCookies {
        let domain = cookie.domain.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: "."))
        let allowed: Bool
        if self.provider == "tx" {
          allowed = domain == "qq.com" || domain.hasSuffix(".qq.com")
        } else if self.provider == "qishui" {
          allowed = domain == "douyin.com" || domain.hasSuffix(".douyin.com") || domain == "qishui.com" || domain.hasSuffix(".qishui.com")
        } else {
          allowed = domain == "163.com" || domain.hasSuffix(".163.com")
        }
        if allowed, MusicWebLoginPolicy.cookieNames(self.provider).contains(cookie.name),
          !cookie.value.isEmpty,
          cookie.expiresDate == nil || cookie.expiresDate! > Date() { values[cookie.name] = cookie.value }
      }
      guard MusicWebLoginPolicy.ready(values, provider: self.provider),
        self.provider != "tx" || (self.pageReady && self.callbackValidated) else { return }
      guard JSONSerialization.isValidJSONObject(values), let data = try? JSONSerialization.data(withJSONObject: values), let json = String(data: data, encoding: .utf8) else {
        self.finish(.failed)
        return
      }
      self.finish(.success(json))
    }
  }

  private func documentURL(_ webView: WKWebView) -> URL? {
    guard let url = webView.url, url.scheme == "https", MusicWebLoginPolicy.allows(url, provider: provider),
      !daily || MusicWebLoginPolicy.dailyOrigin(url) else { return nil }
    return url
  }

  private func markDocumentReady(_ webView: WKWebView) {
    guard !finished, self.webView === webView, documentURL(webView) != nil else { return }
    pageReady = true
    loadingIndicator?.stopAnimating()
    loginController?.navigationItem.rightBarButtonItem = nil
    pollCookies()
  }

  // A usable main DOM can precede didFinish when an auxiliary resource stays
  // pending. Never infer authentication from this: cookies and provider profile
  // validation remain independent. Do not probe an old provisional document.
  private func inspectDocument() {
    guard !finished, !pageReady, let webView, let url = documentURL(webView),
      committedEpoch == navigationEpoch, documentProbeEpoch != navigationEpoch else { return }
    let epoch = navigationEpoch
    documentProbeEpoch = epoch
    webView.evaluateJavaScript("({state:document.readyState,body:!!document.body&&document.body.childElementCount>0})") { [weak self] value, _ in
      guard let self else { return }
      if self.documentProbeEpoch == epoch { self.documentProbeEpoch = nil }
      guard !self.finished, self.webView === webView, webView.url == url,
        MusicWebLoginPolicy.documentReady(value, observedEpoch: epoch, currentEpoch: self.navigationEpoch, committedEpoch: self.committedEpoch) else { return }
      self.markDocumentReady(webView)
    }
  }

  // Evaluate only the current main document on the official QQ Skills origins.
  // No message bridge accepts arbitrary frames, URLs or page-supplied cookies.
  private func inspectDaily() {
    guard !finished, !dailyInspecting, let webView, let url = webView.url,
      MusicWebLoginPolicy.dailyOrigin(url) else { return }
    dailyInspecting = true
    let script = #"(() => {const re=/\bqmk-[A-Za-z0-9_-]{12,1024}\b/;if(typeof window.__nexusCapturedDailyKey==='string'&&re.test(window.__nexusCapturedDailyKey))return window.__nexusCapturedDailyKey.match(re)[0];const texts=[(document.body?.innerText||'').slice(0,200000),(document.body?.textContent||'').slice(0,200000),...Array.from(document.querySelectorAll('input,textarea')).slice(0,100).map(x=>String(x.value||'').slice(0,2048))];try{for(let i=0;i<localStorage.length&&i<50;i++){const k=localStorage.key(i);if(k)texts.push(String(localStorage.getItem(k)||'').slice(0,2048));}}catch{}try{for(let i=0;i<sessionStorage.length&&i<50;i++){const k=sessionStorage.key(i);if(k)texts.push(String(sessionStorage.getItem(k)||'').slice(0,2048));}}catch{}return texts.join('\n').match(re)?.[0]||null;})()"#
    webView.evaluateJavaScript(script) { [weak self] value, _ in
      guard let self else { return }
      self.dailyInspecting = false
      guard !self.finished, self.webView === webView,
        let currentURL = webView.url, MusicWebLoginPolicy.dailyOrigin(currentURL),
        let key = value as? String,
        key.range(of: "^qmk-[A-Za-z0-9_-]{12,1024}$", options: .regularExpression) != nil else { return }
      self.dataStore?.httpCookieStore.getAllCookies { [weak self] cookies in
        guard let self, !self.finished, self.webView === webView else { return }
        var values: [String: String] = [:]
        var qqIdentities = Set<String>()
        var wxIdentities = Set<String>()
        let orderedCookies = cookies.sorted {
          $0.domain.trimmingCharacters(in: CharacterSet(charactersIn: ".")).count <
            $1.domain.trimmingCharacters(in: CharacterSet(charactersIn: ".")).count
        }
        for cookie in orderedCookies {
          let domain = cookie.domain.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: "."))
          guard (domain == "qq.com" || domain.hasSuffix(".qq.com")),
            MusicWebLoginPolicy.cookieNames("tx").contains(cookie.name),
            !cookie.value.isEmpty,
            cookie.expiresDate == nil || cookie.expiresDate! > Date() else { continue }
          values[cookie.name] = cookie.value
          if ["uin", "qqmusic_uin", "musicid"].contains(cookie.name),
            cookie.value.range(of: "^o?[0-9]{1,20}$", options: [.regularExpression,.caseInsensitive]) != nil {
            let normalized = cookie.value.replacingOccurrences(of: "^[oO]?0*", with: "", options: .regularExpression)
            if !normalized.isEmpty { qqIdentities.insert(normalized) }
          }
          if ["wxuin", "qqmusic_uin", "musicid"].contains(cookie.name),
            cookie.value.range(of: "^o?[0-9]{1,20}$", options: [.regularExpression,.caseInsensitive]) != nil {
            let normalized = cookie.value.replacingOccurrences(of: "^[oO]?0*", with: "", options: .regularExpression)
            if !normalized.isEmpty { wxIdentities.insert(normalized) }
          }
        }
        let isWx = values["login_type"] == "2" || (values["wxuin"] != nil && !wxIdentities.isEmpty)
        let hasWxKey = ["qqmusic_key", "qm_keyst", "musickey"].compactMap { values[$0] }.contains { !$0.isEmpty }
        let qqReady = MusicWebLoginPolicy.ready(values, provider: "tx") && qqIdentities.count == 1
        let wxReady = isWx && hasWxKey && !wxIdentities.isEmpty
        if wxReady && values["login_type"] == nil { values["login_type"] = "2" }
        guard qqReady || wxReady else { return }
        let payload: [String: Any] = ["key": key, "cookies": values]
        guard let data = try? JSONSerialization.data(withJSONObject: payload), let json = String(data: data, encoding: .utf8) else { self.finish(.failed); return }
        self.finish(.success(json))
      }
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

private final class WeakQishuiScriptProxy: NSObject, WKScriptMessageHandler {
  weak var target: WKScriptMessageHandler?
  init(_ target: WKScriptMessageHandler) { self.target = target }
  func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    target?.userContentController(userContentController, didReceive: message)
  }
}

/// Clean-room native Qishui PC QR login session.
/// Dedicated no-redirect URLSession delegate for Qishui 2046 verification bridge requests.
private final class QishuiNoRedirectDelegate: NSObject, URLSessionTaskDelegate {
  func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest,
    completionHandler: @escaping (URLRequest?) -> Void
  ) {
    completionHandler(nil)
  }
}

/// Native CORS bridge for official ByteDance 2046 secondary verification endpoints
/// (strictly limited to auth.zijieapi.com and bff-pc.qishui.com inside the isolated cookie jar).
private final class QishuiVerifyBridgeHandler: NSObject, WKScriptMessageHandlerWithReply {
  weak var webView: WKWebView?
  var isActive = false

  private static let noRedirect = QishuiNoRedirectDelegate()

  private static let session: URLSession = {
    let config = URLSessionConfiguration.ephemeral
    config.httpShouldSetCookies = false
    config.httpCookieAcceptPolicy = .never
    config.httpCookieStorage = nil
    config.urlCache = nil
    config.timeoutIntervalForRequest = 30
    return URLSession(configuration: config, delegate: noRedirect, delegateQueue: nil)
  }()

  static func isBridgeable(_ url: URL) -> Bool {
    guard url.scheme == "https", url.user == nil, url.password == nil,
          url.port == nil || url.port == 443,
          let host = url.host?.lowercased() else { return false }
    return host == "auth.zijieapi.com" || host == "bff-pc.qishui.com"
  }

  func userContentController(
    _ userContentController: WKUserContentController,
    didReceive message: WKScriptMessage,
    replyHandler: @escaping (Any?, String?) -> Void
  ) {
    let origin = message.frameInfo.securityOrigin
    guard isActive, let webView, message.webView === webView, message.frameInfo.isMainFrame,
          origin.protocol == "https", origin.host == "api.qishui.com",
          origin.port == 0 || origin.port == 443,
          let obj = message.body as? [String: Any],
          let rawUrl = obj["url"] as? String,
          let url = URL(string: rawUrl),
          Self.isBridgeable(url) else {
      replyHandler(nil, "rejected")
      return
    }
    let method = (obj["method"] as? String ?? "GET").uppercased()
    guard method == "GET" || method == "POST" else { replyHandler(nil, "rejected"); return }
    var req = URLRequest(url: url)
    req.httpMethod = method
    let blocked: Set<String> = ["cookie", "cookie2", "host", "origin", "referer", "content-length", "connection", "user-agent"]
    if let hdrs = obj["headers"] as? [String: Any] {
      for (k, v) in hdrs where !blocked.contains(k.lowercased()) && !k.lowercased().hasPrefix("sec-") {
        req.setValue(String(describing: v), forHTTPHeaderField: k)
      }
    }
    if method == "POST", let bodyText = obj["body"] as? String {
      req.httpBody = Data(bodyText.utf8)
    }
    if let ua = obj["userAgent"] as? String, !ua.isEmpty {
      req.setValue(ua, forHTTPHeaderField: "User-Agent")
    }
    req.setValue("https://api.qishui.com", forHTTPHeaderField: "Origin")
    req.setValue("https://api.qishui.com/", forHTTPHeaderField: "Referer")

    let store = webView.configuration.websiteDataStore.httpCookieStore
    store.getAllCookies { cookies in
      let host = url.host?.lowercased() ?? ""
      let path = url.path.isEmpty ? "/" : url.path
      let now = Date()
      let matching = cookies.filter { c in
        let d = c.domain.lowercased()
        let bare = d.hasPrefix(".") ? String(d.dropFirst()) : d
        let domainOk = host == bare || (d.hasPrefix(".") && host.hasSuffix("." + bare))
        let alive = c.expiresDate.map { $0 > now } ?? true
        return domainOk && path.hasPrefix(c.path) && alive
      }
      if !matching.isEmpty {
        req.setValue(matching.map { "\($0.name)=\($0.value)" }.joined(separator: "; "), forHTTPHeaderField: "Cookie")
      }
      Self.session.dataTask(with: req) { data, response, error in
        if error != nil {
          DispatchQueue.main.async { replyHandler(nil, "network") }
          return
        }
        guard let http = response as? HTTPURLResponse else {
          DispatchQueue.main.async { replyHandler(nil, "network") }
          return
        }
        let fields = http.allHeaderFields.reduce(into: [String: String]()) {
          $0[String(describing: $1.key)] = String(describing: $1.value)
        }
        let responseCookies = HTTPCookie.cookies(withResponseHeaderFields: fields, for: http.url ?? url)
        let headerStr = fields
          .filter { $0.key.lowercased() != "set-cookie" }
          .map { "\($0.key): \($0.value)" }
          .joined(separator: "\r\n")
        let bodyStr = String(decoding: data ?? Data(), as: UTF8.self)
        let payload: [String: Any] = [
          "status": http.statusCode,
          "body": bodyStr,
          "headers": headerStr,
          "url": (http.url ?? url).absoluteString,
        ]
        DispatchQueue.main.async {
          let group = DispatchGroup()
          for c in responseCookies {
            group.enter()
            store.setCookie(c) { group.leave() }
          }
          group.notify(queue: .main) {
            replyHandler(payload, nil)
          }
        }
      }.resume()
    }
  }
}

/// Clean-room native Qishui PC QR login session.
/// Loads the authentic https://api.qishui.com/ origin inside an isolated non-persistent WKWebView,
/// runs ByteDance's official bdms.js security SDK with full browser context (`account_sdk_source_info`),
/// drives signed PC Passport requests from Swift (injecting native HttpOnly CSRF from WKHTTPCookieStore,
/// CryptoKit MD5 `X-Ss-Stub`, persistent 16/15-digit device identity, and trace headers),
/// merges both WKHTTPCookieStore cookies and JSON `data.session_cookie`, and handles 2046 verification.
private final class QishuiQrLoginSession: NSObject, WKScriptMessageHandler, WKNavigationDelegate, LoginSessionHandle {
  private static let ciContext = CIContext(options: [.cacheIntermediates: false])
  private static let deviceIdKey = "nexus.qishui.device_id.v2"
  private static let installIdKey = "nexus.qishui.install_id.v2"
  private static let portraitIdKey = "nexus.qishui.portrait_id.v1"

  private let id: String
  private let completion: (String, MusicWebLoginSession.Result) -> Void
  private var presenter: UIViewController?
  private var navController: UINavigationController?
  private var dataStore: WKWebsiteDataStore?
  private var webView: WKWebView?
  private var verifyBridge: QishuiVerifyBridgeHandler?
  private var expiryTimer: Timer?
  private var pollTimer: Timer?
  private var generation = 0
  private var finished = false
  private var bootstrapped = false
  private var passportToken = ""
  private var hasScanned = false
  private var transientFailures = 0
  private var transportFailures = 0
  private var confirmWaitAttempts = 0
  private var collectedCookies: [String: String] = [:]
  private var qrImage: UIImage?
  private var currentScanURL = ""
  private var deviceId = ""
  private var installId = ""
  private var portraitId = ""

  private let qrImageView = UIImageView()
  private let spinner = UIActivityIndicatorView(style: .large)
  private let statusLabel = UILabel()
  private let hintLabel = UILabel()
  private let saveButton = UIButton(type: .system)
  private let refreshButton = UIButton(type: .system)
  private let qrCardStack = UIStackView()
  private let verifyContainer = UIView()

  init(id: String, completion: @escaping (String, MusicWebLoginSession.Result) -> Void) {
    self.id = id
    self.completion = completion
  }

  func start(from presenter: UIViewController) {
    self.presenter = presenter
    let vc = UIViewController()
    vc.title = "汽水音乐扫码登录"
    vc.view.backgroundColor = .systemBackground
    vc.navigationItem.leftBarButtonItem = UIBarButtonItem(title: "关闭", style: .plain, target: self, action: #selector(cancelTapped))
    vc.navigationItem.rightBarButtonItem = UIBarButtonItem(title: "刷新", style: .plain, target: self, action: #selector(refreshTapped))

    let titleLbl = UILabel()
    titleLbl.text = "使用汽水音乐 App 扫一扫"
    titleLbl.font = .systemFont(ofSize: 20, weight: .bold)
    titleLbl.textColor = .label
    titleLbl.textAlignment = .center

    let subLbl = UILabel()
    subLbl.text = "登录官方 PC 端会话 · 会员权限与歌单同步可用"
    subLbl.font = .systemFont(ofSize: 13, weight: .regular)
    subLbl.textColor = .secondaryLabel
    subLbl.textAlignment = .center
    subLbl.numberOfLines = 2

    let qrBox = UIView()
    qrBox.backgroundColor = .white
    qrBox.layer.cornerRadius = 20
    qrBox.layer.shadowColor = UIColor.black.cgColor
    qrBox.layer.shadowOpacity = 0.08
    qrBox.layer.shadowRadius = 16
    qrBox.layer.shadowOffset = CGSize(width: 0, height: 6)
    qrBox.translatesAutoresizingMaskIntoConstraints = false

    qrImageView.contentMode = .scaleAspectFit
    qrImageView.layer.magnificationFilter = .nearest
    qrImageView.accessibilityLabel = "汽水音乐登录二维码"
    qrImageView.translatesAutoresizingMaskIntoConstraints = false
    spinner.hidesWhenStopped = true
    spinner.translatesAutoresizingMaskIntoConstraints = false
    qrBox.addSubview(qrImageView)
    qrBox.addSubview(spinner)
    NSLayoutConstraint.activate([
      qrBox.widthAnchor.constraint(equalToConstant: 248),
      qrBox.heightAnchor.constraint(equalToConstant: 248),
      qrImageView.leadingAnchor.constraint(equalTo: qrBox.leadingAnchor, constant: 16),
      qrImageView.trailingAnchor.constraint(equalTo: qrBox.trailingAnchor, constant: -16),
      qrImageView.topAnchor.constraint(equalTo: qrBox.topAnchor, constant: 16),
      qrImageView.bottomAnchor.constraint(equalTo: qrBox.bottomAnchor, constant: -16),
      spinner.centerXAnchor.constraint(equalTo: qrBox.centerXAnchor),
      spinner.centerYAnchor.constraint(equalTo: qrBox.centerYAnchor),
    ])

    statusLabel.text = "正在初始化安全登录会话…"
    statusLabel.font = .systemFont(ofSize: 15, weight: .semibold)
    statusLabel.textColor = .label
    statusLabel.textAlignment = .center
    statusLabel.numberOfLines = 3

    hintLabel.text = "单机用户可点击「保存二维码到相册」，再打开汽水音乐 App 扫一扫相册识别。"
    hintLabel.font = .systemFont(ofSize: 12.5)
    hintLabel.textColor = .secondaryLabel
    hintLabel.textAlignment = .center
    hintLabel.numberOfLines = 3

    saveButton.setTitle("保存二维码到相册", for: .normal)
    saveButton.titleLabel?.font = .systemFont(ofSize: 15, weight: .semibold)
    saveButton.backgroundColor = UIColor.systemTeal.withAlphaComponent(0.14)
    saveButton.tintColor = .systemTeal
    saveButton.layer.cornerRadius = 22
    saveButton.isEnabled = false
    saveButton.contentEdgeInsets = UIEdgeInsets(top: 11, left: 22, bottom: 11, right: 22)
    saveButton.addTarget(self, action: #selector(saveQrTapped), for: .touchUpInside)

    refreshButton.setTitle("刷新二维码", for: .normal)
    refreshButton.titleLabel?.font = .systemFont(ofSize: 14, weight: .medium)
    refreshButton.tintColor = .secondaryLabel
    refreshButton.addTarget(self, action: #selector(refreshTapped), for: .touchUpInside)

    qrCardStack.axis = .vertical
    qrCardStack.alignment = .center
    qrCardStack.spacing = 14
    qrCardStack.translatesAutoresizingMaskIntoConstraints = false
    for v in [titleLbl, subLbl, qrBox, statusLabel, saveButton, refreshButton, hintLabel] {
      qrCardStack.addArrangedSubview(v)
    }

    verifyContainer.isHidden = false
    verifyContainer.alpha = 0.001
    verifyContainer.isUserInteractionEnabled = false
    verifyContainer.backgroundColor = .systemBackground
    verifyContainer.translatesAutoresizingMaskIntoConstraints = false

    vc.view.addSubview(verifyContainer)
    vc.view.addSubview(qrCardStack)
    NSLayoutConstraint.activate([
      qrCardStack.leadingAnchor.constraint(equalTo: vc.view.leadingAnchor, constant: 24),
      qrCardStack.trailingAnchor.constraint(equalTo: vc.view.trailingAnchor, constant: -24),
      qrCardStack.centerYAnchor.constraint(equalTo: vc.view.safeAreaLayoutGuide.centerYAnchor, constant: -10),
      verifyContainer.leadingAnchor.constraint(equalTo: vc.view.leadingAnchor),
      verifyContainer.trailingAnchor.constraint(equalTo: vc.view.trailingAnchor),
      verifyContainer.topAnchor.constraint(equalTo: vc.view.safeAreaLayoutGuide.topAnchor),
      verifyContainer.bottomAnchor.constraint(equalTo: vc.view.bottomAnchor),
    ])

    let nav = UINavigationController(rootViewController: vc)
    nav.modalPresentationStyle = .fullScreen
    self.navController = nav
    presenter.present(nav, animated: true)

    expiryTimer = Timer.scheduledTimer(withTimeInterval: 300, repeats: false) { [weak self] _ in
      self?.finish(.expired)
    }
    startNewQrSession()
  }

  func cancel() { finish(.cancelled) }
  @objc private func cancelTapped() { cancel() }
  @objc private func refreshTapped() { startNewQrSession() }

  @objc private func saveQrTapped() {
    guard let image = qrImage else { return }
    saveButton.isEnabled = false
    let performSave = {
      PHPhotoLibrary.shared().performChanges({
        PHAssetChangeRequest.creationRequestForAsset(from: image)
      }) { [weak self] success, _ in
        DispatchQueue.main.async {
          guard let self, !self.finished else { return }
          self.saveButton.isEnabled = true
          self.hintLabel.text = success
            ? "已保存到相册！请打开汽水音乐 App 扫一扫，从相册选择该二维码确认后返回音枢。"
            : "未能保存到相册，请检查照片权限或使用另一台设备扫码。"
        }
      }
    }
    if #available(iOS 14, *) {
      PHPhotoLibrary.requestAuthorization(for: .addOnly) { [weak self] status in
        if status == .authorized || status == .limited {
          performSave()
        } else {
          DispatchQueue.main.async {
            self?.saveButton.isEnabled = true
            self?.hintLabel.text = "需要允许添加照片权限才能保存二维码，也可直接用另一台设备扫码。"
          }
        }
      }
    } else {
      PHPhotoLibrary.requestAuthorization { [weak self] status in
        if status == .authorized { performSave() }
        else {
          DispatchQueue.main.async {
            self?.saveButton.isEnabled = true
            self?.hintLabel.text = "需要照片权限才能保存二维码，也可直接用另一台设备扫码。"
          }
        }
      }
    }
  }

  private static func ensureDigits(key: String, count: Int, minVal: UInt64, maxVal: UInt64) -> String {
    if let saved = UserDefaults.standard.string(forKey: key),
       saved.count == count, saved.allSatisfy(\.isNumber) {
      return saved
    }
    var bytes = [UInt8](repeating: 0, count: 8)
    _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
    let raw = bytes.reduce(UInt64(0)) { ($0 << 8) | UInt64($1) }
    let span = maxVal - minVal + 1
    let generated = String(minVal + (raw % span))
    UserDefaults.standard.set(generated, forKey: key)
    return generated
  }

  private static func ensurePortraitId() -> String {
    if let saved = UserDefaults.standard.string(forKey: portraitIdKey),
       saved.hasSuffix(".login"),
       UUID(uuidString: String(saved.dropLast(6))) != nil {
      return saved
    }
    let generated = UUID().uuidString.lowercased() + ".login"
    UserDefaults.standard.set(generated, forKey: portraitIdKey)
    return generated
  }

  private static func generateMsTokenSeed() -> String {
    var bytes = Data(count: 88)
    _ = bytes.withUnsafeMutableBytes { SecRandomCopyBytes(kSecRandomDefault, 88, $0.baseAddress!) }
    return bytes.base64EncodedString()
      .replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_")
  }

  private static func md5UpperHex(_ data: Data) -> String {
    Insecure.MD5.hash(data: data).map { String(format: "%02X", $0) }.joined()
  }

  private static func parseCookieString(_ raw: String) -> [String: String] {
    var out: [String: String] = [:]
    let allowed = MusicWebLoginPolicy.cookieNames("qishui")
    for part in raw.split(separator: ";") {
      let pair = part.split(separator: "=", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
      if pair.count == 2, allowed.contains(pair[0]), !pair[1].isEmpty {
        out[pair[0]] = pair[1]
      }
    }
    return out
  }

  private static func renderQrCode(_ text: String) -> UIImage? {
    guard let data = text.data(using: .utf8),
          let filter = CIFilter(name: "CIQRCodeGenerator") else { return nil }
    filter.setValue(data, forKey: "inputMessage")
    filter.setValue("M", forKey: "inputCorrectionLevel")
    guard let output = filter.outputImage else { return nil }
    let scale = max(10, floor(460 / max(1, output.extent.width)))
    let scaled = output.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
    guard let cg = ciContext.createCGImage(scaled, from: scaled.extent) else { return nil }
    let pad: CGFloat = 28
    let total = CGSize(width: scaled.extent.width + pad * 2, height: scaled.extent.height + pad * 2)
    let renderer = UIGraphicsImageRenderer(size: total)
    return renderer.image { ctx in
      UIColor.white.setFill()
      ctx.fill(CGRect(origin: .zero, size: total))
      ctx.cgContext.interpolationQuality = .none
      UIImage(cgImage: cg).draw(in: CGRect(x: pad, y: pad, width: scaled.extent.width, height: scaled.extent.height))
    }
  }

  private static func isOfficialVerificationURL(_ url: URL) -> Bool {
    guard url.scheme == "https", url.user == nil, url.password == nil, let host = url.host?.lowercased() else { return false }
    return ["qishui.com", "zijieapi.com", "yhgfb-cn-static.com", "bytetos.com", "bytegoofy.com", "bytegecko.com"].contains {
      host == $0 || host.hasSuffix("." + $0)
    }
  }

  private static func verificationURL(from value: Any?) -> URL? {
    var address = ""
    if let text = value as? String {
      address = text.trimmingCharacters(in: .whitespacesAndNewlines)
    } else if let obj = value as? [String: Any] {
      var host = (obj["host"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
      if host.lowercased().hasPrefix("https://") { host = String(host.dropFirst(8)) }
      guard !host.isEmpty, !host.contains("/"), !host.contains("@"), !host.contains("?"), !host.contains("#") else { return nil }
      var path = (obj["path"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
      if !path.hasPrefix("/") { path = "/" + path }
      address = "https://" + host + path
    }
    guard !address.isEmpty,
          let url = URL(string: address, relativeTo: URL(string: "https://api.qishui.com/"))?.absoluteURL,
          isOfficialVerificationURL(url) else { return nil }
    return url
  }

  private static func stringVal(_ v: Any?) -> String {
    if let s = v as? String { return s }
    if let n = v as? NSNumber { return n.stringValue }
    return ""
  }

  private static func intVal(_ v: Any?) -> Int {
    if let n = v as? NSNumber { return n.intValue }
    if let s = v as? String, let i = Int(s) { return i }
    return 0
  }

  private static func encodeFormBody(_ form: [String: String]) -> String {
    var comps = URLComponents()
    comps.queryItems = form.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
    return (comps.percentEncodedQuery ?? "").replacingOccurrences(of: "+", with: "%2B")
  }

  private static func parseBizParams(_ raw: Any?, protectingIdentity: Bool = true) -> [String: String] {
    guard let raw else { return [:] }
    let obj: [String: Any]
    if let d = raw as? [String: Any] {
      obj = d
    } else if let text = raw as? String {
      let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
      if trimmed.isEmpty { return [:] }
      if let data = trimmed.data(using: .utf8), let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
        obj = parsed
      } else if trimmed.contains("="), !trimmed.hasPrefix("{"),
                let items = URLComponents(string: "https://api.qishui.com/?" + trimmed)?.queryItems {
        obj = items.reduce(into: [String: Any]()) { $0[$1.name] = $1.value ?? "" }
      } else {
        return [:]
      }
    } else {
      return [:]
    }
    let protected: Set<String> = [
      "token", "aid", "cookie", "sessionid", "sessionid_ss", "next",
      "device_id", "did", "install_id", "iid", "mstoken", "account_sdk_source_info",
    ]
    var out: [String: String] = [:]
    for (k, v) in obj {
      if protectingIdentity && protected.contains(k.lowercased()) { continue }
      if JSONSerialization.isValidJSONObject(v), let d = try? JSONSerialization.data(withJSONObject: v) {
        out[k] = String(decoding: d, as: UTF8.self)
      } else {
        out[k] = stringVal(v)
      }
    }
    return out
  }

  private func teardownWebView() {
    pollTimer?.invalidate()
    pollTimer = nil
    verifyBridge?.isActive = false
    if let old = webView {
      old.evaluateJavaScript("window.__nexusCancelVerify?.(); window.__nexusActiveXhr?.abort();", completionHandler: nil)
      old.configuration.userContentController.removeScriptMessageHandler(forName: "QishuiAuth")
      if #available(iOS 14.0, *) {
        old.configuration.userContentController.removeScriptMessageHandler(forName: "QishuiVerifyBridge", contentWorld: .page)
      }
      old.navigationDelegate = nil
      old.stopLoading()
      old.removeFromSuperview()
    }
    webView = nil
    verifyBridge = nil
    dataStore = nil
    bootstrapped = false
  }

  private func startNewQrSession() {
    guard !finished else { return }
    generation += 1
    let gen = generation
    teardownWebView()
    verifyContainer.alpha = 0.001
    verifyContainer.isUserInteractionEnabled = false
    qrCardStack.isHidden = false
    passportToken = ""
    hasScanned = false
    transientFailures = 0
    transportFailures = 0
    confirmWaitAttempts = 0
    collectedCookies = [:]
    qrImage = nil
    currentScanURL = ""
    qrImageView.image = nil
    saveButton.isEnabled = false
    spinner.startAnimating()
    statusLabel.text = "正在初始化汽水 PC 安全会话…"
    statusLabel.textColor = .label

    deviceId = Self.ensureDigits(key: Self.deviceIdKey, count: 16, minVal: 1_000_000_000_000_000, maxVal: 9_999_999_999_999_999)
    installId = Self.ensureDigits(key: Self.installIdKey, count: 15, minVal: 100_000_000_000_000, maxVal: 999_999_999_999_999)
    portraitId = Self.ensurePortraitId()

    let store = WKWebsiteDataStore.nonPersistent()
    dataStore = store
    let config = WKWebViewConfiguration()
    config.websiteDataStore = store
    let ucc = WKUserContentController()
    ucc.add(WeakQishuiScriptProxy(self), name: "QishuiAuth")
    let bridge = QishuiVerifyBridgeHandler()
    verifyBridge = bridge
    if #available(iOS 14.0, *) {
      ucc.addScriptMessageHandler(bridge, contentWorld: .page, name: "QishuiVerifyBridge")
    }
    config.userContentController = ucc

    // Use authentic WebKit UA (never fake Chrome UA) so navigator.userAgent matches HTTP headers for bdms.js signing.
    let wv = WKWebView(frame: CGRect(x: 0, y: 0, width: 390, height: 640), configuration: config)
    bridge.webView = wv
    wv.navigationDelegate = self
    wv.translatesAutoresizingMaskIntoConstraints = false
    verifyContainer.addSubview(wv)
    NSLayoutConstraint.activate([
      wv.leadingAnchor.constraint(equalTo: verifyContainer.leadingAnchor),
      wv.trailingAnchor.constraint(equalTo: verifyContainer.trailingAnchor),
      wv.topAnchor.constraint(equalTo: verifyContainer.topAnchor),
      wv.bottomAnchor.constraint(equalTo: verifyContainer.bottomAnchor),
    ])
    webView = wv

    // Load the REAL https://api.qishui.com/ origin so WKHTTPCookieStore, localStorage, and bdms.js run natively on-origin.
    wv.load(URLRequest(url: URL(string: "https://api.qishui.com/")!))
    _ = gen
  }

  func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
    guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
    if navigationAction.targetFrame?.isMainFrame == false {
      if url.absoluteString == "about:blank" || Self.isOfficialVerificationURL(url) {
        decisionHandler(.allow)
      } else {
        decisionHandler(.cancel)
      }
      return
    }
    if url.scheme == "https", url.host?.lowercased() == "api.qishui.com" {
      decisionHandler(.allow)
    } else if MusicWebLoginPolicy.allows(url, provider: "qishui") {
      decisionHandler(.allow)
    } else {
      decisionHandler(.cancel)
    }
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    guard !finished, !bootstrapped, webView === self.webView else { return }
    bootstrapped = true
    let gen = generation
    bootstrapPassport(gen: gen)
  }

  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
    guard !finished, !bootstrapped, webView === self.webView else { return }
    spinner.stopAnimating()
    statusLabel.text = "无法连接汽水登录服务，请检查网络后点击刷新"
    statusLabel.textColor = .systemRed
  }

  func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
    guard !finished, !bootstrapped, webView === self.webView else { return }
    spinner.stopAnimating()
    statusLabel.text = "汽水登录初始化失败，请检查网络后点击刷新"
    statusLabel.textColor = .systemRed
  }

  func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    // Primary Passport requests are driven natively via callAsyncJavaScript.
  }

  private func bootstrapPassport(gen: Int) {
    guard !finished, gen == generation, let wv = webView else { return }
    let seed = Self.generateMsTokenSeed()
    wv.callAsyncJavaScript(
      Self.bootstrapScript,
      arguments: ["securitySeed": seed],
      in: nil,
      in: .page
    ) { [weak self] result in
      DispatchQueue.main.async {
        guard let self, !self.finished, gen == self.generation else { return }
        switch result {
        case .success(let val) where (val as? Bool) == true:
          self.statusLabel.text = "正在获取汽水音乐登录二维码…"
          self.requestQrCode(gen: gen)
        default:
          self.spinner.stopAnimating()
          self.statusLabel.text = "汽水安全组件加载失败，请检查网络后点击刷新"
          self.statusLabel.textColor = .systemRed
        }
      }
    }
  }

  private func buildPassportURL(path: String, extraQuery: [String: String]) -> (url: URL, bizTraceId: String)? {
    let bizTrace = String(UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased().prefix(8))
    var params: [String: String] = [
      "aid": "386088",
      "passport_jssdk_version": "2.4.13",
      "passport_jssdk_type": "normal",
      "is_from_ttaccountsdk": "1",
      "language": "zh",
      "account_sdk_source": "web",
      "p_js_v": "2.4.13",
      "p_js_t": "pro",
      "p_zt": "3.3.5",
      "p_ver": "1.0.29",
      "p_bd": "1.0.0.41",
      "is_from_iesaccountsaas": "1",
      "request_host": "app%3A%2F%2Fresources",
      "is_new_login": "1",
      "device_platform": "PC",
      "version_code": "3.5.2",
      "device_id": deviceId,
      "did": deviceId,
      "install_id": installId,
      "iid": installId,
      "biz_trace_id": bizTrace,
    ]
    for (k, v) in extraQuery { params[k] = v }
    var comps = URLComponents(string: "https://api.qishui.com" + path)
    comps?.queryItems = params.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
    guard let url = comps?.url else { return nil }
    return (url, bizTrace)
  }

  private func snapshotCookieJar(completion: @escaping ([String: String]) -> Void) {
    guard let store = dataStore else { completion([:]); return }
    store.httpCookieStore.getAllCookies { cookies in
      var values: [String: String] = [:]
      let allowed = MusicWebLoginPolicy.cookieNames("qishui")
      let now = Date()
      let ordered = cookies.sorted {
        $0.domain.trimmingCharacters(in: CharacterSet(charactersIn: ".")).count <
          $1.domain.trimmingCharacters(in: CharacterSet(charactersIn: ".")).count
      }
      for cookie in ordered {
        let domain = cookie.domain.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: "."))
        let domainOk = domain == "qishui.com" || domain.hasSuffix(".qishui.com") || domain == "douyin.com" || domain.hasSuffix(".douyin.com")
        if domainOk, allowed.contains(cookie.name), !cookie.value.isEmpty,
           cookie.expiresDate == nil || cookie.expiresDate! > now {
          values[cookie.name] = cookie.value
        }
      }
      DispatchQueue.main.async { completion(values) }
    }
  }

  private func sendPassportRequest(
    gen: Int,
    path: String,
    method: String,
    extraQuery: [String: String] = [:],
    form: [String: String]? = nil,
    completion: @escaping (Result<([String: Any], [String: String]), Error>) -> Void
  ) {
    guard !finished, gen == generation, let wv = webView,
          let built = buildPassportURL(path: path, extraQuery: extraQuery) else {
      completion(.failure(NSError(domain: "Qishui", code: -1)))
      return
    }
    snapshotCookieJar { [weak self] jarCookies in
      guard let self, !self.finished, gen == self.generation else { return }
      for (k, v) in jarCookies { self.collectedCookies[k] = v }

      let trace = UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased()
      var headers: [String: String] = [
        "Accept": "application/json, text/javascript",
        "X-Tt-Passport-Verify-Portrait": self.portraitId,
        "X-Tt-Passport-Trace-Id": built.bizTraceId,
        "X-Tt-Trace-Id": "00-\(trace)-\(trace.prefix(16))-01",
      ]
      if let csrf = jarCookies["passport_csrf_token"] ?? jarCookies["passport_csrf_token_default"] ?? self.collectedCookies["passport_csrf_token"] ?? self.collectedCookies["passport_csrf_token_default"], !csrf.isEmpty {
        headers["X-Tt-Passport-Csrf-Token"] = csrf
      }
      var bodyValue: Any = NSNull()
      if let form {
        let encoded = Self.encodeFormBody(form)
        bodyValue = encoded
        headers["Content-Type"] = "application/x-www-form-urlencoded"
        headers["X-Ss-Stub"] = Self.md5UpperHex(Data(encoded.utf8))
      }

      wv.callAsyncJavaScript(
        Self.sendScript,
        arguments: [
          "address": built.url.absoluteString,
          "method": method,
          "headers": headers,
          "body": bodyValue,
        ],
        in: nil,
        in: .page
      ) { [weak self] jsResult in
        DispatchQueue.main.async {
          guard let self, !self.finished, gen == self.generation else { return }
          switch jsResult {
          case .failure(let err):
            completion(.failure(err))
          case .success(let raw):
            guard let resp = raw as? [String: Any],
                  let httpStatus = (resp["status"] as? NSNumber)?.intValue,
                  (200..<300).contains(httpStatus),
                  let text = resp["text"] as? String,
                  let bytes = text.data(using: .utf8),
                  let json = try? JSONSerialization.jsonObject(with: bytes) as? [String: Any] else {
              completion(.failure(NSError(domain: "Qishui", code: -2)))
              return
            }
            let sigLen = (resp["signatureLength"] as? NSNumber)?.intValue ?? 0
            let msLen = (resp["msTokenLength"] as? NSNumber)?.intValue ?? 0
            let bioLen = (resp["browserInfoLength"] as? NSNumber)?.intValue ?? 0
            guard sigLen >= 16, msLen >= 64, bioLen > 0 else {
              completion(.failure(NSError(domain: "Qishui", code: -3, userInfo: [NSLocalizedDescriptionKey: "安全签名未就绪（sig=\(sigLen)）"])))
              return
            }
            self.snapshotCookieJar { [weak self] postCookies in
              guard let self, !self.finished, gen == self.generation else { return }
              for (k, v) in postCookies { self.collectedCookies[k] = v }
              if let dataObj = json["data"] as? [String: Any] {
                let inlineCookie = Self.stringVal(dataObj["session_cookie"])
                if !inlineCookie.isEmpty {
                  for (k, v) in Self.parseCookieString(inlineCookie) {
                    self.collectedCookies[k] = v
                  }
                }
              }
              completion(.success((json, self.collectedCookies)))
            }
          }
        }
      }
    }
  }

  private func requestQrCode(gen: Int) {
    sendPassportRequest(
      gen: gen,
      path: "/passport/web/get_qrcode/",
      method: "GET",
      extraQuery: [
        "next": "https://api.qishui.com",
        "need_logo": "false",
        "need_short_url": "false",
      ]
    ) { [weak self] result in
      guard let self, !self.finished, gen == self.generation else { return }
      self.spinner.stopAnimating()
      switch result {
      case .failure(let err):
        self.statusLabel.text = err.localizedDescription.isEmpty ? "二维码获取失败，请点击刷新重试" : "\(err.localizedDescription)，请点击刷新"
        self.statusLabel.textColor = .systemRed
      case .success(let (body, _)):
        let data = body["data"] as? [String: Any] ?? body
        let token = Self.stringVal(data["token"])
        let indexUrl = Self.stringVal(data["qrcode_index_url"])
        guard !token.isEmpty else {
          let desc = Self.stringVal(data["description"]).isEmpty ? "未能获取汽水登录二维码，请刷新" : Self.stringVal(data["description"])
          self.statusLabel.text = desc
          self.statusLabel.textColor = .systemRed
          return
        }
        self.passportToken = token
        var scanTok = token
        if let comps = URLComponents(string: indexUrl),
           let qTok = comps.queryItems?.first(where: { $0.name == "token" })?.value, !qTok.isEmpty {
          scanTok = qTok
        }
        var dest = URLComponents()
        dest.scheme = "https"
        dest.host = "bff-pc.qishui.com"
        dest.path = "/light/invoke/scan_login"
        dest.queryItems = [
          URLQueryItem(name: "token", value: scanTok),
          URLQueryItem(name: "os", value: "Windows"),
          URLQueryItem(name: "computer_name", value: "NexusMusic"),
        ]
        dest.percentEncodedQuery = dest.percentEncodedQuery?.replacingOccurrences(of: "+", with: "%2B")
        guard let scanUrl = dest.url?.absoluteString else {
          self.statusLabel.text = "二维码地址构造失败，请点击刷新"
          self.statusLabel.textColor = .systemRed
          return
        }
        self.currentScanURL = scanUrl
        let img = Self.renderQrCode(scanUrl)
        self.qrImage = img
        self.qrImageView.image = img
        self.saveButton.isEnabled = img != nil
        self.statusLabel.text = "请打开汽水音乐 App 扫码登录"
        self.statusLabel.textColor = .label
        self.schedulePoll(gen: gen, delay: 2.0)
      }
    }
  }

  private func schedulePoll(gen: Int, delay: TimeInterval) {
    guard !finished, gen == generation, !passportToken.isEmpty else { return }
    pollTimer?.invalidate()
    pollTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
      self?.pollQrConnect(gen: gen, extraQuery: [:], extraForm: [:])
    }
  }

  private func pollQrConnect(gen: Int, extraQuery: [String: String], extraForm: [String: String]) {
    guard !finished, gen == generation, !passportToken.isEmpty else { return }
    var form: [String: String] = [
      "token": passportToken,
      "need_logo": "false",
      "need_short_url": "false",
      "is_frontier": "true",
      "is_new_login": "1",
      "next": "https://api.qishui.com",
    ]
    for (k, v) in extraForm where form[k] == nil { form[k] = v }

    sendPassportRequest(
      gen: gen,
      path: "/passport/web/check_qrconnect/",
      method: "POST",
      extraQuery: extraQuery,
      form: form
    ) { [weak self] result in
      guard let self, !self.finished, gen == self.generation else { return }
      switch result {
      case .failure(let err):
        self.transportFailures += 1
        if self.transportFailures >= 5 {
          self.statusLabel.text = "汽水登录轮询受阻（\(err.localizedDescription)），请点击「刷新二维码」重试"
          self.statusLabel.textColor = .systemRed
          return
        }
        self.schedulePoll(gen: gen, delay: 2.4)
      case .success(let (body, mergedCookies)):
        self.transportFailures = 0
        if self.tryCompleteWithCookies(mergedCookies) { return }

        let data = body["data"] as? [String: Any] ?? body
        let errorCode = Self.intVal(data["error_code"] ?? body["error_code"] ?? body["status_code"])
        let status = Self.stringVal(data["status"] ?? data["qr_status"] ?? body["status"]).lowercased()

        if errorCode == 2046 {
          self.handleSecondaryVerification(gen: gen, body: body, data: data)
          return
        }

        if ["expired", "5", "-1", "timeout", "cancelled", "canceled"].contains(status) || [2, 2043, 10001].contains(errorCode) {
          self.statusLabel.text = "二维码已过期，请点击下方「刷新二维码」"
          self.statusLabel.textColor = .systemRed
          self.saveButton.isEnabled = false
          return
        }

        if ["1", "2", "scanned", "scaned", "confirmed", "3", "success", "confirm"].contains(status) {
          self.hasScanned = true
        }

        if errorCode != 0 {
          if errorCode == 7 || (errorCode == 1049 && self.hasScanned) {
            self.transientFailures += 1
            if self.transientFailures <= 3 {
              self.statusLabel.text = "正在完成汽水安全校验（重试 \(self.transientFailures)/3）…"
              self.statusLabel.textColor = .systemOrange
              self.schedulePoll(gen: gen, delay: 4.5)
              return
            }
          }
          self.statusLabel.text = "汽水登录未通过平台校验（错误码 \(errorCode)），请点击「刷新二维码」重试"
          self.statusLabel.textColor = .systemRed
          return
        }

        self.transientFailures = 0

        if ["confirmed", "3", "success", "confirm"].contains(status) {
          self.statusLabel.text = "已确认登录，正在保存汽水会话…"
          self.statusLabel.textColor = .systemGreen
          self.awaitConfirmedCookieSync(gen: gen, attempt: 1)
          return
        }

        if ["1", "2", "scanned", "scaned"].contains(status) {
          self.statusLabel.text = "已扫码，请在汽水音乐 App 中点击确认"
          self.statusLabel.textColor = .systemTeal
          self.schedulePoll(gen: gen, delay: 1.8)
          return
        }

        // new / unscanned / empty
        self.schedulePoll(gen: gen, delay: 2.0)
      }
    }
  }

  private func awaitConfirmedCookieSync(gen: Int, attempt: Int) {
    guard !finished, gen == generation else { return }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
      guard let self, !self.finished, gen == self.generation else { return }
      self.snapshotCookieJar { [weak self] jarCookies in
        guard let self, !self.finished, gen == self.generation else { return }
        for (k, v) in jarCookies { self.collectedCookies[k] = v }
        if self.tryCompleteWithCookies(self.collectedCookies) { return }
        if attempt < 4 {
          self.awaitConfirmedCookieSync(gen: gen, attempt: attempt + 1)
          return
        }
        self.confirmWaitAttempts += 1
        if self.confirmWaitAttempts <= 4 {
          self.schedulePoll(gen: gen, delay: 1.2)
        } else {
          self.statusLabel.text = "已确认但未收到会话凭据，请点击「刷新二维码」重试"
          self.statusLabel.textColor = .systemRed
        }
      }
    }
  }

  private func tryCompleteWithCookies(_ cookies: [String: String]) -> Bool {
    guard !finished, MusicWebLoginPolicy.ready(cookies, provider: "qishui") else { return false }
    var normalized = cookies
    if normalized["sessionid"] == nil, let ss = normalized["sessionid_ss"], !ss.isEmpty {
      normalized["sessionid"] = ss
    }
    guard JSONSerialization.isValidJSONObject(normalized),
          let data = try? JSONSerialization.data(withJSONObject: normalized),
          let json = String(data: data, encoding: .utf8) else {
      finish(.failed)
      return true
    }
    finish(.success(json))
    return true
  }

  private func handleSecondaryVerification(gen: Int, body: [String: Any], data: [String: Any]) {
    guard !finished, gen == generation else { return }
    statusLabel.text = "平台要求二次安全验证，正在加载验证组件…"
    statusLabel.textColor = .systemOrange

    var decision = body.merging(data) { _, d in d }
    decision["data"] = nil
    if decision["verify_portrait_id"] == nil {
      decision["verify_portrait_id"] = portraitId
    }
    let general: [String: String] = [
      "device_id": deviceId,
      "install_id": installId,
      "did": deviceId,
      "iid": installId,
      "device_platform": "PC",
      "version_code": "3.5.2",
    ]

    let launchComponent: ([String: Any]) -> Void = { [weak self] finalDecision in
      guard let self, !self.finished, gen == self.generation, let wv = self.webView else { return }
      guard let verifyUrl = Self.verificationURL(from: finalDecision["url"]) else {
        self.statusLabel.text = "安全验证组件地址不可用，请点击「刷新二维码」重试"
        self.statusLabel.textColor = .systemRed
        return
      }
      var patchedDecision = finalDecision
      patchedDecision["url"] = verifyUrl.absoluteString
      let bizParams = Self.parseBizParams(finalDecision["biz_params"], protectingIdentity: true)

      self.qrCardStack.isHidden = true
      self.verifyContainer.alpha = 1.0
      self.verifyContainer.isUserInteractionEnabled = true
      self.verifyContainer.superview?.bringSubviewToFront(self.verifyContainer)
      self.verifyBridge?.isActive = true
      wv.callAsyncJavaScript(
        Self.verificationScript,
        arguments: ["decision": patchedDecision, "general": general],
        in: nil,
        in: .page
      ) { [weak self] res in
        DispatchQueue.main.async {
          guard let self, !self.finished, gen == self.generation else { return }
          self.verifyBridge?.isActive = false
          self.verifyContainer.alpha = 0.001
          self.verifyContainer.isUserInteractionEnabled = false
          self.qrCardStack.isHidden = false
          self.qrCardStack.superview?.bringSubviewToFront(self.qrCardStack)
          if case .success(let val) = res,
             let obj = val as? [String: Any],
             (obj["status"] as? Bool) == true {
            self.statusLabel.text = "安全验证通过，正在完成汽水登录…"
            self.statusLabel.textColor = .systemGreen
            self.pollQrConnect(gen: gen, extraQuery: ["isResend": "true"], extraForm: bizParams)
          } else {
            self.statusLabel.text = "安全验证未完成，请点击「刷新二维码」重试"
            self.statusLabel.textColor = .systemOrange
          }
        }
      }
    }

    if Self.stringVal(decision["verify_from"]) == "verify_center" {
      var payload = decision
      payload["aid"] = "386088"
      payload["is_login"] = nil
      for (k, v) in general { payload[k] = v }
      let form = Self.parseBizParams(payload, protectingIdentity: false)
      sendPassportRequest(
        gen: gen,
        path: "/passport/safe/pack_verify_ways_data/",
        method: "POST",
        form: form
      ) { [weak self] res in
        guard let self, !self.finished, gen == self.generation else { return }
        switch res {
        case .success(let (expanded, _)):
          let merged = decision.merging(expanded["data"] as? [String: Any] ?? expanded) { _, v in v }
          launchComponent(merged)
        case .failure:
          self.statusLabel.text = "获取安全验证参数失败，请点击「刷新二维码」重试"
          self.statusLabel.textColor = .systemRed
        }
      }
    } else {
      launchComponent(decision)
    }
  }

  private static let bootstrapScript = #"""
  if (location.origin !== 'https://api.qishui.com') throw new Error('origin');
  localStorage.setItem('xmst', securitySeed);
  localStorage.setItem('xmsty', securitySeed);
  window.__nexusPassportToken = securitySeed;
  let estimate = {};
  try { estimate = await navigator.storage.estimate(); } catch (_) {}
  let storageSize = 0;
  for (let i = 0; i < localStorage.length; i++) storageSize += (localStorage.getItem(localStorage.key(i)) || '').length;
  let permissions = [];
  try {
    const permission = await navigator.permissions.query({ name: 'notifications' });
    permissions = [{ name: 'notifications', state: permission.state }];
  } catch (_) {}
  let graphics = {};
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    if (ext) graphics = { vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL), renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) };
  } catch (_) {}
  const timing = performance.getEntriesByType('navigation')[0] || {};
  const context = {
    hardwareConcurrency: navigator.hardwareConcurrency,
    webdriver: Boolean(navigator.webdriver),
    chromedriver: typeof window.chromedriver !== 'undefined',
    shelldriver: typeof window.shelldriver !== 'undefined',
    plugins: navigator.plugins?.length || 0,
    permissions,
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
    outerHeight: window.outerHeight,
    outerWidth: window.outerWidth,
    stoargeStatus: {
      indexedDB: {
        idb: typeof indexedDB,
        open: typeof indexedDB?.open,
        indexedDB: typeof indexedDB,
        IDBKeyRange: typeof IDBKeyRange,
        openDatabase: typeof window.openDatabase,
        isSafari: /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent),
        hasFetch: typeof fetch === 'function',
      },
      localStorage: { isSupportLStorage: true, size: storageSize, write: true },
      storageQuotaStatus: { usage: estimate.usage, quota: estimate.quota, isPrivate: Boolean(estimate.quota && estimate.quota < 120000000) },
    },
    webgl: graphics,
    notificationPermission: window.Notification?.permission || 'none',
    performance: {
      timeOrigin: performance.timeOrigin,
      usedJSHeapSize: performance.memory?.usedJSHeapSize || 'unsupport',
      navigationTiming: {
        decodedBodySize: timing.decodedBodySize,
        entryType: timing.entryType,
        initiatorType: timing.initiatorType,
        name: timing.name,
        renderBlockingStatus: timing.renderBlockingStatus,
        serverTiming: (timing.serverTiming || []).map(t => t.name).join(','),
        guleStart: 'none',
        guleDuration: 'none',
      },
    },
    request_host: 'resources',
    request_pathname: '/main.asar/main.html',
    browser: { t: String(Date.now()).split('').reverse().join(''), bit_protocol: 'false', bit_helper: false },
  };
  const bytes = new TextEncoder().encode(JSON.stringify(context));
  window.__nexusPassportSourceInfo = Array.from(bytes, b => (b ^ 5).toString(16)).join('');
  window.__nexusSigLen = 0;
  window.__nexusMsLen = 0;
  window.__nexusTokenMatch = false;

  const bridgeHosts = new Set(['auth.zijieapi.com', 'bff-pc.qishui.com']);
  const bridgeTarget = addr => {
    try {
      const u = new URL(String(addr), location.href);
      return u.protocol === 'https:' && !u.username && !u.password && bridgeHosts.has(u.hostname) ? u.href : null;
    } catch (_) { return null; }
  };
  const bridgeSend = req => {
    const h = window.webkit?.messageHandlers?.QishuiVerifyBridge;
    if (!h) return Promise.reject(new Error('bridge unavailable'));
    return h.postMessage({ ...req, userAgent: navigator.userAgent });
  };

  const nativeOpen = XMLHttpRequest.prototype.open;
  const nativeSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  const nativeSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, address) {
    try {
      const parsed = new URL(address, location.href);
      if (parsed.origin === location.origin && (parsed.pathname.startsWith('/passport/web/') || parsed.pathname.startsWith('/passport/safe/pack_verify_ways_data'))) {
        window.__nexusSigLen = (parsed.searchParams.get('a_bogus') || '').length;
        window.__nexusMsLen = (parsed.searchParams.get('msToken') || '').length;
        window.__nexusTokenMatch = parsed.searchParams.get('msToken') === window.__nexusPassportToken;
      }
    } catch (_) {}
    this.__nexusBridgeTarget = bridgeTarget(address);
    this.__nexusBridgeMethod = String(method || 'GET').toUpperCase();
    this.__nexusBridgeHeaders = {};
    return nativeOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
    if (this.__nexusBridgeTarget) this.__nexusBridgeHeaders[String(name)] = String(value);
    return nativeSetHeader.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function(body) {
    if (!this.__nexusBridgeTarget) return nativeSend.apply(this, arguments);
    const xhr = this;
    const define = (name, value) => { try { Object.defineProperty(xhr, name, { configurable: true, value }); } catch (_) {} };
    const emit = name => { try { xhr.dispatchEvent(new Event(name)); } catch (_) {} };
    bridgeSend({ method: xhr.__nexusBridgeMethod, url: xhr.__nexusBridgeTarget, headers: xhr.__nexusBridgeHeaders, body: body == null ? null : String(body) })
      .then(res => {
        const text = String(res.body || '');
        let parsed = text;
        if (xhr.responseType === 'json') { try { parsed = JSON.parse(text); } catch (_) { parsed = null; } }
        const hdrs = String(res.headers || '');
        define('status', Number(res.status) || 0);
        define('statusText', '');
        define('responseText', text);
        define('response', parsed);
        define('responseURL', String(res.url || xhr.__nexusBridgeTarget));
        define('readyState', 4);
        xhr.getAllResponseHeaders = () => hdrs;
        xhr.getResponseHeader = name => {
          const wanted = String(name || '').toLowerCase();
          const line = hdrs.split(/\r?\n/).find(item => item.toLowerCase().startsWith(wanted + ':'));
          return line ? line.slice(line.indexOf(':') + 1).trim() : null;
        };
        emit('readystatechange'); emit('load'); emit('loadend');
      }).catch(() => {
        define('status', 0); define('readyState', 4);
        emit('readystatechange'); emit('error'); emit('loadend');
      });
  };
  const nativeFetch = window.fetch;
  window.fetch = function(input, init) {
    const addr = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
    const target = bridgeTarget(addr);
    if (!target) return nativeFetch.apply(this, arguments);
    const req = new Request(input, init);
    const m = req.method.toUpperCase();
    return (m === 'GET' || m === 'HEAD' ? Promise.resolve(null) : req.text()).then(body =>
      bridgeSend({ method: m, url: target, headers: Object.fromEntries(req.headers.entries()), body })
    ).then(res => {
      const status = Number(res.status) || 0;
      if (status < 200 || status > 599) throw new TypeError('Failed to fetch');
      const headers = new Headers();
      for (const line of String(res.headers || '').split(/\r?\n/)) {
        const idx = line.indexOf(':');
        if (idx > 0) { try { headers.append(line.slice(0, idx).trim(), line.slice(idx + 1).trim()); } catch (_) {} }
      }
      const empty = [101, 204, 205, 304].includes(status) || m === 'HEAD';
      return new Response(empty ? null : String(res.body || ''), { status, headers });
    }, () => { throw new TypeError('Failed to fetch'); });
  };

  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.charset = 'utf-8';
    const timer = setTimeout(() => reject(new Error('sdk timeout')), 15000);
    script.src = 'https://lf-headquarters-speed.yhgfb-cn-static.com/obj/rc-client-security/web/stable/1.0.0.41/bdms.js';
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = () => { clearTimeout(timer); reject(new Error('sdk unavailable')); };
    document.head.appendChild(script);
  });
  if (typeof window.bdms?.init !== 'function') throw new Error('sdk unavailable');
  await window.bdms.init({ aid: 386088, paths: ['/passport'] });
  return true;
  """#

  private static let sendScript = #"""
  const destination = new URL(address);
  if (destination.origin !== location.origin || !(destination.pathname.startsWith('/passport/web/') || destination.pathname.startsWith('/passport/safe/pack_verify_ways_data'))) {
    throw new Error('destination');
  }
  if (!window.__nexusPassportToken || !window.__nexusPassportSourceInfo) throw new Error('security context');
  destination.searchParams.set('msToken', window.__nexusPassportToken);
  destination.searchParams.set('account_sdk_source_info', window.__nexusPassportSourceInfo);
  window.__nexusSigLen = 0;
  window.__nexusMsLen = 0;
  window.__nexusTokenMatch = false;
  return await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    window.__nexusActiveXhr = xhr;
    xhr.open(method, destination.href, true);
    xhr.withCredentials = true;
    xhr.timeout = 20000;
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, String(value));
    xhr.onload = () => resolve({
      status: xhr.status,
      text: xhr.responseText,
      signatureLength: window.__nexusSigLen,
      msTokenLength: window.__nexusMsLen,
      browserInfoLength: window.__nexusPassportSourceInfo.length,
      sessionTokenMatches: window.__nexusTokenMatch,
    });
    xhr.onerror = () => reject(new Error('network'));
    xhr.onabort = () => reject(new Error('cancelled'));
    xhr.ontimeout = () => reject(new Error('timeout'));
    xhr.send(body === null ? null : body);
  });
  """#

  private static let verificationScript = #"""
  const setMeta = (selector, create) => { document.head.querySelectorAll(selector).forEach(n => n.remove()); document.head.prepend(create()); };
  setMeta('meta[name="viewport"]', () => Object.assign(document.createElement('meta'), { name: 'viewport', content: 'width=device-width,initial-scale=1,viewport-fit=cover' }));
  setMeta('meta[charset]', () => { const m = document.createElement('meta'); m.setAttribute('charset', 'utf-8'); return m; });
  if (!document.getElementById('nexus-verify-style')) {
    const st = document.createElement('style');
    st.id = 'nexus-verify-style';
    st.textContent = 'html,body{margin:0;padding:0;width:100%;height:100%;background:#ffffff;}';
    document.head.appendChild(st);
  }
  const loadScript = src => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.charset = 'utf-8';
    s.crossOrigin = 'anonymous';
    s.src = src;
    const t = setTimeout(() => reject(new Error('timeout')), 15000);
    s.onload = () => { clearTimeout(t); resolve(); };
    s.onerror = () => { clearTimeout(t); reject(new Error('load')); };
    document.head.appendChild(s);
  });
  if (!window.React || !window.ReactDOM) {
    const pairs = [
      ['https://lf3-cdn-tos.bytecdntp.com/cdn/expire-1-M/react/17.0.2/umd/react.production.min.js', 'https://lf3-cdn-tos.bytecdntp.com/cdn/expire-1-M/react-dom/17.0.2/umd/react-dom.production.min.js'],
      ['https://cdn.staticfile.net/react/17.0.2/umd/react.production.min.js', 'https://cdn.staticfile.net/react/17.0.2/umd/react-dom.production.min.js'],
    ];
    for (const [rUrl, rdUrl] of pairs) {
      try {
        await loadScript(rUrl);
        await loadScript(rdUrl);
        if (window.React && window.ReactDOM) break;
      } catch (_) {}
    }
  }
  if (!window.React || !window.ReactDOM) throw new Error('react unavailable');
  window.ucSecondVerifyReact = window.React;
  window.ucSecondVerifyReactDom = window.ReactDOM;
  const resource = new URL(decision.url);
  let event = {};
  if (typeof decision.event_params === 'string') { try { event = JSON.parse(decision.event_params); } catch (_) {} }
  else if (decision.event_params && typeof decision.event_params === 'object') event = decision.event_params;
  resource.searchParams.set('aid', '386088');
  resource.searchParams.set('verify_reason', String(event.verify_reason || ''));
  resource.searchParams.set('verify_scene', String(event.verify_scene || ''));
  window.$$account_verify_portrait_id = String(decision.verify_portrait_id || '');
  if (typeof window.ucWebSecondVerify !== 'function') await loadScript(resource.href);
  if (typeof window.ucWebSecondVerify !== 'function') throw new Error('component unavailable');
  document.body.replaceChildren();
  return await new Promise(resolve => {
    let done = false;
    const timer = setTimeout(() => finish({ status: false }), 600000);
    const finish = result => {
      if (done) return;
      done = true; clearTimeout(timer); window.__nexusCancelVerify = null;
      resolve({ status: result?.status === true });
    };
    window.__nexusCancelVerify = () => finish({ status: false });
    window.ucWebSecondVerify({
      ...decision,
      aid: 386088,
      isNewVerifyUI: true,
      event_params: event,
      generalParams: general,
      verifyFinishCallback: finish,
      newSecondVerifyWebOptions: { host: 'https://api.qishui.com', verifyAppName: '汽水音乐移动端' },
      newSecondVerificationCall: { reportAppLog: () => {} },
      fun: decision.verify_from === 'verify_center' ? 'verify_center' : 'verify',
      uc_account_verify_version: '1.0.29',
      monitorTime: { startTime: Date.now(), fetchEndTime: Date.now(), scriptLoadStartTime: 0, scriptLoadEndTime: Date.now(), renderStartTime: Date.now() },
    });
  });
  """#

  private func finish(_ result: MusicWebLoginSession.Result) {
    if finished { return }
    finished = true
    expiryTimer?.invalidate()
    expiryTimer = nil
    teardownWebView()
    let presenter = self.presenter
    self.presenter = nil
    self.navController = nil
    DispatchQueue.main.async {
      if let presenter {
        presenter.dismiss(animated: true) { self.completion(self.id, result) }
      } else {
        self.completion(self.id, result)
      }
    }
  }
}

// MARK: Account transfer wire
// Independently implemented iOS client for pinned Q-music 5db858f v1 wire.
// LAN HMAC proof and authenticated ciphertext; never a general HTTP bridge.
private enum AccountTransferFailure: Error { case invalid, expired, cancelled, network }
private struct AccountTransferWire {
  let id: String
  let key: SymmetricKey
  let url: URL
  init(_ text: String) throws {
    let text=text.trimmingCharacters(in:.whitespacesAndNewlines)
    guard text.utf8.count<=1024, let c=URLComponents(string:text),c.scheme=="qmusic",c.host=="account-transfer",
      c.user==nil,c.password==nil,c.port==nil,c.path.isEmpty,c.fragment==nil,let items=c.queryItems,
      items.count==5,Set(items.map(\.name))==Set(["v","host","port","id","key"]) else { throw AccountTransferFailure.invalid }
    let values=Dictionary(uniqueKeysWithValues:items.map{($0.name,$0.value ?? "")})
    guard values["v"]=="1",let host=values["host"],Self.privateIPv4(host),let portText=values["port"],
      let port=Int(portText),String(port)==portText,(1024...65535).contains(port),let id=values["id"],
      id.range(of:"^[a-f0-9]{32}$",options:.regularExpression) != nil,let secret=values["key"],
      secret.range(of:"^[a-f0-9]{64}$",options:.regularExpression) != nil,
      let url=URL(string:"http://\(host):\(port)/qmusic-account-transfer/\(id)") else { throw AccountTransferFailure.invalid }
    self.id=id;self.url=url;self.key=SymmetricKey(data:Data(stride(from:0,to:64,by:2).map { offset in
      let a=secret.index(secret.startIndex,offsetBy:offset),b=secret.index(a,offsetBy:2);return UInt8(secret[a..<b],radix:16)!
    }))
  }
  static func privateIPv4(_ host:String)->Bool {
    let pieces=host.split(separator:".",omittingEmptySubsequences:false)
    guard pieces.count==4 else { return false }
    var n:[Int]=[]
    for piece in pieces { guard piece.allSatisfy({$0.isASCII && $0.isNumber}),let v=Int(piece),(0...255).contains(v),String(v)==piece else { return false };n.append(v) }
    return n[0]==10 || n[0]==192 && n[1]==168 || n[0]==172 && (16...31).contains(n[1])
  }
  func request(nonce:Data)throws->(URLRequest,String) {
    guard nonce.count==16 else { throw AccountTransferFailure.invalid }
    let hex=nonce.map{String(format:"%02x",$0)}.joined()
    let proof=HMAC<SHA256>.authenticationCode(for:Data("claim:\(id):\(hex)".utf8),using:key).map{String(format:"%02x",$0)}.joined()
    var request=URLRequest(url:url,cachePolicy:.reloadIgnoringLocalCacheData,timeoutInterval:25)
    request.httpMethod="POST";request.httpShouldHandleCookies=false;request.setValue("application/json",forHTTPHeaderField:"Content-Type")
    request.httpBody=try JSONSerialization.data(withJSONObject:["nonce":hex,"proof":proof]);return(request,hex)
  }
  func open(_ data:Data,nonce:String,now:Double=Date().timeIntervalSince1970*1000)throws->String {
    guard data.count<=32768,let envelope=try JSONSerialization.jsonObject(with:data) as? [String:Any],
      let ivText=envelope["iv"] as? String,let encryptedText=envelope["data"] as? String,
      let iv=Data(base64Encoded:ivText),iv.count==12,let encrypted=Data(base64Encoded:encryptedText),encrypted.count>=16,
      encrypted.count<=32768 else { throw AccountTransferFailure.invalid }
    let sealed=try AES.GCM.SealedBox(nonce:AES.GCM.Nonce(data:iv),ciphertext:encrypted.dropLast(16),tag:encrypted.suffix(16))
    let plain=try AES.GCM.open(sealed,using:key,authenticating:Data("\(id):\(nonce)".utf8))
    guard plain.count<=32768,let payload=try JSONSerialization.jsonObject(with:plain) as? [String:Any],
      payload["v"] as? Int==1,payload["provider"] as? String=="tx",let expiry=payload["expiresAt"] as? Double,
      expiry.isFinite,let text=String(data:plain,encoding:.utf8) else { throw AccountTransferFailure.invalid }
    guard expiry>now,expiry<=now+180000 else { throw AccountTransferFailure.expired };return text
  }
}
private final class AccountTransferRequest:NSObject,URLSessionDataDelegate {
  let id:String
  private let wire:AccountTransferWire
  private var nonce="",bytes=Data(),session:URLSession?,task:URLSessionDataTask?,background:NSObjectProtocol?
  private var completion:((Result<String,AccountTransferFailure>)->Void)?
  init(id:String,code:String)throws { guard UUID(uuidString:id) != nil else { throw AccountTransferFailure.invalid };self.id=id;wire=try AccountTransferWire(code);super.init() }
  func start(_ completion:@escaping(Result<String,AccountTransferFailure>)->Void) {
    self.completion=completion
    background=NotificationCenter.default.addObserver(forName:UIApplication.didEnterBackgroundNotification,object:nil,queue:.main){[weak self]_ in self?.cancel()}
    do {
      var random=Data(count:16)
      let status=random.withUnsafeMutableBytes{SecRandomCopyBytes(kSecRandomDefault,16,$0.baseAddress!)}
      guard status==errSecSuccess else { throw AccountTransferFailure.invalid }
      let (request,nonce)=try wire.request(nonce:random);self.nonce=nonce
      let config=URLSessionConfiguration.ephemeral;config.httpCookieStorage=nil;config.urlCredentialStorage=nil;config.urlCache=nil
      config.httpShouldSetCookies=false;config.timeoutIntervalForRequest=20;config.timeoutIntervalForResource=25
      let session=URLSession(configuration:config,delegate:self,delegateQueue:.main);self.session=session
      let task=session.dataTask(with:request);self.task=task;task.resume()
    }catch { finish(.failure(.invalid)) }
  }
  func cancel(){finish(.failure(.cancelled))}
  func urlSession(_ session:URLSession,task:URLSessionTask,willPerformHTTPRedirection response:HTTPURLResponse,newRequest request:URLRequest,completionHandler:@escaping(URLRequest?)->Void){completionHandler(nil)}
  func urlSession(_ session:URLSession,dataTask:URLSessionDataTask,didReceive response:URLResponse,completionHandler:@escaping(URLSession.ResponseDisposition)->Void){
    guard completion != nil,let response=response as? HTTPURLResponse,response.url==wire.url,(200...299).contains(response.statusCode),response.expectedContentLength<=32768 else {
      completionHandler(.cancel);finish(.failure(.expired));return
    };completionHandler(.allow)
  }
  func urlSession(_ session:URLSession,dataTask:URLSessionDataTask,didReceive data:Data){
    guard completion != nil else { return };guard bytes.count+data.count<=32768 else { finish(.failure(.invalid));return };bytes.append(data)
  }
  func urlSession(_ session:URLSession,task:URLSessionTask,didCompleteWithError error:Error?){
    guard completion != nil else { return };guard error==nil else { finish(.failure(.network));return }
    do { finish(.success(try wire.open(bytes,nonce:nonce))) }catch AccountTransferFailure.expired { finish(.failure(.expired)) }catch { finish(.failure(.invalid)) }
  }
  private func finish(_ result:Result<String,AccountTransferFailure>){
    guard let callback=completion else { return };completion=nil
    if let background { NotificationCenter.default.removeObserver(background) };background=nil
    task?.cancel();task=nil;session?.invalidateAndCancel();session=nil;bytes.removeAll();nonce="";callback(result)
  }
}

private final class AccountTransferScanner:UIViewController,AVCaptureMetadataOutputObjectsDelegate {
  let id:String
  private let capture=AVCaptureSession(),queue=DispatchQueue(label:"nexus.account-transfer-camera")
  private var camera:AVCaptureDevice?,preview:AVCaptureVideoPreviewLayer?,background:NSObjectProtocol?
  private var completion:((Result<String?,AccountTransferFailure>)->Void)?
  private let hint=UILabel(),lightButton=UIButton(type:.system)
  private var torchObservation:NSKeyValueObservation?
  init(id:String,completion:@escaping(Result<String?,AccountTransferFailure>)->Void){self.id=id;self.completion=completion;super.init(nibName:nil,bundle:nil);modalPresentationStyle = .fullScreen}
  required init?(coder:NSCoder){fatalError("init(coder:) unavailable")}
  override func viewDidLoad(){
    super.viewDidLoad();view.backgroundColor = .black
    let preview=AVCaptureVideoPreviewLayer(session:capture);preview.videoGravity = .resizeAspectFill;view.layer.addSublayer(preview);self.preview=preview
    let close=UIButton(type:.system);close.setTitle("返回",for:.normal);close.accessibilityIdentifier="qq-transfer-scan-cancel";close.addTarget(self,action:#selector(cancelTap),for:.touchUpInside)
    let torch=lightButton;torch.isEnabled=false;torch.accessibilityValue="已关闭";torch.setTitle("补光",for:.normal);torch.accessibilityIdentifier="qq-transfer-scan-torch";torch.addTarget(self,action:#selector(toggleTorch),for:.touchUpInside)
    hint.text="扫描自己电脑显示的 QQ 音乐配对二维码";hint.textColor = .white;hint.textAlignment = .center;hint.numberOfLines=0;hint.font = .preferredFont(forTextStyle:.body)
    for v in [close,torch,hint] {v.translatesAutoresizingMaskIntoConstraints=false;view.addSubview(v)}
    NSLayoutConstraint.activate([close.leadingAnchor.constraint(equalTo:view.safeAreaLayoutGuide.leadingAnchor,constant:20),close.topAnchor.constraint(equalTo:view.safeAreaLayoutGuide.topAnchor),close.heightAnchor.constraint(greaterThanOrEqualToConstant:44),close.widthAnchor.constraint(greaterThanOrEqualToConstant:64),torch.trailingAnchor.constraint(equalTo:view.safeAreaLayoutGuide.trailingAnchor,constant:-20),torch.topAnchor.constraint(equalTo:close.topAnchor),torch.heightAnchor.constraint(greaterThanOrEqualToConstant:44),torch.widthAnchor.constraint(greaterThanOrEqualToConstant:64),hint.leadingAnchor.constraint(equalTo:view.safeAreaLayoutGuide.leadingAnchor,constant:24),hint.trailingAnchor.constraint(equalTo:view.safeAreaLayoutGuide.trailingAnchor,constant:-24),hint.bottomAnchor.constraint(equalTo:view.safeAreaLayoutGuide.bottomAnchor,constant:-32)])
    background=NotificationCenter.default.addObserver(forName:UIApplication.didEnterBackgroundNotification,object:nil,queue:.main){[weak self]_ in self?.cancel()}
    AVCaptureDevice.requestAccess(for:.video){[weak self] allowed in DispatchQueue.main.async{guard let self,self.completion != nil else{return};if allowed{self.prepare()}else{self.finish(.failure(.invalid))}}}
  }
  override func viewDidLayoutSubviews(){super.viewDidLayoutSubviews();preview?.frame=view.bounds;if let connection=preview?.connection,connection.isVideoOrientationSupported {connection.videoOrientation=view.bounds.width>view.bounds.height ? .landscapeRight:.portrait}}
  private func prepare(){
    queue.async{[weak self] in
      guard let self else{return}
      do {
        guard let camera=AVCaptureDevice.default(.builtInWideAngleCamera,for:.video,position:.back) else{throw AccountTransferFailure.invalid}
        let input=try AVCaptureDeviceInput(device:camera),output=AVCaptureMetadataOutput()
        self.capture.beginConfiguration();defer{self.capture.commitConfiguration()}
        guard self.capture.canAddInput(input),self.capture.canAddOutput(output) else{throw AccountTransferFailure.invalid}
        self.capture.addInput(input);self.capture.addOutput(output);output.setMetadataObjectsDelegate(self,queue:.main);output.metadataObjectTypes=[.qr]
        DispatchQueue.main.async{[weak self] in guard let self,self.completion != nil else{return};self.camera=camera
          self.torchObservation=camera.observe(\.isTorchAvailable,options:[.initial,.new]){[weak self] camera,_ in DispatchQueue.main.async{guard let self,self.completion != nil else{return};self.lightButton.isEnabled=camera.hasTorch && camera.isTorchAvailable;self.lightButton.accessibilityValue=camera.isTorchAvailable ? (camera.torchMode == .on ? "已开启":"已关闭"):"暂不可用"}}
          self.queue.async{[weak self] in self?.capture.startRunning()}}
      }catch{DispatchQueue.main.async{[weak self] in self?.finish(.failure(.invalid))}}
    }
  }
  func metadataOutput(_ output:AVCaptureMetadataOutput,didOutput metadataObjects:[AVMetadataObject],from connection:AVCaptureConnection){
    guard completion != nil,!metadataObjects.isEmpty else{return}
    let codes=metadataObjects.compactMap{($0 as? AVMetadataMachineReadableCodeObject)?.stringValue}
    guard let value=codes.first(where:{(try? AccountTransferWire($0)) != nil}) else{hint.text="这不是有效的电脑配对码，请重新扫描";return};finish(.success(value))
  }
  @objc private func cancelTap(){cancel()}
  func cancel(){finish(.success(nil))}
  @objc private func toggleTorch(){guard let camera,camera.hasTorch,camera.isTorchAvailable else{return};do{try camera.lockForConfiguration();defer{camera.unlockForConfiguration()};camera.torchMode=camera.torchMode == .on ? .off:.on;lightButton.accessibilityValue=camera.torchMode == .on ? "已开启":"已关闭";lightButton.setTitle(camera.torchMode == .on ? "关闭补光":"补光",for:.normal)}catch{hint.text="暂时无法打开补光，可直接扫描或返回粘贴配对码"}}
  private func finish(_ result:Result<String?,AccountTransferFailure>){
    guard let callback=completion else{return};completion=nil;torchObservation?.invalidate();torchObservation=nil;if let background{NotificationCenter.default.removeObserver(background)};background=nil
    let camera=self.camera,capture=self.capture
    queue.async{if let camera,camera.hasTorch { do { try camera.lockForConfiguration();camera.torchMode = .off;camera.unlockForConfiguration() }catch{} };capture.stopRunning()}
    dismiss(animated:UIApplication.shared.applicationState == .active){callback(result)}
  }
}
