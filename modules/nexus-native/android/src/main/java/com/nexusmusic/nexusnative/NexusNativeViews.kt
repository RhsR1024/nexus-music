package com.nexusmusic.nexusnative

import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.RadialGradient
import android.graphics.RuntimeShader
import android.graphics.Shader
import android.media.AudioManager
import android.os.Build
import android.provider.Settings
import android.view.Choreographer
import android.view.GestureDetector
import android.view.Gravity
import android.view.MotionEvent
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ImageButton
import android.widget.SeekBar
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

internal object NexusColorParser {
  fun parse(raw: String?, fallback: Int = Color.WHITE): Int {
    val text = raw?.trim()?.lowercase() ?: return fallback
    if (text.startsWith("rgb(") || text.startsWith("rgba(")) {
      val open = text.indexOf('(')
      val close = text.lastIndexOf(')')
      if (open in 0 until close) {
        val parts = text.substring(open + 1, close).split(',').map { it.trim() }
        if (parts.size >= 3) {
          val r = parts[0].toDoubleOrNull()?.coerceIn(0.0, 255.0)?.toInt() ?: return fallback
          val g = parts[1].toDoubleOrNull()?.coerceIn(0.0, 255.0)?.toInt() ?: return fallback
          val b = parts[2].toDoubleOrNull()?.coerceIn(0.0, 255.0)?.toInt() ?: return fallback
          val a = if (parts.size > 3) {
            ((parts[3].toDoubleOrNull()?.coerceIn(0.0, 1.0) ?: 1.0) * 255.0).toInt()
          } else 255
          return Color.argb(a, r, g, b)
        }
      }
    }
    return try {
      val normalized = if (text.startsWith("#")) text else "#$text"
      Color.parseColor(normalized)
    } catch (_: Throwable) {
      fallback
    }
  }
}

/** Static translucent frosted material layer matching iOS NexusMaterialView. */
class NexusMaterialView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private var dark: Boolean = false
  private var variant: String = "liquid"
  private var radiusDp: Double = 30.0
  private var intensity: Int = 2

  init {
    isClickable = false
    isFocusable = false
    updateSurface()
  }

  fun setDark(value: Boolean) {
    if (dark != value) {
      dark = value
      updateSurface()
    }
  }

  fun setVariant(value: String) {
    val next = if (value.isEmpty()) "liquid" else value
    if (variant != next) {
      variant = next
      updateSurface()
    }
  }

  fun setRadius(value: Double) {
    radiusDp = value.coerceAtLeast(0.0)
  }

  fun setIntensity(value: Int) {
    val next = value.coerceIn(1, 5)
    if (intensity != next) {
      intensity = next
      updateSurface()
    }
  }

  private fun updateSurface() {
    val idx = (intensity - 1).coerceIn(0, 4)
    val baseAlpha = when (variant) {
      "frosted" -> if (dark) intArrayOf(75, 115, 155, 190, 222)[idx] else intArrayOf(82, 124, 165, 200, 228)[idx]
      "acrylic" -> if (dark) intArrayOf(40, 72, 110, 150, 192)[idx] else intArrayOf(48, 82, 122, 164, 204)[idx]
      else -> if (dark) intArrayOf(46, 80, 120, 162, 204)[idx] else intArrayOf(52, 88, 130, 174, 214)[idx]
    }
    setBackgroundColor(
      if (dark) Color.argb(baseAlpha, 28, 22, 34) else Color.argb(baseAlpha, 255, 250, 250)
    )
  }
}

