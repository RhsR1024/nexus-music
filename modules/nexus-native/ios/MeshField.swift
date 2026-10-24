import Foundation
import CoreGraphics

// Drift clock for the mesh (decision 0081). Motion accumulates only while the
// gate is open, so pausing parks the field and resuming continues from the
// parked phase instead of jumping to the wall clock. Pure value semantics keep
// the gating unit testable without UIKit or SwiftUI.
struct MeshTimeline {
  private(set) var accumulated = 0.0
  private var resumedAt: Double?

  var moving: Bool { resumedAt != nil }

  mutating func setMoving(_ value: Bool, at now: Double) {
    guard now.isFinite else { return }
    if value {
      if resumedAt == nil { resumedAt = now }
    } else if let start = resumedAt {
      accumulated += max(0, now - start)
      resumedAt = nil
    }
  }

  func time(at now: Double) -> Double {
    guard let start = resumedAt, now.isFinite else { return accumulated }
    return accumulated + max(0, now - start)
  }
}

// Seeded math for the AM dynamic mesh background (decision 0081). Pure
// Foundation/CoreGraphics so the layout, drift and color mapping stay unit
// testable without UIKit or SwiftUI. The view layer owns rendering only.
struct MeshField {
  struct Vertex {
    let anchor: CGPoint
    let amplitude: CGSize
    let xPeriod: Double
    let yPeriod: Double
    let phase: Double
  }

  let vertices: [Vertex]
  let colors: [AmbientScene.RGB]

  static func palette(from hexes: [String], dark: Bool) -> [AmbientScene.RGB]? {
    guard (1...3).contains(hexes.count) else { return nil }
    let raw = hexes.compactMap { AmbientScene.RGB(hex: $0) }
    guard raw.count == hexes.count else { return nil }
    return raw.map { $0.softened(dark: dark) }
  }

  // Row-major 3x3 color layout: the palette spreads across the top edge and
  // blends toward the last entry near the bottom, mirroring the ambient base
  // mixing so both layers read as one scene.
  static func colors(from palette: [AmbientScene.RGB]) -> [AmbientScene.RGB] {
    let left = palette[0]
    let right = palette[min(1, palette.count - 1)]
    let low = palette[palette.count - 1]
    func mid(_ a: AmbientScene.RGB, _ b: AmbientScene.RGB) -> AmbientScene.RGB {
      .init((a.red + b.red) / 2, (a.green + b.green) / 2, (a.blue + b.blue) / 2)
    }
    func top(_ column: Int) -> AmbientScene.RGB {
      column == 0 ? left : column == 1 ? mid(left, right) : right
    }
    func blend(_ top: AmbientScene.RGB, toward low: AmbientScene.RGB, amount: Double) -> AmbientScene.RGB {
      .init(
        top.red * (1 - amount) + low.red * amount,
        top.green * (1 - amount) + low.green * amount,
        top.blue * (1 - amount) + low.blue * amount)
    }
    return (0..<9).map { index in
      let row = index / 3, column = index % 3
      let base = top(column)
      guard row > 0 else { return base }
      return blend(base, toward: low, amount: row == 1 ? 0.42 : 0.78)
    }
  }

  init?(colors hexes: [String], identity: String, dark: Bool) {
    guard let palette = Self.palette(from: hexes, dark: dark) else { return nil }
    var random = AmbientScene.Random(seed: AmbientScene.seed(identity))
    func unit() -> Double { random.unit() }
    var builder: [Vertex] = []
    builder.reserveCapacity(9)
    for index in 0..<9 {
      let row = index / 3, column = index % 3
      let anchor = CGPoint(x: Double(column) / 2, y: Double(row) / 2)
      // Interior points travel furthest; corners stay near the frame so the
      // mesh never folds (neighbor gap 0.5 vs worst approach < 0.2).
      let travel = (row == 1 ? 0.085 : 0.05) + (column == 1 ? 0.02 : 0) + 0.015 * unit()
      builder.append(Vertex(
        anchor: anchor,
        amplitude: CGSize(width: travel * (0.8 + 0.4 * unit()), height: travel * (0.8 + 0.4 * unit())),
        xPeriod: 11 + 9 * unit(),
        yPeriod: 13 + 10 * unit(),
        phase: 2 * .pi * unit()))
    }
    vertices = builder
    colors = Self.colors(from: palette)
  }

  func position(_ vertex: Vertex, at time: Double) -> CGPoint {
    let t = time.isFinite ? max(0, time) : 0
    let a = 2 * .pi * t / vertex.xPeriod + vertex.phase
    let b = 2 * .pi * t / vertex.yPeriod + 0.83 * vertex.phase
    let x = vertex.anchor.x + vertex.amplitude.width * (0.62 * sin(a) + 0.38 * sin(1.57 * b + 0.4 * vertex.phase))
    let y = vertex.anchor.y + vertex.amplitude.height * (0.62 * cos(b) + 0.38 * cos(1.43 * a - 0.5 * vertex.phase))
    return CGPoint(x: x, y: y)
  }

  func points(at time: Double) -> [CGPoint] {
    vertices.map { position($0, at: time) }
  }

  // The drift keeps rows and columns strictly separated for every time value
  // the view can render; callers use this to assert the mesh never folds.
  static func gridStaysValid(_ field: MeshField, samples: Int = 240, horizon: Double = 120) -> Bool {
    for step in 0...samples {
      let points = field.points(at: horizon * Double(step) / Double(samples))
      guard points.count == 9 else { return false }
      for row in 0..<3 {
        let base = row * 3
        guard points[base].x < points[base + 1].x, points[base + 1].x < points[base + 2].x else { return false }
      }
      for column in 0..<3 {
        guard points[column].y < points[3 + column].y, points[3 + column].y < points[6 + column].y else { return false }
      }
      for point in points where !(point.x > -0.2 && point.x < 1.2 && point.y > -0.2 && point.y < 1.2) { return false }
    }
    return true
  }
}
