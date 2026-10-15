import Foundation
@main enum DAVHTTPCLI {
  static func main() {
    guard CommandLine.arguments.count >= 3 else { exit(2) }
    var done = false
    do {
      let request = try DAVHTTP(root: CommandLine.arguments[1], path: CommandLine.arguments[2], username: "fixture-user", password: "fixture-password", depth: 1)
      request.start { result in
        switch result {
        case .success(let value): print("status=\(value["status"] ?? 0) bytes=\((value["body"] as? String)?.utf8.count ?? 0)")
        case .failure(let error): print("error=\((error as NSError).code)")
        }
        done = true
      }
      if CommandLine.arguments.count > 3 { DispatchQueue.global().asyncAfter(deadline: .now() + 0.03) { request.cancel() } }
      let deadline = Date().addingTimeInterval(10)
      while !done && Date() < deadline { RunLoop.current.run(until: Date().addingTimeInterval(0.01)) }
      if !done { exit(3) }
    } catch { print("error=\((error as NSError).code)") }
  }
}
