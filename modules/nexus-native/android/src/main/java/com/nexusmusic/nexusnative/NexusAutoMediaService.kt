package com.nexusmusic.nexusnative

import android.media.MediaDescription
import android.media.browse.MediaBrowser
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Bundle
import android.service.media.MediaBrowserService
import org.json.JSONArray
import org.json.JSONObject

/**
 * Thread-safe shared bridge for Android Auto browse tree and car/voice commands.
 */
object NexusCarBridgeStore {
  private val lock = Any()
  private var catalogJson: String = "{}"
  private var catalogTracks: Int = 0
  private var catalogPlaylists: Int = 0
  private val pendingCommands = mutableListOf<Map<String, Any>>()
  private var commandHandler: ((Map<String, Any>) -> Unit)? = null

  fun setCommandHandler(handler: ((Map<String, Any>) -> Unit)?) {
    synchronized(lock) { commandHandler = handler }
  }

  fun updateCatalog(json: String) {
    var tracks = 0
    var playlists = 0
    try {
      val obj = JSONObject(json)
      tracks = (obj.optJSONArray("favorites")?.length() ?: 0) + (obj.optJSONArray("recent")?.length() ?: 0)
      playlists = obj.optJSONArray("playlists")?.length() ?: 0
    } catch (_: Throwable) {
    }
    synchronized(lock) {
      catalogJson = json
      catalogTracks = tracks
      catalogPlaylists = playlists
    }
  }

  fun currentCatalogObject(): JSONObject {
    val raw = synchronized(lock) { catalogJson }
    return try {
      JSONObject(raw)
    } catch (_: Throwable) {
      JSONObject()
    }
  }

  fun dispatchCommand(command: Map<String, Any>) {
    val handler = synchronized(lock) {
      val h = commandHandler
      if (h == null) {
        pendingCommands.add(command)
        if (pendingCommands.size > 20) pendingCommands.removeAt(0)
      }
      h
    }
    handler?.invoke(command)
  }

  fun consumePendingCommands(): List<Map<String, Any>> {
    synchronized(lock) {
      val out = pendingCommands.toList()
      pendingCommands.clear()
      return out
    }
  }

  fun statusSnapshot(): Map<String, Any> {
    synchronized(lock) {
      return mapOf(
        "platform" to "android",
        "carPlayCodeReady" to false,
        "carPlayEntitlementActive" to false,
        "siriIntentsAvailable" to false,
        "androidAutoServiceReady" to true,
        "catalogTracks" to catalogTracks,
        "catalogPlaylists" to catalogPlaylists
      )
    }
  }
}

/**
 * Android Auto MediaBrowserService exposing Favorites, Playlists, and Recent tracks
 * backed by NexusCarBridgeStore and forwarding playback intents to JS.
 */
class NexusAutoMediaService : MediaBrowserService() {
  private var mediaSession: MediaSession? = null

