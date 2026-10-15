import Foundation
import AVFoundation
import UniformTypeIdentifiers

// Progressive byte-range transport for AVPlayer. Headers stay in native memory;
// neither authenticated URLs nor server errors are emitted to the UI/logs.
final class AudioResourceLoader: NSObject, AVAssetResourceLoaderDelegate, URLSessionDataDelegate {
  private final class Job {
    let request: AVAssetResourceLoadingRequest
    var offset: Int64 = 0
    var total: Int64 = 0
    var mime: String?
    var redirects = 0
    init(_ request: AVAssetResourceLoadingRequest) { self.request = request }
  }
  private var cacheWriter: AudioCache.Writer?
  private let url: URL
  private let headers: [String: String]
  private let scope: DAVScope?
  private let invalidScope: Bool
  private let byteBudget: Int?
  private var receivedBytes = 0
  private let queue = DispatchQueue(label: "nexus.audio.resource")
  private var session: URLSession!
  private var jobs: [Int: Job] = [:]
  private var tasks: [ObjectIdentifier: URLSessionDataTask] = [:]
  let asset: AVURLAsset

  init(url: URL, headers: [String: String], cacheKey: String? = nil, redirectRoot: String? = nil, byteBudget: Int? = nil) {
    self.url = url; self.headers = headers
    let scope = redirectRoot.flatMap { try? DAVScope($0) }
    self.scope = scope; self.invalidScope = redirectRoot != nil && (scope == nil || scope?.contains(url) == false); self.byteBudget = byteBudget
    var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
    components.scheme = "nexus-audio"
    asset = AVURLAsset(url: components.url!)
    super.init()
    if let cacheKey { cacheWriter = AudioCache.shared.writer(cacheKey) }
    let configuration = URLSessionConfiguration.ephemeral
    configuration.urlCache = nil; configuration.httpCookieStorage = nil
    configuration.timeoutIntervalForRequest = 20; configuration.timeoutIntervalForResource = 3600
    let operations = OperationQueue(); operations.maxConcurrentOperationCount = 1; operations.underlyingQueue = queue
    session = URLSession(configuration: configuration, delegate: self, delegateQueue: operations)
    asset.resourceLoader.setDelegate(self, queue: queue)
  }
  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                  newRequest: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
    guard let scope else { completionHandler(newRequest); return }
    guard let job = jobs[task.taskIdentifier], let target = newRequest.url, scope.contains(target), job.redirects < 5 else {
      completionHandler(nil); finish(task, error: URLError(.redirectToNonExistentLocation)); return
    }
    job.redirects += 1
    var next = newRequest
    // Authentication and byte range remain scoped to the configured DAV root.
    for (name, value) in headers { next.setValue(value, forHTTPHeaderField: name) }
    if let range = task.originalRequest?.value(forHTTPHeaderField: "Range") { next.setValue(range, forHTTPHeaderField: "Range") }
    completionHandler(next)
  }
  func resourceLoader(_ resourceLoader: AVAssetResourceLoader, shouldWaitForLoadingOfRequestedResource request: AVAssetResourceLoadingRequest) -> Bool {
    guard !invalidScope else { request.finishLoading(with: URLError(.badURL)); return true }
    guard jobs.count < 16 else { request.finishLoading(with: URLError(.resourceUnavailable)); return true }
    var outgoing = URLRequest(url: url)
    for (name, value) in headers { outgoing.setValue(value, forHTTPHeaderField: name) }
    if let data = request.dataRequest {
      let start = max(data.requestedOffset, data.currentOffset)
      let end = data.requestsAllDataToEndOfResource ? "" : String(data.requestedOffset + Int64(data.requestedLength) - 1)
      outgoing.setValue("bytes=\(start)-\(end)", forHTTPHeaderField: "Range")
    }
    let task = session.dataTask(with: outgoing)
    jobs[task.taskIdentifier] = Job(request); tasks[ObjectIdentifier(request)] = task
    task.resume(); return true
  }
  func resourceLoader(_ resourceLoader: AVAssetResourceLoader, didCancel request: AVAssetResourceLoadingRequest) {
    if let task = tasks.removeValue(forKey: ObjectIdentifier(request)) { jobs.removeValue(forKey: task.taskIdentifier); task.cancel() }
  }
  func destroy() {
    queue.async { [self] in
      for job in jobs.values { job.request.finishLoading(with: URLError(.cancelled)) }
      jobs.removeAll(); tasks.removeAll(); session.invalidateAndCancel(); cacheWriter?.cancel(); cacheWriter = nil
    }
  }
  private func finish(_ task: URLSessionTask, error: Error? = nil) {
    guard let job = jobs.removeValue(forKey: task.taskIdentifier) else { return }
    tasks.removeValue(forKey: ObjectIdentifier(job.request)); task.cancel()
    if let error { job.request.finishLoading(with: error) } else { job.request.finishLoading() }
  }
  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse,
                  completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
    guard let job = jobs[dataTask.taskIdentifier], let http = response as? HTTPURLResponse,
          (200..<300).contains(http.statusCode) else {
      finish(dataTask, error: URLError(.badServerResponse)); completionHandler(.cancel); return
    }
    if scope != nil, let expected = headers["If-Match"], let actual = http.value(forHTTPHeaderField: "ETag"), expected != actual {
      cacheWriter?.cancel(); cacheWriter = nil
      finish(dataTask, error: URLError(.resourceUnavailable)); completionHandler(.cancel); return
    }
    var total = response.expectedContentLength
    if let range = http.value(forHTTPHeaderField: "Content-Range") {
      let parts = range.replacingOccurrences(of: "bytes ", with: "").split(separator: "/")
      if parts.count == 2 {
        job.offset = Int64(parts[0].split(separator: "-").first ?? "0") ?? 0
        total = Int64(parts[1]) ?? total
      }
    }
    job.total = total; job.mime = response.mimeType
    if let info = job.request.contentInformationRequest {
      let mime = response.mimeType ?? "application/octet-stream"
      info.contentType = UTType(mimeType: mime)?.identifier ?? "public.audio"
      info.contentLength = max(0, total)
      info.isByteRangeAccessSupported = http.statusCode == 206 || http.value(forHTTPHeaderField: "Accept-Ranges")?.lowercased() == "bytes"
    }
    if job.request.dataRequest == nil { finish(dataTask); completionHandler(.cancel); return }
    completionHandler(.allow)
  }
  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
    guard let job = jobs[dataTask.taskIdentifier], let requested = job.request.dataRequest else { return }
    if let byteBudget, receivedBytes > byteBudget - data.count { finish(dataTask, error: URLError(.dataLengthExceedsMaximum)); return }
    receivedBytes += data.count
    cacheWriter?.write(data, offset: job.offset, total: job.total, mime: job.mime)
    let wanted = max(requested.requestedOffset, requested.currentOffset)
    let upper = requested.requestsAllDataToEndOfResource ? Int64.max : requested.requestedOffset + Int64(requested.requestedLength)
    let lower = max(wanted, job.offset), end = min(upper, job.offset + Int64(data.count))
    if lower < end { requested.respond(with: data.subdata(in: Int(lower-job.offset)..<Int(end-job.offset))) }
    job.offset += Int64(data.count)
    if requested.currentOffset >= upper { finish(dataTask) }
  }
  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    finish(task, error: error == nil ? nil : URLError(.networkConnectionLost))
  }
}
