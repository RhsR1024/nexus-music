package com.nexusmusic.nexusnative

import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.BaseAudioProcessor
import androidx.media3.common.util.UnstableApi
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Media3 AudioProcessor feeding decoded PCM directly into the shared C++20 [NexusAudioDSP]
 * via JNI on the native audio render thread. Never sends PCM frames through React state.
 *
 * Outputs [C.ENCODING_PCM_16BIT] so downstream Media3 processors in DefaultAudioProcessorChain
 * (SilenceSkippingAudioProcessor & SonicAudioProcessor for playback speed) accept the stream
 * cleanly across all Android 10+ devices and audio routes, while running internal EQ/FFT DSP
 * at full 32-bit float precision.
 */
@UnstableApi
internal class NexusDspAudioProcessor(private val dsp: NexusAudioDSP) : BaseAudioProcessor() {
  private var inputEncoding: Int = C.ENCODING_INVALID
  private var channels: Int = 0
  private var floatScratch: ByteBuffer = ByteBuffer.allocateDirect(0).order(ByteOrder.nativeOrder())

  override fun onConfigure(inputAudioFormat: AudioProcessor.AudioFormat): AudioProcessor.AudioFormat {
    val encoding = inputAudioFormat.encoding
    if (encoding != C.ENCODING_PCM_16BIT &&
      encoding != C.ENCODING_PCM_FLOAT &&
      encoding != C.ENCODING_PCM_24BIT &&
      encoding != C.ENCODING_PCM_32BIT
    ) {
      dsp.prepare(inputAudioFormat.sampleRate.toDouble(), false)
      throw AudioProcessor.UnhandledAudioFormatException(inputAudioFormat)
    }
    inputEncoding = encoding
    channels = inputAudioFormat.channelCount
    val supported = channels in 1..8
    dsp.prepare(inputAudioFormat.sampleRate.toDouble(), supported)
    return AudioProcessor.AudioFormat(
      inputAudioFormat.sampleRate,
      inputAudioFormat.channelCount,
      C.ENCODING_PCM_16BIT
    )
  }

  override fun queueInput(inputBuffer: ByteBuffer) {
    val position = inputBuffer.position()
    val limit = inputBuffer.limit()
    val size = limit - position
    if (size <= 0 || channels <= 0) return

    val bytesPerSample = when (inputEncoding) {
      C.ENCODING_PCM_16BIT -> 2
      C.ENCODING_PCM_24BIT -> 3
      C.ENCODING_PCM_32BIT, C.ENCODING_PCM_FLOAT -> 4
      else -> return
    }
    val sampleCount = size / bytesPerSample
    val frameCount = sampleCount / channels
    if (frameCount <= 0) {
      inputBuffer.position(limit)
      return
    }

    val totalSamples = frameCount * channels
    val floatBytes = totalSamples * 4
    if (floatScratch.capacity() < floatBytes) {
      floatScratch = ByteBuffer.allocateDirect(floatBytes).order(ByteOrder.nativeOrder())
    } else {
      floatScratch.clear()
    }
    floatScratch.limit(floatBytes)

    when (inputEncoding) {
      C.ENCODING_PCM_FLOAT -> {
        var i = position
        val end = position + totalSamples * 4
        while (i < end) {
          floatScratch.putFloat(inputBuffer.getFloat(i))
          i += 4
        }
      }
      C.ENCODING_PCM_16BIT -> {
        var i = position
        val end = position + totalSamples * 2
        while (i < end) {
          val sample = inputBuffer.getShort(i).toFloat() / 32768.0f
          floatScratch.putFloat(sample)
          i += 2
        }
      }
      C.ENCODING_PCM_24BIT -> {
        var i = position
        val end = position + totalSamples * 3
        while (i < end) {
          val b0 = inputBuffer.get(i).toInt() and 0xFF
          val b1 = inputBuffer.get(i + 1).toInt() and 0xFF
          val b2 = inputBuffer.get(i + 2).toInt()
          val int24 = (b2 shl 16) or (b1 shl 8) or b0
          floatScratch.putFloat(int24.toFloat() / 8388608.0f)
          i += 3
        }
      }
      C.ENCODING_PCM_32BIT -> {
        var i = position
        val end = position + totalSamples * 4
        while (i < end) {
          val int32 = inputBuffer.getInt(i)
          floatScratch.putFloat((int32.toDouble() / 2147483648.0).toFloat())
          i += 4
        }
      }
    }

    inputBuffer.position(position + totalSamples * bytesPerSample)
    dsp.processInterleaved(floatScratch, channels, frameCount)

    val outBuffer = replaceOutputBuffer(totalSamples * 2)
    floatScratch.position(0)
    var idx = 0
    while (idx < totalSamples) {
      val sample = floatScratch.getFloat(idx * 4).coerceIn(-1.0f, 1.0f)
      val pcm16 = (sample * 32767.0f).toInt().coerceIn(-32768, 32767).toShort()
      outBuffer.putShort(pcm16)
      idx += 1
    }
    outBuffer.flip()
  }

  override fun onReset() {
    super.onReset()
    floatScratch = ByteBuffer.allocateDirect(0).order(ByteOrder.nativeOrder())
  }
}
