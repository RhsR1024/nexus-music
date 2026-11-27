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
import org.json.JSONObject
import java.io.File
import java.nio.charset.StandardCharsets
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

class NexusNativeModule : Module() {
  private var powerReceiver: BroadcastReceiver? = null
  private val runtimeExecutor = Executors.newSingleThreadExecutor { r ->
    Thread(r, "nexus.lx.registry").apply { isDaemon = true }
  }
  private val probeExecutor = Executors.newCachedThreadPool()
  private val coverExecutor = Executors.newSingleThreadExecutor { r ->
    Thread(r, "nexus.covers").apply { isDaemon = true }
  }

  private val runtimes = mutableMapOf<String, Pair<Int, ScriptRuntime>>()
  private val diagnosticRuntimes = mutableMapOf<String, ScriptRuntime>()
  private val revisions = mutableMapOf<String, Int>()
  private val downloads = mutableMapOf<String, Pair<ScriptHTTP, Promise>>()
  private val probes = ConcurrentHashMap<String, AudioURLProbe>()
  private val coverRequests = mutableMapOf<String, Pair<ScriptHTTP, MutableList<Promise>>>()

  private var coversCache: CoverCache? = null
  private var exportCoversCache: CoverCache? = null
  private var cachedBootstrap: String? = null
  private val dlnaService = NativeDlnaService()
  private val audioMatch = NativeAudioMatch()
  private val auxExecutor = Executors.newCachedThreadPool { r ->
    Thread(r, "nexus.aux").apply { isDaemon = true }
  }

  private fun covers(): CoverCache {
    coversCache?.let { return it }
    val base = appContext.reactContext?.cacheDir ?: File("/tmp")
    return CoverCache(File(base, "NexusCovers"), 32L * 1024L * 1024L).also { coversCache = it }
  }

  private fun exportCovers(): CoverCache {
    exportCoversCache?.let { return it }
    val base = appContext.reactContext?.cacheDir ?: File("/tmp")
    return CoverCache(File(base, "NexusExportCovers"), 16L * 1024L * 1024L).also { exportCoversCache = it }
  }

  private fun bootstrapText(): String? {
    cachedBootstrap?.let { return it }
    val ctx = appContext.reactContext ?: return null
    return try {
      ctx.assets.open("bootstrap.js").bufferedReader(StandardCharsets.UTF_8).use { it.readText() }
        .also { cachedBootstrap = it }
    } catch (_: Throwable) {
      null
    }
  }

  override fun definition() = ModuleDefinition {
    Name("NexusNative")
    Events("onPowerStateChange", "onSourceUpdateAlert", "onAudioMatchLevel", "onCarCommand")

    OnStartObserving("onCarCommand") {
      NexusCarBridgeStore.setCommandHandler { cmd ->
        sendEvent("onCarCommand", cmd)
      }
    }
    OnStopObserving("onCarCommand") {
      NexusCarBridgeStore.setCommandHandler(null)
    }

    OnStartObserving("onPowerStateChange") { startPowerObservation() }
    OnStopObserving("onPowerStateChange") { stopPowerObservation() }

    Function("isLowPowerModeEnabled") { isPowerSaveMode() }

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
      Prop("variant") { view: NexusMaterialView, variant: String -> view.setVariant(variant) }
      Prop("radius") { view: NexusMaterialView, radius: Double -> view.setRadius(radius) }
      Prop("intensity") { view: NexusMaterialView, intensity: Int -> view.setIntensity(intensity) }
    }

    View(NexusPublicMVView::class) {
      Name("PublicMV")
      Events("onState")
      Prop("source") { view: NexusPublicMVView, value: String -> view.source = value }
      Prop("active") { view: NexusPublicMVView, value: Boolean -> view.active = value }
      OnViewDidUpdateProps { view: NexusPublicMVView -> view.applyProps() }
    }

    View(NexusNativeVideoView::class) {
      Name("NativeVideo")
      Events("onState")
      Prop("source") { view: NexusNativeVideoView, value: String -> view.source = value }
      Prop("active") { view: NexusNativeVideoView, value: Boolean -> view.active = value }
      Prop("paused") { view: NexusNativeVideoView, value: Boolean -> view.paused = value }
      Prop("seekTo") { view: NexusNativeVideoView, value: Double -> view.seekTo = value }
      OnViewDidUpdateProps { view: NexusNativeVideoView -> view.applyProps() }
    }

