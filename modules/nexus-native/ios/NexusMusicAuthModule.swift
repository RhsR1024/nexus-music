import ExpoModulesCore
import UIKit
import WebKit
import CryptoKit
import Security
import AVFoundation

// Official entry from pinned Q-music-android 5db858f/login.ts. NexusMusic
// owns the WebKit session; no reference app bridge, callback or patch is copied.
enum MusicWebLoginPolicy {
  static let dailyURL = "https://y.qq.com/n/ryqq_v2/qqmusic_skills"
  static func dailyOrigin(_ url: URL) -> Bool {
    url.scheme == "https" && url.user == nil && url.password == nil &&
      (url.port == nil || url.port == 443) && ["y.qq.com", "a.qq.com"].contains(url.host?.lowercased() ?? "")
  }
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
  static func documentReady(_ value: Any?, observedEpoch: Int, currentEpoch: Int, committedEpoch: Int?) -> Bool {
    guard observedEpoch == currentEpoch, committedEpoch == currentEpoch,
      let value = value as? [String: Any], let state = value["state"] as? String,
      let body = value["body"] as? Bool else { return false }
    return body && (state == "interactive" || state == "complete")
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
    let webView = WKWebView(frame: .zero, configuration: configuration)
    webView.accessibilityIdentifier = daily ? "qq-daily-authorization-web" : "music-web-login-\(provider)"
    if provider == "tx" {
      // Request the official website's desktop login controls. The mobile
      // presentation offers only an unsupported QQ-app launch in this host.
      webView.customUserAgent = daily ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
    }
    webView.navigationDelegate = self
    webView.uiDelegate = self
    webView.allowsBackForwardNavigationGestures = true
    self.webView = webView

    let controller = UIViewController()
    loginController = controller
    controller.title = daily ? "QQ 每日推荐授权" : provider == "tx" ? "QQ 音乐登录" : "网易云登录"
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

  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
    guard self.webView === webView, let navigation, navigation === currentNavigation else { return }
    if (error as NSError).code == NSURLErrorCancelled { return }
    finish(.failed)
  }

  func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
    guard self.webView === webView, let navigation, navigation === currentNavigation else { return }
    if (error as NSError).code == NSURLErrorCancelled { return }
    finish(.failed)
  }

  func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
    guard let url = navigationAction.request.url else { decisionHandler(.cancel); finish(.failed); return }
    guard MusicWebLoginPolicy.allows(url, provider: provider) else {
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
    if !pageReady { inspectDocument(); return }
    if daily { inspectDaily(); return }
    guard let webView, let url = documentURL(webView) else { return }
    let epoch = navigationEpoch
    dataStore?.httpCookieStore.getAllCookies { [weak self] cookies in
      guard let self, !self.finished, self.pageReady, self.navigationEpoch == epoch,
        self.webView === webView, self.webView?.url == url else { return }
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

  // Evaluate only the current main document on the two official Skills origins.
  // No message bridge accepts arbitrary frames, URLs or page-supplied cookies.
  private func inspectDaily() {
    guard !finished, pageReady, !dailyInspecting, let webView, let url = webView.url,
      MusicWebLoginPolicy.dailyOrigin(url) else { return }
    dailyInspecting = true
    let epoch = navigationEpoch
    let script = #"(() => {const texts=[(document.body?.innerText||'').slice(0,200000),...Array.from(document.querySelectorAll('input,textarea')).slice(0,100).map(x=>String(x.value||'').slice(0,2048))];return texts.join('\n').match(/\bqmk-[A-Za-z0-9_-]{12,1024}\b/)?.[0]||null;})()"#
    webView.evaluateJavaScript(script) { [weak self] value, _ in
      guard let self else { return }
      self.dailyInspecting = false
      guard !self.finished, self.pageReady, self.navigationEpoch == epoch,
        self.webView?.url == url, let key = value as? String,
        key.range(of: "^qmk-[A-Za-z0-9_-]{12,1024}$", options: .regularExpression) != nil else { return }
      self.dataStore?.httpCookieStore.getAllCookies { [weak self] cookies in
        guard let self, !self.finished, self.pageReady, self.navigationEpoch == epoch,
          self.webView?.url == url else { return }
        var values: [String: String] = [:]
        var identities = Set<String>()
        for cookie in cookies {
          let domain = cookie.domain.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: "."))
          guard (domain == "qq.com" || domain.hasSuffix(".qq.com")),
            MusicWebLoginPolicy.cookieNames("tx").contains(cookie.name),
            cookie.expiresDate == nil || cookie.expiresDate! > Date() else { continue }
          values[cookie.name] = cookie.value
          if ["uin", "qqmusic_uin", "musicid"].contains(cookie.name),
            cookie.value.range(of: "^o?[0-9]{1,20}$", options: [.regularExpression,.caseInsensitive]) != nil {
            let normalized = cookie.value.replacingOccurrences(of: "^[oO]?0*", with: "", options: .regularExpression)
            if !normalized.isEmpty { identities.insert(normalized) }
          }
        }
        guard MusicWebLoginPolicy.ready(values, provider: "tx"), identities.count == 1 else { return }
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
