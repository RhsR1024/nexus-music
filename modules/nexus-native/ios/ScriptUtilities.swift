// Original implementation of the LX byte-level utility contract.
import Foundation
import CryptoKit
import CommonCrypto
import Security
import zlib

enum ScriptUtilityError: Error { case invalidInput, unsupported, cryptoFailed, limitExceeded }

enum ScriptUtilities {
  static let maxBytes = 8 * 1024 * 1024
  static func json(_ value: Any) -> String {
    guard let data = try? JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed]),
          let string = String(data: data, encoding: .utf8) else { return "null" }
    return string
  }
  static func call(_ operation: String, _ inputJSON: String) -> String {
    do {
      guard inputJSON.utf8.count <= maxBytes * 5,
            let data = inputJSON.data(using: .utf8),
            let input = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw ScriptUtilityError.invalidInput }
      return json(["value": try perform(operation, input)])
    } catch { return json(["error": "Invalid or unsupported utility operation"]) }
  }
  static func bytes(_ input: Any?) throws -> [UInt8] {
    guard let values = input as? [Int], values.count <= maxBytes,
          values.allSatisfy({ $0 >= 0 && $0 <= 255 }) else { throw ScriptUtilityError.invalidInput }
    return values.map(UInt8.init)
  }
  static func perform(_ operation: String, _ input: [String: Any]) throws -> Any {
    if operation == "qrcDecode" {
      guard let hex = input["input"] as? String, hex.utf8.count <= 524288, hex.utf8.count % 16 == 0 else { throw ScriptUtilityError.invalidInput }
      let digits = Array(hex.utf8)
      func nibble(_ byte: UInt8) throws -> UInt8 {
        switch byte { case 48...57: return byte-48; case 65...70: return byte-55; case 97...102: return byte-87; default: throw ScriptUtilityError.invalidInput }
      }
      var data = [UInt8](); data.reserveCapacity(digits.count/2)
      for offset in stride(from: 0, to: digits.count, by: 2) { data.append(try (nibble(digits[offset]) << 4) | nibble(digits[offset+1])) }
      let bytes = try zip(QRCVariant.decrypt(data), compressing: false)
      guard let text = String(data: Data(bytes), encoding: .utf8) else { throw ScriptUtilityError.invalidInput }; return text
    }
    if operation == "importText" || operation == "krcDecode" {
      guard let base64 = input["input"] as? String, base64.count <= maxBytes * 2,
            let data = Data(base64Encoded: base64), data.count <= maxBytes else { throw ScriptUtilityError.invalidInput }
      var raw = Array(data)
      if operation == "krcDecode" {
        guard raw.starts(with: Array("krc1".utf8)) else { throw ScriptUtilityError.invalidInput }
        let key: [UInt8] = [64, 71, 97, 119, 94, 50, 116, 71, 81, 54, 49, 45, 206, 210, 110, 105]
        raw = raw.dropFirst(4).enumerated().map { $0.element ^ key[$0.offset % key.count] }
        raw = try zip(raw, compressing: false)
      } else if raw.starts(with: [0x1f, 0x8b]) { raw = try zip(raw, compressing: false) }
      guard let text = String(data: Data(raw), encoding: .utf8) else { throw ScriptUtilityError.invalidInput }
      return text
    }
    if operation == "randomBytes" {
      guard let count = input["count"] as? Int, count >= 0, count <= 65536 else { throw ScriptUtilityError.invalidInput }
      if count == 0 { return [Int]() }
      var value = [UInt8](repeating: 0, count: count)
      guard SecRandomCopyBytes(kSecRandomDefault, count, &value) == errSecSuccess else { throw ScriptUtilityError.cryptoFailed }
      return value.map(Int.init)
    }
    if operation == "decode" {
      guard let text = input["input"] as? String else { throw ScriptUtilityError.invalidInput }
      let encoding = (input["encoding"] as? String ?? "utf8").lowercased()
      switch encoding {
      case "base64":
        guard let data = Data(base64Encoded: text) else { throw ScriptUtilityError.invalidInput }
        return data.map(Int.init)
      case "binary", "latin1": return text.utf16.map { Int($0 & 255) }
      case "utf8", "utf-8": return Array(text.utf8).map(Int.init)
      default: throw ScriptUtilityError.unsupported
      }
    }
    let raw = try bytes(input["bytes"])
    switch operation {
    case "encode":
      switch (input["encoding"] as? String ?? "utf8").lowercased() {
      case "base64": return Data(raw).base64EncodedString()
      case "hex": return raw.map { String(format: "%02x", $0) }.joined()
      case "binary", "latin1": return String(raw.map { Character(UnicodeScalar(Int($0))!) })
      case "utf8", "utf-8": return String(decoding: raw, as: UTF8.self)
      default: throw ScriptUtilityError.unsupported
      }
    case "md5": return Insecure.MD5.hash(data: Data(raw)).map { String(format: "%02x", $0) }.joined()
    case "aesEncrypt": return try aes(raw, input).map(Int.init)
    case "rsaEncrypt": return try rsa(raw, input).map(Int.init)
    case "inflate": return try zip(raw, compressing: false).map(Int.init)
    case "deflate": return try zip(raw, compressing: true).map(Int.init)
    default: throw ScriptUtilityError.unsupported
    }
  }
  private static func aes(_ raw: [UInt8], _ input: [String: Any]) throws -> [UInt8] {
    let key = try bytes(input["key"]), iv = try bytes(input["iv"])
    guard key.count == kCCKeySizeAES128, let mode = input["mode"] as? String else { throw ScriptUtilityError.invalidInput }
    let options: CCOptions
    switch mode {
    case "aes-128-cbc":
      guard iv.count == kCCBlockSizeAES128 else { throw ScriptUtilityError.invalidInput }
      options = CCOptions(kCCOptionPKCS7Padding)
    case "aes-128-ecb":
      guard raw.count % kCCBlockSizeAES128 == 0 else { throw ScriptUtilityError.invalidInput }
      options = CCOptions(kCCOptionECBMode)
    default: throw ScriptUtilityError.unsupported
    }
    var output = [UInt8](repeating: 0, count: raw.count + kCCBlockSizeAES128), written = 0
    let capacity = output.count
    let status = output.withUnsafeMutableBytes { out in
      key.withUnsafeBytes { keyBytes in
        iv.withUnsafeBytes { ivBytes in
          raw.withUnsafeBytes { dataBytes in
            CCCrypt(CCOperation(kCCEncrypt), CCAlgorithm(kCCAlgorithmAES), options,
                    keyBytes.baseAddress, key.count, ivBytes.baseAddress,
                    dataBytes.baseAddress, raw.count, out.baseAddress, capacity, &written)
          }
        }
      }
    }
    guard status == kCCSuccess else { throw ScriptUtilityError.cryptoFailed }
    return Array(output.prefix(written))
  }
  // Accept PKCS#1 or SubjectPublicKeyInfo. Parse DER lengths instead of assuming
  // a fixed header size, so 1024/2048/4096-bit keys are handled consistently.
  private static func pkcs1(_ data: [UInt8]) throws -> Data {
    var index = 0
    func item() throws -> (UInt8, Range<Int>) {
      guard index + 2 <= data.count else { throw ScriptUtilityError.invalidInput }
      let tag = data[index]; index += 1
      var length = Int(data[index]); index += 1
      if length & 128 != 0 {
        let count = length & 127
        guard count > 0 && count <= 4 && index + count <= data.count else { throw ScriptUtilityError.invalidInput }
        length = 0
        for _ in 0..<count { length = length * 256 + Int(data[index]); index += 1 }
      }
      guard length <= data.count - index else { throw ScriptUtilityError.invalidInput }
      let range = index..<(index + length); index += length
      return (tag, range)
    }
    let outer = try item()
    guard outer.0 == 0x30 && index == data.count else { throw ScriptUtilityError.invalidInput }
    index = outer.1.lowerBound
    let first = try item()
    if first.0 == 0x02 { return Data(data) }
    guard first.0 == 0x30 else { throw ScriptUtilityError.invalidInput }
    let bitString = try item()
    guard bitString.0 == 0x03 && !bitString.1.isEmpty && data[bitString.1.lowerBound] == 0 else { throw ScriptUtilityError.invalidInput }
    return Data(data[(bitString.1.lowerBound + 1)..<bitString.1.upperBound])
  }
  private static func rsa(_ raw: [UInt8], _ input: [String: Any]) throws -> [UInt8] {
    guard let pem = input["key"] as? String else { throw ScriptUtilityError.invalidInput }
    let body = ["-----BEGIN PUBLIC KEY-----", "-----END PUBLIC KEY-----",
                "-----BEGIN RSA PUBLIC KEY-----", "-----END RSA PUBLIC KEY-----"].reduce(pem) {
      $0.replacingOccurrences(of: $1, with: "")
    }
    guard let der = Data(base64Encoded: body.filter { !$0.isWhitespace }) else { throw ScriptUtilityError.invalidInput }
    let attributes: [CFString: Any] = [kSecAttrKeyType: kSecAttrKeyTypeRSA, kSecAttrKeyClass: kSecAttrKeyClassPublic]
    guard let key = SecKeyCreateWithData(try pkcs1(Array(der)) as CFData, attributes as CFDictionary, nil) else { throw ScriptUtilityError.cryptoFailed }
    let size = SecKeyGetBlockSize(key)
    guard raw.count <= size && size <= 512 else { throw ScriptUtilityError.invalidInput }
    let padded = Data(repeating: 0, count: size - raw.count) + Data(raw)
    guard let result = SecKeyCreateEncryptedData(key, .rsaEncryptionRaw, padded as CFData, nil) else { throw ScriptUtilityError.cryptoFailed }
    return Array(result as Data)
  }
  private static func zip(_ raw: [UInt8], compressing: Bool) throws -> [UInt8] {
    var stream = z_stream()
    let initialized = compressing
      ? deflateInit_(&stream, Z_DEFAULT_COMPRESSION, ZLIB_VERSION, Int32(MemoryLayout<z_stream>.size))
      : inflateInit2_(&stream, 15 + 32, ZLIB_VERSION, Int32(MemoryLayout<z_stream>.size))
    guard initialized == Z_OK else { throw ScriptUtilityError.cryptoFailed }
    defer { if compressing { deflateEnd(&stream) } else { inflateEnd(&stream) } }
    return try raw.withUnsafeBytes { input in
      stream.next_in = UnsafeMutablePointer<Bytef>(mutating: input.bindMemory(to: Bytef.self).baseAddress)
      stream.avail_in = uInt(raw.count)
      var result = [UInt8](), status: Int32 = Z_OK
      repeat {
        var chunk = [UInt8](repeating: 0, count: 16384)
        let used = chunk.withUnsafeMutableBytes { output -> Int in
          stream.next_out = output.bindMemory(to: Bytef.self).baseAddress
          stream.avail_out = 16384
          status = compressing ? deflate(&stream, Z_FINISH) : inflate(&stream, Z_NO_FLUSH)
          return 16384 - Int(stream.avail_out)
        }
        guard status == Z_OK || status == Z_STREAM_END else { throw ScriptUtilityError.invalidInput }
        guard result.count + used <= maxBytes else { throw ScriptUtilityError.limitExceeded }
        result.append(contentsOf: chunk.prefix(used))
      } while status != Z_STREAM_END
      return result
    }
  }
}

