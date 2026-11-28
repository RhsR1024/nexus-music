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
      let hasSession = !(values["sessionid"] ?? "").isEmpty || !(values["sessionid_ss"] ?? "").isEmpty || !(values["sid_tt"] ?? "").isEmpty
      let hasIdentity = !(values["uid_tt"] ?? "").isEmpty || !(values["uid_tt_ss"] ?? "").isEmpty || !(values["sid_guard"] ?? "").isEmpty
      return hasSession && hasIdentity
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
/// Loads ByteDance's official browser security SDK (bdms.js) at runtime inside an isolated
/// non-persistent WKWebView anchored at https://api.qishui.com/, signs /passport/web/get_qrcode/
/// and /passport/web/check_qrconnect/ via same-origin XHR, renders the official PC scan route
/// (/light/invoke/scan_login) natively via CoreImage, and harvests HttpOnly session cookies
/// directly from WKHTTPCookieStore after user confirmation.
private final class QishuiQrLoginSession: NSObject, WKScriptMessageHandler, WKNavigationDelegate, LoginSessionHandle {
  private static let ciContext = CIContext(options: [.cacheIntermediates: false])
  private static let deviceIdKey = "nexus.qishui.device_id.v1"
  private static let installIdKey = "nexus.qishui.install_id.v1"

  private let id: String
  private let completion: (String, MusicWebLoginSession.Result) -> Void
  private var presenter: UIViewController?
  private var navController: UINavigationController?
  private var dataStore: WKWebsiteDataStore?
  private var webView: WKWebView?
  private var expiryTimer: Timer?
  private var cookieRetryTimer: Timer?
  private var generation = 0
  private var finished = false
  private var qrImage: UIImage?
  private var currentScanURL = ""

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

    verifyContainer.isHidden = true
    verifyContainer.backgroundColor = .systemBackground
    verifyContainer.translatesAutoresizingMaskIntoConstraints = false

    vc.view.addSubview(qrCardStack)
    vc.view.addSubview(verifyContainer)
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

  private static func ensureNumericId(key: String) -> String {
    if let existing = UserDefaults.standard.string(forKey: key), existing.count >= 16 { return existing }
    var bytes = [UInt8](repeating: 0, count: 8)
    _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
    let raw = bytes.reduce(UInt64(0)) { ($0 << 8) | UInt64($1) }
    let generated = "7\(String(format: "%018llu", raw % 1_000_000_000_000_000_000))"
    UserDefaults.standard.set(generated, forKey: key)
    return generated
  }

