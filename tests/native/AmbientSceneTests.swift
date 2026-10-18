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
    // E032 capture plus independent six-sector and near-gray boundary vectors.
    let colorOracle: [(String, Bool, [Int], [Double], [Double])] = [
      ("#000000", true, [87, 87, 87], [0.18764705882352944, 0.18764705882352944, 0.18764705882352944], [0.15694117647058822, 0.15694117647058822, 0.15694117647058822]),
      ("#000000", false, [184, 184, 184], [0.8607843137254902, 0.8607843137254902, 0.8607843137254902], [0.8886274509803922, 0.8886274509803922, 0.8886274509803922]),
      ("#ffffff", true, [87, 87, 87], [0.18764705882352944, 0.18764705882352944, 0.18764705882352944], [0.15694117647058822, 0.15694117647058822, 0.15694117647058822]),
      ("#ffffff", false, [184, 184, 184], [0.8607843137254902, 0.8607843137254902, 0.8607843137254902], [0.8886274509803922, 0.8886274509803922, 0.8886274509803922]),
      ("#808080", true, [87, 87, 87], [0.18764705882352944, 0.18764705882352944, 0.18764705882352944], [0.15694117647058822, 0.15694117647058822, 0.15694117647058822]),
      ("#808080", false, [184, 184, 184], [0.8607843137254902, 0.8607843137254902, 0.8607843137254902], [0.8886274509803922, 0.8886274509803922, 0.8886274509803922]),
      ("#ff0000", true, [155, 39, 39], [0.33431372549019606, 0.08411764705882355, 0.08411764705882355], [0.27960784313725484, 0.07035294117647059, 0.07035294117647059]),
      ("#ff0000", false, [213, 134, 134], [0.9176470588235295, 0.7627450980392156, 0.7627450980392156], [0.9341176470588235, 0.8101960784313725, 0.8101960784313725]),
      ("#00ff00", true, [39, 155, 39], [0.08411764705882355, 0.33431372549019606, 0.08411764705882355], [0.07035294117647059, 0.27960784313725484, 0.07035294117647059]),
      ("#00ff00", false, [134, 213, 134], [0.7627450980392156, 0.9176470588235295, 0.7627450980392156], [0.8101960784313725, 0.9341176470588235, 0.8101960784313725]),
      ("#0000ff", true, [39, 39, 155], [0.08411764705882355, 0.08411764705882355, 0.33431372549019606], [0.07035294117647059, 0.07035294117647059, 0.27960784313725484]),
      ("#0000ff", false, [134, 134, 213], [0.7627450980392156, 0.7627450980392156, 0.9176470588235295], [0.8101960784313725, 0.8101960784313725, 0.9341176470588235]),
      ("#abcdef", true, [51, 105, 159], [0.11000000000000001, 0.22647058823529412, 0.34294117647058825], [0.092, 0.18941176470588234, 0.2868235294117647]),
      ("#abcdef", false, [148, 183, 217], [0.7901960784313726, 0.8588235294117648, 0.9254901960784314], [0.832156862745098, 0.8870588235294117, 0.9403921568627451]),
      ("#123456", true, [44, 88, 131], [0.09490196078431373, 0.18980392156862746, 0.2825490196078431], [0.07937254901960783, 0.15874509803921566, 0.23631372549019602]),
      ("#123456", false, [121, 164, 208], [0.7372549019607844, 0.8215686274509804, 0.907843137254902], [0.7898039215686274, 0.8572549019607842, 0.9262745098039216]),
      ("#887f7f", true, [90, 84, 84], [0.19411764705882356, 0.1811764705882353, 0.1811764705882353], [0.1623529411764706, 0.15152941176470586, 0.15152941176470586]),
      ("#887f7f", false, [186, 181, 181], [0.8647058823529412, 0.8549019607843138, 0.8549019607843138], [0.8917647058823529, 0.883921568627451, 0.883921568627451]),
      ("#ff8000", true, [155, 97, 39], [0.33431372549019606, 0.20921568627450982, 0.08411764705882355], [0.27960784313725484, 0.17498039215686273, 0.07035294117647059]),
      ("#ff8000", false, [213, 174, 134], [0.9176470588235295, 0.8411764705882353, 0.7627450980392156], [0.9341176470588235, 0.8729411764705882, 0.8101960784313725]),
      ("#00ffff", true, [39, 155, 155], [0.08411764705882355, 0.33431372549019606, 0.33431372549019606], [0.07035294117647059, 0.27960784313725484, 0.27960784313725484]),
      ("#00ffff", false, [134, 213, 213], [0.7627450980392156, 0.9176470588235295, 0.9176470588235295], [0.8101960784313725, 0.9341176470588235, 0.9341176470588235]),
      ("#ffff00", true, [155, 155, 39], [0.33431372549019606, 0.33431372549019606, 0.08411764705882355], [0.27960784313725484, 0.27960784313725484, 0.07035294117647059]),
      ("#ffff00", false, [213, 213, 134], [0.9176470588235295, 0.9176470588235295, 0.7627450980392156], [0.9341176470588235, 0.9341176470588235, 0.8101960784313725]),
      ("#ff00ff", true, [155, 39, 155], [0.33431372549019606, 0.08411764705882355, 0.33431372549019606], [0.27960784313725484, 0.07035294117647059, 0.27960784313725484]),
      ("#ff00ff", false, [213, 134, 213], [0.9176470588235295, 0.7627450980392156, 0.9176470588235295], [0.9341176470588235, 0.8101960784313725, 0.9341176470588235]),
      ("#888080", true, [90, 84, 84], [0.19411764705882356, 0.1811764705882353, 0.1811764705882353], [0.1623529411764706, 0.15152941176470586, 0.15152941176470586]),
      ("#888080", false, [186, 181, 181], [0.8647058823529412, 0.8549019607843138, 0.8549019607843138], [0.8917647058823529, 0.883921568627451, 0.883921568627451]),
      ("#887979", true, [92, 82, 82], [0.19843137254901963, 0.17686274509803923, 0.17686274509803923], [0.16596078431372546, 0.14792156862745098, 0.14792156862745098]),
      ("#887979", false, [188, 179, 179], [0.8686274509803922, 0.8509803921568627, 0.8509803921568627], [0.8949019607843137, 0.8807843137254902, 0.8807843137254902]),
      ("#887878", true, [122, 72, 72], [0.2631372549019608, 0.15529411764705883, 0.15529411764705883], [0.220078431372549, 0.12988235294117645, 0.12988235294117645]),
      ("#887878", false, [195, 152, 152], [0.8823529411764706, 0.7980392156862746, 0.7980392156862746], [0.9058823529411765, 0.8384313725490196, 0.8384313725490196]),
    ]
    for (hex, dark, bytes, first, second) in colorOracle {
      let value = AmbientScene.RGB(hex: hex)!.softened(dark: dark)
      precondition(value.channels.map { Int(($0 * 255).rounded()) } == bytes)
      let colorScene = AmbientScene(colors: [hex], identity: "color", dark: dark)!
      for (actual, expected) in zip(colorScene.base.map(\.channels), [first, second]) {
        precondition(zip(actual, expected).allSatisfy { abs($0 - $1) < 1e-12 })
      }
      let imageBytes = Array(colorScene.images[0].dataProvider!.data! as Data)
      let centerOffset: Int = (72 * 144 + 72) * 4
      let centerPixel: [UInt8] = Array(imageBytes[centerOffset..<(centerOffset + 4)])
      let expectedPixel: [UInt8] = bytes.map { UInt8($0) } + [UInt8(255)]
      precondition(centerPixel == expectedPixel, "The same quantized palette must feed the soft light")
    }
    let two = AmbientScene(colors: ["#ff0000", "#0000ff", "#00ff00"], identity: "two", dark: false)!
    precondition(abs(two.base[1].blue - 0.9341176470588235) < 1e-12 && abs(two.base[1].red - 0.8101960784313725) < 1e-12, "Second stop comes from index1; third color remains a light")
    for dark in [true, false] {
      let overlay = AmbientScene.overlay(dark: dark)
      let expectedAlpha: [CGFloat] = dark ? [4.0 / 255.0, 24.0 / 255.0] : [18.0 / 255.0, 48.0 / 255.0]
      let expectedComponent: CGFloat = dark ? 0 : 1
      precondition(overlay.count == expectedAlpha.count)
      for (index, color) in overlay.enumerated() {
        precondition(abs(color.alpha - expectedAlpha[index]) < 1e-12)
        precondition(abs(color.components![0] - expectedComponent) < 1e-12)
      }
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
    let single = AmbientScene(colors: ["#FF0000"], identity: "a", dark: true)!
    precondition(single.images.count == 1 && single.base.count == 2)
    precondition(abs(single.base[1].red - 0.27960784313725484) < 1e-12)
    precondition(AmbientScene(colors: [], identity: "a") == nil)
    precondition(AmbientScene(colors: Array(repeating: "#FF0000", count: 4), identity: "a") == nil)
    precondition(AmbientScene(colors: ["#FF0000", "#00FF00", "bad"], identity: "a") == nil)
    let scene = AmbientScene(colors: ["#FF0000", "#00FF00", "#0000FF"], identity: "fixture")!
    let same = AmbientScene(colors: ["#FF0000", "#00FF00", "#0000FF"], identity: "fixture")!
    let other = AmbientScene(colors: ["#FF0000", "#00FF00", "#0000FF"], identity: "other")!
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
          space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedLast.rawValue)!
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
        // Four premultiplied 8-bit layers can round a boundary channel by one.
        precondition((133...249).contains(buffer[offset]) && (133...241).contains(buffer[offset + 1]) && (133...249).contains(buffer[offset + 2]), "Softened RGB lights must stay inside their independent E032 byte envelope and backdrop, with one byte compositing tolerance")
      }
    }
    print("PASS ambient: E03220plus12boundaryHSLbyte/floatvectors,single/second/third,sharedsoftlight,themeoverlay;cubic/two owners;E031 independent PRNG vectors and all32field parameters/period/phase/direction;audited anchors,rotating physical projections portrait/landscape;UTF16,144RGBA,finite geometry,actual motion raster and bounded composition")
  }
}
