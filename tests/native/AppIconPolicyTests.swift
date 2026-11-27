import Foundation

@main
struct AppIconPolicyTests {
  static func main() {
    assert(AppIconPolicy.allows(nil))
    assert(AppIconPolicy.allows("NexusAltOrange"))
    assert(AppIconPolicy.allows("NexusAltGraphite"))
    assert(!AppIconPolicy.allows("UnexpectedIcon"))
    assert(AppIconPolicy.alternateNames.count == 5)
    assert(!AppIconPolicy.isLiveContainer(environment: [:], bundlePath: "/var/containers/Bundle/Application/UUID/app.app", hasLCClass: false))
    assert(AppIconPolicy.isLiveContainer(environment: ["LC_HOME_PATH": "/var/mobile/Containers/Data/Application/LC"], bundlePath: "/var/containers/Bundle/Application/UUID/app.app", hasLCClass: false))
    assert(AppIconPolicy.isLiveContainer(environment: [:], bundlePath: "/var/mobile/Containers/Data/Application/LiveContainer/Applications/app.app", hasLCClass: false))
    assert(AppIconPolicy.isLiveContainer(environment: [:], bundlePath: "/var/containers/Bundle/Application/UUID/app.app", hasLCClass: true))
    print("App icon policy passed")
  }
}
