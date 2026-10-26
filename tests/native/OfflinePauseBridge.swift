import Foundation
@main struct OfflinePauseBridge {
  static func checked<T>(_ body: (@escaping(Result<T,Error>)->Void)->Void) async throws -> T {try await withCheckedThrowingContinuation { c in body { c.resume(with:$0) } }}
  static func main() async throws {
    guard CommandLine.arguments.count == 2 else { fatalError("output directory required") }
    let root=URL(fileURLWithPath:CommandLine.arguments[1]);let engine=OfflineBackgroundTransfers(directory:root.appendingPathComponent("files"),metadata:root.appendingPathComponent("metadata"),configuration:.ephemeral)
    while let line=readLine() {
      guard let data=line.data(using:.utf8),let q=try JSONSerialization.jsonObject(with:data) as? [String:Any] else {continue}
      var out:[String:Any]=["id":q["id"]!]
      do {
        let name=q["name"] as? String ?? ""
        switch q["op"] as? String {
        case "configure":try await checked{engine.configure((q["value"] as! NSNumber).int64Value,completion:$0)}
        case "setConcurrency":try await checked{engine.setConcurrency((q["value"] as! NSNumber).intValue,completion:$0)}
        case "begin":let url=q["url"] as! String;guard URL(string:url)?.host=="127.0.0.1" else {fatalError("loopback only")};out["result"]=try await checked{engine.begin(url,name:name,headers:[:],resume:q["resume"] as? Bool ?? false,completion:$0)}.dictionary
        case "snapshot":let state=await withCheckedContinuation{c in engine.snapshot(name){c.resume(returning:$0)}};out["result"]=state?.dictionary ?? NSNull()
        case "stop":try await checked{engine.stop(name,pause:q["pause"] as? Bool ?? false,completion:$0)}
        case "acknowledge":try await checked{engine.acknowledge(name,completion:$0)}
        case "discard":try await checked{engine.discard(name,completion:$0)}
        default:fatalError("operation")
        }
      }catch{out["error"]="native operation failed"}
      print(String(data:try JSONSerialization.data(withJSONObject:out),encoding:.utf8)!)
      fflush(stdout)
    }
  }
}
