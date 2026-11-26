package com.nexusmusic.nexusnative

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap

internal object MusicWebLoginPolicy {
  const val DAILY_URL = "https://y.qq.com/n/ryqq_v2/qqmusic_skills"
  const val QQ_URL = "https://graph.qq.com/oauth2.0/authorize?client_id=100497308&redirect_uri=https%3A%2F%2Fy.qq.com%2Fportal%2Fwx_redirect.html%3Flogin_type%3D1%26surl%3Dhttps%253A%252F%252Fy.qq.com%252F&response_type=code&scope=all"

  fun initialURL(provider: String, state: String? = null): String? = when (provider) {
    "wy" -> "https://music.163.com/m/login"
    "tx" -> {
      if (state == null) QQ_URL
      else if (Regex("^[A-Za-z0-9-]{1,128}$").matches(state)) "$QQ_URL&state=$state" else null
    }
    else -> null
  }

  fun allows(uri: Uri, provider: String): Boolean {
    if (uri.toString() == "about:blank") return true
    val host = uri.host?.lowercase() ?: return false
    if (uri.scheme?.lowercase() != "https" || uri.userInfo != null || (uri.port != -1 && uri.port != 443)) return false
    return when (provider) {
      "tx" -> host == "qq.com" || host.endsWith(".qq.com")
      "wy" -> host == "music.163.com" || host.endsWith(".music.163.com")
      else -> false
    }
  }

  fun cookieNames(provider: String): Set<String> = when (provider) {
    "tx" -> setOf("qqmusic_key", "qm_keyst", "musickey", "qqmusic_uin", "uin", "musicid", "login_type", "wxuin")
    else -> setOf("MUSIC_U", "MUSIC_A_T", "MUSIC_R_T", "MUSIC_SNS", "__csrf", "NMTID", "_ntes_nuid")
  }

  fun ready(values: Map<String, String>, provider: String): Boolean {
    if (provider == "wy") return !values["MUSIC_U"].isNullOrEmpty()
    if (provider != "tx") return false
    val loginType = values["login_type"]
    if (loginType != null && loginType != "1") return false
    val keys = listOf("qqmusic_key", "qm_keyst", "musickey").mapNotNull { values[it]?.takeIf { v -> v.isNotEmpty() } }
    if (loginType == null && (values["wxuin"] != null || keys.any { it.startsWith("W_X") })) return false
    val hasValidKey = keys.any { !it.startsWith("W_X") }
    val hasValidUin = listOf("qqmusic_uin", "uin", "musicid").mapNotNull { values[it] }.any {
      Regex("^o?[0-9]{1,20}$", RegexOption.IGNORE_CASE).matches(it) && Regex("[1-9]").containsMatchIn(it)
    }
    return hasValidKey && hasValidUin
  }

  fun parseCookieHeader(raw: String?, allowed: Set<String>): Map<String, String> {
    if (raw.isNullOrBlank()) return emptyMap()
    val result = mutableMapOf<String, String>()
    for (part in raw.split(';')) {
      val idx = part.indexOf('=')
      if (idx <= 0) continue
      val name = part.substring(0, idx).trim()
      val value = part.substring(idx + 1).trim()
      if (name in allowed && value.isNotEmpty()) result[name] = value
    }
    return result
  }
}

/**
 * Isolated WebView Activity for official Netease / QQ web login & QQ daily authorization.
 * Clears cookies before and after session so no credentials leak across login attempts.
 */
class NexusAuthWebActivity : Activity() {
  companion object {
    const val EXTRA_SESSION_ID = "session_id"
    const val EXTRA_PROVIDER = "provider"
    const val EXTRA_URL = "url"
    const val EXTRA_DAILY_MODE = "daily_mode"

    private val callbacks = ConcurrentHashMap<String, (Result<String>) -> Unit>()
    private val activeActivities = ConcurrentHashMap<String, NexusAuthWebActivity>()

    fun register(id: String, callback: (Result<String>) -> Unit) {
      callbacks[id] = callback
    }

    fun cancel(id: String) {
      val act = activeActivities.remove(id)
      val cb = callbacks.remove(id)
      cb?.invoke(Result.failure(RuntimeException("AUTH_CANCELLED")))
      act?.runOnUiThread { act.finish() }
    }
  }

  private lateinit var sessionId: String
  private lateinit var provider: String
  private var dailyMode: Boolean = false
  private var webView: WebView? = null
  private val handler = Handler(Looper.getMainLooper())
  private var finished = false

