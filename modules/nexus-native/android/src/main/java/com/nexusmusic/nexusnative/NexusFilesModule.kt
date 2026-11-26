package com.nexusmusic.nexusnative

import android.app.Activity
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import androidx.core.content.FileProvider
import androidx.documentfile.provider.DocumentFile
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

/**
 * 1:1 Android parity implementation of all 24 methods in iOS NexusFilesModule:
 * - VisualAssets (import/resolve/reconcile + exact 24-bucket HSV flowPalette & dominant palette)
 * - LocalAudioFiles (import/resolve/artwork/transactional removal/reconcile)
 * - SAF persistent folder picking & scanning (pickAudioFolder/retainAudioFolders/scanAudioFolders)
 * - SAF download destination (pick/status/forget/save with collision numbering)
 * - MediaStore QR photo saving (saveLoginQrPhoto/cancelLoginQrPhoto)
 * - FileProvider export & share (stageAudioExport/exportCoverJPEG/exportAudioFiles)
 */
class NexusFilesModule : Module() {
  companion object {
    private const val REQ_PICK_AUDIO_FOLDER = 4101
    private const val REQ_PICK_DOWNLOAD_DEST = 4102
    private val AUDIO_EXTS = setOf("mp3", "flac", "aac", "m4a", "wav", "aiff", "aif")
  }

  private val lock = Any()
  private var pendingFolderPromise: Promise? = null
  private var pendingDestPromise: Promise? = null
  private val cancelledQrIds = ConcurrentHashMap<String, Boolean>()

  private fun reactCtx(): Context = appContext.reactContext ?: throw IllegalStateException("Context unavailable")
  private fun visualsDir(): File = File(reactCtx().filesDir, "nexus-visuals").apply { mkdirs() }
  private fun localAudioDir(): File = File(reactCtx().filesDir, "nexus-audio").apply { mkdirs() }
  private fun pendingDeleteDir(): File = File(localAudioDir(), ".pending-delete").apply { mkdirs() }
  private fun foldersRegistryFile(): File = File(File(reactCtx().filesDir, "nexus-audio-folders").apply { mkdirs() }, "roots.json")
  private fun destRegistryFile(): File = File(File(reactCtx().filesDir, "nexus-download-destination").apply { mkdirs() }, "root.json")

