import CoreGraphics
import Foundation

@main struct LyricRubyLayoutTests {
  static func close(_ actual: [CGFloat], _ expected: [CGFloat]) -> Bool {
    actual.count == expected.count && zip(actual, expected).allSatisfy { abs($0 - $1) < 0.001 }
  }

  static func main() {
    let widths: [CGFloat] = [10, 10, 10]
    precondition(LyricRubyLayout.graphemes("A👩‍💻é") == ["A", "👩‍💻", "é"])
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
    print("PASS ruby alignment: six modes, grapheme boundaries, with-base fallback and invalid inputs")
  }
}