/** 4-stop vertical alpha fade mask matching iOS NexusPhotoMaskView (0 / 0.5 / 0.76 / 1.0). */
class NexusPhotoMaskView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout: Boolean = true
  private val maskPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    xfermode = PorterDuffXfermode(PorterDuff.Mode.DST_IN)
  }
  private var maskShader: LinearGradient? = null
  private var lastHeight = -1

  init {
    setWillNotDraw(false)
  }

  fun applyMask() {
    if (width > 0 && height > 0) {
      layoutChildrenFull(width, height)
    }
    invalidate()
  }

  override fun onViewAdded(child: android.view.View?) {
    super.onViewAdded(child)
    if (width > 0 && height > 0) {
      post { layoutChildrenFull(width, height) }
    }
  }

  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
    val w = r - l
    val h = b - t
    if (w > 0 && h > 0) {
      layoutChildrenFull(w, h)
    }
  }

  private fun layoutChildrenFull(w: Int, h: Int) {
    val wSpec = MeasureSpec.makeMeasureSpec(w, MeasureSpec.EXACTLY)
    val hSpec = MeasureSpec.makeMeasureSpec(h, MeasureSpec.EXACTLY)
    for (i in 0 until childCount) {
      val child = getChildAt(i)
      child.measure(wSpec, hSpec)
      child.layout(0, 0, w, h)
    }
  }

  override fun dispatchDraw(canvas: Canvas) {
    val w = width
    val h = height
    if (w <= 0 || h <= 0) {
      super.dispatchDraw(canvas)
      return
    }
    if (h != lastHeight || maskShader == null) {
      lastHeight = h
      maskShader = LinearGradient(
        0f, 0f, 0f, h.toFloat(),
        intArrayOf(Color.WHITE, Color.WHITE, Color.argb(168, 255, 255, 255), Color.TRANSPARENT),
        floatArrayOf(0f, 0.5f, 0.76f, 1f),
        Shader.TileMode.CLAMP
      )
      maskPaint.shader = maskShader
    }
    val save = canvas.saveLayer(0f, 0f, w.toFloat(), h.toFloat(), null)
    super.dispatchDraw(canvas)
    canvas.drawRect(0f, 0f, w.toFloat(), h.toFloat(), maskPaint)
    canvas.restoreToCount(save)
  }
}

/**
 * Zero-size Android helper syncing the enclosing window (including React Native Modal Dialogs)
 * status-bar icon contrast via official WindowInsetsController on API 30+ and systemUiVisibility on API 29.
 */
class NexusSystemBarSyncView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private var darkIcons: Boolean = true

  init {
    isClickable = false
    isFocusable = false
  }

  fun setDarkIcons(value: Boolean) {
    darkIcons = value
    applyAppearance()
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    post { applyAppearance() }
  }

  override fun onWindowFocusChanged(hasWindowFocus: Boolean) {
    super.onWindowFocusChanged(hasWindowFocus)
    if (hasWindowFocus) applyAppearance()
  }

  private fun applyAppearance() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      val ctrl = windowInsetsController ?: rootView?.windowInsetsController ?: return
      val mask = android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
      ctrl.setSystemBarsAppearance(if (darkIcons) mask else 0, mask)
    } else {
      @Suppress("DEPRECATION")
      val decor = rootView ?: return
      @Suppress("DEPRECATION")
      val flags = decor.systemUiVisibility
      @Suppress("DEPRECATION")
      decor.systemUiVisibility = if (darkIcons) {
        flags or android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
      } else {
        flags and android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR.inv()
      }
    }
  }
}

/** Subtle metallic vinyl tonearm pivot cap matching iOS NexusVinylPivotView. */
class NexusVinylPivotView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val paint = Paint(Paint.ANTI_ALIAS_FLAG)

  init {
    setWillNotDraw(false)
  }

  override fun onDraw(canvas: Canvas) {
    val cx = width / 2f
    val cy = height / 2f
    val r = min(width, height) / 2f
    if (r <= 0f) return
    paint.shader = RadialGradient(
      cx - r * 0.25f, cy - r * 0.25f, r * 1.2f,
      intArrayOf(Color.rgb(245, 245, 248), Color.rgb(185, 188, 196), Color.rgb(122, 126, 134)),
      floatArrayOf(0f, 0.65f, 1f),
      Shader.TileMode.CLAMP
    )
    canvas.drawCircle(cx, cy, r, paint)
  }
}

