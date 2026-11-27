package com.nexusmusic.nexusnative

import android.util.Base64
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.URI
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import kotlin.math.max
import kotlin.math.min

/**
 * 1:1 Android parity implementation of iOS ScriptHTTP.swift.
 * Ephemeral HTTP client (no cookies, no cache), bounded 8 MiB streaming body guard,
 * JSON/form/multipart/binary request & response encoding, per-request abort & timeout.
 */
internal class ScriptHTTP(private val maxBytes: Int = MAX_BYTES) {
  companion object {
    private const val MAX_BYTES = 8 * 1024 * 1024
    private const val MAX_CONCURRENT = 16
  }

  private val baseClient = OkHttpClient.Builder()
    .cache(null)
    .connectTimeout(20, TimeUnit.SECONDS)
    .readTimeout(20, TimeUnit.SECONDS)
    .writeTimeout(20, TimeUnit.SECONDS)
    .callTimeout(60, TimeUnit.SECONDS)
    .build()

  private val calls = ConcurrentHashMap<Int, Call>()
  @Volatile private var destroyed = false

  fun start(
    id: Int,
    url: String,
    optionsJson: String,
    completion: (error: String?, responseJson: String?) -> Unit
  ) {
    if (destroyed) {
      completion("HTTP_REQUEST_FAILED", null)
      return
    }
    try {
      if (calls.size >= MAX_CONCURRENT) throw IllegalStateException("limit")
      val uri = URI(url)
      val scheme = uri.scheme?.lowercase() ?: ""
      if (scheme != "http" && scheme != "https" || uri.host.isNullOrBlank()) {
        throw IllegalArgumentException("invalid url")
      }
      val options = if (optionsJson.isBlank()) JSONObject() else JSONObject(optionsJson)
      val method = options.optString("method", "GET").uppercase()
      val timeoutMs = min(60_000L, max(100L, options.optDouble("timeout", 20_000.0).toLong()))
      val binary = options.optBoolean("binary", false)

      val reqBuilder = Request.Builder().url(url)
      var explicitContentType: String? = null
      val headers = options.optJSONObject("headers")
      if (headers != null) {
        val keys = headers.keys()
        while (keys.hasNext()) {
          val k = keys.next()
          val v = headers.opt(k)?.toString() ?: continue
          if (k.equals("content-type", ignoreCase = true)) explicitContentType = v
          reqBuilder.header(k, v)
        }
      }

      var bodyBytes: ByteArray? = null
      var bodyContentType: String? = explicitContentType

      when {
        options.has("body") && !options.isNull("body") -> {
          val bodyObj = options.get("body")
          when (bodyObj) {
            is String -> bodyBytes = bodyObj.toByteArray(StandardCharsets.UTF_8)
            is JSONArray -> {
              if (isByteList(bodyObj)) {
                bodyBytes = ScriptUtilities.bytesFromJson(bodyObj)
              } else {
                bodyBytes = bodyObj.toString().toByteArray(StandardCharsets.UTF_8)
                if (bodyContentType == null) bodyContentType = "application/json"
              }
            }
            else -> {
              bodyBytes = bodyObj.toString().toByteArray(StandardCharsets.UTF_8)
              if (bodyContentType == null) bodyContentType = "application/json"
            }
          }
        }
        options.optJSONObject("form") != null -> {
          val form = options.getJSONObject("form")
          val encoded = form.keys().asSequence().sorted().joinToString("&") { k ->
            "${percentEncode(k)}=${percentEncode(form.opt(k)?.toString() ?: "")}"
          }
          bodyBytes = encoded.toByteArray(StandardCharsets.UTF_8)
          bodyContentType = "application/x-www-form-urlencoded"
        }
        options.optJSONObject("formData") != null -> {
          val formData = options.getJSONObject("formData")
          val boundary = "Nexus-${UUID.randomUUID()}"
          val bos = ByteArrayOutputStream()
          for (key in formData.keys().asSequence().sorted()) {
            if (key.any { it == '\r' || it == '\n' || it == '"' }) {
              throw IllegalArgumentException("invalid form key")
            }
            var value: Any = formData.get(key)
            var filename: String? = null
            var contentType = "application/octet-stream"
            if (value is JSONObject && value.has("value")) {
              value = value.get("value")
              val meta = (formData.get(key) as JSONObject).optJSONObject("options")
              if (meta != null) {
                if (meta.has("filename") && !meta.isNull("filename")) filename = meta.getString("filename")
                if (meta.has("contentType") && !meta.isNull("contentType")) contentType = meta.getString("contentType")
              }
            }
            if ((filename ?: "").any { it == '\r' || it == '\n' || it == '"' } ||
              contentType.any { it == '\r' || it == '\n' }
            ) {
              throw IllegalArgumentException("invalid multipart metadata")
            }
            val header = buildString {
              append("--").append(boundary).append("\r\n")
              append("Content-Disposition: form-data; name=\"").append(key).append("\"")
              if (filename != null) {
                append("; filename=\"").append(filename).append("\"\r\n")
                append("Content-Type: ").append(contentType)
              }
              append("\r\n\r\n")
            }
            bos.write(header.toByteArray(StandardCharsets.UTF_8))
            if (value is JSONArray && isByteList(value)) {
              bos.write(ScriptUtilities.bytesFromJson(value))
            } else {
              bos.write(value.toString().toByteArray(StandardCharsets.UTF_8))
            }
            bos.write("\r\n".toByteArray(StandardCharsets.UTF_8))
            if (bos.size() > maxBytes) throw IllegalStateException("limit")
          }
          bos.write("--$boundary--\r\n".toByteArray(StandardCharsets.UTF_8))
          bodyBytes = bos.toByteArray()
          bodyContentType = "multipart/form-data; boundary=$boundary"
        }
      }

      if (bodyBytes != null && bodyBytes.size > maxBytes) {
        throw IllegalStateException("limit")
      }

      val requestBody: RequestBody? = when {
        bodyBytes != null -> bodyBytes.toRequestBody(bodyContentType?.toMediaTypeOrNull())
        method == "POST" || method == "PUT" || method == "PATCH" -> ByteArray(0).toRequestBody(bodyContentType?.toMediaTypeOrNull())
        else -> null
      }
      if (bodyContentType != null && explicitContentType == null) {
        reqBuilder.header("Content-Type", bodyContentType)
      }
      reqBuilder.method(method, requestBody)

      val client = baseClient.newBuilder()
        .connectTimeout(timeoutMs, TimeUnit.MILLISECONDS)
        .readTimeout(timeoutMs, TimeUnit.MILLISECONDS)
        .writeTimeout(timeoutMs, TimeUnit.MILLISECONDS)
        .callTimeout(max(timeoutMs, 100L), TimeUnit.MILLISECONDS)
        .build()

      val call = client.newCall(reqBuilder.build())
      calls[id] = call
      call.enqueue(object : Callback {
        override fun onFailure(call: Call, e: IOException) {
          val removed = calls.remove(id)
          if (removed == null || destroyed) return
          completion("HTTP_REQUEST_FAILED", null)
        }

        override fun onResponse(call: Call, response: Response) {
          response.use { resp ->
            if (calls[id] !== call || destroyed) return
            val contentLength = resp.body?.contentLength() ?: -1L
            if (contentLength > maxBytes) {
              calls.remove(id)
              completion("HTTP_RESPONSE_TOO_LARGE", null)
              return
            }
            val bos = ByteArrayOutputStream()
            val stream = resp.body?.byteStream()
            if (stream != null) {
              val buf = ByteArray(16_384)
              try {
                while (true) {
                  val n = stream.read(buf)
                  if (n <= 0) break
                  if (bos.size() + n > maxBytes) {
                    calls.remove(id)
                    call.cancel()
                    completion("HTTP_RESPONSE_TOO_LARGE", null)
                    return
                  }
                  bos.write(buf, 0, n)
                }
              } catch (_: IOException) {
                val removed = calls.remove(id)
                if (removed != null && !destroyed) completion("HTTP_REQUEST_FAILED", null)
                return
              }
            }
            val removed = calls.remove(id)
            if (removed == null || destroyed) return
            val bytes = bos.toByteArray()
            val respObj = JSONObject()
            respObj.put("statusCode", resp.code)
            respObj.put("statusMessage", resp.message)
            val hdrs = JSONObject()
            for (name in resp.headers.names()) {
              hdrs.put(name.lowercase(), resp.headers.values(name).joinToString(", "))
            }
            respObj.put("headers", hdrs)
            respObj.put("__binary", binary)
            if (binary) {
              respObj.put("body", Base64.encodeToString(bytes, Base64.NO_WRAP))
            } else {
              val text = String(bytes, StandardCharsets.UTF_8)
              val parsed = try {
                val trimmed = text.trim()
                if (trimmed.isNotEmpty() && (trimmed.startsWith("{") || trimmed.startsWith("["))) {
                  JSONTokener(trimmed).nextValue()
                } else {
                  text
                }
              } catch (_: Throwable) {
                text
              }
              respObj.put("body", parsed)
            }
            completion(null, respObj.toString())
          }
        }
      })
    } catch (_: Throwable) {
      completion("HTTP_REQUEST_INVALID", null)
    }
  }

  fun cancel(id: Int) {
    calls.remove(id)?.cancel()
  }

  fun destroy() {
    destroyed = true
    val active = calls.values.toList()
    calls.clear()
    active.forEach { it.cancel() }
  }

  private fun isByteList(arr: JSONArray): Boolean {
    val n = arr.length()
    for (i in 0 until n) {
      val item = arr.opt(i)
      if (item !is Int || item < 0 || item > 255) return false
    }
    return n > 0
  }

  private fun percentEncode(value: String): String {
    return URLEncoder.encode(value, "UTF-8").replace("+", "%20").replace("*", "%2A").replace("%7E", "~")
  }
}