  private val pollRunnable = object : Runnable {
    override fun run() {
      if (finished) return
      inspectCookies()
      handler.postDelayed(this, 1000L)
    }
  }

  private val expiryRunnable = Runnable {
    finishWith(Result.failure(RuntimeException("AUTH_EXPIRED")))
  }

  @SuppressLint("SetJavaScriptEnabled")
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    sessionId = intent.getStringExtra(EXTRA_SESSION_ID) ?: ""
    provider = intent.getStringExtra(EXTRA_PROVIDER) ?: "wy"
    dailyMode = intent.getBooleanExtra(EXTRA_DAILY_MODE, false)
    val startUrl = intent.getStringExtra(EXTRA_URL) ?: ""
    if (sessionId.isEmpty() || startUrl.isEmpty()) {
      finishWith(Result.failure(RuntimeException("AUTH_FAILED")))
      return
    }
    activeActivities[sessionId] = this

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setBackgroundColor(Color.WHITE)
    }
    val topBar = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(24, 48, 24, 16)
      setBackgroundColor(Color.rgb(248, 245, 246))
    }
    val cancelBtn = Button(this).apply {
      text = "取消"
      setOnClickListener { finishWith(Result.failure(RuntimeException("AUTH_CANCELLED"))) }
    }
    val titleView = TextView(this).apply {
      text = if (dailyMode) "QQ 日推授权" else if (provider == "tx") "QQ 音乐登录" else "网易云音乐登录"
      textSize = 16f
      setTextColor(Color.BLACK)
      setPadding(24, 0, 0, 0)
    }
    topBar.addView(cancelBtn)
    topBar.addView(titleView)
    root.addView(topBar, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

    val cm = CookieManager.getInstance()
    cm.removeAllCookies(null)
    cm.flush()
    cm.setAcceptCookie(true)

    val wv = WebView(this).apply {
      settings.javaScriptEnabled = true
      settings.domStorageEnabled = true
      settings.cacheMode = WebSettings.LOAD_NO_CACHE
      cm.setAcceptThirdPartyCookies(this, true)
      webViewClient = object : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
          val target = request?.url ?: return true
          return !MusicWebLoginPolicy.allows(target, provider)
        }

        override fun onPageFinished(view: WebView?, url: String?) {
          inspectCookies()
        }
      }
    }
    webView = wv
    root.addView(wv, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
    setContentView(root)

    wv.loadUrl(startUrl)
    handler.postDelayed(pollRunnable, 1200L)
    handler.postDelayed(expiryRunnable, 5 * 60 * 1000L)
  }

  private fun inspectCookies() {
    if (finished) return
    val cm = CookieManager.getInstance()
    val allowed = MusicWebLoginPolicy.cookieNames(provider)
    val urls = if (provider == "tx") {
      listOf("https://y.qq.com/", "https://graph.qq.com/", "https://qq.com/")
    } else {
      listOf("https://music.163.com/", "https://interface.music.163.com/")
    }
    val merged = mutableMapOf<String, String>()
    for (u in urls) {
      merged.putAll(MusicWebLoginPolicy.parseCookieHeader(cm.getCookie(u), allowed))
    }
    if (!MusicWebLoginPolicy.ready(merged, provider)) return

    if (dailyMode) {
      val key = merged["qqmusic_key"] ?: merged["qm_keyst"] ?: merged["musickey"] ?: return
      val payload = JSONObject()
        .put("key", key)
        .put("cookies", JSONObject(merged as Map<*, *>))
      finishWith(Result.success(payload.toString()))
    } else {
      finishWith(Result.success(JSONObject(merged as Map<*, *>).toString()))
    }
  }

  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {
    val wv = webView
    if (wv != null && wv.canGoBack()) {
      wv.goBack()
    } else {
      finishWith(Result.failure(RuntimeException("AUTH_CANCELLED")))
    }
  }

  private fun finishWith(result: Result<String>) {
    if (finished) return
    finished = true
    handler.removeCallbacks(pollRunnable)
    handler.removeCallbacks(expiryRunnable)
    activeActivities.remove(sessionId)
    val cb = callbacks.remove(sessionId)
    CookieManager.getInstance().removeAllCookies(null)
    CookieManager.getInstance().flush()
    webView?.stopLoading()
    webView?.destroy()
    webView = null
    cb?.invoke(result)
    finish()
  }

  override fun onDestroy() {
    if (!finished) {
      finishWith(Result.failure(RuntimeException("AUTH_CANCELLED")))
    }
    super.onDestroy()
  }
}
