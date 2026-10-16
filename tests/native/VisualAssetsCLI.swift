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
    let second = try assets.importImage(source.absoluteString);check(second["id"] as? String == id, "content identity")
    let bad = directory.appendingPathComponent("bad.png");try Data("not image".utf8).write(to: bad)
    rejects("bad image") { _ = try assets.importImage(bad.absoluteString) };rejects("bad id") { _ = try assets.resolve("../escape") }
    let outside = fm.temporaryDirectory.appendingPathComponent("NexusOutside-" + UUID().uuidString);try Data("outside".utf8).write(to: outside);defer { try? fm.removeItem(at: outside) }
    let link = directory.appendingPathComponent("link.png");try fm.createSymbolicLink(at: link, withDestinationURL: outside)
    rejects("outside symlink") { _ = try assets.importImage(link.absoluteString) };rejects("remote URI") { _ = try assets.palette("https://example.test/p.png") }
    let huge = directory.appendingPathComponent("huge.png");fm.createFile(atPath: huge.path, contents: nil);let handle = try FileHandle(forWritingTo: huge);try handle.truncate(atOffset: 21 * 1024 * 1024);try handle.close()
    rejects("byte budget") { _ = try assets.importImage(huge.absoluteString) }
    try assets.reconcile([id]);check((try? assets.resolve(id)) != nil, "retain reference")
    try assets.reconcile([]);rejects("remove unreferenced") { _ = try assets.resolve(id) }
    print("Native visual assets passed: bounded real image import, aspect, stable content identity, GPS stripping, dominant color, malformed/remote/oversized/symlink rejection and reference cleanup")
  }
}
