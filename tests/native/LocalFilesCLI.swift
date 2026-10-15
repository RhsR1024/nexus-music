import Foundation
@main enum LocalFilesCLI {
  static func main() async {
    guard CommandLine.arguments.count==4 else { exit(2) }
    let root=URL(fileURLWithPath:CommandLine.arguments[1]),input=URL(fileURLWithPath:CommandLine.arguments[2]),files=LocalAudioFiles(root:root)
    do {
      var value=try await files.importFile(input.absoluteString,name:CommandLine.arguments[3])
      let id=value["id"] as! String,ext=value["extension"] as! String
      let uri=try files.resolve(id,ext);let url=URL(string:uri)!
      assert(files.retain(url));var protected=false;do{try files.remove(id,ext)}catch{protected=true};assert(protected);files.release(url)
      let transaction=try files.beginRemoval(id,ext)
      assert(!FileManager.default.fileExists(atPath:url.path));try files.finishRemoval(transaction,restore:true)
      assert(FileManager.default.fileExists(atPath:url.path))
      _ = try files.beginRemoval(id,ext);try files.reconcile([["id":id,"extension":ext]])
      assert(FileManager.default.fileExists(atPath:url.path))
      _ = try files.beginRemoval(id,ext);try files.reconcile([])
      assert(!FileManager.default.fileExists(atPath:url.path))
      _ = try await files.importFile(input.absoluteString,name:CommandLine.arguments[3])
      value["hasArtwork"] = files.artwork(id) != nil
      var invalid=false; do { _ = try files.resolve("../escape", ext) } catch { invalid=true }; assert(invalid)
      print(String(data:try JSONSerialization.data(withJSONObject:value),encoding:.utf8)!)
    }catch{print("{\"error\":\"Import rejected\"}");exit(1)}
  }
}