    View(NexusRadioGlobeView::class) {
      Name("RadioGlobe")
      Events("onSelect")
      Prop("html") { view: NexusRadioGlobeView, value: String -> view.html = value }
      Prop("pointsJson") { view: NexusRadioGlobeView, value: String -> view.pointsJson = value }
      Prop("commandJson") { view: NexusRadioGlobeView, value: String -> view.commandJson = value }
      OnViewDidUpdateProps { view: NexusRadioGlobeView -> view.applyProps() }
    }

    View(NexusLocalCanvasView::class) {
      Name("LocalCanvas")
      Events("onAction")
      Prop("html") { view: NexusLocalCanvasView, value: String -> view.html = value }
      Prop("stateJson") { view: NexusLocalCanvasView, value: String -> view.stateJson = value }
      OnViewDidUpdateProps { view: NexusLocalCanvasView -> view.applyProps() }
    }

    View(NexusVinylPivotView::class) { Name("VinylPivot") }
    View(NexusVinylReflectionView::class) { Name("VinylReflection") }
    View(NexusPhotoMaskView::class) {
      Name("PhotoMask")
      OnViewDidUpdateProps { view: NexusPhotoMaskView -> view.applyMask() }
    }

    View(NexusSystemBarSyncView::class) {
      Name("SystemBarSync")
      Prop("darkIcons") { view: NexusSystemBarSyncView, value: Boolean -> view.setDarkIcons(value) }
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
      ScriptUtilities.perform("importText", JSONObject().put("input", base64)) as String
    }

    AsyncFunction("probeAudioURL") { id: String, url: String, promise: Promise ->
      if (probes.containsKey(id) || probes.size >= 2) {
        promise.reject("PROBE_BUSY", "请等待其他检查完成", null)
        return@AsyncFunction
      }
      val client = AudioURLProbe()
      probes[id] = client
      probeExecutor.execute {
        val result = client.probe(url)
        probes.remove(id)
        promise.resolve(result)
      }
    }

    AsyncFunction("cancelAudioProbe") { id: String ->
      probes[id]?.cancel()
    }

    AsyncFunction("decodeKRC") { base64: String ->
      ScriptUtilities.perform("krcDecode", JSONObject().put("input", base64)) as String
    }

    AsyncFunction("decodeQRC") { hex: String ->
      ScriptUtilities.perform("qrcDecode", JSONObject().put("input", hex)) as String
    }

    AsyncFunction("coverStatistics") {
      val normal = covers().statistics()
      val exported = exportCovers().statistics()
      mapOf(
        "files" to ((normal["files"] as? Int ?: 0) + (exported["files"] as? Int ?: 0)),
        "bytes" to ((normal["bytes"] as? Long ?: 0L) + (exported["bytes"] as? Long ?: 0L))
      )
    }

    AsyncFunction("clearCovers") {
      coverExecutor.execute {
        covers().clear()
        exportCovers().clear()
      }
    }

    AsyncFunction("fetchCover") { key: String, url: String, maxPixelSize: Int, promise: Promise ->
      coverExecutor.execute {
        fetchCoverInternal(key, url, maxPixelSize, exporting = false, promise = promise)
      }
    }

    AsyncFunction("fetchExportCover") { key: String, url: String, maxPixelSize: Int, promise: Promise ->
      coverExecutor.execute {
        fetchCoverInternal(key, url, maxPixelSize, exporting = true, promise = promise)
      }
    }

