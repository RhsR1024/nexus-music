import Foundation

@main enum PlaybackCLI {
  static func main() {
    guard CommandLine.arguments.count >= 2 else { exit(2) }
    var done = false, failed = false, supported = false, samples = 0, ended = false, sleepPaused = false
    let sleepMode = CommandLine.arguments.count > 4 ? CommandLine.arguments[4] : ""
    let statisticsMode = sleepMode == "statistics"
    let startedAt=ProcessInfo.processInfo.systemUptime
    var listenedMs=0.0, sessionIDs=Set<String>(), pauseStarted=false, pauseStable=true, pausedMs=0.0
    var readyDuration=0.0, maximumDuration=0.0
    var engine: NativePlaybackEngine!
    engine = NativePlaybackEngine(muted: true) { event, body in
      if event == "playback", let kind = body["kind"] as? String {
        if let duration=body["duration"] as? Double, duration.isFinite {
          maximumDuration=max(maximumDuration,duration)
          if kind == "ready" { readyDuration=duration }
        }
        listenedMs=body["listenedMs"] as? Double ?? 0
        if let session=body["listeningSession"] as? String, body["entryId"] as? String == "fixture" {sessionIDs.insert(session)}
        if statisticsMode, !pauseStarted, body["playing"] as? Bool == true, (body["position"] as? Double ?? 0)>0.15 {
          pauseStarted=true
          DispatchQueue.main.async {
            engine.pause(2);pausedMs=listenedMs
            DispatchQueue.main.asyncAfter(deadline:.now()+0.3){
              pauseStable=abs(listenedMs-pausedMs)<20
              engine.seek(1.2,"fixture",2)
              engine.play("fixture",2)
            }
          }
        }
        if kind == "error" { failed = true; done = true }
        if kind == "ended" { ended = true; done = true }
      }
      if event == "remote", body["action"] as? String == "pause", !sleepMode.isEmpty && !statisticsMode { sleepPaused = true; done = true }
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
    let result: [String: Any] = ["failed": failed, "ended": ended, "pcmSupported": supported, "spectrumEvents": samples, "sleepPaused": sleepPaused,"listenedMs":listenedMs,"elapsedMs":(ProcessInfo.processInfo.systemUptime-startedAt)*1000,"sessionCount":sessionIDs.count,"pauseStable":pauseStable,"pauseStarted":pauseStarted,"readyDuration":readyDuration,"maximumDuration":maximumDuration]
    print(String(data: try! JSONSerialization.data(withJSONObject: result), encoding: .utf8)!)
    if failed || (sleepMode.isEmpty || statisticsMode ? !ended : (!sleepPaused || ended)) || !supported || samples == 0 { exit(1) }
  }
}
