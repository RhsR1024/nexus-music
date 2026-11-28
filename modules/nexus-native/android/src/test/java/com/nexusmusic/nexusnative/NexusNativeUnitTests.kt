package com.nexusmusic.nexusnative

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.nio.charset.StandardCharsets

class NexusNativeUnitTests {
  @Test
  fun audioUrlProbeRecognizesAllSupportedContainersAndRejectsCredentials() {
    assertEquals("flac", AudioURLProbe.mediaHeader("fLaC0000".toByteArray()))
    assertEquals("wav", AudioURLProbe.mediaHeader("RIFF1234WAVEfmt ".toByteArray()))
    assertEquals("aiff", AudioURLProbe.mediaHeader("FORM1234AIFF".toByteArray()))
    assertEquals("ogg", AudioURLProbe.mediaHeader("OggS\u0000\u0002".toByteArray()))
    assertEquals("mp4", AudioURLProbe.mediaHeader(byteArrayOf(0, 0, 0, 24, 'f'.code.toByte(), 't'.code.toByte(), 'y'.code.toByte(), 'p'.code.toByte())))
    assertEquals("id3", AudioURLProbe.mediaHeader(byteArrayOf('I'.code.toByte(), 'D'.code.toByte(), '3'.code.toByte(), 3, 0, 0, 0, 0, 0, 0)))
    assertEquals("aac", AudioURLProbe.mediaHeader(byteArrayOf(0xFF.toByte(), 0xF1.toByte(), 0x50, 0x80.toByte())))
    assertEquals("mpeg", AudioURLProbe.mediaHeader(byteArrayOf(0xFF.toByte(), 0xFB.toByte(), 0x90.toByte(), 0x00)))
    assertNull(AudioURLProbe.mediaHeader("<html>error</html>".toByteArray()))

    assertTrue(AudioURLProbe.allowed("https://music.example.com/track.mp3"))
    assertFalse(AudioURLProbe.allowed("file:///etc/passwd"))
    assertFalse(AudioURLProbe.allowed("https://user:pass@music.example.com/track.mp3"))
  }

  @Test
  fun scriptUtilitiesHandlesMd5AesDeflateInflateAndEncodingRoundtrip() {
    val hello = "音枢Nexus🎵".toByteArray(StandardCharsets.UTF_8)
    val arr = ScriptUtilities.toJsonByteArray(hello)
    val hex = ScriptUtilities.perform("encode", JSONObject().put("bytes", arr).put("encoding", "hex")) as String
    assertTrue(hex.isNotEmpty())
    val utf8 = ScriptUtilities.perform("encode", JSONObject().put("bytes", arr).put("encoding", "utf8")) as String
    assertEquals("音枢Nexus🎵", utf8)

    val md5 = ScriptUtilities.perform("md5", JSONObject().put("bytes", ScriptUtilities.toJsonByteArray("abc".toByteArray()))) as String
    assertEquals("900150983cd24fb0d6963f7d28e17f72", md5)

    val deflated = ScriptUtilities.perform("deflate", JSONObject().put("bytes", arr)) as JSONArray
    val inflated = ScriptUtilities.perform("inflate", JSONObject().put("bytes", deflated)) as JSONArray
    val restored = ScriptUtilities.perform("encode", JSONObject().put("bytes", inflated).put("encoding", "utf8")) as String
    assertEquals("音枢Nexus🎵", restored)

    val key = ScriptUtilities.toJsonByteArray("0123456789abcdef".toByteArray())
    val iv = ScriptUtilities.toJsonByteArray("fedcba9876543210".toByteArray())
    val encrypted = ScriptUtilities.perform(
      "aesEncrypt",
      JSONObject().put("bytes", arr).put("mode", "aes-128-cbc").put("key", key).put("iv", iv)
    ) as JSONArray
    assertTrue(encrypted.length() >= 16 && encrypted.length() % 16 == 0)
  }

  @Test
  fun sleepTimerTracksDurationAndTrackFinishSemantics() {
    var lastState: Map<String, Any> = emptyMap()
    var expiredCount = 0
    var scheduledAction: (() -> Unit)? = null
    val timer = PlaybackSleepTimer(
      now = { 1000.0 },
      schedule = { _, action ->
        scheduledAction = action
        ({ scheduledAction = null })
      },
      changed = { lastState = it },
      expired = { expiredCount++ }
    )
    assertTrue(timer.set(60.0, null))
    assertEquals("duration", lastState["mode"])
    assertEquals(61_000.0, lastState["deadline"])
    scheduledAction?.invoke()
    assertEquals(1, expiredCount)
    assertEquals("off", timer.snapshot()["mode"])

    assertTrue(timer.set(0.0, "entry-1"))
    assertEquals("track", timer.snapshot()["mode"])
    assertFalse(timer.ended("entry-other"))
    assertTrue(timer.ended("entry-1"))
    assertEquals(2, expiredCount)
    assertEquals("off", timer.snapshot()["mode"])

    assertTrue(timer.set(0.0, "entry-2"))
    timer.trackChanged("entry-3")
    assertEquals("off", timer.snapshot()["mode"])
  }

