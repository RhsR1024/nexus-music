import Foundation
import AVFoundation
import UniformTypeIdentifiers

// Progressive byte-range transport for AVPlayer. Headers stay in native memory;
// neither authenticated URLs nor server errors are emitted to the UI/logs.
final class AudioResourceLoader: NSObject, AVAssetResourceLoaderDelegate, URLSessionDataDelegate {
  private final class Job {
    let request: AVAssetResourceLoadingRequest
    var offset: Int64 = 0
    init(_ request: AVAssetResourceLoadingRequest) { self.request = request }
  }
  private let url: URL
  private let headers: [String: String]
  private let queue = DispatchQueue(label: "nexus.audio.resource")
  private var session: URLSession!
  private var jobs: [Int: Job] = [:]
  private var tasks: [ObjectIdentifier: URLSessionDataTask] = [:]
  let asset: AVURLAsset

  init(url: URL, headers: [String: String]) {
    self.url = url; self.headers = headers
    var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
    components.scheme = "nexus-audio"
    asset = AVURLAsset(url: components.url!)
    super.init()
    let configuration = URLSessionConfiguration.ephemeral
    configuration.urlCache = nil; configuration.httpCookieStorage = nil
    configuration.timeoutIntervalForRequest = 20; configuration.timeoutIntervalForResource = 3600
    let operations = OperationQueue(); operations.maxConcurrentOperationCount = 1; operations.underlyingQueue = queue
    session = URLSession(configuration: configuration, delegate: self, delegateQueue: operations)
    asset.resourceLoader.setDelegate(self, queue: queue)
  }
  func resourceLoader(_ resourceLoader: AVAssetResourceLoader, shouldWaitForLoadingOfRequestedResource request: AVAssetResourceLoadingRequest) -> Bool {
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
      jobs.removeAll(); tasks.removeAll(); session.invalidateAndCancel()
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
    var total = response.expectedContentLength
    if let range = http.value(forHTTPHeaderField: "Content-Range") {
      let parts = range.replacingOccurrences(of: "bytes ", with: "").split(separator: "/")
      if parts.count == 2 {
        job.offset = Int64(parts[0].split(separator: "-").first ?? "0") ?? 0
        total = Int64(parts[1]) ?? total
      }
    }
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
