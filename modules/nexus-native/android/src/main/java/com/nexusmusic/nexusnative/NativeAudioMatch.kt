package com.nexusmusic.nexusnative

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Base64
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.abs
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sqrt

/**
 * 1:1 Android parity native microphone sampler for Audio Match (听歌识曲).
 * Emits real-time level metrics and a bounded 16 kHz mono 16-bit WAV clip for
 * optional user-configured cloud audio recognition (ACRCloud / AudD).
 */
class NativeAudioMatch {
  private val active = AtomicBoolean(false)
  private val cancelled = AtomicBoolean(false)

  fun permissionStatus(context: Context?): String {
    val ctx = context ?: return "undetermined"
    return if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
      "granted"
    } else {
      "denied"
    }
  }

  fun requestPermission(activity: Activity?): Boolean {
    val act = activity ?: return false
    if (ContextCompat.checkSelfPermission(act, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
      return true
    }
    ActivityCompat.requestPermissions(act, arrayOf(Manifest.permission.RECORD_AUDIO), 4107)
    return false
  }

  fun stopCapture() {
    cancelled.set(true)
    active.set(false)
  }

  fun startCapture(
    context: Context?,
    durationMs: Int,
    onLevel: (Map<String, Any>) -> Unit
  ): Map<String, Any> {
    if (permissionStatus(context) != "granted") {
      throw IllegalStateException("未获得麦克风权限")
    }
    stopCapture()
    val clampedMs = durationMs.coerceIn(2000, 12_000)
    val sampleRate = 16_000
    val maxPcmBytes = sampleRate * 10 * 2 // <= 10s (320 KB PCM)
    val minBuf = AudioRecord.getMinBufferSize(
      sampleRate,
      AudioFormat.CHANNEL_IN_MONO,
      AudioFormat.ENCODING_PCM_16BIT
    ).coerceAtLeast(4096)

    @Suppress("MissingPermission")
    val recorder = AudioRecord(
      MediaRecorder.AudioSource.MIC,
      sampleRate,
      AudioFormat.CHANNEL_IN_MONO,
      AudioFormat.ENCODING_PCM_16BIT,
      minBuf * 2
    )
    if (recorder.state != AudioRecord.STATE_INITIALIZED) {
      recorder.release()
      throw IllegalStateException("麦克风初始化失败")
    }

    active.set(true)
    cancelled.set(false)
    val startMs = System.currentTimeMillis()
    var lastEmitMs = 0L
    var peakLevel = 0.0
    var rmsAccum = 0.0
    var rmsCount = 0
    var zeroCrossings = 0
    val bucketEnergies = DoubleArray(24)
    val bucketCounts = IntArray(24)
    val pcm = ShortArray(1024)
    val pcmStream = ByteArrayOutputStream(min(maxPcmBytes, sampleRate * (clampedMs / 1000) * 2))

    try {
      recorder.startRecording()
      while (active.get()) {
        val elapsed = (System.currentTimeMillis() - startMs).toInt()
        if (elapsed >= clampedMs) break
        val n = recorder.read(pcm, 0, pcm.size)
        if (n <= 0) continue
        var sumSq = 0.0
        var localPeak = 0.0
        var prev = pcm[0].toInt()
        for (i in 0 until n) {
          val sample = pcm[i].toInt()
          if (pcmStream.size() + 2 <= maxPcmBytes) {
            pcmStream.write(sample and 0xFF)
            pcmStream.write((sample ushr 8) and 0xFF)
          }
          val s = sample.toDouble() / 32768.0
          val a = abs(s)
          if (a > localPeak) localPeak = a
          sumSq += s * s
          if ((sample >= 0 && prev < 0) || (sample < 0 && prev >= 0)) zeroCrossings++
          prev = sample
        }
        val rms = sqrt(sumSq / n)
        if (localPeak > peakLevel) peakLevel = localPeak
        rmsAccum += rms
        rmsCount++
        val bucket = ((elapsed * 24) / clampedMs.coerceAtLeast(1)).coerceIn(0, 23)
        bucketEnergies[bucket] += rms
        bucketCounts[bucket]++

        val now = System.currentTimeMillis()
        if (now - lastEmitMs >= 80L) {
          lastEmitMs = now
          onLevel(
            mapOf(
              "level" to min(1.0, rms * 3.5),
              "peak" to min(1.0, localPeak),
              "elapsedMs" to elapsed
            )
          )
        }
      }
    } finally {
      active.set(false)
      try { recorder.stop() } catch (_: Throwable) {}
      try { recorder.release() } catch (_: Throwable) {}
    }

    val elapsedTotal = (System.currentTimeMillis() - startMs).toInt().coerceAtLeast(0)
    val sb = StringBuilder(24)
    for (i in 0 until 24) {
      val mean = if (bucketCounts[i] > 0) bucketEnergies[i] / bucketCounts[i] else 0.0
      val nibble = (mean * 45.0).roundToInt().coerceIn(0, 15)
      sb.append(nibble.toString(16))
    }
    val wasCancelled = cancelled.get()
    val result = mutableMapOf<String, Any>(
      "durationMs" to elapsedTotal,
      "sampleRate" to sampleRate,
      "avgLevel" to if (rmsCount > 0) rmsAccum / rmsCount else 0.0,
      "peakLevel" to peakLevel,
      "zeroCrossings" to zeroCrossings,
      "energySignature" to sb.toString(),
      "cancelled" to wasCancelled
    )
    val pcmBytes = pcmStream.toByteArray()
    if (!wasCancelled && pcmBytes.size >= 8000) {
      val wavBytes = buildWavBytes(pcmBytes, sampleRate)
      result["audioBase64"] = Base64.encodeToString(wavBytes, Base64.NO_WRAP)
      result["mimeType"] = "audio/wav"
    }
    return result
  }

  private fun buildWavBytes(pcm: ByteArray, sampleRate: Int): ByteArray {
    val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN)
    header.put("RIFF".toByteArray(Charsets.US_ASCII))
    header.putInt(36 + pcm.size)
    header.put("WAVE".toByteArray(Charsets.US_ASCII))
    header.put("fmt ".toByteArray(Charsets.US_ASCII))
    header.putInt(16)
    header.putShort(1) // PCM
    header.putShort(1) // Mono
    header.putInt(sampleRate)
    header.putInt(sampleRate * 2) // byteRate
    header.putShort(2) // blockAlign
    header.putShort(16) // bitsPerSample
    header.put("data".toByteArray(Charsets.US_ASCII))
    header.putInt(pcm.size)
    return header.array() + pcm
  }
}
