package com.nexusmusic.nexusnative

import android.content.Intent
import androidx.media3.common.ForwardingPlayer
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

/**
 * Foreground MediaSessionService hosting the authoritative ExoPlayer instance so background
 * playback, lock-screen media controls, and Bluetooth/headset keys stay alive when JS sleeps.
 */
@UnstableApi
class NexusMediaPlaybackService : MediaSessionService() {
  private var mediaSession: MediaSession? = null

  override fun onCreate() {
    super.onCreate()
    val engine = NativePlaybackEngine.getInstance(applicationContext)
    val player = engine.getOrCreatePlayer()
    val forwarding = object : ForwardingPlayer(player) {
      override fun play() {
        engine.handleSystemCommand("play")
      }

      override fun pause() {
        engine.handleSystemCommand("pause")
      }

      override fun seekToNext() {
        engine.handleSystemCommand("next")
      }

      override fun seekToNextMediaItem() {
        engine.handleSystemCommand("next")
      }

      override fun seekToPrevious() {
        engine.handleSystemCommand("previous")
      }

      override fun seekToPreviousMediaItem() {
        engine.handleSystemCommand("previous")
      }

      override fun seekTo(positionMs: Long) {
        engine.handleSystemCommand("seek", seconds = positionMs / 1000.0)
      }

      override fun getAvailableCommands(): Player.Commands {
        return super.getAvailableCommands().buildUpon()
          .addAll(
            Player.COMMAND_PLAY_PAUSE,
            Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM,
            Player.COMMAND_SEEK_TO_NEXT,
            Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
            Player.COMMAND_SEEK_TO_PREVIOUS,
            Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM,
            Player.COMMAND_GET_CURRENT_MEDIA_ITEM,
            Player.COMMAND_GET_METADATA
          )
          .build()
      }

      override fun isCommandAvailable(command: Int): Boolean {
        return when (command) {
          Player.COMMAND_SEEK_TO_NEXT,
          Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
          Player.COMMAND_SEEK_TO_PREVIOUS,
          Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM -> engine.hasActiveEntry()
          else -> super.isCommandAvailable(command)
        }
      }
    }

    mediaSession = MediaSession.Builder(this, forwarding)
      .setId("NexusMusicSession")
      .build()
  }

  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = mediaSession

  override fun onTaskRemoved(rootIntent: Intent?) {
    val player = mediaSession?.player
    if (player == null || !player.playWhenReady || player.mediaItemCount == 0) {
      stopSelf()
    }
  }

  override fun onDestroy() {
    mediaSession?.release()
    mediaSession = null
    super.onDestroy()
  }
}
