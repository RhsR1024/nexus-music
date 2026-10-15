import Foundation
@main enum DAVMediaCLI {
  static func main() {
    guard CommandLine.arguments.count >= 5 else { exit(2) }
    let root = CommandLine.arguments[1], path = CommandLine.arguments[2], mode = CommandLine.arguments[3], key = CommandLine.arguments[4]
    do {
      var media = try DAVHTTP.media(root: root, path: path, username: "fixture-user", password: "fixture-password")
      if CommandLine.arguments.count > 5 { media["startPosition"] = Double(CommandLine.arguments[5]) ?? 0 }
      var headers = media["headers"] as! [String: String]; headers["If-Match"] = "\"fixture-v1\""; media["headers"] = headers
      var done = false, failed = false
      if mode == "inspect" {
        Task {
          do {
            let value = try await RemoteAudioMetadata.inspect(media, key: key)
            let result: [String: Any] = ["title": value["title"] ?? "", "artist": value["artist"] ?? "", "album": value["album"] ?? "", "lyric": value["lyric"] ?? "", "durationMs": value["durationMs"] ?? 0, "artwork": value["artwork"] != nil]
            print(String(data: try JSONSerialization.data(withJSONObject: result), encoding: .utf8)!)
          } catch { failed = true; print("{\"failed\":true}") }
          done = true
        }
      } else {
        var pcm = 0, ended = false, firstPlayingPosition: Double?
        let engine = NativePlaybackEngine(muted: true) { event, body in
          if event == "spectrum", body["supported"] as? Bool == true { pcm += 1 }
          if event == "playback", let kind = body["kind"] as? String {
            if body["playing"] as? Bool == true, firstPlayingPosition == nil { firstPlayingPosition = body["position"] as? Double }
            if kind == "error" { failed = true; done = true }
            if kind == "ended" { ended = true; done = true }
          }
        }
        media["cacheKey"] = key; if mode == "cache-only" { media["cacheOnly"] = true }
        engine.load(String(data: try JSONSerialization.data(withJSONObject: media), encoding: .utf8)!, "dav-fixture", 1); engine.play("dav-fixture", 1)
        let deadline = Date().addingTimeInterval(20)
        while !done && Date() < deadline { RunLoop.main.run(until: Date().addingTimeInterval(0.01)) }
        engine.dispose(); print("{\"failed\":\(failed),\"ended\":\(ended),\"pcm\":\(pcm),\"firstPlayingPosition\":\(firstPlayingPosition ?? -1)}")
        if !ended || pcm == 0 { failed = true }
      }
      let deadline = Date().addingTimeInterval(20)
      while !done && Date() < deadline { RunLoop.main.run(until: Date().addingTimeInterval(0.01)) }
      if failed || !done { exit(1) }
    } catch { print("{\"failed\":true}"); exit(1) }
  }
}
