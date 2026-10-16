import Foundation
@main enum AudioProbeCLI {
  static func main() {
    guard CommandLine.arguments.count >= 2 else { exit(2) }
    let queue = DispatchQueue(label: "test.audio.probe"), done = DispatchSemaphore(value: 0)
    let probe = AudioURLProbe(queue: queue)
    queue.async {
      probe.start(CommandLine.arguments[1]) { result in
        let bytes = try! JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
        print(String(decoding: bytes, as: UTF8.self)); done.signal()
      }
      if CommandLine.arguments.count > 2 { queue.asyncAfter(deadline: .now() + 0.05) { probe.cancel() } }
    }
    if done.wait(timeout: .now() + 16) == .timedOut { exit(3) }
  }
}
