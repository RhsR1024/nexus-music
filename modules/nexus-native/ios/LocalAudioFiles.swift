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
    return ["id": id, "extension": ext, "bytes": size, "durationMs": duration * 1000, "title": title, "artist": artist, "album": album, "lyric": lyric, "created": created]
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
