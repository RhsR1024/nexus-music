package com.nexusmusic.nexusnative

import android.content.Context
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import okhttp3.Call
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.math.max

/**
 * 1:1 Android parity implementation of iOS NexusDownloadsModule / OfflineBackgroundTransfers.
 * Supports persistent journal, quota enforcement, 1-3 concurrency scheduler, HTTP Range resume,
 * pause/cancel/discard/acknowledge, and foreground dataSync service keepalive.
 */
class NexusDownloadsModule : Module() {
  private data class TransferRecord(
    val fileName: String,
    var generation: String,
    var fingerprint: String,
    var state: String,
    var received: Long = 0L,
    var expected: Long = 0L,
    var error: String? = null,
    var intent: String? = null
  ) {
    fun toMap(): Map<String, Any> {
      val map = mutableMapOf<String, Any>(
        "fileName" to fileName,
        "state" to state,
        "received" to received,
        "expected" to expected
      )
      error?.let { map["error"] = it }
      return map
    }

    fun toJson(): JSONObject = JSONObject()
      .put("fileName", fileName)
      .put("generation", generation)
      .put("fingerprint", fingerprint)
      .put("state", state)
      .put("received", received)
      .put("expected", expected)
      .apply {
        if (error != null) put("error", error)
        if (intent != null) put("intent", intent)
      }
  }

  private data class PendingJob(
    val fileName: String,
    val generation: String,
    val url: String,
    val headers: Map<String, String>,
    val resume: Boolean
  )

  private val lock = Any()
  private val workerPool = Executors.newFixedThreadPool(3)
  private val httpClient = OkHttpClient.Builder()
    .cache(null)
    .connectTimeout(20, TimeUnit.SECONDS)
    .readTimeout(30, TimeUnit.SECONDS)
    .followRedirects(true)
    .build()

  private var initialized = false
  private var maximumTotalBytes: Long = 2L * 1024L * 1024L * 1024L
  private var concurrency: Int = 1
  private val records = mutableMapOf<String, TransferRecord>()
  private val queuedJobs = ArrayDeque<PendingJob>()
  private val inFlightJobs = mutableSetOf<String>()
  private val activeCalls = ConcurrentHashMap<String, Call>()

  private fun reactCtx(): Context = appContext.reactContext ?: throw IllegalStateException("Context unavailable")
  private fun offlineDir(): File = File(reactCtx().filesDir, "offline-audio").apply { mkdirs() }
  private fun metaDir(): File = File(reactCtx().filesDir, "offline-transfers").apply { mkdirs() }

  private fun validName(name: String): Boolean =
    name.isNotEmpty() && name.length <= 180 &&
      !name.startsWith(".") && !name.contains("/") && !name.contains("\\") &&
      name.endsWith(".audio")

  private fun ensureInitializedLocked() {
    if (initialized) return
    initialized = true
    val meta = metaDir()
    val quotaFile = File(meta, "quota.json")
    if (quotaFile.isFile) {
      quotaFile.readText().trim().toLongOrNull()?.takeIf { it in 1L..(8L * 1024L * 1024L * 1024L) }?.let {
        maximumTotalBytes = it
      }
    }
    val concFile = File(meta, "concurrency.json")
    if (concFile.isFile) {
      concFile.readText().trim().toIntOrNull()?.takeIf { it in 1..3 }?.let {
        concurrency = it
      }
    }
    val journalFile = File(meta, "journal.json")
    if (journalFile.isFile) {
      try {
        val root = JSONObject(journalFile.readText())
        val keys = root.keys()
        while (keys.hasNext()) {
          val k = keys.next()
          if (!validName(k)) continue
          val o = root.optJSONObject(k) ?: continue
          var st = o.optString("state", "failed")
          val intent = o.optString("intent", "").ifBlank { null }
          var err = o.optString("error", "").ifBlank { null }
          if (st in setOf("running", "queued", "pausing", "cancelling")) {
            st = when (intent) {
              "cancel" -> "cancelled"
              "pause" -> "paused"
              else -> "failed"
            }
            if (st == "failed" && err == null) err = "interrupted"
          }
          records[k] = TransferRecord(
            fileName = k,
            generation = o.optString("generation", UUID.randomUUID().toString()),
            fingerprint = o.optString("fingerprint", ""),
            state = st,
            received = o.optLong("received", 0L),
            expected = o.optLong("expected", 0L),
            error = err,
            intent = intent
          )
        }
      } catch (_: Throwable) {
        journalFile.delete()
      }
    }
  }

  private fun persistJournalLocked() {
    val root = JSONObject()
    records.forEach { (k, v) -> root.put(k, v.toJson()) }
    val target = File(metaDir(), "journal.json")
    val tmp = File(metaDir(), "journal.tmp")
    try {
      tmp.writeText(root.toString())
      if (!tmp.renameTo(target)) {
        target.writeText(root.toString())
        tmp.delete()
      }
    } catch (_: Throwable) {
      tmp.delete()
    }
  }

