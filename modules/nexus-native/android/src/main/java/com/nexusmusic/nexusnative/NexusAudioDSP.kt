package com.nexusmusic.nexusnative

import java.nio.ByteBuffer
import java.util.concurrent.atomic.AtomicLong

/**
 * Kotlin JNI wrapper around the shared C++20 [nexus::AudioDSP] engine.
 * Keeps 10-band biquad EQ, automatic headroom, and 32-band FFT spectrum
 * mathematically identical between iOS and Android.
 */
class NexusAudioDSP : AutoCloseable {
  private val handle = AtomicLong(0L)

  init {
    if (libraryLoaded) {
      handle.set(nativeCreate())
    }
  }

  fun prepare(sampleRate: Double, floatingPoint: Boolean) {
    val ptr = handle.get()
    if (ptr != 0L) nativePrepare(ptr, sampleRate, floatingPoint)
  }

  fun configure(enabled: Boolean, gains: List<Double>, preampDB: Double) {
    val ptr = handle.get()
    if (ptr == 0L) return
    val values = FloatArray(10) { idx -> gains.getOrNull(idx)?.toFloat() ?: 0f }
    nativeConfigure(ptr, enabled, values, preampDB.toFloat())
  }

  fun processInterleaved(buffer: ByteBuffer, channelCount: Int, frames: Int) {
    val ptr = handle.get()
    if (ptr != 0L && buffer.isDirect) {
      nativeProcessInterleaved(ptr, buffer, channelCount, frames)
    }
  }

  fun snapshot(): Map<String, Any> {
    val ptr = handle.get()
    if (ptr == 0L) {
      return mapOf(
        "bands" to List(32) { 0.0 },
        "supported" to false,
        "headroomDB" to 0.0
      )
    }
    val bands = nativeSpectrum(ptr)?.map { it.toDouble() } ?: List(32) { 0.0 }
    return mapOf(
      "bands" to bands,
      "supported" to nativeSupported(ptr),
      "headroomDB" to nativeHeadroomDB(ptr).toDouble()
    )
  }

  override fun close() {
    val ptr = handle.getAndSet(0L)
    if (ptr != 0L) nativeDestroy(ptr)
  }

  private external fun nativeCreate(): Long
  private external fun nativeDestroy(handle: Long)
  private external fun nativePrepare(handle: Long, sampleRate: Double, floatingPoint: Boolean)
  private external fun nativeConfigure(handle: Long, enabled: Boolean, gains: FloatArray, preampDB: Float)
  private external fun nativeProcessInterleaved(handle: Long, buffer: ByteBuffer, channelCount: Int, frames: Int)
  private external fun nativeSpectrum(handle: Long): FloatArray?
  private external fun nativeHeadroomDB(handle: Long): Float
  private external fun nativeSupported(handle: Long): Boolean

  companion object {
    val libraryLoaded: Boolean = try {
      System.loadLibrary("nexus_audio_dsp")
      true
    } catch (_: Throwable) {
      false
    }
  }
}
