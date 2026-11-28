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
  const val QISHUI_URL = "https://music.douyin.com/qishui"

  fun initialURL(provider: String, state: String? = null): String? = when (provider) {
    "wy" -> "https://music.163.com/m/login"
    "tx" -> {
      if (state == null) QQ_URL
      else if (Regex("^[A-Za-z0-9-]{1,128}$").matches(state)) "$QQ_URL&state=$state" else null
    }
    "qishui" -> QISHUI_URL
    else -> null
  }

  fun allows(uri: Uri, provider: String): Boolean = allowsUrl(uri.toString(), provider)

  fun allowsUrl(raw: String, provider: String): Boolean {
    if (raw == "about:blank") return true
    val parsed = try { java.net.URI(raw) } catch (_: Exception) { return false }
    val host = parsed.host?.lowercase() ?: return false
    if (parsed.scheme?.lowercase() != "https" || parsed.userInfo != null || (parsed.port != -1 && parsed.port != 443)) return false
    return when (provider) {
      "tx" -> host == "qq.com" || host.endsWith(".qq.com")
      "wy" -> listOf("163.com", "163yun.com", "127.net", "126.net", "netease.com").any {
        host == it || host.endsWith(".$it")
      }
      "qishui" -> listOf(
        "douyin.com", "qishui.com", "bytedance.com", "snssdk.com", "iesdouyin.com",
        "toutiao.com", "zijieapi.com", "bytegoofy.com", "douyinpic.com", "douyincdn.com", "byteimg.com",
        "yhgfb-cn-static.com", "bytetos.com", "bytegecko.com", "amemv.com"
      ).any { host == it || host.endsWith(".$it") }
      else -> false
    }
  }

  fun cookieNames(provider: String): Set<String> = when (provider) {
    "tx" -> setOf("qqmusic_key", "qm_keyst", "musickey", "qqmusic_uin", "uin", "musicid", "login_type", "wxuin", "euin")
    "qishui" -> setOf("sessionid", "sessionid_ss", "sid_tt", "uid_tt", "uid_tt_ss", "passport_csrf_token", "passport_csrf_token_default", "ttwid", "odin_tt", "sid_guard", "ssid_ucp_v1", "session_tlb_tag")
    else -> setOf("MUSIC_U", "MUSIC_A_T", "MUSIC_R_T", "MUSIC_SNS", "__csrf", "NMTID", "_ntes_nuid")
  }

  fun dailyOrigin(raw: String?): Boolean {
    if (raw.isNullOrBlank()) return false
    val parsed = try { java.net.URI(raw) } catch (_: Exception) { return false }
    val host = parsed.host?.lowercase() ?: return false
    return parsed.scheme?.lowercase() == "https" && parsed.userInfo == null &&
      (parsed.port == -1 || parsed.port == 443) &&
      host in setOf("y.qq.com", "a.qq.com", "a.y.qq.com", "i2.y.qq.com")
  }

  fun ready(values: Map<String, String>, provider: String): Boolean {
    if (provider == "wy") return !values["MUSIC_U"].isNullOrEmpty()
    if (provider == "qishui") {
      val hasSession = !values["sessionid"].isNullOrEmpty() || !values["sessionid_ss"].isNullOrEmpty() || !values["sid_tt"].isNullOrEmpty()
      val hasIdentity = !values["uid_tt"].isNullOrEmpty() || !values["uid_tt_ss"].isNullOrEmpty() || !values["sid_guard"].isNullOrEmpty()
      return hasSession && hasIdentity
    }
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
      text = if (dailyMode) "QQ 日推授权" else if (provider == "tx") "QQ 音乐登录" else if (provider == "qishui") "汽水音乐扫码登录" else "网易云音乐登录"
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
      if (provider == "wy") {
        settings.userAgentString = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
      } else if (provider == "tx") {
        settings.userAgentString = if (dailyMode) {
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        } else {
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
        }
      } else if (provider == "qishui") {
        settings.userAgentString = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
        addJavascriptInterface(object {
          @android.webkit.JavascriptInterface
          fun onConfirmed() {
            handler.post { inspectCookies() }
          }
          @android.webkit.JavascriptInterface
          fun onRefresh() {
            handler.post { loadQishuiQrHost() }
          }
        }, "QishuiAuthBridge")
      }
      cm.setAcceptThirdPartyCookies(this, true)
      webViewClient = object : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
          val target = request?.url ?: return true
          if (!MusicWebLoginPolicy.allows(target, provider)) {
            inspectCookies()
            return true
          }
          return false
        }

        override fun onPageFinished(view: WebView?, url: String?) {
          if (dailyMode && MusicWebLoginPolicy.dailyOrigin(url)) {
            val hook = "(() => {if(window.__nexusDailyCaptureHooked)return;window.__nexusDailyCaptureHooked=true;const re=/\\bqmk-[A-Za-z0-9_-]{12,1024}\\b/;const grab=v=>{try{const s=typeof v==='string'?v:JSON.stringify(v);const m=s&&s.match(re);if(m&&m[0])window.__nexusCapturedDailyKey=m[0];}catch{}};try{if(navigator.clipboard&&navigator.clipboard.writeText){const orig=navigator.clipboard.writeText.bind(navigator.clipboard);navigator.clipboard.writeText=function(t){grab(t);return orig(t);};}}catch{}try{const origFetch=window.fetch;if(typeof origFetch==='function'){window.fetch=function(...args){return origFetch.apply(this,args).then(res=>{try{res.clone().text().then(grab).catch(()=>{});}catch{}return res;});};}}catch{}try{const origSend=XMLHttpRequest.prototype.send;XMLHttpRequest.prototype.send=function(...args){this.addEventListener('load',()=>{try{grab(this.responseText);}catch{}});return origSend.apply(this,args);};}catch{}})();"
            view?.evaluateJavascript(hook, null)
          }
          inspectCookies()
        }
      }
    }
    webView = wv
    root.addView(wv, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
    setContentView(root)

    if (provider == "qishui" && !dailyMode) {
      loadQishuiQrHost()
    } else {
      wv.loadUrl(startUrl)
    }
    handler.postDelayed(pollRunnable, 1200L)
    handler.postDelayed(expiryRunnable, 5 * 60 * 1000L)
  }

  private fun ensureQishuiNumericId(key: String): String {
    val prefs = getSharedPreferences("nexus_qishui_auth", MODE_PRIVATE)
    val existing = prefs.getString(key, null)
    if (!existing.isNullOrEmpty() && existing.length >= 16) return existing
    val rng = java.security.SecureRandom()
    val num = (rng.nextLong() and Long.MAX_VALUE) % 1_000_000_000_000_000_000L
    val generated = "7%018d".format(num)
    prefs.edit().putString(key, generated).apply()
    return generated
  }

  private fun generateQishuiMsToken(): String {
    val bytes = ByteArray(88)
    java.security.SecureRandom().nextBytes(bytes)
    return android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
      .replace('+', '-').replace('/', '_')
  }

  private fun loadQishuiQrHost() {
    val wv = webView ?: return
    val cm = CookieManager.getInstance()
    cm.removeAllCookies(null)
    cm.flush()
    val did = ensureQishuiNumericId("device_id")
    val iid = ensureQishuiNumericId("install_id")
    val msToken = generateQishuiMsToken()
    val html = """
      <!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <style>
        body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;font-family:-apple-system,sans-serif;background:#F8F6F7;color:#1D1A1E;text-align:center;}
        h2{margin:0 0 6px;font-size:20px;}
        .sub{margin:0 0 20px;font-size:13px;color:#6D6670;}
        .card{width:248px;height:248px;border-radius:20px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.08);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;}
        canvas{width:216px;height:216px;image-rendering:pixelated;}
        #st{margin:18px 0 12px;font-size:15px;font-weight:600;}
        button{border:none;border-radius:22px;background:#0D9488;color:#fff;padding:11px 24px;font-size:14px;font-weight:600;}
      </style></head><body>
      <h2>使用汽水音乐 App 扫一扫</h2>
      <p class="sub">官方 PC 端扫码会话 · 会员权限与歌单同步可用</p>
      <div class="card"><canvas id="qr" width="216" height="216"></canvas></div>
      <div id="st">正在初始化安全会话…</div>
      <button onclick="window.QishuiAuthBridge&&window.QishuiAuthBridge.onRefresh()">刷新二维码</button>
      <script>
      (function(){
        var DID="$did", IID="$iid", MS="$msToken";
        var stEl=document.getElementById('st'), cvs=document.getElementById('qr'), ctx=cvs.getContext('2d');
        try{localStorage.setItem('xmst',MS);localStorage.setItem('xmsty',MS);}catch(e){}
        function setSt(t){stEl.textContent=t;}
        // Minimal self-contained ISO/IEC 18004 QR Byte-mode encoder (Versions 1-9, EC Level L)
        var GF_E=new Uint8Array(512),GF_L=new Uint8Array(256);
        (function(){var x=1;for(var i=0;i<255;i++){GF_E[i]=x;GF_L[x]=i;x<<=1;if(x&256)x^=0x11d;}for(var i=255;i<512;i++)GF_E[i]=GF_E[i-255];})();
        function gmul(a,b){return(a===0||b===0)?0:GF_E[GF_L[a]+GF_L[b]];}
        function rsRem(data,ec){
          var poly=[1];for(var i=0;i<ec;i++){var n=new Array(poly.length+1).fill(0);for(var j=0;j<poly.length;j++){n[j]^=poly[j];n[j+1]^=gmul(poly[j],GF_E[i]);}poly=n;}
          var rem=new Array(ec).fill(0);
          for(var i=0;i<data.length;i++){var f=data[i]^rem[0];rem.shift();rem.push(0);if(f)for(var j=0;j<ec;j++)rem[j]^=gmul(poly[j+1],f);}
          return rem;
        }
        var VERS=[
          {v:1,s:21,dc:19,b:1,ec:7,a:[]},{v:2,s:25,dc:34,b:1,ec:10,a:[6,18]},{v:3,s:29,dc:55,b:1,ec:15,a:[6,22]},
          {v:4,s:33,dc:80,b:1,ec:20,a:[6,26]},{v:5,s:37,dc:108,b:1,ec:26,a:[6,30]},{v:6,s:41,dc:136,b:2,ec:18,a:[6,34]},
          {v:7,s:45,dc:156,b:2,ec:20,a:[6,22,38],vi:0x07c94},{v:8,s:49,dc:194,b:2,ec:24,a:[6,24,42],vi:0x085bc},{v:9,s:53,dc:232,b:2,ec:30,a:[6,26,46],vi:0x09a99}
        ];
        function drawQr(text){
          var bytes=Array.from(new TextEncoder().encode(text));
          var sp=VERS.find(function(x){return bytes.length+2<=x.dc;});
          if(!sp)return;
          var bits=[];function pb(v,l){for(var i=l-1;i>=0;i--)bits.push((v>>>i)&1);}
          pb(4,4);pb(bytes.length,8);bytes.forEach(function(b){pb(b,8);});
          for(var i=0;i<Math.min(4,sp.dc*8-bits.length);i++)bits.push(0);
          while(bits.length%8)bits.push(0);
          var data=[];for(var i=0;i<bits.length;i+=8){var v=0;for(var j=0;j<8;j++)v=(v<<1)|bits[i+j];data.push(v);}
          for(var t=0;data.length<sp.dc;t++)data.push(t%2?0x11:0xec);
          var bl=sp.dc/sp.b,dbs=[],ebs=[];
          for(var b=0;b<sp.b;b++){var sl=data.slice(b*bl,(b+1)*bl);dbs.push(sl);ebs.push(rsRem(sl,sp.ec));}
          var cw=[];for(var i=0;i<bl;i++)for(var b=0;b<sp.b;b++)cw.push(dbs[b][i]);
          for(var i=0;i<sp.ec;i++)for(var b=0;b<sp.b;b++)cw.push(ebs[b][i]);
          var S=sp.s,m=new Uint8Array(S*S),f=new Uint8Array(S*S);
          function setM(r,c,v){if(r>=0&&r<S&&c>=0&&c<S){m[r*S+c]=v?1:0;f[r*S+c]=1;}}
          function finder(r0,c0){for(var r=-1;r<=7;r++)for(var c=-1;c<=7;c++){var inside=r>=0&&r<7&&c>=0&&c<7;var dk=inside&&(r===0||r===6||c===0||c===6||(r>=2&&r<=4&&c>=2&&c<=4));setM(r0+r,c0+c,dk);}}
          finder(0,0);finder(0,S-7);finder(S-7,0);
          for(var i=8;i<S-8;i++){setM(6,i,i%2===0);setM(i,6,i%2===0);}
          setM(S-8,8,1);
          for(var i=0;i<sp.a.length;i++)for(var j=0;j<sp.a.length;j++){
            var ar=sp.a[i],ac=sp.a[j];if(f[ar*S+ac])continue;
            for(var dr=-2;dr<=2;dr++)for(var dc=-2;dc<=2;dc++)setM(ar+dr,ac+dc,Math.max(Math.abs(dr),Math.abs(dc))!==1);
          }
          for(var i=0;i<9;i++){if(i!==6){f[8*S+i]=1;f[i*S+8]=1;}}
          for(var i=0;i<8;i++){f[8*S+(S-1-i)]=1;f[(S-1-i)*S+8]=1;}
          if(sp.vi){for(var i=0;i<18;i++){var bit=(sp.vi>>>i)&1,r=Math.floor(i/3),c=S-11+(i%3);setM(r,c,bit);setM(c,r,bit);}}
          var bi=0,up=true;
          for(var c=S-1;c>=1;c-=2){
            if(c===6)c--;
            for(var step=0;step<S;step++){
              var r=up?S-1-step:step;
              for(var dc=0;dc<2;dc++){
                var cc=c-dc;if(f[r*S+cc])continue;
                var bit=bi<cw.length*8?((cw[bi>>>3]>>>(7-(bi&7)))&1):0;bi++;
                m[r*S+cc]=bit^(((r+cc)&1)===0?1:0);
              }
            }
            up=!up;
          }
          var fmt=0x77c4;
          var c1=[[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
          var c2=[[S-1,8],[S-2,8],[S-3,8],[S-4,8],[S-5,8],[S-6,8],[S-7,8],[8,S-8],[8,S-7],[8,S-6],[8,S-5],[8,S-4],[8,S-3],[8,S-2],[8,S-1]];
          for(var i=0;i<15;i++){var b=(fmt>>>(14-i))&1;m[c1[i][0]*S+c1[i][1]]=b;m[c2[i][0]*S+c2[i][1]]=b;}
          var quiet=2,total=S+quiet*2,px=Math.floor(216/total),off=Math.floor((216-px*total)/2);
          ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,216,216);
          ctx.fillStyle='#000000';
          for(var r=0;r<S;r++)for(var c=0;c<S;c++)if(m[r*S+c])ctx.fillRect(off+(c+quiet)*px,off+(r+quiet)*px,px,px);
        }
        function xorHex(str){var b=new TextEncoder().encode(str),o='';for(var i=0;i<b.length;i++)o+=((b[i]^5)&255).toString(16).padStart(2,'0');return o;}
        function readCookie(n){var m=document.cookie.match(new RegExp('(?:^|;\\s*)'+n+'=([^;]*)'));return m?decodeURIComponent(m[1]):'';}
        function xhrReq(method,url,body,headers){
          return new Promise(function(res,rej){
            var x=new XMLHttpRequest();x.open(method,url,true);x.withCredentials=true;x.timeout=15000;
            if(headers)Object.keys(headers).forEach(function(k){if(headers[k])x.setRequestHeader(k,headers[k]);});
            x.onload=function(){try{res(JSON.parse(x.responseText||'{}'));}catch(e){rej(e);}};
            x.onerror=function(){rej(new Error('网络错误'));};x.ontimeout=function(){rej(new Error('请求超时'));};
            x.send(body||null);
          });
        }
        var sdkInfo=xorHex(JSON.stringify({ua:navigator.userAgent||'',lang:navigator.language||'zh-CN',platform:'MacIntel',screen:'1440x900',tz:-(new Date().getTimezoneOffset()),cookie:true,ls:true,aid:386088,host:'api.qishui.com'}));
        var passportToken='',stopped=false;
        function q(){return 'aid=386088&account_sdk_source=web&passport_jssdk_version=2.4.13&passport_jssdk_type=normal&is_from_ttaccountsdk=1&next='+encodeURIComponent('https://api.qishui.com')+'&need_logo=false&need_short_url=false&is_new_login=1&device_id='+encodeURIComponent(DID)+'&iid='+encodeURIComponent(IID)+'&msToken='+encodeURIComponent(MS)+'&account_sdk_source_info='+encodeURIComponent(sdkInfo);}
        function poll(){
          if(stopped||!passportToken)return;
          setTimeout(function(){
            if(stopped)return;
            var csrf=readCookie('passport_csrf_token')||readCookie('passport_csrf_token_default');
            var hdrs={'Content-Type':'application/x-www-form-urlencoded'};if(csrf)hdrs['X-Tt-Passport-Csrf-Token']=csrf;
            var form='token='+encodeURIComponent(passportToken)+'&need_logo=false&need_short_url=false&is_frontier=true&is_new_login=1&next='+encodeURIComponent('https://api.qishui.com');
            xhrReq('POST','https://api.qishui.com/passport/web/check_qrconnect/?'+q(),form,hdrs).then(function(res){
              var d=res&&res.data?res.data:{},st=String(d.status||'').toLowerCase(),code=Number(d.error_code||0);
              if(st==='confirmed'||st==='3'||st==='success'||st==='confirm'){setSt('已确认，正在保存汽水会话…');if(window.QishuiAuthBridge)window.QishuiAuthBridge.onConfirmed();poll();return;}
              if(st==='scanned'||st==='2'){setSt('已扫码，请在汽水音乐 App 点击确认');poll();return;}
              if(st==='expired'||st==='5'||code===2043){stopped=true;setSt('二维码已过期，请点击刷新');return;}
              if(code===2046){stopped=true;setSt(String(d.description||'需要安全验证，请刷新重试'));return;}
              poll();
            }).catch(function(){if(!stopped)poll();});
          },2200);
        }
        function createQr(){
          setSt('正在获取汽水音乐登录二维码…');
          xhrReq('GET','https://api.qishui.com/passport/web/get_qrcode/?'+q(),null,null).then(function(res){
            var d=res&&res.data?res.data:{};
            if(!d.token&&!d.qrcode_index_url){setSt(String(d.description||'二维码获取失败，请刷新'));return;}
            passportToken=String(d.token||'');
            var scanTok=passportToken;try{scanTok=new URL(String(d.qrcode_index_url||'')).searchParams.get('token')||passportToken;}catch(e){}
            var scanUrl='https://bff-pc.qishui.com/light/invoke/scan_login?token='+encodeURIComponent(scanTok).replace(/\+/g,'%2B')+'&os=Windows&computer_name=NexusMusic';
            drawQr(scanUrl);
            setSt('请使用汽水音乐 App 扫一扫确认登录');
            poll();
          }).catch(function(){setSt('网络请求失败，请点击刷新');});
        }
        var sc=document.createElement('script');
        sc.src='https://lf-headquarters-speed.yhgfb-cn-static.com/obj/rc-client-security/web/stable/1.0.0.41/bdms.js';
        sc.onload=function(){Promise.resolve().then(function(){if(window.bdms&&window.bdms.init)return window.bdms.init({aid:386088,paths:['/passport']});}).then(createQr).catch(createQr);};
        sc.onerror=function(){setSt('安全组件加载失败，请检查网络后刷新');};
        document.head.appendChild(sc);
      })();
      </script></body></html>
    """.trimIndent()
    wv.loadDataWithBaseURL("https://api.qishui.com/", html, "text/html", "UTF-8", "https://api.qishui.com/")
  }

  private fun inspectCookies() {
    if (finished) return
    val cm = CookieManager.getInstance()
    val allowed = MusicWebLoginPolicy.cookieNames(provider)
    val urls = when (provider) {
      "tx" -> listOf("https://qq.com/", "https://graph.qq.com/", "https://y.qq.com/")
      "qishui" -> listOf("https://music.douyin.com/", "https://douyin.com/", "https://sso.douyin.com/", "https://qishui.com/", "https://api.qishui.com/", "https://bff-pc.qishui.com/", "https://beta-luna.douyin.com/")
      else -> listOf("https://163.com/", "https://interface.music.163.com/", "https://music.163.com/")
    }
    val merged = mutableMapOf<String, String>()
    for (u in urls) {
      merged.putAll(MusicWebLoginPolicy.parseCookieHeader(cm.getCookie(u), allowed))
    }

    if (dailyMode) {
      val wv = webView ?: return
      val currentUrl = wv.url
      if (!MusicWebLoginPolicy.dailyOrigin(currentUrl)) return
      val isWx = merged["login_type"] == "2" || !merged["wxuin"].isNullOrEmpty()
      val hasWxKey = listOf("qqmusic_key", "qm_keyst", "musickey").any { !merged[it].isNullOrEmpty() }
      val qqReady = MusicWebLoginPolicy.ready(merged, provider)
      val wxReady = isWx && hasWxKey
      if (!qqReady && !wxReady) return
      if (wxReady && merged["login_type"] == null) merged["login_type"] = "2"
      val script = "(() => {const re=/\\bqmk-[A-Za-z0-9_-]{12,1024}\\b/;if(typeof window.__nexusCapturedDailyKey==='string'&&re.test(window.__nexusCapturedDailyKey))return window.__nexusCapturedDailyKey.match(re)[0];const texts=[(document.body?.innerText||'').slice(0,200000),(document.body?.textContent||'').slice(0,200000),...Array.from(document.querySelectorAll('input,textarea')).slice(0,100).map(x=>String(x.value||'').slice(0,2048))];try{for(let i=0;i<localStorage.length&&i<50;i++){const k=localStorage.key(i);if(k)texts.push(String(localStorage.getItem(k)||'').slice(0,2048));}}catch{}try{for(let i=0;i<sessionStorage.length&&i<50;i++){const k=sessionStorage.key(i);if(k)texts.push(String(sessionStorage.getItem(k)||'').slice(0,2048));}}catch{}return texts.join('\\n').match(re)?.[0]||'';})()"
      wv.evaluateJavascript(script) { raw ->
        if (finished || raw.isNullOrBlank()) return@evaluateJavascript
        val candidate = raw.trim().removeSurrounding("\"")
        if (!Regex("^qmk-[A-Za-z0-9_-]{12,1024}$").matches(candidate)) return@evaluateJavascript
        val payload = JSONObject()
          .put("key", candidate)
          .put("cookies", JSONObject(merged as Map<*, *>))
        finishWith(Result.success(payload.toString()))
      }
    } else {
      if (!MusicWebLoginPolicy.ready(merged, provider)) return
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
