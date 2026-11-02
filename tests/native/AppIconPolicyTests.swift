import Foundation

@main
struct AppIconPolicyTests {
  static func main() {
    assert(AppIconPolicy.allows(nil))
    assert(AppIconPolicy.allows("NexusAltOrange"))
    assert(AppIconPolicy.allows("NexusAltGraphite"))
    assert(!AppIconPolicy.allows("UnexpectedIcon"))
    assert(AppIconPolicy.alternateNames.count == 5)
    print("App icon policy passed")
  }
}
