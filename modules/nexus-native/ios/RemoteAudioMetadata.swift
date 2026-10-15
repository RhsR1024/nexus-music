import Foundation
import AVFoundation

enum RemoteAudioMetadata {
  static func inspect(_ media: [String: Any], key: String) async throws -> [String: Any] {
    guard key.count == 64, key.allSatisfy({ $0.isHexDigit && !$0.isUppercase }),
          let raw = media["url"] as? String, let url = URL(string: raw), let root = media["redirectRoot"] as? String,
          let scope = try? DAVScope(root), scope.contains(url), let headers = media["headers"] as? [String: String] else { throw DAVHTTP.failure(1) }
    let loader = AudioResourceLoader(url: url, headers: headers, redirectRoot: root, byteBudget: 16 * 1024 * 1024)
    let asset = loader.asset
    let coverEpoch = CoverCache.queue.sync { CoverCache.shared.epoch }
    defer { loader.destroy() }
    return try await withTaskCancellationHandler(operation: {
      try await withThrowingTaskGroup(of: [String: Any].self) { group in
        group.addTask { try await read(asset, key: key, coverEpoch: coverEpoch) }
        group.addTask { try await Task.sleep(nanoseconds: 15_000_000_000); asset.cancelLoading(); throw DAVHTTP.failure(3) }
        defer { group.cancelAll() }
        guard let result = try await group.next() else { throw DAVHTTP.failure(4) }
        return result
      }
    }, onCancel: { asset.cancelLoading(); loader.destroy() })
  }
  private static func read(_ asset: AVURLAsset, key: String, coverEpoch: Int) async throws -> [String: Any] {
    let duration = try await asset.load(.duration).seconds
    guard duration.isFinite, duration > 0 else { throw DAVHTTP.failure(4) }
    let common = try await asset.load(.commonMetadata), metadata = try await asset.load(.metadata)
    var result: [String: Any] = ["durationMs": duration * 1000]
    for item in common.prefix(256) {
      try Task.checkCancellation()
      if item.commonKey == .commonKeyArtwork, let data = try? await item.load(.dataValue), data.count <= 8 * 1024 * 1024 {
        if let file = CoverCache.queue.sync(execute: { CoverCache.shared.epoch == coverEpoch ? CoverCache.shared.store(data, key: key) : nil }) { result["artwork"] = file }; continue
      }
      guard let text = try? await item.load(.stringValue), !text.isEmpty, text.utf8.count < 16384 else { continue }
      switch item.commonKey {
      case .commonKeyTitle: result["title"] = text
      case .commonKeyArtist: result["artist"] = text
      case .commonKeyAlbumName: result["album"] = text
      default: break
      }
    }
    for item in metadata.prefix(256) {
      try Task.checkCancellation()
      let id = item.identifier?.rawValue ?? ""
      if id.contains("USLT") || id.contains("©lyr") || id.lowercased().contains("lyrics") {
        if let text = try? await item.load(.stringValue), text.utf8.count <= 2097152 { result["lyric"] = text; break }
      }
    }
    try Task.checkCancellation(); return result
  }
}
