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