    AsyncFunction("fetchScript") { url: String, promise: Promise ->
      runtimeExecutor.execute {
        if (downloads.size >= 4) {
          promise.reject("DOWNLOAD_LIMIT", "请等待其他导入完成", null)
          return@execute
        }
        val reqId = UUID.randomUUID().toString()
        val client = ScriptHTTP()
        downloads[reqId] = client to promise
        client.start(1, url, "{\"timeout\":15000}") { error, respJson ->
          runtimeExecutor.execute {
            val pending = downloads.remove(reqId) ?: return@execute
            pending.first.destroy()
            val parsed = try {
              if (error == null && respJson != null) JSONObject(respJson) else null
            } catch (_: Throwable) {
              null
            }
            val status = parsed?.optInt("statusCode", 0) ?: 0
            val body = parsed?.opt("body") as? String
            if (status in 200..299 && !body.isNullOrEmpty()) {
              pending.second.resolve(body)
            } else {
              pending.second.reject("SOURCE_DOWNLOAD_FAILED", "无法下载有效音源，请检查地址或网络", null)
            }
          }
        }
      }
    }

    AsyncFunction("initializeSource") { id: String, revision: Int, name: String, script: String, promise: Promise ->
      runtimeExecutor.execute {
        val bootstrap = bootstrapText()
        if (revision <= (revisions[id] ?: 0) ||
          (!runtimes.containsKey(id) && runtimes.size >= 32) ||
          bootstrap == null
        ) {
          promise.reject("SOURCE_INITIALIZATION_INVALID", "音源初始化失败", null)
          return@execute
        }
        runtimes[id]?.second?.destroy()
        revisions[id] = revision
        val runtime = ScriptRuntime(id, revision)
        runtime.onUpdateAlert = { payload ->
          sendEvent(
            "onSourceUpdateAlert",
            mapOf("id" to id, "revision" to revision, "payload" to payload)
          )
        }
        runtimes[id] = revision to runtime
        runtime.initialize(script, name, bootstrap) { result -> completeRuntime(promise, result) }
      }
    }

    AsyncFunction("probeSourceUpdateAlert") { id: String, name: String, script: String, waitMs: Int, promise: Promise ->
      runtimeExecutor.execute {
        val bootstrap = bootstrapText()
        if (script.toByteArray(StandardCharsets.UTF_8).size > 8 * 1024 * 1024 || bootstrap == null) {
          promise.resolve(null)
          return@execute
        }
        val runtime = ScriptRuntime("update-probe:$id", 1)
        val boundedWaitMs = waitMs.coerceIn(1500, 12_000).toLong()
        val settled = java.util.concurrent.atomic.AtomicBoolean(false)
        val scheduler = Executors.newSingleThreadScheduledExecutor()
        fun finishProbe(payload: String?) {
          if (!settled.compareAndSet(false, true)) return
          runtime.destroy()
          scheduler.shutdownNow()
          promise.resolve(payload)
        }
        runtime.onUpdateAlert = { payload -> finishProbe(payload) }
        scheduler.schedule({ finishProbe(null) }, boundedWaitMs, java.util.concurrent.TimeUnit.MILLISECONDS)
        runtime.initialize(script, name, bootstrap) { result ->
          if (result.isFailure) {
            try {
              scheduler.schedule({ finishProbe(null) }, 1500L, java.util.concurrent.TimeUnit.MILLISECONDS)
            } catch (_: Throwable) {
              finishProbe(null)
            }
          }
        }
      }
    }

    AsyncFunction("requestSource") { id: String, revision: Int, requestID: String, payload: String, promise: Promise ->
      runtimeExecutor.execute {
        val current = runtimes[id]
        if (current == null || current.first != revision) {
          promise.reject("SOURCE_STALE", "音源已更新或停用", null)
          return@execute
        }
        current.second.request(requestID, payload) { result -> completeRuntime(promise, result) }
      }
    }

    AsyncFunction("cancelRequest") { id: String, revision: Int, requestID: String ->
      runtimeExecutor.execute {
        val current = runtimes[id]
        if (current != null && current.first == revision) {
          current.second.cancel(requestID)
        }
      }
    }

    AsyncFunction("destroySource") { id: String, revision: Int ->
      runtimeExecutor.execute {
        val current = runtimes[id]
        if (current != null && current.first == revision) {
          current.second.destroy()
          runtimes.remove(id)
        }
      }
    }

