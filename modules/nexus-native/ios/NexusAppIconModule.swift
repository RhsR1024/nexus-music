import ExpoModulesCore
import UIKit

public final class NexusAppIconModule: Module {
  private var changing = false

  private var isLiveContainer: Bool {
    AppIconPolicy.isLiveContainer(
      environment: ProcessInfo.processInfo.environment,
      bundlePath: Bundle.main.bundlePath,
      hasLCClass: NSClassFromString("LCSharedUtils") != nil
    )
  }

  public func definition() -> ModuleDefinition {
    Name("NexusAppIcon")

    AsyncFunction("snapshot") {
      var result: [String: Any] = [
        "supported": UIApplication.shared.supportsAlternateIcons,
        "liveContainer": self.isLiveContainer,
      ]
      if let current = UIApplication.shared.alternateIconName {
        result["current"] = current
      }
      return result
    }.runOnQueue(.main)

    AsyncFunction("setIcon") { (name: String?, promise: Promise) in
      guard AppIconPolicy.allows(name) else {
        promise.reject("APP_ICON_NAME", "不支持的应用图标")
        return
      }
      guard UIApplication.shared.supportsAlternateIcons else {
        promise.reject("APP_ICON_UNSUPPORTED", "此系统版本不支持更换应用图标")
        return
      }
      guard !self.changing else {
        promise.reject("APP_ICON_BUSY", "正在切换应用图标，请稍候")
        return
      }
      if UIApplication.shared.alternateIconName == name {
        if let name {
          promise.resolve(name)
        } else {
          promise.resolve()
        }
        return
      }

      self.changing = true
      let inLiveContainer = self.isLiveContainer
      var attempt = 0
      func applyIcon() {
        UIApplication.shared.setAlternateIconName(name) { error in
          DispatchQueue.main.async {
            if let error {
              let systemError = error as NSError
              NSLog("NexusAppIcon setIcon failed domain=%@ code=%ld liveContainer=%d description=%@", systemError.domain, systemError.code, inLiveContainer ? 1 : 0, systemError.localizedDescription)
              let transientServiceError = !inLiveContainer
                && systemError.domain == NSPOSIXErrorDomain
                && (systemError.code == Int(EIO) || systemError.code == Int(EAGAIN))
              // The icon service can briefly report I/O or EAGAIN while its
              // upcall/alert host is settling. Retry these two POSIX results on
              // native installs; LiveContainer host rejections fail immediately.
              if transientServiceError, attempt < 3 {
                attempt += 1
                DispatchQueue.main.asyncAfter(deadline: .now() + Double(attempt) * 0.75, execute: applyIcon)
                return
              }
              self.changing = false
              if inLiveContainer {
                promise.reject("APP_ICON_LIVECONTAINER", "当前运行在 LiveContainer 容器中，iOS 桌面图标由宿主管理，不支持应用内直接修改。请在 LiveContainer 中长按「音枢」→「设置」更换自定义图标，或独立侧载安装后即可在此切换。")
                return
              }
              promise.reject("APP_ICON_FAILED", "系统未能切换应用图标（\(systemError.domain) \(systemError.code)），请重试。")
              return
            }
            self.changing = false
            // A successful completion means the system accepted this exact
            // request. `alternateIconName` can briefly retain the previous value
            // in the same process (observed while restoring the primary icon on
            // the iOS simulator), so do not turn that read-back lag into a stale
            // selected state. A later snapshot still reads the system value.
            if let name {
              promise.resolve(name)
            } else {
              promise.resolve()
            }
          }
        }
      }
      applyIcon()
    }.runOnQueue(.main)
  }
}
