import Foundation

@main enum UtilitiesCLI {
  static func main() throws {
    let data = FileHandle.standardInput.readDataToEndOfFile()
    guard let operations = try JSONSerialization.jsonObject(with: data) as? [[String: Any]] else { exit(2) }
    let tracing = ProcessInfo.processInfo.environment["NEXUS_NATIVE_TEST_DIAGNOSTICS"] == "1"
    let results = operations.enumerated().map { index, input -> Any in
      let started = Date(); let operation = input["operation"] as? String ?? ""
      if tracing { FileHandle.standardError.write(Data("case \(index) \(operation) start\n".utf8)) }
      let result = ScriptUtilities.call(input["operation"] as? String ?? "", ScriptUtilities.json(input["input"] ?? [:]))
      if tracing { FileHandle.standardError.write(Data("case \(index) \(operation) \(Date().timeIntervalSince(started))s done\n".utf8)) }
      return (try? JSONSerialization.jsonObject(with: Data(result.utf8))) ?? NSNull()
    }
    print(ScriptUtilities.json(results))
  }
}
