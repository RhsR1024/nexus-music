import ExpoModulesCore
import UIKit

// A weak target prevents a retained display link from owning the view.
private final class AmbientFrameTarget: NSObject {
  weak var canvas: AmbientCanvas?
  init(_ canvas: AmbientCanvas) { self.canvas = canvas }
  @objc func tick(_ link: CADisplayLink) { canvas?.tick(link) }
}

private final class AmbientCanvas: UIView {
  var scene: AmbientScene? { didSet {
    startedAt = nil; elapsed = 0
    CATransaction.begin(); CATransaction.setDisableActions(true)
    for (index, fieldLayer) in fieldLayers.enumerated() {
      fieldLayer.contents = scene.map { $0.images[index % $0.images.count] }
      fieldLayer.isHidden = scene == nil
    }
    CATransaction.commit()
    renderFields()
  } }
  var requestedMotion = false { didSet { syncMotion() } }
  private let fieldLayers = (0..<4).map { _ in CALayer() }
  private var displayLink: CADisplayLink?
  private var startedAt: CFTimeInterval?
  private var elapsed: Double = 0

  override init(frame: CGRect) {
    super.init(frame: frame)
    isOpaque = false
    isUserInteractionEnabled = false
    for fieldLayer in fieldLayers {
      fieldLayer.contentsGravity = .resize
      fieldLayer.isHidden = true
      layer.addSublayer(fieldLayer)
    }
    let center = NotificationCenter.default
    for name in [UIApplication.didBecomeActiveNotification, UIApplication.willResignActiveNotification,
      UIApplication.didEnterBackgroundNotification, UIAccessibility.reduceMotionStatusDidChangeNotification] {
      center.addObserver(self, selector: #selector(environmentChanged), name: name, object: nil)
    }
  }
  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
  deinit { displayLink?.invalidate(); NotificationCenter.default.removeObserver(self) }
  override func didMoveToWindow() { super.didMoveToWindow(); syncMotion() }
  override func layoutSubviews() { super.layoutSubviews(); renderFields() }
  @objc private func environmentChanged(_ note: Notification) {
    // willResignActive arrives while applicationState can still be active.
    if note.name == UIApplication.willResignActiveNotification || note.name == UIApplication.didEnterBackgroundNotification { stop() }
    else { syncMotion() }
  }
  private func syncMotion() {
    let running = requestedMotion && window != nil && scene != nil && !UIAccessibility.isReduceMotionEnabled
      && UIApplication.shared.applicationState == .active
    guard running else { stop(); return }
    guard displayLink == nil else { return }
    let link = CADisplayLink(target: AmbientFrameTarget(self), selector: #selector(AmbientFrameTarget.tick(_:)))
    link.preferredFramesPerSecond = 30
    displayLink = link
    link.add(to: .main, forMode: .common)
  }
  private func stop() {
    displayLink?.invalidate(); displayLink = nil
    startedAt = nil; elapsed = 0; renderFields()
  }
  func tick(_ link: CADisplayLink) {
    if startedAt == nil { startedAt = link.timestamp }
    elapsed = link.timestamp - (startedAt ?? link.timestamp)
    renderFields()
  }
  private func renderFields() {
    guard let scene, bounds.width > 0, bounds.height > 0 else { return }
    CATransaction.begin(); CATransaction.setDisableActions(true)
    for (index, field) in scene.fields.enumerated() {
      fieldLayers[index].frame = scene.rect(field, size: bounds.size, time: elapsed)
      fieldLayers[index].opacity = Float(field.opacity * 0.42)
    }
    CATransaction.commit()
  }
  func sceneUpdated() { syncMotion() }
}

final class NexusAmbientView: ExpoView {
  private let canvas = AmbientCanvas(frame: .zero)
  private var colors: [String] = []
  private var identity = ""
  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    addSubview(canvas)
  }
  func setColors(_ value: [String]) { if value != colors { colors = value; rebuild() } }
  func setIdentity(_ value: String) { if value != identity { identity = value; rebuild() } }
  func setMoving(_ moving: Bool) { canvas.requestedMotion = moving }
  private func rebuild() { canvas.scene = AmbientScene(colors: colors, identity: identity); canvas.sceneUpdated() }
  override func layoutSubviews() { super.layoutSubviews(); canvas.frame = bounds }
}
