import Foundation
import CryptoKit
@main enum DAVBackupCLI {
  static func main() {
    let args = CommandLine.arguments
    guard args.count >= 6 else { exit(2) }
    var done = false
    do {
      let body = args[4].isEmpty ? "" : try String(contentsOfFile: args[4], encoding: .utf8)
      let request = try DAVHTTP(root: args[1], path: args[2], username: "fixture-user", password: "fixture-password", operation: args[3], body: body, etag: args[5])
      request.start { result in
        switch result {
        case .success(let value):
          let body = value["body"] as? String ?? ""
          let digest = SHA256.hash(data: Data(body.utf8)).map { String(format: "%02x", $0) }.joined()
          print("status=\(value["status"] ?? 0) bytes=\(value["bytes"] ?? 0) etag=\(value["etag"] ?? "") sha=\(digest)")
        case .failure(let error): print("error=\((error as NSError).code)")
        }
        done = true
      }
      if args.count > 6 { DispatchQueue.global().asyncAfter(deadline: .now() + 0.03) { request.cancel() } }
      let deadline = Date().addingTimeInterval(15)
      while !done && Date() < deadline { RunLoop.current.run(until: Date().addingTimeInterval(0.01)) }
      if !done { exit(3) }
    } catch { print("error=\((error as NSError).code)") }
  }
}
