import Foundation

@main enum PlaybackCLI {
  static func main() {
    guard CommandLine.arguments.count >= 2 else { exit(2) }
    var done = false, failed = false, supported = false, samples = 0, ended = false, sleepPaused = false
    let sleepMode = CommandLine.arguments.count > 4 ? CommandLine.arguments[4] : ""
    var engine: NativePlaybackEngine!
    engine = NativePlaybackEngine(muted: true) { event, body in
      if event == "playback", let kind = body["kind"] as? String {
        if kind == "error" { failed = true; done = true }
        if kind == "ended" { ended = true; done = true }
      }
      if event == "remote", body["action"] as? String == "pause", !sleepMode.isEmpty { sleepPaused = true; done = true }
      if event == "spectrum" { samples += 1; supported = supported || body["supported"] as? Bool == true }
    }
    var object: [String: Any] = ["url": CommandLine.arguments[1], "startPosition": CommandLine.arguments.count>2 ? Double(CommandLine.arguments[2]) ?? 0 : 0, "metadata": ["title": "Synthetic playback fixture"]]
    if CommandLine.arguments.count > 3 { object["cacheKey"] = CommandLine.arguments[3] }
    let data = try! JSONSerialization.data(withJSONObject: object)
    engine.load(String(data: data, encoding: .utf8)!, "fixture", 1)
    engine.play("fixture", 1)
    if sleepMode == "duration" { _ = engine.configureSleep(1, false) }
    if sleepMode == "track" { _ = engine.configureSleep(0, true) }
    let deadline = Date().addingTimeInterval(20)
    while !done && Date() < deadline { RunLoop.main.run(until: Date().addingTimeInterval(0.05)) }
    engine.dispose()
    let result: [String: Any] = ["failed": failed, "ended": ended, "pcmSupported": supported, "spectrumEvents": samples, "sleepPaused": sleepPaused]
    print(String(data: try! JSONSerialization.data(withJSONObject: result), encoding: .utf8)!)
    if failed || (sleepMode.isEmpty ? !ended : (!sleepPaused || ended)) || !supported || samples == 0 { exit(1) }
  }
}
