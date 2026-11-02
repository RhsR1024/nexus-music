import ExpoModulesCore
import MediaPlayer
import UIKit

/// Hosts Apple's public `MPVolumeView` slider. The current audio route and its
/// hardware volume remain system-owned; Nexus does not write a mirrored value
/// into preferences or attempt to control the output device directly.
final class NexusDeviceVolumeView: ExpoView {
  private let volumeView = MPVolumeView(frame: .zero)
  private let rendersSystemVolumeControl: Bool = {
#if targetEnvironment(simulator)
    false
#else
    true
#endif
  }()
  private let unavailableLabel: UILabel = {
    let label = UILabel()
    label.text = "当前环境未提供系统音量滑块"
    label.textAlignment = .center
    label.textColor = .secondaryLabel
    label.font = .preferredFont(forTextStyle: .caption1)
    label.numberOfLines = 1
    label.adjustsFontForContentSizeCategory = true
    label.isAccessibilityElement = false
    return label
  }()
  private weak var volumeSlider: UISlider?
  private var controlTint = UIColor.label
  private let valueFormatter: NumberFormatter = {
    let formatter = NumberFormatter()
    formatter.numberStyle = .percent
    formatter.maximumFractionDigits = 0
    return formatter
  }()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    isAccessibilityElement = true
    accessibilityIdentifier = "device-volume-slider"
    accessibilityLabel = "设备音量"
    accessibilityHint = "上滑或下滑调整当前输出设备的系统音量"
    accessibilityValue = rendersSystemVolumeControl ? "系统输出音量" : "此环境不提供系统音量滑块"
    accessibilityTraits = .adjustable

    volumeView.showsVolumeSlider = true
    volumeView.showsRouteButton = false
    volumeView.backgroundColor = .clear
    volumeView.isAccessibilityElement = false
    volumeView.isHidden = !rendersSystemVolumeControl
    unavailableLabel.isHidden = rendersSystemVolumeControl
    addSubview(unavailableLabel)
    addSubview(volumeView)
  }

  func setTint(_ raw: String) {
    controlTint = Self.color(raw)
    volumeView.tintColor = controlTint
    styleVolumeSlider()
  }

  override var intrinsicContentSize: CGSize {
    CGSize(width: 240, height: 44)
  }

  override func accessibilityIncrement() {
    adjustVolume(by: 1)
  }

  override func accessibilityDecrement() {
    adjustVolume(by: -1)
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    guard window != nil else { return }
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.volumeView.setNeedsLayout()
      self.volumeView.layoutIfNeeded()
      self.styleVolumeSlider()
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    unavailableLabel.frame = bounds.insetBy(dx: 12, dy: 0)
    volumeView.frame = bounds
    styleVolumeSlider()
  }

  private func styleVolumeSlider() {
    guard rendersSystemVolumeControl, let slider = firstDescendant(UISlider.self, in: volumeView) else { return }
    unavailableLabel.isHidden = true
    if volumeSlider !== slider {
      volumeSlider = slider
      slider.isAccessibilityElement = false
      slider.addTarget(self, action: #selector(sliderChanged), for: .valueChanged)
    }
    slider.minimumTrackTintColor = controlTint
    slider.maximumTrackTintColor = controlTint.withAlphaComponent(0.24)
    slider.thumbTintColor = controlTint
    accessibilityValue = volumeValueText(for: slider)
  }

  private func adjustVolume(by direction: CGFloat) {
    guard rendersSystemVolumeControl, let slider = volumeSlider, slider.maximumValue > slider.minimumValue else {
      UIAccessibility.post(notification: .announcement, argument: "此环境不提供系统音量滑块")
      return
    }
    let step = (slider.maximumValue - slider.minimumValue) / 16
    let delta = Float(direction) * step
    slider.setValue(min(slider.maximumValue, max(slider.minimumValue, slider.value + delta)), animated: true)
    slider.sendActions(for: .valueChanged)
    UIAccessibility.post(notification: .announcement, argument: volumeValueText(for: slider))
  }

  @objc private func sliderChanged() {
    guard let slider = volumeSlider else { return }
    accessibilityValue = volumeValueText(for: slider)
  }

  private func volumeValueText(for slider: UISlider) -> String {
    guard slider.maximumValue > slider.minimumValue else { return "此环境不提供系统音量滑块" }
    let fraction = (slider.value - slider.minimumValue) / (slider.maximumValue - slider.minimumValue)
    return valueFormatter.string(from: NSNumber(value: Double(fraction))) ?? "\(Int(fraction * 100))%"
  }

  private func firstDescendant<T: UIView>(_ type: T.Type, in root: UIView) -> T? {
    if let match = root as? T { return match }
    for child in root.subviews {
      if let match = firstDescendant(type, in: child) { return match }
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
