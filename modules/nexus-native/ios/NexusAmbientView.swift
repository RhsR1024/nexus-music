import ExpoModulesCore
import UIKit
#if targetEnvironment(simulator)
import CryptoKit
#endif

private final class AmbientSceneLayer: CALayer {
  let scene: AmbientScene
  private let gradient = CAGradientLayer()
  private let fieldContainer = CALayer()
  private let fields = (0..<4).map { _ in CALayer() }
  init(scene: AmbientScene) {
    self.scene = scene
    super.init()
    gradient.colors = scene.base.map(\.cgColor)
    gradient.startPoint = .zero; gradient.endPoint = CGPoint(x: 1, y: 1)
    addSublayer(gradient)
    addSublayer(fieldContainer)
    for (index, field) in fields.enumerated() {
      field.contents = scene.images[index % scene.images.count]
      field.contentsGravity = .resize
      fieldContainer.addSublayer(field)
    }
  }
  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
  func render(size: CGSize, time: Double) {
    frame = CGRect(origin: .zero, size: size); gradient.frame = bounds
    let angle = scene.angle(at: time)
    let points = AmbientScene.gradientPoints(size: size, angle: angle)
    gradient.startPoint = points.start; gradient.endPoint = points.end
    fieldContainer.bounds = bounds
    fieldContainer.position = CGPoint(x: size.width / 2, y: size.height / 2)
    fieldContainer.setAffineTransform(CGAffineTransform(rotationAngle: angle).scaledBy(x: 1.12, y: 1.12))
    for (index, field) in scene.fields.enumerated() {
      fields[index].frame = scene.rect(field, size: size, time: time)
      fields[index].opacity = Float(field.opacity)
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
  private let overlay = CAGradientLayer()
  private var transition = AmbientTransition<AmbientSceneLayer>()
  private var displayLink: CADisplayLink?
  private var timeline = MotionTimeline()
  private var previousTime = 0.0
#if targetEnvironment(simulator)
  func observation() -> [String: Any] {
    ["installedScene": transition.current != nil,
     "sceneColorCount": transition.current?.scene.palette.count ?? 0,
     "timelineTime": timeline.time(at: CACurrentMediaTime()),
     "moving": displayLink != nil]
  }
#endif
  private var canMove: Bool {
    MotionPolicy.allowsMotion(
      requested: requestedMotion,
      attached: window != nil,
      appActive: UIApplication.shared.applicationState == .active,
      reduceMotion: UIAccessibility.isReduceMotionEnabled,
      lowPowerMode: ProcessInfo.processInfo.isLowPowerModeEnabled)
  }
  override init(frame: CGRect) {
    super.init(frame: frame)
    isOpaque = false; isUserInteractionEnabled = false
    overlay.startPoint = CGPoint(x: 0.5, y: 0); overlay.endPoint = CGPoint(x: 0.5, y: 1)
    overlay.isHidden = true; layer.addSublayer(overlay)
    let center = NotificationCenter.default
    for name in [UIApplication.didBecomeActiveNotification, UIApplication.willResignActiveNotification,
      UIApplication.didEnterBackgroundNotification, UIAccessibility.reduceMotionStatusDidChangeNotification,
      Notification.Name.NSProcessInfoPowerStateDidChange] {
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
  func install(colors: [String], identity: String, dark: Bool) {
    let now = CACurrentMediaTime()
    timeline.setMoving(false, at: now)
    CATransaction.begin(); CATransaction.setDisableActions(true)
    transition.previous?.removeFromSuperlayer()
    transition.settle()
    let next = AmbientScene(colors: colors, identity: identity, dark: dark).map { AmbientSceneLayer(scene: $0) }
    let animated = canMove && next != nil
    if !animated { transition.current?.removeFromSuperlayer() }
    previousTime = timeline.time(at: now)
    transition.replace(next, at: now, animated: animated)
    if let next { layer.insertSublayer(next, below: overlay) }
    overlay.colors = AmbientScene.overlay(dark: dark)
    overlay.isHidden = next == nil
    timeline = MotionTimeline()
    CATransaction.commit()
    syncMotion()
  }
  func syncMotion() {
    let now = CACurrentMediaTime()
    guard canMove && transition.current != nil else { stop(at: now); return }
    render(at: now)
    timeline.setMoving(true, at: now)
    guard displayLink == nil else { return }
    let link = CADisplayLink(target: AmbientFrameTarget(self), selector: #selector(AmbientFrameTarget.tick(_:)))
    link.preferredFramesPerSecond = 30
    displayLink = link; link.add(to: .main, forMode: .common)
  }
  private func stop(at time: CFTimeInterval = CACurrentMediaTime()) {
    timeline.setMoving(false, at: time)
    displayLink?.invalidate(); displayLink = nil
    transition.previous?.removeFromSuperlayer(); transition.settle()
    render(at: time)
  }
  func tick(_ link: CADisplayLink) { render(at: link.timestamp) }
  private func render(at time: Double) {
    guard bounds.width > 0, bounds.height > 0 else { return }
    let previous = transition.previous
    transition.advance(to: time)
    if transition.previous == nil { previous?.removeFromSuperlayer() }
    CATransaction.begin(); CATransaction.setDisableActions(true)
    overlay.frame = bounds
    // Opaque old beneath current alpha p gives complementary effective weights.
    transition.previous?.opacity = 1
    transition.previous?.render(size: bounds.size, time: previousTime)
    transition.current?.opacity = Float(transition.weight(at: time))
    transition.current?.render(size: bounds.size, time: timeline.time(at: time))
    CATransaction.commit()
  }
}

final class NexusAmbientView: ExpoView {
#if targetEnvironment(simulator)
  private static let observedViews = NSHashTable<NexusAmbientView>.weakObjects()
  private let observationID = UUID().uuidString
  static func observationSnapshot() -> [[String: Any]] {
    guard ProcessInfo.processInfo.environment["NEXUS_UI_THEME_OBSERVATION"] == "1" else { return [] }
    func digest(_ value: String) -> String {
      SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }
    return observedViews.allObjects.map { view in
      var visible = false
      var resultFrame = CGRect.zero
      if let window = view.window {
        var windowRect = view.convert(view.bounds, to: window)
        var ancestor: UIView? = view.superview
        while let current = ancestor, current !== window {
          if current.isHidden || current.alpha < 0.01 { windowRect = .zero; break }
          if current.clipsToBounds { windowRect = windowRect.intersection(current.convert(current.bounds, to: window)) }
          ancestor = current.superview
        }
        visible = !windowRect.isEmpty && windowRect.intersects(window.bounds)
        resultFrame = windowRect.intersection(window.bounds)
      }
      var result = view.canvas.observation()
      result["instanceID"] = view.observationID
      result["visible"] = visible
      result["visibleX"] = resultFrame.origin.x; result["visibleY"] = resultFrame.origin.y
      result["visibleWidth"] = resultFrame.width; result["visibleHeight"] = resultFrame.height
      result["width"] = view.bounds.width; result["height"] = view.bounds.height
      result["identityDigest"] = digest("identity-v1|" + view.appliedIdentity)
      result["palette"] = view.appliedColors.map { $0.uppercased() }
      result["dark"] = view.appliedDark; result["pending"] = view.pending
      if visible && view.bounds.width <= 1024 && view.bounds.height <= 2048 {
        // Capture the actual installed background layers, without foreground
        // controls. Do not advance or restore the scene's animation clock.
        let format = UIGraphicsImageRendererFormat(); format.scale = 1
        let image = UIGraphicsImageRenderer(size: view.canvas.bounds.size, format: format).image { context in
          view.canvas.layer.render(in: context.cgContext)
        }
        result["renderedPrimaryHueCounts"] = Self.primaryHueCounts(image)
        result["renderedHueSamples"] = 86 * 186
        result["png"] = image.pngData()?.base64EncodedString()
      }
      return result
    }
  }
  private static func primaryHueCounts(_ image: UIImage) -> [Int] {
    let width = 86, height = 186
    guard let source = image.cgImage else { return [] }
    var bytes = [UInt8](repeating: 0, count: width * height * 4)
    let decoded = bytes.withUnsafeMutableBytes { memory -> Bool in
      guard let space = CGColorSpace(name: CGColorSpace.sRGB),
            let context = CGContext(
              data: memory.baseAddress,
              width: width,
              height: height,
              bitsPerComponent: 8,
              bytesPerRow: width * 4,
              space: space,
              bitmapInfo: CGBitmapInfo.byteOrder32Big.rawValue |
                CGImageAlphaInfo.premultipliedLast.rawValue
            ) else { return false }
      context.draw(source, in: CGRect(x: 0, y: 0, width: width, height: height))
      return true
    }
    guard decoded else { return [] }
    var counts = [0, 0, 0]
    for offset in stride(from: 0, to: bytes.count, by: 4) {
      let channels = [
        Int(bytes[offset]),
        Int(bytes[offset + 1]),
        Int(bytes[offset + 2]),
      ]
      // The native scene intentionally blends its soft-light fields, so a
      // valid green contribution can appear inside a red-dominant olive area.
      // Count each channel that rises above the pixel's neutral floor instead
      // of requiring one pure channel to dominate every other channel.
      let neutral = channels.min() ?? 0
      for channel in 0..<3 where channels[channel] - neutral >= 6 {
        counts[channel] += 1
      }
    }
    return counts
  }
#endif
  private let canvas = AmbientCanvas(frame: .zero)
  private var colors: [String] = [], appliedColors: [String] = []
  private var identity = "", appliedIdentity = ""
  private var pending = false, moving = false
  private var dark = false, appliedDark = false
  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true; addSubview(canvas)
#if targetEnvironment(simulator)
    if ProcessInfo.processInfo.environment["NEXUS_UI_THEME_OBSERVATION"] == "1" { Self.observedViews.add(self) }
#endif
  }
  func setColors(_ value: [String]) { colors = value }
  func setIdentity(_ value: String) { identity = value }
  func setPending(_ value: Bool) { pending = value }
  func setMoving(_ value: Bool) { moving = value }
  func setDark(_ value: Bool) { dark = value }
  func applyProps() {
    canvas.requestedMotion = moving
    if !pending && (colors != appliedColors || identity != appliedIdentity || dark != appliedDark) {
      appliedColors = colors; appliedIdentity = identity
      appliedDark = dark
      canvas.install(colors: colors, identity: identity, dark: dark)
    } else if dark != appliedDark {
      // A pending new URI must not replace the displayed palette on a theme change.
      appliedDark = dark
      canvas.install(colors: appliedColors, identity: appliedIdentity, dark: dark)
    } else { canvas.syncMotion() }
  }
  override func layoutSubviews() { super.layoutSubviews(); canvas.frame = bounds }
}
