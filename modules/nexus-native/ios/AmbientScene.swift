import Foundation
import CoreGraphics

// Original finite scene policy. Only radial falloff and bounded field math
// follow reviewed behavior; anchors and PRNG are explicitly Nexus choices.
struct AmbientScene {
  struct Field {
    let anchor: CGPoint
    let amplitude: CGPoint
    let xPeriod: Double
    let yPeriod: Double
    let phase: Double
    let width: Double
    let height: Double
    let opacity: Double
  }
  let images: [CGImage]
  let fields: [Field]

  static func seed(_ identity: String) -> UInt32 {
    var value: UInt32 = 0x811c9dc5
    for unit in identity.utf16 { value = ((value ^ UInt32(unit)) &* 0x01000193) & 0x7fffffff }
    return value
  }

  init?(colors: [String], identity: String) {
    guard colors.count == 3 else { return nil }
    let images = colors.compactMap(Self.softLight)
    guard images.count == 3 else { return nil }
    self.images = images
    var random = Self.seed(identity)
    func unit() -> Double {
      random = random &* 1664525 &+ 1013904223
      return Double(random) / 4294967296
    }
    let anchors = [CGPoint(x: 0.12, y: 0.22), CGPoint(x: 0.88, y: 0.3), CGPoint(x: 0.32, y: 0.76), CGPoint(x: 0.82, y: 0.82)]
    fields = anchors.map { anchor in
      Field(anchor: anchor, amplitude: CGPoint(x: 0.15 + 0.1 * unit(), y: 0.13 + 0.09 * unit()),
        xPeriod: 9 + 7 * unit(), yPeriod: 12 + 9 * unit(), phase: 2 * .pi * unit(),
        width: 0.9 + 0.22 * unit(), height: 0.62 + 0.18 * unit(), opacity: 0.62 + 0.1 * unit())
    }
  }

  static func softLight(_ color: String) -> CGImage? {
    guard color.utf8.count == 7, color.first == "#", color.dropFirst().utf8.allSatisfy({ (48...57).contains($0) || (65...70).contains($0) || (97...102).contains($0) }),
      let rgb = UInt32(color.dropFirst(), radix: 16) else { return nil }
    let channels = [Double((rgb >> 16) & 255), Double((rgb >> 8) & 255), Double(rgb & 255)]
    let side = 144
    var bytes = [UInt8](repeating: 0, count: side * side * 4)
    for y in 0..<side {
      for x in 0..<side {
        let dx = Double(x - 72) / 72, dy = Double(y - 72) / 72
        let u = 1 - min(1, sqrt(dx * dx + dy * dy))
        let alpha = pow(u * u * (3 - 2 * u), 1.15)
        let offset = (y * side + x) * 4
        for channel in 0..<3 { bytes[offset + channel] = UInt8((channels[channel] * alpha).rounded()) }
        bytes[offset + 3] = UInt8((255 * alpha).rounded())
      }
    }
    guard let provider = CGDataProvider(data: Data(bytes) as CFData) else { return nil }
    return CGImage(width: side, height: side, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: side * 4,
      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
      provider: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent)
  }

  func rect(_ field: Field, size: CGSize, time: Double) -> CGRect {
    let t = time.isFinite ? max(0, time) : 0
    let a = 2 * .pi * t / field.xPeriod + field.phase
    let b = 2 * .pi * t / field.yPeriod + 0.73 * field.phase
    let x = sin(a) + 0.38 * sin(1.65 * b + 0.4 * field.phase)
    let y = cos(b) + 0.34 * sin(1.35 * a - 0.6 * field.phase)
    let center = CGPoint(x: (field.anchor.x + field.amplitude.x * x) * size.width,
      y: (field.anchor.y + field.amplitude.y * y) * size.height)
    let z = sin(0.82 * b + field.phase), breath = 1 + 0.12 * z
    let maximum = max(size.width, size.height)
    let width = maximum * field.width * breath * (1 + 0.08 * z)
    let height = maximum * field.height * breath * (1 - 0.06 * z)
    return CGRect(x: center.x - width / 2, y: center.y - height / 2, width: width, height: height)
  }

  func draw(in context: CGContext, size: CGSize, time: Double) {
    guard size.width > 0, size.height > 0, size.width.isFinite, size.height.isFinite else { return }
    context.saveGState()
    // CGImage has an upward axis; preserve the scene's UIKit anchor coordinates.
    context.translateBy(x: 0, y: size.height)
    context.scaleBy(x: 1, y: -1)
    context.interpolationQuality = .medium
    for (index, field) in fields.enumerated() {
      let r = rect(field, size: size, time: time)
      let flipped = CGRect(x: r.minX, y: size.height - r.maxY, width: r.width, height: r.height)
      context.setAlpha(field.opacity * 0.42)
      context.draw(images[index % images.count], in: flipped)
    }
    context.restoreGState()
  }
}
