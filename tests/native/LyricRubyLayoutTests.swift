import AppKit
import CoreGraphics
import Foundation

@main struct LyricRubyLayoutTests {
  static func close(_ actual: [CGFloat], _ expected: [CGFloat]) -> Bool {
    actual.count == expected.count && zip(actual, expected).allSatisfy { abs($0 - $1) < 0.001 }
  }

  static func textKitLines(_ text: String, width: CGFloat, font: NSFont) -> [String] {
    let storage = NSTextStorage(string: text, attributes: [.font: font])
    let manager = NSLayoutManager()
    let container = NSTextContainer(size: NSSize(width: width, height: 1000))
    container.lineFragmentPadding = 0
    container.lineBreakMode = .byWordWrapping
    storage.addLayoutManager(manager)
    manager.addTextContainer(container)
    manager.ensureLayout(for: container)
    let source = text as NSString
    var result: [String] = []
    var glyph = 0
    let all = manager.numberOfGlyphs
    while glyph < all {
      var range = NSRange()
      _ = manager.lineFragmentRect(forGlyphAt: glyph, effectiveRange: &range)
      let characters = manager.characterRange(forGlyphRange: range, actualGlyphRange: nil)
      result.append(source.substring(with: characters))
      glyph = NSMaxRange(range)
    }
    return result
  }

  static func main() {
    let widths: [CGFloat] = [10, 10, 10]
    let source = "起边中间到尾"
    let protected = LyricRubyLayout.protect(
      text: source,
      ranges: [NSRange(location: 4, length: 2)]
    )
    precondition(protected.text == "起边中间到\u{2060}尾")
    precondition(protected.range(NSRange(location: 4, length: 2)) == NSRange(location: 4, length: 3))
    precondition(protected.range(NSRange(location: 0, length: 2)) == NSRange(location: 0, length: 2))
    precondition(protected.range(NSRange(location: 6, length: 0)) == NSRange(location: 7, length: 0))
    precondition(protected.range(NSRange(location: -1, length: 1)) == nil)
    precondition(protected.range(NSRange(location: 7, length: 0)) == nil)
    let overlapping = LyricRubyLayout.protect(
      text: source,
      ranges: [
        NSRange(location: 4, length: 2),
        NSRange(location: 4, length: 2),
        NSRange(location: -1, length: 8),
        NSRange(location: 8, length: 0),
      ]
    )
    precondition(overlapping.text == protected.text)
    precondition(LyricRubyLayout.graphemes("A👩‍💻é") == ["A", "👩‍💻", "é"])
    precondition(LyricRubyLayout.graphemes("到\u{2060}尾") == ["到", "尾"])
    precondition(LyricRubyLayout.graphemeRanges(in: "到\u{2060}尾") == [
      NSRange(location: 0, length: 1),
      NSRange(location: 2, length: 1),
    ])
    let font = NSFont.systemFont(ofSize: 24, weight: .semibold)
    let unit = ("中" as NSString).size(withAttributes: [.font: font]).width
    let plainLines = textKitLines(source, width: unit * 5 + 0.5, font: font)
    let protectedLines = textKitLines(protected.text, width: unit * 5 + 0.5, font: font)
    precondition(plainLines.contains { $0.contains("到") != $0.contains("尾") })
    precondition(protectedLines.contains { $0.contains("到") && $0.contains("尾") })
    precondition(!protectedLines.contains { $0.contains("到") != $0.contains("尾") })
    precondition(close(LyricRubyLayout.horizontalOrigins(regionWidth: 100, glyphWidths: widths, alignment: .start), [0, 10, 20]))
    precondition(close(LyricRubyLayout.horizontalOrigins(regionWidth: 100, glyphWidths: widths, alignment: .center), [35, 45, 55]))
    precondition(close(LyricRubyLayout.horizontalOrigins(regionWidth: 100, glyphWidths: widths, alignment: .end), [70, 80, 90]))
    precondition(close(LyricRubyLayout.horizontalOrigins(regionWidth: 100, glyphWidths: widths, alignment: .spaceBetween), [0, 45, 90]))
    precondition(close(LyricRubyLayout.horizontalOrigins(regionWidth: 100, glyphWidths: widths, alignment: .spaceAround), [17.5, 45, 72.5]))
    precondition(close(LyricRubyLayout.horizontalOrigins(regionWidth: 100, glyphWidths: widths, alignment: .withBase, baseWidths: [20, 30, 50]), [5, 30, 70]))
    precondition(close(LyricRubyLayout.horizontalOrigins(regionWidth: 100, glyphWidths: widths, alignment: .withBase, baseWidths: [50, 50]), [35, 45, 55]))
    precondition(close(LyricRubyLayout.horizontalOrigins(regionWidth: 100, glyphWidths: [120], alignment: .center), [0]))
    precondition(LyricRubyLayout.horizontalOrigins(regionWidth: .nan, glyphWidths: widths, alignment: .center).isEmpty)
    precondition(LyricRubyLayout.horizontalOrigins(regionWidth: 100, glyphWidths: [-1], alignment: .center).isEmpty)
    precondition(LyricRubyAlignment(raw: "spaceBetween") == .spaceBetween)
    precondition(LyricRubyAlignment(raw: "unsupported") == .center)
    print("PASS ruby layout: six alignments, TextKit base protection, grapheme boundaries, with-base fallback and invalid inputs")
  }
}
