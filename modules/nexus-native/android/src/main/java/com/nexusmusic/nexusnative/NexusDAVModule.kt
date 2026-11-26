package com.nexusmusic.nexusnative

import android.media.MediaMetadataRetriever
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import okhttp3.Call
import okhttp3.Credentials
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.io.FileOutputStream
import java.net.URI
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

/**
 * 1:1 Android parity implementation of iOS NexusDAVModule (all 5 methods including remote audio inspect).
 */
class NexusDAVModule : Module() {
  private val client = OkHttpClient.Builder()
    .connectTimeout(20, TimeUnit.SECONDS)
    .readTimeout(30, TimeUnit.SECONDS)
    .writeTimeout(30, TimeUnit.SECONDS)
    .followRedirects(false)
    .build()
  private val calls = ConcurrentHashMap<String, Call>()
  private var coverCache: CoverCache? = null

  private fun covers(): CoverCache {
    coverCache?.let { return it }
    val base = appContext.reactContext?.cacheDir ?: File("/tmp")
    return CoverCache(File(base, "NexusCovers"), 32L * 1024L * 1024L).also { coverCache = it }
  }

  override fun definition() = ModuleDefinition {
    Name("NexusWebDAV")

    AsyncFunction("propfind") { token: String, root: String, path: String, username: String, password: String, depth: Int, promise: Promise ->
      try {
        val url = resolveScopedUrl(root, path)
        val body = """<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/><d:resourcetype/><d:getcontentlength/><d:getetag/><d:getlastmodified/><d:getcontenttype/></d:prop></d:propfind>"""
          .toRequestBody("application/xml; charset=utf-8".toMediaTypeOrNull())
        val req = Request.Builder()
          .url(url)
          .method("PROPFIND", body)
          .header("Depth", if (depth == 0) "0" else "1")
          .header("Authorization", Credentials.basic(username, password))
          .build()
        val call = client.newCall(req)
        calls[token] = call
        call.execute().use { resp ->
          calls.remove(token)
          promise.resolve(mapOf("status" to resp.code, "body" to (resp.body?.string() ?: "")))
        }
      } catch (t: Throwable) {
        calls.remove(token)
        promise.reject("DAV_3", t.message ?: "WebDAV 请求失败", t)
      }
    }

    AsyncFunction("backup") { token: String, root: String, path: String, username: String, password: String, operation: String, body: String, etag: String ->
      try {
        val url = resolveScopedUrl(root, path)
        val builder = Request.Builder()
          .url(url)
          .header("Authorization", Credentials.basic(username, password))
        when (operation) {
          "GET" -> builder.get()
          "PUT" -> {
            if (etag.isNotEmpty()) builder.header("If-Match", etag)
            builder.put(body.toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull()))
          }
          "MKCOL" -> builder.method("MKCOL", ByteArray(0).toRequestBody(null))
          else -> throw IllegalArgumentException("Unsupported WebDAV operation")
        }
        val call = client.newCall(builder.build())
        calls[token] = call
        call.execute().use { resp ->
          calls.remove(token)
          val text = resp.body?.string() ?: ""
          mapOf(
            "status" to resp.code,
            "body" to text,
            "etag" to (resp.header("ETag") ?: ""),
            "bytes" to text.toByteArray().size
          )
        }
      } catch (t: Throwable) {
        calls.remove(token)
        throw CodedException("DAV_3", t.message ?: "WebDAV 备份操作失败", t)
      }
    }

    AsyncFunction("prepare") { root: String, path: String, username: String, password: String ->
      val url = resolveScopedUrl(root, path)
      mapOf(
        "url" to url,
        "redirectRoot" to root,
        "headers" to mapOf("Authorization" to Credentials.basic(username, password))
      )
    }

    AsyncFunction("inspect") { token: String, root: String, path: String, username: String, password: String, key: String, etag: String, promise: Promise ->
      val tempDir = File(appContext.reactContext?.cacheDir ?: File("/tmp"), "NexusDavInspect").apply { mkdirs() }
      val ext = path.substringAfterLast('.', "audio").lowercase().take(8)
      val tempFile = File(tempDir, "${UUID.randomUUID()}.$ext")
      try {
        val url = resolveScopedUrl(root, path)
        val reqBuilder = Request.Builder()
          .url(url)
          .get()
          .header("Authorization", Credentials.basic(username, password))
          .header("Range", "bytes=0-4194303")
        if (etag.isNotEmpty()) reqBuilder.header("If-Match", etag)
        val call = client.newCall(reqBuilder.build())
        calls[token] = call
        val coverEpoch = covers().epoch
        call.execute().use { resp ->
          calls.remove(token)
          if (resp.code !in 200..299) {
            promise.reject("DAV_4", "WebDAV 媒体探测失败 (${resp.code})", null)
            return@AsyncFunction
          }
          val body = resp.body ?: run {
            promise.reject("DAV_4", "WebDAV 空响应", null)
            return@AsyncFunction
          }
          var total = 0L
          val maxBytes = 16L * 1024L * 1024L
          FileOutputStream(tempFile).use { out ->
            val buf = ByteArray(16_384)
            body.byteStream().use { input ->
              while (total < maxBytes) {
                val n = input.read(buf, 0, minOf(buf.size.toLong(), maxBytes - total).toInt())
                if (n <= 0) break
                out.write(buf, 0, n)
                total += n
              }
            }
          }
        }
        val retriever = MediaMetadataRetriever()
        try {
          retriever.setDataSource(tempFile.absolutePath)
          val durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toDoubleOrNull() ?: 0.0
          if (!durationMs.isFinite() || durationMs <= 0.0) {
            promise.reject("DAV_4", "无法解析音频时长", null)
            return@AsyncFunction
          }
          val result = mutableMapOf<String, Any>("durationMs" to durationMs)
          retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE)?.takeIf { it.isNotBlank() }?.let { result["title"] = it }
          retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST)?.takeIf { it.isNotBlank() }?.let { result["artist"] = it }
          retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM)?.takeIf { it.isNotBlank() }?.let { result["album"] = it }
          retriever.embeddedPicture?.let { pic ->
            if (pic.size <= 8 * 1024 * 1024 && covers().epoch == coverEpoch) {
              covers().store(pic, key, 512, exporting = false)?.let { stored -> result["artwork"] = stored }
            }
          }
          promise.resolve(result)
        } finally {
          try {
            retriever.release()
          } catch (_: Throwable) {
          }
        }
      } catch (t: Throwable) {
        calls.remove(token)
        promise.reject("DAV_3", t.message ?: "WebDAV 媒体探测失败", t)
      } finally {
        tempFile.delete()
      }
    }

    AsyncFunction("cancel") { token: String ->
      calls.remove(token)?.cancel()
    }

    OnDestroy {
      calls.values.forEach { it.cancel() }
      calls.clear()
    }
  }

  private fun resolveScopedUrl(root: String, path: String): String {
    val base = URI(root.trimEnd('/') + "/")
    val resolved = if (path.isEmpty()) base else base.resolve(path.trimStart('/'))
    if (resolved.scheme != base.scheme || resolved.host != base.host || resolved.port != base.port ||
      !resolved.rawPath.startsWith(base.rawPath)
    ) {
      throw CodedException("DAV_2", "WebDAV 路径超出授权目录范围", null)
    }
    return resolved.toString()
  }
}
