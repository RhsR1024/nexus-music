import ExpoModulesCore
import UIKit
import CoreText
import CoreImage

public final class NexusLyricsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NexusLyrics")
    View(NexusLyricLineView.self) {
      Prop("configuration") { (view: NexusLyricLineView, json: String) in view.configure(json) }
    }
  }
}

private final class LyricClockTarget: NSObject {
  weak var view: NexusLyricLineView?
  @objc func tick() { view?.tick() }
}

// Original TextKit renderer: only this visible line redraws, never a React list.
final class NexusLyricLineView: ExpoView {
  private let storage = NSTextStorage()
  private let manager = NSLayoutManager()
  private let container = NSTextContainer(size: .zero)
  private let clockTarget = LyricClockTarget()
  private var clock: CADisplayLink?
  private var words: [(range: NSRange, start: Double, end: Double)] = []
  private var position = 0.0, anchor = 0.0, playing = false
  private var signature = "", color = UIColor.white
  private var observers: [NSObjectProtocol] = []
  private var blur = 0.0, emphasis = true, embolden = 0.0
  private var stageStyle = "classic"
  private var blurred: UIImage?
  private var blurredSize = CGSize.zero
  private static let imageContext = CIContext(options: [.cacheIntermediates: false])
  private static func color(_ raw: String) -> UIColor {
    let text = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    if text.hasPrefix("rgb(") || text.hasPrefix("rgba("),
       let open = text.firstIndex(of: "("), let close = text.lastIndex(of: ")"), open < close {
      let parts = text[text.index(after: open)..<close].split(separator: ",").map { String($0).trimmingCharacters(in: .whitespaces) }
      if parts.count >= 3, let r = Double(parts[0]), let g = Double(parts[1]), let b = Double(parts[2]) {
        let a = parts.count > 3 ? Double(parts[3]) ?? 1 : 1
        return UIColor(red: CGFloat(min(255, max(0, r)) / 255), green: CGFloat(min(255, max(0, g)) / 255), blue: CGFloat(min(255, max(0, b)) / 255), alpha: CGFloat(min(1, max(0, a))))
      }
    }
    let hex = text.hasPrefix("#") ? String(text.dropFirst()) : text
    guard hex.count == 6, let value = UInt32(hex, radix: 16) else { return .white }
    return UIColor(red: CGFloat((value >> 16) & 255) / 255, green: CGFloat((value >> 8) & 255) / 255, blue: CGFloat(value & 255) / 255, alpha: 1)
  }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    isOpaque = false; backgroundColor = .clear; isUserInteractionEnabled = false
    storage.addLayoutManager(manager); manager.addTextContainer(container)
    container.lineFragmentPadding = 0
    clockTarget.view = self
    for name in [UIApplication.didBecomeActiveNotification, UIApplication.willResignActiveNotification, UIAccessibility.reduceMotionStatusDidChangeNotification, UIAccessibility.reduceTransparencyStatusDidChangeNotification] {
      observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in self?.blurred = nil; self?.updateClock(); self?.setNeedsDisplay() })
    }
  }
  deinit { clock?.invalidate(); for observer in observers { NotificationCenter.default.removeObserver(observer) } }
  override func didMoveToWindow() { super.didMoveToWindow(); updateClock() }
  override func layoutSubviews() {
    super.layoutSubviews(); if container.size != bounds.size { blurred = nil }; container.size = bounds.size; setNeedsDisplay()
  }
  func configure(_ json: String) {
    guard json.utf8.count < 262144, let object = try? JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any],
          let text = object["text"] as? String, text.utf16.count <= 20000 else { return }
    position = (object["position"] as? Double).flatMap { $0.isFinite ? $0 : nil } ?? 0
    anchor = CACurrentMediaTime(); playing = object["playing"] as? Bool == true
    let size = min(100, max(10, object["size"] as? Double ?? 24))
    let center = object["center"] as? Bool == true
    let height = min(2, max(1.1, (object["lineHeight"] as? Double).flatMap { $0.isFinite ? $0 : nil } ?? 1.35))
    let radius = min(4, max(0, (object["blur"] as? Double).flatMap { $0.isFinite ? $0 : nil } ?? 0))
    emphasis = object["emphasis"] as? Bool != false
    let hex = object["color"] as? String ?? "#FFFFFF"
    let fontURI = object["fontURI"] as? String ?? ""
    let requestedWeight = object["weight"] as? String ?? "600"
    let weight = ["500", "600", "700", "800", "900"].contains(requestedWeight) ? requestedWeight : "600"
    embolden = min(0.4, max(0, (object["embolden"] as? Double).flatMap { $0.isFinite ? $0 : nil } ?? 0))
    let requestedStyle = object["stageStyle"] as? String ?? "classic"
    let nextStyle = ["classic", "neon", "cyberpunk", "aurora"].contains(requestedStyle) ? requestedStyle : "classic"
    let rawWords = object["words"] as? [[String: Any]] ?? []
    let wordData = (try? JSONSerialization.data(withJSONObject: rawWords)) ?? Data()
    let layoutKey = "\(nextStyle)|\(text)|\(size)|\(center)|\(hex)|\(fontURI)|\(weight)|\(height)|\(radius)|\(embolden)|\(wordData.base64EncodedString())"
    if signature != layoutKey {
      signature = layoutKey; stageStyle = nextStyle; blur = radius; blurred = nil
      color = Self.color(hex)
      var font = UIFont.systemFont(ofSize: size, weight: weight == "900" ? .black : weight == "800" ? .heavy : weight == "700" ? .bold : weight == "600" ? .semibold : .medium)
      if let url = URL(string: fontURI), url.isFileURL,
         url.standardizedFileURL.path.hasPrefix(NSHomeDirectory() + "/Documents/lyric-fonts/"),
         let provider = CGDataProvider(url: url as CFURL), let cgFont = CGFont(provider), let name = cgFont.postScriptName,
         let custom = UIFont(name: name as String, size: size) { font = custom }
      let paragraph = NSMutableParagraphStyle(); paragraph.alignment = center ? .center : .left
      paragraph.minimumLineHeight = ceil(size * height); paragraph.maximumLineHeight = ceil(size * height)
      storage.setAttributedString(NSAttributedString(string: text, attributes: [.font: font, .paragraphStyle: paragraph, .foregroundColor: color]))
      if stageStyle == "aurora" {
        // Original stable spectrum across composed characters. Layout and real
        // word ranges remain unchanged; no inferred per-character timestamps.
        let palette: [UIColor] = [.init(red: 0.55, green: 0.9, blue: 1, alpha: 1), .init(red: 0.8, green: 0.65, blue: 1, alpha: 1), .init(red: 1, green: 0.65, blue: 0.84, alpha: 1), .init(red: 1, green: 0.85, blue: 0.55, alpha: 1), .init(red: 0.6, green: 1, blue: 0.75, alpha: 1)]
        var index = 0
        text.enumerateSubstrings(in: text.startIndex..<text.endIndex, options: .byComposedCharacterSequences) { _, range, _, _ in
          self.storage.addAttribute(.foregroundColor, value: palette[index % palette.count], range: NSRange(range, in: text)); index += 1
        }
      }
      words.removeAll(keepingCapacity: true); var offset = 0
      if rawWords.count <= 2000 {
        for word in rawWords {
          guard let part = word["text"] as? String, let start = word["startMs"] as? Double, let end = word["endMs"] as? Double,
                start.isFinite, end.isFinite, start >= 0, end >= start, end <= 86400000 else { words.removeAll(); break }
          words.append((NSRange(location: offset, length: part.utf16.count), start, end)); offset += part.utf16.count
        }
      }
      if offset != text.utf16.count || rawWords.compactMap({ $0["text"] as? String }).joined() != text { words.removeAll() }
    }
    updateClock(); setNeedsDisplay()
  }
  fileprivate func tick() {
    if position + (CACurrentMediaTime() - anchor) * 1000 >= (words.map { $0.end }.max() ?? 0) { position = words.map { $0.end }.max() ?? position; anchor = CACurrentMediaTime(); clock?.invalidate(); clock = nil }
    setNeedsDisplay()
  }
  private func updateClock() {
    let active = playing && position < (words.map { $0.end }.max() ?? 0) && !words.isEmpty && window != nil && UIApplication.shared.applicationState == .active && !UIAccessibility.isReduceMotionEnabled
    if active && clock == nil {
      let link = CADisplayLink(target: clockTarget, selector: #selector(LyricClockTarget.tick))
      link.preferredFramesPerSecond = 30; link.add(to: .main, forMode: .common); clock = link
    } else if !active { clock?.invalidate(); clock = nil }
  }
  private func drawInk(_ glyphs: NSRange, in context: CGContext) {
    context.saveGState()
    if !UIAccessibility.isReduceTransparencyEnabled {
      if stageStyle == "neon" {
        context.setShadow(offset: .zero, blur: 8, color: UIColor.cyan.withAlphaComponent(0.7).cgColor)
      } else if stageStyle == "aurora" {
        context.setShadow(offset: .zero, blur: 5, color: UIColor.systemPurple.withAlphaComponent(0.45).cgColor)
      } else if stageStyle == "cyberpunk" {
        context.setShadow(offset: CGSize(width: -2, height: 0), blur: 0, color: UIColor.cyan.withAlphaComponent(0.8).cgColor)
        manager.drawGlyphs(forGlyphRange: glyphs, at: .zero)
        context.setShadow(offset: CGSize(width: 2, height: 0), blur: 0, color: UIColor.magenta.withAlphaComponent(0.8).cgColor)
      }
    }
    if embolden > 0 {
      // Flutter synthesises the missing Black face; UIKit clamps PingFang to
      // Semibold, so dilate by the measured sub-pixel amount instead.
      for offset in [-embolden, 0, embolden] {
        context.saveGState(); context.translateBy(x: CGFloat(offset), y: 0)
        manager.drawGlyphs(forGlyphRange: glyphs, at: .zero); context.restoreGState()
      }
    } else {
      manager.drawGlyphs(forGlyphRange: glyphs, at: .zero)
    }
    context.restoreGState()
  }
  override func draw(_ rect: CGRect) {
    guard let context = UIGraphicsGetCurrentContext() else { return }
    let all = manager.glyphRange(for: container)
    if blur > 0 && words.isEmpty && !UIAccessibility.isReduceTransparencyEnabled && bounds.width > 0 && bounds.height > 0 && bounds.width * bounds.height <= 500000 {
      if blurred == nil || blurredSize != bounds.size {
        let format = UIGraphicsImageRendererFormat(); format.scale = 1
        let image = UIGraphicsImageRenderer(size: bounds.size, format: format).image { _ in manager.drawGlyphs(forGlyphRange: all, at: .zero) }
        if let input = CIImage(image: image), let output = CIFilter(name: "CIGaussianBlur", parameters: [kCIInputImageKey: input, kCIInputRadiusKey: blur])?.outputImage,
           let cg = Self.imageContext.createCGImage(output, from: input.extent) { blurred = UIImage(cgImage: cg); blurredSize = bounds.size }
      }
      if let image = blurred { image.draw(in: bounds); return }
    }
    context.saveGState(); context.setAlpha(words.isEmpty ? 1 : 0.32); drawInk(all, in: context); context.restoreGState()
    let time = position + (playing && clock != nil ? min(1000, (CACurrentMediaTime() - anchor) * 1000) : 0)
    for word in words {
      let fraction = word.end > word.start ? min(1, max(0, (time - word.start) / (word.end - word.start))) : (time >= word.start ? 1.0 : 0.0)
      guard fraction > 0 else { continue }
      let glyphs = manager.glyphRange(forCharacterRange: word.range, actualCharacterRange: nil)
      var rectangles: [CGRect] = []
      manager.enumerateEnclosingRects(forGlyphRange: glyphs, withinSelectedGlyphRange: NSRange(location: NSNotFound, length: 0), in: container) { region, _ in rectangles.append(region) }
      var remaining = rectangles.reduce(CGFloat(0)) { $0 + $1.width } * fraction
      for region in rectangles {
        let width = min(region.width, remaining); remaining -= width; if width <= 0 { continue }
        context.saveGState(); context.clip(to: CGRect(x: region.minX, y: region.minY, width: width, height: region.height))
        if emphasis && fraction < 1 && !UIAccessibility.isReduceMotionEnabled { context.setShadow(offset: .zero, blur: 3, color: color.withAlphaComponent(0.45).cgColor) }
        drawInk(glyphs, in: context); context.restoreGState()
      }
    }
  }
}
