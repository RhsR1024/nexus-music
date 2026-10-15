import Foundation

// Audio bytes only. Keys are SHA256 of logical identity, never authentication URLs.
// Partial files are private to a loader and never exposed as playable cache hits.
final class AudioCache {
  static let shared = AudioCache()
  private let lock = NSRecursiveLock()
  private let directory: URL
  private var limit: Int64 = 256 * 1024 * 1024
  private static let suffixes = ["wav", "mp3", "flac", "m4a", "aac", "aiff", "audio"]
  private var epoch = 0
  private var active: [String: Int] = [:]
  init(directory: URL? = nil) {
    self.directory = directory ?? FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("NexusAudio", isDirectory: true)
    try? FileManager.default.createDirectory(at: self.directory, withIntermediateDirectories: true)
    // Crash leftovers cannot be promoted or resumed as complete audio.
    for file in files() where file.pathExtension == "part" { try? FileManager.default.removeItem(at: file) }
  }
  private func valid(_ key: String) -> Bool { key.count == 64 && key.allSatisfy { $0.isHexDigit && !$0.isUppercase } }
  private func files() -> [URL] { (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: [.fileSizeKey, .contentModificationDateKey])) ?? [] }
  private func size(_ file: URL) -> Int64 { Int64((try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0) }
  func retain(_ key: String) { lock.lock(); defer { lock.unlock() }; if valid(key) { active[key, default: 0] += 1 } }
  func release(_ key: String) { lock.lock(); defer { lock.unlock() }; active[key] = max(0, (active[key] ?? 0) - 1); trim() }
  func hit(_ key: String) -> URL? {
    lock.lock(); defer { lock.unlock() }; guard valid(key) else { return nil }
    guard let file = Self.suffixes.map({ directory.appendingPathComponent(key + "." + $0) }).first(where: { size($0) > 0 }) else { return nil }
    try? FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: file.path); return file
  }
  func invalidate(_ key: String) { lock.lock(); defer { lock.unlock() }; epoch += 1; if valid(key) { for suffix in Self.suffixes { try? FileManager.default.removeItem(at: directory.appendingPathComponent(key + "." + suffix)) } } }
  func configure(megabytes: Int) { lock.lock(); defer { lock.unlock() }; limit = Int64(min(2048, max(32, megabytes))) * 1048576; trim() }
  func clear() {
    lock.lock(); defer { lock.unlock() }; epoch += 1
    for file in files() where (active[file.deletingPathExtension().lastPathComponent] ?? 0) == 0 && file.pathExtension != "part" { try? FileManager.default.removeItem(at: file) }
  }
  func statistics() -> [String: Any] {
    lock.lock(); defer { lock.unlock() }; let complete = files().filter { Self.suffixes.contains($0.pathExtension) }
    return ["bytes": complete.reduce(Int64(0)) { $0 + size($1) }, "files": complete.count, "limitBytes": limit]
  }
  private func trim() {
    let complete = files().filter { Self.suffixes.contains($0.pathExtension) }.sorted { ((try? $0.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast) < ((try? $1.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast) }
    var total = complete.reduce(Int64(0)) { $0 + size($1) }
    for file in complete where total > limit && (active[file.deletingPathExtension().lastPathComponent] ?? 0) == 0 { let bytes = size(file); if (try? FileManager.default.removeItem(at: file)) != nil { total -= bytes } }
  }
  func writer(_ key: String) -> Writer? {
    lock.lock(); defer { lock.unlock() }; guard valid(key), hit(key) == nil else { return nil }
    let file = directory.appendingPathComponent(UUID().uuidString + ".part")
    guard FileManager.default.createFile(atPath: file.path, contents: nil), let handle = try? FileHandle(forWritingTo: file) else { return nil }
    return Writer(cache: self, key: key, file: file, handle: handle, epoch: epoch)
  }
  final class Writer {
    private let cache: AudioCache, key: String, file: URL, handle: FileHandle, epoch: Int
    private var ranges: [Range<Int64>] = [], total: Int64 = 0
    private var ended = false
    private var suffix = "audio"
    fileprivate init(cache: AudioCache, key: String, file: URL, handle: FileHandle, epoch: Int) { self.cache = cache; self.key = key; self.file = file; self.handle = handle; self.epoch = epoch }
    // Called only on one loader's serial queue; cache lock protects cross-loader quota/clear.
    func write(_ data: Data, offset: Int64, total length: Int64, mime: String? = nil) {
      cache.lock.lock(); defer { cache.lock.unlock() }
      guard !ended, epoch == cache.epoch, length > 0, length <= cache.limit, offset >= 0, offset <= length, Int64(data.count) <= length-offset, total == 0 || total == length else { cancel(); return }
      if let mime {
        let formats = ["audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav", "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/flac": "flac", "audio/x-flac": "flac", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/aac": "aac", "audio/aiff": "aiff"]
        suffix = formats[mime.lowercased()] ?? "audio"
      }
      total = length
      do { try handle.seek(toOffset: UInt64(offset)); try handle.write(contentsOf: data) } catch { cancel(); return }
      ranges.append(offset..<(offset+Int64(data.count))); ranges.sort { $0.lowerBound < $1.lowerBound }
      var merged: [Range<Int64>] = []
      for range in ranges { if let last = merged.last, last.upperBound >= range.lowerBound { merged[merged.count-1] = last.lowerBound..<max(last.upperBound, range.upperBound) } else { merged.append(range) } }
      ranges = merged; if ranges.count > 2048 { cancel(); return }
      if ranges.count == 1 && ranges[0] == 0..<total {
        do {
          try handle.synchronize(); try handle.close(); ended = true
          let destination = cache.directory.appendingPathComponent(key + "." + suffix)
          if !FileManager.default.fileExists(atPath: destination.path) { try FileManager.default.moveItem(at: file, to: destination) }
          else { try? FileManager.default.removeItem(at: file) }
          cache.trim()
        } catch { cancel() }
      }
    }
    func cancel() { if !ended { ended = true; try? handle.close() }; try? FileManager.default.removeItem(at: file) }
    deinit { cancel() }
  }
}
