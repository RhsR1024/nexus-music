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
  static let wordJoiner = "\u{2060}"

  struct ProtectedText {
    let text: String
    private let sourceLength: Int
    private let boundaries: [Int]

    fileprivate init(text: String, sourceLength: Int, boundaries: [Int]) {
      self.text = text
      self.sourceLength = sourceLength
      self.boundaries = boundaries
    }

    private func layoutOffset(_ sourceOffset: Int) -> Int? {
      guard sourceOffset >= 0, sourceOffset <= sourceLength else { return nil }
      return sourceOffset + boundaries.prefix { $0 < sourceOffset }.count
    }

    func range(_ sourceRange: NSRange) -> NSRange? {
      guard sourceRange.location >= 0, sourceRange.length >= 0,
            sourceRange.location <= sourceLength,
            sourceRange.length <= sourceLength - sourceRange.location,
            let start = layoutOffset(sourceRange.location),
            let end = layoutOffset(NSMaxRange(sourceRange)) else { return nil }
      return NSRange(location: start, length: end - start)
    }
  }

  static func protect(
    text: String,
    ranges: [NSRange]
  ) -> ProtectedText {
    let source = text as NSString
    let sourceLength = source.length
    let validRanges = ranges.filter {
      $0.location >= 0 && $0.length > 0 &&
        $0.location <= sourceLength &&
        $0.length <= sourceLength - $0.location
    }
    var boundaries = Set<Int>()
    text.enumerateSubstrings(
      in: text.startIndex..<text.endIndex,
      options: .byComposedCharacterSequences
    ) { _, range, _, _ in
      let boundary = NSMaxRange(NSRange(range, in: text))
      if validRanges.contains(where: {
        boundary > $0.location && boundary < NSMaxRange($0)
      }) {
        boundaries.insert(boundary)
      }
    }
    let sorted = boundaries.sorted()
    guard !sorted.isEmpty else {
      return ProtectedText(text: text, sourceLength: sourceLength, boundaries: [])
    }
    var result = ""
    var cursor = 0
    for boundary in sorted {
      result += source.substring(with: NSRange(
        location: cursor,
        length: boundary - cursor
      ))
      result += wordJoiner
      cursor = boundary
    }
    result += source.substring(from: cursor)
    return ProtectedText(
      text: result,
      sourceLength: sourceLength,
      boundaries: sorted
    )
  }

  static func graphemes(_ text: String) -> [String] {
    graphemeRanges(in: text).compactMap {
      Range($0, in: text).map { String(text[$0]) }
    }
  }

  static func graphemeRanges(in text: String) -> [NSRange] {
    var result: [NSRange] = []
    text.enumerateSubstrings(
      in: text.startIndex..<text.endIndex,
      options: .byComposedCharacterSequences
    ) { value, range, _, _ in
      if let value, value != wordJoiner {
        result.append(NSRange(range, in: text))
      }
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
