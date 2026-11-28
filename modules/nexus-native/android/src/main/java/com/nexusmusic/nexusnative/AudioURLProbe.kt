package com.nexusmusic.nexusnative

import okhttp3.Call
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.ByteArrayOutputStream
import java.net.SocketTimeoutException
import java.net.URI
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * 1:1 Android parity implementation of iOS AudioURLProbe.swift.
 * Bounded 4 KiB Range check with redirect/downgrade/Content-Range validation and audio magic detection.
 */
internal class AudioURLProbe {
  private val client = OkHttpClient.Builder()
    .cache(null)
    .followRedirects(false)
    .followSslRedirects(false)
    .connectTimeout(8, TimeUnit.SECONDS)
    .readTimeout(8, TimeUnit.SECONDS)
    .callTimeout(12, TimeUnit.SECONDS)
    .build()

  private val cancelled = AtomicBoolean(false)
  @Volatile private var currentCall: Call? = null

  fun cancel() {
    cancelled.set(true)
    currentCall?.cancel()
  }

  fun probe(rawUrl: String): Map<String, Any> {
    if (cancelled.get()) return mapOf("state" to "cancelled", "bytes" to 0)
    if (!allowed(rawUrl)) return mapOf("state" to "invalid-url", "bytes" to 0)

    var url = rawUrl
    var redirects = 0
    var lastStatus = 0
    var useRange = true
    var retriedWithoutRange = false
    val collected = ByteArrayOutputStream()

    try {
      while (true) {
        if (cancelled.get()) return buildResult("cancelled", collected.size(), lastStatus)
        val reqBuilder = Request.Builder()
          .url(url)
          .get()
          .header("Accept-Encoding", "identity")
          .header("User-Agent", USER_AGENT)
        if (useRange) {
          reqBuilder.header("Range", "bytes=0-4095")
        }
        val req = reqBuilder.build()
        val call = client.newCall(req)
        currentCall = call
        call.execute().use { resp ->
          lastStatus = resp.code
          if (resp.code in setOf(301, 302, 303, 307, 308)) {
            redirects++
            val location = resp.header("Location")
            if (redirects > 5 || location.isNullOrBlank()) {
              return buildResult("redirect-error", collected.size(), lastStatus)
            }
            val nextUrl = try {
              URI(url).resolve(location).toString()
            } catch (_: Throwable) {
              return buildResult("redirect-error", collected.size(), lastStatus)
            }
            // Public music CDN resolvers routinely 302 from HTTPS API gateways to HTTP audio edge nodes.
            // This probe sends zero cookies or Authorization headers, matching iOS AudioURLProbe.swift.
            if (!allowed(nextUrl)) {
              return buildResult("redirect-error", collected.size(), lastStatus)
            }
            url = nextUrl
            return@use
          }

          if (resp.code == 416 && !retriedWithoutRange) {
            retriedWithoutRange = true
            useRange = false
            lastStatus = 0
            collected.reset()
            return@use
          }

          if (resp.code != 200 && resp.code != 206) {
            return buildResult("http-error", collected.size(), lastStatus)
          }

          if (resp.code == 206) {
            val contentRange = (resp.header("Content-Range") ?: "").trim()
            val match = CONTENT_RANGE_REGEX.matchEntire(contentRange)
              ?: return buildResult("range-error", collected.size(), lastStatus)
            val end = match.groupValues[1].toLongOrNull() ?: return buildResult("range-error", collected.size(), lastStatus)
            val totalStr = match.groupValues[2]
            if (end < 0 || (totalStr != "*" && (totalStr.toLongOrNull()?.let { it <= end } != false))) {
              return buildResult("range-error", collected.size(), lastStatus)
            }
          }

          val stream = resp.body?.byteStream()
          if (stream != null) {
            val buf = ByteArray(1024)
            while (collected.size() < 4096) {
              if (cancelled.get()) return buildResult("cancelled", collected.size(), lastStatus)
              val remaining = 4096 - collected.size()
              val n = stream.read(buf, 0, minOf(buf.size, remaining))
              if (n <= 0) break
              collected.write(buf, 0, n)
              val format = mediaHeader(collected.toByteArray())
              if (format != null) {
                call.cancel()
                return buildResult("header", collected.size(), lastStatus, format)
              }
            }
          }
          val finalFormat = mediaHeader(collected.toByteArray())
          return if (finalFormat != null) {
            buildResult("header", collected.size(), lastStatus, finalFormat)
          } else {
            buildResult("unrecognized", collected.size(), lastStatus)
          }
        }
      }
    } catch (t: Throwable) {
      if (cancelled.get()) return buildResult("cancelled", collected.size(), lastStatus)
      val state = if (t is SocketTimeoutException || t.message?.contains("timeout", true) == true) {
        "timeout"
      } else {
        "network-error"
      }
      return buildResult(state, collected.size(), lastStatus)
    } finally {
      currentCall = null
    }
  }

  private fun buildResult(state: String, bytes: Int, status: Int, format: String? = null): Map<String, Any> {
    val map = mutableMapOf<String, Any>("state" to state, "bytes" to bytes)
    if (status > 0) map["status"] = status
    if (format != null) map["format"] = format
    return map
  }

  companion object {
    private const val USER_AGENT =
      "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"
    private val CONTENT_RANGE_REGEX = Regex("^bytes\\s+0-([0-9]+)/([0-9]+|\\*)$", RegexOption.IGNORE_CASE)

    fun allowed(raw: String): Boolean {
      if (raw.toByteArray().size > 8192) return false
      return try {
        val uri = URI(raw)
        val scheme = uri.scheme?.lowercase()
        (scheme == "http" || scheme == "https") &&
          !uri.host.isNullOrBlank() &&
          uri.userInfo == null
      } catch (_: Throwable) {
        false
      }
    }

    fun mediaHeader(b: ByteArray): String? {
      fun has(text: String, offset: Int = 0): Boolean {
        if (b.size < offset + text.length) return false
        for (i in text.indices) {
          if (b[offset + i] != text[i].code.toByte()) return false
        }
        return true
      }
      if (has("fLaC")) return "flac"
      if (has("RIFF") && has("WAVE", 8)) return "wav"
      if (has("FORM") && (has("AIFF", 8) || has("AIFC", 8))) return "aiff"
      if (has("OggS")) return "ogg"
      if (has("ftyp", 4)) return "mp4"
      if (b.size >= 10 && has("ID3") && (b[3].toInt() and 0xFF) in 2..4) return "id3"
      if (b.size >= 4 && (b[0].toInt() and 0xFF) == 255 && ((b[1].toInt() and 0xF6) == 0xF0)) return "aac"
      if (b.size >= 4 && (b[0].toInt() and 0xFF) == 255 &&
        ((b[1].toInt() and 0xE0) == 0xE0) &&
        ((b[1].toInt() and 6) != 0) &&
        ((b[2].toInt() and 0xF0) != 0xF0) &&
        ((b[2].toInt() and 0x0C) != 0x0C)
      ) return "mpeg"
      return null
    }
  }
}
