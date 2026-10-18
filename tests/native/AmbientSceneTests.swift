import Foundation
import CoreGraphics

@main struct AmbientSceneTests {
  static func main() {
    typealias Transition = AmbientTransition<Int>
    precondition(Transition.curve(-1) == 0 && Transition.curve(2) == 1)
    for (fraction, expected) in [(0.25, 0.08723013674989044), (0.5, 0.516875), (0.75, 0.9312676058824476)] {
      precondition(abs(Transition.curve(fraction) - expected) < 0.000001)
    }
    let weights = (0...1000).map { Transition.curve(Double($0) / 1000) }
    precondition(zip(weights, weights.dropFirst()).allSatisfy { $0 <= $1 })
    precondition(weights.allSatisfy { $0 >= 0 && $0 <= 1 })
    var transition = Transition()
    transition.replace(1, at: 10, animated: true)
    precondition(transition.current == 1 && transition.previous == nil && transition.weight(at: 10) == 1)
    transition.replace(2, at: 20, animated: true)
    precondition(transition.previous == 1 && transition.current == 2 && transition.weight(at: 20) == 0)
    precondition(abs(transition.weight(at: 20.3) - 0.516875) < 0.000001)
    transition.replace(3, at: 20.4, animated: true)
    precondition(transition.previous == 2 && transition.current == 3 && transition.weight(at: 20.4) == 0)
    transition.advance(to: 21.1)
    precondition(transition.previous == nil && transition.current == 3 && transition.weight(at: 21.1) == 1)
    transition.replace(4, at: 22, animated: false)
    precondition(transition.previous == nil && transition.current == 4)
    transition.replace(5, at: 23, animated: true); transition.settle()
    precondition(transition.previous == nil && transition.current == 5 && transition.startedAt == nil)
    transition.replace(nil, at: 24, animated: true)
    precondition(transition.current == nil && transition.previous == nil)
    final class Owner {}
    var owners = AmbientTransition<Owner>()
    var first: Owner? = Owner(), second: Owner? = Owner(), third: Owner? = Owner()
    weak var old = first, current = second, latest = third
    owners.replace(first, at: 0, animated: true); first = nil
    owners.replace(second, at: 1, animated: true); second = nil
    precondition(old != nil && current != nil)
    owners.replace(third, at: 1.2, animated: true); third = nil
    precondition(old == nil && current != nil && latest != nil)
    owners.settle(); precondition(current == nil && latest != nil)
    owners.replace(nil, at: 2, animated: false); precondition(latest == nil)
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
      let points = AmbientScene.gradientPoints(size: size)
      let dx = points.end.x - points.start.x, dy = points.end.y - points.start.y
      for point in [CGPoint.zero, CGPoint(x: 1, y: 1), CGPoint(x: 0.02, y: 0.52), CGPoint(x: 0.98, y: 0.8)] {
        let unitProjection = ((point.x - points.start.x) * dx + (point.y - points.start.y) * dy) / (dx * dx + dy * dy)
        let physicalProjection = (point.x * size.width * size.width + point.y * size.height * size.height) / (size.width * size.width + size.height * size.height)
        precondition(abs(unitProjection - physicalProjection) < 0.000001, "Native layer must retain the existing physical gradient projection")
      }
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
    let firstRaster = rendered(0), secondRaster = rendered(3)
    precondition(firstRaster == rendered(0), "Stopped scenes must be stable")
    precondition(zip(firstRaster, secondRaster).filter { $0 != $1 }.count > 1000, "Actual raster must move")
    for buffer in [firstRaster, secondRaster] {
      for offset in stride(from: 0, to: buffer.count, by: 4) {
        precondition(buffer[offset + 3] == 255)
        precondition((231...255).contains(buffer[offset]) && (231...249).contains(buffer[offset + 1]) && (239...255).contains(buffer[offset + 2]), "Convex composition must stay in the bounded colors")
      }
    }
    print("PASS ambient: cubic independent samples/monotonicity,two-owner replacement/release/stop/clear;UTF16 seeds,144RGBA independent pixels,invalid colors,4finite fields,determinism,portrait/landscape geometry,actual motion raster and bounded composition")
  }
}