/** Subtle diagonal sheen overlay for vinyl disc matching iOS NexusVinylReflectionView. */
class NexusVinylReflectionView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val paint = Paint(Paint.ANTI_ALIAS_FLAG)

  init {
    setWillNotDraw(false)
    isClickable = false
  }

  override fun onDraw(canvas: Canvas) {
    val w = width.toFloat()
    val h = height.toFloat()
    if (w <= 0f || h <= 0f) return
    val cx = w / 2f
    val cy = h / 2f
    val r = min(w, h) / 2f
    paint.shader = LinearGradient(
      0f, 0f, w, h,
      intArrayOf(
        Color.argb(38, 255, 255, 255),
        Color.TRANSPARENT,
        Color.argb(24, 255, 255, 255),
        Color.TRANSPARENT
      ),
      floatArrayOf(0f, 0.38f, 0.55f, 1f),
      Shader.TileMode.CLAMP
    )
    canvas.drawCircle(cx, cy, r, paint)
  }
}

/** Lyric gesture recognizer for double tap and long press without stealing vertical scroll. */
class NexusLyricGestureView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  val onDoubleTap by EventDispatcher()
  val onLongPress by EventDispatcher()

  private var lastDoubleTapMs = 0L

  private val detector = GestureDetector(
    context,
    object : GestureDetector.SimpleOnGestureListener() {
      override fun onDown(e: MotionEvent): Boolean = true

      override fun onDoubleTap(e: MotionEvent): Boolean {
        val now = System.currentTimeMillis()
        if (now - lastDoubleTapMs > 220L) {
          lastDoubleTapMs = now
          onDoubleTap(emptyMap())
        }
        return true
      }

      override fun onLongPress(e: MotionEvent) {
        onLongPress(emptyMap())
      }
    }
  )

  override fun onInterceptTouchEvent(ev: MotionEvent): Boolean {
    detector.onTouchEvent(ev)
    return false
  }

  @SuppressLint("ClickableViewAccessibility")
  override fun onTouchEvent(event: MotionEvent): Boolean {
    detector.onTouchEvent(event)
    return super.onTouchEvent(event)
  }
}

/** System audio output route picker button (attempts Android SystemUI media output switcher, falls back to Bluetooth settings). */
class NexusRoutePickerView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val button = ImageButton(context).apply {
    setBackgroundColor(Color.TRANSPARENT)
    contentDescription = "选择音频输出"
    setImageResource(android.R.drawable.stat_sys_headset)
    setOnClickListener {
      val intents = listOf(
        Intent("com.android.systemui.action.LAUNCH_MEDIA_OUTPUT_DIALOG")
          .setPackage("com.android.systemui")
          .putExtra("package_name", context.packageName)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        Intent(Settings.ACTION_BLUETOOTH_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
      for (intent in intents) {
        try {
          context.startActivity(intent)
          break
        } catch (_: Throwable) {
        }
      }
    }
  }

  init {
    addView(button, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT).apply { gravity = Gravity.CENTER })
  }

  fun setTint(raw: String) {
    button.setColorFilter(NexusColorParser.parse(raw, Color.WHITE), PorterDuff.Mode.SRC_IN)
  }

  fun setActiveTint(raw: String) {
    // Active state uses same tint fallback until MediaRouter session state is connected in Phase 2.
    if (raw.isNotBlank()) {
      NexusColorParser.parse(raw, Color.WHITE)
    }
  }
}

/** Hardware media stream volume slider backed by Android AudioManager (no preference mirroring). */
class NexusDeviceVolumeView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private val seekBar = SeekBar(context)
  private var updating = false
  private var registered = false

  private val receiver = object : BroadcastReceiver() {
    override fun onReceive(ctx: Context?, intent: Intent?) {
      syncFromSystem()
    }
  }

  init {
    contentDescription = "系统媒体音量"
    seekBar.max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC).coerceAtLeast(1)
    syncFromSystem()
    seekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
      override fun onProgressChanged(bar: SeekBar?, progress: Int, fromUser: Boolean) {
        if (fromUser && !updating) {
          audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, progress, 0)
        }
      }
      override fun onStartTrackingTouch(bar: SeekBar?) {}
      override fun onStopTrackingTouch(bar: SeekBar?) {}
    })
    addView(seekBar, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply { gravity = Gravity.CENTER_VERTICAL })
  }

  fun setTint(raw: String) {
    val color = NexusColorParser.parse(raw, Color.WHITE)
    seekBar.progressDrawable?.setColorFilter(color, PorterDuff.Mode.SRC_IN)
    seekBar.thumb?.setColorFilter(color, PorterDuff.Mode.SRC_IN)
  }

  private fun syncFromSystem() {
    updating = true
    seekBar.max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC).coerceAtLeast(1)
    seekBar.progress = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
    updating = false
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (!registered) {
      val filter = IntentFilter("android.media.VOLUME_CHANGED_ACTION")
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
      } else {
        context.registerReceiver(receiver, filter)
      }
      registered = true
    }
    syncFromSystem()
  }

  override fun onDetachedFromWindow() {
    if (registered) {
      try {
        context.unregisterReceiver(receiver)
      } catch (_: Throwable) {
      }
      registered = false
    }
    super.onDetachedFromWindow()
  }
}

