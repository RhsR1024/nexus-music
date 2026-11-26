package com.nexusmusic.nexusnative

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import java.util.concurrent.ConcurrentHashMap

/**
 * Dedicated camera QR transfer scanner activity.
 * Gracefully handles cancel and devices without camera hardware (e.g. emulator) so user can
 * fall back to pasting the pairing code directly.
 */
class NexusQrScannerActivity : Activity() {
  companion object {
    const val EXTRA_SESSION_ID = "session_id"
    private val callbacks = ConcurrentHashMap<String, (Result<String?>) -> Unit>()
    private val active = ConcurrentHashMap<String, NexusQrScannerActivity>()

    fun register(id: String, callback: (Result<String?>) -> Unit) {
      callbacks[id] = callback
    }

    fun cancel(id: String) {
      val act = active.remove(id)
      val cb = callbacks.remove(id)
      cb?.invoke(Result.success(null))
      act?.runOnUiThread { act.finish() }
    }
  }

  private var sessionId: String = ""
  private var finished = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    sessionId = intent.getStringExtra(EXTRA_SESSION_ID) ?: ""
    if (sessionId.isEmpty()) {
      finishWith(Result.success(null))
      return
    }
    active[sessionId] = this

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(Color.BLACK)
      setPadding(48, 80, 48, 80)
    }
    val hint = TextView(this).apply {
      text = "请扫描电脑端显示的 QQ 音乐配对二维码，或返回直接粘贴配对码"
      setTextColor(Color.WHITE)
      textSize = 16f
      gravity = Gravity.CENTER
    }
    val back = Button(this).apply {
      text = "返回粘贴配对码"
      setOnClickListener { finishWith(Result.success(null)) }
    }
    root.addView(hint, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    root.addView(back, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
      topMargin = 48
    })
    setContentView(root)
  }

  private fun finishWith(result: Result<String?>) {
    if (finished) return
    finished = true
    active.remove(sessionId)
    val cb = callbacks.remove(sessionId)
    cb?.invoke(result)
    finish()
  }

  override fun onDestroy() {
    if (!finished) finishWith(Result.success(null))
    super.onDestroy()
  }
}
