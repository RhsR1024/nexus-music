import ExpoModulesCore
import UIKit
import CoreText

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

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    isOpaque = false; backgroundColor = .clear; isUserInteractionEnabled = false
    storage.addLayoutManager(manager); manager.addTextContainer(container)
    container.lineFragmentPadding = 0
    clockTarget.view = self
    for name in [UIApplication.didBecomeActiveNotification, UIApplication.willResignActiveNotification, UIAccessibility.reduceMotionStatusDidChangeNotification] {
      observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in self?.updateClock() })
    }
  }
  deinit { clock?.invalidate(); for observer in observers { NotificationCenter.default.removeObserver(observer) } }
  override func didMoveToWindow() { super.didMoveToWindow(); updateClock() }
  override func layoutSubviews() {
    super.layoutSubviews(); container.size = bounds.size; setNeedsDisplay()
  }
  func configure(_ json: String) {
    guard json.utf8.count < 262144, let object = try? JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any],
          let text = object["text"] as? String, text.utf16.count <= 20000 else { return }
    position = (object["position"] as? Double).flatMap { $0.isFinite ? $0 : nil } ?? 0
    anchor = CACurrentMediaTime(); playing = object["playing"] as? Bool == true
    let size = min(100, max(10, object["size"] as? Double ?? 24))
    let center = object["center"] as? Bool == true
    let hex = object["color"] as? String ?? "#FFFFFF"
    let fontURI = object["fontURI"] as? String ?? ""
    let rawWords = object["words"] as? [[String: Any]] ?? []
    let wordData = (try? JSONSerialization.data(withJSONObject: rawWords)) ?? Data()
    let layoutKey = "\(text)|\(size)|\(center)|\(hex)|\(fontURI)|\(wordData.base64EncodedString())"
    if signature != layoutKey {
      signature = layoutKey
      let value = UInt32(hex.replacingOccurrences(of: "#", with: ""), radix: 16) ?? 0xFFFFFF
      color = UIColor(red: CGFloat((value >> 16) & 255) / 255, green: CGFloat((value >> 8) & 255) / 255, blue: CGFloat(value & 255) / 255, alpha: 1)
      var font = UIFont.systemFont(ofSize: size, weight: .semibold)
      if let url = URL(string: fontURI), url.isFileURL,
         url.standardizedFileURL.path.hasPrefix(NSHomeDirectory() + "/Documents/lyric-fonts/"),
         let provider = CGDataProvider(url: url as CFURL), let cgFont = CGFont(provider), let name = cgFont.postScriptName,
         let custom = UIFont(name: name as String, size: size) { font = custom }
      let paragraph = NSMutableParagraphStyle(); paragraph.alignment = center ? .center : .left
      paragraph.minimumLineHeight = ceil(size * 1.35); paragraph.maximumLineHeight = ceil(size * 1.35)
      storage.setAttributedString(NSAttributedString(string: text, attributes: [.font: font, .paragraphStyle: paragraph, .foregroundColor: color]))
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
  override func draw(_ rect: CGRect) {
    guard let context = UIGraphicsGetCurrentContext() else { return }
    let all = manager.glyphRange(for: container)
    context.saveGState(); context.setAlpha(words.isEmpty ? 1 : 0.32); manager.drawGlyphs(forGlyphRange: all, at: .zero); context.restoreGState()
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
        if fraction < 1 && !UIAccessibility.isReduceMotionEnabled { context.setShadow(offset: .zero, blur: 3, color: color.withAlphaComponent(0.45).cgColor) }
        manager.drawGlyphs(forGlyphRange: glyphs, at: .zero); context.restoreGState()
      }
    }
  }
}
