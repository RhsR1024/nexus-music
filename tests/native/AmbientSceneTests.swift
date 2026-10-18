import Foundation
import CoreGraphics

@main struct AmbientSceneTests {
  static func main() {
    precondition(AmbientScene.seed("") == 2166136261)
    precondition(AmbientScene.seed("A") == 1141634764)
    precondition(AmbientScene.seed("音枢") == 140744672)
    precondition(AmbientScene.seed("🎵") == 1143895498)
    for invalid in ["private/path", "#123", "#+12345", "#12345g", "#１２３４５６"] { precondition(AmbientScene.softLight(invalid) == nil) }
    let red = AmbientScene.softLight("#FF0000")!
    precondition(red.width == 144 && red.height == 144)
    let bytes = Array(red.dataProvider!.data! as Data)
    func pixel(_ x: Int, _ y: Int) -> [UInt8] { Array(bytes[((y * 144 + x) * 4)..<((y * 144 + x) * 4 + 4)]) }
    precondition(pixel(72, 72) == [255, 0, 0, 255])
    precondition(pixel(0, 72) == [0, 0, 0, 0])
    precondition(pixel(0, 0) == [0, 0, 0, 0])
    precondition(pixel(108, 72) == [115, 0, 0, 115])
    precondition(pixel(36, 72) == pixel(108, 72) && pixel(72, 36) == pixel(72, 108))
    for offset in stride(from: 0, to: bytes.count, by: 4) { precondition(bytes[offset] <= bytes[offset + 3] && bytes[offset + 1] == 0 && bytes[offset + 2] == 0) }
    precondition(AmbientScene(colors: ["#FF0000"], identity: "a") == nil)
    precondition(AmbientScene(colors: ["#FF0000", "#00FF00", "bad"], identity: "a") == nil)
    let scene = AmbientScene(colors: ["#FFE8F0", "#E8F8F0", "#E8E8FF"], identity: "fixture")!
    let same = AmbientScene(colors: ["#FFE8F0", "#E8F8F0", "#E8E8FF"], identity: "fixture")!
    let other = AmbientScene(colors: ["#FFE8F0", "#E8F8F0", "#E8E8FF"], identity: "other")!
    precondition(scene.images.count == 3 && scene.fields.count == 4)
    precondition(scene.fields[0].phase == same.fields[0].phase && scene.fields[0].phase != other.fields[0].phase)
    let simple = AmbientScene.Field(anchor: CGPoint(x: 0.5, y: 0.5), amplitude: CGPoint(x: 0.2, y: 0.1), xPeriod: 10, yPeriod: 20, phase: 0, width: 0.9, height: 0.7, opacity: 0.7)
    precondition(scene.rect(simple, size: CGSize(width: 200, height: 100), time: 0) == CGRect(x: 10, y: -10, width: 180, height: 140))
    precondition(scene.rect(simple, size: CGSize(width: 200, height: 100), time: .nan) == scene.rect(simple, size: CGSize(width: 200, height: 100), time: 0))
    for size in [CGSize(width: 393, height: 852), CGSize(width: 1194, height: 834)] {
      for t in [0.0, 1, 3, 60, 3600] {
        for field in scene.fields {
          let r = scene.rect(field, size: size, time: t)
          precondition(r.width > 0 && r.height > 0 && r.minX.isFinite && r.minY.isFinite)
          precondition(r.width < max(size.width, size.height) * 1.5 && r.height < max(size.width, size.height))
        }
      }
    }
    func rendered(_ t: Double) -> [UInt8] {
      var pixels = [UInt8](repeating: 0, count: 120 * 180 * 4)
      pixels.withUnsafeMutableBytes { memory in
        let context = CGContext(data: memory.baseAddress, width: 120, height: 180, bitsPerComponent: 8, bytesPerRow: 480,
          space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedLast.rawValue)!
        context.setFillColor(red: 248 / 255, green: 240 / 255, blue: 248 / 255, alpha: 1)
        context.fill(CGRect(x: 0, y: 0, width: 120, height: 180))
        scene.draw(in: context, size: CGSize(width: 120, height: 180), time: t)
      }
      return pixels
    }
    let first = rendered(0), second = rendered(3)
    precondition(first == rendered(0), "Stopped scenes must be stable")
    precondition(zip(first, second).filter { $0 != $1 }.count > 1000, "Actual raster must move")
    for buffer in [first, second] {
      for offset in stride(from: 0, to: buffer.count, by: 4) {
        precondition(buffer[offset + 3] == 255)
        precondition((231...255).contains(buffer[offset]) && (231...249).contains(buffer[offset + 1]) && (239...255).contains(buffer[offset + 2]), "Convex composition must stay in the bounded colors")
      }
    }
    print("PASS ambient: UTF16 seeds,144RGBA independent pixels,invalid colors,4finite fields,determinism,portrait/landscape geometry,actual motion raster and bounded composition")
  }
}
