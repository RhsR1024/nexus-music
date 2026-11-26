import ExpoModulesCore
import UIKit

// Native iOS frosted / Liquid Glass surface. On iOS 26+, the "liquid" variant
// uses Apple's native UIGlassEffect so scrolling artwork refracts behind the
// floating tab bar and mini player; frosted/acrylic and older OS versions use
// translucent ultra-thin system materials rather than opaque fills.
final class NexusMaterialView: ExpoView {
  private let material = UIVisualEffectView(effect: UIBlurEffect(style: .systemUltraThinMaterialLight))
  private var dark = false
  private var variant = "liquid"
  private var cornerRadius: CGFloat = 30

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    material.isUserInteractionEnabled = false
    material.clipsToBounds = true
    addSubview(material)
    clipsToBounds = true
    applyEffect()
  }

  func setDark(_ dark: Bool) {
    guard self.dark != dark else { return }
    self.dark = dark
    applyEffect()
  }

  func setVariant(_ value: String) {
    let next = value.isEmpty ? "liquid" : value
    guard self.variant != next else { return }
    self.variant = next
    applyEffect()
  }

  func setRadius(_ value: Double) {
    let next = CGFloat(max(0, value))
    guard abs(self.cornerRadius - next) > 0.1 else { return }
    self.cornerRadius = next
    applyCornerRadius()
  }

  private func applyEffect() {
    if #available(iOS 26.0, *), variant == "liquid" {
      let glass = UIGlassEffect(style: .regular)
      glass.tintColor = dark
        ? UIColor(red: 0.14, green: 0.11, blue: 0.17, alpha: 0.24)
        : UIColor(red: 1.0, green: 0.985, blue: 0.99, alpha: 0.28)
      material.effect = glass
    } else if variant == "frosted" {
      material.effect = UIBlurEffect(style: dark ? .systemThinMaterialDark : .systemThinMaterialLight)
    } else {
      material.effect = UIBlurEffect(style: dark ? .systemUltraThinMaterialDark : .systemUltraThinMaterialLight)
    }
    applyCornerRadius()
  }

  private func applyCornerRadius() {
    let clamped = bounds.height > 0 ? min(cornerRadius, bounds.height / 2) : cornerRadius
    material.layer.cornerRadius = clamped
    material.layer.cornerCurve = .continuous
    layer.cornerRadius = clamped
    layer.cornerCurve = .continuous
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    material.frame = bounds
    applyCornerRadius()
  }
}

// Static alpha mask for the existing RN image child. No image decoding or clock.
final class NexusPhotoMaskView: ExpoView {
  private let fade = CAGradientLayer()
  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    fade.colors = [UIColor.white.cgColor, UIColor.white.cgColor,
                   UIColor.white.withAlphaComponent(168.0 / 255.0).cgColor, UIColor.clear.cgColor]
    fade.locations = [0, 0.5, 0.76, 1]
    fade.startPoint = CGPoint(x: 0.5, y: 0)
    fade.endPoint = CGPoint(x: 0.5, y: 1)
    applyMask()
  }
  // Fabric owns clipping and clears layer.mask when finalizing styles. The
  // module invokes this again in OnViewDidUpdateProps, after that finalization.
  func applyMask() {
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    fade.frame = bounds
    layer.mask = fade
    CATransaction.commit()
  }
  override func layoutSubviews() {
    super.layoutSubviews()
    applyMask()
  }
  override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
    super.traitCollectionDidChange(previousTraitCollection)
    applyMask()
  }
}

// Static reflected light, independent of the rotating record above this view.
final class NexusVinylReflectionView: ExpoView {
  private let light = CAGradientLayer()
  private let falloff = CAGradientLayer()
  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    isUserInteractionEnabled = false
    light.type = .conic
    light.startPoint = CGPoint(x: 0.5, y: 0.5)
    light.endPoint = CGPoint(x: 0.5, y: 0)
    let alpha: [CGFloat] = [0, 0, 0.06, 0.22, 0.18, 0.08, 0.03, 0.03, 0, 0]
    light.colors = alpha.map { UIColor(white: 0.84, alpha: $0).cgColor }
    light.locations = [0, 0.4722, 0.5278, 0.5556, 0.5833, 0.6111, 0.6389, 0.6944, 0.75, 1]
    falloff.type = .radial
    falloff.startPoint = CGPoint(x: 0.5, y: 0.5)
    falloff.endPoint = CGPoint(x: 1, y: 1)
    falloff.colors = [UIColor.clear.cgColor, UIColor.clear.cgColor, UIColor.white.cgColor,
                      UIColor.white.cgColor, UIColor.clear.cgColor, UIColor.clear.cgColor]
    // The radial ellipse spans the disc bounds; stops use disc-radius fractions.
    falloff.locations = [0, 0.48, 0.6, 0.83, 0.95, 1]
    light.mask = falloff
    layer.addSublayer(light)
  }
  override func layoutSubviews() {
    super.layoutSubviews()
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    light.frame = bounds
    falloff.frame = bounds
    CATransaction.commit()
  }
}

// Static metallic pivot: radial falloff plus directional shade. No animation clock.
final class NexusVinylPivotView: ExpoView {
  private let metal = CAGradientLayer()
  private let shade = CAGradientLayer()
  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    isUserInteractionEnabled = false
    clipsToBounds = true
    metal.type = .radial
    metal.startPoint = CGPoint(x: 0.5, y: 0.5)
    metal.endPoint = CGPoint(x: 1, y: 1)
    metal.colors = [UIColor(red: 242.0/255, green: 242.0/255, blue: 235.0/255, alpha: 1).cgColor,
                    UIColor(red: 242.0/255, green: 242.0/255, blue: 235.0/255, alpha: 1).cgColor,
                    UIColor(red: 124.0/255, green: 124.0/255, blue: 120.0/255, alpha: 1).cgColor]
    metal.locations = [0, 0.58, 1]
    shade.startPoint = CGPoint(x: 0.1, y: 0.1)
    shade.endPoint = CGPoint(x: 0.9, y: 0.9)
    shade.colors = [UIColor.clear.cgColor, UIColor.black.withAlphaComponent(0.93).cgColor]
    layer.addSublayer(metal); layer.addSublayer(shade)
  }
  override func layoutSubviews() {
    super.layoutSubviews()
    CATransaction.begin(); CATransaction.setDisableActions(true)
    layer.cornerRadius = min(bounds.width, bounds.height)/2
    metal.frame = bounds; shade.frame = bounds
    CATransaction.commit()
  }
}
