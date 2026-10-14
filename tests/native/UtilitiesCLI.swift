import Foundation

@main enum UtilitiesCLI {
  static func main() throws {
    let data = FileHandle.standardInput.readDataToEndOfFile()
    guard let operations = try JSONSerialization.jsonObject(with: data) as? [[String: Any]] else { exit(2) }
    let results = operations.map { input -> Any in
      let result = ScriptUtilities.call(input["operation"] as? String ?? "", ScriptUtilities.json(input["input"] ?? [:]))
      return (try? JSONSerialization.jsonObject(with: Data(result.utf8))) ?? NSNull()
    }
    print(ScriptUtilities.json(results))
  }
}
