package com.nexusmusic.nexusnative

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.core.content.ContextCompat
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.audio.DefaultAudioSink
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.URI
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.math.max
import kotlin.math.min

/**
 * 1:1 Android parity implementation of iOS NativePlaybackEngine.swift.
 * Single main-thread authority owning ExoPlayer, C++20 JNI AudioDSP (10-band EQ + 32-band FFT),
 * AudioCache, PlaybackSleepTimer, 20ms fade in/out, listening telemetry, and MediaSession metadata.
 */
@UnstableApi
internal class NativePlaybackEngine private constructor(private val appContext: Context) {
  companion object {
    @Volatile private var instance: NativePlaybackEngine? = null

    fun getInstance(context: Context): NativePlaybackEngine {
      return instance ?: synchronized(this) {
        instance ?: NativePlaybackEngine(context.applicationContext).also { instance = it }
      }
    }
  }

  private val mainHandler = Handler(Looper.getMainLooper())
  private val bgExecutor = Executors.newCachedThreadPool()
  private val httpClient = OkHttpClient.Builder()
    .connectTimeout(20, TimeUnit.SECONDS)
    .readTimeout(30, TimeUnit.SECONDS)
    .followRedirects(true)
    .build()

  val audioCache = AudioCache(File(appContext.cacheDir, "NexusAudio"))
  private val dsp = NexusAudioDSP()
  private val dspProcessor = NexusDspAudioProcessor(dsp)

  @Volatile private var emitCallback: ((String, Map<String, Any>) -> Unit)? = null
  private var exoPlayer: ExoPlayer? = null

  private var generation = 0
  private var entryId = ""
  private var systemItemId = ""
  private var systemFavorite = false
  private var wantsPlay = false
  private var playbackRate = 1.0f
  private var targetVolume = 1.0f
  private var mixWithOthers = false
  private var fadeEnabled = false
  private var fadeDurationMs = 500
  private var fadeGeneration = 0
  private var fadeRunnable: Runnable? = null

  private var systemLyricLine: String? = null
  private var systemLyricPosition = "artist"
  private var systemArtworkBytes: ByteArray? = null
  private var artworkRevision = 0

  private var metadataTitle = "音枢"
  private var metadataArtist = ""
  private var metadataAlbum = ""

  private var cacheKey: String? = null
  private var cachedPlayback = false
  private var originalPayloadJson: String? = null
  private var originalPayloadObj: JSONObject? = null
  private var knownDuration = 0.0
  private var initialPosition = 0.0
  private var initialSeekPending = false
  private var reportedReady = false
  private var eqEnabled = false
  private var eqGains = List(10) { 0.0 }
  private var eqPreampDB = 0.0

  private var listeningSession = UUID.randomUUID().toString()
  private var listenedSeconds = 0.0
  private var listeningClockSec = SystemClock.elapsedRealtime() / 1000.0
  private var wasActuallyPlaying = false

  private val sleepTimer = PlaybackSleepTimer(
    changed = { body -> emit("sleep", body) },
    expired = { remotePause() }
  )

  private val progressTicker = object : Runnable {
    override fun run() {
      val p = exoPlayer
      if (p != null && entryId.isNotEmpty() && p.isPlaying) {
        report("progress")
      }
      mainHandler.postDelayed(this, 500L)
    }
  }

  private val listeningTicker = object : Runnable {
    override fun run() {
      val p = exoPlayer
      if (p != null && entryId.isNotEmpty() && p.isPlaying) {
        report("listening")
      }
      mainHandler.postDelayed(this, 5000L)
    }
  }

  private val spectrumTicker = object : Runnable {
    override fun run() {
      val p = exoPlayer
      if (p != null && entryId.isNotEmpty() && p.isPlaying) {
        val snap = dsp.snapshot().toMutableMap()
        snap["entryId"] = entryId
        snap["generation"] = generation
        emit("spectrum", snap)
      }
      mainHandler.postDelayed(this, 100L)
    }
  }

