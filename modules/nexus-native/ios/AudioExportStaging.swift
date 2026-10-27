import Foundation
import ImageIO
import UniformTypeIdentifiers

/// Only the app's dedicated temporary export directory may enter a system export.
enum AudioExportStaging {
  static func stageURL(_ value: String, cache: URL = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]) throws -> URL {
    guard let input = URL(string: value), input.isFileURL, input.host == nil || input.host == "" || input.host == "localhost", input.query == nil, input.fragment == nil else { throw failure() }
    let url = input.standardizedFileURL.resolvingSymlinksInPath(), root = cache.standardizedFileURL.resolvingSymlinksInPath(), parent = url.deletingLastPathComponent()
    guard parent.deletingLastPathComponent() == root, parent.lastPathComponent.range(of: "^nexus-audio-export-[a-fA-F0-9-]{36}$", options: .regularExpression) != nil,
          !url.lastPathComponent.hasPrefix("."), url.lastPathComponent.utf8.count <= 240 else { throw failure() }
    return url
  }
  static func files(_ values: [String]) throws -> [URL] {
    guard (1...4).contains(values.count), Set(values).count == values.count else { throw failure() }
    let urls = try values.map { try stageURL($0) }
    guard Set(urls).count == urls.count, Set(urls.map { $0.deletingLastPathComponent() }).count == 1 else { throw failure() }
    for url in urls {
      let info = try url.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey])
      guard info.isRegularFile == true, let size = info.fileSize, size > 0, size <= 2 * 1024 * 1024 * 1024,
            ["mp3","m4a","aac","flac","wav","aiff","ogg","lrc","jpg","json"].contains(url.pathExtension.lowercased()) else { throw failure() }
    }
    return urls
  }
  static func jpeg(_ input: String, target: String, maxPixelSize: Int = 512) throws -> String {
    guard [256,500,512,1000,1024,1200,2048].contains(maxPixelSize) else { throw failure() }
    let output = try stageURL(target)
    guard output.pathExtension == "jpg", !FileManager.default.fileExists(atPath: output.path), let inputURL = URL(string: input), inputURL.isFileURL, inputURL.host == nil || inputURL.host == "" || inputURL.host == "localhost", inputURL.query == nil, inputURL.fragment == nil else { throw failure() }
    let sourceURL = inputURL.standardizedFileURL.resolvingSymlinksInPath()
    let roots = [FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0], FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]].map { $0.standardizedFileURL.resolvingSymlinksInPath().path + "/" }
    guard roots.contains(where: { sourceURL.path.hasPrefix($0) }), let size = try sourceURL.resourceValues(forKeys: [.fileSizeKey]).fileSize, size > 0, size <= 8 * 1024 * 1024,
          let source = CGImageSourceCreateWithURL(sourceURL as CFURL, [kCGImageSourceShouldCache: false] as CFDictionary),
          let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
          let width = properties[kCGImagePropertyPixelWidth] as? Int, let height = properties[kCGImagePropertyPixelHeight] as? Int, width > 0, height > 0, width <= 16384, height <= 16384, width * height <= 16777216,
          let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true, kCGImageSourceThumbnailMaxPixelSize: min(maxPixelSize, max(width, height))] as CFDictionary) else { throw failure() }
    let data = NSMutableData()
    guard let destination = CGImageDestinationCreateWithData(data, UTType.jpeg.identifier as CFString, 1, nil) else { throw failure() }
    CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: 0.85] as CFDictionary)
    guard CGImageDestinationFinalize(destination), data.length > 0, data.length < 2 * 1024 * 1024 else { throw failure() }
    try (data as Data).write(to: output, options: .atomic)
    return output.absoluteString
  }
  private static func failure() -> NSError { NSError(domain: "NexusAudioExport", code: 1, userInfo: [NSLocalizedDescriptionKey: "附加文件未能准备，请重试"]) }
}