  override fun definition() = ModuleDefinition {
    Name("NexusFiles")

    OnActivityResult { _, payload ->
      when (payload.requestCode) {
        REQ_PICK_AUDIO_FOLDER -> handleFolderResult(payload.resultCode, payload.data)
        REQ_PICK_DOWNLOAD_DEST -> handleDestResult(payload.resultCode, payload.data)
      }
    }

    AsyncFunction("saveLoginQrPhoto") { id: String, image: String, expiresAt: Double, promise: Promise ->
      if (cancelledQrIds.remove(id) == true || System.currentTimeMillis() > expiresAt) {
        promise.resolve(false)
        return@AsyncFunction
      }
      try {
        val raw = image.substringAfter("base64,", image)
        val bytes = Base64.decode(raw, Base64.DEFAULT)
        if (bytes.isEmpty() || bytes.size > 10 * 1024 * 1024) {
          promise.reject("QR_INVALID", "二维码图片无效", null)
          return@AsyncFunction
        }
        val values = ContentValues().apply {
          put(MediaStore.Images.Media.DISPLAY_NAME, "nexus-login-qr-${System.currentTimeMillis()}.png")
          put(MediaStore.Images.Media.MIME_TYPE, "image/png")
          put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/NexusMusic")
          put(MediaStore.Images.Media.IS_PENDING, 1)
        }
        val resolver = reactCtx().contentResolver
        val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
          ?: throw IllegalStateException("无法写入系统相册")
        resolver.openOutputStream(uri)?.use { it.write(bytes) }
          ?: throw IllegalStateException("无法打开相册输出流")
        values.clear()
        values.put(MediaStore.Images.Media.IS_PENDING, 0)
        resolver.update(uri, values, null, null)
        promise.resolve(cancelledQrIds.remove(id) != true)
      } catch (t: Throwable) {
        promise.reject("QR_SAVE_FAILED", t.message ?: "无法保存二维码到相册", t)
      }
    }

    AsyncFunction("cancelLoginQrPhoto") { id: String ->
      cancelledQrIds[id] = true
    }

    AsyncFunction("downloadDestinationStatus") {
      synchronized(lock) { readDestRoot()?.let { mapOf("id" to it.first, "name" to it.second) } }
    }

    AsyncFunction("forgetDownloadDestination") { id: String ->
      synchronized(lock) {
        val existing = readDestRoot()
        if (existing != null && existing.first == id) {
          destRegistryFile().delete()
        }
      }
    }

    AsyncFunction("pickDownloadDestination") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null || pendingDestPromise != null) {
        promise.resolve(null)
        return@AsyncFunction
      }
      pendingDestPromise = promise
      val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
        addFlags(
          Intent.FLAG_GRANT_READ_URI_PERMISSION or
            Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
            Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION or
            Intent.FLAG_GRANT_PREFIX_URI_PERMISSION
        )
      }
      activity.startActivityForResult(intent, REQ_PICK_DOWNLOAD_DEST)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("saveDownloadFiles") { values: List<String>, id: String, job: String, promise: Promise ->
      try {
        UUID.fromString(job)
        val root = synchronized(lock) { readDestRoot() }
          ?: throw IllegalStateException("保存目录未授权")
        if (root.first != id) throw IllegalStateException("保存目录授权已改变")
        val treeUri = Uri.parse(root.third)
        val dir = DocumentFile.fromTreeUri(reactCtx(), treeUri)
          ?: throw IllegalStateException("保存目录不可用，请重新授权")
        if (!dir.exists() || !dir.canWrite()) throw IllegalStateException("保存目录不可写")

        val sources = values.map { uriToFile(it) }
        if (sources.isEmpty() || sources.any { !it.isFile }) throw IllegalStateException("待导出文件不存在")

        var chosenNames = emptyList<String>()
        for (attempt in 0 until 1000) {
          val suffix = if (attempt == 0) "" else " (${attempt + 1})"
          val candidates = sources.map { f ->
            val name = f.name
            if (name.endsWith(".meta.json")) {
              "${name.removeSuffix(".meta.json")}$suffix.meta.json"
            } else {
              val dot = name.lastIndexOf('.')
              if (dot > 0) "${name.substring(0, dot)}$suffix${name.substring(dot)}" else "$name$suffix"
            }
          }
          if (candidates.all { dir.findFile(it) == null }) {
            chosenNames = candidates
            break
          }
        }
        if (chosenNames.size != sources.size) throw IllegalStateException("目录中同名文件过多")

        val resolver = reactCtx().contentResolver
        for (i in sources.indices) {
          val src = sources[i]
          val targetName = chosenNames[i]
          val mime = mimeForName(targetName)
          val created = dir.createFile(mime, targetName) ?: throw IllegalStateException("无法创建目标文件")
          resolver.openOutputStream(created.uri)?.use { out ->
            FileInputStream(src).use { input -> input.copyTo(out) }
          } ?: throw IllegalStateException("无法写入目标文件")
        }
        promise.resolve(chosenNames)
      } catch (t: Throwable) {
        promise.reject("DEST_SAVE_FAILED", t.message ?: "保存目录不可用，请重新授权或重试；原音频保留", t)
      }
    }

    AsyncFunction("pickAudioFolder") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null || pendingFolderPromise != null) {
        promise.resolve(null)
        return@AsyncFunction
      }
      pendingFolderPromise = promise
      val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
        addFlags(
          Intent.FLAG_GRANT_READ_URI_PERMISSION or
            Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION or
            Intent.FLAG_GRANT_PREFIX_URI_PERMISSION
        )
      }
      activity.startActivityForResult(intent, REQ_PICK_AUDIO_FOLDER)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("retainAudioFolders") { ids: List<String> ->
      synchronized(lock) {
        val keep = ids.toSet()
        writeFolderRoots(readFolderRoots().filter { it.first in keep })
      }
    }

    AsyncFunction("scanAudioFolders") { ids: List<String>, recursive: List<String>, blocked: List<String>, minimumSeconds: Double ->
      if (ids.size > 32 || !minimumSeconds.isFinite() || minimumSeconds < 0.0) {
        throw IllegalArgumentException("扫描设置无效")
      }
      if (ids.isEmpty()) {
        return@AsyncFunction mapOf(
          "files" to emptyList<Any>(),
          "folders" to emptyList<Any>(),
          "failed" to emptyList<Any>()
        )
      }
      val roots = synchronized(lock) { readFolderRoots() }
      val recursiveSet = recursive.toSet()
      val output = mutableListOf<Map<String, Any>>()
      val folders = mutableListOf<Map<String, String>>()
      val failed = mutableListOf<Map<String, String>>()
      var inspected = 0

      for (id in ids) {
        val root = roots.firstOrNull { it.first == id } ?: throw IllegalStateException("文件夹授权已缺失，请重新添加")
        val docRoot = DocumentFile.fromTreeUri(reactCtx(), Uri.parse(root.third))
          ?: throw IllegalStateException("文件夹不可用，原索引保留")
        folders.add(mapOf("rootId" to id, "rootName" to root.second, "path" to ""))
        if (blocked.contains("$id/")) continue

        fun walk(dir: DocumentFile, relDir: String) {
          for (child in dir.listFiles()) {
            inspected++
            if (inspected > 50_000) throw IllegalStateException("扫描文件过多，请缩小授权范围")
            val name = child.name ?: continue
            if (name.startsWith(".")) continue
            val rel = if (relDir.isEmpty()) name else "$relDir/$name"
            val key = "$id/$rel"
            if (child.isDirectory) {
              folders.add(mapOf("rootId" to id, "rootName" to root.second, "path" to rel))
              if (id in recursiveSet && blocked.none { key == it || key.startsWith("$it/") }) {
                walk(child, rel)
              }
              continue
            }
            if (blocked.any { key == it || key.startsWith("$it/") }) continue
            val ext = name.substringAfterLast('.', "").lowercase()
            if (!child.isFile || ext !in AUDIO_EXTS) continue
            val location = mapOf("rootId" to id, "rootName" to root.second, "path" to relDir, "fileName" to name)
            try {
              val imported = importAudioFromUri(child.uri.toString(), name, minimumSeconds)
              if (imported != null) {
                output.add(imported + ("location" to location))
              }
            } catch (_: Throwable) {
              failed.add(location)
            }
            if (output.size > 10_000) throw IllegalStateException("本地曲库最多10000首")
          }
        }
        walk(docRoot, "")
      }
      mapOf("files" to output, "folders" to folders, "failed" to failed)
    }

    AsyncFunction("stageAudioExport") { input: String, target: String ->
      val src = uriToFile(input)
      val dst = uriToFile(target)
      dst.parentFile?.mkdirs()
      src.copyTo(dst, overwrite = true)
      Uri.fromFile(dst).toString()
    }

    AsyncFunction("exportCoverJPEG") { input: String, target: String, maximum: Int ->
      val src = uriToFile(input)
      val dst = uriToFile(target)
      val bitmap = BitmapFactory.decodeFile(src.absolutePath)
        ?: throw IllegalStateException("无法读取封面图片")
      val longest = max(bitmap.width, bitmap.height).coerceAtLeast(1)
      val scaled = if (longest > maximum && maximum > 0) {
        val ratio = maximum.toFloat() / longest.toFloat()
        Bitmap.createScaledBitmap(
          bitmap,
          max(1, (bitmap.width * ratio).toInt()),
          max(1, (bitmap.height * ratio).toInt()),
          true
        )
      } else {
        bitmap
      }
      dst.parentFile?.mkdirs()
      FileOutputStream(dst).use { out ->
        scaled.compress(Bitmap.CompressFormat.JPEG, 90, out)
      }
      if (scaled !== bitmap) scaled.recycle()
      bitmap.recycle()
      Uri.fromFile(dst).toString()
    }

    AsyncFunction("exportAudioFiles") { values: List<String>, promise: Promise ->
      try {
        val ctx = reactCtx()
        val authority = "${ctx.packageName}.nexusfileprovider"
        val uris = ArrayList<Uri>()
        for (raw in values) {
          val f = uriToFile(raw)
          if (!f.isFile) continue
          uris.add(FileProvider.getUriForFile(ctx, authority, f))
        }
        if (uris.isEmpty()) {
          promise.resolve(false)
          return@AsyncFunction
        }
        val shareIntent = if (uris.size == 1) {
          Intent(Intent.ACTION_SEND).apply {
            type = mimeForName(values.first())
            putExtra(Intent.EXTRA_STREAM, uris.first())
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
          }
        } else {
          Intent(Intent.ACTION_SEND_MULTIPLE).apply {
            type = "*/*"
            putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
          }
        }
        val chooser = Intent.createChooser(shareIntent, "导出文件").apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        ctx.startActivity(chooser)
        promise.resolve(true)
      } catch (t: Throwable) {
        promise.reject("EXPORT_FAILED", t.message ?: "无法拉起系统分享面板", t)
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("importVisual") { uri: String, promise: Promise ->
      try {
        val decoded = decodeBoundedBitmap(uri, maxSide = 1920)
        val opaque = Bitmap.createBitmap(decoded.width, decoded.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(opaque)
        canvas.drawColor(Color.WHITE)
        canvas.drawBitmap(decoded, 0f, 0f, null)
        decoded.recycle()

        val bos = ByteArrayOutputStream()
        opaque.compress(Bitmap.CompressFormat.JPEG, 88, bos)
        val bytes = bos.toByteArray()
        val w = opaque.width
        val h = opaque.height
        opaque.recycle()
        if (bytes.isEmpty() || bytes.size > 8 * 1024 * 1024) {
          throw IllegalStateException("图片编码失败或超限")
        }
        val id = sha256Hex(bytes)
        val target = File(visualsDir(), "$id.jpg")
        val tmp = File(visualsDir(), "${UUID.randomUUID()}.tmp")
        tmp.writeBytes(bytes)
        if (!tmp.renameTo(target)) {
          target.writeBytes(bytes)
          tmp.delete()
        }
        promise.resolve(mapOf("id" to id, "width" to w, "height" to h))
      } catch (t: Throwable) {
        promise.reject("VISUAL_IMPORT_FAILED", t.message ?: "无法导入图片", t)
      }
    }

    AsyncFunction("resolveVisual") { id: String ->
      if (!isSha256(id)) throw IllegalArgumentException("图片标识无效")
      val file = File(visualsDir(), "$id.jpg")
      if (!file.isFile) throw IllegalStateException("图片已缺失，请重新导入")
      Uri.fromFile(file).toString()
    }

    AsyncFunction("reconcileVisuals") { ids: List<String> ->
      val keep = ids.filter { isSha256(it) }.map { "$it.jpg" }.toSet()
      visualsDir().listFiles()?.forEach { file ->
        if (file.name !in keep) file.delete()
      }
    }

    AsyncFunction("visualPalette") { uri: String ->
      val bmp = decodeBoundedBitmap(uri, maxSide = 32)
      try {
        val scaled = Bitmap.createScaledBitmap(bmp, 32, 32, true)
        try {
          VisualPaletteMath.dominantColor(scaled)
        } finally {
          if (scaled !== bmp) scaled.recycle()
        }
      } finally {
        bmp.recycle()
      }
    }

    AsyncFunction("visualFlowPalette") { uri: String ->
      val bmp = decodeBoundedBitmap(uri, maxSide = 24)
      try {
        val scaled = Bitmap.createScaledBitmap(bmp, 24, 24, true)
        try {
          val pixels = IntArray(24 * 24)
          scaled.getPixels(pixels, 0, 24, 0, 0, 24, 24)
          VisualPaletteMath.flowPaletteFromArgb(pixels)
        } finally {
          if (scaled !== bmp) scaled.recycle()
        }
      } finally {
        bmp.recycle()
      }
    }

    AsyncFunction("importAudio") { uri: String, name: String, promise: Promise ->
      try {
        val result = importAudioFromUri(uri, name, 0.0)
          ?: throw IllegalStateException("音频时长无效")
        promise.resolve(result)
      } catch (t: Throwable) {
        promise.reject("LOCAL_AUDIO_IMPORT_FAILED", t.message ?: "音频导入失败", t)
      }
    }

    AsyncFunction("resolveAudio") { id: String, extension: String ->
      val file = localAudioFile(id, extension)
      if (!file.isFile) throw IllegalStateException("本地音频已缺失，请重新导入")
      Uri.fromFile(file).toString()
    }

    AsyncFunction("localArtwork") { id: String ->
      if (!isSha256(id)) return@AsyncFunction null
      val file = File(localAudioDir(), "$id.jpg")
      if (file.isFile) Uri.fromFile(file).toString() else null
    }

    AsyncFunction("beginRemoval") { id: String, extension: String ->
      val source = localAudioFile(id, extension)
      val token = UUID.randomUUID().toString()
      val dir = pendingDeleteDir()
      val journal = File(dir, "$token.json")
      val staged = File(dir, "$token.audio")
      journal.writeText(JSONObject().put("id", id).put("extension", extension).toString())
      if (source.isFile) {
        if (!source.renameTo(staged)) {
          source.copyTo(staged, overwrite = true)
          source.delete()
        }
      }
      token
    }

    AsyncFunction("finishRemoval") { token: String, restore: Boolean ->
      UUID.fromString(token)
      val dir = pendingDeleteDir()
      val journal = File(dir, "$token.json")
      val staged = File(dir, "$token.audio")
      val raw = JSONObject(journal.readText())
      val id = raw.getString("id")
      val ext = raw.getString("extension")
      val original = localAudioFile(id, ext)
      if (staged.isFile) {
        if (restore) {
          if (!staged.renameTo(original)) {
            staged.copyTo(original, overwrite = true)
            staged.delete()
          }
        } else {
          staged.delete()
        }
      }
      if (!restore && AUDIO_EXTS.none { File(localAudioDir(), "$id.$it").isFile }) {
        File(localAudioDir(), "$id.jpg").delete()
      }
      journal.delete()
    }

    AsyncFunction("reconcile") { files: List<Map<String, String>> ->
      val dir = pendingDeleteDir()
      val keep = files.mapNotNull { row ->
        val id = row["id"]
        val ext = row["extension"]
        if (id != null && ext != null && isSha256(id) && ext in AUDIO_EXTS) "$id.$ext" else null
      }.toSet()
      dir.listFiles()?.filter { it.extension == "json" }?.take(1000)?.forEach { journal ->
        try {
          val raw = JSONObject(journal.readText())
          val id = raw.getString("id")
          val ext = raw.getString("extension")
          val token = journal.nameWithoutExtension
          val staged = File(dir, "$token.audio")
          val original = localAudioFile(id, ext)
          val restore = "$id.$ext" in keep
          if (staged.isFile) {
            if (restore) staged.renameTo(original) else staged.delete()
          }
          journal.delete()
        } catch (_: Throwable) {
        }
      }
    }

    AsyncFunction("removeAudio") { id: String, extension: String ->
      localAudioFile(id, extension).delete()
      if (AUDIO_EXTS.none { File(localAudioDir(), "$id.$it").isFile }) {
        File(localAudioDir(), "$id.jpg").delete()
      }
    }
  }

  private fun handleFolderResult(resultCode: Int, data: Intent?) {
    val promise = pendingFolderPromise ?: return
    pendingFolderPromise = null
    val uri = data?.data
    if (resultCode != Activity.RESULT_OK || uri == null) {
      promise.resolve(null)
      return
    }
    try {
      val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION
      reactCtx().contentResolver.takePersistableUriPermission(uri, flags)
      val doc = DocumentFile.fromTreeUri(reactCtx(), uri)
      val name = doc?.name?.takeIf { it.isNotBlank() } ?: (uri.lastPathSegment ?: "已选文件夹")
      val entry = synchronized(lock) {
        val existing = readFolderRoots().toMutableList()
        val match = existing.firstOrNull { it.third == uri.toString() }
        val id = match?.first ?: UUID.randomUUID().toString()
        existing.removeAll { it.first == id }
        existing.add(Triple(id, name, uri.toString()))
        writeFolderRoots(existing)
        mapOf("id" to id, "name" to name)
      }
      promise.resolve(entry)
    } catch (t: Throwable) {
      promise.reject("PICK_FOLDER_FAILED", t.message ?: "无法授权该文件夹", t)
    }
  }

  private fun handleDestResult(resultCode: Int, data: Intent?) {
    val promise = pendingDestPromise ?: return
    pendingDestPromise = null
    val uri = data?.data
    if (resultCode != Activity.RESULT_OK || uri == null) {
      promise.resolve(null)
      return
    }
    try {
      val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
      reactCtx().contentResolver.takePersistableUriPermission(uri, flags)
      val doc = DocumentFile.fromTreeUri(reactCtx(), uri)
      val name = doc?.name?.takeIf { it.isNotBlank() } ?: (uri.lastPathSegment ?: "下载目录")
      val id = UUID.randomUUID().toString()
      synchronized(lock) {
        destRegistryFile().writeText(JSONObject().put("id", id).put("name", name).put("uri", uri.toString()).toString())
      }
      promise.resolve(mapOf("id" to id, "name" to name))
    } catch (t: Throwable) {
      promise.reject("PICK_DEST_FAILED", t.message ?: "无法授权该保存目录", t)
    }
  }

  private fun readFolderRoots(): List<Triple<String, String, String>> {
    val file = foldersRegistryFile()
    if (!file.isFile) return emptyList()
    return try {
      val arr = JSONArray(file.readText())
      (0 until arr.length()).mapNotNull { i ->
        val o = arr.optJSONObject(i) ?: return@mapNotNull null
        Triple(o.optString("id"), o.optString("name"), o.optString("uri"))
      }.filter { it.first.isNotEmpty() && it.third.isNotEmpty() }
    } catch (_: Throwable) {
      emptyList()
    }
  }

  private fun writeFolderRoots(roots: List<Triple<String, String, String>>) {
    val arr = JSONArray()
    roots.forEach { (id, name, uri) ->
      arr.put(JSONObject().put("id", id).put("name", name).put("uri", uri))
    }
    foldersRegistryFile().writeText(arr.toString())
  }

  private fun readDestRoot(): Triple<String, String, String>? {
    val file = destRegistryFile()
    if (!file.isFile) return null
    return try {
      val o = JSONObject(file.readText())
      val id = o.optString("id")
      val name = o.optString("name")
      val uri = o.optString("uri")
      if (id.isNotEmpty() && uri.isNotEmpty()) Triple(id, name, uri) else null
    } catch (_: Throwable) {
      null
    }
  }

  private fun importAudioFromUri(rawUri: String, name: String, minimumSeconds: Double): Map<String, Any>? {
    val ext = name.substringAfterLast('.', "").lowercase()
    if (ext !in AUDIO_EXTS) throw IllegalArgumentException("支持 MP3、FLAC、AAC、M4A、WAV、AIFF")
    val parsed = Uri.parse(rawUri)
    val temp = File(localAudioDir(), "import-${UUID.randomUUID()}.$ext")
    var modifiedAtMs: Long? = null
    try {
      val digest = MessageDigest.getInstance("SHA-256")
      var bytesCount = 0L
      val inputStream = when (parsed.scheme) {
        "content" -> reactCtx().contentResolver.openInputStream(parsed)
        "file", null -> {
          val f = uriToFile(rawUri)
          if (f.lastModified() > 0L) modifiedAtMs = f.lastModified()
          FileInputStream(f)
        }
        else -> throw IllegalArgumentException("请选择本地音频文件")
      } ?: throw IllegalStateException("无法读取音频文件")

      inputStream.use { input ->
        FileOutputStream(temp).use { out ->
          val buf = ByteArray(65_536)
          while (true) {
            val n = input.read(buf)
            if (n <= 0) break
            bytesCount += n
            if (bytesCount > 1024L * 1024L * 1024L) throw IllegalStateException("文件超过1GiB上限")
            digest.update(buf, 0, n)
            out.write(buf, 0, n)
          }
        }
      }
      if (bytesCount <= 0L) throw IllegalStateException("文件为空")
      val id = digest.digest().joinToString("") { "%02x".format(it.toInt() and 0xFF) }

      val retriever = MediaMetadataRetriever()
      var durationMs = 0.0
      var title = name.substringAfterLast('/').substringBeforeLast('.')
      var artist = "未知艺术家"
      var album = ""
      var embeddedPic: ByteArray? = null
      try {
        retriever.setDataSource(temp.absolutePath)
        durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toDoubleOrNull() ?: 0.0
        retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE)?.takeIf { it.isNotBlank() }?.let { title = it }
        retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST)?.takeIf { it.isNotBlank() && it != "<unknown>" }?.let { artist = it }
        retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM)?.takeIf { it != "<unknown>" }?.let { album = it }
        embeddedPic = retriever.embeddedPicture?.takeIf { it.size <= 8 * 1024 * 1024 }
      } finally {
        try {
          retriever.release()
        } catch (_: Throwable) {
        }
      }

      if (!durationMs.isFinite() || durationMs <= 0.0) throw IllegalStateException("音频时长无效")
      if (minimumSeconds > 0.0 && durationMs / 1000.0 < minimumSeconds) {
        temp.delete()
        return null
      }

      val dest = localAudioFile(id, ext)
      val created = !dest.isFile
      if (created) {
        if (!temp.renameTo(dest)) {
          temp.copyTo(dest, overwrite = true)
          temp.delete()
        }
      } else {
        temp.delete()
      }

      if (embeddedPic != null) {
        saveEmbeddedCover(embeddedPic, id)
      }

      val result = mutableMapOf<String, Any>(
        "id" to id,
        "extension" to ext,
        "bytes" to bytesCount,
        "durationMs" to durationMs,
        "title" to title,
        "artist" to artist,
        "album" to album,
        "lyric" to "",
        "created" to created
      )
      modifiedAtMs?.let { result["modifiedAt"] = it.toDouble() }
      return result
    } catch (t: Throwable) {
      temp.delete()
      throw t
    }
  }

  private fun saveEmbeddedCover(data: ByteArray, id: String) {
    try {
      val bmp = BitmapFactory.decodeByteArray(data, 0, data.size) ?: return
      val longest = max(bmp.width, bmp.height).coerceAtLeast(1)
      val scaled = if (longest > 512) {
        val r = 512f / longest.toFloat()
        Bitmap.createScaledBitmap(bmp, max(1, (bmp.width * r).toInt()), max(1, (bmp.height * r).toInt()), true)
      } else bmp
      val target = File(localAudioDir(), "$id.jpg")
      FileOutputStream(target).use { scaled.compress(Bitmap.CompressFormat.JPEG, 82, it) }
      if (scaled !== bmp) scaled.recycle()
      bmp.recycle()
    } catch (_: Throwable) {
    }
  }

  private fun decodeBoundedBitmap(uri: String, maxSide: Int): Bitmap {
    val file = uriToFile(uri)
    if (!file.isFile || file.length() <= 0L || file.length() > 20L * 1024L * 1024L) {
      throw IllegalStateException("图片为空或超过20MiB")
    }
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file.absolutePath, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0 ||
      bounds.outWidth > 32_768 || bounds.outHeight > 32_768 ||
      bounds.outWidth.toLong() * bounds.outHeight.toLong() > 100_000_000L
    ) {
      throw IllegalStateException("无法读取图片或图片尺寸超限")
    }
    var sample = 1
    while (max(bounds.outWidth / sample, bounds.outHeight / sample) > maxSide * 2) sample *= 2
    val decoded = BitmapFactory.decodeFile(file.absolutePath, BitmapFactory.Options().apply { inSampleSize = sample })
      ?: throw IllegalStateException("无法解码图片")
    val longest = max(decoded.width, decoded.height)
    return if (longest > maxSide) {
      val ratio = maxSide.toFloat() / longest.toFloat()
      Bitmap.createScaledBitmap(decoded, max(1, (decoded.width * ratio).toInt()), max(1, (decoded.height * ratio).toInt()), true)
        .also { if (it !== decoded) decoded.recycle() }
    } else {
      decoded
    }
  }

  private fun localAudioFile(id: String, ext: String): File {
    if (!isSha256(id) || ext !in AUDIO_EXTS) throw IllegalArgumentException("本地文件标识无效")
    return File(localAudioDir(), "$id.$ext")
  }

  private fun isSha256(id: String): Boolean =
    id.length == 64 && id.all { it in '0'..'9' || it in 'a'..'f' }

  private fun sha256Hex(bytes: ByteArray): String =
    MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it.toInt() and 0xFF) }

  private fun uriToFile(raw: String): File {
    val parsed = Uri.parse(raw)
    return if (parsed.scheme == "file") File(parsed.path ?: raw) else File(raw)
  }

  private fun mimeForName(name: String): String = when (name.substringAfterLast('.', "").lowercase()) {
    "mp3" -> "audio/mpeg"
    "flac" -> "audio/flac"
    "m4a", "aac" -> "audio/mp4"
    "wav" -> "audio/wav"
    "lrc" -> "text/plain"
    "json" -> "application/json"
    "jpg", "jpeg" -> "image/jpeg"
    "png" -> "image/png"
    else -> "application/octet-stream"
  }
}

