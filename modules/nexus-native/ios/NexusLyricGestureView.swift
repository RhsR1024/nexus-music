import ExpoModulesCore
import UIKit

// Fabric can coalesce a synthesized double tap into one JavaScript touch
// sequence. UIKit still receives both taps, so recognition lives here.
final class NexusLyricGestureView: ExpoView, UIGestureRecognizerDelegate {
  let onDoubleTap = EventDispatcher()
  let onLongPress = EventDispatcher()

  private lazy var doubleTap: UITapGestureRecognizer = {
    let recognizer = UITapGestureRecognizer(target: self, action: #selector(handleDoubleTap(_:)))
    recognizer.numberOfTapsRequired = 2
    recognizer.cancelsTouchesInView = false
    recognizer.delegate = self
    return recognizer
  }()

  private lazy var longPress: UILongPressGestureRecognizer = {
    let recognizer = UILongPressGestureRecognizer(target: self, action: #selector(handleLongPress(_:)))
    recognizer.minimumPressDuration = 0.55
    recognizer.cancelsTouchesInView = false
    recognizer.delegate = self
    return recognizer
  }()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    isUserInteractionEnabled = true
    isAccessibilityElement = true
    accessibilityTraits.insert(.button)
    addGestureRecognizer(doubleTap)
    addGestureRecognizer(longPress)
  }

  override func accessibilityActivate() -> Bool {
    onDoubleTap()
    return true
  }

  @objc private func handleDoubleTap(_ recognizer: UITapGestureRecognizer) {
    guard recognizer.state == .ended else { return }
    onDoubleTap()
  }

  @objc private func handleLongPress(_ recognizer: UILongPressGestureRecognizer) {
    guard recognizer.state == .began else { return }
    onLongPress()
  }

  override func accessibilityActivate() -> Bool {
    onDoubleTap()
    return true
  }

  func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
    true
  }
}
