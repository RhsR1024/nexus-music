import Foundation

// Two visual owners only. Asynchronous media identity remains in CoverThemeStore.
struct AmbientTransition<Value> {
  private(set) var current: Value?
  private(set) var previous: Value?
  private(set) var startedAt: Double?
  static var duration: Double { 0.6 }
  mutating func replace(_ value: Value?, at time: Double, animated: Bool) {
    previous = animated && value != nil ? current : nil
    current = value
    startedAt = previous != nil && time.isFinite ? time : nil
    if startedAt == nil { previous = nil }
  }
  mutating func settle() { previous = nil; startedAt = nil }
  mutating func advance(to time: Double) {
    if let startedAt, !time.isFinite || time - startedAt >= Self.duration { settle() }
  }
  func weight(at time: Double) -> Double {
    guard let startedAt else { return 1 }
    return Self.curve((time - startedAt) / Self.duration)
  }
  static func curve(_ fraction: Double) -> Double {
    guard fraction.isFinite else { return 1 }
    let x = min(1, max(0, fraction))
    if x == 0 || x == 1 { return x }
    // Solve Cubic(.645,.045,.355,1)'s time coordinate, then its value.
    func coordinate(_ t: Double, _ a: Double, _ b: Double) -> Double {
      let u = 1 - t
      return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t
    }
    var lower = 0.0, upper = 1.0
    for _ in 0..<24 {
      let t = (lower + upper) / 2
      if coordinate(t, 0.645, 0.355) < x { lower = t } else { upper = t }
    }
    return coordinate((lower + upper) / 2, 0.045, 1)
  }
}
