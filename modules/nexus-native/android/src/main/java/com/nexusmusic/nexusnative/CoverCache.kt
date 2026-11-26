package com.nexusmusic.nexusnative

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import java.io.File
import java.io.FileOutputStream
import java.net.URI
import java.util.UUID
import kotlin.math.max
import kotlin.math.min

/**
 * 1:1 Android parity implementation of iOS CoverCache.swift.
 * Enforces SHA-256 keys, >= 48px minimum guard, aspect-preserving JPEG downscaling, atomic write, and LRU trim.
 */
internal class CoverCache(
  private val directory: File,
  private val maximumBytes: Long = 32L * 1024L * 1024L
) {
  @Volatile var epoch: Int = 0
    private set

  private val lock = Any()

  init {
    directory.mkdirs()
  }

  private fun valid(key: String): Boolean =
    key.length == 64 && key.all { it in '0'..'9' || it in 'a'..'f' }

  fun hit(key: String): String? = synchronized(lock) {
    if (!valid(key)) return null
    val file = File(directory, "$key.jpg")
    if (!file.exists() || file.length() <= 0L) return null
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file.absolutePath, bounds)
    if (bounds.outWidth < 48 || bounds.outHeight < 48) {
      file.delete()
      return null
    }
    file.setLastModified(System.currentTimeMillis())
    URI("file", "", file.absolutePath, null).toASCIIString()
  }

  fun store(data: ByteArray, key: String, maxPixelSize: Int = 512, exporting: Boolean = false): String? = synchronized(lock) {
    val allowed = if (exporting) setOf(256, 500, 512, 1000, 1024, 1200, 2048) else setOf(512, 1024)
    if (maxPixelSize !in allowed || !valid(key) || data.isEmpty() || data.size > 8 * 1024 * 1024) return null

    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(data, 0, data.size, bounds)
    val origW = bounds.outWidth
    val origH = bounds.outHeight
    if (origW < 48 || origH < 48) return null
    if (exporting && (origW > 16_384 || origH > 16_384 || origW.toLong() * origH.toLong() > 16_777_216L)) return null

    val targetMax = if (exporting) min(maxPixelSize, max(origW, origH)) else maxPixelSize
    var sampleSize = 1
    while (max(origW / sampleSize, origH / sampleSize) > targetMax * 2) {
      sampleSize *= 2
    }
    val decodeOpts = BitmapFactory.Options().apply { inSampleSize = sampleSize }
    val decoded = BitmapFactory.decodeByteArray(data, 0, data.size, decodeOpts) ?: return null
    val longest = max(decoded.width, decoded.height)
    val finalBmp = if (longest > targetMax && targetMax > 0) {
      val ratio = targetMax.toFloat() / longest.toFloat()
      val newW = max(1, (decoded.width * ratio).toInt())
      val newH = max(1, (decoded.height * ratio).toInt())
      if (newW < 48 || newH < 48) {
        decoded.recycle()
        return null
      }
      Bitmap.createScaledBitmap(decoded, newW, newH, true).also {
        if (it !== decoded) decoded.recycle()
      }
    } else {
      decoded
    }

    if (finalBmp.width < 48 || finalBmp.height < 48) {
      finalBmp.recycle()
      return null
    }

    val target = File(directory, "$key.jpg")
    val tmp = File(directory, "${UUID.randomUUID()}.tmp")
    try {
      FileOutputStream(tmp).use { out ->
        if (!finalBmp.compress(Bitmap.CompressFormat.JPEG, 85, out)) {
          tmp.delete()
          return null
        }
      }
      if (!tmp.renameTo(target)) {
        tmp.copyTo(target, overwrite = true)
        tmp.delete()
      }
      trimLocked()
      return URI("file", "", target.absolutePath, null).toASCIIString()
    } catch (_: Throwable) {
      tmp.delete()
      return null
    } finally {
      finalBmp.recycle()
    }
  }

  fun clear() = synchronized(lock) {
    epoch += 1
    directory.listFiles()?.forEach { it.delete() }
  }

  fun statistics(): Map<String, Any> = synchronized(lock) {
    val files = directory.listFiles()?.filter { it.isFile && it.extension == "jpg" }.orEmpty()
    mapOf(
      "files" to files.size,
      "bytes" to files.sumOf { it.length() }
    )
  }

  private fun trimLocked() {
    val files = directory.listFiles()
      ?.filter { it.isFile && it.extension == "jpg" }
      ?.sortedBy { it.lastModified() }
      .orEmpty()
    var total = files.sumOf { it.length() }
    for (file in files) {
      if (total <= maximumBytes) break
      val len = file.length()
      if (file.delete()) total -= len
    }
  }
}
