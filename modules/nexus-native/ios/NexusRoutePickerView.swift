import AVKit
import ExpoModulesCore
import UIKit

/// Thin native host for Apple's system audio-route picker. Nexus does not
/// duplicate the available routes or any audio-session policy here.
final class NexusRoutePickerView: ExpoView {
  private let picker = AVRoutePickerView()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    isAccessibilityElement = true
    accessibilityIdentifier = "audio-output-route-picker"
    accessibilityLabel = "选择音频输出"
    accessibilityHint = "打开系统 AirPlay、蓝牙和耳机输出选择器"
    accessibilityTraits = [.button]

    picker.prioritizesVideoDevices = false
    picker.backgroundColor = .clear
    picker.accessibilityElementsHidden = true
    addSubview(picker)
  }

  func setTint(_ raw: String) {
    picker.tintColor = Self.color(raw)
  }

  func setActiveTint(_ raw: String) {
    picker.activeTintColor = Self.color(raw)
  }

  override var intrinsicContentSize: CGSize {
    CGSize(width: 44, height: 44)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    picker.frame = bounds
  }

  override func accessibilityActivate() -> Bool {
    guard let button = firstButton(in: picker) else { return false }
    button.sendActions(for: .touchUpInside)
    return true
  }

  private func firstButton(in view: UIView) -> UIButton? {
    if let button = view as? UIButton { return button }
    for child in view.subviews {
      if let button = firstButton(in: child) { return button }
    }
    return nil
  }

  private static func color(_ raw: String) -> UIColor {
    var hex = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    if hex.hasPrefix("#") { hex.removeFirst() }
    if hex.count == 6 { hex += "ff" }
    guard hex.count == 8, let value = UInt64(hex, radix: 16) else { return .label }
    return UIColor(
      red: CGFloat((value >> 24) & 0xff) / 255,
      green: CGFloat((value >> 16) & 0xff) / 255,
      blue: CGFloat((value >> 8) & 0xff) / 255,
      alpha: CGFloat(value & 0xff) / 255
    )
  }
}
