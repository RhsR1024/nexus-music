import ExpoModulesCore
import UIKit
import UniformTypeIdentifiers

public final class NexusFilesModule: Module {
  private let files = LocalAudioFiles.shared
  private let queue = DispatchQueue(label: "nexus.local-files")
  private var folderPicker: LocalAudioFolderPicker?
  private var audioExporter: AudioFileExportSheet?
  public func definition() -> ModuleDefinition {
    Name("NexusFiles")
    AsyncFunction("downloadDestinationStatus") { () throws -> [String: String]? in try DownloadDestination.shared.status() }.runOnQueue(queue)
    AsyncFunction("forgetDownloadDestination") { (id: String) throws in try DownloadDestination.shared.forget(id) }.runOnQueue(queue)
    AsyncFunction("saveDownloadFiles") { (values: [String], id: String, job: String) throws -> [String] in try DownloadDestination.shared.save(values, expected: id, job: job) }.runOnQueue(queue)
    AsyncFunction("pickDownloadDestination") { (promise: Promise) in
      guard self.folderPicker == nil, self.audioExporter == nil else { promise.reject("FOLDER_PICKER_BUSY", "文件夹选择器尚未就绪"); return }
      func presentWhenSettled(_ attempt: Int) {
        guard var controller = self.appContext?.utilities?.currentViewController() else { promise.reject("FOLDER_PICKER_BUSY", "文件夹选择器尚未就绪"); return }
        while let presented = controller.presentedViewController { controller = presented }
        // The top utility controller may be a remote picker's child. Its
        // ancestor can still be dismissing even when the child reports idle.
        var ancestor: UIViewController? = controller
        var moving = controller.viewIfLoaded?.window == nil
        while let value = ancestor {
          moving = moving || value.isBeingDismissed || value.isBeingPresented || value.transitionCoordinator != nil || value is UIDocumentPickerViewController || value is UIActivityViewController
          ancestor = value.parent
        }
        if moving {
          if attempt >= 20 { promise.reject("FOLDER_PICKER_BUSY", "上一个选择器尚未关闭，请稍后重试"); return }
          DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { presentWhenSettled(attempt + 1) }; return
        }
        let picker = LocalAudioFolderPicker(register: { try DownloadDestination.shared.register($0) }) { [weak self] result in
          self?.folderPicker = nil
          switch result { case .success(let root): promise.resolve(root); case .failure: promise.reject("DESTINATION_ACCESS", "保存目录授权失败，请重新选择") }
        }
        self.folderPicker = picker; picker.startWatchdog(); controller.present(picker.controller, animated: true) { picker.markPresented() }
      }
      presentWhenSettled(0)
    }.runOnQueue(.main)
    AsyncFunction("pickAudioFolder") { (promise: Promise) in
      guard self.folderPicker == nil, self.audioExporter == nil else { promise.reject("FOLDER_PICKER_BUSY", "文件夹选择器尚未就绪"); return }
      // Re-adding right after a cancel can land inside the previous picker's
      // dismissal animation; presenting then fails silently and would leave
      // this promise pending forever, so wait for the hierarchy to settle.
      func presentWhenSettled(after attempts: Int) {
        guard var controller = self.appContext?.utilities?.currentViewController() else { promise.reject("FOLDER_PICKER_BUSY", "文件夹选择器尚未就绪"); return }
        while let presented = controller.presentedViewController { controller = presented }
        if controller.isBeingDismissed || controller.presentedViewController != nil {
          if attempts >= 20 { promise.reject("FOLDER_PICKER_BUSY", "上一个文件夹选择器尚未关闭，请稍后重试"); return }
          DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { presentWhenSettled(after: attempts + 1) }
          return
        }
        let picker = LocalAudioFolderPicker { [weak self] result in
          self?.folderPicker = nil
          switch result { case .success(let root): promise.resolve(root); case .failure: promise.reject("FOLDER_ACCESS_FAILED", "文件夹授权失败，请重新选择") }
        }
        self.folderPicker = picker
        picker.startWatchdog()
        controller.present(picker.controller, animated: true) { picker.markPresented() }
      }
      presentWhenSettled(after: 0)
    }.runOnQueue(.main)
    AsyncFunction("stageAudioExport") { (input: String, target: String) throws -> String in try AudioExportStaging.stageAudio(input, target: target) }.runOnQueue(queue)
    AsyncFunction("exportCoverJPEG") { (input: String, target: String, maximum: Int) throws -> String in try AudioExportStaging.jpeg(input, target: target, maxPixelSize: maximum) }.runOnQueue(queue)
    AsyncFunction("exportAudioFiles") { (values: [String], promise: Promise) in
      guard self.audioExporter == nil, self.folderPicker == nil else { promise.reject("AUDIO_EXPORT_BUSY", "文件选择器尚未关闭"); return }
      let urls: [URL]
      do { urls = try AudioExportStaging.files(values) } catch { promise.reject("AUDIO_EXPORT_FILES", "导出文件未就绪"); return }
      let picker = AudioFileExportSheet(urls: urls) { [weak self] completed in self?.audioExporter = nil; promise.resolve(completed) }
      self.audioExporter = picker
      func presentWhenSettled(_ attempt: Int) {
        guard var controller = self.appContext?.utilities?.currentViewController() else { picker.finish(false); return }
        while let presented = controller.presentedViewController { controller = presented }
        // The top utility controller may be a remote picker's child. Its
        // ancestor can still be dismissing even when the child reports idle.
        var ancestor: UIViewController? = controller
        var moving = controller.viewIfLoaded?.window == nil
        while let value = ancestor {
          moving = moving || value.isBeingDismissed || value.isBeingPresented || value.transitionCoordinator != nil || value is UIDocumentPickerViewController || value is UIActivityViewController
          ancestor = value.parent
        }
        if moving {
          if attempt >= 20 { picker.finish(false); return }
          DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { presentWhenSettled(attempt + 1) }; return
        }
        guard controller.viewIfLoaded?.window != nil else { picker.finish(false); return }
        if let popover = picker.controller.popoverPresentationController {
          popover.sourceView = controller.view
          popover.sourceRect = CGRect(x: controller.view.bounds.midX, y: controller.view.bounds.maxY, width: 1, height: 1)
          popover.permittedArrowDirections = []
        }
        picker.startWatchdog()
        controller.present(picker.controller, animated: true) { picker.markPresented() }
      }
      presentWhenSettled(0)
    }.runOnQueue(.main)
    AsyncFunction("retainAudioFolders") { (ids: [String]) throws in try LocalAudioFolders.shared.retainRoots(ids) }.runOnQueue(queue)
    AsyncFunction("scanAudioFolders") { (ids: [String], recursive: [String], blocked: [String], minimum: Double, promise: Promise) in
      Task { do { promise.resolve(try await LocalAudioFolders.shared.scan(ids, recursive: recursive, blocked: blocked, minimumSeconds: minimum)) } catch { promise.reject("FOLDER_SCAN_FAILED", error.localizedDescription) } }
    }.runOnQueue(queue)
    AsyncFunction("importVisual") { (uri: String) throws -> [String: Any] in try VisualAssets.shared.importImage(uri) }.runOnQueue(queue)
    AsyncFunction("resolveVisual") { (id: String) throws -> String in try VisualAssets.shared.resolve(id) }.runOnQueue(queue)
    AsyncFunction("reconcileVisuals") { (ids: [String]) throws in try VisualAssets.shared.reconcile(ids) }.runOnQueue(queue)
    AsyncFunction("visualPalette") { (uri: String) throws -> String in try VisualAssets.shared.palette(uri) }.runOnQueue(queue)
    AsyncFunction("visualFlowPalette") { (uri: String) throws -> [String] in try VisualAssets.shared.flowPalette(uri) }.runOnQueue(queue)
    AsyncFunction("importAudio") { (uri: String, name: String, promise: Promise) in
      Task {
        do { promise.resolve(try await self.files.importFile(uri, name: name)) }
        catch { promise.reject("LOCAL_IMPORT_FAILED", error.localizedDescription) }
      }
    }.runOnQueue(queue)
    AsyncFunction("resolveAudio") { (id: String, ext: String) throws -> String in try self.files.resolve(id, ext) }.runOnQueue(queue)
    AsyncFunction("localArtwork") { (id: String) -> String? in self.files.artwork(id) }.runOnQueue(queue)
    AsyncFunction("beginRemoval") { (id: String, ext: String) throws -> String in try self.files.beginRemoval(id, ext) }.runOnQueue(queue)
    AsyncFunction("finishRemoval") { (token: String, restore: Bool) throws in try self.files.finishRemoval(token, restore: restore) }.runOnQueue(queue)
    AsyncFunction("reconcile") { (files: [[String: String]]) throws in try self.files.reconcile(files) }.runOnQueue(queue)
    AsyncFunction("removeAudio") { (id: String, ext: String) throws in try self.files.remove(id, ext) }.runOnQueue(queue)
  }
}


