import Foundation
import ImageIO
import UniformTypeIdentifiers

final class CoverCache {
  static let queue = DispatchQueue(label: "nexus.covers")
  static let shared = CoverCache()
  private(set) var epoch = 0
  private let maximumBytes: Int
  private let directory: URL
  init(directory: URL? = nil, maximumBytes: Int = 32 * 1024 * 1024) {
    self.maximumBytes = maximumBytes
    self.directory = directory ?? FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("NexusCovers", isDirectory: true)
    try? FileManager.default.createDirectory(at: self.directory, withIntermediateDirectories: true)
  }
  private func valid(_ key: String) -> Bool { key.count == 64 && key.allSatisfy { $0.isHexDigit && !$0.isUppercase } }
  private func files() -> [URL] { (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: [.fileSizeKey, .contentModificationDateKey])) ?? [] }
  func hit(_ key: String) -> String? {
    guard valid(key) else { return nil }
    let file = directory.appendingPathComponent(key + ".jpg")
    guard FileManager.default.fileExists(atPath: file.path) else { return nil }
    // Existing caches predate the store guard. Validate hits too, so an upgrade
    // cannot hand an old tracking pixel or damaged file back to RN's blur path.
    guard let source = CGImageSourceCreateWithURL(file as CFURL, [kCGImageSourceShouldCache: false] as CFDictionary),
          let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
          let width = properties[kCGImagePropertyPixelWidth] as? Int,
          let height = properties[kCGImagePropertyPixelHeight] as? Int,
          width >= 48, height >= 48 else {
      try? FileManager.default.removeItem(at: file); return nil
    }
    try? FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: file.path)
    return file.absoluteString
  }
  func store(_ data: Data, key: String, maxPixelSize: Int = 512, exporting: Bool = false) -> String? {
    guard (exporting ? [256,500,512,1000,1024,1200,2048] : [512,1024]).contains(maxPixelSize), valid(key), data.count <= 8 * 1024 * 1024,
          let source = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary),
          let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
          let width = properties[kCGImagePropertyPixelWidth] as? Int, let height = properties[kCGImagePropertyPixelHeight] as? Int,
          !exporting || (width > 0 && height > 0 && width <= 16384 && height <= 16384 && width * height <= 16777216),
          let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true, kCGImageSourceThumbnailMaxPixelSize: exporting ? min(maxPixelSize,max(width,height)) : maxPixelSize] as CFDictionary) else { return nil }
    // Degenerate CDN payloads (tracking pixels, broken covers) decode to tiny
    // bitmaps; RN's box blur (kernel up to ~51 at radius 55) segmentation
    // faults on images smaller than the kernel, so reject anything below real
    // cover resolution and let the placeholder render instead.
    guard image.width >= 48, image.height >= 48 else { return nil }
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
    for file in files where size > maximumBytes {
      let bytes = (try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
      if (try? FileManager.default.removeItem(at: file)) != nil { size -= bytes }
    }
  }
}
