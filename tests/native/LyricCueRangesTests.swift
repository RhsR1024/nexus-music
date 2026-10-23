import Foundation
func cue(_ first: Int, _ last: Int, _ text: String, _ start: Double = 1000, _ end: Double = 2000) -> [String: Any] {
  ["byteStart": Double(first), "byteEnd": Double(last), "text": text, "startMs": start, "endMs": end]
}
@main struct LyricCueRangesTests {
  static func main() {
    let text = "前👩‍💻中é后"
    // UTF8: 前0..2, emoji3..13, 中14..16, é17..18, 后19..21.
    let valid = LyricCueRanges.decode(text: text, cues: [cue(3,13,"👩‍💻"),cue(17,18,"é",3000,4000)])!
    precondition(valid.map(\.range) == [NSRange(location:1,length:5),NSRange(location:7,length:1)])
    let staticText = LyricCueRanges.untimed(text: text, cues: valid).map { (text as NSString).substring(with:$0) }
    precondition(staticText == ["前","中","后"])
    precondition(valid.map(\.start) == [1000,3000] && valid.map(\.end) == [2000,4000])
    precondition(LyricCueRanges.decode(text:text,cues:[cue(4,13,"👩‍💻")]) == nil)
    precondition(LyricCueRanges.decode(text:text,cues:[cue(3,6,"👩")]) == nil)
    precondition(LyricCueRanges.decode(text:"e\u{301}x",cues:[cue(0,0,"e")]) == nil)
    precondition(LyricCueRanges.decode(text:text,cues:[cue(3,13,"wrong")]) == nil)
    precondition(LyricCueRanges.decode(text:text,cues:[cue(3,13,"👩‍💻"),cue(17,18,"é",1500,3000)]) == nil)
    precondition(LyricCueRanges.decode(text:text,cues:[cue(3,13,"👩‍💻",.nan,2000)]) == nil)
    precondition(LyricCueRanges.decode(text:text,cues:Array(repeating:cue(3,13,"👩‍💻"),count:2001)) == nil)
    let part = "甲乙丙丁戊己庚辛壬", unit = part + "未"
    let largeText = String(repeating: unit, count: 2000)
    let largeCues = (0..<2000).map { index in cue(index * 30, index * 30 + 26, part, Double(86000000 + index * 2), Double(86000000 + index * 2 + 1)) }
    let large = LyricCueRanges.decode(text: largeText, cues: largeCues)!
    precondition(large.count == 2000 && LyricCueRanges.untimed(text: largeText, cues: large).count == 2000)
    let payload = try! JSONSerialization.data(withJSONObject: ["text": largeText, "timedCues": largeCues])
    print("Large sparse configuration bytes: \(payload.count)")
    precondition(payload.count > 262144 && payload.count < LyricCueRanges.configurationByteLimit)
    precondition(LyricCueRanges.decode(text: largeText + "越", cues: largeCues) == nil)
    precondition(LyricCueRanges.decode(text: "a", cues: [cue(0, 0, "a", 1000, 1000)])!.first!.end == 1000)
    print("PASS sparse cue ranges: UTF8/UTF16, holes, graphemes, invalid ranges/times, 2000-cue payload and 20000-unit boundary")
  }
}
