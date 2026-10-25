import Foundation
import AVFoundation
import CryptoKit
import ImageIO
import UniformTypeIdentifiers

final class LocalAudioFiles {
  static let shared = LocalAudioFiles()
  private let root: URL
  private let fm = FileManager.default
  private let lock = NSLock()
  private var active: [String: Int] = [:]
  private let extensions: Set<String> = ["mp3", "flac", "aac", "m4a", "wav", "aiff", "aif"]
  init(root: URL? = nil) {
    self.root = root ?? FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("nexus-audio", isDirectory: true)
  }
  private func failure(_ message: String) -> NSError { NSError(domain: "NexusLocalAudio", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
  private func file(_ id: String, _ ext: String) throws -> URL {
    guard id.count == 64, id.allSatisfy({ $0.isHexDigit && !$0.isUppercase }), extensions.contains(ext) else { throw failure("本地文件标识无效") }
    return root.appendingPathComponent(id + "." + ext)
  }
  func resolve(_ id: String, _ ext: String) throws -> String {
    let url = try file(id, ext)
    guard fm.fileExists(atPath: url.path), (try url.resourceValues(forKeys: [.isSymbolicLinkKey])).isSymbolicLink != true else { throw failure("本地音频已缺失，请重新导入") }
    return url.absoluteString
  }
  func artwork(_ id: String) -> String? {
    guard id.count == 64, id.allSatisfy({ $0.isHexDigit && !$0.isUppercase }) else { return nil }
    let url = root.appendingPathComponent(id + ".jpg"); return fm.fileExists(atPath: url.path) ? url.absoluteString : nil
  }
  func retain(_ url: URL) -> Bool {
    guard url.isFileURL, url.standardizedFileURL.deletingLastPathComponent() == root.standardizedFileURL else { return false }
    lock.lock(); active[url.lastPathComponent, default: 0] += 1; lock.unlock(); return true
  }
  func release(_ url: URL) {
    lock.lock(); defer { lock.unlock() }
    if let count = active[url.lastPathComponent], count > 1 { active[url.lastPathComponent] = count - 1 } else { active.removeValue(forKey: url.lastPathComponent) }
  }
  func remove(_ id: String, _ ext: String) throws {
    let url = try file(id, ext)
    lock.lock(); defer { lock.unlock() }
    guard active[url.lastPathComponent] == nil else { throw failure("正在使用的音频不能删除") }
    if fm.fileExists(atPath: url.path) { try fm.removeItem(at: url) }
    // Cover files are content-addressed too, and are only removed with the audio.
    if !extensions.contains(where: { fm.fileExists(atPath: root.appendingPathComponent(id + "." + $0).path) }) {
      let cover = root.appendingPathComponent(id + ".jpg"); try? fm.removeItem(at: cover)
    }
  }
  func beginRemoval(_ id: String, _ ext: String) throws -> String {
    let source = try file(id, ext)
    lock.lock(); defer { lock.unlock() }
    guard active[source.lastPathComponent] == nil else { throw failure("正在使用的音频不能删除") }
    let directory = root.appendingPathComponent(".pending-delete", isDirectory: true)
    try fm.createDirectory(at: directory, withIntermediateDirectories: true)
    let token = UUID().uuidString
    let journal = directory.appendingPathComponent(token + ".json")
    try JSONSerialization.data(withJSONObject: ["id": id, "extension": ext]).write(to: journal, options: .atomic)
    do { if fm.fileExists(atPath: source.path) { try fm.moveItem(at: source, to: directory.appendingPathComponent(token + ".audio")) } }
    catch { try? fm.removeItem(at: journal); throw error }
    return token
  }
  func finishRemoval(_ token: String, restore: Bool) throws {
    guard UUID(uuidString: token) != nil else { throw failure("删除事务无效") }
    let directory = root.appendingPathComponent(".pending-delete", isDirectory: true)
    let journal = directory.appendingPathComponent(token + ".json"), staged = directory.appendingPathComponent(token + ".audio")
    guard let raw = try JSONSerialization.jsonObject(with: Data(contentsOf: journal)) as? [String: String], let id = raw["id"], let ext = raw["extension"] else { throw failure("删除事务无法恢复") }
    let original = try file(id, ext)
    if fm.fileExists(atPath: staged.path) {
      if restore { try fm.moveItem(at: staged, to: original) } else { try fm.removeItem(at: staged) }
    }
    if !restore && !extensions.contains(where: { fm.fileExists(atPath: root.appendingPathComponent(id + "." + $0).path) }) { try? fm.removeItem(at: root.appendingPathComponent(id + ".jpg")) }
    try fm.removeItem(at: journal)
  }
  func reconcile(_ files: [[String: String]]) throws {
    let directory = root.appendingPathComponent(".pending-delete", isDirectory: true)
    guard fm.fileExists(atPath: directory.path) else { return }
    let keep = Set(files.compactMap { row -> String? in guard let id = row["id"], let ext = row["extension"], let url = try? file(id, ext) else { return nil }; return url.lastPathComponent })
    for journal in try fm.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil).filter({ $0.pathExtension == "json" }).prefix(1000) {
      guard let raw = try JSONSerialization.jsonObject(with: Data(contentsOf: journal)) as? [String: String], let id = raw["id"], let ext = raw["extension"] else { throw failure("有删除事务需要恢复，请保留文件") }
      try finishRemoval(journal.deletingPathExtension().lastPathComponent, restore: keep.contains(try file(id, ext).lastPathComponent))
    }
  }
  func importFile(_ uri: String, name: String) async throws -> [String: Any] {
    guard let input = URL(string: uri), input.isFileURL else { throw failure("请选择本地音频文件") }
    let ext = (name as NSString).pathExtension.lowercased()
    guard extensions.contains(ext) else { throw failure("支持 MP3、FLAC、AAC、M4A、WAV、AIFF") }
    let access = input.startAccessingSecurityScopedResource(); defer { if access { input.stopAccessingSecurityScopedResource() } }
    let values = try input.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey, .isSymbolicLinkKey])
    guard values.isRegularFile == true, values.isSymbolicLink != true, let size = values.fileSize, size > 0, size <= 1024 * 1024 * 1024 else { throw failure("文件无效或超过1GiB") }
    try fm.createDirectory(at: root, withIntermediateDirectories: true)
    let temporary = root.appendingPathComponent("import-" + UUID().uuidString + "." + ext)
    defer { try? fm.removeItem(at: temporary) }
    try fm.copyItem(at: input, to: temporary)
    var digest = SHA256(); let reader = try FileHandle(forReadingFrom: temporary); defer { try? reader.close() }
    while let data = try reader.read(upToCount: 1024 * 1024), !data.isEmpty { digest.update(data: data) }
    let id = digest.finalize().map { String(format: "%02x", $0) }.joined()
    let asset = AVURLAsset(url: temporary)
    guard try await asset.load(.isPlayable), !(try await asset.loadTracks(withMediaType: .audio)).isEmpty else { throw failure("文件不能作为音频播放") }
    let duration = try await asset.load(.duration).seconds
    guard duration.isFinite, duration > 0 else { throw failure("音频时长无效") }
    let metadata = try await asset.load(.metadata), common = try await asset.load(.commonMetadata)
    var title = ((name as NSString).lastPathComponent as NSString).deletingPathExtension, artist = "未知艺术家", album = "", lyric = "", image: Data?
    for item in common {
      if item.commonKey == .commonKeyArtwork, let data = try? await item.load(.dataValue), data.count <= 8 * 1024 * 1024 { image = data; continue }
      guard let text = try? await item.load(.stringValue), !text.isEmpty, text.utf8.count < 16384 else { continue }
      switch item.commonKey {
      case .commonKeyTitle: title = text
      case .commonKeyArtist: artist = text
      case .commonKeyAlbumName: album = text
      default: break
      }
    }
    for item in metadata {
      let identifier = item.identifier?.rawValue ?? ""
      if identifier.contains("USLT") || identifier.contains("©lyr") || identifier.lowercased().contains("lyrics") {
        if let text = try? await item.load(.stringValue), text.utf8.count <= 2097152 { lyric = text; break }
      }
    }
    let destination = try file(id, ext), created = !fm.fileExists(atPath: destination.path)
    if created { try fm.moveItem(at: temporary, to: destination) }
    if let image { saveCover(image, id: id) }
    var result: [String: Any] = ["id": id, "extension": ext, "bytes": size, "durationMs": duration * 1000, "title": title, "artist": artist, "album": album, "lyric": lyric, "created": created]
    if let modified = try? input.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate {
      let milliseconds = modified.timeIntervalSince1970 * 1000
      if milliseconds.isFinite && milliseconds >= 0 { result["modifiedAt"] = milliseconds }
    }
    return result
  }
  private func saveCover(_ data: Data, id: String) {
    guard let source = CGImageSourceCreateWithData(data as CFData, nil),
          let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceThumbnailMaxPixelSize: 512, kCGImageSourceCreateThumbnailWithTransform: true] as CFDictionary) else { return }
    let output = NSMutableData()
    guard let target = CGImageDestinationCreateWithData(output, UTType.jpeg.identifier as CFString, 1, nil) else { return }
    CGImageDestinationAddImage(target, image, [kCGImageDestinationLossyCompressionQuality: 0.82] as CFDictionary)
    if CGImageDestinationFinalize(target), output.length < 2 * 1024 * 1024 { try? (output as Data).write(to: root.appendingPathComponent(id + ".jpg"), options: .atomic) }
  }
}

