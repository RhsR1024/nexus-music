import ExpoModulesCore
import UIKit
import UniformTypeIdentifiers

public final class NexusFilesModule: Module {
  private let files = LocalAudioFiles.shared
  private let queue = DispatchQueue(label: "nexus.local-files")
  private var folderPicker: LocalAudioFolderPicker?
  public func definition() -> ModuleDefinition {
    Name("NexusFiles")
    AsyncFunction("pickAudioFolder") { (promise: Promise) in
      guard self.folderPicker == nil else { promise.reject("FOLDER_PICKER_BUSY", "文件夹选择器尚未就绪"); return }
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
  init(completion: @escaping (Result<[String: String]?, Error>) -> Void) {
    self.completion = completion; super.init(); controller.delegate = self; controller.presentationController?.delegate = self
  }
  // The provider can tear the sheet down without any delegate callback; a
  // pending promise must not freeze the scan page, so resolve it as cancelled.
  func startWatchdog() {
    watchdog = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
      guard let self, self.completion != nil else { return }
      self.age += 0.5
      if self.presented {
        if self.controller.presentingViewController == nil, !self.controller.isBeingDismissed, self.controller.viewIfLoaded?.window == nil { self.finish(.success(nil)) }
      } else if self.age >= 20 {
        // A cold Files provider can take several seconds to actually show the
        // sheet; only conclude failure when it never appeared at all, and
        // dismiss the late orphan so it cannot block the next attempt.
        self.controller.dismiss(animated: false)
        self.finish(.failure(NSError(domain: "NexusAudioFolders", code: 2, userInfo: [NSLocalizedDescriptionKey: "文件夹选择器未能打开，请重试"])))
      }
    }
  }
  func markPresented() { presented = true }
  private func finish(_ result: Result<[String: String]?, Error>) {
    watchdog?.invalidate(); watchdog = nil
    let callback = completion; completion = nil; callback?(result)
  }
  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    guard let url = urls.first else { finish(.success(nil)); return }
    do { finish(.success(try LocalAudioFolders.shared.register(url))) } catch { finish(.failure(error)) }
  }
  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { finish(.success(nil)) }
  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) { finish(.success(nil)) }
}