/**
 * Exact Kotlin port of iOS VisualAssets.swift palette & 24-bucket HSV flowPalette algorithms.
 */
internal object VisualPaletteMath {
  private data class Sample(
    val color: String,
    val hue: Double,
    val saturation: Double,
    val value: Double,
    val luminance: Double
  )

  fun dominantColor(bmp: Bitmap): String {
    val w = bmp.width
    val h = bmp.height
    val pixels = IntArray(w * h)
    bmp.getPixels(pixels, 0, w, 0, 0, w, h)
    return dominantColorFromArgb(pixels)
  }

  fun dominantColorFromArgb(pixels: IntArray): String {
    val bins = mutableMapOf<Int, IntArray>() // [count, rSum, gSum, bSum]
    for (px in pixels) {
      val a = Color.alpha(px)
      if (a < 128) continue
      val r = Color.red(px)
      val g = Color.green(px)
      val b = Color.blue(px)
      if (max(r, max(g, b)) < 20 || min(r, min(g, b)) > 240) continue
      val key = (r / 32) * 64 + (g / 32) * 8 + (b / 32)
      val acc = bins.getOrPut(key) { IntArray(4) }
      acc[0] += 1; acc[1] += r; acc[2] += g; acc[3] += b
    }
    val best = bins.entries.sortedWith(compareByDescending<Map.Entry<Int, IntArray>> { it.value[0] }.thenBy { it.key }).firstOrNull()?.value
      ?: return "#526878"
    return String.format("#%02X%02X%02X", best[1] / best[0], best[2] / best[0], best[3] / best[0])
  }