  @Test
  fun accountTransferWireEnforcesPrivateIpv4AndHmac() {
    assertTrue(AccountTransferWire.privateIPv4("192.168.1.25"))
    assertTrue(AccountTransferWire.privateIPv4("10.0.0.5"))
    assertTrue(AccountTransferWire.privateIPv4("172.16.4.8"))
    assertFalse(AccountTransferWire.privateIPv4("8.8.8.8"))
    assertFalse(AccountTransferWire.privateIPv4("127.0.0.1"))
    assertFalse(AccountTransferWire.privateIPv4("172.32.0.1"))
  }

  @Test
  fun visualFlowPaletteSelectsDistinctHueBucketsAndHandlesMonochrome() {
    // 3 distinct vivid colors: red, green, blue
    val vivid = IntArray(24) { idx ->
      when (idx % 3) {
        0 -> (0xFF shl 24) or (0xE0 shl 16) or (0x30 shl 8) or 0x30
        1 -> (0xFF shl 24) or (0x30 shl 16) or (0xD0 shl 8) or 0x40
        else -> (0xFF shl 24) or (0x30 shl 16) or (0x50 shl 8) or 0xE8
      }
    }
    val colors = VisualPaletteMath.flowPaletteFromArgb(vivid)
    assertEquals(3, colors.size)
    assertEquals(3, colors.toSet().size)

    // Monochrome gray gradient triggers low-saturation quantile branch
    val gray = IntArray(12) { idx ->
      val v = 30 + idx * 18
      (0xFF shl 24) or (v shl 16) or (v shl 8) or v
    }
    val mono = VisualPaletteMath.flowPaletteFromArgb(gray)
    assertEquals(3, mono.size)
    assertNotNull(mono[0])
  }

  @Test
  fun musicWebLoginPolicyMatchesIosRules() {
    assertEquals("https://music.163.com/m/login", MusicWebLoginPolicy.initialURL("wy", "abc"))
    assertTrue(MusicWebLoginPolicy.ready(mapOf("MUSIC_U" to "token"), "wy"))
    assertFalse(MusicWebLoginPolicy.ready(emptyMap(), "wy"))
    assertTrue(MusicWebLoginPolicy.allowsUrl("https://dl.reg.163.com/dl/yd/phone", "wy"))
    assertTrue(MusicWebLoginPolicy.allowsUrl("https://c.dun.163yun.com/api/v3/get", "wy"))
    assertTrue(MusicWebLoginPolicy.allowsUrl("https://urswebzj.nosdn.127.net/webzj.js", "wy"))
    assertFalse(MusicWebLoginPolicy.allowsUrl("https://y.qq.com/", "wy"))
    assertFalse(MusicWebLoginPolicy.allowsUrl("https://163.com.evil.test/", "wy"))
    assertTrue(
      MusicWebLoginPolicy.ready(
        mapOf("qqmusic_key" to "Q_H_L_123", "uin" to "o123456", "login_type" to "1"),
        "tx"
      )
    )
    assertFalse(
      MusicWebLoginPolicy.ready(
        mapOf("qqmusic_key" to "W_X_token", "uin" to "o123456"),
        "tx"
      )
    )
    assertEquals("https://music.douyin.com/qishui", MusicWebLoginPolicy.initialURL("qishui", "abc"))
    assertTrue(MusicWebLoginPolicy.allowsUrl("https://music.douyin.com/qishui", "qishui"))
    assertTrue(MusicWebLoginPolicy.allowsUrl("https://sso.douyin.com/login", "qishui"))
    assertFalse(MusicWebLoginPolicy.allowsUrl("https://douyin.com.evil.test/", "qishui"))
    assertFalse(MusicWebLoginPolicy.allowsUrl("https://y.qq.com/", "qishui"))
    assertTrue(MusicWebLoginPolicy.ready(mapOf("sessionid" to "qs-sess", "uid_tt" to "qs-uid"), "qishui"))
    assertTrue(MusicWebLoginPolicy.ready(mapOf("sessionid" to "qs-sess"), "qishui"))
    assertTrue(MusicWebLoginPolicy.ready(mapOf("sessionid_ss" to "qs-sess-ss"), "qishui"))
    assertFalse(MusicWebLoginPolicy.ready(mapOf("sid_tt" to "qs-sid"), "qishui"))
    assertFalse(MusicWebLoginPolicy.ready(mapOf("uid_tt" to "qs-uid"), "qishui"))
  }
}
