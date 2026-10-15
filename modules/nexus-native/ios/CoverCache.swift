import Foundation
import ImageIO
import UniformTypeIdentifiers

final class CoverCache {
  private(set) var epoch = 0
  private let directory: URL
  init(directory: URL? = nil) {
    self.directory = directory ?? FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("NexusCovers", isDirectory: true)
    try? FileManager.default.createDirectory(at: self.directory, withIntermediateDirectories: true)
  }
  private func valid(_ key: String) -> Bool { key.count == 64 && key.allSatisfy { $0.isHexDigit && !$0.isUppercase } }
  private func files() -> [URL] { (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: [.fileSizeKey, .contentModificationDateKey])) ?? [] }
  func hit(_ key: String) -> String? {
    guard valid(key) else { return nil }
    let file = directory.appendingPathComponent(key + ".jpg")
    guard FileManager.default.fileExists(atPath: file.path) else { return nil }
    try? FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: file.path)
    return file.absoluteString
  }
  func store(_ data: Data, key: String) -> String? {
    guard valid(key), data.count <= 8 * 1024 * 1024,
          let source = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary),
          let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true, kCGImageSourceThumbnailMaxPixelSize: 512] as CFDictionary) else { return nil }
    let output = NSMutableData()
    guard let destination = CGImageDestinationCreateWithData(output, UTType.jpeg.identifier as CFString, 1, nil) else { return nil }
    CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: 0.85] as CFDictionary)
    guard CGImageDestinationFinalize(destination) else { return nil }
    let file = directory.appendingPathComponent(key + ".jpg")
    do { try (output as Data).write(to: file, options: .atomic) } catch { return nil }
    trim(); return file.absoluteString
  }
  func clear() { epoch += 1; for file in files() { try? FileManager.default.removeItem(at: file) } }
  func statistics() -> [String: Any] {
    let files = files(); return ["files": files.count, "bytes": files.reduce(0) { $0 + ((try? $1.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0) }]
  }
  private func trim() {
    let files = files().sorted { ((try? $0.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast) < ((try? $1.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast) }
    var size = files.reduce(0) { $0 + ((try? $1.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0) }
    for file in files where size > 32 * 1024 * 1024 {
      let bytes = (try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
      if (try? FileManager.default.removeItem(at: file)) != nil { size -= bytes }
    }
  }
}