    AsyncFunction("initializeHealthSource") { id: String, name: String, script: String, promise: Promise ->
      runtimeExecutor.execute {
        val bootstrap = bootstrapText()
        if (diagnosticRuntimes.containsKey(id) ||
          diagnosticRuntimes.size >= 2 ||
          script.toByteArray(StandardCharsets.UTF_8).size > 8 * 1024 * 1024 ||
          bootstrap == null
        ) {
          promise.reject("HEALTH_SOURCE_BUSY", "诊断初始化失败，请稍后重试", null)
          return@execute
        }
        val runtime = ScriptRuntime("diagnostic:$id", 1)
        diagnosticRuntimes[id] = runtime
        runtime.initialize(script, name, bootstrap) { result -> completeRuntime(promise, result) }
      }
    }

    AsyncFunction("requestHealthSource") { id: String, requestID: String, payload: String, promise: Promise ->
      runtimeExecutor.execute {
        val runtime = diagnosticRuntimes[id]
        if (runtime == null) {
          promise.reject("HEALTH_SOURCE_ENDED", "诊断会话已结束", null)
          return@execute
        }
        runtime.request(requestID, payload) { result -> completeRuntime(promise, result) }
      }
    }

    AsyncFunction("cancelHealthRequest") { id: String, requestID: String ->
      runtimeExecutor.execute {
        diagnosticRuntimes[id]?.cancel(requestID)
      }
    }

    AsyncFunction("destroyHealthSource") { id: String ->
      runtimeExecutor.execute {
        diagnosticRuntimes.remove(id)?.destroy()
      }
    }

    AsyncFunction("dlnaDiscover") { timeoutMs: Int, promise: Promise ->
      auxExecutor.execute {
        try {
          promise.resolve(dlnaService.discover(appContext.reactContext, timeoutMs))
        } catch (err: Throwable) {
          promise.reject("DLNA_DISCOVER_FAILED", err.message ?: "局域网扫描失败", err)
        }
      }
    }

    AsyncFunction("dlnaStartRelay") { sourceUrl: String, headersJson: String, promise: Promise ->
      auxExecutor.execute {
        try {
          promise.resolve(dlnaService.startRelay(sourceUrl, headersJson))
        } catch (err: Throwable) {
          promise.reject("DLNA_RELAY_FAILED", err.message ?: "投屏中继启动失败", err)
        }
      }
    }

    AsyncFunction("dlnaStopRelay") {
      dlnaService.stopRelay()
    }

    AsyncFunction("dlnaSetKeepAlive") { enabled: Boolean ->
      dlnaService.setKeepAlive(enabled)
    }

    AsyncFunction("audioMatchPermission") {
      audioMatch.permissionStatus(appContext.reactContext)
    }

    AsyncFunction("audioMatchRequestPermission") {
      audioMatch.requestPermission(appContext.currentActivity)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("audioMatchStart") { durationMs: Int, promise: Promise ->
      auxExecutor.execute {
        try {
          val payload = audioMatch.startCapture(appContext.reactContext, durationMs) { event ->
            sendEvent("onAudioMatchLevel", event)
          }
          promise.resolve(payload)
        } catch (err: Throwable) {
          promise.reject("AUDIO_MATCH_FAILED", err.message ?: "听歌识曲采集失败", err)
        }
      }
    }

    AsyncFunction("audioMatchStop") {
      audioMatch.stopCapture()
    }

    AsyncFunction("updateCarCatalog") { json: String ->
      NexusCarBridgeStore.updateCatalog(json)
    }

    AsyncFunction("consumePendingCarCommands") {
      NexusCarBridgeStore.consumePendingCommands()
    }

    AsyncFunction("carIntegrationStatus") {
      NexusCarBridgeStore.statusSnapshot()
    }

    OnDestroy {
      NexusCarBridgeStore.setCommandHandler(null)
      dlnaService.stopRelay()
      dlnaService.setKeepAlive(false)
      audioMatch.stopCapture()
      stopPowerObservation()
      probes.values.forEach { it.cancel() }
      probes.clear()
      coverExecutor.execute {
        coverRequests.values.forEach { (client, list) ->
          client.destroy()
          list.forEach { it.reject("COVER_CANCELLED", "封面加载已结束", null) }
        }
        coverRequests.clear()
      }
      runtimeExecutor.execute {
        diagnosticRuntimes.values.forEach { it.destroy() }
        diagnosticRuntimes.clear()
        runtimes.values.forEach { it.second.destroy() }
        runtimes.clear()
        revisions.clear()
        downloads.values.forEach { (client, p) ->
          client.destroy()
          p.reject("SOURCE_DESTROYED", "操作已结束", null)
        }
        downloads.clear()
      }
    }
  }

