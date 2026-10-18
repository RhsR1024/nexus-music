import Foundation
import CoreGraphics

// Test-only sampling in an explicit sRGB/RGBA8 buffer. The caller supplies
// physical screenshot pixels, independent of an application's AX frame.
enum BackgroundPixels {
  static func rgba(_ image: CGImage, at point: CGPoint) -> [UInt8] {
    guard point.x.isFinite, point.y.isFinite, point.x >= 0, point.y >= 0,
      point.x < CGFloat(image.width), point.y < CGFloat(image.height),
      let pixel = image.cropping(to: CGRect(x: floor(point.x), y: floor(point.y), width: 1, height: 1)) else { return [] }
    var bytes = [UInt8](repeating: 0, count: 4)
    let sampled = bytes.withUnsafeMutableBytes { memory -> Bool in
      guard let context = CGContext(data: memory.baseAddress, width: 1, height: 1, bitsPerComponent: 8, bytesPerRow: 4,
        space: CGColorSpace(name: CGColorSpace.sRGB)!,
        bitmapInfo: CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
      context.draw(pixel, in: CGRect(x: 0, y: 0, width: 1, height: 1)); return true
    }
    return sampled ? bytes : []
  }
  static func hasPrimaryHues(_ samples: [[UInt8]]) -> Bool {
    var hues = Set<Int>()
    for rgba in samples {
      guard rgba.count == 4, rgba[3] == 255 else { continue }
      let ranked = [0, 1, 2].sorted { rgba[$0] > rgba[$1] }
      if Int(rgba[ranked[0]]) - Int(rgba[ranked[1]]) >= 2 && Int(rgba[ranked[0]]) - Int(rgba[ranked[2]]) >= 6 { hues.insert(ranked[0]) }
    }
    return hues.isSuperset(of: [0, 1, 2])
  }
}
