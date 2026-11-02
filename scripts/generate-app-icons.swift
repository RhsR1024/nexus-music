import AppKit
import CoreGraphics
import Foundation
import ImageIO

struct Style {
  let id: String
  let nativeName: String?
  let red: CGFloat
  let green: CGFloat
  let blue: CGFloat
}

let repository = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let source = repository.appendingPathComponent(
  "ios/app/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png"
)
let assetRoot = repository.appendingPathComponent("ios/app/Images.xcassets")
let previewRoot = repository.appendingPathComponent("assets/app-icons")
let styles = [
  Style(id: "orange", nativeName: "NexusAltOrange", red: 242/255, green: 121/255, blue: 35/255),
  Style(id: "green", nativeName: "NexusAltGreen", red: 80/255, green: 184/255, blue: 108/255),
  Style(id: "blue", nativeName: "NexusAltBlue", red: 39/255, green: 135/255, blue: 216/255),
  Style(id: "purple", nativeName: "NexusAltPurple", red: 118/255, green: 82/255, blue: 196/255),
  Style(id: "graphite", nativeName: "NexusAltGraphite", red: 68/255, green: 73/255, blue: 82/255),
]

guard let image = NSImage(contentsOf: source),
      let sourceImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
  fatalError("Cannot decode the primary Nexus app icon")
}
let width = sourceImage.width
let height = sourceImage.height
guard width == 1024, height == 1024 else { fatalError("Primary app icon must be 1024x1024") }

let colorSpace = CGColorSpaceCreateDeviceRGB()
var sourceBytes = [UInt8](repeating: 0, count: width * height * 4)
guard let sourceContext = CGContext(
  data: &sourceBytes,
  width: width,
  height: height,
  bitsPerComponent: 8,
  bytesPerRow: width * 4,
  space: colorSpace,
  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
) else { fatalError("Cannot create source icon context") }
sourceContext.interpolationQuality = .none
sourceContext.draw(sourceImage, in: CGRect(x: 0, y: 0, width: width, height: height))

let baseRed = CGFloat(sourceBytes[0]) / 255
let baseGreen = CGFloat(sourceBytes[1]) / 255
let baseBlue = CGFloat(sourceBytes[2]) / 255

func pngData(_ image: CGImage) -> Data {
  let output = NSMutableData()
  guard let destination = CGImageDestinationCreateWithData(output, "public.png" as CFString, 1, nil) else {
    fatalError("Cannot create PNG destination")
  }
  CGImageDestinationAddImage(destination, image, [
    kCGImagePropertyPNGDictionary: [kCGImagePropertyPNGInterlaceType: 0],
  ] as CFDictionary)
  guard CGImageDestinationFinalize(destination) else { fatalError("Cannot encode PNG") }
  return output as Data
}

func write(_ image: CGImage, to url: URL) throws {
  try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
  try pngData(image).write(to: url, options: .atomic)
}

func recolor(red targetRed: CGFloat, green targetGreen: CGFloat, blue targetBlue: CGFloat) -> CGImage {
  var bytes = sourceBytes
  for offset in stride(from: 0, to: bytes.count, by: 4) {
    let pixelRed = CGFloat(bytes[offset]) / 255
    let pixelGreen = CGFloat(bytes[offset + 1]) / 255
    let pixelBlue = CGFloat(bytes[offset + 2]) / 255
    let contributions = [
      (pixelRed - baseRed) / (1 - baseRed),
      (pixelGreen - baseGreen) / (1 - baseGreen),
      (pixelBlue - baseBlue) / (1 - baseBlue),
    ].map { min(1, max(0, $0)) }
    let coverage = contributions.reduce(0, +) / CGFloat(contributions.count)
    let inverse = 1 - coverage
    bytes[offset] = UInt8((coverage + inverse * targetRed) * 255)
    bytes[offset + 1] = UInt8((coverage + inverse * targetGreen) * 255)
    bytes[offset + 2] = UInt8((coverage + inverse * targetBlue) * 255)
    bytes[offset + 3] = 255
  }
  guard let provider = CGDataProvider(data: Data(bytes) as CFData),
        let source = CGImage(
          width: width,
          height: height,
          bitsPerComponent: 8,
          bitsPerPixel: 32,
          bytesPerRow: width * 4,
          space: colorSpace,
          bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
          provider: provider,
          decode: nil,
          shouldInterpolate: false,
          intent: .defaultIntent
        ),
        let opaque = CGContext(
          data: nil,
          width: width,
          height: height,
          bitsPerComponent: 8,
          bytesPerRow: width * 4,
          space: colorSpace,
          bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
        ) else { fatalError("Cannot create recolored icon") }
  opaque.interpolationQuality = .none
  opaque.draw(source, in: CGRect(x: 0, y: 0, width: width, height: height))
  guard let result = opaque.makeImage() else { fatalError("Cannot create opaque icon") }
  return result
}

func resized(_ image: CGImage, pixels: Int) -> CGImage {
  guard let context = CGContext(
    data: nil,
    width: pixels,
    height: pixels,
    bitsPerComponent: 8,
    bytesPerRow: pixels * 4,
    space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
  ) else { fatalError("Cannot create preview context") }
  context.interpolationQuality = .high
  context.draw(image, in: CGRect(x: 0, y: 0, width: pixels, height: pixels))
  guard let result = context.makeImage() else { fatalError("Cannot resize icon") }
  return result
}

let contents = """
{
  "images" : [
    {
      "filename" : "%@-1024.png",
      "idiom" : "universal",
      "platform" : "ios",
      "size" : "1024x1024"
    }
  ],
  "info" : {
    "author" : "nexus",
    "version" : 1
  }
}
"""

try write(resized(sourceImage, pixels: 256), to: previewRoot.appendingPathComponent("nexus-primary.png"))
for style in styles {
  let icon = recolor(red: style.red, green: style.green, blue: style.blue)
  let setName = style.nativeName!
  let assetDirectory = assetRoot.appendingPathComponent("\(setName).appiconset")
  try write(icon, to: assetDirectory.appendingPathComponent("\(setName)-1024.png"))
  try String(format: contents, setName).write(
    to: assetDirectory.appendingPathComponent("Contents.json"),
    atomically: true,
    encoding: .utf8
  )
  try write(resized(icon, pixels: 256), to: previewRoot.appendingPathComponent("nexus-\(style.id).png"))
}

print("Generated five opaque alternate app icons and six previews")
