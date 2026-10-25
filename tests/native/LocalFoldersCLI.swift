import Foundation
import CryptoKit
@main enum LocalFoldersCLI {
  static func main() async throws {
    guard CommandLine.arguments.count == 4 else { exit(2) }
    let base = URL(fileURLWithPath: CommandLine.arguments[3]), fm = FileManager.default
    let music = base.appendingPathComponent("Public Music"), albums = music.appendingPathComponent("Albums")
    try fm.createDirectory(at: albums, withIntermediateDirectories: true)
    let first = URL(fileURLWithPath: CommandLine.arguments[1]), second = URL(fileURLWithPath: CommandLine.arguments[2])
    let firstCopy = music.appendingPathComponent("Shape of You - Ed Sheeran.mp3"), secondCopy = albums.appendingPathComponent("Perfect - Ed Sheeran.mp3")
    try fm.copyItem(at: first, to: firstCopy); try fm.copyItem(at: second, to: secondCopy)
    try fm.createSymbolicLink(at: music.appendingPathComponent("escape.mp3"), withDestinationURL: second)
    try fm.createSymbolicLink(at: music.appendingPathComponent("Escaped Directory"), withDestinationURL: second.deletingLastPathComponent())
    let owned = LocalAudioFiles(root: base.appendingPathComponent("owned")), registry = base.appendingPathComponent("registry/roots.json")
    let folders = LocalAudioFolders(files: owned, registry: registry), root = try folders.register(music), id = root["id"]!
    func count(_ value: [String: Any]) -> Int { (value["files"] as! [[String: Any]]).count }
    let flat = try await folders.scan([id], recursive: [], blocked: [], minimumSeconds: 0); assert(count(flat) == 1)
    let deep = try await folders.scan([id], recursive: [id], blocked: [], minimumSeconds: 0); assert(count(deep) == 2)
    let durations = try await folders.scan([id], recursive: [id], blocked: [], minimumSeconds: 240); assert(count(durations) == 1)
    assert((durations["files"] as! [[String: Any]])[0]["title"] as? String == "Perfect - Ed Sheeran")
    let blocked = try await folders.scan([id], recursive: [id], blocked: [id + "/Albums"], minimumSeconds: 0); assert(count(blocked) == 1)
    let blockedRoot = try await folders.scan([id], recursive: [id], blocked: [id + "/"], minimumSeconds: 0); assert(count(blockedRoot) == 0)
    let restored = LocalAudioFolders(files: owned, registry: registry)
    let sameRoot = try restored.register(music); assert(sameRoot["id"] == id)
    let reread = try await restored.scan([id], recursive: [id], blocked: [], minimumSeconds: 0); assert(count(reread) == 2)
    for file in reread["files"] as! [[String: Any]] {
      let fileID = file["id"] as! String, path = try owned.resolve(fileID, "mp3")
      let hash = SHA256.hash(data: try Data(contentsOf: URL(string: path)!)).map { String(format: "%02x", $0) }.joined()
      assert(hash == fileID)
    }
    try fm.removeItem(at: firstCopy)
    let missing = try await restored.scan([id], recursive: [id], blocked: [], minimumSeconds: 0); assert(count(missing) == 1)
    try restored.retainRoots([])
    var denied = false; do { _ = try await restored.scan([id], recursive: [], blocked: [], minimumSeconds: 0) } catch { denied = true }; assert(denied)
    try Data("broken bookmark record".utf8).write(to: registry)
    let recovered = try restored.register(music), recoveredID = recovered["id"]!
    let recoveredScan = try await restored.scan([recoveredID], recursive: [recoveredID], blocked: [], minimumSeconds: 0); assert(count(recoveredScan) == 1)
    let backups = try fm.contentsOfDirectory(atPath: registry.deletingLastPathComponent().path); assert(backups.contains(where: { $0.hasPrefix("roots-corrupt-") }))
    print("{\"realPublicAudio\":true,\"flat\":1,\"recursive\":2,\"minimum240\":1,\"blockedChild\":1,\"blockedRoot\":0,\"bookmarkRestart\":2,\"missingFile\":1,\"symlinkSkipped\":true,\"ownedHashesMatch\":true,\"forgottenRootRejected\":true}")
  }
}
