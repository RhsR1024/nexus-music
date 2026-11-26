package com.nexusmusic.nexusnative

import android.content.Context
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import android.text.Layout
import android.text.SpannableString
import android.text.Spanned
import android.text.StaticLayout
import android.text.TextPaint
import android.text.TextUtils
import android.text.style.ForegroundColorSpan
import android.text.style.StyleSpan
import android.view.Choreographer
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.views.ExpoView
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min

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

private class ExactLineHeightSpan(private val heightPx: Int) : android.text.style.LineHeightSpan {
  override fun chooseHeight(
    text: CharSequence,
    start: Int,
    end: Int,
    spanstartv: Int,
    lineHeight: Int,
    fm: Paint.FontMetricsInt
  ) {
    if (heightPx <= 0) return
    if (fm.descent > heightPx) {
      fm.descent = min(heightPx, fm.descent)
      fm.bottom = fm.descent
      fm.ascent = 0
      fm.top = 0
    } else if (-fm.ascent + fm.descent > heightPx) {
      fm.bottom = fm.descent
      fm.ascent = -heightPx + fm.descent
      fm.top = fm.ascent
    } else if (-fm.ascent + fm.bottom > heightPx) {
      fm.top = fm.ascent
      fm.bottom = fm.ascent + heightPx
    } else if (-fm.top + fm.bottom > heightPx) {
      fm.top = fm.bottom - heightPx
    } else {
      val extra = heightPx - (-fm.top + fm.bottom)
      val halfTop = ceil(extra / 2.0).toInt()
      val halfBottom = extra - halfTop
      fm.top -= halfTop
      fm.ascent -= halfTop
      fm.bottom += halfBottom
      fm.descent += halfBottom
    }
  }
}

private data class LyricWordCue(
  val startIdx: Int,
  val endIdx: Int,
  val startMs: Double,
  val endMs: Double,
  val rubyBefore: String?,
  val rubyAfter: String?,
  val inlineColor: Int?,
  val bold: Boolean,
  val italic: Boolean
)

/**
 * 1:1 Android parity native lyric line renderer matching iOS NexusLyricsModule.swift.
 * Consumes the exact JSON configuration contract (size, center, lineHeight, maxLines, blur,
 * rubyInset/rubyAfterInset/rubyLineSpacing, emphasis, color, fontURI, weight, embolden,
 * stageStyle, words[], timedCues[]). Uses Choreographer only while playing with timed words.
 */
