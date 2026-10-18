import Foundation
import CoreGraphics
import ImageIO

@main struct BackgroundPixelTests {
  static func main() {
    let bytes: [UInt8] = [255,0,0,255, 0,255,0,255, 0,0,255,255, 0,0,0,0, 120,120,120,255, 47,36,46,255]
    let provider = CGDataProvider(data: Data(bytes) as CFData)!
    let image = CGImage(width: 3, height: 2, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: 12,
      space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
      provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent)!
    for y in 0..<2 { for x in 0..<3 {
      let start = (y * 3 + x) * 4
      precondition(BackgroundPixels.rgba(image, at: CGPoint(x: Double(x) + 0.4, y: Double(y) + 0.7)) == Array(bytes[start..<(start + 4)]))
    } }
    for point in [CGPoint(x:-1,y:0), CGPoint(x:3,y:0), CGPoint(x:0,y:2), CGPoint(x:Double.nan,y:0), CGPoint(x:0,y:Double.infinity)] {
      precondition(BackgroundPixels.rgba(image, at: point).isEmpty)
    }
    let encoded = NSMutableData()
    let destination = CGImageDestinationCreateWithData(encoded, "public.png" as CFString, 1, nil)!
    CGImageDestinationAddImage(destination, image, nil)
    precondition(CGImageDestinationFinalize(destination))
    let decoded = BackgroundPixels.decode(encoded as Data)!
    precondition(decoded.width == 3 && decoded.height == 2)
    for y in 0..<2 { for x in 0..<3 {
      precondition(BackgroundPixels.rgba(decoded, at: CGPoint(x: x, y: y)) == BackgroundPixels.rgba(image, at: CGPoint(x: x, y: y)))
    } }
    precondition(BackgroundPixels.decode(Data()) == nil)
    precondition(BackgroundPixels.decode(Data("not an image".utf8)) == nil)
    // Independent values read from the actual failed PNG: all three hues are
    // present; one near-neutral transition must not invalidate those colors.
    let red: [UInt8] = [60,23,42,255], green: [UInt8] = [44,58,49,255], blue: [UInt8] = [31,19,67,255]
    let neutral: [UInt8] = [47,36,46,255]
    precondition(BackgroundPixels.hasPrimaryHues([red, green, blue, neutral]))
    for missing in [[red, green, neutral], [red, blue, neutral], [green, blue, neutral], [neutral], []] {
      precondition(!BackgroundPixels.hasPrimaryHues(missing))
    }
    precondition(!BackgroundPixels.hasPrimaryHues([red, green, [31,19,67,0]]))
    precondition(!BackgroundPixels.hasPrimaryHues([[255,0,0,0], [0,255,0,0], [0,0,255,0]]))
    if CommandLine.arguments.count > 1 {
      let url = URL(fileURLWithPath: CommandLine.arguments[1])
      let source = CGImageSourceCreateWithURL(url as CFURL, nil)!
      let actual = CGImageSourceCreateImageAtIndex(source, 0, nil)!
      let samples = (2...8).flatMap { step in
        [CGFloat(18), CGFloat(actual.width - 18)].map { x in BackgroundPixels.rgba(actual, at: CGPoint(x: x, y: CGFloat(actual.height) * CGFloat(step) / 10)) }
      }
      precondition(BackgroundPixels.hasPrimaryHues(samples))
      print("Actual failed PNG RGBA: \(samples)")
    }
    print("PASS screenshot sampling: PNG decode,six exact roundtrip pixels,invalid data rejection,explicit RGBA8,finite bounds,three required hues,neutral transitions,each missing hue and transparent rejection")
  }
}
