import AVFoundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
import Foundation

// Independent production-screen observation, without renderer state or easing
// values. The fixture holds blue, releases red, then waits for the final tint.
let path = CommandLine.arguments[1]
let asset = AVURLAsset(url: URL(fileURLWithPath: path))
guard let track = asset.tracks(withMediaType: .video).first else { fatalError("Missing video track") }
let reader = try AVAssetReader(asset: asset)
let output = AVAssetReaderTrackOutput(track: track,
  outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
reader.add(output)
precondition(reader.startReading())
var rows = [(time: Double, r: Int, g: Int, b: Int)]()
var before: CGImage?, middle: CGImage?, after: CGImage?
var closest = Int.max
while let sample = output.copyNextSampleBuffer() {
  guard let buffer = CMSampleBufferGetImageBuffer(sample) else { continue }
  CVPixelBufferLockBaseAddress(buffer, .readOnly)
  defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
  let width = CVPixelBufferGetWidth(buffer), height = CVPixelBufferGetHeight(buffer)
  let stride = CVPixelBufferGetBytesPerRow(buffer)
  let bytes = CVPixelBufferGetBaseAddress(buffer)!.assumingMemoryBound(to: UInt8.self)
  let x = Int(Double(width) * 6 / 393), y = Int(Double(height) * 180 / 852)
  var rgb = [0, 0, 0]
  for dy in -2...2 { for dx in -2...2 {
    let index = (y + dy) * stride + (x + dx) * 4
    rgb[0] += Int(bytes[index + 2]); rgb[1] += Int(bytes[index + 1]); rgb[2] += Int(bytes[index])
  } }
  rgb = rgb.map { $0 / 25 }
  let delta = rgb[0] - rgb[2]
  rows.append((CMSampleBufferGetPresentationTimeStamp(sample).seconds, rgb[0], rgb[1], rgb[2]))
  let saveBefore = before == nil && delta < -12
  let saveMiddle = before != nil && after == nil && abs(delta) < closest
  let saveAfter = before != nil && after == nil && delta > 12
  if saveBefore || saveMiddle || saveAfter {
    let image = CGImage(width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32,
      bytesPerRow: stride, space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedFirst.rawValue).union(.byteOrder32Little),
      provider: CGDataProvider(data: Data(bytes: bytes, count: stride * height) as CFData)!,
      decode: nil, shouldInterpolate: false, intent: .defaultIntent)!
    let context = CGContext(data: nil, width: 393, height: 852, bitsPerComponent: 8,
      bytesPerRow: 393 * 4, space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    context.draw(image, in: CGRect(x: 0, y: 0, width: 393, height: 852))
    let preview = context.makeImage()!
    if saveBefore { before = preview }
    if saveMiddle { middle = preview; closest = abs(delta) }
    if saveAfter { after = preview }
  }
}
let csv = "time,r,g,b,redMinusBlue\n" + rows.map { "\($0.time),\($0.r),\($0.g),\($0.b),\($0.r - $0.b)" }.joined(separator: "\n") + "\n"
try csv.write(toFile: path + ".csv", atomically: true, encoding: .utf8)
precondition(reader.status == .completed, "Video decoding must complete")
guard let blue = rows.firstIndex(where: { $0.r - $0.b < -12 }),
      let red = rows.firstIndex(where: { $0.r - $0.b > 12 }), red > blue,
      let before, let middle, let after else { fatalError("Video must start blue and reach red") }
let lower = rows[blue].r - rows[blue].b, upper = rows[red].r - rows[red].b
let intermediate = (blue...red).filter { let delta = rows[$0].r - rows[$0].b; return delta > lower + 3 && delta < upper - 3 }
precondition(intermediate.count >= 3, "Multiple actual intermediate hue frames are required")
for (name, image) in [("before", before), ("middle", middle), ("after", after)] {
  let destination = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path + "-" + name + ".png") as CFURL, UTType.png.identifier as CFString, 1, nil)!
  CGImageDestinationAddImage(destination, image, nil)
  precondition(CGImageDestinationFinalize(destination))
}
print("PASS actual production transition video: frames=\(rows.count), intermediate=\(intermediate.count), blueTime=\(rows[blue].time), redTime=\(rows[red].time)")
