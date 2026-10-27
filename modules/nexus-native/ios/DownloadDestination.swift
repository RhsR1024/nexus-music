import Foundation
import CryptoKit

/// A download destination has independent consent from library scan roots.
/// Only its opaque revision/name cross JS; the bookmark stays backup-excluded.
final class DownloadDestination {
  struct Root: Codable { let id: String; let name: String; let bookmark: Data }
  struct Entry: Codable, Equatable { let name: String; let bytes: Int; let md5: String }
  struct Transaction: Codable { let version: Int; let destination: String; let job: String; let files: [Entry] }
  static let shared = DownloadDestination()
  private let registry: URL
  private let fm = FileManager.default
  private let lock = NSRecursiveLock()
  init(registry: URL? = nil) { self.registry = registry ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("nexus-download-destination/root.json") }
  private func failure() -> NSError { NSError(domain: "NexusDownloadDestination", code: 1, userInfo: [NSLocalizedDescriptionKey: "保存目录不可用，请重新授权或重试；原音频保留"]) }
  private func read() throws -> Root? {
    guard fm.fileExists(atPath: registry.path) else { return nil }
    let data = try Data(contentsOf: registry); guard data.count <= 1024 * 1024 else { throw failure() }
    let root = try JSONDecoder().decode(Root.self, from: data); guard UUID(uuidString: root.id) != nil else { throw failure() }; return root
  }
  private func write(_ root: Root) throws {
    var parent = registry.deletingLastPathComponent(); try fm.createDirectory(at: parent, withIntermediateDirectories: true)
    var values = URLResourceValues(); values.isExcludedFromBackup = true; try parent.setResourceValues(values)
    try JSONEncoder().encode(root).write(to: registry, options: .atomic)
    #if os(iOS)
    try fm.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: registry.path)
    #endif
  }
  private func resolve(_ root: Root) throws -> URL {
    var stale = false
    let url = try URL(resolvingBookmarkData: root.bookmark, options: .withoutUI, relativeTo: nil, bookmarkDataIsStale: &stale)
    guard !stale, url.isFileURL else { throw failure() }; return url
  }
  func status() throws -> [String: String]? { lock.lock(); defer { lock.unlock() }; guard let root = try read() else { return nil }; return ["id": root.id, "name": root.name] }
  func register(_ url: URL) throws -> [String: String] {
    lock.lock(); defer { lock.unlock() }
    let access = url.startAccessingSecurityScopedResource(); defer { if access { url.stopAccessingSecurityScopedResource() } }
    let values = try url.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey]); guard url.isFileURL, values.isDirectory == true, values.isSymbolicLink != true else { throw failure() }
    let probe = url.appendingPathComponent(".nexus-access-" + UUID().uuidString)
    try Data().write(to: probe, options: .withoutOverwriting); try fm.removeItem(at: probe)
    let root = Root(id: UUID().uuidString, name: url.lastPathComponent, bookmark: try url.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil))
    try write(root); return ["id": root.id, "name": root.name]
  }
  func forget(_ expected: String) throws {
    lock.lock(); defer { lock.unlock() }; guard let root = try read(), root.id == expected else { return }; try fm.removeItem(at: registry)
  }
  private func hash(_ url: URL) throws -> String {
    let handle = try FileHandle(forReadingFrom: url); defer { try? handle.close() }; var digest = Insecure.MD5()
    while let data = try handle.read(upToCount: 256 * 1024), !data.isEmpty { digest.update(data: data) }
    return digest.finalize().map { String(format: "%02x", $0) }.joined()
  }
  private func copyBytes(_ source: URL, to target: URL) throws {
    let reader = try FileHandle(forReadingFrom: source); defer { try? reader.close() }
    let writer = try FileHandle(forWritingTo: target); defer { try? writer.close() }
    while let data = try reader.read(upToCount: 256 * 1024), !data.isEmpty { try writer.write(contentsOf: data) }
    try writer.synchronize()
  }
  private func matches(_ entry: Entry, at directory: URL) -> Bool {
    let file = directory.appendingPathComponent(entry.name)
    guard let info = try? file.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey]), info.isRegularFile == true, info.isSymbolicLink != true, info.fileSize == entry.bytes else { return false }
    return (try? hash(file)) == entry.md5
  }
  private func safeName(_ value: String) -> Bool { !value.isEmpty && value.utf8.count <= 240 && !value.hasPrefix(".") && !value.contains("/") && !value.contains("\\") && !value.unicodeScalars.contains { CharacterSet.controlCharacters.contains($0) } }
  /// Flat groups use one collision suffix, and never overwrite user files.
  /// A bounded private transaction receipt permits recovery after a crash.
  func save(_ values: [String], expected: String, job: String) throws -> [String] {
    guard UUID(uuidString: job) != nil else { throw failure() }
    let root: Root = try { lock.lock(); defer { lock.unlock() }; guard let value = try read(), value.id == expected else { throw failure() }; return value }()
    let source = try AudioExportStaging.files(values), directory = try resolve(root), access = directory.startAccessingSecurityScopedResource()
    defer { if access { directory.stopAccessingSecurityScopedResource() } }
    let info = try directory.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey]); guard info.isDirectory == true, info.isSymbolicLink != true else { throw failure() }
    let inputs = try source.map { url -> Entry in guard safeName(url.lastPathComponent), let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize else { throw failure() }; return Entry(name: url.lastPathComponent, bytes: size, md5: try hash(url)) }
    let receipts = registry.deletingLastPathComponent().appendingPathComponent("transactions"); try fm.createDirectory(at: receipts, withIntermediateDirectories: true)
    let marker = receipts.appendingPathComponent(expected.lowercased() + "-" + job.lowercased() + ".json")
    var result: [String] = []; var operationError: Error?
    let coordinator = NSFileCoordinator(filePresenter: nil); var coordinationError: NSError?
    coordinator.coordinate(writingItemAt: directory, options: .forMerging, error: &coordinationError) { coordinated in
      do {
        var entries: [Entry] = []
        if fm.fileExists(atPath: marker.path) {
          let data = try Data(contentsOf: marker); guard data.count < 65536 else { throw failure() }
          let old = try JSONDecoder().decode(Transaction.self, from: data)
          guard old.version == 1, old.destination == expected, old.job == job, old.files.count == inputs.count,
                zip(old.files, inputs).allSatisfy({ safeName($0.0.name) && $0.0.bytes == $0.1.bytes && $0.0.md5 == $0.1.md5 }) else { throw failure() }
          if old.files.allSatisfy({ matches($0, at: coordinated) }) { result = old.files.map { $0.name }; return }
          // Resume missing members without removing or replacing any user copy.
          guard old.files.allSatisfy({ !fm.fileExists(atPath: coordinated.appendingPathComponent($0.name).path) || matches($0, at: coordinated) }) else { throw failure() }
          entries = old.files
        }
        if entries.isEmpty { for attempt in 0..<1000 {
          let suffix = attempt == 0 ? "" : " (\(attempt + 1))"
          entries = inputs.map { entry in
            let url = URL(fileURLWithPath: entry.name), ext = url.pathExtension, stem = url.deletingPathExtension().lastPathComponent
            // meta.json keeps the same audio stem rather than suffixing meta.
            let base = entry.name.hasSuffix(".meta.json") ? String(entry.name.dropLast(10)) : stem
            let ending = entry.name.hasSuffix(".meta.json") ? "meta.json" : ext
            return Entry(name: base + suffix + "." + ending, bytes: entry.bytes, md5: entry.md5)
          }
          guard entries.allSatisfy({ safeName($0.name) }) else { throw failure() }
          if entries.allSatisfy({ !fm.fileExists(atPath: coordinated.appendingPathComponent($0.name).path) }) { break }
          if attempt == 999 { throw failure() }
        }
        }
        if !fm.fileExists(atPath: marker.path) {
          let transaction = Transaction(version: 1, destination: expected, job: job, files: entries)
          try JSONEncoder().encode(transaction).write(to: marker, options: .withoutOverwriting)
        }
        var ownedTemporary: [URL] = []
        do {
          for (index, entry) in entries.enumerated() {
            if matches(entry, at: coordinated) { continue }
            let target = coordinated.appendingPathComponent(entry.name), temporary = coordinated.appendingPathComponent(".nexus-part-" + UUID().uuidString.lowercased())
            // Exclusive creation establishes ownership; a matching prefix does not.
            try Data().write(to: temporary, options: .withoutOverwriting)
            ownedTemporary.append(temporary)
            try copyBytes(source[index], to: temporary)
            let staged = Entry(name: temporary.lastPathComponent, bytes: entry.bytes, md5: entry.md5)
            guard matches(staged, at: coordinated) else { throw failure() }
            try fm.moveItem(at: temporary, to: target)
            ownedTemporary.removeAll { $0 == temporary }
            guard matches(entry, at: coordinated) else { throw failure() }
          }
        } catch {
          for temporary in ownedTemporary { try? fm.removeItem(at: temporary) }
          throw error
        }
        // The private receipt allows retry after a crash. Published user files
        // are never deleted, including when another member failed to copy.
        result = entries.map { $0.name }
      } catch { operationError = error }
    }
    if coordinationError != nil || operationError != nil || result.count != source.count { throw failure() }; return result
  }
}
