import Foundation

// This public browsing boundary has no relationship to account authorization.
enum PublicMVPolicy {
  // Nonessential synchronous analytics must neither track this ephemeral
  // viewer nor block the public document parser when its host is unreachable.
  static let privacyRules = #"[{"trigger":{"url-filter":"^https?://hm\\.baidu\\.com/","resource-type":["script"]},"action":{"type":"block"}}]"#
  static func initialURL(_ value: String) -> URL? {
    guard let url = URL(string: value), safeHTTPS(url), let host = url.host?.lowercased() else { return nil }
    let path = url.path
    let digits = "^[0-9]{1,128}$"
    func matches(_ value: String, _ pattern: String) -> Bool {
      guard let range = value.range(of: pattern, options: .regularExpression) else { return false }
      return range == value.startIndex..<value.endIndex
    }
    let valid: Bool
    switch host {
    case "music.163.com":
      let query = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
      valid = path == "/mv" && query.count == 1 && query[0].name == "id" && matches(query[0].value ?? "", digits)
    case "y.qq.com": valid = matches(path, "^/n/ryqq/mv/[A-Za-z0-9_-]{1,128}$") && url.query == nil
    case "www.kuwo.cn": valid = matches(path, "^/mvplay/[0-9]{1,128}$") && url.query == nil
    case "m.kuwo.cn":
      let query = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
      let identity = path.split(separator:"/").last.map(String.init) ?? ""
      valid = matches(path, "^/newh5app/mvplay/7/[0-9]{1,128}$") && query.count == 2
        && query.filter({ $0.name == "id" && $0.value == identity }).count == 1
        && query.filter({ $0.name == "type" && $0.value == "7" }).count == 1
    case "www.kugou.com": valid = matches(path, "^/mvweb/html/mv_[0-9]{1,128}\\.html$") && url.query == nil
    default: valid = false
    }
    return valid && url.fragment == nil ? url : nil
  }
  static func allowsNavigation(_ url: URL, from root: URL) -> Bool {
    guard initialURL(root.absoluteString) != nil, safeHTTPS(url), let host = url.host?.lowercased() else { return false }
    let hosts: Set<String>
    switch root.host?.lowercased() {
    case "music.163.com": hosts = ["music.163.com", "m.music.163.com", "y.music.163.com"]
    case "y.qq.com": hosts = ["y.qq.com", "m.y.qq.com", "i.y.qq.com", "i2.y.qq.com"]
    case "www.kuwo.cn", "m.kuwo.cn": hosts = ["www.kuwo.cn", "m.kuwo.cn"]
    case "www.kugou.com": hosts = ["www.kugou.com", "m.kugou.com"]
    default: return false
    }
    return hosts.contains(host)
  }
  private static func safeHTTPS(_ url: URL) -> Bool {
    url.scheme?.lowercased() == "https" && url.user == nil && url.password == nil && (url.port == nil || url.port == 443)
  }
}
