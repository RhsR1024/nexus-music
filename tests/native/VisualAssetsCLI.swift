import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

@main enum VisualAssetsCLI {
  static func main() throws {
    func check(_ value: @autoclosure () -> Bool, _ message: String) { if !value() { fputs("Visual assets failed: \(message)\n", stderr); exit(1) } }
    func rejects(_ message: String, _ action: () throws -> Void) { do { try action(); check(false, message) } catch {} }
    let fm = FileManager.default, directory = fm.temporaryDirectory.appendingPathComponent("NexusVisualTests-" + UUID().uuidString)
    try fm.createDirectory(at: directory, withIntermediateDirectories: true); defer { try? fm.removeItem(at: directory) }
    let assets = VisualAssets(root: directory.appendingPathComponent("assets"), allowed: [directory]), source = directory.appendingPathComponent("source.png")
    let context = CGContext(data: nil, width: 2400, height: 1200, bitsPerComponent: 8, bytesPerRow: 9600, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    context.setFillColor(CGColor(red: 1, green: 0, blue: 0, alpha: 1));context.fill(CGRect(x: 0, y: 0, width: 2400, height: 1200))
    let output = CGImageDestinationCreateWithURL(source as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(output, context.makeImage()!, [kCGImagePropertyGPSDictionary: [kCGImagePropertyGPSLatitude: 12.345, kCGImagePropertyGPSLongitude: 67.89]] as CFDictionary);check(CGImageDestinationFinalize(output), "fixture")
    let saved = try assets.importImage(source.absoluteString), id = saved["id"] as! String
    check(saved["width"] as? Int == 1920 && saved["height"] as? Int == 960, "bounded thumbnail preserves aspect")
    let uri = try assets.resolve(id), decoded = CGImageSourceCreateWithURL(URL(string: uri)! as CFURL, nil)!
    let properties = CGImageSourceCopyPropertiesAtIndex(decoded, 0, nil) as! [CFString: Any]
    check(properties[kCGImagePropertyGPSDictionary] == nil, "GPS stripped")
    let color = try assets.palette(uri);check(color.hasPrefix("#F") && color.count == 7, "dominant red survives encode")
    func pixel(_ r: UInt8, _ g: UInt8, _ b: UInt8, _ a: UInt8 = 255) -> [UInt8] { [r, g, b, a] }
    func rank(_ bytes: [UInt8], _ expected: [String], _ name: String) throws {
      let actual = try VisualAssets.flowPalettePixels(bytes)
      check(actual == expected, name)
    }
    try rank(pixel(255, 0, 0) + pixel(255, 0, 0) + pixel(255, 0, 0) + pixel(0, 255, 0) + pixel(0, 255, 0) + pixel(0, 0, 255),
      ["#FF0000", "#00FF00", "#0000FF"], "three hue scores retain count order")
    try rank(pixel(255, 0, 0) + pixel(255, 0, 0) + pixel(0, 140, 0),
      ["#008C00", "#FF0000", "#008C00"], "one balanced green outweighs two extreme bright reds")
    try rank(pixel(255, 0, 0) + pixel(128, 0, 0), ["#800000", "#800000", "#800000"], "bucket representative is peak weight, not RGB average")
    try rank([0, 51, 102, 153, 204, 255].flatMap { pixel(UInt8($0), UInt8($0), UInt8($0)) },
      ["#333333", "#999999", "#FFFFFF"], "gray luminance quantiles at indices one three five")
    try rank(pixel(194, 194, 194) + pixel(190, 200, 190) + pixel(200, 190, 190),
      ["#C8BEBE", "#C2C2C2", "#BEC8BE"], "low saturation ranking uses relative luminance instead of channel average")
    try rank(pixel(255, 0, 0) + pixel(255, 0, 17), ["#FF0000", "#FF0000", "#FF0000"], "hue distance wraps at zero")
    try rank(pixel(255, 0, 0) + pixel(255, 170, 0), ["#FF0000", "#FFAA00", "#FF0000"], "exact forty degrees is admitted")
    try rank(pixel(255, 0, 0) + pixel(255, 169, 0), ["#FF0000", "#FF0000", "#FF0000"], "less than forty degrees is excluded")
    try rank(pixel(0, 0, 0) + pixel(100, 92, 92) + pixel(255, 255, 255),
      ["#645C5C", "#645C5C", "#645C5C"], "saturation exactly point zero eight uses weighted branch")
    try rank(pixel(0, 0, 0) + pixel(100, 93, 93) + pixel(255, 255, 255),
      ["#000000", "#645D5D", "#FFFFFF"], "saturation below point zero eight uses gray branch")
    try rank(pixel(128, 0, 0, 128), ["#800000", "#800000", "#800000"], "premultiplied RGB is not unpremultiplied")
    try rank(pixel(0, 0, 0, 0), ["#000000", "#000000", "#000000"], "transparent black is not a branded fallback")
    try rank(pixel(255, 255, 255), ["#FFFFFF", "#FFFFFF", "#FFFFFF"], "white image keeps actual white colors")
    rejects("empty flow bytes") { _ = try VisualAssets.flowPalettePixels([]) }
    rejects("incomplete flow pixel") { _ = try VisualAssets.flowPalettePixels([1, 2, 3]) }
    rejects("flow pixel budget") { _ = try VisualAssets.flowPalettePixels([UInt8](repeating: 0, count: 24 * 24 * 4 + 4)) }
    let flowSource = directory.appendingPathComponent("three-colors.png")
    let flowContext = CGContext(data: nil, width: 24, height: 24, bitsPerComponent: 8, bytesPerRow: 96,
      space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue)!
    for (i, channels) in [[CGFloat(1), 0, 0], [0, 1, 0], [0, 0, 1]].enumerated() {
      flowContext.setFillColor(CGColor(colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!, components: channels + [1])!)
      flowContext.fill(CGRect(x: i * 8, y: 0, width: 8, height: 24))
    }
    let flowOutput = CGImageDestinationCreateWithURL(flowSource as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(flowOutput, flowContext.makeImage()!, nil);check(CGImageDestinationFinalize(flowOutput), "flow PNG fixture")
    let actualFlow = try assets.flowPalette(flowSource.absoluteString)
    check(actualFlow == ["#FF0000", "#00FF00", "#0000FF"], "real PNG sRGB three-color native sampling")
    let jpegSource = directory.appendingPathComponent("three-colors.jpg")
    let jpegOutput = CGImageDestinationCreateWithURL(jpegSource as CFURL, UTType.jpeg.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(jpegOutput, flowContext.makeImage()!, [kCGImageDestinationLossyCompressionQuality: 0.85] as CFDictionary)
    check(CGImageDestinationFinalize(jpegOutput), "JPEG cache-format fixture")
    let jpegFlow = try assets.flowPalette(jpegSource.absoluteString)
    var jpegHues = Set<Int>()
    for color in jpegFlow {
      let channels = [1, 3, 5].map { Int(color.dropFirst($0).prefix(2), radix: 16)! }
      let winner = channels.enumerated().max { $0.element < $1.element }!.offset
      check(channels[winner] > 200, "JPEG keeps a real saturated representative")
      jpegHues.insert(winner)
    }
    check(jpegHues == Set([0, 1, 2]), "JPEG cache format retains all three hues without assuming tie order")
    let transparentSource = directory.appendingPathComponent("transparent.png")
    flowContext.clear(CGRect(x: 0, y: 0, width: 24, height: 24))
    let transparentOutput = CGImageDestinationCreateWithURL(transparentSource as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(transparentOutput, flowContext.makeImage()!, nil);check(CGImageDestinationFinalize(transparentOutput), "transparent PNG fixture")
    let transparentFlow = try assets.flowPalette(transparentSource.absoluteString)
    check(transparentFlow == ["#000000", "#000000", "#000000"], "real transparent PNG is premultiplied black")
    let second = try assets.importImage(source.absoluteString);check(second["id"] as? String == id, "content identity")
    let bad = directory.appendingPathComponent("bad.png");try Data("not image".utf8).write(to: bad)
    rejects("bad image") { _ = try assets.importImage(bad.absoluteString) };rejects("bad id") { _ = try assets.resolve("../escape") }
    let outside = fm.temporaryDirectory.appendingPathComponent("NexusOutside-" + UUID().uuidString);try Data("outside".utf8).write(to: outside);defer { try? fm.removeItem(at: outside) }
    let link = directory.appendingPathComponent("link.png");try fm.createSymbolicLink(at: link, withDestinationURL: outside)
    rejects("outside symlink") { _ = try assets.importImage(link.absoluteString) };rejects("remote URI") { _ = try assets.palette("https://example.test/p.png") }
    rejects("flow outside symlink") { _ = try assets.flowPalette(link.absoluteString) };rejects("flow remote URI") { _ = try assets.flowPalette("https://example.test/p.png") }
    let huge = directory.appendingPathComponent("huge.png");fm.createFile(atPath: huge.path, contents: nil);let handle = try FileHandle(forWritingTo: huge);try handle.truncate(atOffset: 21 * 1024 * 1024);try handle.close()
    rejects("byte budget") { _ = try assets.importImage(huge.absoluteString) }
    rejects("flow byte budget") { _ = try assets.flowPalette(huge.absoluteString) }
    try assets.reconcile([id]);check((try? assets.resolve(id)) != nil, "retain reference")
    try assets.reconcile([]);rejects("remove unreferenced") { _ = try assets.resolve(id) }
    print("Native visual assets passed: real image import and privacy boundaries; flow HSV scores, representatives, gray quantiles, saturation and circular hue boundaries, premultiplied RGB, exact three-color PNG and cleanup")
  }
}