  init {
    mainHandler.postDelayed(progressTicker, 500L)
    mainHandler.postDelayed(listeningTicker, 5000L)
    mainHandler.postDelayed(spectrumTicker, 100L)
  }

  fun attachEmitter(callback: ((String, Map<String, Any>) -> Unit)?) {
    emitCallback = callback
  }

  fun hasActiveEntry(): Boolean = entryId.isNotEmpty() && systemItemId.isNotEmpty()

  fun getOrCreatePlayer(): ExoPlayer {
    exoPlayer?.let { return it }
    val renderersFactory = object : DefaultRenderersFactory(appContext) {
      override fun buildAudioSink(
        context: Context,
        enableFloatOutput: Boolean,
        enableAudioTrackPlaybackParams: Boolean
      ): AudioSink {
        return DefaultAudioSink.Builder(context)
          .setEnableFloatOutput(enableFloatOutput)
          .setEnableAudioTrackPlaybackParams(enableAudioTrackPlaybackParams)
          .setAudioProcessors(arrayOf(dspProcessor))
          .build()
      }
    }
    val attrs = AudioAttributes.Builder()
      .setUsage(C.USAGE_MEDIA)
      .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
      .build()

    val player = ExoPlayer.Builder(appContext, renderersFactory)
      .setAudioAttributes(attrs, !mixWithOthers)
      .setHandleAudioBecomingNoisy(true)
      .build()

    player.addListener(object : Player.Listener {
      override fun onPlaybackStateChanged(playbackState: Int) {
        if (entryId.isEmpty()) return
        when (playbackState) {
          Player.STATE_READY -> {
            val durMs = player.duration
            if (durMs != C.TIME_UNSET && durMs > 0L) {
              knownDuration = durMs / 1000.0
            }
            if (!reportedReady) {
              reportedReady = true
              report("ready", mapOf("cached" to cachedPlayback))
              if (initialSeekPending && initialPosition > 0.0) {
                initialSeekPending = false
                val targetMs = if (knownDuration > 0.0) {
                  (min(initialPosition, knownDuration) * 1000.0).toLong()
                } else {
                  (initialPosition * 1000.0).toLong()
                }
                player.seekTo(targetMs)
              } else {
                initialSeekPending = false
              }
              if (wantsPlay) startPlaybackWithFade()
            } else {
              report("status")
            }
          }
          Player.STATE_BUFFERING -> report("status")
          Player.STATE_ENDED -> {
            if (!sleepTimer.ended(entryId)) {
              report("ended")
            }
          }
          Player.STATE_IDLE -> Unit
        }
      }

      override fun onIsPlayingChanged(isPlaying: Boolean) {
        if (entryId.isNotEmpty()) {
          report("status")
        }
      }

      override fun onPlayerError(error: PlaybackException) {
        if (entryId.isEmpty()) return
        if (retryCorruptCache()) return
        wantsPlay = false
        player.pause()
        invalidateCachedPlayback()
        report("error")
      }
    })

    player.volume = targetVolume
    player.playbackParameters = PlaybackParameters(playbackRate)
    exoPlayer = player
    return player
  }

  private fun ensureMediaServiceStarted() {
    try {
      val intent = Intent(appContext, NexusMediaPlaybackService::class.java)
      appContext.startService(intent)
    } catch (_: Throwable) {
      // MediaSessionService promotes itself to foreground via Media3 notification provider
      // whenever active playback runs; if background-start restrictions block startService
      // while app is backgrounded, ExoPlayer still continues in-process.
    }
  }

  fun handleSystemCommand(action: String, seconds: Double? = null, favorite: Boolean? = null) {
    if (Looper.myLooper() != Looper.getMainLooper()) {
      mainHandler.post { handleSystemCommand(action, seconds, favorite) }
      return
    }
    if (!hasActiveEntry()) return
    if (action == "pause" || (action == "toggle" && wantsPlay)) {
      remotePause()
      return
    }
    if (action == "play" || action == "toggle") {
      play(entryId, generation)
    }
    if (action == "seek") {
      if (seconds == null || !seconds.isFinite() || seconds < 0.0) return
      seek(seconds, entryId, generation)
    }
    val body = mutableMapOf<String, Any>(
      "action" to (if (action == "toggle") "play" else action),
      "entryId" to entryId,
      "itemID" to systemItemId,
      "generation" to generation
    )
    if (action == "seek" && seconds != null) body["seconds"] = seconds
    if (action == "favorite" && favorite != null) body["favorite"] = favorite
    emit("remote", body)
  }

