import Foundation
import CryptoKit
import AVFoundation

@main struct OfflineTransfersCLI {
  static func checked<T>(_ body: (@escaping (Result<T, Error>) -> Void) -> Void) async throws -> T {
    try await withCheckedThrowingContinuation { continuation in body { continuation.resume(with: $0) } }
  }
  static func snapshot(_ engine: OfflineBackgroundTransfers, _ name: String) async -> OfflineTransferRecord? {
    await withCheckedContinuation { continuation in engine.snapshot(name) { continuation.resume(returning: $0) } }
  }
  static func wait(_ engine: OfflineBackgroundTransfers, _ name: String, _ condition: (OfflineTransferRecord) -> Bool) async throws -> OfflineTransferRecord {
    for _ in 0..<600 {
      if let state = await snapshot(engine, name), condition(state) { return state }
      try await Task.sleep(nanoseconds: 100_000_000)
    }
    throw NSError(domain: "Probe", code: 1, userInfo: [NSLocalizedDescriptionKey: "Native transfer did not settle"])
  }
  static func hash(_ url: URL) throws -> String {
    let stream = InputStream(url: url)!; stream.open(); defer { stream.close() }
    var digest = SHA256(), buffer = [UInt8](repeating: 0, count: 65536)
    while stream.hasBytesAvailable { let count = stream.read(&buffer, maxLength: buffer.count); if count < 0 { throw stream.streamError! }; if count == 0 { break }; digest.update(data: Data(buffer.prefix(count))) }
    return digest.finalize().map { String(format: "%02x", $0) }.joined()
  }
  static func verifyRequestIdentity() throws {
    let first = URL(string: "https://media.example/rest/stream.view?id=one&u=fixture&s=first&t=first")!
    let rotated = URL(string: "https://media.example/rest/stream.view?id=one&u=fixture&s=second&t=second")!
    let key = String(repeating: "a", count: 64)
    let strictFirst = try OfflineBackgroundTransfers.requestFingerprint(first, headers: [:])
    let strictRotated = try OfflineBackgroundTransfers.requestFingerprint(rotated, headers: [:])
    precondition(strictFirst != strictRotated)
    let stableFirst = try OfflineBackgroundTransfers.requestFingerprint(first, headers: [:], identity: key)
    let stableRotated = try OfflineBackgroundTransfers.requestFingerprint(rotated, headers: [:], identity: key)
    precondition(stableFirst == stableRotated)
    let changedAccountOrSong = try OfflineBackgroundTransfers.requestFingerprint(rotated, headers: [:], identity: String(repeating: "b", count: 64))
    let changedServer = try OfflineBackgroundTransfers.requestFingerprint(URL(string: "https://other.example/rest/stream.view")!, headers: [:], identity: key)
    let changedHeaders = try OfflineBackgroundTransfers.requestFingerprint(first, headers: ["Authorization":"fixture"], identity: key)
    precondition(stableFirst != changedAccountOrSong && stableFirst != changedServer && stableFirst != changedHeaders)
    do { _ = try OfflineBackgroundTransfers.requestFingerprint(first, headers: [:], identity: "not-a-content-key"); fatalError("Invalid identity must fail") } catch {}
  }
  static func main() async throws {
    try verifyRequestIdentity()
    let args = CommandLine.arguments; guard args.count == 5, URL(string: args[1])?.host == "127.0.0.1" else { fatalError("loopback URL, output directory, two expected hashes required") }
    let root = URL(fileURLWithPath: args[2]), files = root.appendingPathComponent("files"), metadata = root.appendingPathComponent("metadata")
    let engine = OfflineBackgroundTransfers(directory: files, metadata: metadata, configuration: .ephemeral)
    try await checked { engine.configure(20 * 1024 * 1024, completion: $0) }
    let first = "00000000-0000-4000-8000-000000000001.audio", second = "00000000-0000-4000-8000-000000000002.audio", third = "00000000-0000-4000-8000-000000000003.audio"
    _ = try await checked { engine.begin(args[1]+"/a", name: first, headers: [:], resume: false, completion: $0) }
    _ = try await wait(engine, first) { $0.received >= 65536 }
    try await checked { engine.stop(first, pause: true, completion: $0) }
    let paused = try await wait(engine, first) { $0.state == "paused" }
    _ = try await checked { engine.begin(args[1]+"/a", name: first, headers: [:], resume: true, completion: $0) }
    let completedA = try await wait(engine, first) { $0.state == "completed" || $0.state == "failed" }
    guard completedA.state == "completed", try hash(files.appendingPathComponent(first)) == args[3] else { fatalError("first payload mismatch") }
    _ = try await checked { engine.begin(args[1]+"/b", name: second, headers: [:], resume: false, completion: $0) }
    _ = try await wait(engine, second) { $0.received >= 65536 }
    try await checked { engine.stop(second, pause: false, completion: $0) }
    _ = try await wait(engine, second) { $0.state == "cancelled" }
    _ = try await checked { engine.begin(args[1]+"/b", name: second, headers: [:], resume: false, completion: $0) }
    let completedB = try await wait(engine, second) { $0.state == "completed" || $0.state == "failed" }
    guard completedB.state == "completed", try hash(files.appendingPathComponent(second)) == args[4] else { fatalError("second payload mismatch") }
    let restored = OfflineBackgroundTransfers(directory: files, metadata: metadata, configuration: .ephemeral)
    let recovered = await snapshot(restored, first)
    guard recovered?.state == "completed" else { fatalError("native journal did not restore") }
    try await checked { restored.acknowledge(first, completion: $0) }
    guard await snapshot(restored, first) == nil, FileManager.default.fileExists(atPath: files.appendingPathComponent(first).path) else { fatalError("ack must retain completed payload") }
    try await checked { restored.configure(1024 * 1024, completion: $0) }
    _ = try await checked { restored.begin(args[1]+"/a", name: third, headers: [:], resume: false, completion: $0) }
    let capacity = try await wait(restored, third) { $0.state == "failed" }
    guard capacity.error == "capacity", !FileManager.default.fileExists(atPath: files.appendingPathComponent(third).path) else { fatalError("native capacity must reject extra payload") }
    try await checked { restored.discard(third, completion: $0) }
    let policyRoot = root.appendingPathComponent("concurrency"), policyFiles = policyRoot.appendingPathComponent("files"), policyMeta = policyRoot.appendingPathComponent("metadata")
    let policy = OfflineBackgroundTransfers(directory: policyFiles, metadata: policyMeta, configuration: .ephemeral)
    try await checked { policy.configure(8 * 1024 * 1024 * 1024, completion: $0) }
    do { try await checked { policy.setConcurrency(4, completion: $0) }; fatalError("invalid concurrency accepted") } catch {}
    try await checked { policy.setConcurrency(1, completion: $0) }
    for (name, endpoint) in [(first,"/a"),(second,"/b"),(third,"/a")] { _ = try await checked { policy.begin(args[1]+endpoint, name: name, headers: [:], resume: false, completion: $0) } }
    _ = try await wait(policy, first) { $0.received >= 65536 }
    guard await snapshot(policy, second)?.state == "queued", await snapshot(policy, third)?.state == "queued" else { fatalError("limit one must queue later native tasks") }
    try await checked { policy.setConcurrency(2, completion: $0) }; _ = try await wait(policy, second) { $0.received >= 65536 }
    guard await snapshot(policy, third)?.state == "queued" else { fatalError("limit two") }
    try await checked { policy.setConcurrency(3, completion: $0) }; _ = try await wait(policy, third) { $0.received >= 65536 }
    guard await snapshot(policy, first)?.state == "running", await snapshot(policy, second)?.state == "running" else { fatalError("three real transfers must overlap") }
    try await checked { policy.setConcurrency(1, completion: $0) }
    let fourth = "00000000-0000-4000-8000-000000000004.audio"
    _ = try await checked { policy.begin(args[1]+"/b", name: fourth, headers: [:], resume: false, completion: $0) }
    guard await snapshot(policy, first)?.state == "running", await snapshot(policy, second)?.state == "running", await snapshot(policy, third)?.state == "running", await snapshot(policy, fourth)?.state == "queued" else { fatalError("decrease must retain started tasks and defer new work") }
    for (name, expected) in [(first,args[3]),(second,args[4]),(third,args[3]),(fourth,args[4])] {
      let state = try await wait(policy, name) { $0.state == "completed" || $0.state == "failed" }
      guard state.state == "completed", try hash(policyFiles.appendingPathComponent(name)) == expected else { fatalError("concurrency payload mismatch") }
      let decoded = try AVAudioFile(forReading: policyFiles.appendingPathComponent(name))
      guard decoded.length > 0, let buffer = AVAudioPCMBuffer(pcmFormat: decoded.processingFormat, frameCapacity: 4096) else { fatalError("downloaded audio format") }
      try decoded.read(into: buffer); guard buffer.frameLength > 0 else { fatalError("downloaded audio decode") }
    }
    let policyRestart = OfflineBackgroundTransfers(directory: policyFiles, metadata: policyMeta, configuration: .ephemeral)
    let fifth = "00000000-0000-4000-8000-000000000005.audio", sixth = "00000000-0000-4000-8000-000000000006.audio"
    for (name, endpoint) in [(fifth,"/a"),(sixth,"/b")] { _ = try await checked { policyRestart.begin(args[1]+endpoint, name: name, headers: [:], resume: false, completion: $0) } }
    _ = try await wait(policyRestart, fifth) { $0.received >= 65536 }
    guard await snapshot(policyRestart, sixth)?.state == "queued" else { fatalError("native persisted concurrency must survive restart") }
    for name in [sixth,fifth] { try await checked { policyRestart.stop(name, pause: false, completion: $0) }; _ = try await wait(policyRestart, name) { $0.state == "cancelled" } }
    let receipt: [String: Any] = ["transport":"macOS Foundation URLSession ephemeral; not iOS background acceptance", "pausedBytes":paused.received,"completedBytes":[completedA.received,completedB.received],"sha256":[args[3],args[4]],"cancelAndRetry":true,"journalRecovery":true,"ackRetainsPayload":true,"capacityEnforced":true,"concurrencyOneTwoThree":true,"decreaseKeepsActive":true,"restartKeepsConcurrency":true,"concurrencyPayloadCopiesVerified":4,"downloadedAudioExtensionPCMDecoded":true,"totalQuota8GiBAccepted":true]
    print(String(data: try JSONSerialization.data(withJSONObject: receipt, options: [.sortedKeys]), encoding: .utf8)!)
  }
}
