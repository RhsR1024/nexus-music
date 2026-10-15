import Foundation
@main struct AudioCacheTests {
  static func main() throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: directory) }
    let cache = AudioCache(directory: directory), a = String(repeating: "a", count: 64), b = String(repeating: "b", count: 64)
    let writer = cache.writer(a)!
    writer.write(Data([4, 5, 6]), offset: 3, total: 6)
    assert(cache.hit(a) == nil, "Partial data must never be playable")
    writer.write(Data([1, 2]), offset: 0, total: 6)
    assert(cache.hit(a) == nil, "Sparse gaps must not count as downloaded bytes")
    writer.write(Data([3, 4]), offset: 2, total: 6)
    let contents = try Data(contentsOf: cache.hit(a)!)
    assert(contents == Data([1, 2, 3, 4, 5, 6]))
    cache.retain(a); cache.clear(); assert(cache.hit(a) != nil, "Clearing must preserve active playback")
    cache.release(a); cache.clear(); assert(cache.hit(a) == nil)
    let stale = cache.writer(b)!; stale.write(Data([1, 2]), offset: 0, total: 4)
    cache.clear(); stale.write(Data([3, 4]), offset: 2, total: 4)
    assert(cache.hit(b) == nil, "A cleared cache must not be resurrected by older writes")
    let inconsistent = cache.writer(b)!; inconsistent.write(Data([1, 2]), offset: 0, total: 4); inconsistent.write(Data([3, 4]), offset: 2, total: 5)
    assert(cache.hit(b) == nil)
    assert(cache.writer("../escape") == nil)
    let complete = cache.writer(b)!; complete.write(Data([9, 8]), offset: 0, total: 2)
    cache.invalidate(b); assert(cache.hit(b) == nil)
    print("Native audio cache checks passed: sparse ranges, active retention, clear epochs, changed length and invalidation")
  }
}