  fun load(json: String, id: String, newGeneration: Int) {
    if (newGeneration < generation) return
    sleepTimer.trackChanged(id)
    stop(newGeneration, preservingSleep = true)
    entryId = id
    listeningSession = UUID.randomUUID().toString()
    listenedSeconds = 0.0
    listeningClockSec = SystemClock.elapsedRealtime() / 1000.0
    wasActuallyPlaying = false

    val obj = try {
      JSONObject(json)
    } catch (_: Throwable) {
      report("error")
      return
    }
    val rawUrl = obj.optString("url", "")
    val parsedUri = try {
      URI(rawUrl)
    } catch (_: Throwable) {
      null
    }
    val scheme = parsedUri?.scheme?.lowercase() ?: ""
    if (rawUrl.isEmpty() || scheme !in setOf("http", "https", "file", "content")) {
      report("error")
      return
    }

    originalPayloadJson = json
    originalPayloadObj = obj
    systemItemId = obj.optString("systemItemID", "$newGeneration:$id")
    systemFavorite = obj.optBoolean("systemFavorite", false)

    val meta = obj.optJSONObject("metadata")
    metadataTitle = meta?.optString("title", "音枢")?.ifBlank { "音枢" } ?: "音枢"
    metadataArtist = meta?.optString("artist", "") ?: ""
    metadataAlbum = meta?.optString("album", "") ?: ""

    val startPos = obj.optDouble("startPosition", 0.0)
    initialPosition = if (startPos.isFinite() && startPos >= 0.0) startPos else 0.0
    initialSeekPending = true
    reportedReady = false
    knownDuration = 0.0

    val reqCacheKey = obj.optString("cacheKey", "").ifBlank { null }
    cacheKey = reqCacheKey
    if (reqCacheKey != null) audioCache.retain(reqCacheKey)

    val skipCache = obj.optBoolean("skipCache", false)
    val cachedFile = if (skipCache || reqCacheKey == null) null else audioCache.hit(reqCacheKey)
    if (obj.optBoolean("cacheOnly", false) && cachedFile == null) {
      report("error")
      return
    }
    cachedPlayback = cachedFile != null

    val headers = mutableMapOf<String, String>()
    val hdrObj = obj.optJSONObject("headers")
    if (hdrObj != null) {
      val keys = hdrObj.keys()
      while (keys.hasNext()) {
        val k = keys.next()
        hdrObj.optString(k)?.let { headers[k] = it }
      }
    }

    val player = getOrCreatePlayer()
    dsp.configure(eqEnabled, eqGains, eqPreampDB)

    val mediaUri = if (cachedFile != null) Uri.fromFile(cachedFile) else Uri.parse(rawUrl)
    val mediaItem = MediaItem.Builder()
      .setUri(mediaUri)
      .setMediaId(systemItemId)
      .setMediaMetadata(buildMediaMetadata())
      .build()

    val okFactory = OkHttpDataSource.Factory(httpClient).apply {
      if (headers.isNotEmpty()) setDefaultRequestProperties(headers)
    }
    val dataSourceFactory = DefaultDataSource.Factory(appContext, okFactory)
    val mediaSource = DefaultMediaSourceFactory(dataSourceFactory).createMediaSource(mediaItem)

    player.setMediaSource(mediaSource)
    player.prepare()
    player.playWhenReady = wantsPlay

    // Opportunistically cache remote non-HLS tracks into AudioCache in background for offline/repeat hits.
    if (cachedFile == null && reqCacheKey != null && (scheme == "http" || scheme == "https") && !rawUrl.contains(".m3u8", true)) {
      prefetchToAudioCache(reqCacheKey, rawUrl, headers)
    }
  }

