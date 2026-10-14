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
