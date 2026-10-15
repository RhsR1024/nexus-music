import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
@main struct CoverCacheTests {
  static func main() throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: directory) }
    let cache = CoverCache(directory: directory), key = String(repeating: "a", count: 64)
    let context = CGContext(data: nil, width: 1024, height: 2048, bitsPerComponent: 8, bytesPerRow: 4096, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    context.setFillColor(CGColor(red: 0.3, green: 0.7, blue: 0.2, alpha: 1)); context.fill(CGRect(x: 0, y: 0, width: 1024, height: 2048))
    let data = NSMutableData(), destination = CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(destination, context.makeImage()!, nil); assert(CGImageDestinationFinalize(destination))
    let file = cache.store(data as Data, key: key)!
    let image = CGImageSourceCreateWithURL(URL(string: file)! as CFURL, nil)!
    let properties = CGImageSourceCopyPropertiesAtIndex(image, 0, nil)! as NSDictionary
    assert((properties[kCGImagePropertyPixelWidth] as! Int) <= 512 && (properties[kCGImagePropertyPixelHeight] as! Int) == 512)
    assert(cache.hit(key) == file); assert(cache.store(Data([1, 2]), key: key) == nil); assert(cache.hit("../escape") == nil)
    let epoch = cache.epoch; cache.clear(); assert(cache.epoch > epoch && cache.hit(key) == nil)
    print("Native cover cache checks passed: bounded thumbnail, validated image, hashed path and clear epoch")
  }
}