  private fun prefetchToAudioCache(key: String, url: String, headers: Map<String, String>) {
    bgExecutor.execute {
      if (audioCache.hit(key) != null) return@execute
      val (tmp, epoch) = audioCache.beginTempFile()
      try {
        val reqBuilder = Request.Builder().url(url)
        headers.forEach { (k, v) -> reqBuilder.header(k, v) }
        httpClient.newCall(reqBuilder.build()).execute().use { resp ->
          if (!resp.isSuccessful) {
            tmp.delete()
            return@execute
          }
          val body = resp.body ?: run { tmp.delete(); return@execute }
          val mime = resp.header("Content-Type")
          val len = body.contentLength()
          val maxLimit = (audioCache.statistics()["limitBytes"] as? Long) ?: (256L * 1024L * 1024L)
          if (len > maxLimit) {
            tmp.delete()
            return@execute
          }
          var written = 0L
          FileOutputStream(tmp).use { out ->
            val buf = ByteArray(16_384)
            body.byteStream().use { input ->
              while (true) {
                val n = input.read(buf)
                if (n <= 0) break
                written += n
                if (written > maxLimit) {
                  tmp.delete()
                  return@execute
                }
                out.write(buf, 0, n)
              }
            }
          }
          audioCache.commitTempFile(key, tmp, epoch, mime)
        }
      } catch (_: Throwable) {
        tmp.delete()
      }
    }
  }

  fun play(id: String, newGeneration: Int) {
    if (newGeneration != generation || entryId != id) return
    wantsPlay = true
    ensureMediaServiceStarted()
    val player = getOrCreatePlayer()
    if (player.playbackState == Player.STATE_READY && !initialSeekPending) {
      startPlaybackWithFade()
    } else {
      player.playWhenReady = true
    }
    report("status")
  }

  fun pause(newGeneration: Int, immediate: Boolean = false) {
    if (newGeneration < generation) return
    generation = newGeneration
    wantsPlay = false
    cancelFade()
    val player = exoPlayer
    if (player != null && !immediate && fadeEnabled && fadeDurationMs >= 100 && player.isPlaying) {
      val startVol = player.volume
      val steps = max(1, fadeDurationMs / 20)
      var currentStep = 0
      val token = fadeGeneration
      val runnable = object : Runnable {
        override fun run() {
          if (fadeGeneration != token || wantsPlay) return
          currentStep++
          val ratio = max(0f, 1f - currentStep.toFloat() / steps.toFloat())
          player.volume = startVol * ratio
          if (currentStep >= steps) {
            fadeRunnable = null
            player.pause()
            player.volume = targetVolume
            report("paused")
          } else {
            mainHandler.postDelayed(this, 20L)
          }
        }
      }
      fadeRunnable = runnable
      mainHandler.postDelayed(runnable, 20L)
      return
    }
    player?.pause()
    player?.volume = targetVolume
    report("paused")
  }

  private fun remotePause() {
    val id = entryId
    val itemID = systemItemId
    pause(generation + 1, immediate = true)
    emit("remote", mapOf("action" to "pause", "generation" to generation, "entryId" to id, "itemID" to itemID))
  }

  fun stop(newGeneration: Int, preservingSleep: Boolean = false) {
    if (newGeneration < generation) return
    if (entryId.isNotEmpty()) report("stopped")
    if (!preservingSleep) sleepTimer.trackChanged("")
    generation = newGeneration
    wantsPlay = false
    cancelFade(restoreVolume = true)
    exoPlayer?.stop()
    exoPlayer?.clearMediaItems()
    cacheKey?.let { audioCache.release(it) }
    cacheKey = null
    cachedPlayback = false
    originalPayloadJson = null
    originalPayloadObj = null
    entryId = ""
    systemItemId = ""
    systemFavorite = false
    systemArtworkBytes = null
    systemLyricLine = null
    artworkRevision += 1
    knownDuration = 0.0
    initialPosition = 0.0
    initialSeekPending = false
    reportedReady = false
  }

