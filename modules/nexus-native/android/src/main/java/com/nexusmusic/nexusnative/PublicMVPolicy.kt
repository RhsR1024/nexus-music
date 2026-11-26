package com.nexusmusic.nexusnative

import android.net.Uri

/**
 * 1:1 Android parity port of iOS PublicMVPolicy.swift.
 * Strictly allows only verified anonymous public MV pages across the 5 platforms.
 */
internal object PublicMVPolicy {
  private val DIGITS = Regex("^[0-9]{1,128}$")
  private val QQ_PATH = Regex("^/n/ryqq/mv/[A-Za-z0-9_-]{1,128}$")
  private val KUWO_WWW_PATH = Regex("^/mvplay/[0-9]{1,128}$")
  private val KUWO_M_PATH = Regex("^/newh5app/mvplay/7/[0-9]{1,128}$")
  private val KUGOU_PATH = Regex("^/mvweb/html/mv_[0-9]{1,128}\\.html$")

  fun initialURL(value: String): Uri? {
    val uri = try {
      Uri.parse(value)
    } catch (_: Throwable) {
      return null
    }
    if (!safeHTTPS(uri) || !uri.fragment.isNullOrEmpty()) return null
    val host = uri.host?.lowercase() ?: return null
    val path = uri.path ?: ""

    val valid = when (host) {
      "music.163.com" -> {
        val names = uri.queryParameterNames
        path == "/mv" && names.size == 1 && names.contains("id") &&
          DIGITS.matches(uri.getQueryParameter("id") ?: "")
      }
      "y.qq.com" -> QQ_PATH.matches(path) && uri.encodedQuery == null
      "www.kuwo.cn" -> KUWO_WWW_PATH.matches(path) && uri.encodedQuery == null
      "m.kuwo.cn" -> {
        val identity = path.substringAfterLast('/')
        val names = uri.queryParameterNames
        KUWO_M_PATH.matches(path) && names.size == 2 &&
          uri.getQueryParameter("id") == identity &&
          uri.getQueryParameter("type") == "7"
      }
      "h5.nf.migu.cn" -> {
        val names = uri.queryParameterNames
        path == "/app/v4/p/share/mv/index.html" && names.size == 1 && names.contains("id") &&
          DIGITS.matches(uri.getQueryParameter("id") ?: "")
      }
      "www.kugou.com" -> KUGOU_PATH.matches(path) && uri.encodedQuery == null
      else -> false
    }
    return if (valid) uri else null
  }

  fun allowsNavigation(url: Uri, root: Uri): Boolean {
    if (initialURL(root.toString()) == null || !safeHTTPS(url)) return false
    val host = url.host?.lowercase() ?: return false
    val allowed = when (root.host?.lowercase()) {
      "music.163.com" -> setOf("music.163.com", "m.music.163.com", "y.music.163.com")
      "y.qq.com" -> setOf("y.qq.com", "m.y.qq.com", "i.y.qq.com", "i2.y.qq.com")
      "www.kuwo.cn", "m.kuwo.cn" -> setOf("www.kuwo.cn", "m.kuwo.cn")
      "h5.nf.migu.cn" -> setOf("h5.nf.migu.cn")
      "www.kugou.com" -> setOf("www.kugou.com", "m.kugou.com")
      else -> emptySet()
    }
    return host in allowed
  }

  fun isBlockedTracker(url: Uri?): Boolean {
    val host = url?.host?.lowercase() ?: return false
    return host == "hm.baidu.com"
  }

  private fun safeHTTPS(uri: Uri): Boolean {
    val scheme = uri.scheme?.lowercase()
    val port = uri.port
    return scheme == "https" && uri.userInfo == null && (port == -1 || port == 443)
  }
}
