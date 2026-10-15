import Foundation

// Playback-scoped timer, independent of the JavaScript event loop.
final class PlaybackSleepTimer {
  private var revision = 0
  private var cancelTask: (() -> Void)?
  private var deadline: Double?
  private var entry: String?
  private let now: () -> Double
  private let schedule: (Double, @escaping () -> Void) -> (() -> Void)
  private let changed: ([String: Any]) -> Void
  private let expired: () -> Void
  init(now: @escaping () -> Double = { Date().timeIntervalSince1970 * 1000 },
       schedule: @escaping (Double, @escaping () -> Void) -> (() -> Void) = { seconds, action in
         let item = DispatchWorkItem(block: action); DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: item)
         return { item.cancel() }
       }, changed: @escaping ([String: Any]) -> Void, expired: @escaping () -> Void) {
    self.now = now; self.schedule = schedule; self.changed = changed; self.expired = expired
  }
  func snapshot() -> [String: Any] {
    if let deadline { return ["mode": "duration", "deadline": deadline, "revision": revision] }
    if let entry { return ["mode": "track", "entryId": entry, "revision": revision] }
    return ["mode": "off", "revision": revision]
  }
  @discardableResult func set(seconds: Double, entryID: String?) -> Bool {
    guard seconds.isFinite, seconds >= 0, seconds <= 86400, seconds == 0 || entryID == nil else { return false }
    reset()
    if let entryID, !entryID.isEmpty { entry = entryID }
    else if seconds > 0 {
      deadline = now() + seconds * 1000; let token = revision
      cancelTask = schedule(seconds) { [weak self] in
        guard let self, self.revision == token, self.deadline != nil else { return }
        self.reset(); self.changed(self.snapshot()); self.expired()
      }
    }
    changed(snapshot()); return true
  }
  func trackChanged(to id: String) {
    if let entry, entry != id { reset(); changed(snapshot()) }
  }
  func ended(_ id: String) -> Bool {
    guard entry == id else { return false }
    reset(); changed(snapshot()); expired(); return true
  }
  func dispose() { reset() }
  private func reset() { revision += 1; cancelTask?(); cancelTask = nil; deadline = nil; entry = nil }
  deinit { cancelTask?() }
}