  fun seek(seconds: Double, id: String, newGeneration: Int) {
    if (!seconds.isFinite() || seconds < 0.0 || id != entryId || newGeneration != generation) return
    val player = exoPlayer ?: return
    val durSec = if (player.duration != C.TIME_UNSET && player.duration > 0L) player.duration / 1000.0 else knownDuration
    val clamped = if (durSec > 0.0) min(seconds, durSec) else seconds
    player.seekTo((clamped * 1000.0).toLong())
    report("seek")
  }

  fun configureVolume(value: Double) {
    if (!value.isFinite()) return
    targetVolume = value.coerceIn(0.0, 1.0).toFloat()
    cancelFade(restoreVolume = true)
  }

  fun configureRate(value: Double) {
    if (!value.isFinite()) return
    playbackRate = value.coerceIn(0.5, 3.0).toFloat()
    exoPlayer?.playbackParameters = PlaybackParameters(playbackRate)
  }

  fun configureMixWithOthers(enabled: Boolean) {
    mixWithOthers = enabled
    val attrs = AudioAttributes.Builder()
      .setUsage(C.USAGE_MEDIA)
      .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
      .build()
    exoPlayer?.setAudioAttributes(attrs, !enabled)
  }

  fun configureFade(enabled: Boolean, durationMs: Int) {
    fadeEnabled = enabled
    fadeDurationMs = durationMs.coerceIn(100, 3000)
  }

  fun configureSleep(seconds: Double, finishCurrent: Boolean): Map<String, Any> {
    if (finishCurrent && entryId.isEmpty()) return sleepTimer.snapshot()
    sleepTimer.set(if (finishCurrent) 0.0 else seconds, if (finishCurrent) entryId else null)
    return sleepTimer.snapshot()
  }

  fun sleepSnapshot(): Map<String, Any> = sleepTimer.snapshot()

  fun configureEQ(enabled: Boolean, gains: List<Double>, preampDB: Double) {
    if (!preampDB.isFinite() || gains.size != 10 || gains.any { !it.isFinite() }) return
    eqEnabled = enabled
    eqPreampDB = preampDB.coerceIn(-12.0, 12.0)
    eqGains = gains.map { it.coerceIn(-12.0, 12.0) }
    dsp.configure(eqEnabled, eqGains, eqPreampDB)
  }

  fun setSystemFavorite(favorite: Boolean, itemId: String) {
    if (itemId.isEmpty() || itemId != systemItemId) return
    systemFavorite = favorite
  }

  fun setSystemLyricLine(line: String?, position: String, itemId: String) {
    if (itemId.isEmpty() || itemId != systemItemId) return
    val trimmed = line?.trim().orEmpty()
    systemLyricLine = trimmed.ifEmpty { null }
    systemLyricPosition = if (position == "title") "title" else "artist"
    refreshMediaItemMetadata()
  }

  fun setSystemArtwork(raw: String, itemId: String) {
    if (itemId.isEmpty() || itemId != systemItemId) return
    artworkRevision += 1
    val rev = artworkRevision
    systemArtworkBytes = null
    refreshMediaItemMetadata()
    val parsed = Uri.parse(raw)
    if (parsed.scheme != "file") return
    val file = File(parsed.path ?: return)
    bgExecutor.execute {
      if (!file.isFile || file.length() <= 0L || file.length() > 8L * 1024L * 1024L) return@execute
      val bytes = try {
        file.readBytes()
      } catch (_: Throwable) {
        return@execute
      }
      mainHandler.post {
        if (systemItemId == itemId && artworkRevision == rev) {
          systemArtworkBytes = bytes
          refreshMediaItemMetadata()
        }
      }
    }
  }

  private fun buildMediaMetadata(): MediaMetadata {
    var title = metadataTitle
    var artist = metadataArtist
    val p = exoPlayer
    if (wantsPlay && p?.isPlaying == true && !systemLyricLine.isNullOrEmpty()) {
      if (systemLyricPosition == "title") title = systemLyricLine!! else artist = systemLyricLine!!
    }
    val builder = MediaMetadata.Builder()
      .setTitle(title)
      .setDisplayTitle(title)
      .setSubtitle(artist)
      .setArtist(artist)
      .setAlbumTitle(metadataAlbum)
    systemArtworkBytes?.let { bytes ->
      builder.setArtworkData(bytes, MediaMetadata.PICTURE_TYPE_FRONT_COVER)
    }
    return builder.build()
  }

