package com.nexusmusic.nexusnative

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Typeface
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.views.ExpoView
import org.json.JSONObject

class NexusLyricsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NexusLyrics")

    View(NexusLyricLineView::class) {
      Prop("configuration") { view: NexusLyricLineView, json: String ->
        view.configure(json)
      }
    }
  }
}

/**
 * Native lyric line view matching iOS NexusLyricLineView JSON contract.
 * Phase 0 provides smooth static/active line rendering; Phase 2 upgrades to full
 * per-word Choreographer sweep, Ruby layout, TTML inline styles, and blur.
 */
class NexusLyricLineView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private var text: String = ""
  private var fontSizeSp: Float = 24f
  private var alignment: Layout.Alignment = Layout.Alignment.ALIGN_NORMAL
  private var textColor: Int = Color.WHITE
  private var cachedLayout: StaticLayout? = null
  private var lastWidth: Int = -1

  private val textPaint = TextPaint(TextPaint.ANTI_ALIAS_FLAG).apply {
    color = Color.WHITE
    typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
  }

  init {
    setWillNotDraw(false)
    isClickable = false
    isFocusable = false
  }

  fun configure(json: String) {
    if (json.length > 262_144) return
    try {
      val obj = JSONObject(json)
      text = obj.optString("text", "")
      fontSizeSp = obj.optDouble("fontSize", 24.0).toFloat().coerceIn(10f, 72f)
      textColor = NexusColorParser.parse(obj.optString("color", "#FFFFFF"), Color.WHITE)
      alignment = when (obj.optString("alignment", "left")) {
        "center" -> Layout.Alignment.ALIGN_CENTER
        "right" -> Layout.Alignment.ALIGN_OPPOSITE
        else -> Layout.Alignment.ALIGN_NORMAL
      }
      val density = resources.displayMetrics.scaledDensity
      textPaint.textSize = fontSizeSp * density
      textPaint.color = textColor
      cachedLayout = null
      invalidate()
    } catch (_: Throwable) {
    }
  }

  override fun onDraw(canvas: Canvas) {
    if (text.isEmpty() || width <= 0) return
    if (cachedLayout == null || lastWidth != width) {
      lastWidth = width
      cachedLayout = StaticLayout.Builder.obtain(text, 0, text.length, textPaint, width)
        .setAlignment(alignment)
        .setIncludePad(false)
        .build()
    }
    cachedLayout?.draw(canvas)
  }
}
