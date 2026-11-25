import Foundation

struct LyricInlineStyle: Equatable {
  enum FontStyle: String {
    case normal, italic, oblique
  }

  enum FontWeight: String {
    case normal, bold
  }

  struct Decorations: OptionSet, Equatable {
    let rawValue: Int
    static let underline = Decorations(rawValue: 1 << 0)
    static let lineThrough = Decorations(rawValue: 1 << 1)
    static let overline = Decorations(rawValue: 1 << 2)
  }

  struct Color: Equatable {
    let red, green, blue, alpha: Double
  }

  let fontStyle: FontStyle?
  let fontWeight: FontWeight?
  let decorations: Decorations?
  let color: Color?
  let backgroundColor: Color?

  static func decode(_ value: Any?) -> LyricInlineStyle? {
    guard let object = value as? [String: Any] else { return nil }
    let fontStyle: FontStyle?
    if let raw = object["fontStyle"] {
      guard let text = raw as? String, let parsed = FontStyle(rawValue: text) else { return nil }
      fontStyle = parsed
    } else {
      fontStyle = nil
    }
    let fontWeight: FontWeight?
    if let raw = object["fontWeight"] {
      guard let text = raw as? String, let parsed = FontWeight(rawValue: text) else { return nil }
      fontWeight = parsed
    } else {
      fontWeight = nil
    }
    let decorations: Decorations?
    if let raw = object["textDecoration"] {
      guard let values = raw as? [String] else { return nil }
      var parsed = Decorations([])
      for value in values {
        switch value {
        case "underline": parsed.insert(.underline)
        case "lineThrough": parsed.insert(.lineThrough)
        case "overline": parsed.insert(.overline)
        default: return nil
        }
      }
      decorations = parsed
    } else {
      decorations = nil
    }
    let color: Color?
    if object["color"] != nil {
      guard let parsed = parseColor(object["color"]) else { return nil }
      color = parsed
    } else {
      color = nil
    }
    let backgroundColor: Color?
    if object["backgroundColor"] != nil {
      guard let parsed = parseColor(object["backgroundColor"]) else { return nil }
      backgroundColor = parsed
    } else {
      backgroundColor = nil
    }
    guard fontStyle != nil || fontWeight != nil || decorations != nil || color != nil || backgroundColor != nil else { return nil }
    return LyricInlineStyle(
      fontStyle: fontStyle,
      fontWeight: fontWeight,
      decorations: decorations,
      color: color,
      backgroundColor: backgroundColor
    )
  }

  private static func parseColor(_ value: Any?) -> Color? {
    guard let text = value as? String, text.count == 9, text.hasPrefix("#") else { return nil }
    let hex = String(text.dropFirst())
    guard hex.count == 8, let raw = UInt32(hex, radix: 16) else { return nil }
    return Color(
      red: Double((raw >> 24) & 255) / 255,
      green: Double((raw >> 16) & 255) / 255,
      blue: Double((raw >> 8) & 255) / 255,
      alpha: Double(raw & 255) / 255
    )
  }
}
