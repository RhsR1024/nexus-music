import Foundation
import CoreGraphics

// Original native implementation of the finite E026–E032 scene math.
struct AmbientScene {
  struct RGB: Equatable {
    let red: Double, green: Double, blue: Double
    var channels: [Double] { [red, green, blue] }
    var cgColor: CGColor { CGColor(srgbRed: red, green: green, blue: blue, alpha: 1) }
    init(_ red: Double, _ green: Double, _ blue: Double) { self.red = red; self.green = green; self.blue = blue }
    init?(hex: String) {
      guard hex.utf8.count == 7, hex.first == "#", hex.dropFirst().utf8.allSatisfy({ (48...57).contains($0) || (65...70).contains($0) || (97...102).contains($0) }),
        let value = UInt32(hex.dropFirst(), radix: 16) else { return nil }
      self.init(Double((value >> 16) & 255) / 255, Double((value >> 8) & 255) / 255, Double(value & 255) / 255)
    }
    func softened(dark: Bool) -> RGB {
      let maximum = channels.max()!, minimum = channels.min()!, delta = maximum - minimum
      let lightness = (maximum + minimum) / 2
      let saturation = delta == 0 ? 0 : delta / (1 - abs(2 * lightness - 1))
      var hue = 0.0
      if delta > 0 {
        if maximum == red { hue = ((green - blue) / delta).truncatingRemainder(dividingBy: 6) }
        else if maximum == green { hue = (blue - red) / delta + 2 }
        else { hue = (red - green) / delta + 4 }
        hue *= 60
        if hue < 0 { hue += 360 }
      }
      let s = saturation < 0.06 ? saturation : min(dark ? 0.6 : 0.48, max(0.26, saturation * 0.76))
      let l = saturation < 0.06 ? (dark ? 0.34 : 0.72)
        : min(dark ? 0.41 : 0.74, max(dark ? 0.31 : 0.62, lightness * 0.12 + (dark ? 0.32 : 0.62)))
      let chroma = (1 - abs(2 * l - 1)) * s
      let x = chroma * (1 - abs((hue / 60).truncatingRemainder(dividingBy: 2) - 1)), m = l - chroma / 2
      let rgb: [Double]
      switch Int(hue / 60) {
      case 0: rgb = [chroma, x, 0]
      case 1: rgb = [x, chroma, 0]
      case 2: rgb = [0, chroma, x]
      case 3: rgb = [0, x, chroma]
      case 4: rgb = [x, 0, chroma]
      default: rgb = [chroma, 0, x]
      }
      // HSL.toColor quantizes before the subsequent floating-point lerp.
      let bytes = rgb.map { ((min(1, max(0, $0 + m)) * 255).rounded()) / 255 }
      return RGB(bytes[0], bytes[1], bytes[2])
    }
    func mixed(with target: Double, amount: Double) -> RGB {
      let values = channels.map { min(1, max(0, $0 * (1 - amount) + target * amount)) }
      return RGB(values[0], values[1], values[2])
    }
  }
  static func overlay(dark: Bool) -> [CGColor] {
    let color = dark ? 0.0 : 1.0
    return (dark ? [4.0, 24.0] : [18.0, 48.0]).map {
      CGColor(srgbRed: color, green: color, blue: color, alpha: $0 / 255)
    }
  }
  // Convert the physical center +/- .65*maxDimension axis to a unit-space
  // projection, including its length, rather than just normalizing endpoints.
  static func gradientPoints(size: CGSize, angle: Double) -> (start: CGPoint, end: CGPoint) {
    guard size.width > 0, size.height > 0, size.width.isFinite, size.height.isFinite else {
      return (.zero, CGPoint(x: 1, y: 1))
    }
    let radius = 0.65 * max(size.width, size.height)
    let x = size.width * cos(angle) / (2 * radius), y = size.height * sin(angle) / (2 * radius)
    let scale = 1 / (x * x + y * y)
    return (CGPoint(x: 0.5 - scale * x / 2, y: 0.5 - scale * y / 2),
      CGPoint(x: 0.5 + scale * x / 2, y: 0.5 + scale * y / 2))
  }
  struct Random {
    private(set) var state: UInt64
    init(seed: UInt32) {
      let value = UInt64(seed)
      var mixed = (~value) &+ (value << 21)
      mixed ^= mixed >> 24; mixed = mixed &* 265
      mixed ^= mixed >> 14; mixed = mixed &* 21
      mixed ^= mixed >> 28; mixed = mixed &+ (mixed << 31)
      state = mixed == 0 ? 0x5a17 : mixed
      for _ in 0..<4 { advance() }
    }
    private mutating func advance() { state = 0xffffda61 &* (state & 0xffffffff) &+ (state >> 32) }
    mutating func unit() -> Double {
      advance(); let high = state & 0x3ffffff
      advance(); let low = state & 0x7ffffff
      return Double(high * 134217728 + low) / 9007199254740992
    }
    mutating func direction() -> Double { advance(); return state & 1 == 0 ? 1 : -1 }
  }
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
  let palette: [RGB]
  let base: [RGB]
  let fields: [Field]
  let period: Double
  let phase: Double
  let direction: Double

