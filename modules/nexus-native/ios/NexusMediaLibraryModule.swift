import ExpoModulesCore
import MediaPlayer
import UIKit
import CryptoKit

private final class DeviceMediaLibraryCore {
  private var snapshot: [MPMediaItem] = []
  private var snapshotID = ""
  func failure(_ message: String) -> NSError { NSError(domain: "NexusMediaLibrary", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
  func status() -> String {
    switch MPMediaLibrary.authorizationStatus() {
    case .authorized: return "authorized"
    case .denied: return "denied"
    case .restricted: return "restricted"
    case .notDetermined: return "notDetermined"
    @unknown default: return "unavailable"
    }
  }
  func invalidate() { snapshot = []; snapshotID = "" }
  func authorizationStatus() -> String { let value = status(); if value != "authorized" { invalidate() }; return value }
  private func signature(_ item: MPMediaItem) -> String {
    let values: [String] = [item.title ?? "", item.artist ?? "", item.albumTitle ?? "", item.albumArtist ?? "", String(item.playbackDuration)]
    let data = (try? JSONSerialization.data(withJSONObject: values)) ?? Data()
    return SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
  }
  private func reason(_ item: MPMediaItem) -> String {
    if item.hasProtectedAsset { return "protected" }
    if item.assetURL == nil { return item.isCloudItem ? "cloud" : "unavailable" }
    return ""
  }
  private func item(_ id: String, _ expected: String) throws -> MPMediaItem {
    guard status() == "authorized", let value = UInt64(id), value > 0 else { throw failure("媒体库未授权或歌曲标识无效") }
    let query = MPMediaQuery.songs()
    query.addFilterPredicate(MPMediaPropertyPredicate(value: NSNumber(value: value), forProperty: MPMediaItemPropertyPersistentID))
    guard let item = query.items?.first, signature(item) == expected else { throw failure("歌曲已移除或信息已更改，请刷新媒体库重新选择") }
    return item
  }
  func beginQuery(_ search: String) throws -> [String: Any] {
    guard status() == "authorized" else { throw failure("请先授权访问设备媒体库") }
    let text = search.trimmingCharacters(in: .whitespacesAndNewlines)
    let all = MPMediaQuery.songs().items ?? []
    guard all.count <= 50000 else { throw failure("设备媒体库超过当前50000首索引上限") }
    snapshot = text.isEmpty ? all : all.filter { item in
      let searchable: String = [item.title ?? "", item.artist ?? "", item.albumTitle ?? ""].joined(separator: " ")
      return searchable.localizedCaseInsensitiveContains(text)
    }
    snapshotID = UUID().uuidString
    return ["token": snapshotID, "total": snapshot.count]
  }
  func page(_ token: String, _ offset: Int, _ limit: Int) throws -> [[String: Any]] {
    guard status() == "authorized", token == snapshotID, offset >= 0, offset <= snapshot.count, limit > 0, limit <= 200 else { throw failure("媒体库已变化，请刷新") }
    return snapshot.dropFirst(offset).prefix(limit).map { item -> [String: Any] in
      var row: [String: Any] = ["id": String(item.persistentID), "signature": signature(item)]
      row["title"] = item.title ?? "未知标题"; row["artist"] = item.artist ?? "未知艺术家"
      row["album"] = item.albumTitle ?? ""; row["albumArtist"] = item.albumArtist ?? item.artist ?? ""
      row["durationMs"] = max(0, item.playbackDuration * 1000); row["reason"] = reason(item)
      return row
    }
  }
  func resolve(_ id: String, _ expected: String) throws -> String {
    let value = try item(id, expected)
    guard reason(value).isEmpty, let url = value.assetURL else { throw failure("此媒体受保护或未下载到设备，请先在音乐App中检查") }
    return url.absoluteString
  }
  func lyrics(_ id: String, _ expected: String) throws -> String? {
    let text = try item(id, expected).lyrics
    return (text?.utf8.count ?? 0) <= 2097152 ? text : nil
  }
  func artwork(_ id: String, _ expected: String) throws -> String? {
    let value = try item(id, expected)
    let version = String(MPMediaLibrary.default().lastModifiedDate.timeIntervalSince1970)
    let key = SHA256.hash(data: Data((id + ":" + expected + ":" + version).utf8)).map { String(format: "%02x", $0) }.joined()
    if let hit = CoverCache.shared.hit(key) { return hit }
    guard let data = value.artwork?.image(at: CGSize(width: 512, height: 512))?.jpegData(compressionQuality: 0.85) else { return nil }
    return CoverCache.shared.store(data, key: key)
  }
}

public final class NexusMediaLibraryModule: Module {
  private let queue = DispatchQueue(label: "nexus.device-media")
  private let core = DeviceMediaLibraryCore()
  private var observer: NSObjectProtocol?
  private var closed = false
  private func watch() {
    DispatchQueue.main.async { [weak self] in
      guard let self, !self.closed, self.observer == nil else { return }
      MPMediaLibrary.default().beginGeneratingLibraryChangeNotifications()
      self.observer = NotificationCenter.default.addObserver(forName: .MPMediaLibraryDidChange, object: nil, queue: nil) { [weak self] _ in
        guard let self else { return }
        self.queue.async { self.core.invalidate(); self.sendEvent("changed", ["status": self.core.status()]) }
      }
    }
  }
  public func definition() -> ModuleDefinition {
    Name("NexusMediaLibrary")
    Events("changed")
    AsyncFunction("authorizationStatus") { self.core.authorizationStatus() }.runOnQueue(queue)
    AsyncFunction("requestAuthorization") { (promise: Promise) in
      MPMediaLibrary.requestAuthorization { _ in promise.resolve(self.core.status()) }
    }.runOnQueue(.main)
    AsyncFunction("beginQuery") { (search: String) throws -> [String: Any] in self.watch(); return try self.core.beginQuery(search) }.runOnQueue(queue)
    AsyncFunction("page") { (token: String, offset: Int, limit: Int) throws -> [[String: Any]] in try self.core.page(token, offset, limit) }.runOnQueue(queue)
    AsyncFunction("resolve") { (id: String, expected: String) throws -> String in try self.core.resolve(id, expected) }.runOnQueue(queue)
    AsyncFunction("lyrics") { (id: String, expected: String) throws -> String? in try self.core.lyrics(id, expected) }.runOnQueue(queue)
    AsyncFunction("artwork") { (id: String, expected: String) throws -> String? in try self.core.artwork(id, expected) }.runOnQueue(CoverCache.queue)
    OnDestroy {
      DispatchQueue.main.async { self.closed = true; if let observer = self.observer { NotificationCenter.default.removeObserver(observer); self.observer = nil; MPMediaLibrary.default().endGeneratingLibraryChangeNotifications() } }
    }
  }
}
