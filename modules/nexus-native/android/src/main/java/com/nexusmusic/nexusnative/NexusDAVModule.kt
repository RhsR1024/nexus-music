package com.nexusmusic.nexusnative

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
import java.net.URI
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

/**
 * Android WebDAV transport matching iOS NexusDAVModule (PROPFIND/MKCOL/GET/PUT/prepare/inspect/cancel).
 */
class NexusDAVModule : Module() {
  private val client = OkHttpClient.Builder()
    .connectTimeout(20, TimeUnit.SECONDS)
    .readTimeout(30, TimeUnit.SECONDS)
    .writeTimeout(30, TimeUnit.SECONDS)
    .followRedirects(false)
    .build()
  private val calls = ConcurrentHashMap<String, Call>()

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

    AsyncFunction("inspect") { _: String, _: String, _: String, _: String, _: String, _: String, _: String, promise: Promise ->
      promise.reject("DAV_4", "WebDAV 远端标签探测将在 Phase 3 启用", null)
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
    return if (path.isEmpty()) base.toString() else base.resolve(path.trimStart('/')).toString()
  }
}
