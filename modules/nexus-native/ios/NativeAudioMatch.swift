import AVFoundation
import Foundation

/// Native microphone acoustic sampler for Audio Match (听歌识曲) on iOS.
/// Captures real-time level/signature metrics and a bounded 16 kHz mono 16-bit WAV clip
/// for optional user-configured cloud audio recognition (ACRCloud / AudD).
final class NativeAudioMatch {
  private let lock = NSLock()
  private var engine: AVAudioEngine?
  private var timer: DispatchSourceTimer?
  private var activeCompletion: (([String: Any]) -> Void)?
  private var startTime: Date?
  private var lastEmit: TimeInterval = 0
  private var sampleRate: Double = 44100
  private var peakLevel: Double = 0
  private var rmsAccum: Double = 0
  private var rmsCount: Int = 0
  private var zeroCrossings: Int = 0
  private var bucketEnergies: [Double] = Array(repeating: 0, count: 24)
  private var bucketCounts: [Int] = Array(repeating: 0, count: 24)
  private var targetDurationMs: Int = 6000
  private var pcm16kSamples: [Int16] = []
  private var resamplePhase: Double = 0
  private static let targetWavSampleRate: Double = 16000
  private static let maxWavSamples: Int = 16000 * 10 // <= 10s (320 KB PCM)

  deinit {
    stopCapture()
  }

  func permissionStatus() -> String {
    switch AVAudioSession.sharedInstance().recordPermission {
    case .granted: return "granted"
    case .denied: return "denied"
    case .undetermined: return "undetermined"
    @unknown default: return "undetermined"
    }
  }

  func requestPermission(completion: @escaping (Bool) -> Void) {
    AVAudioSession.sharedInstance().requestRecordPermission { granted in
      completion(granted)
    }
  }

  func startCapture(
    durationMs: Int,
    onLevel: @escaping ([String: Any]) -> Void,
    completion: @escaping (Result<[String: Any], Error>) -> Void
  ) {
    stopCapture()
    guard AVAudioSession.sharedInstance().recordPermission == .granted else {
      completion(.failure(NSError(domain: "NexusAudioMatch", code: 1, userInfo: [NSLocalizedDescriptionKey: "未获得麦克风权限"])))
      return
    }

    let clampedMs = min(max(durationMs, 2000), 12000)
    do {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.playAndRecord, mode: .measurement, options: [.defaultToSpeaker, .allowBluetooth, .mixWithOthers])
      try session.setActive(true)
    } catch {
      completion(.failure(error))
      return
    }

    let newEngine = AVAudioEngine()
    let input = newEngine.inputNode
    let format = input.outputFormat(forBus: 0)
    guard format.sampleRate > 0, format.channelCount > 0 else {
      completion(.failure(NSError(domain: "NexusAudioMatch", code: 2, userInfo: [NSLocalizedDescriptionKey: "当前设备未检测到可用麦克风输入"])))
      return
    }

    lock.lock()
    engine = newEngine
    startTime = Date()
    lastEmit = 0
    sampleRate = format.sampleRate
    peakLevel = 0
    rmsAccum = 0
    rmsCount = 0
    zeroCrossings = 0
    bucketEnergies = Array(repeating: 0, count: 24)
    bucketCounts = Array(repeating: 0, count: 24)
    targetDurationMs = clampedMs
    pcm16kSamples = []
    pcm16kSamples.reserveCapacity(min(Self.maxWavSamples, Int(Self.targetWavSampleRate) * clampedMs / 1000))
    resamplePhase = 0
    activeCompletion = { payload in
      completion(.success(payload))
    }
    lock.unlock()

    let inputRate = format.sampleRate
    let step = inputRate / Self.targetWavSampleRate

    input.installTap(onBus: 0, bufferSize: 2048, format: format) { [weak self] buffer, _ in
      guard let self, let channel = buffer.floatChannelData?[0] else { return }
      let frameCount = Int(buffer.frameLength)
      guard frameCount > 0 else { return }
      var sumSq: Double = 0
      var localPeak: Double = 0
      var zc = 0
      var prev = channel[0]
      for i in 0..<frameCount {
        let s = channel[i]
        let absVal = abs(Double(s))
        if absVal > localPeak { localPeak = absVal }
        sumSq += Double(s * s)
        if (s >= 0 && prev < 0) || (s < 0 && prev >= 0) { zc += 1 }
        prev = s
      }
      let rms = sqrt(sumSq / Double(frameCount))
      let now = CACurrentMediaTime()

      var emitPayload: [String: Any]?
      self.lock.lock()
      if let start = self.startTime {
        // Downsample mono float PCM into 16 kHz Int16 buffer for clip upload
        if self.pcm16kSamples.count < Self.maxWavSamples {
          var pos = self.resamplePhase
          while pos < Double(frameCount) && self.pcm16kSamples.count < Self.maxWavSamples {
            let idx = Int(pos)
            let clamped = max(-1.0, min(1.0, Double(channel[idx])))
            self.pcm16kSamples.append(Int16(clamped * 32767.0))
            pos += step
          }
          self.resamplePhase = pos - Double(frameCount)
        }

        let elapsedMs = max(0, Int(Date().timeIntervalSince(start) * 1000))
        if localPeak > self.peakLevel { self.peakLevel = localPeak }
        self.rmsAccum += rms
        self.rmsCount += 1
        self.zeroCrossings += zc
        let bucket = min(23, max(0, elapsedMs * 24 / max(1, self.targetDurationMs)))
        self.bucketEnergies[bucket] += rms
        self.bucketCounts[bucket] += 1
        if now - self.lastEmit >= 0.08 {
          self.lastEmit = now
          emitPayload = [
            "level": min(1.0, rms * 3.5),
            "peak": min(1.0, localPeak),
            "elapsedMs": elapsedMs,
          ]
        }
      }
      self.lock.unlock()
      if let emitPayload {
        onLevel(emitPayload)
      }
    }

