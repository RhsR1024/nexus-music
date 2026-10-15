import Foundation
@main enum SleepTimerTests {
  static func main() {
    var tasks: [() -> Void] = [], pauses = 0, cancelled = 0
    let timer = PlaybackSleepTimer(now: { 1000 }, schedule: { _, action in tasks.append(action); return { cancelled += 1 } }, changed: { _ in }, expired: { pauses += 1 })
    assert(timer.set(seconds: 60, entryID: nil)); assert(timer.snapshot()["deadline"] as? Double == 61000)
    assert(!timer.set(seconds: .nan, entryID: nil)); assert(timer.snapshot()["mode"] as? String == "duration")
    assert(timer.set(seconds: 120, entryID: nil)); tasks[0](); assert(pauses == 0 && cancelled == 1)
    assert(timer.set(seconds: 0, entryID: nil)); tasks[1](); assert(pauses == 0 && timer.snapshot()["mode"] as? String == "off")
    assert(timer.set(seconds: 0, entryID: "first")); timer.trackChanged(to: "first"); assert(!timer.ended("stale")); assert(timer.ended("first")); assert(pauses == 1); assert(!timer.ended("first"))
    assert(timer.set(seconds: 0, entryID: "first")); timer.trackChanged(to: "next"); assert(!timer.ended("first")); assert(pauses == 1)
    assert(timer.set(seconds: 1, entryID: nil)); tasks.last!(); tasks.last!(); assert(pauses == 2)
    assert(timer.set(seconds: 1, entryID: nil)); timer.dispose(); tasks.last!(); assert(pauses == 2)
    print("Native sleep timer checks passed: stale expiry/cancel/replace/track binding/once/dispose/invalid input")
  }
}
