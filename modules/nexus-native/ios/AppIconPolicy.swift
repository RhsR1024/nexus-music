import Foundation

enum AppIconPolicy {
  static let alternateNames: Set<String> = [
    "NexusAltOrange",
    "NexusAltGreen",
    "NexusAltBlue",
    "NexusAltPurple",
    "NexusAltGraphite",
  ]

  static func allows(_ name: String?) -> Bool {
    guard let name else { return true }
    return alternateNames.contains(name)
  }

  /// Detects whether the guest app is executing inside a LiveContainer host process.
  /// SpringBoard validates alternate icons strictly against the signed host bundle's Info.plist,
  /// which does not declare guest app alternate icon sets.
  static func isLiveContainer(
    environment: [String: String],
    bundlePath: String,
    hasLCClass: Bool
  ) -> Bool {
    if hasLCClass { return true }
    if environment["LC_HOME_PATH"] != nil
      || environment["LC_GLOBAL_TWEAKS_FOLDER"] != nil
      || environment["LC_APP_BUNDLE_ID"] != nil
      || environment["LC_MAIN_BUNDLE_PATH"] != nil {
      return true
    }
    return bundlePath.lowercased().contains("/livecontainer")
  }
}
