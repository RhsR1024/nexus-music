import ExpoModulesCore
import UIKit

private final class AmbientSceneLayer: CALayer {
  let scene: AmbientScene
  private let gradient = CAGradientLayer()
  private let fields = (0..<4).map { _ in CALayer() }
  init(scene: AmbientScene, colors: [String]) {
    self.scene = scene
    super.init()
    gradient.colors = colors.map { color -> CGColor in
      let rgb = UInt32(color.dropFirst(), radix: 16)!
      return UIColor(red: CGFloat((rgb >> 16) & 255) / 255,
        green: CGFloat((rgb >> 8) & 255) / 255, blue: CGFloat(rgb & 255) / 255, alpha: 1).cgColor
    }
    gradient.startPoint = .zero; gradient.endPoint = CGPoint(x: 1, y: 1)
    addSublayer(gradient)
    for (index, field) in fields.enumerated() {
      field.contents = scene.images[index % scene.images.count]
      field.contentsGravity = .resize
      addSublayer(field)
    }
  }
  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
  func render(size: CGSize, time: Double) {
    frame = CGRect(origin: .zero, size: size); gradient.frame = bounds
    let points = AmbientScene.gradientPoints(size: size)
    gradient.startPoint = points.start; gradient.endPoint = points.end
    for (index, field) in scene.fields.enumerated() {
      fields[index].frame = scene.rect(field, size: size, time: time)
      fields[index].opacity = Float(field.opacity * 0.42)
    }
  }
}

private final class AmbientFrameTarget: NSObject {
  weak var canvas: AmbientCanvas?
  init(_ canvas: AmbientCanvas) { self.canvas = canvas }
  @objc func tick(_ link: CADisplayLink) { canvas?.tick(link) }
}

private final class AmbientCanvas: UIView {
  var requestedMotion = false
  private var transition = AmbientTransition<AmbientSceneLayer>()
  private var displayLink: CADisplayLink?
  private var startedAt: CFTimeInterval?
  private var elapsed = 0.0
  private var previousTime = 0.0
  private var canMove: Bool {
    requestedMotion && window != nil && !UIAccessibility.isReduceMotionEnabled
      && UIApplication.shared.applicationState == .active
  }
  override init(frame: CGRect) {
    super.init(frame: frame)
    isOpaque = false; isUserInteractionEnabled = false
    let center = NotificationCenter.default
    for name in [UIApplication.didBecomeActiveNotification, UIApplication.willResignActiveNotification,
      UIApplication.didEnterBackgroundNotification, UIAccessibility.reduceMotionStatusDidChangeNotification] {
      center.addObserver(self, selector: #selector(environmentChanged), name: name, object: nil)
    }
  }
  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
  deinit { displayLink?.invalidate(); NotificationCenter.default.removeObserver(self) }
  override func didMoveToWindow() { super.didMoveToWindow(); syncMotion() }
  override func layoutSubviews() { super.layoutSubviews(); render(at: CACurrentMediaTime()) }
  @objc private func environmentChanged(_ note: Notification) {
    if note.name == UIApplication.willResignActiveNotification || note.name == UIApplication.didEnterBackgroundNotification { stop() }
    else { syncMotion() }
  }
  func install(colors: [String], identity: String) {
    CATransaction.begin(); CATransaction.setDisableActions(true)
    transition.previous?.removeFromSuperlayer()
    transition.settle()
    let next = AmbientScene(colors: colors, identity: identity).map { AmbientSceneLayer(scene: $0, colors: colors) }
    let animated = canMove && next != nil
    if !animated { transition.current?.removeFromSuperlayer() }
    previousTime = elapsed
    transition.replace(next, at: CACurrentMediaTime(), animated: animated)
    if let next { layer.addSublayer(next) }
    startedAt = nil; elapsed = 0
    CATransaction.commit()
    syncMotion()
  }
  func syncMotion() {
    guard canMove && transition.current != nil else { stop(); return }
    render(at: CACurrentMediaTime())
    guard displayLink == nil else { return }
    let link = CADisplayLink(target: AmbientFrameTarget(self), selector: #selector(AmbientFrameTarget.tick(_:)))
    link.preferredFramesPerSecond = 30
    displayLink = link; link.add(to: .main, forMode: .common)
  }
  private func stop() {
    displayLink?.invalidate(); displayLink = nil
    transition.previous?.removeFromSuperlayer(); transition.settle()
    startedAt = nil; elapsed = 0; render(at: CACurrentMediaTime())
  }
  func tick(_ link: CADisplayLink) {
    if startedAt == nil { startedAt = link.timestamp }
    elapsed = link.timestamp - (startedAt ?? link.timestamp)
    render(at: link.timestamp)
  }
  private func render(at time: Double) {
    guard bounds.width > 0, bounds.height > 0 else { return }
    let previous = transition.previous
    transition.advance(to: time)
    if transition.previous == nil { previous?.removeFromSuperlayer() }
    CATransaction.begin(); CATransaction.setDisableActions(true)
    // Opaque old beneath current alpha p gives complementary effective weights.
    transition.previous?.opacity = 1
    transition.previous?.render(size: bounds.size, time: previousTime)
    transition.current?.opacity = Float(transition.weight(at: time))
    transition.current?.render(size: bounds.size, time: elapsed)
    CATransaction.commit()
  }
}

final class NexusAmbientView: ExpoView {
  private let canvas = AmbientCanvas(frame: .zero)
  private var colors: [String] = [], appliedColors: [String] = []
  private var identity = "", appliedIdentity = ""
  private var pending = false, moving = false
  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true; addSubview(canvas)
  }
  func setColors(_ value: [String]) { colors = value }
  func setIdentity(_ value: String) { identity = value }
  func setPending(_ value: Bool) { pending = value }
  func setMoving(_ value: Bool) { moving = value }
  func applyProps() {
    canvas.requestedMotion = moving
    if !pending && (colors != appliedColors || identity != appliedIdentity) {
      appliedColors = colors; appliedIdentity = identity
      canvas.install(colors: colors, identity: identity)
    } else { canvas.syncMotion() }
  }
  override func layoutSubviews() { super.layoutSubviews(); canvas.frame = bounds }
}