  private static func generateMsTokenSeed() -> String {
    var bytes = Data(count: 88)
    _ = bytes.withUnsafeMutableBytes { SecRandomCopyBytes(kSecRandomDefault, 88, $0.baseAddress!) }
    return bytes.base64EncodedString()
      .replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_")
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

  private func teardownWebView() {
    cookieRetryTimer?.invalidate()
    cookieRetryTimer = nil
    if let old = webView {
      old.configuration.userContentController.removeScriptMessageHandler(forName: "QishuiAuth")
      old.navigationDelegate = nil
      old.stopLoading()
      old.removeFromSuperview()
    }
    webView = nil
    dataStore = nil
  }

  private func startNewQrSession() {
    guard !finished else { return }
    generation += 1
    let gen = generation
    teardownWebView()
    verifyContainer.isHidden = true
    qrImage = nil
    currentScanURL = ""
    qrImageView.image = nil
    saveButton.isEnabled = false
    spinner.startAnimating()
    statusLabel.text = "正在获取汽水音乐登录二维码…"
    statusLabel.textColor = .label

    let store = WKWebsiteDataStore.nonPersistent()
    dataStore = store
    let config = WKWebViewConfiguration()
    config.websiteDataStore = store
    let ucc = WKUserContentController()
    ucc.add(WeakQishuiScriptProxy(self), name: "QishuiAuth")
    config.userContentController = ucc

    let wv = WKWebView(frame: .zero, configuration: config)
    wv.customUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
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

    let did = Self.ensureNumericId(key: Self.deviceIdKey)
    let iid = Self.ensureNumericId(key: Self.installIdKey)
    let msToken = Self.generateMsTokenSeed()
    let html = Self.buildHostHTML(generation: gen, deviceId: did, installId: iid, msToken: msToken)
    wv.loadHTMLString(html, baseURL: URL(string: "https://api.qishui.com/")!)
  }

  private static func buildHostHTML(generation: Int, deviceId: String, installId: String, msToken: String) -> String {
    """
    <!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
    <script>
    (function(){
      var GEN=\(generation), DID="\(deviceId)", IID="\(installId)", MS="\(msToken)";
      var post=function(msg){try{window.webkit.messageHandlers.QishuiAuth.postMessage(Object.assign({gen:GEN},msg));}catch(e){}};
      try{localStorage.setItem('xmst',MS);localStorage.setItem('xmsty',MS);}catch(e){}
      function xorHex(str){
        var bytes=new TextEncoder().encode(str), out='';
        for(var i=0;i<bytes.length;i++) out+=((bytes[i]^5)&255).toString(16).padStart(2,'0');
        return out;
      }
      function browserInfoHex(){
        var info={
          ua:navigator.userAgent||'',
          lang:navigator.language||'zh-CN',
          platform:'MacIntel',
          screen:(screen.width||1440)+'x'+(screen.height||900),
          tz:-(new Date().getTimezoneOffset()),
          cookie:!!navigator.cookieEnabled,
          ls:true,
          aid:386088,
          host:'api.qishui.com'
        };
        return xorHex(JSON.stringify(info));
      }
      function readCookie(name){
        var m=document.cookie.match(new RegExp('(?:^|;\\s*)'+name+'=([^;]*)'));
        return m?decodeURIComponent(m[1]):'';
      }
      function xhrReq(method,url,body,headers){
        return new Promise(function(resolve,reject){
          var x=new XMLHttpRequest();
          x.open(method,url,true);
          x.withCredentials=true;
          if(headers){Object.keys(headers).forEach(function(k){if(headers[k])x.setRequestHeader(k,headers[k]);});}
          x.onload=function(){
            try{resolve(JSON.parse(x.responseText||'{}'));}catch(e){reject(new Error('invalid_json'));}
          };
          x.onerror=function(){reject(new Error('network_error'));};
          x.ontimeout=function(){reject(new Error('timeout'));};
          x.timeout=15000;
          x.send(body||null);
        });
      }
      function extractScanToken(urlStr,fallback){
        try{
          var u=new URL(urlStr);
          return u.searchParams.get('token')||fallback;
        }catch(e){return fallback;}
      }
      var sdkInfo=browserInfoHex();
      var pollTimer=null, stopped=false, passportToken='';
      function commonQuery(){
        return 'aid=386088&account_sdk_source=web&passport_jssdk_version=2.4.13&passport_jssdk_type=normal&is_from_ttaccountsdk=1'
          +'&next='+encodeURIComponent('https://api.qishui.com')
          +'&need_logo=false&need_short_url=false&is_new_login=1'
          +'&device_id='+encodeURIComponent(DID)
          +'&iid='+encodeURIComponent(IID)
          +'&msToken='+encodeURIComponent(MS)
          +'&account_sdk_source_info='+encodeURIComponent(sdkInfo);
      }
      function startPoll(){
        if(stopped||!passportToken)return;
        pollTimer=setTimeout(function(){
          if(stopped)return;
          var csrf=readCookie('passport_csrf_token')||readCookie('passport_csrf_token_default');
          var form='token='+encodeURIComponent(passportToken)+'&need_logo=false&need_short_url=false&is_frontier=true&is_new_login=1&next='+encodeURIComponent('https://api.qishui.com');
          var hdrs={'Content-Type':'application/x-www-form-urlencoded'};
          if(csrf) hdrs['X-Tt-Passport-Csrf-Token']=csrf;
          xhrReq('POST','https://api.qishui.com/passport/web/check_qrconnect/?'+commonQuery(),form,hdrs)
            .then(function(res){
              if(stopped)return;
              var d=res&&res.data?res.data:{};
              var st=String(d.status||'').toLowerCase();
              var code=Number(d.error_code||0);
              if(code===2046){
                stopped=true;
                post({type:'verify',detail:String(d.description||'需要安全验证'),verifyUrl:String(d.verify_url||'')});
                return;
              }
              if(st==='confirmed'||st==='3'||st==='success'||st==='confirm'){
                post({type:'confirmed'});
                startPoll();
                return;
              }
              if(st==='scanned'||st==='2'){
                post({type:'status',status:'scanned'});
                startPoll();
                return;
              }
              if(st==='expired'||st==='5'||code===2043){
                stopped=true;
                post({type:'status',status:'expired'});
                return;
              }
              if(code&&code!==0){
                post({type:'status',status:'waiting',code:code});
              }
              startPoll();
            })
            .catch(function(){if(!stopped)startPoll();});
        },2200);
      }
      function createQr(){
        xhrReq('GET','https://api.qishui.com/passport/web/get_qrcode/?'+commonQuery(),null,null)
          .then(function(res){
            if(stopped)return;
            var d=res&&res.data?res.data:{};
            if(!d.token&&!d.qrcode_index_url){
              post({type:'error',detail:String(d.description||res.message||'未能获取汽水登录二维码')});
              return;
            }
            passportToken=String(d.token||'');
            var scanTok=extractScanToken(String(d.qrcode_index_url||''),passportToken);
            var encTok=encodeURIComponent(scanTok).replace(/\\+/g,'%2B');
            var scanUrl='https://bff-pc.qishui.com/light/invoke/scan_login?token='+encTok+'&os=Windows&computer_name=NexusMusic';
            post({type:'qr',scanUrl:scanUrl});
            startPoll();
          })
          .catch(function(e){post({type:'error',detail:String(e&&e.message||'网络请求失败')});});
      }
      var s=document.createElement('script');
      s.src='https://lf-headquarters-speed.yhgfb-cn-static.com/obj/rc-client-security/web/stable/1.0.0.41/bdms.js';
      s.async=true;
      s.onload=function(){
        Promise.resolve().then(function(){
          if(window.bdms&&typeof window.bdms.init==='function'){
            return window.bdms.init({aid:386088,paths:['/passport']});
          }
        }).then(createQr).catch(createQr);
      };
      s.onerror=function(){post({type:'error',detail:'安全组件加载失败，请检查网络后刷新'});};
      document.head.appendChild(s);
    })();
    </script></body></html>
    """
  }

  func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
    guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
    if MusicWebLoginPolicy.allows(url, provider: "qishui") {
      decisionHandler(.allow)
    } else {
      decisionHandler(.cancel)
    }
  }