// Only opaque root IDs and relative locations cross the JS boundary. Bookmarks
// stay in local, backup-excluded native storage and are opened only for a scan.
final class LocalAudioFolders {
  struct Root: Codable { let id: String; let name: String; let bookmark: Data }
  static let shared = LocalAudioFolders(files: .shared)
  private let files: LocalAudioFiles
  private let registry: URL
  private let fm = FileManager.default
  private let lock = NSLock()
  init(files: LocalAudioFiles, registry: URL? = nil) {
    self.files = files
    self.registry = registry ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("nexus-audio-folders/roots.json")
  }
  private func failure(_ message: String) -> NSError { NSError(domain: "NexusAudioFolders", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
  private func read() throws -> [Root] {
    guard fm.fileExists(atPath: registry.path) else { return [] }
    let data = try Data(contentsOf: registry)
    do {
      guard data.count < 4 * 1024 * 1024 else { throw failure("文件夹授权记录无效，请重新授权") }
      let roots = try JSONDecoder().decode([Root].self, from: data)
      guard roots.count <= 64 else { throw failure("文件夹授权记录无效") }
      return roots
    } catch {
      // Preserve malformed bookmarks for recovery, separate from the valid
      // owned-audio index. The user can reselect a source directory.
      try fm.moveItem(at: registry, to: registry.deletingLastPathComponent().appendingPathComponent("roots-corrupt-" + UUID().uuidString + ".json"))
      return []
    }
  }
  private func write(_ roots: [Root]) throws {
    var directory = registry.deletingLastPathComponent()
    try fm.createDirectory(at: directory, withIntermediateDirectories: true)
    var values = URLResourceValues(); values.isExcludedFromBackup = true; try directory.setResourceValues(values)
    try JSONEncoder().encode(roots).write(to: registry, options: .atomic)
    #if os(iOS)
    try fm.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: registry.path)
    #endif
  }
  private func resolve(_ root: Root) throws -> URL {
    var stale = false
    let url = try URL(resolvingBookmarkData: root.bookmark, options: .withoutUI, relativeTo: nil, bookmarkDataIsStale: &stale)
    guard !stale else { throw failure("文件夹授权已过期，请移除后重新添加文件夹") }
    return url
  }
  func register(_ url: URL) throws -> [String: String] {
    let access = url.startAccessingSecurityScopedResource(); defer { if access { url.stopAccessingSecurityScopedResource() } }
    let values = try url.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
    guard url.isFileURL, values.isDirectory == true, values.isSymbolicLink != true else { throw failure("请选择可读取的文件夹") }
    lock.lock(); defer { lock.unlock() }
    var roots = try read()
    let existing = roots.first { (try? resolve($0).standardizedFileURL.path) == url.standardizedFileURL.path }
    guard roots.count < 64 || existing != nil else { throw failure("授权目录过多，请移除不再使用的目录后重启") }
    let root = Root(id: existing?.id ?? UUID().uuidString, name: url.lastPathComponent, bookmark: try url.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil))
    roots.removeAll { $0.id == root.id }; roots.append(root); try write(roots)
    return ["id": root.id, "name": root.name]
  }
  func retainRoots(_ ids: [String]) throws {
    lock.lock(); defer { lock.unlock() }; try write(read().filter { ids.contains($0.id) })
  }
  func scan(_ ids: [String], recursive: [String], blocked: [String], minimumSeconds: Double) async throws -> [String: Any] {
    guard ids.count <= 32, Set(ids).count == ids.count, minimumSeconds.isFinite, minimumSeconds >= 0, minimumSeconds <= 86400 else { throw failure("扫描设置无效") }
    if ids.isEmpty { return ["files": [[String: Any]](), "folders": [[String: String]](), "failed": [[String: String]]()] }
    let roots = try read()
    var output: [[String: Any]] = [], folders: [[String: String]] = [], failed: [[String: String]] = [], created: [(String, String)] = []
    var inspected = 0
    do {
      for id in ids {
        guard let root = roots.first(where: { $0.id == id }) else { throw failure("文件夹授权已缺失，请重新添加") }
        let url = try resolve(root), access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        guard (try url.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])).isDirectory == true, (try url.resourceValues(forKeys: [.isSymbolicLinkKey])).isSymbolicLink != true else { throw failure("文件夹不可用，原索引保留") }
        folders.append(["rootId": id, "rootName": root.name, "path": ""])
        if blocked.contains(id + "/") { continue }
        var enumerationFailed = false
        guard let enumerator = fm.enumerator(at: url, includingPropertiesForKeys: [.isDirectoryKey, .isRegularFileKey, .isSymbolicLinkKey], options: [.skipsHiddenFiles, .skipsPackageDescendants], errorHandler: { _, _ in enumerationFailed = true; return false }) else { throw failure("无法读取文件夹，原索引保留") }
        while let child = enumerator.nextObject() as? URL {
          inspected += 1; guard inspected <= 50000 else { throw failure("扫描文件过多，请缩小授权范围") }
          let values = try child.resourceValues(forKeys: [.isDirectoryKey, .isRegularFileKey, .isSymbolicLinkKey])
          // DirectoryEnumerator does not follow symbolic links. Calling
          // skipDescendants on a link file would skip the next real directory.
          if values.isSymbolicLink == true { continue }
          let relative = String(child.path.dropFirst(url.path.count + (url.path.hasSuffix("/") ? 0 : 1)))
          guard !relative.split(separator: "/").contains("..") else { throw failure("目录路径无效") }
          let key = id + "/" + relative
          if values.isDirectory == true {
            folders.append(["rootId": id, "rootName": root.name, "path": relative])
            if !recursive.contains(id) || blocked.contains(where: { key == $0 || key.hasPrefix($0 + "/") }) { enumerator.skipDescendants() }
            continue
          }
          if blocked.contains(where: { key == $0 || key.hasPrefix($0 + "/") }) { continue }
          guard values.isRegularFile == true, ["mp3", "flac", "aac", "m4a", "wav", "aiff", "aif"].contains(child.pathExtension.lowercased()) else { continue }
          let path = (relative as NSString).deletingLastPathComponent
          let location = ["rootId": id, "rootName": root.name, "path": path, "fileName": child.lastPathComponent]
          do {
            let duration = try await AVURLAsset(url: child).load(.duration).seconds
            if duration.isFinite && duration < minimumSeconds { continue }
            var result = try await files.importFile(child.absoluteString, name: child.lastPathComponent)
            if result["created"] as? Bool == true, let fileID = result["id"] as? String, let ext = result["extension"] as? String { created.append((fileID, ext)) }
            result["location"] = location; output.append(result)
          } catch { failed.append(location) }
          guard output.count <= 10000 else { throw failure("本地曲库最多10000首") }
        }
        if enumerationFailed { throw failure("目录读取中断，原索引保留，请检查授权或云盘连接") }
      }
      return ["files": output, "folders": folders, "failed": failed]
    } catch {
      for (id, ext) in created { try? files.remove(id, ext) }
      throw error
    }
  }
}
