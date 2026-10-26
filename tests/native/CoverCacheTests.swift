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
    let hdKey = String(repeating: "b", count: 64)
    let hdFile = cache.store(data as Data, key: hdKey, maxPixelSize: 1024)!
    let hdImage = CGImageSourceCreateWithURL(URL(string: hdFile)! as CFURL, nil)!
    let hdProperties = CGImageSourceCopyPropertiesAtIndex(hdImage, 0, nil)! as NSDictionary
    assert((hdProperties[kCGImagePropertyPixelWidth] as! Int) == 512 && (hdProperties[kCGImagePropertyPixelHeight] as! Int) == 1024)
    assert(cache.hit(key) == file && cache.hit(hdKey) == hdFile && file != hdFile)
    assert(cache.store(data as Data, key: hdKey, maxPixelSize: 4096) == nil)
    let smallContext = CGContext(data: nil, width: 100, height: 64, bitsPerComponent: 8, bytesPerRow: 400, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    let smallData = NSMutableData(), smallDestination = CGImageDestinationCreateWithData(smallData, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(smallDestination, smallContext.makeImage()!, nil); assert(CGImageDestinationFinalize(smallDestination))
    let smallFile = cache.store(smallData as Data, key: String(repeating: "c", count: 64), maxPixelSize: 1024)!
    let smallImage = CGImageSourceCreateWithURL(URL(string: smallFile)! as CFURL, nil)!
    let smallProperties = CGImageSourceCopyPropertiesAtIndex(smallImage, 0, nil)! as NSDictionary
    assert((smallProperties[kCGImagePropertyPixelWidth] as! Int) == 100 && (smallProperties[kCGImagePropertyPixelHeight] as! Int) == 64)
    assert(cache.store(Data(repeating: 0, count: 8 * 1024 * 1024 + 1), key: hdKey, maxPixelSize: 1024) == nil)
    let epoch = cache.epoch; cache.clear(); assert(cache.epoch > epoch && cache.hit(key) == nil && cache.hit(hdKey) == nil)
    print("Native cover cache checks passed: bounded thumbnail, validated image, hashed path and clear epoch")
  }
}