private final class LocalAudioFolderPicker: NSObject, UIDocumentPickerDelegate, UIAdaptivePresentationControllerDelegate {
  let controller = UIDocumentPickerViewController(forOpeningContentTypes: [.folder], asCopy: false)
  private var completion: ((Result<[String: String]?, Error>) -> Void)?
  private var watchdog: Timer?
  private var presented = false
  private var age: TimeInterval = 0
  private let register: (URL) throws -> [String: String]
  init(register: @escaping (URL) throws -> [String: String] = { try LocalAudioFolders.shared.register($0) }, completion: @escaping (Result<[String: String]?, Error>) -> Void) {
    self.register = register; self.completion = completion; super.init(); controller.delegate = self; controller.presentationController?.delegate = self
  }
  // The provider can tear the sheet down without any delegate callback; a
  // pending promise must not freeze the scan page, so resolve it as cancelled.
  func startWatchdog() {
    watchdog = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
      guard let self, self.completion != nil else { return }
      self.age += 0.5
      if self.presented {
        if self.controller.presentingViewController == nil, !self.controller.isBeingDismissed, self.controller.transitionCoordinator == nil, self.controller.viewIfLoaded?.window == nil { self.finish(.success(nil)) }
      } else if self.age >= 20 {
        // A cold Files provider can take several seconds to actually show the
        // sheet; only conclude failure when it never appeared at all, and
        // dismiss the late orphan so it cannot block the next attempt.
        self.controller.dismiss(animated: false)
        self.finish(.failure(NSError(domain: "NexusAudioFolders", code: 2, userInfo: [NSLocalizedDescriptionKey: "文件夹选择器未能打开，请重试"])))
      }
    }
  }
  func markPresented() { presented = true; controller.presentationController?.delegate = self }
  private func finish(_ result: Result<[String: String]?, Error>) {
    watchdog?.invalidate(); watchdog = nil
    let callback = completion; completion = nil; callback?(result)
  }
  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    guard let url = urls.first else { finish(.success(nil)); return }
    do { finish(.success(try register(url))) } catch { finish(.failure(error)) }
  }
  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { finish(.success(nil)) }
  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) { finish(.success(nil)) }
}


private final class AudioFileExportSheet: NSObject, UIAdaptivePresentationControllerDelegate {
  let controller: UIActivityViewController
  private var completion: ((Bool) -> Void)?
  private var watchdog: Timer?
  private var presented = false
  private var ticks = 0
  init(urls: [URL], completion: @escaping (Bool) -> Void) {
    controller = UIActivityViewController(activityItems: urls, applicationActivities: nil)
    self.completion = completion; super.init()
    controller.completionWithItemsHandler = { [weak self] _, completed, _, _ in self?.finish(completed) }
  }
  func markPresented() { presented = true; controller.presentationController?.delegate = self }
  func startWatchdog() {
    watchdog = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
      guard let self, self.completion != nil else { return }; self.ticks += 1
      if self.presented { if self.controller.presentingViewController == nil && !self.controller.isBeingDismissed && self.controller.viewIfLoaded?.window == nil { self.finish(false) } }
      else if self.ticks >= 40 { self.controller.dismiss(animated: false); self.finish(false) }
    }
  }
  func finish(_ completed: Bool) { watchdog?.invalidate(); watchdog = nil; let callback = completion; completion = nil; callback?(completed) }
  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) { finish(false) }
}