  func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    guard !finished, message.name == "QishuiAuth", let body = message.body as? [String: Any],
          let gen = body["gen"] as? Int, gen == generation,
          let type = body["type"] as? String else { return }

    switch type {
    case "qr":
      guard let scanUrl = body["scanUrl"] as? String, !scanUrl.isEmpty else { return }
      currentScanURL = scanUrl
      let img = Self.renderQrCode(scanUrl)
      qrImage = img
      qrImageView.image = img
      spinner.stopAnimating()
      saveButton.isEnabled = img != nil
      statusLabel.text = "请打开汽水音乐 App 扫码登录"
      statusLabel.textColor = .label
    case "status":
      let st = body["status"] as? String ?? ""
      if st == "scanned" {
        statusLabel.text = "已扫码，请在汽水音乐 App 中点击确认"
        statusLabel.textColor = .systemTeal
        harvestCookies(gen: gen)
      } else if st == "expired" {
        statusLabel.text = "二维码已过期，请点击下方「刷新二维码」"
        statusLabel.textColor = .systemRed
        saveButton.isEnabled = false
      }
    case "confirmed":
      statusLabel.text = "已确认登录，正在保存汽水会话…"
      statusLabel.textColor = .systemGreen
      harvestCookies(gen: gen)
      cookieRetryTimer?.invalidate()
      cookieRetryTimer = Timer.scheduledTimer(withTimeInterval: 0.9, repeats: true) { [weak self] _ in
        self?.harvestCookies(gen: gen)
      }
    case "verify":
      let detail = body["detail"] as? String ?? "需要完成安全验证"
      statusLabel.text = "\(detail)，请在验证后重试"
      statusLabel.textColor = .systemOrange
      if let raw = body["verifyUrl"] as? String, let url = URL(string: raw), MusicWebLoginPolicy.allows(url, provider: "qishui") {
        verifyContainer.isHidden = false
        webView?.load(URLRequest(url: url))
      }
    case "error":
      spinner.stopAnimating()
      statusLabel.text = (body["detail"] as? String) ?? "二维码获取失败，请点击刷新重试"
      statusLabel.textColor = .systemRed
    default:
      break
    }
  }

  private func harvestCookies(gen: Int) {
    guard !finished, gen == generation, let store = dataStore else { return }
    store.httpCookieStore.getAllCookies { [weak self] cookies in
      guard let self, !self.finished, gen == self.generation else { return }
      var values: [String: String] = [:]
      let ordered = cookies.sorted {
        $0.domain.trimmingCharacters(in: CharacterSet(charactersIn: ".")).count <
          $1.domain.trimmingCharacters(in: CharacterSet(charactersIn: ".")).count
      }
      for cookie in ordered {
        let domain = cookie.domain.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: "."))
        let allowed = domain == "qishui.com" || domain.hasSuffix(".qishui.com") || domain == "douyin.com" || domain.hasSuffix(".douyin.com")
        if allowed, MusicWebLoginPolicy.cookieNames("qishui").contains(cookie.name),
           !cookie.value.isEmpty, cookie.expiresDate == nil || cookie.expiresDate! > Date() {
          values[cookie.name] = cookie.value
        }
      }
      guard MusicWebLoginPolicy.ready(values, provider: "qishui") else { return }
      guard JSONSerialization.isValidJSONObject(values),
            let data = try? JSONSerialization.data(withJSONObject: values),
            let json = String(data: data, encoding: .utf8) else {
        self.finish(.failed)
        return
      }
      self.finish(.success(json))
    }
  }

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