// QRC uses a DES-EDE variant with custom permutations, key bit layout and
// two S-box changes. Wire constants are
// documented in THIRD_PARTY_NOTICES; this permutation implementation is original.
private enum QRCVariant {
  static let ip = [
  34, 42, 50, 58, 2, 10, 18, 26, 36, 44, 52, 60, 4, 12, 20, 28, 38, 46, 54, 62,
  6, 14, 22, 30, 40, 48, 56, 64, 8, 16, 24, 32, 33, 41, 49, 57, 1, 9, 17, 25,
  35, 43, 51, 59, 3, 11, 19, 27, 37, 45, 53, 61, 5, 13, 21, 29, 39, 47, 55, 63,
  7, 15, 23, 31,
]
  static let fp = [
  37, 5, 45, 13, 53, 21, 61, 29, 38, 6, 46, 14, 54, 22, 62, 30, 39, 7, 47, 15,
  55, 23, 63, 31, 40, 8, 48, 16, 56, 24, 64, 32, 33, 1, 41, 9, 49, 17, 57, 25,
  34, 2, 42, 10, 50, 18, 58, 26, 35, 3, 43, 11, 51, 19, 59, 27, 36, 4, 44, 12,
  52, 20, 60, 28,
]
  static let expansion = [32,1,2,3,4,5,4,5,6,7,8,9,8,9,10,11,12,13,12,13,14,15,16,17,16,17,18,19,20,21,20,21,22,23,24,25,24,25,26,27,28,29,28,29,30,31,32,1]
  static let p = [16,7,20,21,29,12,28,17,1,15,23,26,5,18,31,10,2,8,24,14,32,27,3,9,19,13,30,6,22,11,4,25]
  static let pc1 = [57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35,27,19,11,3,60,52,44,36,63,55,47,39,31,23,15,7,62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,28,20,12,4]
  static let pc2 = [14,17,11,24,1,5,3,28,15,6,21,10,23,19,12,4,26,8,16,7,27,20,13,2,41,52,31,37,47,55,30,40,51,45,33,48,44,49,39,56,34,53,46,42,50,36,29,32]
  static let rotations = [1,1,2,2,2,2,2,2,1,2,2,2,2,2,2,1]
  static let sbox: [[UInt32]] = [
  [
    14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7, 0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8,
    4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0, 15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13,
  ],
  [
    15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10, 3, 13, 4, 7, 15, 2, 8, 15, 12, 0, 1, 10, 6, 9, 11, 5,
    0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15, 13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9,
  ],
  [
    10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8, 13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1,
    13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7, 1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12,
  ],
  [
    7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15, 13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9,
    10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4, 3, 15, 0, 6, 10, 10, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14,
  ],
  [
    2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9, 14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6,
    4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14, 11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3,
  ],
  [
    12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11, 10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8,
    9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6, 4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13,
  ],
  [
    4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1, 13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6,
    1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2, 6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12,
  ],
  [
    13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7, 1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2,
    7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8, 2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11,
  ],
]
  static func permute(_ value: UInt64, bits: Int, table: [Int]) -> UInt64 {
    var result: UInt64 = 0
    for position in table { result = (result << 1) | (position<=bits ? ((value >> (bits-position)) & 1) : 0) }
    return result
  }
  static func subkeys(_ bytes: ArraySlice<UInt8>) -> [UInt64] {
    let original = Array(bytes), reordered = Array(original[0..<4].reversed()) + Array(original[4..<8].reversed())
    let key = reordered.reduce(UInt64(0)) { ($0 << 8) | UInt64($1) }
    let reduced = permute(key, bits: 64, table: pc1)
    var c = (reduced >> 28) & 0x0fffffff, d = reduced & 0x0fffffff, keys: [UInt64] = []
    for shift in rotations {
      c = ((c << shift) | (c >> (28-shift))) & 0x0fffffff
      d = ((d << shift) | (d >> (28-shift))) & 0x0fffffff
      keys.append(permute((c << 28) | d, bits: 56, table: pc2.enumerated().map { $0.offset < 24 ? $0.element : $0.element+1 }))
    }
    return keys
  }
  static func stage(_ input: UInt64, keys: [UInt64]) -> UInt64 {
    let initial = permute(input, bits: 64, table: ip)
    var left = UInt32(initial >> 32), right = UInt32(truncatingIfNeeded: initial)
    for key in keys {
      let expanded = permute(UInt64(right), bits: 32, table: expansion) ^ key
      var substituted: UInt32 = 0
      for index in 0..<8 {
        let six = Int((expanded >> (42-index*6)) & 63), row = ((six & 32) >> 4) | (six & 1), column = (six >> 1) & 15
        substituted = (substituted << 4) | sbox[index][row*16+column]
      }
      let next = left ^ UInt32(permute(UInt64(substituted), bits: 32, table: p))
      left = right; right = next
    }
    return permute((UInt64(right) << 32) | UInt64(left), bits: 64, table: fp)
  }
  static func decrypt(_ bytes: [UInt8]) throws -> [UInt8] {
    guard !bytes.isEmpty, bytes.count % 8 == 0, bytes.count <= 262144 else { throw ScriptUtilityError.invalidInput }
    let key = Array("!@#)(*$%123ZXC!@!@#)(NHL".utf8)
    let schedules = [Array(subkeys(key[16..<24]).reversed()), subkeys(key[8..<16]), Array(subkeys(key[0..<8]).reversed())]
    var result = [UInt8](); result.reserveCapacity(bytes.count)
    for offset in stride(from: 0, to: bytes.count, by: 8) {
      var block = bytes[offset..<offset+8].reduce(UInt64(0)) { ($0 << 8) | UInt64($1) }
      for keys in schedules { block = stage(block, keys: keys) }
      for shift in stride(from: 56, through: 0, by: -8) { result.append(UInt8((block >> shift) & 255)) }
    }
    return result
  }
}
