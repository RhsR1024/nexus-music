package com.nexusmusic.nexusnative

import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

@OptIn(UnstableApi::class)
class NexusPlaybackModule : Module() {
  private fun engine(): NativePlaybackEngine {
    val ctx = appContext.reactContext ?: throw IllegalStateException("ReactContext unavailable")
    return NativePlaybackEngine.getInstance(ctx).also { eng ->
      eng.attachEmitter { name, body ->
        try {
          sendEvent(name, body)
        } catch (_: Throwable) {
        }
      }
    }
  }

  override fun definition() = ModuleDefinition {
    Name("NexusPlayback")
    Events("playback", "spectrum", "remote", "sleep")

    OnCreate {
      appContext.reactContext?.let { ctx ->
        NativePlaybackEngine.getInstance(ctx).attachEmitter { name, body ->
          try {
            sendEvent(name, body)
          } catch (_: Throwable) {
          }
        }
      }
    }

    AsyncFunction("cacheStatistics") { engine().audioCache.statistics() }
    AsyncFunction("clearCache") { engine().audioCache.clear() }
    AsyncFunction("configureCache") { megabytes: Int -> engine().audioCache.configure(megabytes) }

    AsyncFunction("load") { json: String, entryID: String, generation: Int ->
      engine().load(json, entryID, generation)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setSystemArtwork") { file: String, itemID: String ->
      engine().setSystemArtwork(file, itemID)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setSystemFavorite") { favorite: Boolean, itemID: String ->
      engine().setSystemFavorite(favorite, itemID)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setSystemLyricLine") { line: String?, position: String, itemID: String ->
      engine().setSystemLyricLine(line, position, itemID)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("play") { entryID: String, generation: Int ->
      engine().play(entryID, generation)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("pause") { generation: Int ->
      engine().pause(generation)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("stop") { generation: Int ->
      engine().stop(generation)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("seek") { seconds: Double, entryID: String, generation: Int ->
      engine().seek(seconds, entryID, generation)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("configureVolume") { value: Double ->
      engine().configureVolume(value)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("configureRate") { value: Double ->
      engine().configureRate(value)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("configureMixWithOthers") { enabled: Boolean ->
      engine().configureMixWithOthers(enabled)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("configureFade") { enabled: Boolean, durationMs: Int ->
      engine().configureFade(enabled, durationMs)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("configureSleep") { seconds: Double, finishCurrent: Boolean ->
      engine().configureSleep(seconds, finishCurrent)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("sleepSnapshot") {
      engine().sleepSnapshot()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("configureEQ") { enabled: Boolean, gains: List<Double>, preampDB: Double ->
      engine().configureEQ(enabled, gains, preampDB)
    }.runOnQueue(Queues.MAIN)

    OnDestroy {
      appContext.reactContext?.let { ctx ->
        NativePlaybackEngine.getInstance(ctx).attachEmitter(null)
      }
    }
  }
}
