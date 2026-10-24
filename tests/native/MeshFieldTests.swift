import Foundation
import CoreGraphics

@main struct MeshFieldTests {
  static func main() {
    // Palette validation: 1–3 parseable hex entries, softened per mode.
    precondition(MeshField.palette(from: ["#FF0000"], dark: true)?.count == 1)
    precondition(MeshField.palette(from: ["#FF0000", "#00FF00", "#0000FF"], dark: false)?.count == 3)
    precondition(MeshField.palette(from: [], dark: true) == nil)
    precondition(MeshField.palette(from: ["#FF0000", "zz"], dark: true) == nil)
    precondition(MeshField.palette(from: ["#FF0000", "#00FF00", "#0000FF", "#123456"], dark: true) == nil)

    precondition(MeshField(colors: ["#FF0000"], identity: "a", dark: true) != nil)
    precondition(MeshField(colors: ["nope"], identity: "a", dark: true) == nil)

    let field = MeshField(colors: ["#FF0000", "#00FF00", "#0000FF"], identity: "shape-of-you", dark: true)!
    precondition(field.vertices.count == 9 && field.colors.count == 9)

    // The drift must never fold the grid for any rendered time.
    precondition(MeshField.gridStaysValid(field))
    for identity in ["", "A", "音枢", "song-2", "https://example/x"] {
      let candidate = MeshField(colors: ["#123456", "#654321", "#abcdef"], identity: identity, dark: false)!
      precondition(MeshField.gridStaysValid(candidate), identity)
    }

    // Determinism: identical inputs reproduce the same points; a new identity
    // reseeds the field.
    let a = MeshField(colors: ["#102030"], identity: "same", dark: true)!
    let b = MeshField(colors: ["#102030"], identity: "same", dark: true)!
    let c = MeshField(colors: ["#102030"], identity: "other", dark: true)!
    precondition(a.points(at: 12.34) == b.points(at: 12.34))
    precondition(a.points(at: 5) != c.points(at: 5))
    // The field actually moves with time.
    precondition(a.points(at: 0) != a.points(at: 2.5))

    // Color layout: the top row carries the palette, lower rows blend toward
    // the last entry; a single color stays uniform.
    let palette = MeshField.palette(from: ["#FF0000", "#00FF00", "#0000FF"], dark: true)!
    let colors = MeshField.colors(from: palette)
    precondition(colors[0] == palette[0])
    precondition(colors[2] == palette[1])
    precondition(colors[6] != colors[0] && colors[8] != colors[2])
    precondition(colors[6].blue > colors[0].blue, "bottom row must pull toward the blue entry")
    let single = MeshField.palette(from: ["#445566"], dark: false)!
    let uniform = MeshField.colors(from: single)
    precondition(uniform[0] == single[0] && uniform[2] == single[0] && uniform[8] == single[0])

    // Drift gating: time advances only while moving, and a pause parks the
    // phase so the resumed field does not jump (decision 0081).
    var timeline = MeshTimeline()
    precondition(!timeline.moving && timeline.time(at: 100) == 0)
    timeline.setMoving(true, at: 10)
    precondition(timeline.moving)
    precondition(timeline.time(at: 12.5) == 2.5)
    timeline.setMoving(false, at: 13)
    precondition(!timeline.moving)
    precondition(timeline.time(at: 99) == 3)
    timeline.setMoving(true, at: 100)
    precondition(timeline.time(at: 101) == 4)
    // Repeated identical gate values neither reset nor double count.
    timeline.setMoving(true, at: 102)
    precondition(timeline.time(at: 103) == 6)
    timeline.setMoving(false, at: 103)
    timeline.setMoving(false, at: 110)
    precondition(timeline.time(at: 120) == 6)
    // Non-finite input is ignored instead of corrupting the phase.
    timeline.setMoving(true, at: .nan)
    timeline.setMoving(true, at: .infinity)
    precondition(timeline.time(at: .nan) == 6)

    print("mesh-field tests passed")
  }
}
