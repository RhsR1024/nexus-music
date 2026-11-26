package com.nexusmusic.nexusnative

import java.io.File
import java.util.UUID

/**
 * 1:1 Android parity implementation of iOS AudioCache.swift.
 * SHA-256 keyed LRU disk cache with active-entry retention and crash-orphan cleanup.
 */
internal class AudioCache(private val directory: File) {
  companion object {
    private val SUFFIXES = listOf("wav", "mp3", "flac", "m4a", "aac", "aiff", "audio")
    private val MIME_TO_SUFFIX = mapOf(
      "audio/wav" to "wav",
      "audio/x-wav" to "wav",
      "audio/wave" to "wav",
      "audio/mpeg" to "mp3",
      "audio/mp3" to "mp3",
      "audio/flac" to "flac",
      "audio/x-flac" to "flac",
      "audio/mp4" to "m4a",
      "audio/x-m4a" to "m4a",
      "audio/aac" to "aac",
      "audio/aiff" to "aiff"
    )
  }

  private val lock = Any()
  private var limitBytes: Long = 256L * 1024L * 1024L
  private var epoch = 0
  private val active = mutableMapOf<String, Int>()

  init {
    directory.mkdirs()
    directory.listFiles()?.filter { it.extension == "part" }?.forEach { it.delete() }
  }

  private fun valid(key: String): Boolean =
    key.length == 64 && key.all { it in '0'..'9' || it in 'a'..'f' }

  fun retain(key: String) = synchronized(lock) {
    if (valid(key)) active[key] = (active[key] ?: 0) + 1
  }

  fun release(key: String) = synchronized(lock) {
    val next = maxOf(0, (active[key] ?: 0) - 1)
    if (next == 0) active.remove(key) else active[key] = next
    trimLocked()
  }

  fun hit(key: String): File? = synchronized(lock) {
    if (!valid(key)) return null
    val match = SUFFIXES.map { File(directory, "$key.$it") }.firstOrNull { it.isFile && it.length() > 0L }
      ?: return null
    match.setLastModified(System.currentTimeMillis())
    match
  }

  fun invalidate(key: String) = synchronized(lock) {
    epoch += 1
    if (valid(key)) {
      SUFFIXES.forEach { File(directory, "$key.$it").delete() }
    }
  }

  fun configure(megabytes: Int) = synchronized(lock) {
    limitBytes = megabytes.coerceIn(32, 2048).toLong() * 1048576L
    trimLocked()
  }

  fun clear() = synchronized(lock) {
    epoch += 1
    directory.listFiles()?.forEach { file ->
      if (file.extension != "part" && (active[file.nameWithoutExtension] ?: 0) == 0) {
        file.delete()
      }
    }
  }

  fun statistics(): Map<String, Any> = synchronized(lock) {
    val complete = completeFilesLocked()
    mapOf(
      "bytes" to complete.sumOf { it.length() },
      "files" to complete.size,
      "limitBytes" to limitBytes
    )
  }

  fun beginTempFile(): Pair<File, Int> = synchronized(lock) {
    File(directory, "${UUID.randomUUID()}.part") to epoch
  }

  fun commitTempFile(key: String, tempFile: File, expectedEpoch: Int, mime: String?): File? = synchronized(lock) {
    if (!valid(key) || expectedEpoch != epoch || !tempFile.isFile || tempFile.length() <= 0L || tempFile.length() > limitBytes) {
      tempFile.delete()
      return null
    }
    val suffix = MIME_TO_SUFFIX[mime?.substringBefore(';')?.trim()?.lowercase()] ?: "audio"
    val destination = File(directory, "$key.$suffix")
    if (destination.exists()) {
      tempFile.delete()
      return destination
    }
    val moved = if (tempFile.renameTo(destination)) {
      true
    } else {
      try {
        tempFile.copyTo(destination, overwrite = false)
        tempFile.delete()
        true
      } catch (_: Throwable) {
        tempFile.delete()
        false
      }
    }
    if (!moved) return null
    trimLocked()
    destination
  }

  private fun completeFilesLocked(): List<File> =
    directory.listFiles()?.filter { it.isFile && it.extension in SUFFIXES }.orEmpty()

  private fun trimLocked() {
    val complete = completeFilesLocked().sortedBy { it.lastModified() }
    var total = complete.sumOf { it.length() }
    for (file in complete) {
      if (total <= limitBytes) break
      if ((active[file.nameWithoutExtension] ?: 0) > 0) continue
      val len = file.length()
      if (file.delete()) total -= len
    }
  }
}