  private fun refreshMediaItemMetadata() {
    val player = exoPlayer ?: return
    if (player.mediaItemCount == 0 || entryId.isEmpty()) return
    val current = player.currentMediaItem ?: return
    val updated = current.buildUpon().setMediaMetadata(buildMediaMetadata()).build()
    player.replaceMediaItem(player.currentMediaItemIndex, updated)
  }

  private fun cancelFade(restoreVolume: Boolean = false) {
    fadeRunnable?.let { mainHandler.removeCallbacks(it) }
    fadeRunnable = null
    fadeGeneration += 1
    if (restoreVolume) exoPlayer?.volume = targetVolume
  }

  private fun startPlaybackWithFade() {
    cancelFade()
    val player = exoPlayer ?: return
    player.playbackParameters = PlaybackParameters(playbackRate)
    if (fadeEnabled && fadeDurationMs >= 100 && targetVolume > 0f) {
      val steps = max(1, fadeDurationMs / 20)
      var currentStep = 0
      val token = fadeGeneration
      player.volume = 0f
      player.play()
      val runnable = object : Runnable {
        override fun run() {
          if (fadeGeneration != token || !wantsPlay) return
          currentStep++
          val ratio = min(1f, currentStep.toFloat() / steps.toFloat())
          player.volume = targetVolume * ratio
          if (currentStep >= steps) {
            fadeRunnable = null
            player.volume = targetVolume
          } else {
            mainHandler.postDelayed(this, 20L)
          }
        }
      }
      fadeRunnable = runnable
      mainHandler.postDelayed(runnable, 20L)
    } else {
      player.volume = targetVolume
      player.play()
    }
  }

  private fun retryCorruptCache(): Boolean {
    val payloadObj = originalPayloadObj ?: return false
    if (!cachedPlayback) return false
    invalidateCachedPlayback()
    payloadObj.put("skipCache", true)
    val resume = wantsPlay
    val id = entryId
    val gen = generation
    load(payloadObj.toString(), id, gen)
    if (resume) play(id, gen)
    return true
  }

  private fun invalidateCachedPlayback() {
    if (cachedPlayback) {
      cacheKey?.let { audioCache.invalidate(it) }
    }
    cachedPlayback = false
  }

  private fun report(kind: String, extra: Map<String, Any> = emptyMap()) {
    val nowSec = SystemClock.elapsedRealtime() / 1000.0
    if (wasActuallyPlaying) {
      listenedSeconds += max(0.0, nowSec - listeningClockSec)
    }
    listeningClockSec = nowSec
    val p = exoPlayer
    val isPlaying = p?.isPlaying == true
    val isBuffering = p?.playbackState == Player.STATE_BUFFERING
    wasActuallyPlaying = isPlaying && wantsPlay && kind !in setOf("ended", "stopped", "error")

    val posSec = p?.currentPosition?.takeIf { it >= 0L }?.let { it / 1000.0 } ?: 0.0
    val itemDurSec = p?.duration?.takeIf { it != C.TIME_UNSET && it > 0L }?.let { it / 1000.0 } ?: 0.0
    val duration = if (itemDurSec > 0.0) itemDurSec else knownDuration

    val payload = mutableMapOf<String, Any>(
      "kind" to kind,
      "entryId" to entryId,
      "generation" to generation,
      "position" to posSec,
      "duration" to duration,
      "playing" to isPlaying,
      "buffering" to isBuffering,
      "listeningSession" to listeningSession,
      "listenedMs" to (listenedSeconds * 1000.0)
    )
    payload.putAll(extra)
    emit("playback", payload)
  }

  private fun emit(event: String, body: Map<String, Any>) {
    emitCallback?.invoke(event, body)
  }
}
