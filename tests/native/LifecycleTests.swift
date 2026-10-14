import Foundation

@main enum LifecycleTests {
  static func main() throws {
    let bootstrap = try String(contentsOfFile: "modules/nexus-native/ios/bootstrap.js", encoding: .utf8)
    let script = """
    let counter = 0;
    lx.on('request', async payload => {
      if (payload.delay) await new Promise(resolve => setTimeout(resolve, 100));
      return ++counter;
    });
    lx.send('inited', {sources:{}});
    """
    func wait(_ start: (@escaping ScriptRuntime.Completion) -> Void) -> Result<String, ScriptRuntimeError> {
      let done = DispatchSemaphore(value: 0)
      var result: Result<String, ScriptRuntimeError>?
      start { result = $0; done.signal() }
      precondition(done.wait(timeout: .now() + 5) == .success, "Runtime callback deadline")
      return result!
    }
    func value(_ result: Result<String, ScriptRuntimeError>) -> String { try! result.get() }
    func failure(_ result: Result<String, ScriptRuntimeError>, _ expected: ScriptRuntimeError) {
      if case .failure(let error) = result { precondition(error == expected) } else { fatalError("Expected failure") }
    }
    let a = ScriptRuntime(id: "a", revision: 1), b = ScriptRuntime(id: "b", revision: 1)
    _ = value(wait { a.initialize(script: script, name: "a", bootstrap: bootstrap, completion: $0) })
    _ = value(wait { b.initialize(script: script, name: "b", bootstrap: bootstrap, completion: $0) })
    precondition(value(wait { a.request(id: "1", payloadJSON: "{}", completion: $0) }) == "1")
    precondition(value(wait { a.request(id: "2", payloadJSON: "{}", completion: $0) }) == "2")
    precondition(value(wait { b.request(id: "1", payloadJSON: "{}", completion: $0) }) == "1")
    failure(wait { completion in
      a.request(id: "cancel", payloadJSON: "{\"delay\":true}", completion: completion)
      a.cancel(id: "cancel")
    }, .cancelled)
    Thread.sleep(forTimeInterval: 0.15)
    // The cancelled Promise may finish, but its result cannot reach the next
    // request; the source remains usable without resetting its script state.
    precondition(value(wait { a.request(id: "after-cancel", payloadJSON: "{}", completion: $0) }) == "4")
    failure(wait { completion in
      a.request(id: "destroy", payloadJSON: "{\"delay\":true}", completion: completion)
      a.destroy()
    }, .destroyed)
    precondition(value(wait { b.request(id: "2", payloadJSON: "{}", completion: $0) }) == "2")
    failure(wait { a.request(id: "late", payloadJSON: "{}", completion: $0) }, .notReady)
    let c = ScriptRuntime(id: "c", revision: 1)
    failure(wait { completion in
      c.initialize(script: "setTimeout(()=>lx.send('inited',{sources:{}}),100)", name: "c", bootstrap: bootstrap, completion: completion)
      c.destroy()
    }, .destroyed)
    b.destroy()
    print("Native lifecycle checks passed: independent contexts/cancel/destroy/late initialization")
  }
}
