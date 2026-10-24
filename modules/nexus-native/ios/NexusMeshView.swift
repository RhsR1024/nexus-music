import ExpoModulesCore
import UIKit
import SwiftUI

// Holds the mesh phase across motion pauses so the drift resumes from where
// it stopped instead of jumping to the wall clock.
final class MeshClock: ObservableObject {
  @Published var moving = false
  private var timeline = MeshTimeline()
  func setMoving(_ value: Bool) {
    timeline.setMoving(value, at: Date().timeIntervalSinceReferenceDate)
    if value != moving { moving = value }
  }
  func effectiveTime(_ date: Date) -> Double { timeline.time(at: date.timeIntervalSinceReferenceDate) }
}

@available(iOS 18.0, *)
private struct MeshContentView: View {
  let field: MeshField
  @ObservedObject var clock: MeshClock
  var body: some View {
    TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: !clock.moving)) { context in
      MeshGradient(
        width: 3,
        height: 3,
        points: field.points(at: clock.effectiveTime(context.date)).map { SIMD2<Float>(Float($0.x), Float($0.y)) },
        colors: field.colors.map { Color($0.cgColor) })
    }
  }
}

private final class MeshCanvas: UIView {
  var requestedMotion = false
  private var field: MeshField?
  // Type-erased: the concrete hosting controller is only iOS 18+, so the
  // stored reference cannot name MeshContentView outside an availability scope.
  private var hostController: UIViewController?
  private var hostView: UIView? { hostController?.view }
  private let fallback = CAGradientLayer()
  private let clock = MeshClock()
  private var canMove: Bool {
    requestedMotion && window != nil && !UIAccessibility.isReduceMotionEnabled
      && UIApplication.shared.applicationState == .active
  }
  override init(frame: CGRect) {
    super.init(frame: frame)
    isOpaque = false; isUserInteractionEnabled = false
    fallback.startPoint = CGPoint(x: 0.1, y: 0); fallback.endPoint = CGPoint(x: 0.9, y: 1)
    layer.addSublayer(fallback)
    let center = NotificationCenter.default
    for name in [UIApplication.didBecomeActiveNotification, UIApplication.willResignActiveNotification,
                 UIApplication.didEnterBackgroundNotification, UIAccessibility.reduceMotionStatusDidChangeNotification] {
      center.addObserver(self, selector: #selector(environmentChanged), name: name, object: nil)
    }
  }
  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
  deinit { NotificationCenter.default.removeObserver(self) }
  override func didMoveToWindow() { super.didMoveToWindow(); syncMotion() }
  @objc private func environmentChanged() { syncMotion() }
  override func layoutSubviews() {
    super.layoutSubviews()
    CATransaction.begin(); CATransaction.setDisableActions(true)
    fallback.frame = bounds
    CATransaction.commit()
    hostView?.frame = bounds
  }

  func install(colors: [String], identity: String, dark: Bool) {
    field = MeshField(colors: colors, identity: identity, dark: dark)
    if let field {
      // Below iOS 18 the same palette degrades to a static two-stop gradient
      // so the color wash survives without the mesh (decision 0081 fallback).
      fallback.colors = [field.colors[6].cgColor, field.colors[2].cgColor]
    } else { fallback.colors = nil }
    installHost()
    syncMotion()
  }

  private func installHost() {
    guard let field else { return }
    if #available(iOS 18.0, *) {
      if hostController == nil {
        let controller = UIHostingController(rootView: MeshContentView(field: field, clock: clock))
        controller.view.backgroundColor = .clear
        controller.view.isUserInteractionEnabled = false
        hostController = controller
        if let parent = parentViewController() {
          parent.addChild(controller); addSubview(controller.view); controller.didMove(toParent: parent)
        } else { addSubview(controller.view) }
        controller.view.frame = bounds
      } else if let hosting = hostController as? UIHostingController<MeshContentView> {
        hosting.rootView = MeshContentView(field: field, clock: clock)
      }
    }
  }

  private func parentViewController() -> UIViewController? {
    var responder: UIResponder? = self
    while let next = responder?.next {
      if let controller = next as? UIViewController { return controller }
      responder = next
    }
    return nil
  }

  func syncMotion() {
    clock.setMoving(canMove && field != nil)
    CATransaction.begin(); CATransaction.setDisableActions(true)
    var meshVisible = false
    if #available(iOS 18.0, *) { meshVisible = field != nil }
    hostView?.isHidden = !meshVisible
    // The animated mesh owns the canvas on iOS 18+; the static fallback layer
    // stays visible only where the mesh cannot run.
    fallback.isHidden = meshVisible
    CATransaction.commit()
  }
}

final class NexusMeshView: ExpoView {
  private let canvas = MeshCanvas(frame: .zero)
  private var colors: [String] = [], appliedColors: [String] = []
  private var identity = "", appliedIdentity = ""
  private var pending = false, moving = false
  private var dark = false, appliedDark = false
  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true; isUserInteractionEnabled = false
    addSubview(canvas)
  }
  func setColors(_ value: [String]) { colors = value }
  func setIdentity(_ value: String) { identity = value }
  func setPending(_ value: Bool) { pending = value }
  func setMoving(_ value: Bool) { moving = value }
  func setDark(_ value: Bool) { dark = value }
  func applyProps() {
    canvas.requestedMotion = moving
    if !pending && (colors != appliedColors || identity != appliedIdentity || dark != appliedDark) {
      appliedColors = colors; appliedIdentity = identity; appliedDark = dark
      canvas.install(colors: colors, identity: identity, dark: dark)
    } else if dark != appliedDark {
      // A pending new identity must not replace the displayed palette on a
      // theme change.
      appliedDark = dark
      canvas.install(colors: appliedColors, identity: appliedIdentity, dark: dark)
    } else { canvas.syncMotion() }
  }
  override func layoutSubviews() { super.layoutSubviews(); canvas.frame = bounds }
}