    do {
      try newEngine.start()
    } catch {
      input.removeTap(onBus: 0)
      lock.lock()
      engine = nil
      activeCompletion = nil
      pcm16kSamples.removeAll(keepingCapacity: false)
      lock.unlock()
      completion(.failure(error))
      return
    }

    let t = DispatchSource.makeTimerSource(queue: DispatchQueue.global(qos: .userInitiated))
    t.schedule(deadline: .now() + .milliseconds(clampedMs))
    t.setEventHandler { [weak self] in
      self?.finish(cancelled: false)
    }
    lock.lock()
    timer = t
    lock.unlock()
    t.resume()
  }

  func stopCapture() {
    finish(cancelled: true)
  }

  private static func buildWavData(samples: [Int16], sampleRate: UInt32) -> Data {
    let dataSize = UInt32(samples.count * 2)
    let riffSize = UInt32(36) + dataSize
    var data = Data(capacity: Int(44 + dataSize))
    func appendLE32(_ v: UInt32) {
      var le = v.littleEndian
      withUnsafeBytes(of: &le) { data.append(contentsOf: $0) }
    }
    func appendLE16(_ v: UInt16) {
      var le = v.littleEndian
      withUnsafeBytes(of: &le) { data.append(contentsOf: $0) }
    }
    data.append(contentsOf: "RIFF".utf8)
    appendLE32(riffSize)
    data.append(contentsOf: "WAVE".utf8)
    data.append(contentsOf: "fmt ".utf8)
    appendLE32(16) // PCM fmt chunk size
    appendLE16(1)  // PCM format
    appendLE16(1)  // Mono
    appendLE32(sampleRate)
    appendLE32(sampleRate * 2) // byteRate
    appendLE16(2)  // blockAlign
    appendLE16(16) // bitsPerSample
    data.append(contentsOf: "data".utf8)
    appendLE32(dataSize)
    samples.withUnsafeBufferPointer { buf in
      guard let base = buf.baseAddress else { return }
      data.append(UnsafeBufferPointer(start: UnsafeRawPointer(base).assumingMemoryBound(to: UInt8.self), count: Int(dataSize)))
    }
    return data
  }

  private func finish(cancelled: Bool) {
    lock.lock()
    let eng = engine
    let t = timer
    let cb = activeCompletion
    let start = startTime
    let sr = sampleRate
    let peak = peakLevel
    let avg = rmsCount > 0 ? rmsAccum / Double(rmsCount) : 0
    let zc = zeroCrossings
    let buckets = bucketEnergies
    let counts = bucketCounts
    let capturedSamples = pcm16kSamples
    engine = nil
    timer = nil
    activeCompletion = nil
    startTime = nil
    pcm16kSamples.removeAll(keepingCapacity: false)
    lock.unlock()

    t?.cancel()
    if let eng {
      eng.inputNode.removeTap(onBus: 0)
      eng.stop()
      try? AVAudioSession.sharedInstance().setCategory(.playback)
    }
    guard let cb else { return }

    let elapsedMs = start.map { max(0, Int(Date().timeIntervalSince($0) * 1000)) } ?? 0
    var sig = ""
    for i in 0..<24 {
      let mean = counts[i] > 0 ? buckets[i] / Double(counts[i]) : 0
      let nibble = min(15, max(0, Int(round(mean * 45.0))))
      sig += String(format: "%x", nibble)
    }
    var payload: [String: Any] = [
      "durationMs": elapsedMs,
      "sampleRate": Int(sr),
      "avgLevel": avg,
      "peakLevel": peak,
      "zeroCrossings": zc,
      "energySignature": sig,
      "cancelled": cancelled,
    ]
    if !cancelled && capturedSamples.count >= 4000 {
      let wav = Self.buildWavData(samples: capturedSamples, sampleRate: UInt32(Self.targetWavSampleRate))
      payload["audioBase64"] = wav.base64EncodedString()
      payload["mimeType"] = "audio/wav"
    }
    cb(payload)
  }
}
