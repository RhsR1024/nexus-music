import Foundation
import CryptoKit

@main struct DownloadDestinationCLI {
 static func sha(_ url: URL) throws -> String { SHA256.hash(data: try Data(contentsOf: url)).map { String(format: "%02x", $0) }.joined() }
 static func main() throws {
  let args = CommandLine.arguments; precondition(args.count == 3)
  let input = URL(fileURLWithPath: args[1]), output = URL(fileURLWithPath: args[2]), fm = FileManager.default
  precondition(!fm.fileExists(atPath: output.path)); try fm.createDirectory(at: output, withIntermediateDirectories: false)
  let caches = fm.urls(for: .cachesDirectory, in: .userDomainMask)[0], stage = caches.appendingPathComponent("nexus-audio-export-" + UUID().uuidString), target = output.appendingPathComponent("User destination")
  try fm.createDirectory(at: stage, withIntermediateDirectories: false); try fm.createDirectory(at: target, withIntermediateDirectories: false); defer { try? fm.removeItem(at: stage) }
  let names = try fm.contentsOfDirectory(atPath: input.path).sorted(); precondition(names.count == 4)
  for name in names { try fm.copyItem(at: input.appendingPathComponent(name), to: stage.appendingPathComponent(name)) }
  let uris = names.map { stage.appendingPathComponent($0).absoluteString }
  let store = DownloadDestination(registry: output.appendingPathComponent("private/root.json")), root = try store.register(target), id = root["id"]!, job = UUID().uuidString
  let unownedTemporary = target.appendingPathComponent(".nexus-part-" + job.lowercased() + "-0"), unownedBytes = Data("user-owned hidden file".utf8)
  try unownedBytes.write(to: unownedTemporary, options: .withoutOverwriting)
  let first = try store.save(uris, expected: id, job: job); precondition(first == names)
  let unownedPreserved = try Data(contentsOf: unownedTemporary); precondition(unownedPreserved == unownedBytes)
  for name in names { let source = try sha(input.appendingPathComponent(name)), copied = try sha(target.appendingPathComponent(name)); precondition(source == copied) }
  let restored = DownloadDestination(registry: output.appendingPathComponent("private/root.json")); let status = try restored.status(); precondition(status?["id"] == id)
  let repeated = try restored.save(uris, expected: id, job: job); precondition(repeated == names)
  try fm.removeItem(at: target.appendingPathComponent(names[0])); let repaired = try restored.save(uris, expected: id, job: job); precondition(repaired == names)
  let original = try sha(input.appendingPathComponent(names[0])), repairedHash = try sha(target.appendingPathComponent(names[0])); precondition(original == repairedHash)
  let edited = target.appendingPathComponent("Ed Sheeran__Shape of You.meta.json"), sentinel = Data("user edited metadata".utf8); try sentinel.write(to: edited)
  do { _ = try restored.save(uris, expected: id, job: job); fatalError("User modification must not be overwritten") } catch {}
  let preserved = try Data(contentsOf: edited); precondition(preserved == sentinel)
  let collisions = try restored.save(uris, expected: id, job: UUID().uuidString); precondition(collisions.allSatisfy { $0.contains(" (2).") }); let stillPreserved = try Data(contentsOf: edited); precondition(stillPreserved == sentinel)
  try restored.forget(id)
  do { _ = try restored.save(uris, expected: id, job: UUID().uuidString); fatalError("Forgotten grant must fail") } catch {}
  precondition(names.allSatisfy { fm.fileExists(atPath: target.appendingPathComponent($0).path) })
  let documents = output.appendingPathComponent("private/documents"), owned = documents.appendingPathComponent("offline-audio")
  try fm.createDirectory(at: owned, withIntermediateDirectories: true)
  let ownedAudio = owned.appendingPathComponent("00000000-0000-4000-8000-000000000001.audio"), stagedAudio = stage.appendingPathComponent("native-copy.mp3")
  try fm.copyItem(at: input.appendingPathComponent("Ed Sheeran__Shape of You.mp3"), to: ownedAudio)
  _ = try AudioExportStaging.stageAudio(ownedAudio.absoluteString, target: stagedAudio.absoluteString, documents: documents)
  let expectedAudio = try sha(ownedAudio), actualAudio = try sha(stagedAudio); precondition(expectedAudio == actualAudio)
  do { _ = try AudioExportStaging.stageAudio(input.appendingPathComponent("Ed Sheeran__Shape of You.mp3").absoluteString, target: stage.appendingPathComponent("outside.mp3").absoluteString, documents: documents); fatalError("Outside owned audio must fail") } catch {}
  let receipt: [String: Any] = ["nativeAudioStageSHA256":actualAudio,"outsideSourceRejected":true,"unownedTemporaryPreserved":true,"firstNames":names,"collisionNames":collisions,"restartAndIdempotency":true,"missingMemberRepaired":true,"userModificationPreserved":true,"forgottenGrantRejected":true,"actualInputFiles":try names.map { ["name":$0,"sha256":try sha(input.appendingPathComponent($0))] }]
  try JSONSerialization.data(withJSONObject: receipt, options: [.prettyPrinted,.sortedKeys]).write(to: output.appendingPathComponent("receipt.json"))
  print("Actual four-file copy, restart, missing-member recovery, user edit, grouped collision and forgotten-grant checks passed")
 }
}
