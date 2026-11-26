package com.nexusmusic.nexusnative

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.net.Uri
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import kotlin.math.max
import kotlin.math.min

/**
 * Android file/storage/visual bridge exposing the exact 24 methods of iOS NexusFilesModule.
 * Safe restore/reconcile/palette/staging methods work immediately in Phase 0; SAF folder picking,
 * QR album save, and FileProvider export complete in Phase 3.
 */
class NexusFilesModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NexusFiles")

    AsyncFunction("saveLoginQrPhoto") { _: String, _: String, _: Double, promise: Promise ->
      promise.reject("ANDROID_PHASE3_PENDING", "保存登录二维码到相册将在 Phase 3 启用", null)
    }
    AsyncFunction("cancelLoginQrPhoto") { _: String -> }

    AsyncFunction("downloadDestinationStatus") {
      null as Map<String, String>?
    }
    AsyncFunction("forgetDownloadDestination") { _: String -> }
    AsyncFunction("saveDownloadFiles") { _: List<String>, _: String, _: String, promise: Promise ->
      promise.reject("ANDROID_PHASE3_PENDING", "Android 自定义保存目录将在 Phase 3 启用", null)
    }
    AsyncFunction("pickDownloadDestination") { promise: Promise ->
      promise.resolve(null)
    }

    AsyncFunction("pickAudioFolder") { promise: Promise ->
      promise.resolve(null)
    }
    AsyncFunction("retainAudioFolders") { _: List<String> -> }
    AsyncFunction("scanAudioFolders") { _: List<String>, _: List<String>, _: List<String>, _: Double ->
      mapOf(
        "files" to emptyList<Any>(),
        "folders" to emptyList<Any>(),
        "failed" to emptyList<Any>()
      )
    }

    AsyncFunction("stageAudioExport") { input: String, target: String ->
      val src = uriToFile(input)
      val dst = uriToFile(target)
      dst.parentFile?.mkdirs()
      src.copyTo(dst, overwrite = true)
      dst.toURI().toString()
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
      dst.toURI().toString()
    }

    AsyncFunction("exportAudioFiles") { _: List<String>, promise: Promise ->
      promise.reject("ANDROID_PHASE3_PENDING", "Android 多文件导出将在 Phase 3 启用", null)
    }

    AsyncFunction("importVisual") { _: String, promise: Promise ->
      promise.reject("ANDROID_PHASE3_PENDING", "Android 自定义外观图片导入将在 Phase 3 启用", null)
    }
    AsyncFunction("resolveVisual") { id: String ->
      val file = File(visualsDir(), "$id.jpg")
      if (!file.exists()) throw IllegalStateException("外观图片不存在")
      file.toURI().toString()
    }
    AsyncFunction("reconcileVisuals") { ids: List<String> ->
      val keep = ids.map { "$it.jpg" }.toSet()
      visualsDir().listFiles()?.forEach { file ->
        if (file.name !in keep) file.delete()
      }
    }

    AsyncFunction("visualPalette") { uri: String ->
      extractFlowColors(uri).first()
    }
    AsyncFunction("visualFlowPalette") { uri: String ->
      extractFlowColors(uri)
    }

    AsyncFunction("importAudio") { _: String, _: String, promise: Promise ->
      promise.reject("ANDROID_PHASE3_PENDING", "Android 本地音频导入将在 Phase 3 启用", null)
    }
    AsyncFunction("resolveAudio") { id: String, extension: String ->
      val file = File(localAudioDir(), "$id.$extension")
      if (!file.exists()) throw IllegalStateException("本地音频文件不存在")
      file.toURI().toString()
    }
    AsyncFunction("localArtwork") { id: String ->
      val file = File(localArtworkDir(), "$id.jpg")
      if (file.exists()) file.toURI().toString() else null
    }
    AsyncFunction("beginRemoval") { id: String, extension: String ->
      "$id.$extension"
    }
    AsyncFunction("finishRemoval") { token: String, restore: Boolean ->
      if (!restore) {
        File(localAudioDir(), token).delete()
      }
    }
    AsyncFunction("reconcile") { files: List<Map<String, String>> ->
      val keep = files.mapNotNull { item ->
        val id = item["id"]
        val ext = item["extension"]
        if (id != null && ext != null) "$id.$ext" else null
      }.toSet()
      localAudioDir().listFiles()?.forEach { file ->
        if (file.name !in keep) file.delete()
      }
    }
    AsyncFunction("removeAudio") { id: String, extension: String ->
      File(localAudioDir(), "$id.$extension").delete()
      File(localArtworkDir(), "$id.jpg").delete()
    }
  }

  private fun baseFilesDir(): File = appContext.reactContext?.filesDir ?: File("/tmp")
  private fun visualsDir(): File = File(baseFilesDir(), "NexusVisuals").apply { mkdirs() }
  private fun localAudioDir(): File = File(baseFilesDir(), "NexusLocalAudio").apply { mkdirs() }
  private fun localArtworkDir(): File = File(baseFilesDir(), "NexusLocalArtwork").apply { mkdirs() }

  private fun uriToFile(raw: String): File {
    val parsed = Uri.parse(raw)
    return if (parsed.scheme == "file") File(parsed.path ?: raw) else File(raw)
  }

  private fun extractFlowColors(uri: String): List<String> {
    val file = uriToFile(uri)
    if (!file.exists()) return listOf("#E88295", "#C46B84", "#F4B4BF")
    val opts = BitmapFactory.Options().apply { inSampleSize = 8 }
    val bmp = BitmapFactory.decodeFile(file.absolutePath, opts)
      ?: return listOf("#E88295", "#C46B84", "#F4B4BF")
    try {
      val regions = listOf(
        sampleAverage(bmp, 0, 0, bmp.width / 2, bmp.height / 2),
        sampleAverage(bmp, bmp.width / 2, 0, bmp.width, bmp.height / 2),
        sampleAverage(bmp, 0, bmp.height / 2, bmp.width, bmp.height)
      )
      return regions.map { c -> String.format("#%02X%02X%02X", Color.red(c), Color.green(c), Color.blue(c)) }
    } finally {
      bmp.recycle()
    }
  }

  private fun sampleAverage(bmp: Bitmap, x0: Int, y0: Int, x1: Int, y1: Int): Int {
    val left = x0.coerceIn(0, bmp.width)
    val top = y0.coerceIn(0, bmp.height)
    val right = x1.coerceIn(left, bmp.width)
    val bottom = y1.coerceIn(top, bmp.height)
    if (right <= left || bottom <= top) return Color.rgb(232, 130, 149)
    val stepX = max(1, (right - left) / 12)
    val stepY = max(1, (bottom - top) / 12)
    var r = 0L
    var g = 0L
    var b = 0L
    var count = 0L
    var y = top
    while (y < bottom) {
      var x = left
      while (x < right) {
        val px = bmp.getPixel(x, y)
        r += Color.red(px)
        g += Color.green(px)
        b += Color.blue(px)
        count++
        x += stepX
      }
      y += stepY
    }
    if (count == 0L) return Color.rgb(232, 130, 149)
    return Color.rgb(min(255, (r / count).toInt()), min(255, (g / count).toInt()), min(255, (b / count).toInt()))
  }
}
