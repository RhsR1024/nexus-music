// Offline JavaScriptCore compatibility probe. This is not a production host.
// It never issues HTTP requests, runs timer callbacks, or logs script text/URLs.
import Foundation
import JavaScriptCore
import CryptoKit
import Security

let args = CommandLine.arguments
guard args.count == 3 else { exit(2) }
let context = JSContext()!
var initialized: [String: Any]?
var exception = false
var requests = 0
var missing = Set<String>()
context.exceptionHandler = { _, _ in exception = true }
let emit: @convention(block) (String, String) -> Void = { event, json in
  if event == "inited", let data = json.data(using: .utf8),
     let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any] { initialized = value }
}
let http: @convention(block) (Int, String, String) -> Void = { _, _, _ in requests += 1 }
let timer: @convention(block) (Int, Double) -> Void = { _, _ in }
let cancel: @convention(block) (Int) -> Void = { _ in }
let utility: @convention(block) (String, String) -> String = { operation, json in
  func encode(_ value: Any) -> String {
    let data = try! JSONSerialization.data(withJSONObject: value)
    return String(data: data, encoding: .utf8)!
  }
  guard let data = json.data(using: .utf8),
        let input = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return encode(["error": "Invalid utility input"]) }
  let raw = (input["bytes"] as? [Int] ?? []).map { UInt8(truncatingIfNeeded: $0) }
  switch operation {
  case "md5": return encode(["value": Insecure.MD5.hash(data: Data(raw)).map { String(format: "%02x", $0) }.joined()])
  case "randomBytes":
    let count = input["count"] as? Int ?? 0
    guard count >= 0 && count <= 65536 else { return encode(["error": "Invalid random byte count"]) }
    var value = [UInt8](repeating: 0, count: count)
    if count > 0 { _ = SecRandomCopyBytes(kSecRandomDefault, count, &value) }
    return encode(["value": value.map(Int.init)])
  case "decode":
    let text = input["input"] as? String ?? ""
    let encoding = input["encoding"] as? String ?? "utf8"
    if encoding == "base64" { return encode(["value": (Data(base64Encoded: text) ?? Data()).map(Int.init)]) }
    if encoding == "binary" { return encode(["value": text.utf16.map { Int($0 & 255) }]) }
    return encode(["value": Array(text.utf8).map(Int.init)])
  case "encode":
    let encoding = input["encoding"] as? String ?? "utf8"
    if encoding == "base64" { return encode(["value": Data(raw).base64EncodedString()]) }
    if encoding == "hex" { return encode(["value": raw.map { String(format: "%02x", $0) }.joined()]) }
    if encoding == "binary" { return encode(["value": String(raw.map { Character(UnicodeScalar(Int($0))!) })]) }
    return encode(["value": String(decoding: raw, as: UTF8.self)])
  default: missing.insert(operation); return encode(["error": "Unsupported utility"])
  }
}
context.setObject(["emit": emit, "http": http, "abortHttp": cancel, "timer": timer,
                   "clearTimer": cancel, "utility": utility], forKeyedSubscript: "__nexusNative" as NSString)
context.setObject(["name": "Local compatibility test", "version": "", "author": "", "description": "", "rawScript": ""],
                  forKeyedSubscript: "__nexusScriptInfo" as NSString)
context.evaluateScript(try String(contentsOfFile: args[1], encoding: .utf8))
context.evaluateScript(try String(contentsOfFile: args[2], encoding: .utf8))
let sources = initialized?["sources"] as? [String: Any] ?? [:]
let result: [String: Any] = ["initialized": initialized != nil, "exception": exception,
  "sources": sources.keys.sorted(), "networkRequestsNotExecuted": requests, "missingUtilities": missing.sorted()]
let output = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
print(String(data: output, encoding: .utf8)!)
