package com.nexusmusic.nexusnative

import android.os.Handler
import android.os.Looper

/**
 * 1:1 Android parity implementation of iOS PlaybackSleepTimer.swift.
 * Playback-scoped timer independent of JS event loop.
 */
internal class PlaybackSleepTimer(
  private val now: () -> Double = { System.currentTimeMillis().toDouble() },
  private val schedule: (Double, () -> Unit) -> () -> Unit = { seconds, action ->
    val handler = Handler(Looper.getMainLooper())
    val runnable = Runnable { action() }
    handler.postDelayed(runnable, (seconds * 1000.0).toLong().coerceAtLeast(1L))
    ({ handler.removeCallbacks(runnable) })
  },
  private val changed: (Map<String, Any>) -> Unit,
  private val expired: () -> Unit
) {
  private var revision = 0
  private var cancelTask: (() -> Unit)? = null
  private var deadline: Double? = null
  private var entry: String? = null

  fun snapshot(): Map<String, Any> {
    deadline?.let { return mapOf("mode" to "duration", "deadline" to it, "revision" to revision) }
    entry?.let { return mapOf("mode" to "track", "entryId" to it, "revision" to revision) }
    return mapOf("mode" to "off", "revision" to revision)
  }

  fun set(seconds: Double, entryId: String?): Boolean {
    if (!seconds.isFinite() || seconds < 0.0 || seconds > 86_400.0 || (seconds != 0.0 && entryId != null)) {
      return false
    }
    reset()
    if (!entryId.isNullOrEmpty()) {
      entry = entryId
    } else if (seconds > 0.0) {
      deadline = now() + seconds * 1000.0
      val token = revision
      cancelTask = schedule(seconds) {
        if (revision == token && deadline != null) {
          reset()
          changed(snapshot())
          expired()
        }
      }
    }
    changed(snapshot())
    return true
  }

  fun trackChanged(toId: String) {
    if (entry != null && entry != toId) {
      reset()
      changed(snapshot())
    }
  }

  fun ended(id: String): Boolean {
    if (entry != id) return false
    reset()
    changed(snapshot())
    expired()
    return true
  }

  fun dispose() {
    reset()
  }

  private fun reset() {
    revision += 1
    cancelTask?.invoke()
    cancelTask = null
    deadline = null
    entry = null
  }
}