  func angle(at time: Double) -> Double {
    phase + 2 * .pi * (time.isFinite ? max(0, time) : 0) / period * direction
  }

  static func seed(_ identity: String) -> UInt32 {
    var value: UInt32 = 0x811c9dc5
    for unit in identity.utf16 { value = ((value ^ UInt32(unit)) &* 0x01000193) & 0x7fffffff }
    return value
  }

  init?(colors: [String], identity: String, dark: Bool = false) {
    guard (1...3).contains(colors.count) else { return nil }
    let raw = colors.compactMap { RGB(hex: $0) }
    guard raw.count == colors.count else { return nil }
    let palette = raw.map { $0.softened(dark: dark) }
    let images = palette.compactMap(Self.softLight)
    guard images.count == palette.count else { return nil }
    self.palette = palette
    base = [palette[0].mixed(with: dark ? 0 : 1, amount: dark ? 0.45 : 0.5),
      palette[min(1, palette.count - 1)].mixed(with: dark ? 0 : 1, amount: dark ? 0.54 : 0.6)]
    self.images = images
    var random = Random(seed: Self.seed(identity))
    func unit() -> Double { random.unit() }
    let anchors = [CGPoint(x: 0.12, y: 0.18), CGPoint(x: 0.88, y: 0.38), CGPoint(x: 0.32, y: 0.84), CGPoint(x: 0.82, y: 0.92)]
    fields = anchors.map { anchor in
      Field(anchor: anchor, amplitude: CGPoint(x: 0.15 + 0.1 * unit(), y: 0.13 + 0.09 * unit()),
        xPeriod: 9 + 7 * unit(), yPeriod: 12 + 9 * unit(), phase: 2 * .pi * unit(),
        width: 0.9 + 0.22 * unit(), height: 0.62 + 0.18 * unit(), opacity: 0.62 + 0.1 * unit())
    }
    period = 20 + 10 * unit(); phase = 2 * .pi * unit(); direction = random.direction()
  }

  static func softLight(_ color: String) -> CGImage? {
    RGB(hex: color).flatMap(Self.softLight)
  }
  static func softLight(_ color: RGB) -> CGImage? {
    let channels = color.channels.map { $0 * 255 }
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
      space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
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
    context.translateBy(x: size.width / 2, y: size.height / 2)
    context.rotate(by: angle(at: time))
    context.scaleBy(x: 1.12, y: 1.12)
    context.translateBy(x: -size.width / 2, y: -size.height / 2)
    // CGImage has an upward axis; preserve the scene's UIKit anchor coordinates.
    context.translateBy(x: 0, y: size.height)
    context.scaleBy(x: 1, y: -1)
    context.interpolationQuality = .medium
    for (index, field) in fields.enumerated() {
      let r = rect(field, size: size, time: time)
      let flipped = CGRect(x: r.minX, y: size.height - r.maxY, width: r.width, height: r.height)
      context.setAlpha(field.opacity)
      context.draw(images[index % images.count], in: flipped)
    }
    context.restoreGState()
  }
}
