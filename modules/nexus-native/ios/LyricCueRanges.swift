import Foundation

// Decode only supplied cue spans. Untimed characters receive no timestamps.
struct LyricCueRange {
  let range: NSRange
  let start: Double
  let end: Double
}
enum LyricCueRanges {
  // A legal 2000-cue CJK line can exceed the former 256KiB bridge payload.
  static let configurationByteLimit = 1_048_576
  static func decode(text: String, cues: [[String: Any]]) -> [LyricCueRange]? {
    guard !cues.isEmpty, cues.count <= 2000, text.utf16.count <= 20000 else { return nil }
    let string = text as NSString
    var boundaries = [0: 0], bytes = 0, units = 0
    for scalar in text.unicodeScalars {
      bytes += String(scalar).utf8.count
      units += scalar.value > 0xffff ? 2 : 1
      boundaries[bytes] = units
    }
    var result: [LyricCueRange] = [], previousByte = -1, previousEnd = -1.0
    for cue in cues {
      guard let first = cue["byteStart"] as? Double, let last = cue["byteEnd"] as? Double,
            first.isFinite, last.isFinite, first.rounded() == first, last.rounded() == last,
            first > Double(previousByte), first >= 0, last >= first, last < Double(bytes),
            let lower = boundaries[Int(first)], let upper = boundaries[Int(last) + 1],
            let part = cue["text"] as? String,
            let start = cue["startMs"] as? Double, let end = cue["endMs"] as? Double,
            start.isFinite, end.isFinite, start >= 0, start >= previousEnd,
            end >= start, end <= 86400000 else { return nil }
      let range = NSRange(location: lower, length: upper - lower)
      guard string.substring(with: range) == part,
            NSEqualRanges(string.rangeOfComposedCharacterSequences(for: range), range) else { return nil }
      result.append(LyricCueRange(range: range, start: start, end: end))
      previousByte = Int(last); previousEnd = end
    }
    return result
  }
  static func untimed(text: String, cues: [LyricCueRange]) -> [NSRange] {
    var result: [NSRange] = [], offset = 0
    for cue in cues {
      if cue.range.location > offset { result.append(NSRange(location: offset, length: cue.range.location - offset)) }
      offset = NSMaxRange(cue.range)
    }
    if offset < text.utf16.count { result.append(NSRange(location: offset, length: text.utf16.count - offset)) }
    return result
  }
}
