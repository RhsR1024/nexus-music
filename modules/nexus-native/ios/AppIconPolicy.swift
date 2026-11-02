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
}
