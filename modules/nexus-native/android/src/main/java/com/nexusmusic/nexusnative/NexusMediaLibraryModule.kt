package com.nexusmusic.nexusnative

import android.Manifest
import android.content.ContentUris
import android.content.pm.PackageManager
import android.database.ContentObserver
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import java.io.File
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.UUID

/**
 * 1:1 Android parity implementation of iOS NexusMediaLibraryModule backed by MediaStore.Audio.
 */
class NexusMediaLibraryModule : Module() {
  private data class MediaItemRow(
    val id: String,
    val uri: Uri,
    val signature: String,
    val title: String,
    val artist: String,
    val album: String,
    val albumArtist: String,
    val durationMs: Double,
    val dateModified: Long
  )

  private val lock = Any()
  private var snapshot: List<MediaItemRow> = emptyList()
  private var snapshotId: String = ""
  private var observer: ContentObserver? = null
  private var covers: CoverCache? = null

  private fun coverCache(): CoverCache {
    covers?.let { return it }
    val base = appContext.reactContext?.cacheDir ?: File("/tmp")
    return CoverCache(File(base, "NexusCovers"), 32L * 1024L * 1024L).also { covers = it }
  }

  override fun definition() = ModuleDefinition {
    Name("NexusMediaLibrary")
    Events("changed")

    AsyncFunction("authorizationStatus") {
      val st = currentStatus()
      if (st != "authorized") invalidateSnapshot()
      st
    }

    AsyncFunction("requestAuthorization") { promise: Promise ->
      val st = currentStatus()
      if (st == "authorized") {
        promise.resolve("authorized")
        return@AsyncFunction
      }
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve(st)
        return@AsyncFunction
      }
      val perm = requiredPermission()
      ActivityCompat.requestPermissions(activity, arrayOf(perm), 4091)
      // Return current status immediately; MediaStore permission dialog updates OS grant and next check sees it.
      promise.resolve(currentStatus())
    }

