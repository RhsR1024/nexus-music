package com.nexusmusic.nexusnative

import android.content.Intent
import android.net.Uri
import android.util.Base64
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import okhttp3.Call
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.nio.charset.StandardCharsets
import java.security.SecureRandom
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * 1:1 Android parity implementation of iOS NexusMusicAuthModule:
 * - Isolated WebView login for Netease / QQ & QQ daily authorization
 * - LAN QQ computer pairing (HMAC-SHA256 claim proof + AES-256-GCM AAD envelope + private IPv4 guard)
 * - QR scanner launcher
 */
class NexusMusicAuthModule : Module() {
  private val activeSessions = ConcurrentHashMap<String, Boolean>()
  private val transferCalls = ConcurrentHashMap<String, Call>()
  private val transferExecutor = Executors.newCachedThreadPool()
  private val httpClient = OkHttpClient.Builder()
    .cache(null)
    .followRedirects(false)
    .followSslRedirects(false)
    .connectTimeout(20, TimeUnit.SECONDS)
    .readTimeout(25, TimeUnit.SECONDS)
    .build()

  override fun definition() = ModuleDefinition {
    Name("NexusMusicAuth")

    AsyncFunction("scanQQTransfer") { id: String, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null || !isUuid(id) || activeSessions.isNotEmpty()) {
        promise.reject("TRANSFER_BUSY", "暂时无法打开扫码", null)
        return@AsyncFunction
      }
      activeSessions[id] = true
      NexusQrScannerActivity.register(id) { res ->
        activeSessions.remove(id)
        res.fold(
          onSuccess = { code -> promise.resolve(code) },
          onFailure = { promise.reject("TRANSFER_CAMERA", "无法使用相机，请改用配对码", it) }
        )
      }
      val intent = Intent(activity, NexusQrScannerActivity::class.java)
        .putExtra(NexusQrScannerActivity.EXTRA_SESSION_ID, id)
      activity.startActivity(intent)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("receiveQQTransfer") { id: String, code: String, promise: Promise ->
      if (!isUuid(id) || activeSessions.isNotEmpty()) {
        promise.reject("TRANSFER_BUSY", "已有登录正在进行", null)
        return@AsyncFunction
      }
      val wire = try {
        AccountTransferWire.parse(code)
      } catch (_: Throwable) {
        promise.reject("TRANSFER_INVALID", "配对码无效", null)
        return@AsyncFunction
      }
      activeSessions[id] = true
      transferExecutor.execute {
        try {
          val nonceBytes = ByteArray(16)
          SecureRandom().nextBytes(nonceBytes)
          val nonceHex = nonceBytes.joinToString("") { "%02x".format(it.toInt() and 0xFF) }
          val proof = wire.hmacHex("claim:${wire.id}:$nonceHex")
          val reqBody = JSONObject().put("nonce", nonceHex).put("proof", proof).toString()
            .toRequestBody("application/json; charset=utf-8".toMediaType())
          val req = Request.Builder().url(wire.url).post(reqBody).build()
          val call = httpClient.newCall(req)
          transferCalls[id] = call
          call.execute().use { resp ->
            transferCalls.remove(id)
            activeSessions.remove(id)
            if (resp.code !in 200..299) {
              promise.reject("TRANSFER_EXPIRED", "未能验证电脑配对，请重新生成配对码", null)
              return@execute
            }
            val bytes = resp.body?.bytes() ?: ByteArray(0)
            val plain = wire.open(bytes, nonceHex)
            promise.resolve(plain)
          }
        } catch (e: TransferError) {
          transferCalls.remove(id)
          activeSessions.remove(id)
          promise.reject(e.code, "未能验证电脑配对，请重新生成配对码", e)
        } catch (t: Throwable) {
          transferCalls.remove(id)
          activeSessions.remove(id)
          promise.reject("TRANSFER_NETWORK", "未能验证电脑配对，请重新生成配对码", t)
        }
      }
    }

    AsyncFunction("cancelQQTransfer") { id: String ->
      transferCalls.remove(id)?.cancel()
      NexusQrScannerActivity.cancel(id)
      activeSessions.remove(id)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("open") { id: String, provider: String, url: String, promise: Promise ->
      val activity = appContext.currentActivity
      if (MusicWebLoginPolicy.initialURL(provider, id) != url) {
        promise.reject("AUTH_UNSUPPORTED", "该平台登录尚未接入", null)
        return@AsyncFunction
      }
      if (activity == null || activeSessions.isNotEmpty()) {
        promise.reject("AUTH_BUSY", "已有登录窗口正在打开", null)
        return@AsyncFunction
      }
      activeSessions[id] = true
      NexusAuthWebActivity.register(id) { res ->
        activeSessions.remove(id)
        res.fold(
          onSuccess = { json -> promise.resolve(json) },
          onFailure = { err ->
            val code = err.message ?: "AUTH_FAILED"
            promise.reject(code, "登录未完成", err)
          }
        )
      }
      val intent = Intent(activity, NexusAuthWebActivity::class.java)
        .putExtra(NexusAuthWebActivity.EXTRA_SESSION_ID, id)
        .putExtra(NexusAuthWebActivity.EXTRA_PROVIDER, provider)
        .putExtra(NexusAuthWebActivity.EXTRA_URL, url)
        .putExtra(NexusAuthWebActivity.EXTRA_DAILY_MODE, false)
      activity.startActivity(intent)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("cancel") { id: String ->
      NexusAuthWebActivity.cancel(id)
      activeSessions.remove(id)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("openQQDaily") { id: String, promise: Promise ->
      val activity = appContext.currentActivity
      if (!isUuid(id) || activity == null || activeSessions.isNotEmpty()) {
        promise.reject("AUTH_BUSY", "已有登录窗口正在打开", null)
        return@AsyncFunction
      }
      activeSessions[id] = true
      NexusAuthWebActivity.register(id) { res ->
        activeSessions.remove(id)
        res.fold(
          onSuccess = { json -> promise.resolve(json) },
          onFailure = { err ->
            val code = err.message ?: "AUTH_FAILED"
            promise.reject(code, "授权未完成", err)
          }
        )
      }
      val intent = Intent(activity, NexusAuthWebActivity::class.java)
        .putExtra(NexusAuthWebActivity.EXTRA_SESSION_ID, id)
        .putExtra(NexusAuthWebActivity.EXTRA_PROVIDER, "tx")
        .putExtra(NexusAuthWebActivity.EXTRA_URL, MusicWebLoginPolicy.DAILY_URL)
        .putExtra(NexusAuthWebActivity.EXTRA_DAILY_MODE, true)
      activity.startActivity(intent)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("neteaseQrRequest") { path: String, formBody: String, cookieHeader: String, promise: Promise ->
      val allowedPaths = setOf("/weapi/login/qrcode/unikey", "/weapi/login/qrcode/client/login")
      if (path !in allowedPaths || formBody.toByteArray(StandardCharsets.UTF_8).size > 65_536 ||
        cookieHeader.toByteArray(StandardCharsets.UTF_8).size > 8_192
      ) {
        promise.reject("QR_INVALID", "网易云扫码请求参数无效", null)
        return@AsyncFunction
      }
      transferExecutor.execute {
        try {
          val reqBody = formBody.toRequestBody("application/x-www-form-urlencoded; charset=UTF-8".toMediaType())
          val builder = Request.Builder()
            .url("https://music.163.com$path")
            .post(reqBody)
            .header("Referer", "https://music.163.com/")
            .header("Origin", "https://music.163.com")
            .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
          if (cookieHeader.isNotEmpty()) builder.header("Cookie", cookieHeader)
          httpClient.newCall(builder.build()).execute().use { resp ->
            if (resp.code !in 200..299) {
              promise.reject("QR_HTTP", "网易云扫码服务暂时不可用", null)
              return@execute
            }
            val bodyBytes = resp.body?.bytes() ?: ByteArray(0)
            if (bodyBytes.size > 2 * 1024 * 1024) {
              promise.reject("QR_PARSE", "网易云扫码响应过大", null)
              return@execute
            }
            val bodyText = String(bodyBytes, StandardCharsets.UTF_8)
            val setCookies = org.json.JSONArray()
            for (sc in resp.headers("Set-Cookie")) setCookies.put(sc)
            val payload = JSONObject()
              .put("bodyText", bodyText)
              .put("setCookies", setCookies)
            promise.resolve(payload.toString())
          }
        } catch (t: Throwable) {
          promise.reject("QR_NETWORK", t.message ?: "网络请求失败", t)
        }
      }
    }

    OnDestroy {
      transferCalls.values.forEach { it.cancel() }
      transferCalls.clear()
      activeSessions.keys.toList().forEach {
        NexusAuthWebActivity.cancel(it)
        NexusQrScannerActivity.cancel(it)
      }
      activeSessions.clear()
    }
  }

  private fun isUuid(raw: String): Boolean = try {
    UUID.fromString(raw)
    true
  } catch (_: Throwable) {
    false
  }
}

internal class TransferError(val code: String) : Exception(code)

internal class AccountTransferWire(val id: String, val key: ByteArray, val url: String) {
  fun hmacHex(message: String): String {
    val mac = Mac.getInstance("HmacSHA256")
    mac.init(SecretKeySpec(key, "HmacSHA256"))
    return mac.doFinal(message.toByteArray(StandardCharsets.UTF_8))
      .joinToString("") { "%02x".format(it.toInt() and 0xFF) }
  }

  fun open(data: ByteArray, nonce: String, nowMs: Double = System.currentTimeMillis().toDouble()): String {
    if (data.size > 32_768) throw TransferError("TRANSFER_INVALID")
    val envelope = try {
      JSONObject(String(data, StandardCharsets.UTF_8))
    } catch (_: Throwable) {
      throw TransferError("TRANSFER_INVALID")
    }
    val iv = Base64.decode(envelope.optString("iv", ""), Base64.DEFAULT)
    val encrypted = Base64.decode(envelope.optString("data", ""), Base64.DEFAULT)
    if (iv.size != 12 || encrypted.size < 16 || encrypted.size > 32_768) throw TransferError("TRANSFER_INVALID")

    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(128, iv))
    cipher.updateAAD("$id:$nonce".toByteArray(StandardCharsets.UTF_8))
    val plain = try {
      cipher.doFinal(encrypted)
    } catch (_: Throwable) {
      throw TransferError("TRANSFER_INVALID")
    }
    if (plain.size > 32_768) throw TransferError("TRANSFER_INVALID")
    val text = String(plain, StandardCharsets.UTF_8)
    val payload = try {
      JSONObject(text)
    } catch (_: Throwable) {
      throw TransferError("TRANSFER_INVALID")
    }
    val expiry = payload.optDouble("expiresAt", Double.NaN)
    if (payload.optInt("v", -1) != 1 || payload.optString("provider") != "tx" || !expiry.isFinite()) {
      throw TransferError("TRANSFER_INVALID")
    }
    if (expiry <= nowMs || expiry > nowMs + 180_000.0) throw TransferError("TRANSFER_EXPIRED")
    return text
  }

  companion object {
    fun privateIPv4(host: String): Boolean {
      val parts = host.split('.')
      if (parts.size != 4) return false
      val nums = parts.map { p ->
        val n = p.toIntOrNull() ?: return false
        if (n !in 0..255 || n.toString() != p) return false
        n
      }
      return nums[0] == 10 || (nums[0] == 192 && nums[1] == 168) || (nums[0] == 172 && nums[1] in 16..31)
    }

    fun parse(raw: String): AccountTransferWire {
      val text = raw.trim()
      if (text.toByteArray().size > 1024) throw TransferError("TRANSFER_INVALID")
      val uri = Uri.parse(text)
      if (uri.scheme != "qmusic" || uri.host != "account-transfer" || uri.userInfo != null ||
        uri.port != -1 || !uri.path.isNullOrEmpty() || uri.fragment != null
      ) throw TransferError("TRANSFER_INVALID")
      val names = uri.queryParameterNames
      if (names != setOf("v", "host", "port", "id", "key")) throw TransferError("TRANSFER_INVALID")
      val v = uri.getQueryParameter("v")
      val host = uri.getQueryParameter("host") ?: ""
      val portText = uri.getQueryParameter("port") ?: ""
      val port = portText.toIntOrNull() ?: throw TransferError("TRANSFER_INVALID")
      val id = uri.getQueryParameter("id") ?: ""
      val secret = uri.getQueryParameter("key") ?: ""
      if (v != "1" || !privateIPv4(host) || port.toString() != portText || port !in 1024..65535 ||
        !Regex("^[a-f0-9]{32}$").matches(id) || !Regex("^[a-f0-9]{64}$").matches(secret)
      ) throw TransferError("TRANSFER_INVALID")
      val keyBytes = ByteArray(32) { i ->
        secret.substring(i * 2, i * 2 + 2).toInt(16).toByte()
      }
      return AccountTransferWire(id, keyBytes, "http://$host:$port/qmusic-account-transfer/$id")
    }
  }
}