/** Three-color soft ambient lights background with deterministic seeded motion. */
open class NexusAmbientView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  protected var palette: IntArray = intArrayOf(Color.rgb(245, 224, 228), Color.rgb(232, 200, 214), Color.rgb(252, 238, 240))
  protected var identityState: String = ""
  protected var movingState: Boolean = false
  protected var pendingState: Boolean = false
  protected var darkState: Boolean = false
  protected var phaseSeconds: Double = 0.0
  private var lastFrameNanos: Long = 0L
  private val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG)
  private val orbPaint = Paint(Paint.ANTI_ALIAS_FLAG)

  private val frameCallback = object : Choreographer.FrameCallback {
    override fun doFrame(frameTimeNanos: Long) {
      if (!movingState || !isAttachedToWindow) {
        lastFrameNanos = 0L
        return
      }
      if (lastFrameNanos > 0L) {
        val dt = (frameTimeNanos - lastFrameNanos).coerceIn(0L, 100_000_000L) / 1_000_000_000.0
        phaseSeconds += dt
      }
      lastFrameNanos = frameTimeNanos
      invalidate()
      Choreographer.getInstance().postFrameCallback(this)
    }
  }

  init {
    setWillNotDraw(false)
    isClickable = false
  }

  fun setColors(colors: List<String>) {
    if (colors.isNotEmpty()) {
      palette = colors.map { NexusColorParser.parse(it) }.toIntArray()
    }
  }

  fun setIdentity(value: String) {
    if (identityState != value) {
      identityState = value
      phaseSeconds = ((value.hashCode() and 0xFFFF) % 360) / 60.0
    }
  }

  fun setMoving(value: Boolean) {
    movingState = value
  }

  fun setPending(value: Boolean) {
    pendingState = value
  }

  fun setDark(value: Boolean) {
    darkState = value
  }

  fun applyProps() {
    updateAnimation()
    invalidate()
  }

  private fun updateAnimation() {
    Choreographer.getInstance().removeFrameCallback(frameCallback)
    lastFrameNanos = 0L
    if (movingState && isAttachedToWindow) {
      Choreographer.getInstance().postFrameCallback(frameCallback)
    }
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    updateAnimation()
  }

  override fun onDetachedFromWindow() {
    Choreographer.getInstance().removeFrameCallback(frameCallback)
    lastFrameNanos = 0L
    super.onDetachedFromWindow()
  }

  override fun onDraw(canvas: Canvas) {
    val w = width.toFloat()
    val h = height.toFloat()
    if (w <= 0f || h <= 0f || palette.isEmpty()) return

    val c0 = palette[0]
    val c1 = palette.getOrElse(1) { c0 }
    val c2 = palette.getOrElse(2) { c1 }

    bgPaint.shader = LinearGradient(0f, 0f, w, h, intArrayOf(c0, c1, c2), null, Shader.TileMode.CLAMP)
    canvas.drawRect(0f, 0f, w, h, bgPaint)

    val t = phaseSeconds * 0.35
    val radius = maxOf(w, h) * 0.65f
    for (i in 0 until 3) {
      val angle = t + i * (2.0 * PI / 3.0)
      val cx = w * (0.5f + 0.24f * cos(angle).toFloat())
      val cy = h * (0.5f + 0.22f * sin(angle * 1.15).toFloat())
      val color = palette[i % palette.size]
      val alpha = if (darkState) 128 else 148
      orbPaint.shader = RadialGradient(
        cx, cy, radius,
        intArrayOf(
          Color.argb(alpha, Color.red(color), Color.green(color), Color.blue(color)),
          Color.TRANSPARENT
        ),
        floatArrayOf(0f, 1f),
        Shader.TileMode.CLAMP
      )
      canvas.drawCircle(cx, cy, radius, orbPaint)
    }
  }
}

