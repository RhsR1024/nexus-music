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
    // Independent bounded ARM64 interpreter vectors (E031), not the Swift PRNG.
    for (seed, warmup, units) in [
      (UInt32(0), UInt64(0x1000fcf2a2bf3dbd), [0.8255140718871702, 0.8863148172405516, 0.424722653321134]),
      (UInt32(1), UInt64(0x8173a7ca276dad1a), [0.5785012864412081, 0.25563430262583553, 0.9199665121717772]),
      (UInt32(140744672), UInt64(0x23f667f6c90ee3ee), [0.19281441173589609, 0.9128120092784953, 0.4863844335677777]),
      (UInt32(1143895498), UInt64(0xccf08f8854cb789a), [0.5335917783994197, 0.07365247480040804, 0.20058787589898042]),
      (UInt32(0xffffffff), UInt64(0x2c3d97bee5d8b5d8), [0.09026560271896933, 0.06145682351926385, 0.7684110377449928])
    ] {
      var random = AmbientScene.Random(seed: seed)
      precondition(random.state == warmup)
      for expected in units { precondition(random.unit() == expected) }
    }
    let oracle = [0.6423800803434274,0.7996776565954771,0.7328928612880675,0.5038841947976348,0.5370979384379907,0.15002840077248558,0.746054916324208,0.19892449669909162,0.7358964947715063,0.6261406109570188,0.7229430716217585,0.21253528162167445,0.6478638577634781,0.9753633612231072,0.15923753158162623,0.7660382389049191,0.5522403967356488,0.49906547263420753,0.8212380075226587,0.18974153784060588,0.14303750933699588,0.8536244501538214,0.648370361401777,0.6419638026987944,0.7556728062904924,0.17075917564416732,0.7916080401322311,0.20964516342084472,0.9419019599461145,0.9385626596645583,0.38139896476549684,0.6780317380183377]
    let seeded = AmbientScene(colors: ["#ff0000", "#00ff00", "#0000ff"], identity: "A")!
    let anchors = [CGPoint(x:0.12,y:0.18),CGPoint(x:0.88,y:0.38),CGPoint(x:0.32,y:0.84),CGPoint(x:0.82,y:0.92)]
    for (i, field) in seeded.fields.enumerated() {
      let u = Array(oracle[(i*8)..<(i*8+8)])
      precondition(field.anchor == anchors[i])
      let actual = [field.amplitude.x,field.amplitude.y,field.xPeriod,field.yPeriod,field.phase,field.width,field.height,field.opacity]
      let expected = [0.15+0.1*u[0],0.13+0.09*u[1],9+7*u[2],12+9*u[3],2*Double.pi*u[4],0.9+0.22*u[5],0.62+0.18*u[6],0.62+0.1*u[7]]
      precondition(zip(actual,expected).allSatisfy { abs($0-$1)<1e-12 })
    }
    precondition(seeded.period == 29.87799315851748 && seeded.phase == 6.014735737790118 && seeded.direction == 1)
    precondition(abs(seeded.angle(at: seeded.period/4)-seeded.phase-Double.pi/2)<1e-12)
    precondition(seeded.angle(at: .nan) == seeded.phase)
    precondition(AmbientScene(colors:["#ff0000","#00ff00","#0000ff"],identity:"")!.direction == -1)
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
      for angle in [0.0, Double.pi/2, Double.pi, -0.8, seeded.angle(at: 3)] {
      let points = AmbientScene.gradientPoints(size: size, angle: angle)
      let dx = points.end.x - points.start.x, dy = points.end.y - points.start.y
      for point in [CGPoint.zero, CGPoint(x: 1, y: 1), CGPoint(x: 0.02, y: 0.52), CGPoint(x: 0.98, y: 0.8)] {
        let unitProjection = ((point.x - points.start.x) * dx + (point.y - points.start.y) * dy) / (dx * dx + dy * dy)
        let radius = 0.65 * max(size.width, size.height)
        let physicalProjection = 0.5 + ((point.x-0.5)*size.width*cos(angle)+(point.y-0.5)*size.height*sin(angle))/(2*radius)
        precondition(abs(unitProjection - physicalProjection) < 0.000001, "Native layer must match the rotating physical projection")
      }
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
    print("PASS ambient: cubic/two owners;E031 independent PRNG vectors and all32field parameters/period/phase/direction;audited anchors,rotating physical projections portrait/landscape;UTF16,144RGBA,finite geometry,actual motion raster and bounded composition")
  }
}
