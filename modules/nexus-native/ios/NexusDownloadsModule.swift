import ExpoModulesCore
import UIKit

public final class NexusDownloadsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NexusDownloads")
    AsyncFunction("configure") { (maximum: Int64, promise: Promise) in
      OfflineBackgroundTransfers.shared.configure(maximum) { result in
        switch result { case .success: promise.resolve(); case .failure: promise.reject("DOWNLOAD_QUOTA", "下载容量设置未保存") }
      }
    }
    AsyncFunction("snapshot") { (name: String, promise: Promise) in
      OfflineBackgroundTransfers.shared.snapshot(name) { promise.resolve($0?.dictionary) }
    }
    AsyncFunction("begin") { (url: String, name: String, headers: [String: String], resume: Bool, promise: Promise) in
      OfflineBackgroundTransfers.shared.begin(url, name: name, headers: headers, resume: resume) { result in
        switch result { case .success(let state): promise.resolve(state.dictionary); case .failure: promise.reject("DOWNLOAD_START", "后台下载无法启动，请重试") }
      }
    }
    AsyncFunction("stop") { (name: String, pause: Bool, promise: Promise) in
      OfflineBackgroundTransfers.shared.stop(name, pause: pause) { result in
        switch result { case .success: promise.resolve(); case .failure: promise.reject("DOWNLOAD_STOP", "下载中止状态未保存，请重试") }
      }
    }
    AsyncFunction("discard") { (name: String, promise: Promise) in
      OfflineBackgroundTransfers.shared.discard(name) { result in
        switch result { case .success: promise.resolve(); case .failure: promise.reject("DOWNLOAD_REMOVE", "下载状态未移除，请重试") }
      }
    }
    AsyncFunction("acknowledge") { (name: String, promise: Promise) in
      OfflineBackgroundTransfers.shared.acknowledge(name) { result in
        switch result { case .success: promise.resolve(); case .failure: promise.reject("DOWNLOAD_ACK", "下载确认未保存，请重试") }
      }
    }
  }
}

public final class NexusDownloadsAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(_ application: UIApplication, handleEventsForBackgroundURLSession identifier: String, completionHandler: @escaping () -> Void) {
    guard identifier == OfflineBackgroundTransfers.identifier else { completionHandler(); return }
    OfflineBackgroundTransfers.shared.backgroundEvents(completionHandler)
  }
}