  private fun usedBytesLocked(): Long =
    offlineDir().listFiles()?.filter { it.isFile }?.sumOf { it.length() } ?: 0L

  private fun scheduleLocked() {
    while (inFlightJobs.size < concurrency && queuedJobs.isNotEmpty()) {
      val job = queuedJobs.removeFirst()
      val rec = records[job.fileName]
      if (rec == null || rec.generation != job.generation || rec.intent != null) continue
      rec.state = "running"
      inFlightJobs.add(job.fileName)
      persistJournalLocked()
      NexusDownloadService.start(reactCtx())
      workerPool.execute { executeDownload(job) }
    }
    if (inFlightJobs.isEmpty() && queuedJobs.isEmpty()) {
      NexusDownloadService.stop(reactCtx())
    }
  }

  private fun executeDownload(job: PendingJob) {
    val partFile = File(offlineDir(), "${job.fileName}.part")
    val finalFile = File(offlineDir(), job.fileName)
    var existingOffset = if (job.resume && partFile.isFile) partFile.length() else 0L
    if (!job.resume && partFile.exists()) {
      partFile.delete()
      existingOffset = 0L
    }

    try {
      val reqBuilder = Request.Builder().url(job.url).get()
      job.headers.forEach { (k, v) -> reqBuilder.header(k, v) }
      if (existingOffset > 0L) {
        reqBuilder.header("Range", "bytes=$existingOffset-")
      }
      val call = httpClient.newCall(reqBuilder.build())
      activeCalls[job.fileName] = call

      call.execute().use { resp ->
        if (!resp.isSuccessful) {
          finishTransfer(job, "failed", "http_${resp.code}", existingOffset, 0L)
          return
        }
        val body = resp.body ?: run {
          finishTransfer(job, "failed", "empty", existingOffset, 0L)
          return
        }
        val isPartial = resp.code == 206 && existingOffset > 0L
        val writeOffset = if (isPartial) existingOffset else 0L
        val contentLen = body.contentLength()
        val expectedTotal = if (contentLen > 0L) writeOffset + contentLen else 0L

        synchronized(lock) {
          val usedWithoutPart = max(0L, usedBytesLocked() - (if (partFile.exists()) partFile.length() else 0L))
          if (expectedTotal > 0L && usedWithoutPart + expectedTotal > maximumTotalBytes) {
            call.cancel()
            finishTransferLocked(job, "failed", "capacity", writeOffset, expectedTotal)
            return
          }
          records[job.fileName]?.takeIf { it.generation == job.generation }?.let { rec ->
            rec.received = writeOffset
            rec.expected = expectedTotal
            persistJournalLocked()
          }
        }

        val raf = RandomAccessFile(partFile, "rw")
        try {
          raf.seek(writeOffset)
          if (!isPartial) raf.setLength(0L)
          var received = writeOffset
          var lastPersistMs = System.currentTimeMillis()
          val buf = ByteArray(16_384)
          body.byteStream().use { input ->
            while (true) {
              val n = input.read(buf)
              if (n <= 0) break
              val interruptedIntent = synchronized(lock) {
                records[job.fileName]?.takeIf { it.generation == job.generation }?.intent
              }
              if (interruptedIntent != null) {
                call.cancel()
                val nextState = if (interruptedIntent == "pause") "paused" else "cancelled"
                if (nextState == "cancelled") partFile.delete()
                finishTransfer(job, nextState, null, received, expectedTotal)
                return
              }
              raf.write(buf, 0, n)
              received += n
              val exceeded = synchronized(lock) {
                val baseUsed = max(0L, usedBytesLocked() - partFile.length())
                baseUsed + received > maximumTotalBytes
              }
              if (exceeded) {
                call.cancel()
                partFile.delete()
                finishTransfer(job, "failed", "capacity", received, expectedTotal)
                return
              }
              val now = System.currentTimeMillis()
              if (now - lastPersistMs > 400L) {
                lastPersistMs = now
                synchronized(lock) {
                  records[job.fileName]?.takeIf { it.generation == job.generation }?.let { rec ->
                    rec.received = received
                    rec.expected = max(expectedTotal, received)
                  }
                }
              }
            }
          }
          raf.fd.sync()
          raf.close()

          if (finalFile.exists()) finalFile.delete()
          val moved = if (partFile.renameTo(finalFile)) true else {
            partFile.copyTo(finalFile, overwrite = true)
            partFile.delete()
            true
          }
          if (moved && finalFile.isFile && finalFile.length() > 0L) {
            finishTransfer(job, "completed", null, finalFile.length(), finalFile.length())
          } else {
            finishTransfer(job, "failed", "io", received, expectedTotal)
          }
        } finally {
          try {
            raf.close()
          } catch (_: Throwable) {
          }
        }
      }
    } catch (_: Throwable) {
      synchronized(lock) {
        val rec = records[job.fileName]?.takeIf { it.generation == job.generation }
        val nextState = when (rec?.intent) {
          "pause" -> "paused"
          "cancel" -> {
            partFile.delete()
            "cancelled"
          }
          else -> "failed"
        }
        val err = if (nextState == "failed") "network" else null
        finishTransferLocked(job, nextState, err, if (partFile.isFile) partFile.length() else (rec?.received ?: 0L), rec?.expected ?: 0L)
      }
    }
  }