class NexusLyricLineView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private var text: String = ""
  private var positionSec: Double = 0.0
  private var anchorSec: Double = 0.0
  private var playing: Boolean = false
  private var signature: String = ""

  private var sizePt: Float = 24f
  private var centered: Boolean = false
  private var lineHeightRatio: Float = 1.35f
  private var maxLines: Int = 0
  private var blurRadius: Float = 0f
  private var rubyInsetPt: Float = 0f
  private var rubyAfterInsetPt: Float = 0f
  private var rubyLineSpacingPt: Float = 0f
  private var emphasis: Boolean = true
  private var embolden: Float = 0f
  private var stageStyle: String = "classic"
  private var baseColor: Int = Color.WHITE
  private var words: List<LyricWordCue> = emptyList()

  private var baseLayout: StaticLayout? = null
  private var activeLayout: StaticLayout? = null
  private var lastLayoutWidth: Int = -1
  private var lastClockTickMs: Long = 0L

  private val basePaint = TextPaint(Paint.ANTI_ALIAS_FLAG)
  private val activePaint = TextPaint(Paint.ANTI_ALIAS_FLAG)
  private val rubyPaint = TextPaint(Paint.ANTI_ALIAS_FLAG)

  private val frameCallback = object : Choreographer.FrameCallback {
    override fun doFrame(frameTimeNanos: Long) {
      if (!playing || words.isEmpty() || !isAttachedToWindow) return
      val nowMs = frameTimeNanos / 1_000_000L
      if (nowMs - lastClockTickMs >= 16L) {
        lastClockTickMs = nowMs
        invalidate()
      }
      Choreographer.getInstance().postFrameCallback(this)
    }
  }

  init {
    setWillNotDraw(false)
    isClickable = false
    isFocusable = false
    setLayerType(LAYER_TYPE_SOFTWARE, null)
  }

  fun configure(json: String) {
    if (json.toByteArray().size >= 524_288) return
    val obj = try {
      JSONObject(json)
    } catch (_: Throwable) {
      return
    }
    val nextText = obj.optString("text", "")
    if (nextText.length > 20_000) return

    positionSec = obj.optDouble("position", 0.0).takeIf { it.isFinite() } ?: 0.0
    anchorSec = SystemClock.elapsedRealtime() / 1000.0
    playing = obj.optBoolean("playing", false)

    val nextSize = obj.optDouble("size", 24.0).takeIf { it.isFinite() }?.coerceIn(10.0, 100.0)?.toFloat() ?: 24f
    val nextCenter = obj.optBoolean("center", false)
    val nextLineHeight = obj.optDouble("lineHeight", 1.35).takeIf { it.isFinite() }?.coerceIn(1.1, 2.0)?.toFloat() ?: 1.35f
    val nextMaxLines = obj.optInt("maxLines", 0).coerceIn(0, 10)
    val nextBlur = obj.optDouble("blur", 0.0).takeIf { it.isFinite() }?.coerceIn(0.0, 4.0)?.toFloat() ?: 0f
    val nextRubyInset = obj.optDouble("rubyInset", 0.0).takeIf { it.isFinite() }?.coerceIn(0.0, 36.0)?.toFloat() ?: 0f
    val nextRubyAfter = obj.optDouble("rubyAfterInset", 0.0).takeIf { it.isFinite() }?.coerceIn(0.0, 36.0)?.toFloat() ?: 0f
    val nextRubySpacing = obj.optDouble("rubyLineSpacing", 0.0).takeIf { it.isFinite() }?.coerceIn(0.0, 72.0)?.toFloat() ?: 0f
    emphasis = obj.optBoolean("emphasis", true)
    val hex = obj.optString("color", "#FFFFFF")
    val fontUri = obj.optString("fontURI", "")
    val weightStr = obj.optString("weight", "600")
    val nextEmbolden = obj.optDouble("embolden", 0.0).takeIf { it.isFinite() }?.coerceIn(0.0, 0.4)?.toFloat() ?: 0f
    val reqStyle = obj.optString("stageStyle", "classic")
    val nextStyle = if (reqStyle in setOf("classic", "neon", "cyberpunk", "aurora")) reqStyle else "classic"
    val rawWords = obj.optJSONArray("words")
    val rawCues = obj.optJSONArray("timedCues")

    val layoutKey = "$nextStyle|$nextText|$nextSize|$nextCenter|$hex|$fontUri|$weightStr|$nextLineHeight|$nextMaxLines|$nextBlur|$nextEmbolden|$nextRubyInset|$nextRubyAfter|$nextRubySpacing|${rawWords?.toString() ?: ""}|${rawCues?.toString() ?: ""}"
    if (signature != layoutKey) {
      signature = layoutKey
      text = nextText
      sizePt = nextSize
      centered = nextCenter
      lineHeightRatio = nextLineHeight
      maxLines = nextMaxLines
      blurRadius = nextBlur
      rubyInsetPt = nextRubyInset
      rubyAfterInsetPt = nextRubyAfter
      rubyLineSpacingPt = nextRubySpacing
      embolden = nextEmbolden
      stageStyle = nextStyle
      baseColor = NexusColorParser.parse(hex, Color.WHITE)

      words = parseWords(nextText, rawWords, rawCues)
      configurePaints(weightStr, fontUri)
      baseLayout = null
      activeLayout = null
      lastLayoutWidth = -1
    }

    updateClock()
    invalidate()
  }

  private fun parseWords(fullText: String, rawWords: JSONArray?, rawCues: JSONArray?): List<LyricWordCue> {
    if (rawWords != null && rawWords.length() in 1..2000) {
      val list = mutableListOf<LyricWordCue>()
      var offset = 0
      val joined = StringBuilder()
      var valid = true
      for (i in 0 until rawWords.length()) {
        val w = rawWords.optJSONObject(i)
        if (w == null) {
          valid = false
          break
        }
        val part = w.optString("text", "")
        val start = w.optDouble("startMs", -1.0)
        val end = w.optDouble("endMs", -1.0)
        if (!start.isFinite() || !end.isFinite() || start < 0.0 || end < start || end > 86_400_000.0) {
          valid = false
          break
        }
        val style = w.optJSONObject("style")
        val inlineColor = style?.optString("color")?.takeIf { it.isNotBlank() }?.let { NexusColorParser.parse(it, baseColor) }
        val bold = style?.optString("fontWeight") == "bold"
        val italic = style?.optString("fontStyle") in setOf("italic", "oblique")
        val rubyBefore = w.optString("ruby", "").trim().takeIf { it.isNotEmpty() && it.length <= 64 }
        val rubyAfter = w.optString("rubyAfter", "").trim().takeIf { it.isNotEmpty() && it.length <= 64 }
        list.add(
          LyricWordCue(
            startIdx = offset,
            endIdx = offset + part.length,
            startMs = start,
            endMs = end,
            rubyBefore = rubyBefore,
            rubyAfter = rubyAfter,
            inlineColor = inlineColor,
            bold = bold,
            italic = italic
          )
        )
        offset += part.length
        joined.append(part)
      }
      if (valid && offset == fullText.length && joined.toString() == fullText) {
        return list
      }
    }
    if (rawCues != null && rawCues.length() in 1..2000) {
      val list = mutableListOf<LyricWordCue>()
      for (i in 0 until rawCues.length()) {
        val c = rawCues.optJSONObject(i) ?: continue
        val loc = c.optInt("start", -1)
        val len = c.optInt("length", 0)
        val start = c.optDouble("startMs", -1.0)
        val end = c.optDouble("endMs", -1.0)
        if (loc >= 0 && len > 0 && loc + len <= fullText.length && start.isFinite() && end.isFinite() && start >= 0.0 && end >= start) {
          list.add(LyricWordCue(loc, loc + len, start, end, null, null, null, false, false))
        }
      }
      return list
    }
    return emptyList()
  }

  private fun configurePaints(weightStr: String, fontUri: String) {
    val density = resources.displayMetrics.density
    val weightInt = when (weightStr) {
      "900" -> 900
      "800" -> 800
      "700" -> 700
      "600" -> 600
      else -> 500
    }
    var typeface = Typeface.create(Typeface.DEFAULT, weightInt, false)
    if (fontUri.startsWith("file:")) {
      val path = Uri.parse(fontUri).path
      if (path != null) {
        val f = File(path)
        if (f.isFile && f.canRead()) {
          try {
            typeface = Typeface.createFromFile(f)
          } catch (_: Throwable) {
          }
        }
      }
    }

    val textPx = sizePt * density
    basePaint.typeface = typeface
    basePaint.textSize = textPx
    basePaint.isFakeBoldText = embolden > 0.05f
    activePaint.typeface = typeface
    activePaint.textSize = textPx
    activePaint.isFakeBoldText = embolden > 0.05f

    val blurPx = blurRadius * density
    if (blurPx > 0.25f) {
      basePaint.maskFilter = BlurMaskFilter(blurPx, BlurMaskFilter.Blur.NORMAL)
      activePaint.maskFilter = BlurMaskFilter(blurPx, BlurMaskFilter.Blur.NORMAL)
    } else {
      basePaint.maskFilter = null
      activePaint.maskFilter = null
    }

    when (stageStyle) {
      "neon" -> activePaint.setShadowLayer(8f * density, 0f, 0f, Color.argb(190, 255, 110, 199))
      "cyberpunk" -> activePaint.setShadowLayer(7f * density, 1.5f * density, 0f, Color.argb(200, 0, 235, 255))
      else -> activePaint.clearShadowLayer()
    }
    basePaint.clearShadowLayer()

    rubyPaint.typeface = typeface
    rubyPaint.textSize = max(9f * density, textPx * 0.44f)
    rubyPaint.color = Color.argb((Color.alpha(baseColor) * 0.85f).toInt(), Color.red(baseColor), Color.green(baseColor), Color.blue(baseColor))
    rubyPaint.textAlign = Paint.Align.CENTER
  }

  private fun buildLayouts(widthPx: Int) {
    val density = resources.displayMetrics.density
    val align = if (centered) Layout.Alignment.ALIGN_CENTER else Layout.Alignment.ALIGN_NORMAL
    val targetLineHeightPx = ceil((ceil(sizePt * lineHeightRatio) + rubyLineSpacingPt) * density).toInt()
    val baseSpannable = SpannableString(text)
    val activeSpannable = SpannableString(text)

    if (text.isNotEmpty() && targetLineHeightPx > 0) {
      baseSpannable.setSpan(ExactLineHeightSpan(targetLineHeightPx), 0, text.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
      activeSpannable.setSpan(ExactLineHeightSpan(targetLineHeightPx), 0, text.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    }

    if (stageStyle == "aurora" && text.isNotEmpty()) {
      val auroraPalette = intArrayOf(
        Color.rgb(140, 230, 255),
        Color.rgb(204, 166, 255),
        Color.rgb(255, 166, 214),
        Color.rgb(255, 217, 140),
        Color.rgb(153, 255, 191)
      )
      for (i in text.indices) {
        val c = auroraPalette[i % auroraPalette.size]
        val dim = Color.argb(120, Color.red(c), Color.green(c), Color.blue(c))
        baseSpannable.setSpan(ForegroundColorSpan(dim), i, i + 1, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        activeSpannable.setSpan(ForegroundColorSpan(c), i, i + 1, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
      }
    } else {
      val baseAlpha = if (words.isNotEmpty()) (Color.alpha(baseColor) * 0.42f).toInt() else Color.alpha(baseColor)
      basePaint.color = Color.argb(baseAlpha, Color.red(baseColor), Color.green(baseColor), Color.blue(baseColor))
      activePaint.color = baseColor
    }

    for (w in words) {
      if (w.startIdx < w.endIdx && w.endIdx <= text.length) {
        if (w.inlineColor != null) {
          activeSpannable.setSpan(ForegroundColorSpan(w.inlineColor), w.startIdx, w.endIdx, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
        val styleFlags = (if (w.bold) Typeface.BOLD else 0) or (if (w.italic) Typeface.ITALIC else 0)
        if (styleFlags != 0) {
          baseSpannable.setSpan(StyleSpan(styleFlags), w.startIdx, w.endIdx, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
          activeSpannable.setSpan(StyleSpan(styleFlags), w.startIdx, w.endIdx, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
      }
    }

    fun make(src: CharSequence, paint: TextPaint): StaticLayout {
      val builder = StaticLayout.Builder.obtain(src, 0, src.length, paint, widthPx)
        .setAlignment(align)
        .setLineSpacing(0f, 1.0f)
        .setIncludePad(false)
      if (maxLines > 0) {
        builder.setMaxLines(maxLines).setEllipsize(TextUtils.TruncateAt.END)
      }
      return builder.build()
    }

    baseLayout = make(baseSpannable, basePaint)
    activeLayout = make(activeSpannable, activePaint)
    lastLayoutWidth = widthPx
  }

  private fun currentTimeMs(): Double {
    val elapsed = if (playing) max(0.0, SystemClock.elapsedRealtime() / 1000.0 - anchorSec) else 0.0
    return (positionSec + elapsed) * 1000.0
  }

  private fun updateClock() {
    Choreographer.getInstance().removeFrameCallback(frameCallback)
    if (playing && words.isNotEmpty() && isAttachedToWindow) {
      Choreographer.getInstance().postFrameCallback(frameCallback)
    }
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    updateClock()
  }

  override fun onDetachedFromWindow() {
    Choreographer.getInstance().removeFrameCallback(frameCallback)
    super.onDetachedFromWindow()
  }

  override fun onDraw(canvas: Canvas) {
    if (text.isEmpty() || width <= 0) return
    if (baseLayout == null || lastLayoutWidth != width) {
      buildLayouts(width)
    }
    val base = baseLayout ?: return
    val active = activeLayout ?: return
    val density = resources.displayMetrics.density
    val topOffset = rubyInsetPt * density

    canvas.save()
    canvas.translate(0f, topOffset)
    base.draw(canvas)

    if (words.isNotEmpty()) {
      val nowMs = currentTimeMs()
      for (cue in words) {
        if (nowMs < cue.startMs) continue
        val duration = max(1.0, cue.endMs - cue.startMs)
        val fraction = ((nowMs - cue.startMs) / duration).coerceIn(0.0, 1.0).toFloat()
        drawWordReveal(canvas, active, cue, fraction, density)
      }
      // Draw ruby annotations if present
      for (cue in words) {
        if (cue.rubyBefore == null && cue.rubyAfter == null) continue
        if (cue.startIdx >= text.length) continue
        val line = base.getLineForOffset(cue.startIdx)
        val x0 = base.getPrimaryHorizontal(cue.startIdx)
        val x1 = base.getPrimaryHorizontal(min(cue.endIdx, base.getLineEnd(line)))
        val midX = (x0 + x1) / 2f
        if (cue.rubyBefore != null) {
          val y = base.getLineTop(line).toFloat() - 2f * density
          canvas.drawText(cue.rubyBefore, midX, y, rubyPaint)
        }
        if (cue.rubyAfter != null) {
          val y = base.getLineBottom(line).toFloat() + rubyPaint.textSize
          canvas.drawText(cue.rubyAfter, midX, y, rubyPaint)
        }
      }
    }
    canvas.restore()
  }

  private fun drawWordReveal(canvas: Canvas, layout: StaticLayout, cue: LyricWordCue, fraction: Float, density: Float) {
    val safeStart = cue.startIdx.coerceIn(0, text.length)
    val safeEnd = cue.endIdx.coerceIn(safeStart, text.length)
    if (safeStart >= safeEnd) return

    val firstLine = layout.getLineForOffset(safeStart)
    val lastLine = layout.getLineForOffset(max(safeStart, safeEnd - 1))
    val liftY = if (emphasis && fraction > 0f && fraction < 1f) -1.2f * density * fraction else 0f

    for (line in firstLine..lastLine) {
      val lineStart = max(safeStart, layout.getLineStart(line))
      val lineEnd = min(safeEnd, layout.getLineEnd(line))
      if (lineStart >= lineEnd) continue
      val xStart = layout.getPrimaryHorizontal(lineStart)
      val xEnd = layout.getPrimaryHorizontal(lineEnd)
      val left = min(xStart, xEnd)
      val right = max(xStart, xEnd)
      val lineFrac = if (firstLine == lastLine) fraction else {
        val span = (lastLine - firstLine + 1).toFloat()
        ((fraction * span) - (line - firstLine)).coerceIn(0f, 1f)
      }
      if (lineFrac <= 0f) continue
      val clipRight = left + (right - left) * lineFrac
      canvas.save()
      canvas.clipRect(left - 2f, layout.getLineTop(line).toFloat() - 4f, clipRight + 2f, layout.getLineBottom(line).toFloat() + 4f)
      if (liftY != 0f) canvas.translate(0f, liftY)
      layout.draw(canvas)
      canvas.restore()
    }
  }
}