  private fun completeRuntime(promise: Promise, result: Result<String>) {
    result.fold(
      onSuccess = { json -> promise.resolve(json) },
      onFailure = { err ->
        val code = err.message ?: ScriptRuntimeError.REQUEST.code
        promise.reject(code, "音源操作失败，请重试或更换音源", err)
      }
    )
  }

  private fun resizedNeteaseCoverUrl(raw: String, maximum: Int): String? {
    return try {
      val uri = java.net.URI(raw)
      val host = uri.host?.lowercase() ?: return null
      if (!host.endsWith(".music.126.net") || !uri.rawQuery.isNullOrEmpty()) return null
      val path = uri.rawPath?.lowercase() ?: return null
      if (!path.endsWith(".jpg") && !path.endsWith(".jpeg") && !path.endsWith(".png") && !path.endsWith(".webp")) return null
      "$raw?param=${maximum}y${maximum}"
    } catch (_: Throwable) {
      null
    }
  }

  private fun fetchCoverInternal(key: String, url: String, maximum: Int, exporting: Boolean, promise: Promise) {
    val allowed = if (exporting) setOf(256, 500, 512, 1000, 1024, 1200, 2048) else setOf(512, 1024)
    if (maximum !in allowed) {
      promise.reject("COVER_SIZE", "封面尺寸无效", null)
      return
    }
    val cache = if (exporting) exportCovers() else covers()
    val requestKey = (if (exporting) "export:" else "display:") + key
    cache.hit(key)?.let { hit ->
      promise.resolve(hit)
      return
    }
    coverRequests[requestKey]?.let { (_, list) ->
      list.add(promise)
      return
    }
    if (coverRequests.size >= 12) {
      promise.reject("COVER_BUSY", "封面加载繁忙", null)
      return
    }
    val client = ScriptHTTP(24 * 1024 * 1024)
    val epoch = cache.epoch
    coverRequests[requestKey] = client to mutableListOf(promise)
    val resized = if (exporting) null else resizedNeteaseCoverUrl(url, maximum)
    val initialUrl = resized ?: url
    fun finish(stored: String?) {
      val pending = coverRequests.remove(requestKey) ?: return
      pending.first.destroy()
      pending.second.forEach { p ->
        if (stored != null) p.resolve(stored)
        else p.reject("COVER_FAILED", "封面暂不可用", null)
      }
    }
    fun storeResponse(error: String?, respJson: String?): String? {
      val parsed = try {
        if (error == null && respJson != null) JSONObject(respJson) else null
      } catch (_: Throwable) {
        null
      }
      val status = parsed?.optInt("statusCode", 0) ?: 0
      val b64 = parsed?.optString("body", "")
      return if (epoch == cache.epoch && status in 200..299 && !b64.isNullOrEmpty()) {
        try {
          val bytes = Base64.decode(b64, Base64.DEFAULT)
          cache.store(bytes, key, maximum, exporting)
        } catch (_: Throwable) {
          null
        }
      } else {
        null
      }
    }
    client.start(1, initialUrl, "{\"binary\":true,\"timeout\":15000}") { error, respJson ->
      coverExecutor.execute {
        if (coverRequests[requestKey] == null) return@execute
        val stored = storeResponse(error, respJson)
        if (stored != null) {
          finish(stored)
          return@execute
        }
        if (resized != null && initialUrl != url) {
          client.start(2, url, "{\"binary\":true,\"timeout\":15000}") { retryErr, retryJson ->
            coverExecutor.execute {
              if (coverRequests[requestKey] == null) return@execute
              finish(storeResponse(retryErr, retryJson))
            }
          }
          return@execute
        }
        finish(null)
      }
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
}
