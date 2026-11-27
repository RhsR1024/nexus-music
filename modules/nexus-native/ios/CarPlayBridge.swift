import Foundation
import UIKit
#if canImport(CarPlay)
import CarPlay
#endif

/// Thread-safe shared catalog and command queue bridging CarPlay, Siri AppIntents, and JS.
public final class NexusCarBridgeStore {
  public static let shared = NexusCarBridgeStore()

  private let lock = NSLock()
  private var catalogJSON: String = "{}"
  private var catalogTrackCount: Int = 0
  private var catalogPlaylistCount: Int = 0
  private var pendingCommands: [[String: Any]] = []
  private var commandHandler: (([String: Any]) -> Void)?
  private var catalogObservers: [UUID: () -> Void] = [:]

  private init() {}

  public func setCommandHandler(_ handler: (([String: Any]) -> Void)?) {
    lock.lock()
    commandHandler = handler
    lock.unlock()
  }

  public func addCatalogObserver(_ observer: @escaping () -> Void) -> UUID {
    let id = UUID()
    lock.lock()
    catalogObservers[id] = observer
    lock.unlock()
    return id
  }

  public func removeCatalogObserver(_ id: UUID) {
    lock.lock()
    catalogObservers.removeValue(forKey: id)
    lock.unlock()
  }

  public func updateCatalog(json: String) {
    var tracks = 0
    var playlists = 0
    if let data = json.data(using: .utf8),
       let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
      let favs = obj["favorites"] as? [[String: Any]] ?? []
      let recent = obj["recent"] as? [[String: Any]] ?? []
      let pls = obj["playlists"] as? [[String: Any]] ?? []
      tracks = favs.count + recent.count
      playlists = pls.count
    }
    lock.lock()
    catalogJSON = json
    catalogTrackCount = tracks
    catalogPlaylistCount = playlists
    let observers = Array(catalogObservers.values)
    lock.unlock()
    DispatchQueue.main.async {
      for obs in observers { obs() }
    }
  }

  public func currentCatalogDict() -> [String: Any] {
    lock.lock()
    let raw = catalogJSON
    lock.unlock()
    guard let data = raw.data(using: .utf8),
          let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      return [:]
    }
    return obj
  }

  public func dispatchCommand(_ command: [String: Any]) {
    lock.lock()
    let handler = commandHandler
    if handler == nil {
      pendingCommands.append(command)
      if pendingCommands.count > 20 { pendingCommands.removeFirst() }
    }
    lock.unlock()
    if let handler {
      DispatchQueue.main.async { handler(command) }
    }
  }

  public func consumePendingCommands() -> [[String: Any]] {
    lock.lock()
    let out = pendingCommands
    pendingCommands.removeAll()
    lock.unlock()
    return out
  }

  public func statusSnapshot() -> [String: Any] {
    lock.lock()
    let tracks = catalogTrackCount
    let playlists = catalogPlaylistCount
    lock.unlock()
    let siriAvailable: Bool
    if #available(iOS 16.0, *) {
      siriAvailable = true
    } else {
      siriAvailable = false
    }
    let hasCarPlayEntitlement = Self.detectCarPlayEntitlement()
    return [
      "platform": "ios",
      "carPlayCodeReady": true,
      "carPlayEntitlementActive": hasCarPlayEntitlement,
      "siriIntentsAvailable": siriAvailable,
      "androidAutoServiceReady": false,
      "catalogTracks": tracks,
      "catalogPlaylists": playlists,
    ]
  }

  private static func detectCarPlayEntitlement() -> Bool {
    guard let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
          let data = try? Data(contentsOf: url),
          let text = String(data: data, encoding: .isoLatin1) else {
      return false
    }
    return text.contains("com.apple.developer.carplay-audio")
  }
}

#if canImport(CarPlay)
@available(iOS 14.0, *)
@objc(NexusCarPlaySceneDelegate)
public final class NexusCarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
  private var interfaceController: CPInterfaceController?
  private var observerID: UUID?

  public func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didConnect interfaceController: CPInterfaceController
  ) {
    self.interfaceController = interfaceController
    observerID = NexusCarBridgeStore.shared.addCatalogObserver { [weak self] in
      self?.refreshRootTemplate()
    }
    refreshRootTemplate()
  }

  public func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didDisconnectInterfaceController interfaceController: CPInterfaceController
  ) {
    if let id = observerID {
      NexusCarBridgeStore.shared.removeCatalogObserver(id)
      observerID = nil
    }
    self.interfaceController = nil
  }

  private func refreshRootTemplate() {
    guard let ic = interfaceController else { return }
    let dict = NexusCarBridgeStore.shared.currentCatalogDict()
    let favs = dict["favorites"] as? [[String: Any]] ?? []
    let playlists = dict["playlists"] as? [[String: Any]] ?? []
    let recent = dict["recent"] as? [[String: Any]] ?? []

    let favTemplate = makeTrackListTemplate(title: "收藏", section: "favorites", tracks: favs)
    favTemplate.tabImage = UIImage(systemName: "heart.fill")

    let plItems = playlists.map { pl -> CPListItem in
      let title = pl["title"] as? String ?? "未命名歌单"
      let count = pl["count"] as? Int ?? 0
      let plId = pl["id"] as? String ?? ""
      let item = CPListItem(text: title, detailText: "\(count) 首歌曲")
      item.handler = { [weak self] _, completion in
        NexusCarBridgeStore.shared.dispatchCommand([
          "source": "carplay",
          "action": "playPlaylist",
          "id": plId,
        ])
        self?.pushNowPlaying()
        completion()
      }
      return item
    }
    let plTemplate = CPListTemplate(title: "歌单", sections: [CPListSection(items: plItems)])
    plTemplate.tabImage = UIImage(systemName: "music.note.list")

    let recentTemplate = makeTrackListTemplate(title: "最近播放", section: "recent", tracks: recent)
    recentTemplate.tabImage = UIImage(systemName: "clock.fill")

    let tabBar = CPTabBarTemplate(templates: [favTemplate, plTemplate, recentTemplate])
    ic.setRootTemplate(tabBar, animated: false, completion: nil)
  }

  private func makeTrackListTemplate(title: String, section: String, tracks: [[String: Any]]) -> CPListTemplate {
    let items = tracks.enumerated().map { idx, t -> CPListItem in
      let name = t["title"] as? String ?? "未知歌曲"
      let artist = t["artist"] as? String ?? ""
      let item = CPListItem(text: name, detailText: artist)
      item.handler = { [weak self] _, completion in
        NexusCarBridgeStore.shared.dispatchCommand([
          "source": "carplay",
          "action": "playSectionTrack",
          "section": section,
          "index": idx,
        ])
        self?.pushNowPlaying()
        completion()
      }
      return item
    }
    return CPListTemplate(title: title, sections: [CPListSection(items: items)])
  }

  private func pushNowPlaying() {
    guard let ic = interfaceController else { return }
    if !(ic.topTemplate is CPNowPlayingTemplate) {
      ic.pushTemplate(CPNowPlayingTemplate.shared, animated: true, completion: nil)
    }
  }
}
#endif
