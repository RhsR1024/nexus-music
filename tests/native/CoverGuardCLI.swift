import Foundation
import AppKit

// Degenerate-cover guard probe: the blur crash came from tiny decoded covers,
// so the cache must reject sub-32px payloads and keep real covers.
@main struct CoverGuardCLI {
  static func png(_ width: Int, _ height: Int) -> Data {
    let representation = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: width * 4, bitsPerPixel: 32)!
    return representation.representation(using: .png, properties: [:])!
  }
  static func main() throws {
    let root = CommandLine.arguments[1]
    let cache = CoverCache(directory: URL(fileURLWithPath: root))
    guard cache.store(png(1, 1), key: "0000000000000000000000000000000000000000000000000000000000000001") == nil else { fatalError("1x1 payload must be rejected") }
    guard cache.store(png(16, 300), key: "0000000000000000000000000000000000000000000000000000000000000002") == nil else { fatalError("16px-wide payload must be rejected") }
    guard cache.store(png(300, 16), key: "0000000000000000000000000000000000000000000000000000000000000003") == nil else { fatalError("16px-tall payload must be rejected") }
    guard cache.store(png(40, 20), key: "0000000000000000000000000000000000000000000000000000000000000005") == nil else { fatalError("40x20 payload must be rejected") }
    let real = cache.store(png(512, 512), key: "0000000000000000000000000000000000000000000000000000000000000004")
    guard real != nil, FileManager.default.fileExists(atPath: URL(string: real!)!.path) else { fatalError("512px cover must be stored") }
    guard cache.hit("0000000000000000000000000000000000000000000000000000000000000004") != nil else { fatalError("stored cover must hit") }
    print(#"{"tinyRejected":true,"realStored":true}"#)
  }
}
