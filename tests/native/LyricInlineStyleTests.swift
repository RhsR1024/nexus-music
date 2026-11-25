import Foundation

@main struct LyricInlineStyleTests {
  static func main() {
    let full = LyricInlineStyle.decode([
      "fontStyle": "italic",
      "fontWeight": "bold",
      "textDecoration": ["underline", "lineThrough", "overline"],
      "color": "#12345678",
      "backgroundColor": "#abcdef01",
    ])
    precondition(full?.fontStyle == .italic)
    precondition(full?.fontWeight == .bold)
    precondition(full?.decorations == [.underline, .lineThrough, .overline])
    precondition(full?.color == LyricInlineStyle.Color(red: Double(0x12) / 255, green: Double(0x34) / 255, blue: Double(0x56) / 255, alpha: Double(0x78) / 255))
    precondition(full?.backgroundColor == LyricInlineStyle.Color(red: Double(0xab) / 255, green: Double(0xcd) / 255, blue: Double(0xef) / 255, alpha: Double(1) / 255))
    let emptyDecorations = LyricInlineStyle.decode(["textDecoration": [String]()])
    precondition(emptyDecorations?.decorations == LyricInlineStyle.Decorations([]))
    precondition(LyricInlineStyle.decode([:]) == nil)
    for invalid: [String: Any] in [
      ["fontStyle": "slanted"],
      ["fontWeight": "heavy"],
      ["textDecoration": ["underline", "blink"]],
      ["textDecoration": "underline"],
      ["color": "#fff"],
      ["backgroundColor": "red"],
    ] {
      precondition(LyricInlineStyle.decode(invalid) == nil)
    }
    print("PASS inline lyric style: decoder, color bounds, decorations and fail-closed input")
  }
}
