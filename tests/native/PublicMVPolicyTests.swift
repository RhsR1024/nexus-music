import Foundation

@main struct PublicMVPolicyTests {
  static func main() {
    let rules = try! JSONSerialization.jsonObject(with: Data(PublicMVPolicy.privacyRules.utf8)) as! [[String:Any]]
    let trigger = rules[0]["trigger"] as! [String:Any]
    let filter = try! NSRegularExpression(pattern: trigger["url-filter"] as! String)
    func blocked(_ url:String)->Bool { filter.firstMatch(in:url,range:NSRange(url.startIndex...,in:url)) != nil }
    precondition(blocked("https://hm.baidu.com/hm.js?public=1"))
    for url in ["https://h5s.kuwo.cn/www/m/app.js", "https://hm.baidu.com.evil.example/app.js", "https://music.163.com/mv?id=123"] { precondition(!blocked(url)) }
    precondition(trigger["resource-type"] as! [String] == ["script"])
    let pages = ["https://music.163.com/mv?id=123", "https://y.qq.com/n/ryqq/mv/publicVideo", "https://m.kuwo.cn/newh5app/mvplay/7/123?id=123&type=7", "https://www.kugou.com/mvweb/html/mv_123.html"]
    for page in pages {
      guard let root = PublicMVPolicy.initialURL(page) else { fatalError("Valid official page rejected") }
      precondition(PublicMVPolicy.allowsNavigation(root, from: root))
      for destination in ["http://y.qq.com/n/ryqq/mv/publicVideo", "https://127.0.0.1/", "https://192.168.1.1/", "https://[::1]/", "file:///tmp/public.html", "javascript:alert(1)", "https://y.qq.com.evil.example/", "https://user:password@y.qq.com/", "https://y.qq.com:8443/"] {
        precondition(!PublicMVPolicy.allowsNavigation(URL(string: destination)!, from: root), "Unsafe navigation permitted")
      }
      for other in pages where URL(string: other)!.host != root.host {
        precondition(!PublicMVPolicy.allowsNavigation(URL(string: other)!, from: root), "Cross-platform navigation permitted")
      }
    }
    for invalid in ["https://music.163.com/mv?id=123&token=unit", "https://music.163.com/mv?id=123&id=456", "https://music.163.com/mv?id=abc", "https://music.163.com/mv?id=123#unit", "https://y.qq.com/n/ryqq/mv/../login", "https://y.qq.com/n/ryqq/mv/publicVideo?redirect=unit", "https://www.kuwo.cn/mvplay/abc", "https://www.kugou.com/mvweb/html/mv_hash.html", "https://music.migu.cn/v3/video/mv/123/extra", "https://www.kuwo.cn/mvplay/123%2f456", "https://www.kuwo.cn/mvplay/%31%32%33%0a", "https://127.0.0.1/mv?id=123"] {
      precondition(PublicMVPolicy.initialURL(invalid) == nil, "Invalid initial page permitted")
    }
    let qq = PublicMVPolicy.initialURL(pages[1])!
    precondition(PublicMVPolicy.allowsNavigation(URL(string:"https://y.qq.com/n/ryqq_v2/mv/publicVideo")!, from:qq))
    precondition(PublicMVPolicy.allowsNavigation(URL(string:"https://m.y.qq.com/portal/mv.html?vid=publicVideo")!, from:qq))
    precondition(PublicMVPolicy.allowsNavigation(URL(string:"https://i.y.qq.com/n2/m/share/details/mv.html?vid=publicVideo")!, from:qq))
    precondition(PublicMVPolicy.allowsNavigation(URL(string:"https://i2.y.qq.com/n3/other/pages/details/mv.html?vid=publicVideo")!, from:qq))
    precondition(PublicMVPolicy.allowsNavigation(URL(string:"https://y.music.163.com/m/mv?id=123")!, from:PublicMVPolicy.initialURL(pages[0])!))
    precondition(PublicMVPolicy.initialURL("https://m.kuwo.cn/newh5app/mvplay/7/123?id=456&type=7") == nil)
    precondition(PublicMVPolicy.initialURL("https://m.kuwo.cn/newh5app/mvplay/7/123?id=123&type=1") == nil)
    print("Public MV official-page, private-address, scheme and platform boundaries passed")
  }
}
