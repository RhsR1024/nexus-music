import Foundation
import CryptoKit

struct OfflineTransferRecord: Codable {
  var fileName: String
  var generation: String
  var fingerprint: String
  var state: String
  var received: Int64 = 0
  var expected: Int64 = 0
  var error: String?
  var intent: String?
  var dictionary: [String: Any] {
    var value: [String: Any] = ["fileName": fileName, "state": state, "received": received, "expected": expected]
    if let error { value["error"] = error }
    return value
  }
}

// Only task identity/state is journaled here. URLs and request headers stay in
// URLSession; opaque resume data is protected, excluded from backups and exports.
final class OfflineBackgroundTransfers: NSObject, URLSessionDownloadDelegate {
  static let identifier = (Bundle.main.bundleIdentifier ?? "com.nexusmusic.app") + ".offline-downloads.v1"
  static let shared = OfflineBackgroundTransfers()
  private let queue = DispatchQueue(label: "nexus.offline-transfers")
  private let delegateQueue = OperationQueue()
  private let directory: URL, metadata: URL
  private let configuration: URLSessionConfiguration
  private var session: URLSession!
  private var records: [String: OfflineTransferRecord] = [:]
  private var tasks: [String: URLSessionDownloadTask] = [:]
  private var admitted = Set<Int>()
  private var concurrency = 1
  private var storageError = false
  private var maximumTotalBytes: Int64 = 2 * 1024 * 1024 * 1024
  private var payloadBytes: Int64 = 0
  private var ready = false, pending: [() -> Void] = []
  private var completionHandler: (() -> Void)?
  private var lastWrite: TimeInterval = 0
  private let maximumBytes: Int64 = 2 * 1024 * 1024 * 1024

  init(directory: URL? = nil, metadata: URL? = nil, configuration: URLSessionConfiguration? = nil) {
    let manager = FileManager.default
    self.directory = directory ?? manager.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("offline-audio", isDirectory: true)
    self.metadata = metadata ?? manager.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("offline-transfers", isDirectory: true)
    self.configuration = configuration ?? URLSessionConfiguration.background(withIdentifier: Self.identifier)
    super.init()
    delegateQueue.maxConcurrentOperationCount = 1; delegateQueue.underlyingQueue = queue
    self.configuration.httpShouldSetCookies = false; self.configuration.httpCookieStorage = nil
    self.configuration.urlCredentialStorage = nil; self.configuration.urlCache = nil
    self.configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
    self.configuration.isDiscretionary = false
    #if os(iOS)
    self.configuration.sessionSendsLaunchEvents = true
    #endif
  }

  private func loadStorage() throws {
    let manager = FileManager.default
      try manager.createDirectory(at: self.directory, withIntermediateDirectories: true)
      try manager.createDirectory(at: self.metadata, withIntermediateDirectories: true)
      for var root in [self.directory, self.metadata] { var values = URLResourceValues(); values.isExcludedFromBackup = true; try root.setResourceValues(values) }
      let journal = self.metadata.appendingPathComponent("journal.json")
      if manager.fileExists(atPath: journal.path) {
        let data = try Data(contentsOf: journal)
        do {
          let decoded = try JSONDecoder().decode([String: OfflineTransferRecord].self, from: data)
          guard decoded.count <= 1000, decoded.allSatisfy({ Self.valid($0.key) && $0.value.fileName == $0.key && UUID(uuidString: $0.value.generation) != nil }) else { throw Self.failure("journal") }
          records = decoded
        } catch { try manager.moveItem(at: journal, to: self.metadata.appendingPathComponent("journal-invalid-\(UUID().uuidString).json")) }
      }
    let quotaFile = metadata.appendingPathComponent("quota.json")
    if manager.fileExists(atPath: quotaFile.path), let value = try? JSONDecoder().decode(Int64.self, from: Data(contentsOf: quotaFile)), value > 0, value <= 8 * 1024 * 1024 * 1024 { maximumTotalBytes = value }
    let concurrencyFile = metadata.appendingPathComponent("concurrency.json")
    if let data = try? Data(contentsOf: concurrencyFile), let value = try? JSONDecoder().decode(Int.self, from: data), (1...3).contains(value) { concurrency = value }
    payloadBytes = try usedPayloadBytes()
  }

