import ExpoModulesCore
import UIKit

// Fabric can coalesce a synthesized double tap into one JavaScript touch
// sequence. UIKit still receives both taps, so recognition lives here.
final class NexusLyricGestureView: ExpoView, UIGestureRecognizerDelegate {
  let onDoubleTap = EventDispatcher()
  let onLongPress = EventDispatcher()
  private var lastDoubleTap = 0.0

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
    emitDoubleTap()
    return true
  }

  @objc private func handleDoubleTap(_ recognizer: UITapGestureRecognizer) {
    guard recognizer.state == .ended else { return }
    emitDoubleTap()
  }

  @objc private func handleLongPress(_ recognizer: UILongPressGestureRecognizer) {
    guard recognizer.state == .began else { return }
    onLongPress()
  }

  override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
    if touches.first?.tapCount == 2 { emitDoubleTap() }
    super.touchesEnded(touches, with: event)
  }

  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    guard isUserInteractionEnabled, !isHidden, alpha > 0.01, self.point(inside: point, with: event) else { return nil }
    return self
  }

  private func emitDoubleTap() {
    let now = CACurrentMediaTime()
    guard now - lastDoubleTap > 0.15 else { return }
    lastDoubleTap = now
    onDoubleTap()
  }

  func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
    true
  }
}
