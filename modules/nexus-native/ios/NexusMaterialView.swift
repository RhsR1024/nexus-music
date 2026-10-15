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