    AsyncFunction("beginQuery") { search: String ->
      if (currentStatus() != "authorized") throw IllegalStateException("请先授权访问设备媒体库")
      ensureObserverRegistered()
      val ctx = appContext.reactContext ?: throw IllegalStateException("上下文不可用")
      val filterText = search.trim().lowercase()
      val rows = mutableListOf<MediaItemRow>()
      val projection = arrayOf(
        MediaStore.Audio.Media._ID,
        MediaStore.Audio.Media.TITLE,
        MediaStore.Audio.Media.ARTIST,
        MediaStore.Audio.Media.ALBUM,
        MediaStore.Audio.Media.DURATION,
        MediaStore.Audio.Media.DATE_MODIFIED
      )
      val selection = "${MediaStore.Audio.Media.IS_MUSIC} != 0"
      ctx.contentResolver.query(
        MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
        projection,
        selection,
        null,
        "${MediaStore.Audio.Media.DATE_ADDED} DESC"
      )?.use { cursor ->
        val idCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
        val titleCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
        val artistCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
        val albumCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
        val durCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
        val modCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATE_MODIFIED)

        while (cursor.moveToNext()) {
          if (rows.size >= 50_000) throw IllegalStateException("设备媒体库超过当前50000首索引上限")
          val numId = cursor.getLong(idCol)
          if (numId <= 0L) continue
          val title = cursor.getString(titleCol)?.takeIf { it.isNotBlank() } ?: "未知标题"
          val artist = cursor.getString(artistCol)?.takeIf { it.isNotBlank() && it != "<unknown>" } ?: "未知艺术家"
          val album = cursor.getString(albumCol)?.takeIf { it != "<unknown>" } ?: ""
          val durMs = cursor.getLong(durCol).coerceAtLeast(0L).toDouble()
          val modSec = cursor.getLong(modCol)

          if (filterText.isNotEmpty()) {
            val combined = "$title $artist $album".lowercase()
            if (!combined.contains(filterText)) continue
          }
          val uri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, numId)
          val sig = computeSignature(title, artist, album, artist, durMs / 1000.0)
          rows.add(MediaItemRow(numId.toString(), uri, sig, title, artist, album, artist, durMs, modSec))
        }
      }

      val token = UUID.randomUUID().toString()
      synchronized(lock) {
        snapshot = rows
        snapshotId = token
      }
      mapOf("token" to token, "total" to rows.size)
    }

    AsyncFunction("page") { token: String, offset: Int, limit: Int ->
      if (currentStatus() != "authorized") throw IllegalStateException("媒体库未授权")
      synchronized(lock) {
        if (token != snapshotId || offset < 0 || offset > snapshot.size || limit <= 0 || limit > 200) {
          throw IllegalStateException("媒体库已变化，请刷新")
        }
        val end = minOf(snapshot.size, offset + limit)
        snapshot.subList(offset, end).map { item ->
          mapOf(
            "id" to item.id,
            "signature" to item.signature,
            "title" to item.title,
            "artist" to item.artist,
            "album" to item.album,
            "albumArtist" to item.albumArtist,
            "durationMs" to item.durationMs,
            "reason" to ""
          )
        }
      }
    }

    AsyncFunction("resolve") { id: String, expected: String, promise: Promise ->
      try {
        val item = lookupItem(id, expected)
        promise.resolve(item.uri.toString())
      } catch (t: Throwable) {
        promise.reject("MEDIA_RESOLVE_FAILED", t.message ?: "无法读取设备音频", t)
      }
    }

    AsyncFunction("lyrics") { id: String, expected: String ->
      val item = lookupItem(id, expected)
      val ctx = appContext.reactContext ?: return@AsyncFunction null
      val retriever = MediaMetadataRetriever()
      try {
        retriever.setDataSource(ctx, item.uri)
        // Standard Android retriever does not expose USLT directly; return null cleanly when absent.
        null as String?
      } catch (_: Throwable) {
        null as String?
      } finally {
        try {
          retriever.release()
        } catch (_: Throwable) {
        }
      }
    }

    AsyncFunction("artwork") { id: String, expected: String ->
      val item = lookupItem(id, expected)
      val ctx = appContext.reactContext ?: return@AsyncFunction null
      val key = sha256Hex("$id:$expected:${item.dateModified}")
      coverCache().hit(key)?.let { return@AsyncFunction it }
      val retriever = MediaMetadataRetriever()
      try {
        retriever.setDataSource(ctx, item.uri)
        val pic = retriever.embeddedPicture ?: return@AsyncFunction null
        coverCache().store(pic, key, 512, exporting = false)
      } catch (_: Throwable) {
        null
      } finally {
        try {
          retriever.release()
        } catch (_: Throwable) {
        }
      }
    }

    OnDestroy {
      val ctx = appContext.reactContext
      val obs = observer
      if (ctx != null && obs != null) {
        try {
          ctx.contentResolver.unregisterContentObserver(obs)
        } catch (_: Throwable) {
        }
      }
      observer = null
    }
  }

  private fun requiredPermission(): String =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      Manifest.permission.READ_MEDIA_AUDIO
    } else {
      Manifest.permission.READ_EXTERNAL_STORAGE
    }

  private fun currentStatus(): String {
    val ctx = appContext.reactContext ?: return "unavailable"
    val granted = ContextCompat.checkSelfPermission(ctx, requiredPermission()) == PackageManager.PERMISSION_GRANTED
    return if (granted) "authorized" else "notDetermined"
  }

  private fun invalidateSnapshot() = synchronized(lock) {
    snapshot = emptyList()
    snapshotId = ""
  }

  private fun ensureObserverRegistered() {
    val ctx = appContext.reactContext ?: return
    if (observer != null) return
    val obs = object : ContentObserver(Handler(Looper.getMainLooper())) {
      override fun onChange(selfChange: Boolean) {
        invalidateSnapshot()
        try {
          sendEvent("changed", mapOf("status" to currentStatus()))
        } catch (_: Throwable) {
        }
      }
    }
    try {
      ctx.contentResolver.registerContentObserver(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, true, obs)
      observer = obs
    } catch (_: Throwable) {
    }
  }

  private fun lookupItem(id: String, expected: String): MediaItemRow {
    if (currentStatus() != "authorized") throw IllegalStateException("媒体库未授权")
    val numId = id.toLongOrNull() ?: throw IllegalStateException("歌曲标识无效")
    if (numId <= 0L) throw IllegalStateException("歌曲标识无效")
    synchronized(lock) {
      snapshot.firstOrNull { it.id == id && it.signature == expected }?.let { return it }
    }
    val ctx = appContext.reactContext ?: throw IllegalStateException("上下文不可用")
    val uri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, numId)
    val projection = arrayOf(
      MediaStore.Audio.Media.TITLE,
      MediaStore.Audio.Media.ARTIST,
      MediaStore.Audio.Media.ALBUM,
      MediaStore.Audio.Media.DURATION,
      MediaStore.Audio.Media.DATE_MODIFIED
    )
    ctx.contentResolver.query(uri, projection, null, null, null)?.use { cursor ->
      if (!cursor.moveToFirst()) throw IllegalStateException("歌曲已移除，请刷新媒体库")
      val title = cursor.getString(0)?.takeIf { it.isNotBlank() } ?: "未知标题"
      val artist = cursor.getString(1)?.takeIf { it.isNotBlank() && it != "<unknown>" } ?: "未知艺术家"
      val album = cursor.getString(2)?.takeIf { it != "<unknown>" } ?: ""
      val durMs = cursor.getLong(3).coerceAtLeast(0L).toDouble()
      val modSec = cursor.getLong(4)
      val sig = computeSignature(title, artist, album, artist, durMs / 1000.0)
      if (sig != expected) throw IllegalStateException("歌曲信息已更改，请刷新媒体库")
      return MediaItemRow(id, uri, sig, title, artist, album, artist, durMs, modSec)
    }
    throw IllegalStateException("歌曲已移除或不可访问")
  }

  private fun computeSignature(title: String, artist: String, album: String, albumArtist: String, durSec: Double): String {
    val arr = JSONArray().put(title).put(artist).put(album).put(albumArtist).put(durSec.toString())
    return sha256Hex(arr.toString())
  }

  private fun sha256Hex(input: String): String {
    val bytes = MessageDigest.getInstance("SHA-256").digest(input.toByteArray(StandardCharsets.UTF_8))
    return bytes.joinToString("") { "%02x".format(it.toInt() and 0xFF) }
  }
}