/**
 * 3x3 fluid mesh gradient background matching iOS NexusMeshView.
 * Uses GPU AGSL RuntimeShader on Android 13+ (API 33+) and gracefully falls back to
 * multi-orb radial rendering on Android 10-12.
 */
class NexusMeshView(context: Context, appContext: AppContext) : NexusAmbientView(context, appContext) {
  private val shaderPaint = Paint(Paint.ANTI_ALIAS_FLAG)
  private var agslShader: RuntimeShader? = null

  init {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      try {
        agslShader = RuntimeShader(AGSL_MESH_SOURCE)
      } catch (_: Throwable) {
        agslShader = null
      }
    }
  }

  override fun onDraw(canvas: Canvas) {
    val w = width.toFloat()
    val h = height.toFloat()
    if (w <= 0f || h <= 0f || palette.isEmpty()) return

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && agslShader != null) {
      val shader = agslShader!!
      val c0 = palette[0]
      val c1 = palette.getOrElse(1) { c0 }
      val c2 = palette.getOrElse(2) { c1 }
      shader.setFloatUniform("uSize", w, h)
      shader.setFloatUniform("uTime", phaseSeconds.toFloat())
      shader.setFloatUniform("uC0", Color.red(c0) / 255f, Color.green(c0) / 255f, Color.blue(c0) / 255f)
      shader.setFloatUniform("uC1", Color.red(c1) / 255f, Color.green(c1) / 255f, Color.blue(c1) / 255f)
      shader.setFloatUniform("uC2", Color.red(c2) / 255f, Color.green(c2) / 255f, Color.blue(c2) / 255f)
      shaderPaint.shader = shader
      canvas.drawRect(0f, 0f, w, h, shaderPaint)
      return
    }
    super.onDraw(canvas)
  }

  companion object {
    private const val AGSL_MESH_SOURCE = """
      uniform float2 uSize;
      uniform float uTime;
      uniform float3 uC0;
      uniform float3 uC1;
      uniform float3 uC2;

      half4 main(float2 fragCoord) {
        float2 uv = fragCoord / max(uSize, float2(1.0));
        float t = uTime * 0.28;
        float2 p0 = float2(0.25 + 0.22 * sin(t * 0.9), 0.25 + 0.18 * cos(t * 0.7));
        float2 p1 = float2(0.75 + 0.20 * cos(t * 0.8), 0.35 + 0.22 * sin(t * 1.1));
        float2 p2 = float2(0.48 + 0.24 * sin(t * 0.6 + 1.4), 0.78 + 0.18 * cos(t * 0.85));

        float w0 = exp(-3.2 * dot(uv - p0, uv - p0));
        float w1 = exp(-3.2 * dot(uv - p1, uv - p1));
        float w2 = exp(-3.2 * dot(uv - p2, uv - p2));
        float sum = max(w0 + w1 + w2, 0.0001);
        float3 col = (uC0 * w0 + uC1 * w1 + uC2 * w2) / sum;
        return half4(half3(col), 1.0);
      }
    """
  }
}

