package com.nexusmusic.nexusnative

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.icu.text.Transliterator
import android.os.Build
import android.os.PowerManager
import android.util.Base64
import android.view.WindowManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.charset.StandardCharsets
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.zip.Inflater

class NexusNativeModule : Module() {
  private var powerReceiver: BroadcastReceiver? = null
  private val httpClient = OkHttpClient.Builder()
    .connectTimeout(15, TimeUnit.SECONDS)
    .readTimeout(15, TimeUnit.SECONDS)
    .writeTimeout(15, TimeUnit.SECONDS)
    .followRedirects(true)
    .build()
  private val activeCalls = ConcurrentHashMap<String, okhttp3.Call>()

  override fun definition() = ModuleDefinition {
    Name("NexusNative")
    Events("onPowerStateChange")

    OnStartObserving("onPowerStateChange") {
      startPowerObservation()
    }

    OnStopObserving("onPowerStateChange") {
      stopPowerObservation()
    }

    Function("isLowPowerModeEnabled") {
      isPowerSaveMode()
    }

    AsyncFunction("setKeepScreenOn") { enabled: Boolean ->
      val activity = appContext.currentActivity
      activity?.runOnUiThread {
        if (enabled) {
          activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } else {
          activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
      }
    }.runOnQueue(Queues.MAIN)

    Function("convertChinese") { text: String, mode: String ->
      if (text.isEmpty() || (mode != "simplified" && mode != "traditional")) {
        text
      } else {
        try {
          val id = if (mode == "traditional") "Simplified-Traditional" else "Traditional-Simplified"
          Transliterator.getInstance(id).transliterate(text)
        } catch (_: Throwable) {
          text
        }
      }
    }

    View(NexusMaterialView::class) {
      Prop("dark") { view: NexusMaterialView, dark: Boolean -> view.setDark(dark) }
    }

    View(NexusPublicMVView::class) {
      Name("PublicMV")
      Events("onState")
      Prop("source") { view: NexusPublicMVView, value: String -> view.source = value }
      Prop("active") { view: NexusPublicMVView, value: Boolean -> view.active = value }
      OnViewDidUpdateProps { view: NexusPublicMVView -> view.applyProps() }
    }

    View(NexusVinylPivotView::class) {
      Name("VinylPivot")
    }

    View(NexusVinylReflectionView::class) {
      Name("VinylReflection")
    }

    View(NexusPhotoMaskView::class) {
      Name("PhotoMask")
      OnViewDidUpdateProps { view: NexusPhotoMaskView -> view.applyMask() }
    }

    View(NexusRoutePickerView::class) {
      Name("RoutePicker")
      Prop("tint") { view: NexusRoutePickerView, value: String -> view.setTint(value) }
      Prop("activeTint") { view: NexusRoutePickerView, value: String -> view.setActiveTint(value) }
    }

    View(NexusDeviceVolumeView::class) {
      Name("DeviceVolume")
      Prop("tint") { view: NexusDeviceVolumeView, value: String -> view.setTint(value) }
    }

    View(NexusLyricGestureView::class) {
      Name("LyricGesture")
      Events("onDoubleTap", "onLongPress")
    }

    View(NexusAmbientView::class) {
      Name("Ambient")
      Prop("colors") { view: NexusAmbientView, colors: List<String> -> view.setColors(colors) }
      Prop("identity") { view: NexusAmbientView, identity: String -> view.setIdentity(identity) }
      Prop("moving") { view: NexusAmbientView, moving: Boolean -> view.setMoving(moving) }
      Prop("pending") { view: NexusAmbientView, pending: Boolean -> view.setPending(pending) }
      Prop("dark") { view: NexusAmbientView, dark: Boolean -> view.setDark(dark) }
      OnViewDidUpdateProps { view: NexusAmbientView -> view.applyProps() }
    }

    View(NexusMeshView::class) {
      Name("Mesh")
      Prop("colors") { view: NexusMeshView, colors: List<String> -> view.setColors(colors) }
      Prop("identity") { view: NexusMeshView, identity: String -> view.setIdentity(identity) }
      Prop("moving") { view: NexusMeshView, moving: Boolean -> view.setMoving(moving) }
      Prop("pending") { view: NexusMeshView, pending: Boolean -> view.setPending(pending) }
      Prop("dark") { view: NexusMeshView, dark: Boolean -> view.setDark(dark) }
      OnViewDidUpdateProps { view: NexusMeshView -> view.applyProps() }
    }

    Function("launchArgument") { name: String ->
      appContext.currentActivity?.intent?.getStringExtra(name)
    }

    AsyncFunction("decodeImportText") { base64: String ->
      val raw = Base64.decode(base64, Base64.DEFAULT)
      try {
        String(inflateBytes(raw), StandardCharsets.UTF_8)
      } catch (_: Throwable) {
        String(raw, StandardCharsets.UTF_8)
      }
    }

    AsyncFunction("probeAudioURL") { id: String, url: String, promise: Promise ->
      val request = Request.Builder()
        .url(url)
        .header("Range", "bytes=0-1023")
        .build()
      val call = httpClient.newCall(request)
      activeCalls[id] = call
      try {
        call.execute().use { resp ->
          activeCalls.remove(id)
          val bytes = resp.body?.bytes() ?: ByteArray(0)
          promise.resolve(
            mapOf(
              "ok" to resp.isSuccessful,
              "statusCode" to resp.code,
              "contentType" to (resp.header("Content-Type") ?: ""),
              "bytes" to bytes.size
            )
          )
        }
      } catch (t: Throwable) {
        activeCalls.remove(id)
        promise.resolve(mapOf("ok" to false, "error" to (t.message ?: "PROBE_FAILED")))
      }
    }

    AsyncFunction("cancelAudioProbe") { id: String ->
      activeCalls.remove(id)?.cancel()
    }

    AsyncFunction("decodeKRC") { base64: String ->
      val data = Base64.decode(base64, Base64.DEFAULT)
      if (data.size <= 4) return@AsyncFunction ""
      val key = byteArrayOf(
        64, 71, 97, 119, 94, 50, 116, 71, 81, 54, 49, 45, 206.toByte(), 210.toByte(), 110, 105
      )
      val payload = ByteArray(data.size - 4)
      for (i in payload.indices) {
        payload[i] = (data[i + 4].toInt() xor key[i % key.size].toInt()).toByte()
      }
      String(inflateBytes(payload), StandardCharsets.UTF_8)
    }

    AsyncFunction("decodeQRC") { hex: String ->
      // Full QRC triple-DES decryption lands with LX/Lyric utilities in Phase 1.
      if (hex.isBlank()) "" else ""
    }

    AsyncFunction("coverStatistics") {
      val dir = coverCacheDir(exporting = false)
      val exportDir = coverCacheDir(exporting = true)
      val files = (dir.listFiles()?.toList().orEmpty()) + (exportDir.listFiles()?.toList().orEmpty())
      mapOf(
        "files" to files.size,
        "bytes" to files.sumOf { it.length() }
      )
    }

    AsyncFunction("clearCovers") {
      coverCacheDir(exporting = false).listFiles()?.forEach { it.delete() }
      coverCacheDir(exporting = true).listFiles()?.forEach { it.delete() }
    }

    AsyncFunction("fetchCover") { key: String, url: String, maxPixelSize: Int ->
      fetchAndCacheCover(key, url, maxPixelSize, exporting = false)
    }

    AsyncFunction("fetchExportCover") { key: String, url: String, maxPixelSize: Int ->
      fetchAndCacheCover(key, url, maxPixelSize, exporting = true)
    }

    AsyncFunction("fetchScript") { url: String ->
      val request = Request.Builder().url(url).build()
      httpClient.newCall(request).execute().use { resp ->
        val body = resp.body?.string() ?: ""
        if (!resp.isSuccessful || body.isEmpty()) {
          throw IllegalStateException("无法下载有效音源，请检查地址或网络")
        }
        body
      }
    }

    // LX isolated runtime methods (QuickJS runtime lands in Phase 1; shared common/bootstrap.js is already bundled in assets)
    AsyncFunction("initializeSource") { _: String, _: Int, _: String, _: String, promise: Promise ->
      promise.reject("ANDROID_PHASE1_PENDING", "Android 隔离 LX 音源引擎将在 Phase 1 启用", null)
    }

    AsyncFunction("requestSource") { _: String, _: Int, _: String, _: String, promise: Promise ->
      promise.reject("ANDROID_PHASE1_PENDING", "Android 隔离 LX 音源引擎将在 Phase 1 启用", null)
    }

    AsyncFunction("cancelRequest") { _: String, _: Int, _: String -> }
    AsyncFunction("destroySource") { _: String, _: Int -> }

    AsyncFunction("initializeHealthSource") { _: String, _: String, _: String, promise: Promise ->
      promise.reject("ANDROID_PHASE1_PENDING", "Android 诊断 LX 音源引擎将在 Phase 1 启用", null)
    }

    AsyncFunction("requestHealthSource") { _: String, _: String, _: String, promise: Promise ->
      promise.reject("ANDROID_PHASE1_PENDING", "Android 诊断 LX 音源引擎将在 Phase 1 启用", null)
    }

    AsyncFunction("cancelHealthRequest") { _: String, _: String -> }
    AsyncFunction("destroyHealthSource") { _: String -> }

    OnDestroy {
      stopPowerObservation()
      activeCalls.values.forEach { it.cancel() }
      activeCalls.clear()
    }
  }

  private fun isPowerSaveMode(): Boolean {
    val ctx = appContext.reactContext ?: return false
    val pm = ctx.getSystemService(Context.POWER_SERVICE) as? PowerManager
    return pm?.isPowerSaveMode == true
  }

  private fun startPowerObservation() {
    val ctx = appContext.reactContext ?: return
    if (powerReceiver != null) return
    val receiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context?, intent: Intent?) {
        sendEvent("onPowerStateChange", mapOf("lowPowerModeEnabled" to isPowerSaveMode()))
      }
    }
    val filter = IntentFilter(PowerManager.ACTION_POWER_SAVE_MODE_CHANGED)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      ctx.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      ctx.registerReceiver(receiver, filter)
    }
    powerReceiver = receiver
  }

  private fun stopPowerObservation() {
    val ctx = appContext.reactContext ?: return
    val receiver = powerReceiver ?: return
    try {
      ctx.unregisterReceiver(receiver)
    } catch (_: Throwable) {
    }
    powerReceiver = null
  }

  private fun coverCacheDir(exporting: Boolean): File {
    val base = appContext.reactContext?.cacheDir ?: File("/tmp")
    return File(base, if (exporting) "NexusExportCovers" else "NexusCovers").apply { mkdirs() }
  }

  private fun fetchAndCacheCover(key: String, url: String, maxPixelSize: Int, exporting: Boolean): String {
    val allowed = if (exporting) setOf(256, 500, 512, 1000, 1024, 1200, 2048) else setOf(512, 1024)
    require(maxPixelSize in allowed) { "封面尺寸无效" }
    val safeKey = key.replace(Regex("[^a-fA-F0-9_-]"), "_")
    val target = File(coverCacheDir(exporting), "$safeKey.jpg")
    if (target.exists() && target.length() > 0) {
      return target.toURI().toString()
    }
    val request = Request.Builder().url(url).build()
    httpClient.newCall(request).execute().use { resp ->
      val bytes = resp.body?.bytes()
      if (!resp.isSuccessful || bytes == null || bytes.isEmpty()) {
        throw IllegalStateException("封面暂不可用")
      }
      val temp = File(target.parentFile, "$safeKey.tmp")
      temp.writeBytes(bytes)
      if (!temp.renameTo(target)) {
        target.writeBytes(bytes)
        temp.delete()
      }
      return target.toURI().toString()
    }
  }

  private fun inflateBytes(input: ByteArray): ByteArray {
    val inflater = Inflater()
    inflater.setInput(input)
    val out = ByteArrayOutputStream()
    val buffer = ByteArray(4096)
    try {
      while (!inflater.finished()) {
        val count = inflater.inflate(buffer)
        if (count == 0) {
          if (inflater.needsInput() || inflater.needsDictionary()) break
        } else {
          out.write(buffer, 0, count)
        }
      }
      return out.toByteArray()
    } finally {
      inflater.end()
    }
  }
}