  fun flowPaletteFromArgb(pixels: IntArray): List<String> {
    if (pixels.isEmpty()) return listOf("#E88295", "#C46B84", "#F4B4BF")
    val samples = ArrayList<Sample>(pixels.size)
    val totals = DoubleArray(24)
    val peaks = DoubleArray(24)
    val reps = arrayOfNulls<Sample>(24)
    var maxSat = 0.0

    fun linear(c: Double): Double = if (c <= 0.04045) c / 12.92 else ((c + 0.055) / 1.055).pow(2.4)

    for (px in pixels) {
      val ri = (px ushr 16) and 0xFF
      val gi = (px ushr 8) and 0xFF
      val bi = px and 0xFF
      val r = ri / 255.0
      val g = gi / 255.0
      val b = bi / 255.0
      val value = max(r, max(g, b))
      val delta = value - min(r, min(g, b))
      val sat = if (value == 0.0) 0.0 else delta / value
      var hue = 0.0
      if (delta > 0.0) {
        hue = when (value) {
          r -> (((g - b) / delta) % 6.0) * 60.0
          g -> (((b - r) / delta) + 2.0) * 60.0
          else -> (((r - g) / delta) + 4.0) * 60.0
        }
        if (hue < 0.0) hue += 360.0
      }
      val lum = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
      val sample = Sample(String.format("#%02X%02X%02X", ri, gi, bi), hue, sat, value, lum)
      samples.add(sample)
      maxSat = max(maxSat, sat)
      val balance = min(1.0, max(0.0, 1.0 - abs(value - 0.55) / 0.55))
      val weight = sat * (0.25 + 0.75 * balance)
      val bucket = (floor(hue / 360.0 * 24.0).toInt() % 24 + 24) % 24
      totals[bucket] += weight
      if (weight > peaks[bucket]) {
        peaks[bucket] = weight
        reps[bucket] = sample
      }
    }

    if (maxSat < 0.08) {
      val sorted = samples.withIndex().sortedWith(compareBy<IndexedValue<Sample>> { it.value.luminance }.thenBy { it.index })
      return List(3) { idx ->
        val pos = min(sorted.size - 1, floor(((idx + 0.5) / 3.0) * sorted.size).toInt())
        sorted[pos].value.color
      }
    }

    val buckets = (0 until 24).sortedWith(compareByDescending<Int> { totals[it] }.thenBy { it })
    val selected = mutableListOf<Sample>()
    for (bucket in buckets) {
      val candidate = reps[bucket] ?: continue
      if (totals[bucket] <= 0.0) continue
      val tooClose = selected.any {
        val dist = abs(candidate.hue - it.hue)
        min(dist, 360.0 - dist) < 40.0
      }
      if (!tooClose) selected.add(candidate)
      if (selected.size == 3) break
    }
    if (selected.isEmpty()) selected.add(samples[samples.size / 2])
    val seed = selected.toList()
    while (selected.size < 3) selected.add(seed[selected.size % seed.size])
    return selected.map { it.color }
  }
}