  private func connect() {
    guard session == nil else { return }
    do { try loadStorage(); storageError = false } catch { storageError = true; ready = true; return }
    ready = false
    session = URLSession(configuration: self.configuration, delegate: self, delegateQueue: delegateQueue)
    session.getAllTasks { existing in self.queue.async {
      for case let task as URLSessionDownloadTask in existing {
        guard let pair = self.identity(task), let record = self.records[pair.0], record.generation == pair.1 else { task.cancel(); continue }
        self.tasks[pair.0] = task
        if record.intent == "cancel" { task.cancel() }
        else if record.intent == "pause" { self.pauseTask(task, name: pair.0, generation: pair.1) }
        else if task.state == .running || task.state == .canceling { self.admitted.insert(task.taskIdentifier) }
      }
      for (name, var record) in self.records where ["running", "pausing", "cancelling"].contains(record.state) && self.tasks[name] == nil {
        record.state = record.intent == "cancel" ? "cancelled" : record.intent == "pause" ? "paused" : "failed"
        record.error = record.state == "failed" ? "interrupted" : nil; self.records[name] = record
      }
      self.schedule(); try? self.persist(); self.ready = true
      let waiting = self.pending; self.pending.removeAll(); waiting.forEach { $0() }
    } }
  }

  private func usedPayloadBytes() throws -> Int64 {
    try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: [.isRegularFileKey, .fileSizeKey]).reduce(Int64(0)) { total, file in
      let values = try file.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey])
      return total + (values.isRegularFile == true ? Int64(values.fileSize ?? 0) : 0)
    }
  }
  func configure(_ maximum: Int64, completion: @escaping (Result<Void, Error>) -> Void) {
    perform { do {
      guard !self.storageError, maximum > 0, maximum <= 8 * 1024 * 1024 * 1024 else { throw Self.failure("quota") }
      try JSONEncoder().encode(maximum).write(to: self.metadata.appendingPathComponent("quota.json"), options: .atomic)
      self.maximumTotalBytes = maximum; self.payloadBytes = try self.usedPayloadBytes(); completion(.success(()))
    } catch { completion(.failure(Self.failure("无法保存下载容量设置"))) } }
  }
  // Existing transfers finish after a decrease; new work observes the bound.
  private func schedule() {
    for (name, task) in tasks.sorted(by: { $0.value.taskIdentifier < $1.value.taskIdentifier }) {
      guard admitted.count < concurrency else { break }
      if !admitted.contains(task.taskIdentifier), records[name]?.state == "running", records[name]?.intent == nil, task.state == .suspended { admitted.insert(task.taskIdentifier); task.resume() }
    }
  }
  func setConcurrency(_ value: Int, completion: @escaping (Result<Void, Error>) -> Void) {
    perform { do {
      guard !self.storageError, (1...3).contains(value) else { throw Self.failure("concurrency") }
      try JSONEncoder().encode(value).write(to: self.metadata.appendingPathComponent("concurrency.json"), options: .atomic)
      self.concurrency = value; self.schedule(); completion(.success(()))
    } catch { completion(.failure(Self.failure("无法保存下载并发设置"))) } }
  }
  private static func valid(_ name: String) -> Bool { name.range(of: "^[a-f0-9-]{8,80}\\.(audio|mp3|m4a|aac|flac|wav|aiff)$", options: .regularExpression) != nil }
  private static func failure(_ code: String) -> NSError { NSError(domain: "NexusOffline", code: 1, userInfo: [NSLocalizedDescriptionKey: code]) }
  private func identity(_ task: URLSessionTask) -> (String, String)? {
    let parts = (task.taskDescription ?? "").split(separator: "|").map(String.init)
    guard parts.count == 2, Self.valid(parts[0]), UUID(uuidString: parts[1]) != nil else { return nil }; return (parts[0], parts[1])
  }
  private func resumeURL(_ name: String) -> URL { metadata.appendingPathComponent(name + ".resume") }
  private func persist() throws {
    let bytes = try JSONEncoder().encode(records)
    try bytes.write(to: metadata.appendingPathComponent("journal.json"), options: .atomic)
    #if os(iOS)
    try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: metadata.path)
    try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: metadata.appendingPathComponent("journal.json").path)
    #endif
    lastWrite = Date().timeIntervalSince1970
  }
  private func perform(_ work: @escaping () -> Void) { queue.async { self.connect(); if self.ready { work() } else { self.pending.append(work) } } }
  func snapshot(_ name: String, completion: @escaping (OfflineTransferRecord?) -> Void) { perform { var record = self.records[name]; if record?.state == "running", let task = self.tasks[name], !self.admitted.contains(task.taskIdentifier) { record?.state = "queued" }; completion(record) } }

  func begin(_ url: String, name: String, headers: [String: String], resume: Bool, completion: @escaping (Result<OfflineTransferRecord, Error>) -> Void) {
    perform { do {
      guard !self.storageError, Self.valid(name), let address = URL(string: url), ["http", "https"].contains(address.scheme?.lowercased() ?? ""), address.host != nil, address.user == nil, address.password == nil else { throw Self.failure("request") }
      guard headers.count <= 64, headers.allSatisfy({ !$0.key.contains("\r") && !$0.key.contains("\n") && !$0.value.contains("\r") && !$0.value.contains("\n") }) else { throw Self.failure("headers") }
      if let current = self.records[name], current.state == "completed", FileManager.default.fileExists(atPath: self.directory.appendingPathComponent(name).path) { completion(.success(current)); return }
      if let current = self.records[name], self.tasks[name] != nil { completion(.success(current)); return }
      let body = try JSONSerialization.data(withJSONObject: ["url": url, "headers": headers], options: .sortedKeys)
      let fingerprint = SHA256.hash(data: body).map { String(format: "%02x", $0) }.joined()
      let resumeFile = self.resumeURL(name)
      let old = self.records[name]
      let resumeSize = (try? FileManager.default.attributesOfItem(atPath: resumeFile.path)[.size] as? NSNumber)?.int64Value ?? 0
      let data = resume && old?.fingerprint == fingerprint && resumeSize <= 5 * 1024 * 1024 ? try? Data(contentsOf: resumeFile) : nil
      self.payloadBytes = try self.usedPayloadBytes()
      guard self.records.count < 1000 || old != nil else { throw Self.failure("limit") }
      var request = URLRequest(url: address); request.httpShouldHandleCookies = false
      for (key, value) in headers where !["range", "if-range", "accept-encoding"].contains(key.lowercased()) { request.setValue(value, forHTTPHeaderField: key) }
      request.setValue("identity", forHTTPHeaderField: "Accept-Encoding")
      let task = data.map { self.session.downloadTask(withResumeData: $0) } ?? self.session.downloadTask(with: request)
      let record = OfflineTransferRecord(fileName: name, generation: UUID().uuidString, fingerprint: fingerprint, state: "running")
      self.records[name] = record
      do { try self.persist() } catch { self.records[name] = old; task.cancel(); throw error }
      try? FileManager.default.removeItem(at: resumeFile)
      task.taskDescription = name + "|" + record.generation; self.tasks[name] = task; self.schedule(); completion(.success(record))
    } catch { completion(.failure(Self.failure("无法保存或启动后台下载"))) } }
  }

  private func storeResume(_ data: Data?, name: String) {
    guard let data, data.count <= 5 * 1024 * 1024 else { return }
    do {
      try data.write(to: resumeURL(name), options: .atomic)
      #if os(iOS)
      try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: resumeURL(name).path)
      #endif
    } catch { try? FileManager.default.removeItem(at: resumeURL(name)) }
  }
  private func pauseTask(_ task: URLSessionDownloadTask, name: String, generation: String) {
    task.cancel { data in self.queue.async {
      guard var record = self.records[name], record.generation == generation, record.intent == "pause" else { return }
      self.storeResume(data, name: name); record.state = "paused"; self.records[name] = record
      self.tasks.removeValue(forKey: name); self.admitted.remove(task.taskIdentifier); self.schedule(); try? self.persist()
    } }
  }
  func stop(_ name: String, pause: Bool, completion: @escaping (Result<Void, Error>) -> Void) {
    perform { do {
      guard !self.storageError else { throw Self.failure("storage") }
      guard var record = self.records[name], record.state != "completed" else { completion(.success(())); return }
      record.intent = pause ? "pause" : "cancel"; record.state = self.tasks[name] == nil ? (pause ? "paused" : "cancelled") : (pause ? "pausing" : "cancelling")
      self.records[name] = record
      do { try self.persist() } catch { self.tasks[name]?.cancel(); throw error }
      if let task = self.tasks[name] { if pause { self.pauseTask(task, name: name, generation: record.generation) } else { task.cancel() } }
      if !pause { try? FileManager.default.removeItem(at: self.resumeURL(name)) }; completion(.success(()))
    } catch { completion(.failure(Self.failure("无法保存下载中止状态"))) } }
  }
  // Completed payload ownership remains with the JS file store and its in-use
  // checks. Discarding a native journal must never delete a playing final file.
  func discard(_ name: String, completion: @escaping (Result<Void, Error>) -> Void) {
    perform { do {
      guard !self.storageError else { throw Self.failure("storage") }
      self.tasks.removeValue(forKey: name)?.cancel()
      let old = self.records.removeValue(forKey: name)
      do { try self.persist() } catch { self.records[name] = old; throw error }
      try? FileManager.default.removeItem(at: self.resumeURL(name)); completion(.success(()))
    } catch { completion(.failure(Self.failure("无法移除下载状态"))) } }
  }
  func acknowledge(_ name: String, completion: @escaping (Result<Void, Error>) -> Void) {
    perform { do { if self.records[name]?.state == "completed" { self.records.removeValue(forKey: name); try self.persist() }; completion(.success(())) } catch { completion(.failure(Self.failure("无法确认下载状态"))) } }
  }
  func backgroundEvents(_ completion: @escaping () -> Void) { queue.async { self.completionHandler = completion; self.connect(); if self.storageError { self.completionHandler = nil; DispatchQueue.main.async(execute: completion) } } }
  func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
    let completion = completionHandler; completionHandler = nil
    DispatchQueue.main.async { completion?() }
  }
  func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
    guard let pair = identity(downloadTask), var record = records[pair.0], record.generation == pair.1 else { return }
    record.received = totalBytesWritten; record.expected = totalBytesExpectedToWrite; records[pair.0] = record
    if totalBytesWritten > maximumBytes || totalBytesExpectedToWrite > maximumBytes { record.error = "size"; records[pair.0] = record; downloadTask.cancel() }
    let receiving = records.values.filter { ["running", "pausing", "cancelling"].contains($0.state) }.reduce(Int64(0)) { $0 + max(0, $1.received) }
    if payloadBytes + receiving > maximumTotalBytes { record.error = "capacity"; records[pair.0] = record; downloadTask.cancel() }
    if Date().timeIntervalSince1970 - lastWrite > 1 { try? persist() }
  }
  func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
    guard let pair = identity(downloadTask), var record = records[pair.0], record.generation == pair.1, record.intent == nil else { return }
    do {
      guard let response = downloadTask.response as? HTTPURLResponse, [200, 206].contains(response.statusCode), response.value(forHTTPHeaderField: "Content-Encoding").map({ $0.lowercased() == "identity" }) ?? true else { throw Self.failure("response") }
      let size = (try FileManager.default.attributesOfItem(atPath: location.path)[.size] as? NSNumber)?.int64Value ?? 0
      guard size > 0, size <= maximumBytes else { throw Self.failure("size") }
      if response.statusCode == 200, response.expectedContentLength >= 0, size != response.expectedContentLength { throw Self.failure("length") }
      if response.statusCode == 206 {
        guard let range = response.value(forHTTPHeaderField: "Content-Range"), let total = Int64(range.split(separator: "/").last ?? ""), size == total else { throw Self.failure("range") }
      }
      let target = directory.appendingPathComponent(pair.0)
      let previousSize = (try? FileManager.default.attributesOfItem(atPath: target.path)[.size] as? NSNumber)?.int64Value ?? 0
      let total = try usedPayloadBytes() - previousSize + size
      guard total <= maximumTotalBytes else { record.error = "capacity"; throw Self.failure("capacity") }
      if FileManager.default.fileExists(atPath: target.path) { _ = try FileManager.default.replaceItemAt(target, withItemAt: location) } else { try FileManager.default.moveItem(at: location, to: target) }
      #if os(iOS)
      try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: target.path)
      #endif
      record.state = "completed"; record.received = size; record.expected = size; record.error = nil; records[pair.0] = record; payloadBytes = total; try persist()
    } catch { record.state = "failed"; record.error = record.error ?? "response-or-storage"; records[pair.0] = record; try? persist() }
  }
  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    admitted.remove(task.taskIdentifier); defer { schedule() }
    guard let pair = identity(task), var record = records[pair.0], record.generation == pair.1 else { return }
    tasks.removeValue(forKey: pair.0)
    if record.state == "completed" { return }
    if record.intent == "pause" {
      storeResume((error as NSError?)?.userInfo[NSURLSessionDownloadTaskResumeData] as? Data, name: pair.0); record.state = "paused"
    } else if record.intent == "cancel" { record.state = "cancelled" }
    else { record.state = "failed"; record.error = record.error ?? "network" }
    records[pair.0] = record; try? persist()
  }
}
