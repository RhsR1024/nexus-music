import AVFoundation
import Darwin
import Foundation

/// Native LAN DLNA discovery (SSDP multicast) + ephemeral local HTTP media relay for iOS.
final class NativeDlnaService {
  private let queue = DispatchQueue(label: "nexus.dlna.service", qos: .utility)
  private let relayLock = NSLock()
  private var serverFD: Int32 = -1
  private var relayRunning = false
  private var relayToken = ""
  private var relaySource = ""
  private var relayHeaders: [String: String] = [:]
  private var keepAliveActive = false

  deinit {
    stopRelay()
    setKeepAlive(false)
  }

  func discover(timeoutMs: Int, completion: @escaping ([[String: String]]) -> Void) {
    let clampedMs = min(max(timeoutMs, 1500), 6000)
    queue.async {
      let devices = Self.runSsdpDiscovery(timeoutMs: clampedMs)
      completion(devices)
    }
  }

  private static func runSsdpDiscovery(timeoutMs: Int) -> [[String: String]] {
    let fd = Darwin.socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP)
    guard fd >= 0 else { return [] }
    defer { Darwin.close(fd) }

    var reuse: Int32 = 1
    setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &reuse, socklen_t(MemoryLayout<Int32>.size))
    var ttl: UInt8 = 2
    setsockopt(fd, IPPROTO_IP, IP_MULTICAST_TTL, &ttl, socklen_t(MemoryLayout<UInt8>.size))

    var dest = sockaddr_in()
    dest.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
    dest.sin_family = sa_family_t(AF_INET)
    dest.sin_port = in_port_t(1900).bigEndian
    inet_pton(AF_INET, "239.255.255.250", &dest.sin_addr)

    let targets = [
      "urn:schemas-upnp-org:device:MediaRenderer:1",
      "urn:schemas-upnp-org:service:AVTransport:1",
    ]
    let mx = max(1, min(4, timeoutMs / 1000))
    for st in targets {
      let msg =
        "M-SEARCH * HTTP/1.1\r\n" +
        "HOST: 239.255.255.250:1900\r\n" +
        "MAN: \"ssdp:discover\"\r\n" +
        "MX: \(mx)\r\n" +
        "ST: \(st)\r\n\r\n"
      msg.withCString { ptr in
        withUnsafePointer(to: &dest) { addrPtr in
          addrPtr.withMemoryRebound(to: sockaddr.self, capacity: 1) { sa in
            _ = sendto(fd, ptr, strlen(ptr), 0, sa, socklen_t(MemoryLayout<sockaddr_in>.size))
          }
        }
      }
    }

    var seen: [String: [String: String]] = [:]
    let deadline = Date().addingTimeInterval(Double(timeoutMs) / 1000.0)
    var buffer = [UInt8](repeating: 0, count: 4096)

    while true {
      let remainingMs = Int32(deadline.timeIntervalSinceNow * 1000.0)
      if remainingMs <= 0 { break }
      var pfd = pollfd(fd: fd, events: Int16(POLLIN), revents: 0)
      let ready = poll(&pfd, 1, min(remainingMs, 250))
      if ready <= 0 { continue }
      let n = recvfrom(fd, &buffer, buffer.count, 0, nil, nil)
      guard n > 0, let text = String(bytes: buffer[0..<n], encoding: .utf8) ?? String(bytes: buffer[0..<n], encoding: .isoLatin1) else {
        continue
      }
      var headers: [String: String] = [:]
      for line in text.split(whereSeparator: { $0 == "\r" || $0 == "\n" }) {
        guard let colon = line.firstIndex(of: ":") else { continue }
        let key = line[..<colon].trimmingCharacters(in: .whitespaces).lowercased()
        let val = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
        headers[key] = val
      }
      guard let location = headers["location"], !location.isEmpty else { continue }
      let key = location.lowercased()
      if seen[key] == nil {
        seen[key] = [
          "location": location,
          "usn": headers["usn"] ?? location,
          "st": headers["st"] ?? "",
          "server": headers["server"] ?? "",
        ]
      }
    }
    return Array(seen.values)
  }

  func startRelay(sourceUrl: String, headersJSON: String) throws -> [String: String] {
    stopRelay()
    guard let host = Self.localIPv4Address() else {
      throw NSError(domain: "NexusDlna", code: 1, userInfo: [NSLocalizedDescriptionKey: "未检测到局域网 Wi-Fi IP 地址"])
    }
    var parsedHeaders: [String: String] = [:]
    if let data = headersJSON.data(using: .utf8),
       let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
      for (k, v) in obj {
        if let s = v as? String { parsedHeaders[k] = s }
      }
    }

    let fd = Darwin.socket(AF_INET, SOCK_STREAM, IPPROTO_TCP)
    guard fd >= 0 else {
      throw NSError(domain: "NexusDlna", code: 2, userInfo: [NSLocalizedDescriptionKey: "无法创建投屏中继端口"])
    }
    var reuse: Int32 = 1
    setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &reuse, socklen_t(MemoryLayout<Int32>.size))

    var addr = sockaddr_in()
    addr.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
    addr.sin_family = sa_family_t(AF_INET)
    addr.sin_port = 0
    addr.sin_addr.s_addr = INADDR_ANY.bigEndian

    let bound = withUnsafePointer(to: &addr) { ptr in
      ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { sa in
        Darwin.bind(fd, sa, socklen_t(MemoryLayout<sockaddr_in>.size))
      }
    }
    guard bound == 0, Darwin.listen(fd, 8) == 0 else {
      Darwin.close(fd)
      throw NSError(domain: "NexusDlna", code: 3, userInfo: [NSLocalizedDescriptionKey: "投屏中继监听失败"])
    }

    var actualAddr = sockaddr_in()
    var addrLen = socklen_t(MemoryLayout<sockaddr_in>.size)
    _ = withUnsafeMutablePointer(to: &actualAddr) { ptr in
      ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { sa in
        getsockname(fd, sa, &addrLen)
      }
    }
    let port = Int(UInt16(bigEndian: actualAddr.sin_port))
    let token = UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased()

    relayLock.lock()
    serverFD = fd
    relayRunning = true
    relayToken = token
    relaySource = sourceUrl
    relayHeaders = parsedHeaders
    relayLock.unlock()

    DispatchQueue.global(qos: .utility).async { [weak self] in
      self?.acceptLoop(listenFD: fd)
    }

    return [
      "url": "http://\(host):\(port)/\(token)",
      "host": host,
      "port": String(port),
    ]
  }

  func stopRelay() {
    relayLock.lock()
    relayRunning = false
    let fd = serverFD
    serverFD = -1
    relayLock.unlock()
    if fd >= 0 {
      Darwin.shutdown(fd, SHUT_RDWR)
      Darwin.close(fd)
    }
  }

  func setKeepAlive(_ enabled: Bool) {
    keepAliveActive = enabled
    if enabled {
      try? AVAudioSession.sharedInstance().setCategory(.playback, options: [.mixWithOthers])
      try? AVAudioSession.sharedInstance().setActive(true)
    }
  }

  private func acceptLoop(listenFD: Int32) {
    while true {
      relayLock.lock()
      let running = relayRunning && serverFD == listenFD
      relayLock.unlock()
      if !running { break }

      var clientAddr = sockaddr_in()
      var len = socklen_t(MemoryLayout<sockaddr_in>.size)
      let clientFD = withUnsafeMutablePointer(to: &clientAddr) { ptr in
        ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { sa in
          Darwin.accept(listenFD, sa, &len)
        }
      }
      if clientFD < 0 { break }
      DispatchQueue.global(qos: .utility).async { [weak self] in
        self?.handleClient(clientFD)
      }
    }
  }

  private func handleClient(_ clientFD: Int32) {
    defer { Darwin.close(clientFD) }
    var noSigPipe: Int32 = 1
    setsockopt(clientFD, SOL_SOCKET, SO_NOSIGPIPE, &noSigPipe, socklen_t(MemoryLayout<Int32>.size))

    var reqBuf = [UInt8](repeating: 0, count: 8192)
    let readCount = Darwin.recv(clientFD, &reqBuf, reqBuf.count, 0)
    guard readCount > 0, let requestText = String(bytes: reqBuf[0..<readCount], encoding: .utf8) else { return }

    let lines = requestText.components(separatedBy: "\r\n")
    guard let firstLine = lines.first else { return }
    let parts = firstLine.split(separator: " ")
    guard parts.count >= 2 else { return }
    let method = String(parts[0]).uppercased()
    let path = String(parts[1])

    relayLock.lock()
    let expectedPath = "/" + relayToken
    let source = relaySource
    let headers = relayHeaders
    relayLock.unlock()

    guard path == expectedPath || path.hasPrefix(expectedPath + "?") else {
      Self.writeString(clientFD, "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
      return
    }

    var rangeHeader: String?
    for line in lines.dropFirst() {
      guard let colon = line.firstIndex(of: ":") else { continue }
      let k = line[..<colon].trimmingCharacters(in: .whitespaces).lowercased()
      if k == "range" {
        rangeHeader = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
      }
    }

    if source.hasPrefix("file://"), let fileURL = URL(string: source) {
      serveLocalFile(clientFD, url: fileURL, isHead: method == "HEAD", rangeHeader: rangeHeader)
    } else if let remoteURL = URL(string: source), source.hasPrefix("http://") || source.hasPrefix("https://") {
      proxyRemote(clientFD, url: remoteURL, headers: headers, isHead: method == "HEAD", rangeHeader: rangeHeader)
    } else {
      Self.writeString(clientFD, "HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
    }
  }

  private func serveLocalFile(_ clientFD: Int32, url: URL, isHead: Bool, rangeHeader: String?) {
    guard let attrs = try? FileManager.default.attributesOfItem(atPath: url.path),
          let totalSize = (attrs[.size] as? NSNumber)?.int64Value,
          let handle = try? FileHandle(forReadingFrom: url) else {
      Self.writeString(clientFD, "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
      return
    }
    defer { try? handle.close() }

    var start: Int64 = 0
    var end: Int64 = max(0, totalSize - 1)
    var isPartial = false
    if let range = rangeHeader, range.lowercased().hasPrefix("bytes=") {
      let spec = range.dropFirst(6).split(separator: ",").first.map(String.init) ?? ""
      let bounds = spec.split(separator: "-", omittingEmptySubsequences: false)
      if bounds.count == 2 {
        let s = Int64(bounds[0])
        let e = Int64(bounds[1])
        if let s, s >= 0, s < totalSize {
          start = s
          end = min(totalSize - 1, e ?? (totalSize - 1))
          isPartial = true
        }
      }
    }

    let length = max(0, end - start + 1)
    let mime = Self.mimeType(for: url.pathExtension)
    var response = isPartial ? "HTTP/1.1 206 Partial Content\r\n" : "HTTP/1.1 200 OK\r\n"
    response += "Content-Type: \(mime)\r\n"
    response += "Accept-Ranges: bytes\r\n"
    response += "Content-Length: \(length)\r\n"
    if isPartial {
      response += "Content-Range: bytes \(start)-\(end)/\(totalSize)\r\n"
    }
    response += "Connection: close\r\n\r\n"
    guard Self.writeString(clientFD, response), !isHead else { return }

    try? handle.seek(toOffset: UInt64(start))
    var remaining = length
    while remaining > 0 {
      let chunkLen = Int(min(remaining, 65536))
      guard let data = try? handle.read(upToCount: chunkLen), !data.isEmpty else { break }
      if !Self.writeData(clientFD, data) { break }
      remaining -= Int64(data.count)
    }
  }

  private func proxyRemote(_ clientFD: Int32, url: URL, headers: [String: String], isHead: Bool, rangeHeader: String?) {
    var req = URLRequest(url: url, timeoutInterval: 20)
    req.httpMethod = isHead ? "HEAD" : "GET"
    for (k, v) in headers { req.setValue(v, forHTTPHeaderField: k) }
    if let rangeHeader { req.setValue(rangeHeader, forHTTPHeaderField: "Range") }

    let sem = DispatchSemaphore(value: 0)
    var resultData: Data?
    var resultResp: HTTPURLResponse?
    let task = URLSession.shared.dataTask(with: req) { data, resp, _ in
      resultData = data
      resultResp = resp as? HTTPURLResponse
      sem.signal()
    }
    task.resume()
    _ = sem.wait(timeout: .now() + 25)

    guard let http = resultResp else {
      Self.writeString(clientFD, "HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
      return
    }
    let body = resultData ?? Data()
    let status = http.statusCode
    let mime = http.value(forHTTPHeaderField: "Content-Type") ?? Self.mimeType(for: url.pathExtension)
    var header = "HTTP/1.1 \(status) \(status == 206 ? "Partial Content" : "OK")\r\n"
    header += "Content-Type: \(mime)\r\n"
    header += "Accept-Ranges: bytes\r\n"
    if let cr = http.value(forHTTPHeaderField: "Content-Range") {
      header += "Content-Range: \(cr)\r\n"
    }
    let contentLen = isHead ? (http.value(forHTTPHeaderField: "Content-Length") ?? String(body.count)) : String(body.count)
    header += "Content-Length: \(contentLen)\r\nConnection: close\r\n\r\n"
    guard Self.writeString(clientFD, header), !isHead, !body.isEmpty else { return }
    _ = Self.writeData(clientFD, body)
  }

  private static func mimeType(for ext: String) -> String {
    switch ext.lowercased() {
    case "mp3": return "audio/mpeg"
    case "flac": return "audio/flac"
    case "m4a", "mp4": return "audio/mp4"
    case "aac": return "audio/aac"
    case "wav": return "audio/wav"
    case "ogg": return "audio/ogg"
    default: return "audio/mpeg"
    }
  }

  private static func writeString(_ fd: Int32, _ text: String) -> Bool {
    writeData(fd, Data(text.utf8))
  }

  private static func writeData(_ fd: Int32, _ data: Data) -> Bool {
    data.withUnsafeBytes { raw -> Bool in
      guard let base = raw.baseAddress else { return true }
      var written = 0
      while written < data.count {
        let n = Darwin.send(fd, base.advanced(by: written), data.count - written, 0)
        if n <= 0 { return false }
        written += n
      }
      return true
    }
  }

  private static func localIPv4Address() -> String? {
    var ifaddr: UnsafeMutablePointer<ifaddrs>?
    guard getifaddrs(&ifaddr) == 0, let first = ifaddr else { return nil }
    defer { freeifaddrs(ifaddr) }
    var fallback: String?
    var cursor: UnsafeMutablePointer<ifaddrs>? = first
    while let ptr = cursor {
      let flags = Int32(ptr.pointee.ifa_flags)
      let isUp = (flags & IFF_UP) != 0
      let isLoopback = (flags & IFF_LOOPBACK) != 0
      if isUp, !isLoopback, let sa = ptr.pointee.ifa_addr, sa.pointee.sa_family == UInt8(AF_INET) {
        var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
        if getnameinfo(sa, socklen_t(sa.pointee.sa_len), &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST) == 0 {
          let ip = String(cString: host)
          let name = String(cString: ptr.pointee.ifa_name)
          if name == "en0" { return ip }
          if fallback == nil { fallback = ip }
        }
      }
      cursor = ptr.pointee.ifa_next
    }
    return fallback
  }
}
