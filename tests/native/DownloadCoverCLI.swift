import Foundation
import ImageIO
import CryptoKit

@main struct DownloadCoverCLI {
  static func sha(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
  static func dimensions(_ url: URL) -> [Int] {
    let source = CGImageSourceCreateWithURL(url as CFURL, nil)!, p = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as! [CFString: Any]
    precondition(CGImageSourceGetType(source) as String? == "public.jpeg")
    return [p[kCGImagePropertyPixelWidth] as! Int, p[kCGImagePropertyPixelHeight] as! Int]
  }
  static func main() throws {
    let args = CommandLine.arguments; precondition(args.count == 4)
    let audio = URL(fileURLWithPath: args[1]), input = URL(fileURLWithPath: args[2]), output = URL(fileURLWithPath: args[3]), fm = FileManager.default
    precondition(!fm.fileExists(atPath: output.path)); try fm.createDirectory(at: output, withIntermediateDirectories: false)
    let audioData = try Data(contentsOf: audio), data = try Data(contentsOf: input), audioSHA = sha(audioData), inputSHA = sha(data), inputDimensions = dimensions(input)
    let caches = fm.urls(for: .cachesDirectory, in: .userDomainMask)[0], root = caches.appendingPathComponent("NexusCoverExportContract-" + UUID().uuidString), stage = caches.appendingPathComponent("nexus-audio-export-" + UUID().uuidString)
    try fm.createDirectory(at: root, withIntermediateDirectories: false); try fm.createDirectory(at: stage, withIntermediateDirectories: false)
    defer { try? fm.removeItem(at: root); try? fm.removeItem(at: stage) }
    let normal = CoverCache(directory: root.appendingPathComponent("display")), exported = CoverCache(directory: root.appendingPathComponent("export"), maximumBytes: 16 * 1024 * 1024), normalKey = sha(Data("display".utf8))
    precondition(normal.store(data, key: normalKey, maxPixelSize: 1200) == nil)
    let normalURL = URL(string: normal.store(data, key: normalKey)!)!, normalSHA = sha(try Data(contentsOf: normalURL))
    var rows: [[String: Any]] = []
    for side in [256,500,512,1000,1024,1200,2048] {
      let key = sha(Data("export-\(side)".utf8)), cached = URL(string: exported.store(data, key: key, maxPixelSize: side, exporting: true)!)!
      let target = stage.appendingPathComponent("Public-\(side).jpg")
      _ = try AudioExportStaging.jpeg(cached.absoluteString, target: target.absoluteString, maxPixelSize: side)
      let size = dimensions(target), expected = min(side, inputDimensions.max()!); precondition(size.max()! == expected)
      let bytes = try Data(contentsOf: target); rows.append(["maximum": side, "dimensions": size, "sha256": sha(bytes), "bytes": bytes.count])
      if [256,1000,1200].contains(side) { try fm.copyItem(at: target, to: output.appendingPathComponent("Actual-\(side).jpg")) }
    }
    let small = URL(string: exported.hit(sha(Data("export-256".utf8)))!)!, enlarged = stage.appendingPathComponent("No-upscale.jpg")
    _ = try AudioExportStaging.jpeg(small.absoluteString, target: enlarged.absoluteString, maxPixelSize: 1200); precondition(dimensions(enlarged).max() == 256)
    for side in [-1,0,1201,2049] {
      precondition(exported.store(data, key: sha(Data("bad-\(side)".utf8)), maxPixelSize: side, exporting: true) == nil)
      do { _ = try AudioExportStaging.jpeg(small.absoluteString, target: stage.appendingPathComponent("Bad-\(side).jpg").absoluteString, maxPixelSize: side); fatalError("Expected rejection") } catch {}
    }
    exported.clear(); precondition(normal.hit(normalKey) != nil); let finalNormalSHA = sha(try Data(contentsOf: normalURL)); precondition(finalNormalSHA == normalSHA)
    let finalAudioSHA = sha(try Data(contentsOf: audio)), finalInputSHA = sha(try Data(contentsOf: input)); precondition(finalAudioSHA == audioSHA && finalInputSHA == inputSHA)
    let receipt: [String: Any] = ["audioSHA256": audioSHA, "inputCoverSHA256": inputSHA, "inputDimensions": inputDimensions, "outputs": rows, "smallNotEnlarged": true, "displayCachePreserved": true, "invalidSizesRejected": 4, "originalsPreserved": true]
    try JSONSerialization.data(withJSONObject: receipt, options: [.prettyPrinted,.sortedKeys]).write(to: output.appendingPathComponent("receipt.json"))
    print("Actual cover sizes, no upscale, display isolation and original audio preservation passed")
  }
}