  override fun onCreate() {
    super.onCreate()
    val session = MediaSession(this, "NexusAutoMediaSession").apply {
      setCallback(object : MediaSession.Callback() {
        override fun onPlay() {
          NexusCarBridgeStore.dispatchCommand(mapOf("source" to "android-auto", "action" to "resume"))
        }

        override fun onPause() {
          NexusCarBridgeStore.dispatchCommand(mapOf("source" to "android-auto", "action" to "pause"))
        }

        override fun onSkipToNext() {
          NexusCarBridgeStore.dispatchCommand(mapOf("source" to "android-auto", "action" to "next"))
        }

        override fun onSkipToPrevious() {
          NexusCarBridgeStore.dispatchCommand(mapOf("source" to "android-auto", "action" to "previous"))
        }

        override fun onPlayFromMediaId(mediaId: String?, extras: Bundle?) {
          val id = mediaId ?: return
          when {
            id.startsWith("fav:") -> {
              val idx = id.removePrefix("fav:").toIntOrNull() ?: 0
              NexusCarBridgeStore.dispatchCommand(
                mapOf("source" to "android-auto", "action" to "playSectionTrack", "section" to "favorites", "index" to idx)
              )
            }
            id.startsWith("recent:") -> {
              val idx = id.removePrefix("recent:").toIntOrNull() ?: 0
              NexusCarBridgeStore.dispatchCommand(
                mapOf("source" to "android-auto", "action" to "playSectionTrack", "section" to "recent", "index" to idx)
              )
            }
            id.startsWith("playlist:") -> {
              val plId = id.removePrefix("playlist:")
              NexusCarBridgeStore.dispatchCommand(
                mapOf("source" to "android-auto", "action" to "playPlaylist", "id" to plId)
              )
            }
          }
        }
      })
      setPlaybackState(
        PlaybackState.Builder()
          .setActions(
            PlaybackState.ACTION_PLAY or
              PlaybackState.ACTION_PAUSE or
              PlaybackState.ACTION_PLAY_PAUSE or
              PlaybackState.ACTION_SKIP_TO_NEXT or
              PlaybackState.ACTION_SKIP_TO_PREVIOUS or
              PlaybackState.ACTION_PLAY_FROM_MEDIA_ID
          )
          .setState(PlaybackState.STATE_PAUSED, 0L, 1f)
          .build()
      )
      isActive = true
    }
    mediaSession = session
    sessionToken = session.sessionToken
  }

  override fun onDestroy() {
    mediaSession?.release()
    mediaSession = null
    super.onDestroy()
  }

  override fun onGetRoot(
    clientPackageName: String,
    clientUid: Int,
    rootHints: Bundle?
  ): BrowserRoot {
    return BrowserRoot("nexus_root", null)
  }

  override fun onLoadChildren(
    parentId: String,
    result: Result<MutableList<MediaBrowser.MediaItem>>
  ) {
    val items = mutableListOf<MediaBrowser.MediaItem>()
    val catalog = NexusCarBridgeStore.currentCatalogObject()
    when (parentId) {
      "nexus_root" -> {
        items.add(browsable("node_favorites", "我的收藏", "音枢本地收藏歌曲"))
        items.add(browsable("node_playlists", "我的歌单", "音枢自建与导入歌单"))
        items.add(browsable("node_recent", "最近播放", "近期播放历史"))
      }
      "node_favorites" -> appendTracks(items, "fav", catalog.optJSONArray("favorites"))
      "node_recent" -> appendTracks(items, "recent", catalog.optJSONArray("recent"))
      "node_playlists" -> {
        val pls = catalog.optJSONArray("playlists") ?: JSONArray()
        for (i in 0 until pls.length()) {
          val pl = pls.optJSONObject(i) ?: continue
          val plId = pl.optString("id", "")
          if (plId.isEmpty()) continue
          val title = pl.optString("title", "未命名歌单")
          val count = pl.optInt("count", 0)
          items.add(playable("playlist:$plId", title, "$count 首歌曲"))
        }
      }
    }
    result.sendResult(items)
  }

  private fun appendTracks(out: MutableList<MediaBrowser.MediaItem>, prefix: String, arr: JSONArray?) {
    if (arr == null) return
    for (i in 0 until arr.length()) {
      val obj = arr.optJSONObject(i) ?: continue
      val title = obj.optString("title", "未知歌曲")
      val artist = obj.optString("artist", "")
      out.add(playable("$prefix:$i", title, artist))
    }
  }

  private fun browsable(id: String, title: String, subtitle: String): MediaBrowser.MediaItem {
    val desc = MediaDescription.Builder().setMediaId(id).setTitle(title).setSubtitle(subtitle).build()
    return MediaBrowser.MediaItem(desc, MediaBrowser.MediaItem.FLAG_BROWSABLE)
  }

  private fun playable(id: String, title: String, subtitle: String): MediaBrowser.MediaItem {
    val desc = MediaDescription.Builder().setMediaId(id).setTitle(title).setSubtitle(subtitle).build()
    return MediaBrowser.MediaItem(desc, MediaBrowser.MediaItem.FLAG_PLAYABLE)
  }
}
