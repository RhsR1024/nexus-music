import Foundation
import ImageIO
import CryptoKit

@main struct AudioExportCLI {
  static func rejected(_ action: () throws -> Void) { do { try action(); fatalError("Expected rejection") } catch {} }
  static func sha(_ url: URL) throws -> String { SHA256.hash(data: try Data(contentsOf: url)).map { String(format: "%02x", $0) }.joined() }
  static func main() throws {
    let args = CommandLine.arguments
    guard args.count == 4 else { fatalError("audio cover output") }
    let input = URL(fileURLWithPath: args[1]), cover = URL(fileURLWithPath: args[2]), output = URL(fileURLWithPath: args[3]), fm = FileManager.default
    precondition(!fm.fileExists(atPath: output.path)); try fm.createDirectory(at: output, withIntermediateDirectories: false)
    let before = try sha(input), coverBefore = try sha(cover), cache = fm.urls(for: .cachesDirectory, in: .userDomainMask)[0]
    let root = cache.appendingPathComponent("nexus-audio-export-" + UUID().uuidString), other = cache.appendingPathComponent("nexus-audio-export-" + UUID().uuidString)
    try fm.createDirectory(at: root, withIntermediateDirectories: false); try fm.createDirectory(at: other, withIntermediateDirectories: false)
    defer { try? fm.removeItem(at: root); try? fm.removeItem(at: other) }
    let audio = root.appendingPathComponent("Public.mp3"), originalCover = root.appendingPathComponent("original.jpg"), jpg = root.appendingPathComponent("Public.jpg"), lrc = root.appendingPathComponent("Public.lrc"), meta = root.appendingPathComponent("Public.meta.json")
    try fm.copyItem(at: input, to: audio); try fm.copyItem(at: cover, to: originalCover)
    try "[00:01.00]Native boundary test\n".write(to: lrc, atomically: true, encoding: .utf8); try "{}".write(to: meta, atomically: true, encoding: .utf8)
    _ = try AudioExportStaging.jpeg(originalCover.absoluteString, target: jpg.absoluteString)
    let urls = try AudioExportStaging.files([audio,lrc,jpg,meta].map { $0.absoluteString }); precondition(urls.count == 4)
    let image = CGImageSourceCreateWithURL(jpg as CFURL, nil)!, properties = CGImageSourceCopyPropertiesAtIndex(image, 0, nil) as! [CFString: Any]
    let width = properties[kCGImagePropertyPixelWidth] as! Int, height = properties[kCGImagePropertyPixelHeight] as! Int
    precondition(CGImageSourceGetType(image) as String? == "public.jpeg" && max(width,height) <= 512)
    rejected { _ = try AudioExportStaging.stageURL("https://example.invalid/Public.mp3") }
    rejected { _ = try AudioExportStaging.stageURL(audio.absoluteString + "?token=dummy") }
    rejected { _ = try AudioExportStaging.files(Array(repeating: audio.absoluteString, count: 5)) }
    rejected { _ = try AudioExportStaging.files([audio.absoluteString,audio.absoluteString]) }
    let foreign = other.appendingPathComponent("Other.lrc"); try "data".write(to: foreign, atomically: true, encoding: .utf8)
    rejected { _ = try AudioExportStaging.files([audio.absoluteString,foreign.absoluteString]) }
    let link = root.appendingPathComponent("escape.mp3"); try fm.createSymbolicLink(at: link, withDestinationURL: input)
    rejected { _ = try AudioExportStaging.stageURL(link.absoluteString) }
    rejected { _ = try AudioExportStaging.jpeg(originalCover.absoluteString, target: audio.absoluteString) }
    let afterInput = try sha(input), afterCover = try sha(cover), afterAudio = try sha(audio)
    precondition(afterInput == before && afterCover == coverBefore && afterAudio == before)
    try fm.copyItem(at: jpg, to: output.appendingPathComponent("actual-cover-export.jpg"))
    let receipt: [String: Any] = ["realAudioSHA256": before, "realCoverSHA256": coverBefore, "jpegWidth": width, "jpegHeight": height, "validatedFiles": 4, "rejectedUnsafePathsAndSets": 7, "originalsPreserved": true]
    try JSONSerialization.data(withJSONObject: receipt, options: [.prettyPrinted,.sortedKeys]).write(to: output.appendingPathComponent("receipt.json"))
    print("Native staging/actual JPEG conversion and seven unsafe sets passed")
  }
}