/** Isolated non-persistent WebView for public MV share pages enforcing PublicMVPolicy. */
class NexusPublicMVView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  val onState by EventDispatcher()

  var source: String = ""
  var active: Boolean = true
  private var appliedSource: String? = null
  private var rootUri: android.net.Uri? = null

  private val webView = WebView(context).apply {
    settings.javaScriptEnabled = true
    settings.domStorageEnabled = false
    settings.databaseEnabled = false
    settings.cacheMode = WebSettings.LOAD_NO_CACHE
    settings.mediaPlaybackRequiresUserGesture = true
    CookieManager.getInstance().setAcceptCookie(false)
    webViewClient = object : WebViewClient() {
      override fun shouldInterceptRequest(
        view: WebView?,
        request: WebResourceRequest?
      ): android.webkit.WebResourceResponse? {
        if (PublicMVPolicy.isBlockedTracker(request?.url)) {
          return android.webkit.WebResourceResponse("text/plain", "utf-8", java.io.ByteArrayInputStream(ByteArray(0)))
        }
        return super.shouldInterceptRequest(view, request)
      }

      override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
        val target = request?.url ?: return true
        val root = rootUri ?: return true
        if (PublicMVPolicy.allowsNavigation(target, root)) return false
        onState(mapOf("notice" to "已拦截非官方公开页面跳转"))
        return true
      }

      override fun onPageFinished(view: WebView?, url: String?) {
        onState(mapOf("phase" to "ready"))
      }
    }
  }

  init {
    addView(webView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
  }

  fun applyProps() {
    if (!active) {
      webView.onPause()
      return
    }
    webView.onResume()
    if (source.isNotBlank() && source != appliedSource) {
      appliedSource = source
      val validRoot = PublicMVPolicy.initialURL(source)
      if (validRoot == null) {
        rootUri = null
        onState(mapOf("phase" to "error", "notice" to "仅支持打开受支持的官方公开 MV 页面"))
        return
      }
      rootUri = validRoot
      onState(mapOf("phase" to "loading"))
      webView.loadUrl(validRoot.toString())
    }
  }

  override fun onDetachedFromWindow() {
    webView.stopLoading()
    webView.destroy()
    super.onDetachedFromWindow()
  }
}

/** Native Android VideoView-backed player for direct MV MP4/HLS streams, parity with iOS NativeVideo. */
class NexusNativeVideoView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  val onState by EventDispatcher()

  var source: String = ""
  var active: Boolean = true
  var paused: Boolean = false
  var seekTo: Double = -1.0

  private var appliedSource: String = ""
  private var appliedSeek: Double = -1.0
  private var prepared: Boolean = false
  private val handler = android.os.Handler(android.os.Looper.getMainLooper())
  private val videoView = android.widget.VideoView(context)
  private val controller = android.widget.MediaController(context)

  private val progressTicker = object : Runnable {
    override fun run() {
      if (prepared) {
        val posSec = (videoView.currentPosition.coerceAtLeast(0)) / 1000.0
        val durSec = (videoView.duration.coerceAtLeast(0)) / 1000.0
        onState(mapOf("playing" to videoView.isPlaying, "position" to posSec, "duration" to durSec))
      }
      if (active && isAttachedToWindow) {
        handler.postDelayed(this, 500L)
      }
    }
  }

  init {
    setBackgroundColor(Color.BLACK)
    controller.setAnchorView(videoView)
    videoView.setMediaController(controller)
    videoView.setOnPreparedListener { mp ->
      prepared = true
      val durSec = (mp.duration.coerceAtLeast(0)) / 1000.0
      onState(mapOf("phase" to "ready", "playing" to (active && !paused), "position" to 0.0, "duration" to durSec))
      if (active && !paused) {
        videoView.start()
      }
      handler.removeCallbacks(progressTicker)
      handler.postDelayed(progressTicker, 500L)
    }
    videoView.setOnCompletionListener {
      val durSec = (videoView.duration.coerceAtLeast(0)) / 1000.0
      onState(mapOf("phase" to "ended", "playing" to false, "position" to durSec, "duration" to durSec))
    }
    videoView.setOnErrorListener { _, _, _ ->
      prepared = false
      onState(mapOf("phase" to "error", "playing" to false, "error" to "视频流暂时无法播放"))
      true
    }
    val params = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    params.gravity = android.view.Gravity.CENTER
    addView(videoView, params)
  }

  fun applyProps() {
    if (source != appliedSource) {
      appliedSource = source
      prepared = false
      handler.removeCallbacks(progressTicker)
      videoView.stopPlayback()
      val parsed = try { android.net.Uri.parse(source.trim()) } catch (_: Throwable) { null }
      val scheme = parsed?.scheme?.lowercase()
      if (parsed == null || (scheme != "https" && scheme != "http") || parsed.host.isNullOrBlank() || !parsed.userInfo.isNullOrEmpty()) {
        if (source.isNotBlank()) {
          onState(mapOf("phase" to "error", "error" to "不支持的视频地址"))
        }
        return
      }
      onState(mapOf("phase" to "loading", "playing" to false))
      val headers = mapOf(
        "Referer" to "https://music.163.com/",
        "User-Agent" to "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36"
      )
      videoView.setVideoURI(parsed, headers)
    }
    if (prepared && seekTo >= 0.0 && kotlin.math.abs(seekTo - appliedSeek) > 0.25) {
      appliedSeek = seekTo
      videoView.seekTo((seekTo * 1000.0).toInt())
    }
    if (!active || paused) {
      if (videoView.isPlaying) videoView.pause()
      handler.removeCallbacks(progressTicker)
    } else if (prepared && !videoView.isPlaying) {
      videoView.start()
      handler.removeCallbacks(progressTicker)
      handler.postDelayed(progressTicker, 500L)
    }
  }

  override fun onDetachedFromWindow() {
    handler.removeCallbacks(progressTicker)
    videoView.stopPlayback()
    super.onDetachedFromWindow()
  }
}

