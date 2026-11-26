package com.nexusmusic.nexusnative

import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * Android playback module exposing the exact same 18 functions and 4 events as iOS NexusPlaybackModule.
 * Already wired to the shared C++20 [NexusAudioDSP] JNI engine; Media3 ExoPlayer + MediaSessionService
 * audio pipeline lands in Phase 1.
 */
class NexusPlaybackModule : Module() {
  private val dsp = NexusAudioDSP()
  private var cacheLimitBytes: Long = 512L * 1024L * 1024L
  private var sleepMode: String = "off"
  private var sleepRemainingSeconds: Double = 0.0

  override fun definition() = ModuleDefinition {
    Name("NexusPlayback")
    Events("playback", "spectrum", "remote", "sleep")

    AsyncFunction("cacheStatistics") {
      val dir = audioCacheDir()
      val files = dir.listFiles().orEmpty()
      mapOf(
        "bytes" to files.sumOf { it.length() },
        "files" to files.size,
        "limitBytes" to cacheLimitBytes
      )
    }

    AsyncFunction("clearCache") {
      audioCacheDir().listFiles()?.forEach { it.delete() }
    }

    AsyncFunction("configureCache") { megabytes: Int ->
      cacheLimitBytes = megabytes.coerceAtLeast(32).toLong() * 1024L * 1024L
    }

    AsyncFunction("load") { _: String, entryID: String, generation: Int ->
      sendEvent(
        "playback",
        mapOf(
          "kind" to "error",
          "entryId" to entryID,
          "generation" to generation,
          "position" to 0.0,
          "duration" to 0.0,
          "playing" to false,
          "buffering" to false
        )
      )
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setSystemArtwork") { _: String, _: String -> }.runOnQueue(Queues.MAIN)
    AsyncFunction("setSystemFavorite") { _: Boolean, _: String -> }.runOnQueue(Queues.MAIN)
    AsyncFunction("setSystemLyricLine") { _: String?, _: String, _: String -> }.runOnQueue(Queues.MAIN)

    AsyncFunction("play") { _: String, _: Int -> }.runOnQueue(Queues.MAIN)
    AsyncFunction("pause") { _: Int -> }.runOnQueue(Queues.MAIN)
    AsyncFunction("stop") { _: Int -> }.runOnQueue(Queues.MAIN)
    AsyncFunction("seek") { _: Double, _: String, _: Int -> }.runOnQueue(Queues.MAIN)

    AsyncFunction("configureVolume") { _: Double -> }.runOnQueue(Queues.MAIN)
    AsyncFunction("configureRate") { _: Double -> }.runOnQueue(Queues.MAIN)
    AsyncFunction("configureMixWithOthers") { _: Boolean -> }.runOnQueue(Queues.MAIN)
    AsyncFunction("configureFade") { _: Boolean, _: Int -> }.runOnQueue(Queues.MAIN)

    AsyncFunction("configureSleep") { seconds: Double, finishCurrent: Boolean ->
      if (seconds <= 0.0 && !finishCurrent) {
        sleepMode = "off"
        sleepRemainingSeconds = 0.0
      } else if (finishCurrent) {
        sleepMode = "off"
        sleepRemainingSeconds = 0.0
      } else {
        sleepMode = "duration"
        sleepRemainingSeconds = seconds
      }
      val snap = sleepState()
      sendEvent("sleep", snap)
      snap
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("sleepSnapshot") {
      sleepState()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("configureEQ") { enabled: Boolean, gains: List<Double>, preampDB: Double ->
      dsp.configure(enabled, gains, preampDB)
    }.runOnQueue(Queues.MAIN)

    OnDestroy {
      dsp.close()
    }
  }

  private fun audioCacheDir(): File {
    val base = appContext.reactContext?.cacheDir ?: File("/tmp")
    return File(base, "NexusAudioCache").apply { mkdirs() }
  }

  private fun sleepState(): Map<String, Any> = mapOf(
    "mode" to sleepMode,
    "remainingSeconds" to sleepRemainingSeconds,
    "finishCurrent" to (sleepMode == "track")
  )
}
