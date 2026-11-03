import CoreGraphics
import Foundation

enum LyricRubyAlignment: String {
  case start
  case center
  case end
  case spaceAround
  case spaceBetween
  case withBase

  init(raw:String?) {
    self = raw.flatMap(Self.init(rawValue:)) ?? .center
  }
}

enum LyricRubyLayout {
  static func graphemes(_ text: String) -> [String] {
    var result: [String] = []
    text.enumerateSubstrings(in: text.startIndex..<text.endIndex, options: .byComposedCharacterSequences) {
      value, _, _, _ in
      if let value=value { result.append(value) }
    }
    return result
  }

  static func horizontalOrigins(
    regionWidth: CGFloat,
    glyphWidths: [CGFloat],
    alignment: LyricRubyAlignment,
    baseWidths: [CGFloat] = []
  ) -> [CGFloat] {
    guard regionWidth.isFinite, regionWidth > 0, !glyphWidths.isEmpty,
          glyphWidths.allSatisfy({ $0.isFinite && $0 >= 0 }) else { return [] }
    let widths = glyphWidths
    let total = widths.reduce(0, +)
    let available = max(0, regionWidth - total)

    func centered() -> [CGFloat] {
      let x = max(0, available / 2)
      var cursor = x
      return widths.map { width in
        defer { cursor += width }
        return cursor
      }
    }

    switch alignment {
    case .start:
      var cursor: CGFloat = 0
      return widths.map { width in
        defer { cursor += width }
        return cursor
      }
    case .center:
      return centered()
    case .end:
      var cursor = total <= regionWidth ? available : 0
      return widths.map { width in
        defer { cursor += width }
        return cursor
      }
    case .spaceAround:
      let gap = available / CGFloat(widths.count + 1)
      var cursor = gap
      return widths.map { width in
        defer { cursor += width + gap }
        return cursor
      }
    case .spaceBetween:
      guard widths.count > 1 else { return centered() }
      let gap = available / CGFloat(widths.count - 1)
      var cursor: CGFloat = 0
      return widths.map { width in
        defer { cursor += width + gap }
        return cursor
      }
    case .withBase:
      guard baseWidths.count == widths.count,
            baseWidths.allSatisfy({ $0.isFinite && $0 > 0 }) else { return centered() }
      var baseOrigin: CGFloat = 0
      return widths.enumerated().map { index, width in
        defer { baseOrigin += baseWidths[index] }
        return min(max(0, baseOrigin + (baseWidths[index] - width) / 2), max(0, regionWidth - width))
      }
    }
  }
}
