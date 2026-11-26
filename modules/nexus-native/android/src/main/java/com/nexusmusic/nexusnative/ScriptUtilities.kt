package com.nexusmusic.nexusnative

import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.math.BigInteger
import java.nio.charset.StandardCharsets
import java.security.KeyFactory
import java.security.MessageDigest
import java.security.SecureRandom
import java.security.interfaces.RSAPublicKey
import java.security.spec.RSAPublicKeySpec
import java.security.spec.X509EncodedKeySpec
import java.util.zip.Deflater
import java.util.zip.GZIPInputStream
import java.util.zip.Inflater
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * 1:1 Android parity implementation of iOS ScriptUtilities.swift.
 * Supports all 12 LX utility operations including QRC DES-EDE variant, KRC,
 * gzip/zlib inflate & deflate, AES-128-CBC/ECB, and raw RSA (PKCS#1 / SPKI).
 */
internal object ScriptUtilities {
  private const val MAX_BYTES = 8 * 1024 * 1024
  private val secureRandom = SecureRandom()

  fun call(operation: String, inputJson: String): String {
    return try {
      if (inputJson.toByteArray(StandardCharsets.UTF_8).size > MAX_BYTES * 5) {
        throw IllegalArgumentException("limit")
      }
      val input = JSONObject(inputJson)
      val value = perform(operation, input)
      JSONObject().put("value", value).toString()
    } catch (_: Throwable) {
      JSONObject().put("error", "Invalid or unsupported utility operation").toString()
    }
  }

  fun bytesFromJson(any: Any?): ByteArray {
    if (any !is JSONArray) throw IllegalArgumentException("invalid bytes")
    val len = any.length()
    if (len > MAX_BYTES) throw IllegalArgumentException("limit")
    val out = ByteArray(len)
    for (i in 0 until len) {
      val v = any.optInt(i, -1)
      if (v < 0 || v > 255) throw IllegalArgumentException("byte range")
      out[i] = v.toByte()
    }
    return out
  }

  fun toJsonByteArray(bytes: ByteArray): JSONArray {
    val arr = JSONArray()
    for (b in bytes) arr.put(b.toInt() and 0xFF)
    return arr
  }

  fun perform(operation: String, input: JSONObject): Any {
    when (operation) {
      "qrcDecode" -> {
        val hex = input.optString("input", "")
        if (hex.isEmpty() || hex.length > 524_288 || hex.length % 16 != 0) {
          throw IllegalArgumentException("invalid qrc hex")
        }
        val data = ByteArray(hex.length / 2)
        for (i in data.indices) {
          val hi = nibble(hex[i * 2])
          val lo = nibble(hex[i * 2 + 1])
          data[i] = ((hi shl 4) or lo).toByte()
        }
        val decrypted = QRCVariant.decrypt(data)
        val inflated = inflateAuto(decrypted)
        return String(inflated, StandardCharsets.UTF_8)
      }

      "importText", "krcDecode" -> {
        val b64 = input.optString("input", "")
        if (b64.length > MAX_BYTES * 2) throw IllegalArgumentException("limit")
        val decoded = Base64.decode(b64, Base64.DEFAULT)
        if (decoded.size > MAX_BYTES) throw IllegalArgumentException("limit")
        val raw = when {
          operation == "krcDecode" -> {
            if (decoded.size < 4 ||
              decoded[0] != 'k'.code.toByte() ||
              decoded[1] != 'r'.code.toByte() ||
              decoded[2] != 'c'.code.toByte() ||
              decoded[3] != '1'.code.toByte()
            ) {
              throw IllegalArgumentException("invalid krc header")
            }
            val key = byteArrayOf(
              64, 71, 97, 119, 94, 50, 116, 71,
              81, 54, 49, 45, 206.toByte(), 210.toByte(), 110, 105
            )
            val xored = ByteArray(decoded.size - 4)
            for (i in xored.indices) {
              xored[i] = (decoded[i + 4].toInt() xor key[i % key.size].toInt()).toByte()
            }
            inflateAuto(xored)
          }
          decoded.size >= 2 && decoded[0] == 0x1f.toByte() && decoded[1] == 0x8b.toByte() -> {
            inflateAuto(decoded)
          }
          else -> decoded
        }
        return String(raw, StandardCharsets.UTF_8)
      }

      "randomBytes" -> {
        val count = input.optInt("count", -1)
        if (count < 0 || count > 65_536) throw IllegalArgumentException("invalid count")
        val out = ByteArray(count)
        if (count > 0) secureRandom.nextBytes(out)
        return toJsonByteArray(out)
      }

      "decode" -> {
        if (!input.has("input") || input.isNull("input")) throw IllegalArgumentException("missing input")
        val text = input.getString("input")
        val encoding = input.optString("encoding", "utf8").lowercase()
        val bytes = when (encoding) {
          "base64" -> Base64.decode(text, Base64.DEFAULT)
          "binary", "latin1" -> ByteArray(text.length) { i -> (text[i].code and 0xFF).toByte() }
          "utf8", "utf-8" -> text.toByteArray(StandardCharsets.UTF_8)
          else -> throw UnsupportedOperationException("unsupported encoding")
        }
        return toJsonByteArray(bytes)
      }
    }

    val raw = bytesFromJson(input.opt("bytes"))
    return when (operation) {
      "encode" -> {
        when (input.optString("encoding", "utf8").lowercase()) {
          "base64" -> Base64.encodeToString(raw, Base64.NO_WRAP)
          "hex" -> raw.joinToString("") { "%02x".format(it.toInt() and 0xFF) }
          "binary", "latin1" -> String(CharArray(raw.size) { i -> (raw[i].toInt() and 0xFF).toChar() })
          "utf8", "utf-8" -> String(raw, StandardCharsets.UTF_8)
          else -> throw UnsupportedOperationException("unsupported encoding")
        }
      }
      "md5" -> {
        val digest = MessageDigest.getInstance("MD5").digest(raw)
        digest.joinToString("") { "%02x".format(it.toInt() and 0xFF) }
      }
      "aesEncrypt" -> toJsonByteArray(aesEncrypt(raw, input))
      "rsaEncrypt" -> toJsonByteArray(rsaEncrypt(raw, input))
      "inflate" -> toJsonByteArray(inflateAuto(raw))
      "deflate" -> toJsonByteArray(deflateZlib(raw))
      else -> throw UnsupportedOperationException("unsupported operation")
    }
  }

  private fun nibble(ch: Char): Int = when (ch) {
    in '0'..'9' -> ch.code - '0'.code
    in 'A'..'F' -> ch.code - 'A'.code + 10
    in 'a'..'f' -> ch.code - 'a'.code + 10
    else -> throw IllegalArgumentException("invalid hex char")
  }

  private fun aesEncrypt(raw: ByteArray, input: JSONObject): ByteArray {
    val key = bytesFromJson(input.opt("key"))
    val iv = bytesFromJson(input.opt("iv"))
    val mode = input.optString("mode", "")
    if (key.size != 16) throw IllegalArgumentException("key size")
    val keySpec = SecretKeySpec(key, "AES")
    return when (mode) {
      "aes-128-cbc" -> {
        if (iv.size != 16) throw IllegalArgumentException("iv size")
        val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
        cipher.init(Cipher.ENCRYPT_MODE, keySpec, IvParameterSpec(iv))
        cipher.doFinal(raw)
      }
      "aes-128-ecb" -> {
        if (raw.size % 16 != 0) throw IllegalArgumentException("ecb block align")
        val cipher = Cipher.getInstance("AES/ECB/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, keySpec)
        cipher.doFinal(raw)
      }
      else -> throw UnsupportedOperationException("unsupported aes mode")
    }
  }

  private fun rsaEncrypt(raw: ByteArray, input: JSONObject): ByteArray {
    val pem = input.optString("key", "")
    if (pem.isEmpty()) throw IllegalArgumentException("missing key")
    val stripped = pem
      .replace("-----BEGIN PUBLIC KEY-----", "")
      .replace("-----END PUBLIC KEY-----", "")
      .replace("-----BEGIN RSA PUBLIC KEY-----", "")
      .replace("-----END RSA PUBLIC KEY-----", "")
      .filterNot { it.isWhitespace() }
    val der = Base64.decode(stripped, Base64.DEFAULT)
    val pubKey = parseRsaPublicKey(der)
    val keySize = (pubKey.modulus.bitLength() + 7) / 8
    if (raw.size > keySize || keySize > 512) throw IllegalArgumentException("rsa input length")
    val padded = ByteArray(keySize)
    System.arraycopy(raw, 0, padded, keySize - raw.size, raw.size)
    // Raw RSA textbook exponentiation: m^e mod n (matches iOS .rsaEncryptionRaw)
    val m = BigInteger(1, padded)
    val c = m.modPow(pubKey.publicExponent, pubKey.modulus)
    val encoded = c.toByteArray()
    val result = ByteArray(keySize)
    if (encoded.size >= keySize) {
      System.arraycopy(encoded, encoded.size - keySize, result, 0, keySize)
    } else {
      System.arraycopy(encoded, 0, result, keySize - encoded.size, encoded.size)
    }
    return result
  }

  private fun parseRsaPublicKey(der: ByteArray): RSAPublicKey {
    // Try standard X.509 SubjectPublicKeyInfo first
    try {
      val kf = KeyFactory.getInstance("RSA")
      return kf.generatePublic(X509EncodedKeySpec(der)) as RSAPublicKey
    } catch (_: Throwable) {
      // Fallback: PKCS#1 RSAPublicKey SEQUENCE { modulus INTEGER, publicExponent INTEGER }
      val reader = DerReader(der)
      val seq = reader.readTag(0x30)
      if (!reader.eof()) throw IllegalArgumentException("trailing der bytes")
      val inner = DerReader(seq)
      val modulus = BigInteger(1, inner.readTag(0x02))
      val exponent = BigInteger(1, inner.readTag(0x02))
      return KeyFactory.getInstance("RSA").generatePublic(RSAPublicKeySpec(modulus, exponent)) as RSAPublicKey
    }
  }

  private class DerReader(private val data: ByteArray) {
    private var idx = 0
    fun eof(): Boolean = idx >= data.size
    fun readTag(expected: Int): ByteArray {
      if (idx + 2 > data.size) throw IllegalArgumentException("der eof")
      val tag = data[idx++].toInt() and 0xFF
      if (tag != expected) throw IllegalArgumentException("der tag mismatch")
      var len = data[idx++].toInt() and 0xFF
      if ((len and 0x80) != 0) {
        val count = len and 0x7F
        if (count <= 0 || count > 4 || idx + count > data.size) throw IllegalArgumentException("der len")
        len = 0
        for (i in 0 until count) {
          len = (len shl 8) or (data[idx++].toInt() and 0xFF)
        }
      }
      if (len < 0 || idx + len > data.size) throw IllegalArgumentException("der range")
      val slice = data.copyOfRange(idx, idx + len)
      idx += len
      return slice
    }
  }

  fun inflateAuto(raw: ByteArray): ByteArray {
    if (raw.size >= 2 && raw[0] == 0x1f.toByte() && raw[1] == 0x8b.toByte()) {
      GZIPInputStream(ByteArrayInputStream(raw)).use { gis ->
        val out = ByteArrayOutputStream()
        val buf = ByteArray(16_384)
        var total = 0
        while (true) {
          val n = gis.read(buf)
          if (n <= 0) break
          total += n
          if (total > MAX_BYTES) throw IllegalStateException("inflate limit")
          out.write(buf, 0, n)
        }
        return out.toByteArray()
      }
    }
    return try {
      inflateZlib(raw, nowrap = false)
    } catch (_: Throwable) {
      inflateZlib(raw, nowrap = true)
    }
  }

  private fun inflateZlib(raw: ByteArray, nowrap: Boolean): ByteArray {
    val inflater = Inflater(nowrap)
    inflater.setInput(raw)
    val out = ByteArrayOutputStream()
    val buf = ByteArray(16_384)
    var total = 0
    try {
      while (!inflater.finished()) {
        val n = inflater.inflate(buf)
        if (n == 0) {
          if (inflater.needsInput() || inflater.needsDictionary()) {
            if (total == 0) throw IllegalArgumentException("invalid zlib stream")
            break
          }
        } else {
          total += n
          if (total > MAX_BYTES) throw IllegalStateException("inflate limit")
          out.write(buf, 0, n)
        }
      }
      return out.toByteArray()
    } finally {
      inflater.end()
    }
  }

  fun deflateZlib(raw: ByteArray): ByteArray {
    val deflater = Deflater()
    deflater.setInput(raw)
    deflater.finish()
    val out = ByteArrayOutputStream()
    val buf = ByteArray(16_384)
    var total = 0
    try {
      while (!deflater.finished()) {
        val n = deflater.deflate(buf)
        if (n > 0) {
          total += n
          if (total > MAX_BYTES) throw IllegalStateException("deflate limit")
          out.write(buf, 0, n)
        }
      }
      return out.toByteArray()
    } finally {
      deflater.end()
    }
  }

  /** Original QRC DES-EDE variant matching ScriptUtilities.swift byte-for-byte. */
  private object QRCVariant {
    private val ip = intArrayOf(
      34, 42, 50, 58, 2, 10, 18, 26, 36, 44, 52, 60, 4, 12, 20, 28, 38, 46, 54, 62,
      6, 14, 22, 30, 40, 48, 56, 64, 8, 16, 24, 32, 33, 41, 49, 57, 1, 9, 17, 25,
      35, 43, 51, 59, 3, 11, 19, 27, 37, 45, 53, 61, 5, 13, 21, 29, 39, 47, 55, 63,
      7, 15, 23, 31
    )
    private val fp = intArrayOf(
      37, 5, 45, 13, 53, 21, 61, 29, 38, 6, 46, 14, 54, 22, 62, 30, 39, 7, 47, 15,
      55, 23, 63, 31, 40, 8, 48, 16, 56, 24, 64, 32, 33, 1, 41, 9, 49, 17, 57, 25,
      34, 2, 42, 10, 50, 18, 58, 26, 35, 3, 43, 11, 51, 19, 59, 27, 36, 4, 44, 12,
      52, 20, 60, 28
    )
    private val expansion = intArrayOf(
      32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9, 8, 9, 10, 11, 12, 13, 12, 13, 14, 15, 16, 17,
      16, 17, 18, 19, 20, 21, 20, 21, 22, 23, 24, 25, 24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1
    )
    private val p = intArrayOf(
      16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10,
      2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25
    )
    private val pc1 = intArrayOf(
      57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18, 10, 2,
      59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36, 63, 55, 47, 39,
      31, 23, 15, 7, 62, 54, 46, 38, 30, 22, 14, 6, 61, 53, 45, 37,
      29, 21, 13, 5, 28, 20, 12, 4
    )
    private val pc2 = intArrayOf(
      14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10, 23, 19, 12, 4,
      26, 8, 16, 7, 27, 20, 13, 2, 41, 52, 31, 37, 47, 55, 30, 40,
      51, 45, 33, 48, 44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32
    )
    private val pc2Adjusted = IntArray(pc2.size) { idx -> if (idx < 24) pc2[idx] else pc2[idx] + 1 }
    private val rotations = intArrayOf(1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1)
    private val sbox = arrayOf(
      intArrayOf(
        14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7, 0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8,
        4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0, 15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13
      ),
      intArrayOf(
        15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10, 3, 13, 4, 7, 15, 2, 8, 15, 12, 0, 1, 10, 6, 9, 11, 5,
        0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15, 13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9
      ),
      intArrayOf(
        10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8, 13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1,
        13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7, 1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12
      ),
      intArrayOf(
        7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15, 13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9,
        10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4, 3, 15, 0, 6, 10, 10, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14
      ),
      intArrayOf(
        2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9, 14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6,
        4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14, 11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3
      ),
      intArrayOf(
        12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11, 10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8,
        9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6, 4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13
      ),
      intArrayOf(
        4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1, 13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6,
        1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2, 6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12
      ),
      intArrayOf(
        13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7, 1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2,
        7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8, 2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11
      )
    )

    private fun permute(value: Long, bits: Int, table: IntArray): Long {
      var result = 0L
      for (pos in table) {
        val bit = if (pos <= bits) (value ushr (bits - pos)) and 1L else 0L
        result = (result shl 1) or bit
      }
      return result
    }

    private fun subkeys(bytes: ByteArray, offset: Int): LongArray {
      val reordered = byteArrayOf(
        bytes[offset + 3], bytes[offset + 2], bytes[offset + 1], bytes[offset + 0],
        bytes[offset + 7], bytes[offset + 6], bytes[offset + 5], bytes[offset + 4]
      )
      var key = 0L
      for (b in reordered) key = (key shl 8) or (b.toLong() and 0xFFL)
      val reduced = permute(key, 64, pc1)
      var c = (reduced ushr 28) and 0x0FFFFFFFL
      var d = reduced and 0x0FFFFFFFL
      return LongArray(16) { idx ->
        val shift = rotations[idx]
        c = ((c shl shift) or (c ushr (28 - shift))) and 0x0FFFFFFFL
        d = ((d shl shift) or (d ushr (28 - shift))) and 0x0FFFFFFFL
        permute((c shl 28) or d, 56, pc2Adjusted)
      }
    }

    private fun stage(input: Long, keys: LongArray): Long {
      val initial = permute(input, 64, ip)
      var left = (initial ushr 32) and 0xFFFFFFFFL
      var right = initial and 0xFFFFFFFFL
      for (key in keys) {
        val expanded = permute(right, 32, expansion) xor key
        var substituted = 0L
        for (idx in 0 until 8) {
          val six = ((expanded ushr (42 - idx * 6)) and 63L).toInt()
          val row = ((six and 32) ushr 4) or (six and 1)
          val col = (six ushr 1) and 15
          substituted = (substituted shl 4) or sbox[idx][row * 16 + col].toLong()
        }
        val next = left xor (permute(substituted, 32, p) and 0xFFFFFFFFL)
        left = right
        right = next
      }
      return permute((right shl 32) or left, 64, fp)
    }

    fun decrypt(bytes: ByteArray): ByteArray {
      if (bytes.isEmpty() || bytes.size % 8 != 0 || bytes.size > 262_144) {
        throw IllegalArgumentException("invalid qrc bytes")
      }
      val key = "!@#)(*$%123ZXC!@!@#)(NHL".toByteArray(StandardCharsets.UTF_8)
      val schedules = arrayOf(
        subkeys(key, 16).reversedArray(),
        subkeys(key, 8),
        subkeys(key, 0).reversedArray()
      )
      val result = ByteArray(bytes.size)
      var offset = 0
      while (offset < bytes.size) {
        var block = 0L
        for (i in 0 until 8) {
          block = (block shl 8) or (bytes[offset + i].toLong() and 0xFFL)
        }
        for (keys in schedules) {
          block = stage(block, keys)
        }
        for (i in 0 until 8) {
          result[offset + i] = ((block ushr (56 - i * 8)) and 0xFFL).toByte()
        }
        offset += 8
      }
      return result
    }
  }
}
