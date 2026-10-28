import Foundation

@main struct MusicWebLoginPolicyTests {
  static func main() {
    func expect(_ condition: Bool, _ message: String) { precondition(condition, message) }
    expect(MusicWebLoginPolicy.initialURL("tx")?.hasPrefix("https://graph.qq.com/oauth2.0/authorize?") == true, "Official QQ entry")
    expect(MusicWebLoginPolicy.initialURL("kg") == nil, "No unsupported login")
    expect(MusicWebLoginPolicy.initialURL("tx", state: "attempt-1") == MusicWebLoginPolicy.qqURL + "&state=attempt-1", "Attempt-bound OAuth state")
    expect(MusicWebLoginPolicy.initialURL("tx", state: "bad&state=other") == nil, "No state query injection")
    expect(MusicWebLoginPolicy.matchesCallback(URL(string: "https://y.qq.com/portal/wx_redirect.html?login_type=1&state=attempt-1&code=synthetic")!, state: "attempt-1"), "Matching official callback")
    for url in ["https://y.qq.com/portal/wx_redirect.html?login_type=1&state=old&code=synthetic", "https://y.qq.com/portal/wx_redirect.html?login_type=1&state=attempt-1&state=old&code=synthetic", "https://y.qq.com/portal/wx_redirect.html?login_type=2&state=attempt-1&code=synthetic", "https://y.qq.com/portal/wx_redirect.html?login_type=1&state=attempt-1", "https://evil.test/portal/wx_redirect.html?login_type=1&state=attempt-1&code=synthetic"] {
      expect(!MusicWebLoginPolicy.matchesCallback(URL(string: url)!, state: "attempt-1"), "Reject mismatched callback")
    }
    for url in ["https://graph.qq.com/oauth2.0/authorize", "https://xui.ptlogin2.qq.com/cgi-bin/xlogin", "https://y.qq.com/portal/wx_redirect.html", "https://t.captcha.qq.com/"] {
      expect(MusicWebLoginPolicy.allows(URL(string: url)!, provider: "tx"), "Official QQ HTTPS navigation")
    }
    for url in ["http://y.qq.com/", "https://qq.com.evil.test/", "https://evil.test/?next=https://qq.com/", "https://user@y.qq.com/", "https://y.qq.com:8443/", "wtloginmqq://ptlogin/qlogin", "https://music.163.com/"] {
      expect(!MusicWebLoginPolicy.allows(URL(string: url)!, provider: "tx"), "QQ navigation boundary")
    }
    expect(MusicWebLoginPolicy.allows(URL(string: "https://music.163.com/m/login")!, provider: "wy"), "Existing NetEase entry")
    expect(!MusicWebLoginPolicy.allows(URL(string: "https://y.qq.com/")!, provider: "wy"), "Platform isolation")
    expect(!MusicWebLoginPolicy.ready(["uin": "42", "skey": "generic"], provider: "tx"), "Generic QQ login is insufficient")
    expect(MusicWebLoginPolicy.ready(["qqmusic_uin": "o000042", "qqmusic_key": "synthetic-qq"], provider: "tx"), "Music QQ identity")
    expect(!MusicWebLoginPolicy.ready(["qqmusic_uin": "0", "qqmusic_key": "synthetic-qq"], provider: "tx"), "No zero principal")
    for values in [["qqmusic_uin": "42", "qqmusic_key": "W_X-synthetic"], ["qqmusic_uin": "42", "qqmusic_key": "synthetic-qq", "login_type": "2"], ["qqmusic_uin": "42", "qqmusic_key": "synthetic-qq", "wxuin": "99"]] {
      expect(!MusicWebLoginPolicy.ready(values, provider: "tx"), "WX must not become a QQ principal")
    }
    expect(MusicWebLoginPolicy.cookieNames("tx").contains("qqmusic_key"), "Music credential allowlist")
    expect(!MusicWebLoginPolicy.cookieNames("tx").contains("skey"), "No unrelated generic QQ credential")
    expect(MusicWebLoginPolicy.dailyOrigin(URL(string: MusicWebLoginPolicy.dailyURL)!), "Official Skills origin")
    for url in ["https://a.qq.com/discover/daily-mix", "https://y.qq.com:443/"] { expect(MusicWebLoginPolicy.dailyOrigin(URL(string:url)!), "Official daily origin") }
    for url in ["https://evil.qq.com/", "https://y.qq.com.evil.test/", "http://y.qq.com/", "https://user:pass@y.qq.com/", "https://y.qq.com:444/", "about:blank"] { expect(!MusicWebLoginPolicy.dailyOrigin(URL(string:url)!), "Reject untrusted daily source") }
    print("Music web login native policy passed")
  }
}