/** Offline-safe local HTML WebView host for Global Radio 3D interactive globe (Android parity). */
class NexusRadioGlobeView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  val onSelect by EventDispatcher()

  var html: String = ""
  var pointsJson: String = "[]"
  var commandJson: String = ""

  private var loaded = false
  private var appliedHtmlHash = 0
  private var appliedPoints = ""
  private var appliedCommand = ""

  private inner class GlobeBridge {
    @android.webkit.JavascriptInterface
    fun postMessage(raw: String) {
      try {
        val obj = org.json.JSONObject(raw)
        val out = mutableMapOf<String, Any>()
        val keys = obj.keys()
        while (keys.hasNext()) {
          val k = keys.next()
          val v = obj.opt(k)
          if (v != null && v != org.json.JSONObject.NULL) out[k] = v
        }
        post { onSelect(out) }
      } catch (_: Throwable) {}
    }
  }

  private val webView = WebView(context).apply {
    setBackgroundColor(Color.rgb(7, 18, 30))
    settings.javaScriptEnabled = true
    settings.domStorageEnabled = false
    settings.allowFileAccess = false
    settings.allowContentAccess = false
    settings.cacheMode = WebSettings.LOAD_NO_CACHE
    addJavascriptInterface(GlobeBridge(), "RadioGlobeBridge")
    webViewClient = object : WebViewClient() {
      override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean = true
      override fun onPageFinished(view: WebView?, url: String?) {
        loaded = true
        appliedPoints = ""
        appliedCommand = ""
        pushDataIfNeeded()
        pushCommandIfNeeded()
      }
    }
  }

  init {
    addView(webView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
  }

  fun applyProps() {
    val h = html.hashCode()
    if (html.isNotEmpty() && h != appliedHtmlHash) {
      appliedHtmlHash = h
      loaded = false
      webView.loadDataWithBaseURL("about:blank", html, "text/html", "UTF-8", null)
      return
    }
    if (loaded) {
      pushDataIfNeeded()
      pushCommandIfNeeded()
    }
  }

  private fun pushDataIfNeeded() {
    if (pointsJson == appliedPoints || pointsJson.isEmpty()) return
    appliedPoints = pointsJson
    webView.evaluateJavascript("window.nexusGlobe && window.nexusGlobe.setData($pointsJson);", null)
  }

  private fun pushCommandIfNeeded() {
    if (commandJson == appliedCommand || commandJson.isEmpty()) return
    appliedCommand = commandJson
    webView.evaluateJavascript("window.nexusGlobe && window.nexusGlobe.command($commandJson);", null)
  }

  override fun onDetachedFromWindow() {
    webView.removeJavascriptInterface("RadioGlobeBridge")
    webView.stopLoading()
    webView.destroy()
    super.onDetachedFromWindow()
  }
}
