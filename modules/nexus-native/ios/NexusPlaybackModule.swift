import ExpoModulesCore
import AVFoundation
import MediaPlayer

public final class NexusPlaybackModule: Module {
  private lazy var engine = NativePlaybackEngine { [weak self] event, body in self?.sendEvent(event, body) }
  public func definition() -> ModuleDefinition {
    Name("NexusPlayback")
    Events("playback", "spectrum", "remote")
    AsyncFunction("load") { (json: String, entryID: String, generation: Int) in self.engine.load(json, entryID, generation) }.runOnQueue(.main)
    AsyncFunction("play") { (entryID: String, generation: Int) in self.engine.play(entryID, generation) }.runOnQueue(.main)
    AsyncFunction("pause") { (generation: Int) in self.engine.pause(generation) }.runOnQueue(.main)
    AsyncFunction("stop") { (generation: Int) in self.engine.stop(generation) }.runOnQueue(.main)
    AsyncFunction("seek") { (seconds: Double, entryID: String, generation: Int) in self.engine.seek(seconds, entryID, generation) }.runOnQueue(.main)
    AsyncFunction("configureEQ") { (enabled: Bool, gains: [Double]) in self.engine.configureEQ(enabled, gains) }.runOnQueue(.main)
    OnDestroy { DispatchQueue.main.async { self.engine.dispose() } }
  }
}
