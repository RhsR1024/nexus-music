import Foundation
import AVFoundation
import AudioToolbox
import MediaPlayer
import ImageIO
#if os(iOS)
import UIKit
#else
import AppKit
#endif

final class NativePlaybackEngine {
  private let player = AVPlayer()
  private let emit: (String, [String: Any]) -> Void
  private var generation = 0, entryID = ""
  private lazy var sleepTimer = PlaybackSleepTimer(changed: { [weak self] body in self?.emit("sleep", body) }, expired: { [weak self] in self?.remotePause() })
  private var wantsPlay = false
  private var playbackRate: Float = 1
  private var loading: Task<Void, Never>?
  private var retainedLocalURL: URL?
  private var offlinePlaybackAlias: URL?
  private var loader: AudioResourceLoader?
  private var cacheKey: String?
  private var cachedPlayback = false
  private var originalPayload: [String: Any]?
  private var dsp: NexusAudioDSP?
  private var preampDB = 0.0
  private var eqEnabled = false, gains = [Double](repeating: 0, count: 10)
  private var observation: NSKeyValueObservation?
  private var durationObservation: NSKeyValueObservation?
  private var playerObservation: NSKeyValueObservation?
  private var endObserver: NSObjectProtocol?, interruption: NSObjectProtocol?, routeObserver: NSObjectProtocol?
  private var progress: Any?, spectrumTimer: Timer?
  private var listeningTimer:Timer?
  private var remoteTargets: [(MPRemoteCommand, Any)] = []
  private var systemItemID = ""
  private var systemFavorite = false
  private var systemArtwork: MPMediaItemArtwork?
  private var artworkRevision = 0
  private static let artworkQueue = DispatchQueue(label: "nexus.system-artwork", qos: .utility)
  private var metadata: [String: Any] = [:]
  private var knownDuration = 0.0
  private var initialPosition: Double = 0
  private var initialSeekPending = false
  private var listeningSession = UUID().uuidString
  private var listenedSeconds = 0.0, listeningClock = ProcessInfo.processInfo.systemUptime
  private var wasActuallyPlaying = false
  init(muted: Bool = false, emit: @escaping (String, [String: Any]) -> Void) {
    self.emit = emit
    player.isMuted = muted
    progress = player.addPeriodicTimeObserver(forInterval: CMTime(seconds: 0.5, preferredTimescale: 600), queue: .main) { [weak self] _ in self?.report("progress") }
    listeningTimer=Timer.scheduledTimer(withTimeInterval:5,repeats:true){[weak self]_ in guard let self,self.player.rate>0 else{return};self.report("listening")}
    playerObservation = player.observe(\.timeControlStatus, options: [.new]) { [weak self] _, _ in DispatchQueue.main.async { self?.report("status") } }
    spectrumTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
      guard let self, self.player.rate > 0, let dsp = self.dsp else { return }
      var snapshot = dsp.snapshot()
      snapshot["entryId"] = self.entryID; snapshot["generation"] = self.generation
      self.emit("spectrum", snapshot)
    }
    #if os(iOS)
    interruption = NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] notification in
      guard let self, (notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt) == AVAudioSession.InterruptionType.began.rawValue else { return }
      self.remotePause()
    }
    routeObserver = NotificationCenter.default.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { [weak self] notification in
      guard let self, (notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt) == AVAudioSession.RouteChangeReason.oldDeviceUnavailable.rawValue else { return }
      self.remotePause()
    }
    #endif
    let commands = MPRemoteCommandCenter.shared()
    for (command, action) in [(commands.playCommand, "play"), (commands.pauseCommand, "pause"), (commands.togglePlayPauseCommand, "toggle"), (commands.nextTrackCommand, "next"), (commands.previousTrackCommand, "previous")] {
      let target = command.addTarget { [weak self] _ in self?.handleSystemCommand(action) ?? .commandFailed }
      remoteTargets.append((command, target))
    }
    let target = commands.changePlaybackPositionCommand.addTarget { [weak self] event in
      guard let event = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
      return self?.handleSystemCommand("seek", seconds: event.positionTime) ?? .commandFailed
    }
    remoteTargets.append((commands.changePlaybackPositionCommand, target))
    commands.likeCommand.localizedTitle = "音枢收藏"
    commands.likeCommand.localizedShortTitle = "收藏"
    let favoriteTarget = commands.likeCommand.addTarget { [weak self] event in
      guard let event = event as? MPFeedbackCommandEvent else { return .commandFailed }
      return self?.handleSystemCommand("favorite", favorite: !event.isNegative) ?? .commandFailed
    }
    remoteTargets.append((commands.likeCommand, favoriteTarget))
    updateSystemCommands()
  }
  // All system callbacks enter the same main-thread authority as load/pause/stop.
  func handleSystemCommand(_ action: String, seconds: Double? = nil, favorite: Bool? = nil) -> MPRemoteCommandHandlerStatus {
    if !Thread.isMainThread { return DispatchQueue.main.sync { self.handleSystemCommand(action, seconds: seconds, favorite: favorite) } }
    guard !entryID.isEmpty, !systemItemID.isEmpty else { return .noSuchContent }
    if action == "pause" || (action == "toggle" && wantsPlay) { remotePause(); return .success }
    var body: [String: Any] = ["action": action == "toggle" ? "play" : action, "entryId": entryID, "itemID": systemItemID, "generation": generation]
    if action == "seek" {
      guard let seconds, seconds.isFinite, seconds >= 0 else { return .commandFailed }
      body["seconds"] = seconds
    }
    if action == "favorite" { guard let favorite else { return .commandFailed }; body["favorite"] = favorite }
    emit("remote", body); return .success
  }
  private func updateSystemCommands() {
    let available = !entryID.isEmpty && !systemItemID.isEmpty
    let commands = MPRemoteCommandCenter.shared()
    for (command, _) in remoteTargets { command.isEnabled = available }
    commands.likeCommand.isActive = available && systemFavorite
  }
  func setSystemFavorite(_ favorite: Bool, _ itemID: String) {
    guard !itemID.isEmpty, itemID == systemItemID else { return }
    systemFavorite = favorite; updateSystemCommands()
  }
  func setSystemArtwork(_ raw: String, _ itemID: String) {
    guard !itemID.isEmpty, itemID == systemItemID else { return }
    artworkRevision += 1
    let revision = artworkRevision
    systemArtwork = nil; updateNowPlaying()
    guard let file = URL(string: raw), file.isFileURL, file.host == nil || file.host == "" || file.host == "localhost" else { return }
    let resolved = file.resolvingSymlinksInPath().standardizedFileURL
    let roots = [FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first, FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first].compactMap { $0?.resolvingSymlinksInPath().standardizedFileURL.path }
    guard roots.contains(where: { resolved.path.hasPrefix($0 + "/") }) else { return }
    Self.artworkQueue.async { [weak self] in
      guard let values = try? resolved.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey]), values.isRegularFile == true,
        let size = values.fileSize, size > 0, size <= 8 * 1024 * 1024,
        let data = try? Data(contentsOf: resolved), data.count <= 8 * 1024 * 1024,
        let source = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary),
        let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true, kCGImageSourceThumbnailMaxPixelSize: 512] as CFDictionary) else { return }
      DispatchQueue.main.async { [weak self] in
        guard let self, self.systemItemID == itemID, self.artworkRevision == revision else { return }
        #if os(iOS)
        let picture = UIImage(cgImage: image)
        #else
        let picture = NSImage(cgImage: image, size: NSSize(width: image.width, height: image.height))
        #endif
        self.systemArtwork = MPMediaItemArtwork(boundsSize: picture.size) { _ in picture }
        self.updateNowPlaying()
      }
    }
  }

  func load(_ json: String, _ id: String, _ newGeneration: Int) {
    guard newGeneration >= generation else { return }
    sleepTimer.trackChanged(to: id)
    stop(newGeneration, preservingSleep: true); entryID = id
    listeningSession = UUID().uuidString; listenedSeconds = 0
    listeningClock = ProcessInfo.processInfo.systemUptime; wasActuallyPlaying = false
    guard let object = try? JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any],
          let rawURL = object["url"] as? String, let url = URL(string: rawURL), ["http", "https", "file", "ipod-library"].contains(url.scheme ?? ""), url.scheme != "ipod-library" || object["deviceMedia"] as? Bool == true else { report("error"); return }
    if LocalAudioFiles.shared.retain(url) { retainedLocalURL = url }
    originalPayload = object
    let redirectRoot = object["redirectRoot"] as? String
    if let redirectRoot { guard let scope = try? DAVScope(redirectRoot), scope.contains(url) else { report("error"); return } }
    systemItemID = object["systemItemID"] as? String ?? "\(newGeneration):\(id)"
    systemFavorite = object["systemFavorite"] as? Bool ?? false
    updateSystemCommands()
    metadata = object["metadata"] as? [String: Any] ?? [:]
    initialPosition = object["startPosition"] as? Double ?? 0
    if !initialPosition.isFinite || initialPosition < 0 { initialPosition = 0 }
    initialSeekPending = true
    updateNowPlaying()
    cacheKey = object["cacheKey"] as? String
    if let cacheKey { AudioCache.shared.retain(cacheKey) }
    let cached = object["skipCache"] as? Bool == true ? nil : cacheKey.flatMap { AudioCache.shared.hit($0) }
    if object["cacheOnly"] as? Bool == true && cached == nil { report("error"); return }
    cachedPlayback = cached != nil
    let asset: AVURLAsset
    if let cached { asset = AVURLAsset(url: cached) }
    else if url.isFileURL && url.pathExtension.lowercased() == "audio" {
      do {
        let alias = try OfflinePlaybackFile.makeAlias(for: url)
        offlinePlaybackAlias = alias; asset = AVURLAsset(url: alias)
      } catch { report("error"); return }
    }
    else if url.isFileURL || url.scheme == "ipod-library" || (redirectRoot == nil && url.pathExtension.lowercased() == "m3u8") { asset = AVURLAsset(url: url) }
    else {
      loader = AudioResourceLoader(url: url, headers: object["headers"] as? [String: String] ?? [:], cacheKey: cacheKey, redirectRoot: redirectRoot)
      asset = loader!.asset
    }
    loading = Task { [weak self] in
      do {
        let tracks = try await asset.loadTracks(withMediaType: .audio)
        let loadedDuration = (try? await asset.load(.duration).seconds) ?? 0
        guard let self, !Task.isCancelled else { return }
        await MainActor.run {
          guard self.generation == newGeneration, self.entryID == id else { return }
          self.knownDuration = loadedDuration.isFinite && loadedDuration > 0 ? loadedDuration : 0
          let item = AVPlayerItem(asset: asset), dsp = NexusAudioDSP()
          dsp.configure(enabled: self.eqEnabled, gains: self.gains.map(NSNumber.init(value:)), preampDB: self.preampDB)
          if let track = tracks.first { item.audioMix = dsp.audioMix(for: track) }
          self.dsp = dsp
          self.durationObservation = item.observe(\.duration, options: [.new]) { [weak self] item, _ in
            DispatchQueue.main.async {
              guard let self, self.player.currentItem === item, self.entryID == id else { return }
              let duration = item.duration.seconds
              guard duration.isFinite, duration > 0 else { return }
              self.report("duration")
            }
          }
          self.observation = item.observe(\.status, options: [.new]) { [weak self] item, _ in
            DispatchQueue.main.async {
              guard let self, self.player.currentItem === item, self.entryID == id else { return }
              if item.status == .failed { if self.retryCorruptCache() { return }; self.wantsPlay = false; self.player.pause(); self.invalidateCachedPlayback(); self.report("error") }
              else if item.status == .readyToPlay {
                self.report("ready")
                if self.initialSeekPending && self.initialPosition > 0 {
                  let duration=item.duration.seconds
                  let position=duration.isFinite ? min(self.initialPosition,duration) : self.initialPosition
                  self.player.seek(to: CMTime(seconds:position,preferredTimescale:600),toleranceBefore:.zero,toleranceAfter:.zero) { [weak self] _ in
                    DispatchQueue.main.async {
                      guard let self,self.player.currentItem === item else { return }
                      self.initialSeekPending=false;if self.wantsPlay {self.player.play(); self.player.rate = self.playbackRate}
                    }
                  }
                } else {self.initialSeekPending=false;if self.wantsPlay {self.player.play(); self.player.rate = self.playbackRate}}
              }
            }
          }
          self.endObserver = NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main) { [weak self] _ in
            guard let self, self.player.currentItem === item, self.entryID == id else { return }
            if !self.sleepTimer.ended(id) { self.report("ended") }
          }
          self.player.replaceCurrentItem(with: item)
          self.updateNowPlaying()
        }
      } catch {
        await MainActor.run { [weak self] in
          guard let self, self.generation == newGeneration, !Task.isCancelled else { return }
          if self.retryCorruptCache() { return }; self.wantsPlay = false; self.invalidateCachedPlayback(); self.report("error")
        }
      }
    }
  }
  func play(_ id: String, _ newGeneration: Int) {
    guard newGeneration == generation, entryID == id else { return }
    do {
      #if os(iOS)
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.playback, mode: .default, options: [])
      try session.setActive(true)
      #endif
      wantsPlay = true; if player.currentItem?.status == .readyToPlay && !initialSeekPending { player.play(); player.rate = playbackRate }; report("status")
    } catch { report("error") }
  }
  func pause(_ newGeneration: Int) {
    guard newGeneration >= generation else { return }
    generation = newGeneration; wantsPlay = false; player.pause(); report("paused")
    if player.currentItem == nil { loading?.cancel(); loading = nil; loader?.destroy(); loader = nil }
  }
  private func remotePause() {
    let id = entryID, itemID = systemItemID
    pause(generation + 1)
    emit("remote", ["action": "pause", "generation": generation, "entryId": id, "itemID": itemID])
  }
  func stop(_ newGeneration: Int, preservingSleep: Bool = false) {
    guard newGeneration >= generation else { return }
    report("stopped")
    if !preservingSleep { sleepTimer.trackChanged(to: "") }
    generation = newGeneration; wantsPlay = false; loading?.cancel(); loading = nil
    observation = nil; durationObservation = nil; if let endObserver { NotificationCenter.default.removeObserver(endObserver) }; endObserver = nil
    player.pause(); player.replaceCurrentItem(with: nil); loader?.destroy(); loader = nil; dsp = nil
    if let offlinePlaybackAlias { try? FileManager.default.removeItem(at: offlinePlaybackAlias) }; offlinePlaybackAlias = nil
    if let retainedLocalURL { LocalAudioFiles.shared.release(retainedLocalURL) }; retainedLocalURL = nil
    if let cacheKey { AudioCache.shared.release(cacheKey) }; cacheKey = nil; cachedPlayback = false; originalPayload = nil
    entryID = ""; metadata = [:]; knownDuration = 0; systemItemID = ""; systemFavorite = false; systemArtwork = nil; artworkRevision += 1
    updateSystemCommands()
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    MPNowPlayingInfoCenter.default().playbackState = .stopped
    initialPosition=0;initialSeekPending=false
  }
  private func retryCorruptCache() -> Bool {
    guard cachedPlayback, var payload = originalPayload else { return false }
    invalidateCachedPlayback(); payload["skipCache"] = true
    guard let data = try? JSONSerialization.data(withJSONObject: payload), let json = String(data: data, encoding: .utf8) else { return false }
    let resume = wantsPlay, id = entryID, currentGeneration = generation
    load(json, id, currentGeneration); if resume { play(id, currentGeneration) }; return true
  }
  private func invalidateCachedPlayback() { if cachedPlayback, let cacheKey { AudioCache.shared.invalidate(cacheKey) }; cachedPlayback = false }
  func seek(_ seconds: Double, _ id: String, _ newGeneration: Int) {
    guard seconds.isFinite, seconds >= 0, id == entryID, newGeneration == generation else { return }
    let duration = player.currentItem?.duration.seconds ?? .infinity
    player.seek(to: CMTime(seconds: min(seconds, duration.isFinite ? duration : seconds), preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
  }
  func configureRate(_ value: Double) {
    guard value.isFinite else { return }
    playbackRate = Float(min(3, max(0.5, value)))
    if #available(iOS 16.0, *) { player.defaultRate = playbackRate }
    // Setting `rate` on a paused player would resume it, so only adjust an
    // item that is already playing.
    if wantsPlay && player.rate > 0 { player.rate = playbackRate }
  }
  func configureVolume(_ value: Double) {
    guard value.isFinite else { return }; player.volume = Float(min(1, max(0, value)))
  }
  func configureSleep(_ seconds: Double, _ finishCurrent: Bool) -> [String: Any] {
    if finishCurrent && entryID.isEmpty { return sleepTimer.snapshot() }
    _ = sleepTimer.set(seconds: finishCurrent ? 0 : seconds, entryID: finishCurrent ? entryID : nil)
    return sleepTimer.snapshot()
  }
  func sleepSnapshot() -> [String: Any] { sleepTimer.snapshot() }
  func configureEQ(_ enabled: Bool, _ values: [Double], _ preamp: Double = 0) {
    guard preamp.isFinite, values.count == 10, values.allSatisfy({ $0.isFinite }) else { return }
    preampDB = min(12, max(-12, preamp)); eqEnabled = enabled; gains = values.map { min(12, max(-12, $0)) }
    dsp?.configure(enabled: enabled, gains: gains.map(NSNumber.init(value:)), preampDB: preampDB)
  }
  private func report(_ kind: String) {
    let clock = ProcessInfo.processInfo.systemUptime
    if wasActuallyPlaying { listenedSeconds += max(0, clock - listeningClock) }
    listeningClock = clock
    wasActuallyPlaying = player.timeControlStatus == .playing && wantsPlay && kind != "ended" && kind != "stopped" && kind != "error"
    let seconds = player.currentTime().seconds
    let itemDuration = player.currentItem?.duration.seconds ?? 0
    let duration = itemDuration.isFinite && itemDuration > 0 ? itemDuration : knownDuration
    emit("playback", ["kind": kind, "entryId": entryID, "generation": generation,
      "position": seconds.isFinite ? seconds : 0, "duration": duration.isFinite ? duration : 0,
      "playing": player.rate > 0, "buffering": player.timeControlStatus == .waitingToPlayAtSpecifiedRate,
      "listeningSession": listeningSession, "listenedMs": listenedSeconds * 1000])
    updateNowPlaying()
  }
  private func updateNowPlaying() {
    guard !entryID.isEmpty else { return }
    var info: [String: Any] = [MPMediaItemPropertyTitle: metadata["title"] as? String ?? "音枢", MPMediaItemPropertyArtist: metadata["artist"] as? String ?? "",
      MPMediaItemPropertyAlbumTitle: metadata["album"] as? String ?? "",
      MPNowPlayingInfoPropertyMediaType: MPNowPlayingInfoMediaType.audio.rawValue,
      MPNowPlayingInfoPropertyPlaybackRate: player.rate]
    if let systemArtwork { info[MPMediaItemPropertyArtwork] = systemArtwork }
    let seconds = player.currentTime().seconds
    let itemDuration = player.currentItem?.duration.seconds ?? 0
    let duration = itemDuration.isFinite && itemDuration > 0 ? itemDuration : knownDuration
    if seconds.isFinite { info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = seconds }
    if duration.isFinite && duration > 0 { info[MPMediaItemPropertyPlaybackDuration] = duration }
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    MPNowPlayingInfoCenter.default().playbackState = wantsPlay && player.rate > 0 ? .playing : .paused
  }
  func dispose() {
    sleepTimer.dispose(); stop(generation + 1); spectrumTimer?.invalidate(); spectrumTimer = nil;listeningTimer?.invalidate();listeningTimer=nil
    if let progress { player.removeTimeObserver(progress) }; progress = nil
    playerObservation = nil
    for observer in [interruption, routeObserver].compactMap({ $0 }) { NotificationCenter.default.removeObserver(observer) }
    for (command, target) in remoteTargets { command.removeTarget(target) }; remoteTargets.removeAll()
  }
}

// AVURLAsset can reject a valid local container with an opaque .audio suffix.
// AudioToolbox identifies the container from its bytes; a short-lived hard link
// gives AVFoundation the right suffix without renaming the durable download or
// copying its contents. This also works on the minimum iOS 15.1 target.
private enum OfflinePlaybackFile {
  private static let directory: Result<URL, Error> = Result {
    let fm = FileManager.default
    let root = try fm.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("NexusPlaybackAliases", isDirectory: true)
    try fm.createDirectory(at: root, withIntermediateDirectories: true)
    let values = try root.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
    guard values.isDirectory == true, values.isSymbolicLink != true else { throw CocoaError(.fileReadInvalidFileName) }
    // Only this module's cache names are eligible for crash-orphan cleanup.
    for file in try fm.contentsOfDirectory(at: root, includingPropertiesForKeys: nil) where file.lastPathComponent.hasPrefix("nexus-playback-") {
      try? fm.removeItem(at: file)
    }
    return root
  }
  static func makeAlias(for source: URL) throws -> URL {
    let values = try source.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey])
    guard values.isRegularFile == true, values.isSymbolicLink != true else { throw CocoaError(.fileReadInvalidFileName) }
    var file: AudioFileID?
    guard AudioFileOpenURL(source as CFURL, .readPermission, 0, &file) == noErr, let file else { throw CocoaError(.fileReadCorruptFile) }
    defer { AudioFileClose(file) }
    var format: AudioFileTypeID = 0, size = UInt32(MemoryLayout<AudioFileTypeID>.size)
    let suffixes: [AudioFileTypeID: String] = [kAudioFileWAVEType:"wav", kAudioFileAIFFType:"aiff", kAudioFileAIFCType:"aifc", kAudioFileMP3Type:"mp3", kAudioFileM4AType:"m4a", kAudioFileMPEG4Type:"m4a", kAudioFileAAC_ADTSType:"aac", kAudioFileFLACType:"flac", kAudioFileCAFType:"caf"]
    guard AudioFileGetProperty(file, kAudioFilePropertyFileFormat, &size, &format) == noErr, let suffix = suffixes[format] else { throw CocoaError(.fileReadUnknown) }
    let alias = try directory.get().appendingPathComponent("nexus-playback-" + UUID().uuidString).appendingPathExtension(suffix)
    try FileManager.default.linkItem(at: source, to: alias)
    return alias
  }
}
