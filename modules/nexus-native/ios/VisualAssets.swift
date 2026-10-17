import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
import CryptoKit

final class VisualAssets {
  static let shared = VisualAssets()
  private let fm = FileManager.default
  private let root: URL
  private let allowed: [URL]
  init(root: URL? = nil, allowed: [URL]? = nil) {
    let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    self.root = root ?? documents.appendingPathComponent("nexus-visuals", isDirectory: true)
    self.allowed = allowed ?? [documents, FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]]
  }
  private func failure(_ text: String) -> NSError { NSError(domain: "NexusVisualAssets", code: 1, userInfo: [NSLocalizedDescriptionKey: text]) }
  private func file(_ id: String) throws -> URL {
    guard id.count == 64, id.allSatisfy({ $0.isHexDigit && !$0.isUppercase }) else { throw failure("图片标识无效") }
    return root.appendingPathComponent(id + ".jpg")
  }
  private func image(_ uri: String, side: Int) throws -> CGImage {
    guard let input = URL(string: uri), input.isFileURL else { throw failure("请选择本机图片") }
    let url = input.standardizedFileURL.resolvingSymlinksInPath()
    guard allowed.contains(where: { url.path.hasPrefix($0.standardizedFileURL.resolvingSymlinksInPath().path + "/") }) else { throw failure("图片不在应用可访问目录") }
    let values = try url.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey])
    guard values.isRegularFile == true, let bytes = values.fileSize, bytes > 0, bytes <= 20 * 1024 * 1024 else { throw failure("图片为空或超过20MiB") }
    guard let source = CGImageSourceCreateWithURL(url as CFURL, [kCGImageSourceShouldCache: false] as CFDictionary), CGImageSourceGetCount(source) > 0,
      let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
      let width = properties[kCGImagePropertyPixelWidth] as? NSNumber, let height = properties[kCGImagePropertyPixelHeight] as? NSNumber,
      width.intValue > 0, height.intValue > 0, width.intValue <= 32768, height.intValue <= 32768,
      width.doubleValue * height.doubleValue <= 100_000_000,
      let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true, kCGImageSourceThumbnailMaxPixelSize: side, kCGImageSourceShouldCacheImmediately: true] as CFDictionary) else { throw failure("无法读取图片或图片尺寸超限") }
    return image
  }
  func importImage(_ uri: String) throws -> [String: Any] {
    let decoded = try image(uri, side: 1920)
    guard let context = CGContext(data: nil, width: decoded.width, height: decoded.height, bitsPerComponent: 8, bytesPerRow: decoded.width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { throw failure("图片处理失败") }
    context.setFillColor(CGColor(gray: 1, alpha: 1)); context.fill(CGRect(x: 0, y: 0, width: decoded.width, height: decoded.height))
    context.draw(decoded, in: CGRect(x: 0, y: 0, width: decoded.width, height: decoded.height))
    guard let opaque = context.makeImage() else { throw failure("图片处理失败") }
    let data = NSMutableData()
    guard let output = CGImageDestinationCreateWithData(data, UTType.jpeg.identifier as CFString, 1, nil) else { throw failure("图片编码失败") }
    CGImageDestinationAddImage(output, opaque, [kCGImageDestinationLossyCompressionQuality: 0.88] as CFDictionary)
    guard CGImageDestinationFinalize(output), data.length <= 8 * 1024 * 1024 else { throw failure("图片编码失败或超限") }
    let bytes = data as Data, id = SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
    try fm.createDirectory(at: root, withIntermediateDirectories: true)
    let target = try file(id)
    // Replace even an existing hash path atomically; never follow a planted file symlink.
    try bytes.write(to: target, options: .atomic)
    return ["id": id, "width": opaque.width, "height": opaque.height]
  }
  func resolve(_ id: String) throws -> String {
    let url = try file(id), values = try url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey])
    guard values.isRegularFile == true, values.isSymbolicLink != true else { throw failure("图片已缺失，请重新导入") }
    return url.absoluteString
  }
  func reconcile(_ ids: [String]) throws {
    guard ids.count <= 2 else { throw failure("图片槽位无效") }
    let keep = try Set(ids.map { try file($0).lastPathComponent })
    guard fm.fileExists(atPath: root.path) else { return }
    for url in try fm.contentsOfDirectory(at: root, includingPropertiesForKeys: nil) where !keep.contains(url.lastPathComponent) {
      try fm.removeItem(at: url)
    }
  }
  func palette(_ uri: String) throws -> String {
    let decoded = try image(uri, side: 32)
    var pixels = [UInt8](repeating: 0, count: 32 * 32 * 4)
    var bins: [Int: (count: Int, red: Int, green: Int, blue: Int)] = [:]
    let worked = pixels.withUnsafeMutableBytes { buffer -> Bool in
      guard let context = CGContext(data: buffer.baseAddress, width: 32, height: 32, bitsPerComponent: 8, bytesPerRow: 128, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
      context.draw(decoded, in: CGRect(x: 0, y: 0, width: 32, height: 32)); return true
    }
    guard worked else { throw failure("取色失败") }
    for i in stride(from: 0, to: pixels.count, by: 4) {
      let alpha = Int(pixels[i + 3]); if alpha < 128 { continue }
      let r = min(255, Int(pixels[i]) * 255 / alpha), g = min(255, Int(pixels[i + 1]) * 255 / alpha), b = min(255, Int(pixels[i + 2]) * 255 / alpha)
      if max(r, g, b) < 20 || min(r, g, b) > 240 { continue }
      let key = (r / 32) * 64 + (g / 32) * 8 + b / 32
      let old = bins[key] ?? (0, 0, 0, 0); bins[key] = (old.count + 1, old.red + r, old.green + g, old.blue + b)
    }
    guard let best = bins.sorted(by: { $0.value.count == $1.value.count ? $0.key < $1.key : $0.value.count > $1.value.count }).first?.value else { return "#526878" }
    return String(format: "#%02X%02X%02X", best.red / best.count, best.green / best.count, best.blue / best.count)
  }

  // Global flow has a separate three-color contract. Keep the existing single
  // theme swatch independent; do not change it when the flow switch changes.
  func flowPalette(_ uri: String) throws -> [String] {
    let decoded = try image(uri, side: 24)
    var rgba = [UInt8](repeating: 0, count: 24 * 24 * 4)
    let worked = rgba.withUnsafeMutableBytes { bytes -> Bool in
      guard let space = CGColorSpace(name: CGColorSpace.sRGB),
        let context = CGContext(data: bytes.baseAddress, width: 24, height: 24, bitsPerComponent: 8, bytesPerRow: 96, space: space,
          bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue) else { return false }
      context.interpolationQuality = .high
      context.draw(decoded, in: CGRect(x: 0, y: 0, width: 24, height: 24))
      return true
    }
    guard worked else { throw failure("取色失败") }
    return try Self.flowPalettePixels(rgba)
  }

  static func flowPalettePixels(_ rgba: [UInt8]) throws -> [String] {
    guard !rgba.isEmpty, rgba.count <= 24 * 24 * 4, rgba.count % 4 == 0 else {
      throw NSError(domain: "NexusVisualPalette", code: 1)
    }
    struct Sample {
      let color: String, hue: Double, saturation: Double, value: Double, luminance: Double
    }
    var samples: [Sample] = [], totals = [Double](repeating: 0, count: 24), peaks = totals
    var representatives = [Sample?](repeating: nil, count: 24), maxSaturation = 0.0
    func linear(_ channel: Double) -> Double {
      channel <= 0.04045 ? channel / 12.92 : pow((channel + 0.055) / 1.055, 2.4)
    }
    for i in stride(from: 0, to: rgba.count, by: 4) {
      // Input is premultiplied RGBA. The recovered pixel loop consumes RGB
      // directly and constructs opaque colors, including transparent black.
      let r = Double(rgba[i]) / 255, g = Double(rgba[i + 1]) / 255, b = Double(rgba[i + 2]) / 255
      let value = max(r, g, b), delta = value - min(r, g, b), saturation = value == 0 ? 0 : delta / value
      var hue = 0.0
      if delta > 0 {
        if value == r { hue = ((g - b) / delta).truncatingRemainder(dividingBy: 6) * 60 }
        else if value == g { hue = ((b - r) / delta + 2) * 60 }
        else { hue = ((r - g) / delta + 4) * 60 }
        if hue < 0 { hue += 360 }
      }
      let sample = Sample(color: String(format: "#%02X%02X%02X", rgba[i], rgba[i + 1], rgba[i + 2]), hue: hue,
        saturation: saturation, value: value, luminance: 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b))
      samples.append(sample); maxSaturation = max(maxSaturation, saturation)
      let balance = min(1, max(0, 1 - abs(value - 0.55) / 0.55))
      let weight = saturation * (0.25 + 0.75 * balance), bucket = Int(floor(hue / 360 * 24)) % 24
      totals[bucket] += weight
      if weight > peaks[bucket] { peaks[bucket] = weight; representatives[bucket] = sample }
    }
    if maxSaturation < 0.08 {
      // An explicit stable tie rule is ours; reference equal-luminance ordering
      // and raster filtering are not claimed to be pixel-identical.
      let sorted = samples.enumerated().sorted {
        $0.element.luminance == $1.element.luminance ? $0.offset < $1.offset : $0.element.luminance < $1.element.luminance
      }
      var colors: [String] = []
      for index in 0..<3 {
        let fraction = (Double(index) + 0.5) / 3.0
        let position = min(sorted.count - 1, Int(floor(fraction * Double(sorted.count))))
        colors.append(sorted[position].element.color)
      }
      return colors
    }
    let buckets = (0..<24).sorted { totals[$0] == totals[$1] ? $0 < $1 : totals[$0] > totals[$1] }
    var selected: [Sample] = []
    for bucket in buckets {
      guard totals[bucket] > 0, let candidate = representatives[bucket] else { continue }
      let tooClose = selected.contains {
        let distance = abs(candidate.hue - $0.hue)
        return min(distance, 360 - distance) < 40
      }
      if !tooClose { selected.append(candidate) }
      if selected.count == 3 { break }
    }
    if selected.isEmpty { selected.append(samples[samples.count / 2]) }
    let seed = selected
    while selected.count < 3 { selected.append(seed[selected.count % seed.count]) }
    return selected.map(\.color)
  }
}