  private fun finishTransfer(job: PendingJob, state: String, error: String?, received: Long, expected: Long) {
    synchronized(lock) {
      finishTransferLocked(job, state, error, received, expected)
    }
  }

  private fun finishTransferLocked(job: PendingJob, state: String, error: String?, received: Long, expected: Long) {
    activeCalls.remove(job.fileName)
    inFlightJobs.remove(job.fileName)
    records[job.fileName]?.takeIf { it.generation == job.generation }?.let { rec ->
      rec.state = state
      rec.error = error
      rec.received = received
      rec.expected = expected
      persistJournalLocked()
    }
    scheduleLocked()
  }

  override fun definition() = ModuleDefinition {
    Name("NexusDownloads")

    AsyncFunction("configure") { maximum: Long ->
      if (maximum <= 0L || maximum > 8L * 1024L * 1024L * 1024L) throw IllegalArgumentException("quota")
      synchronized(lock) {
        ensureInitializedLocked()
        maximumTotalBytes = maximum
        File(metaDir(), "quota.json").writeText(maximum.toString())
      }
    }

    AsyncFunction("setConcurrency") { value: Int ->
      if (value !in 1..3) throw IllegalArgumentException("concurrency")
      synchronized(lock) {
        ensureInitializedLocked()
        concurrency = value
        File(metaDir(), "concurrency.json").writeText(value.toString())
        scheduleLocked()
      }
    }

    AsyncFunction("snapshot") { name: String ->
      synchronized(lock) {
        ensureInitializedLocked()
        records[name]?.toMap()
      }
    }

    AsyncFunction("begin") { url: String, name: String, headers: Map<String, String>, resume: Boolean, identity: String?, promise: Promise ->
      if (!validName(name) || !(url.startsWith("http://") || url.startsWith("https://"))) {
        promise.reject("DOWNLOAD_INVALID", "下载地址或文件名无效", null)
        return@AsyncFunction
      }
      synchronized(lock) {
        ensureInitializedLocked()
        activeCalls.remove(name)?.cancel()
        queuedJobs.removeAll { it.fileName == name }
        val gen = UUID.randomUUID().toString()
        val existingPart = File(offlineDir(), "$name.part")
        val canResume = resume && existingPart.isFile && existingPart.length() > 0L &&
          (identity == null || records[name]?.fingerprint.isNullOrEmpty() || records[name]?.fingerprint == identity)
        val rec = TransferRecord(
          fileName = name,
          generation = gen,
          fingerprint = identity ?: "",
          state = "queued",
          received = if (canResume) existingPart.length() else 0L,
          expected = 0L,
          error = null,
          intent = null
        )
        records[name] = rec
        queuedJobs.addLast(PendingJob(name, gen, url, headers, canResume))
        persistJournalLocked()
        scheduleLocked()
        promise.resolve(rec.toMap())
      }
    }

    AsyncFunction("stop") { name: String, pause: Boolean ->
      synchronized(lock) {
        ensureInitializedLocked()
        val rec = records[name] ?: return@AsyncFunction
        rec.intent = if (pause) "pause" else "cancel"
        if (rec.state == "queued") {
          queuedJobs.removeAll { it.fileName == name }
          rec.state = if (pause) "paused" else "cancelled"
          if (!pause) File(offlineDir(), "$name.part").delete()
          persistJournalLocked()
          scheduleLocked()
        } else if (rec.state == "running") {
          rec.state = if (pause) "pausing" else "cancelling"
          persistJournalLocked()
          activeCalls[name]?.cancel()
        }
      }
    }

    AsyncFunction("discard") { name: String ->
      synchronized(lock) {
        ensureInitializedLocked()
        records[name]?.intent = "cancel"
        queuedJobs.removeAll { it.fileName == name }
        activeCalls.remove(name)?.cancel()
        records.remove(name)
        File(offlineDir(), "$name.part").delete()
        persistJournalLocked()
        scheduleLocked()
      }
    }

    AsyncFunction("acknowledge") { name: String ->
      synchronized(lock) {
        ensureInitializedLocked()
        records.remove(name)
        persistJournalLocked()
      }
    }

    OnDestroy {
      synchronized(lock) {
        activeCalls.values.forEach { it.cancel() }
        activeCalls.clear()
        queuedJobs.clear()
      }
    }
  }
}
