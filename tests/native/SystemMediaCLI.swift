import Foundation
import MediaPlayer
import ImageIO
import UniformTypeIdentifiers
import CoreGraphics

@main enum SystemMediaCLI {
  static func main() throws {
    func check(_ value: @autoclosure () -> Bool, _ message: String) {
      if !value() { fputs("System media failed: \(message)\n", stderr); exit(1) }
    }
    func pump(_ seconds: Double = 0.2) { RunLoop.main.run(until: Date().addingTimeInterval(seconds)) }
    func info() -> [String: Any] { MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:] }
    func awaitArtwork() {
      let deadline = Date().addingTimeInterval(5)
      while !(info()[MPMediaItemPropertyArtwork] is MPMediaItemArtwork) && Date() < deadline { pump(0.02) }
    }
    let directory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("NexusSystemMediaTests-" + UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }
    let picture = directory.appendingPathComponent("cover.png")
    let context = CGContext(data: nil, width: 32, height: 32, bitsPerComponent: 8, bytesPerRow: 128, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    context.setFillColor(CGColor(red: 0.2, green: 0.7, blue: 0.3, alpha: 1)); context.fill(CGRect(x: 0, y: 0, width: 32, height: 32))
    let output = CGImageDestinationCreateWithURL(picture as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(output, context.makeImage()!, nil); check(CGImageDestinationFinalize(output), "fixture image")
    var commands: [[String: Any]] = [], readyItems = Set<String>()
    let engine = NativePlaybackEngine(muted: true) { event, body in
      if event == "remote" { commands.append(body) }
      if event == "playback", body["kind"] as? String == "ready", let id = body["entryId"] as? String { readyItems.insert(id) }
    }
    defer { engine.dispose() }
    check(engine.handleSystemCommand("play") == .noSuchContent, "empty media must reject remote playback")
    func load(_ id: String, _ generation: Int) {
      let object: [String: Any] = ["url": URL(fileURLWithPath: FileManager.default.currentDirectoryPath + "/build/tests/tone.wav").absoluteString, "systemItemID": id, "metadata": ["title": id, "artist": "Fixture", "album": "System album"]]
      engine.load(String(data: try! JSONSerialization.data(withJSONObject: object), encoding: .utf8)!, id, generation)
    }
    load("a", 1)
    let readyDeadline = Date().addingTimeInterval(5)
    while !readyItems.contains("a") && Date() < readyDeadline { pump(0.02) }
    check(readyItems.contains("a"), "fixture must reach AVPlayer ready state")
    check(info()[MPMediaItemPropertyTitle] as? String == "a", "title")
    check(info()[MPMediaItemPropertyAlbumTitle] as? String == "System album", "album")
    engine.setSystemArtwork(picture.absoluteString, "a"); awaitArtwork()
    check(info()[MPMediaItemPropertyArtwork] is MPMediaItemArtwork, "decoded system artwork")
    check(engine.handleSystemCommand("pause") == .success, "native immediate pause")
    engine.setSystemArtwork(picture.absoluteString, "a"); awaitArtwork()
    check(info()[MPMediaItemPropertyArtwork] is MPMediaItemArtwork, "pause generation must retain item artwork")
    check((info()[MPNowPlayingInfoPropertyPlaybackRate] as? NSNumber)?.doubleValue == 0, "paused rate")
    check(engine.handleSystemCommand("favorite", favorite: true) == .success, "favorite accepted")
    check(commands.last?["itemID"] as? String == "a" && commands.last?["favorite"] as? Bool == true, "feedback binds identity and desired state")
    check(!MPRemoteCommandCenter.shared().likeCommand.isActive, "feedback cannot optimistically claim persistence")
    engine.setSystemFavorite(true, "a"); check(MPRemoteCommandCenter.shared().likeCommand.isActive, "persisted favorite active")
    engine.setSystemFavorite(false, "old"); check(MPRemoteCommandCenter.shared().likeCommand.isActive, "old favorite rejected")
    engine.setSystemArtwork(picture.absoluteString, "a"); load("b", 3)
    let bReadyDeadline = Date().addingTimeInterval(5)
    while !readyItems.contains("b") && Date() < bReadyDeadline { pump(0.02) }
    check(readyItems.contains("b"), "replacement fixture must reach AVPlayer ready state")
    check(info()[MPMediaItemPropertyArtwork] == nil, "late A image cannot cross load B")
    check(!MPRemoteCommandCenter.shared().likeCommand.isActive, "new item favorite cleared")
    engine.setSystemArtwork(picture.absoluteString, "a"); pump(); check(info()[MPMediaItemPropertyArtwork] == nil, "explicit old item rejected")
    engine.setSystemArtwork("https://example.invalid/cover?token=private", "b"); pump(); check(info()[MPMediaItemPropertyArtwork] == nil, "remote credentials never become artwork")
    let link = directory.appendingPathComponent("outside.png"); try FileManager.default.createSymbolicLink(at: link, withDestinationURL: URL(fileURLWithPath: "/etc/hosts"))
    engine.setSystemArtwork(link.absoluteString, "b"); pump(); check(info()[MPMediaItemPropertyArtwork] == nil, "symlink outside allowed roots rejected")
    check(engine.handleSystemCommand("seek", seconds: .nan) == .commandFailed, "invalid seek rejected")
    check(engine.handleSystemCommand("play") == .success, "remote play accepted")
    let playDeadline = Date().addingTimeInterval(5)
    while ((info()[MPNowPlayingInfoPropertyPlaybackRate] as? NSNumber)?.doubleValue ?? 0) <= 0 && Date() < playDeadline { pump(0.02) }
    check(((info()[MPNowPlayingInfoPropertyPlaybackRate] as? NSNumber)?.doubleValue ?? 0) > 0, "remote play resumes the actual AVPlayer")
    check(MPNowPlayingInfoCenter.default().playbackState == .playing, "remote play updates system playback state")
    check(engine.handleSystemCommand("toggle") == .success, "remote toggle pause accepted")
    check((info()[MPNowPlayingInfoPropertyPlaybackRate] as? NSNumber)?.doubleValue == 0, "remote toggle pauses immediately")
    check(engine.handleSystemCommand("seek", seconds: 1.2) == .success, "remote seek accepted")
    let seekDeadline = Date().addingTimeInterval(5)
    while abs(((info()[MPNowPlayingInfoPropertyElapsedPlaybackTime] as? NSNumber)?.doubleValue ?? 0) - 1.2) > 0.05 && Date() < seekDeadline { pump(0.02) }
    check(abs(((info()[MPNowPlayingInfoPropertyElapsedPlaybackTime] as? NSNumber)?.doubleValue ?? 0) - 1.2) <= 0.05, "remote seek moves the actual AVPlayer position")
    check(engine.handleSystemCommand("toggle") == .success, "remote toggle play accepted")
    let resumeDeadline = Date().addingTimeInterval(5)
    while ((info()[MPNowPlayingInfoPropertyPlaybackRate] as? NSNumber)?.doubleValue ?? 0) <= 0 && Date() < resumeDeadline { pump(0.02) }
    check(((info()[MPNowPlayingInfoPropertyPlaybackRate] as? NSNumber)?.doubleValue ?? 0) > 0, "remote toggle resumes from paused state")
    check(engine.handleSystemCommand("pause") == .success, "pause before queue commands accepted")
    for action in ["next", "previous"] { check(engine.handleSystemCommand(action) == .success, "accepted \(action)"); check(commands.last?["itemID"] as? String == "b", "control identity") }
    engine.stop(100); engine.setSystemArtwork(picture.absoluteString, "b"); pump()
    check(info().isEmpty && !MPRemoteCommandCenter.shared().likeCommand.isEnabled, "stop clears media and controls")
    for action in ["play", "toggle", "next", "previous"] { check(engine.handleSystemCommand(action) == .noSuchContent, "stopped \(action) rejected") }
    check(engine.handleSystemCommand("seek", seconds: 1) == .noSuchContent, "stopped seek rejected")
    check(engine.handleSystemCommand("favorite", favorite: true) == .noSuchContent, "stopped favorite rejected")
    print("Native system media passed: immediate play/toggle/seek plus actual Now Playing state, queue identity, pause lifetime, stale artwork/favorite, credential/path rejection and stopped commands")
  }
}
