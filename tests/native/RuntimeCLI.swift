import Foundation

@main enum RuntimeCLI {
  static func main() throws {
    let args = CommandLine.arguments
    guard args.count == 4 else { exit(2) }
    let bootstrap = try String(contentsOfFile: args[1], encoding: .utf8)
    let script = try String(contentsOfFile: args[2], encoding: .utf8)
    let runtime = ScriptRuntime(id: "contract-fixture", revision: 1)
    let semaphore = DispatchSemaphore(value: 0)
    runtime.initialize(script: script, name: "Fixture", bootstrap: bootstrap) { result in
      switch result {
      case .failure(let error):
        print(ScriptUtilities.json(["error": error.rawValue])); semaphore.signal()
      case .success(let initializedJSON):
        if args[3] == "--init" {
          let object = (try? JSONSerialization.jsonObject(with: Data(initializedJSON.utf8))) as? [String: Any]
          let sources = object?["sources"] as? [String: Any] ?? [:]
          print(ScriptUtilities.json(["initialized": true, "platforms": ["wy", "tx", "kw", "kg", "mg"].filter { sources[$0] != nil }]))
          semaphore.signal(); return
        }
        runtime.request(id: "test", payloadJSON: args[3]) { result in
          switch result {
          case .success(let json): print(json)
          case .failure(let error): print(ScriptUtilities.json(["error": error.rawValue]))
          }
          semaphore.signal()
        }
      }
    }
    guard semaphore.wait(timeout: .now() + 25) == .success else { exit(3) }
    runtime.destroy()
  }
}
