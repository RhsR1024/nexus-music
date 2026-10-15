import Foundation
import AVFoundation
import MediaPlayer

final class NativePlaybackEngine {
  private let player = AVPlayer()
  private let emit: (String, [String: Any]) -> Void
  private var generation = 0, entryID = ""
  private lazy var sleepTimer = PlaybackSleepTimer(changed: { [weak self] body in self?.emit("sleep", body) }, expired: { [weak self] in self?.remotePause() })
  private var wantsPlay = false
  private var loading: Task<Void, Never>?
  private var retainedLocalURL: URL?
  private var loader: AudioResourceLoader?
  private var cacheKey: String?
  private var cachedPlayback = false
  private var originalPayload: [String: Any]?
  private var dsp: NexusAudioDSP?
  private var preampDB = 0.0
  private var eqEnabled = false, gains = [Double](repeating: 0, count: 10)
  private var observation: NSKeyValueObservation?
  private var playerObservation: NSKeyValueObservation?
  private var endObserver: NSObjectProtocol?, interruption: NSObjectProtocol?, routeObserver: NSObjectProtocol?
  private var progress: Any?, spectrumTimer: Timer?
  private var remoteTargets: [(MPRemoteCommand, Any)] = []
  private var metadata: [String: Any] = [:]
  private var initialPosition: Double = 0
  private var initialSeekPending = false
  init(muted: Bool = false, emit: @escaping (String, [String: Any]) -> Void) {
    self.emit = emit
    player.isMuted = muted
    progress = player.addPeriodicTimeObserver(forInterval: CMTime(seconds: 0.5, preferredTimescale: 600), queue: .main) { [weak self] _ in self?.report("progress") }
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
      let target = command.addTarget { [weak self] _ in DispatchQueue.main.async {
        guard let self else { return }
        if action == "pause" || (action == "toggle" && self.wantsPlay) { self.remotePause() }
        else { self.emit("remote", ["action": action == "toggle" ? "play" : action]) }
      }; return .success }
      remoteTargets.append((command, target))
    }
    let target = commands.changePlaybackPositionCommand.addTarget { [weak self] event in
      guard let event = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
      DispatchQueue.main.async { self?.emit("remote", ["action": "seek", "seconds": event.positionTime]) }; return .success
    }
    remoteTargets.append((commands.changePlaybackPositionCommand, target))
  }
  func load(_ json: String, _ id: String, _ newGeneration: Int) {
    guard newGeneration >= generation else { return }
    sleepTimer.trackChanged(to: id)
    stop(newGeneration, preservingSleep: true); entryID = id
    guard let object = try? JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any],
          let rawURL = object["url"] as? String, let url = URL(string: rawURL), ["http", "https", "file"].contains(url.scheme ?? "") else { report("error"); return }
    if LocalAudioFiles.shared.retain(url) { retainedLocalURL = url }
    originalPayload = object
    metadata = object["metadata"] as? [String: Any] ?? [:]
    initialPosition = object["startPosition"] as? Double ?? 0
    if !initialPosition.isFinite || initialPosition < 0 { initialPosition = 0 }
    initialSeekPending = true
    cacheKey = object["cacheKey"] as? String
    if let cacheKey { AudioCache.shared.retain(cacheKey) }
    let cached = object["skipCache"] as? Bool == true ? nil : cacheKey.flatMap { AudioCache.shared.hit($0) }
    cachedPlayback = cached != nil
    let asset: AVURLAsset
    if let cached { asset = AVURLAsset(url: cached) }
    else if url.isFileURL || url.pathExtension.lowercased() == "m3u8" { asset = AVURLAsset(url: url) }
    else {
      loader = AudioResourceLoader(url: url, headers: object["headers"] as? [String: String] ?? [:], cacheKey: cacheKey)
      asset = loader!.asset
    }
    loading = Task { [weak self] in
      do {
        let tracks = try await asset.loadTracks(withMediaType: .audio)
        guard let self, !Task.isCancelled else { return }
        await MainActor.run {
          guard self.generation == newGeneration, self.entryID == id else { return }
          let item = AVPlayerItem(asset: asset), dsp = NexusAudioDSP()
          dsp.configure(enabled: self.eqEnabled, gains: self.gains.map(NSNumber.init(value:)), preampDB: self.preampDB)
          if let track = tracks.first { item.audioMix = dsp.audioMix(for: track) }
          self.dsp = dsp
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
                      self.initialSeekPending=false;if self.wantsPlay {self.player.play()}
                    }
                  }
                } else {self.initialSeekPending=false;if self.wantsPlay {self.player.play()}}
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
      wantsPlay = true; if player.currentItem?.status == .readyToPlay && !initialSeekPending { player.play() }; report("status")
    } catch { report("error") }
  }
  func pause(_ newGeneration: Int) {
    guard newGeneration >= generation else { return }
    generation = newGeneration; wantsPlay = false; player.pause(); report("paused")
    if player.currentItem == nil { loading?.cancel(); loading = nil; loader?.destroy(); loader = nil }
  }
  private func remotePause() {
    pause(generation + 1)
    emit("remote", ["action": "pause", "generation": generation])
  }
  func stop(_ newGeneration: Int, preservingSleep: Bool = false) {
    guard newGeneration >= generation else { return }
    if !preservingSleep { sleepTimer.trackChanged(to: "") }
    generation = newGeneration; wantsPlay = false; loading?.cancel(); loading = nil
    observation = nil; if let endObserver { NotificationCenter.default.removeObserver(endObserver) }; endObserver = nil
    player.pause(); player.replaceCurrentItem(with: nil); loader?.destroy(); loader = nil; dsp = nil
    if let retainedLocalURL { LocalAudioFiles.shared.release(retainedLocalURL) }; retainedLocalURL = nil
    if let cacheKey { AudioCache.shared.release(cacheKey) }; cacheKey = nil; cachedPlayback = false; originalPayload = nil
    entryID = ""; metadata = [:]; MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
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
    let seconds = player.currentTime().seconds, duration = player.currentItem?.duration.seconds ?? 0
    emit("playback", ["kind": kind, "entryId": entryID, "generation": generation,
      "position": seconds.isFinite ? seconds : 0, "duration": duration.isFinite ? duration : 0,
      "playing": player.rate > 0, "buffering": player.timeControlStatus == .waitingToPlayAtSpecifiedRate])
    updateNowPlaying()
  }
  private func updateNowPlaying() {
    guard !entryID.isEmpty else { return }
    var info: [String: Any] = [MPMediaItemPropertyTitle: metadata["title"] as? String ?? "音枢", MPMediaItemPropertyArtist: metadata["artist"] as? String ?? "",
      MPNowPlayingInfoPropertyPlaybackRate: player.rate]
    let seconds = player.currentTime().seconds, duration = player.currentItem?.duration.seconds ?? 0
    if seconds.isFinite { info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = seconds }
    if duration.isFinite && duration > 0 { info[MPMediaItemPropertyPlaybackDuration] = duration }
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
  }
  func dispose() {
    sleepTimer.dispose(); stop(generation + 1); spectrumTimer?.invalidate(); spectrumTimer = nil
    if let progress { player.removeTimeObserver(progress) }; progress = nil
    playerObservation = nil
    for observer in [interruption, routeObserver].compactMap({ $0 }) { NotificationCenter.default.removeObserver(observer) }
    for (command, target) in remoteTargets { command.removeTarget(target) }; remoteTargets.removeAll()
  }
}
