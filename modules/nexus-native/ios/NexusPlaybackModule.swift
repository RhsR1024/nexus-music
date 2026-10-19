import ExpoModulesCore
import AVFoundation
import MediaPlayer

public final class NexusPlaybackModule: Module {
  private lazy var engine = NativePlaybackEngine { [weak self] event, body in self?.sendEvent(event, body) }
  public func definition() -> ModuleDefinition {
    Name("NexusPlayback")
    Events("playback", "spectrum", "remote", "sleep")
    AsyncFunction("cacheStatistics") { AudioCache.shared.statistics() }
    AsyncFunction("clearCache") { AudioCache.shared.clear() }
    AsyncFunction("configureCache") { (megabytes: Int) in AudioCache.shared.configure(megabytes: megabytes) }

    AsyncFunction("load") { (json: String, entryID: String, generation: Int) in self.engine.load(json, entryID, generation) }.runOnQueue(.main)
    AsyncFunction("setSystemArtwork") { (file: String, itemID: String) in self.engine.setSystemArtwork(file, itemID) }.runOnQueue(.main)
    AsyncFunction("setSystemFavorite") { (favorite: Bool, itemID: String) in self.engine.setSystemFavorite(favorite, itemID) }.runOnQueue(.main)
    AsyncFunction("play") { (entryID: String, generation: Int) in self.engine.play(entryID, generation) }.runOnQueue(.main)
    AsyncFunction("pause") { (generation: Int) in self.engine.pause(generation) }.runOnQueue(.main)
    AsyncFunction("stop") { (generation: Int) in self.engine.stop(generation) }.runOnQueue(.main)
    AsyncFunction("seek") { (seconds: Double, entryID: String, generation: Int) in self.engine.seek(seconds, entryID, generation) }.runOnQueue(.main)
    AsyncFunction("configureVolume") { (value: Double) in self.engine.configureVolume(value) }.runOnQueue(.main)
    AsyncFunction("configureRate") { (value: Double) in self.engine.configureRate(value) }.runOnQueue(.main)
    AsyncFunction("configureSleep") { (seconds: Double, finishCurrent: Bool) in self.engine.configureSleep(seconds, finishCurrent) }.runOnQueue(.main)
    AsyncFunction("sleepSnapshot") { self.engine.sleepSnapshot() }.runOnQueue(.main)
    AsyncFunction("configureEQ") { (enabled: Bool, gains: [Double], preampDB: Double) in self.engine.configureEQ(enabled, gains, preampDB) }.runOnQueue(.main)
    OnDestroy { DispatchQueue.main.async { self.engine.dispose() } }
  }
}
