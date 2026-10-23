import ExpoModulesCore
import UIKit

// A static system material. Intensity is controlled by the RN surface tint,
// rather than keeping a UIViewPropertyAnimator paused for the view's lifetime.
final class NexusMaterialView: ExpoView {
  private let material = UIVisualEffectView(effect: UIBlurEffect(style: .systemMaterialLight))

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    material.isUserInteractionEnabled = false
    addSubview(material)
    clipsToBounds = true
  }

  func setDark(_ dark: Bool) {
    material.effect = UIBlurEffect(style: dark ? .systemMaterialDark : .systemMaterialLight)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    material.frame = bounds
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
