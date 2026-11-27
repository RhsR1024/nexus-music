package com.nexusmusic.nexusnative

import android.content.Context
import android.net.wifi.WifiManager
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.io.OutputStream
import java.io.RandomAccessFile
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.HttpURLConnection
import java.net.Inet4Address
import java.net.InetAddress
import java.net.NetworkInterface
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketTimeoutException
import java.net.URI
import java.net.URL
import java.nio.charset.StandardCharsets
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * 1:1 Android parity native DLNA LAN discovery (SSDP multicast) + local HTTP media relay.
 */
class NativeDlnaService {
  private val relayExecutor = Executors.newCachedThreadPool { r ->
    Thread(r, "nexus.dlna.relay").apply { isDaemon = true }
  }
  private val relayRunning = AtomicBoolean(false)
  @Volatile private var serverSocket: ServerSocket? = null
  @Volatile private var relayToken: String = ""
  @Volatile private var relaySource: String = ""
  @Volatile private var relayHeaders: Map<String, String> = emptyMap()

  fun discover(context: Context?, timeoutMs: Int): List<Map<String, String>> {
    val clamped = timeoutMs.coerceIn(1500, 6000)
    val wifi = context?.applicationContext?.getSystemService(Context.WIFI_SERVICE) as? WifiManager
    val lock = try {
      wifi?.createMulticastLock("nexus-dlna-ssdp")?.apply {
        setReferenceCounted(false)
        acquire()
      }
    } catch (_: Throwable) {
      null
    }
    val seen = linkedMapOf<String, Map<String, String>>()
    var socket: DatagramSocket? = null
    try {
      socket = DatagramSocket().apply {
        reuseAddress = true
        soTimeout = 300
      }
      val group = InetAddress.getByName("239.255.255.250")
      val mx = (clamped / 1000).coerceIn(1, 4)
      val targets = listOf(
        "urn:schemas-upnp-org:device:MediaRenderer:1",
        "urn:schemas-upnp-org:service:AVTransport:1"
      )
      for (st in targets) {
        val msg =
          "M-SEARCH * HTTP/1.1\r\n" +
            "HOST: 239.255.255.250:1900\r\n" +
            "MAN: \"ssdp:discover\"\r\n" +
            "MX: $mx\r\n" +
            "ST: $st\r\n\r\n"
        val bytes = msg.toByteArray(StandardCharsets.UTF_8)
        socket.send(DatagramPacket(bytes, bytes.size, group, 1900))
      }

      val deadline = System.currentTimeMillis() + clamped
      val buf = ByteArray(4096)
      while (System.currentTimeMillis() < deadline) {
        try {
          val packet = DatagramPacket(buf, buf.size)
          socket.receive(packet)
          val text = String(packet.data, 0, packet.length, StandardCharsets.UTF_8)
          val headers = mutableMapOf<String, String>()
          for (line in text.split("\r\n", "\n")) {
            val idx = line.indexOf(':')
            if (idx > 0) {
              headers[line.substring(0, idx).trim().lowercase()] = line.substring(idx + 1).trim()
            }
          }
          val location = headers["location"]?.takeIf { it.isNotEmpty() } ?: continue
          val key = location.lowercase()
          if (!seen.containsKey(key)) {
            seen[key] = mapOf(
              "location" to location,
              "usn" to (headers["usn"] ?: location),
              "st" to (headers["st"] ?: ""),
              "server" to (headers["server"] ?: "")
            )
          }
        } catch (_: SocketTimeoutException) {
        }
      }
    } catch (_: Throwable) {
    } finally {
      try { socket?.close() } catch (_: Throwable) {}
      try { if (lock?.isHeld == true) lock.release() } catch (_: Throwable) {}
    }
    return seen.values.toList()
  }

  fun startRelay(sourceUrl: String, headersJson: String): Map<String, String> {
    stopRelay()
    val host = localIPv4Address() ?: throw IllegalStateException("未检测到局域网 Wi-Fi IP 地址")
    val parsedHeaders = mutableMapOf<String, String>()
    try {
      val obj = JSONObject(headersJson)
      val keys = obj.keys()
      while (keys.hasNext()) {
        val k = keys.next()
        val v = obj.optString(k, "")
        if (v.isNotEmpty()) parsedHeaders[k] = v
      }
    } catch (_: Throwable) {
    }

    val server = ServerSocket(0)
    val port = server.localPort
    val token = UUID.randomUUID().toString().replace("-", "").lowercase()
    serverSocket = server
    relayToken = token
    relaySource = sourceUrl
    relayHeaders = parsedHeaders
    relayRunning.set(true)

    relayExecutor.execute { acceptLoop(server) }

    return mapOf(
      "url" to "http://$host:$port/$token",
      "host" to host,
      "port" to port.toString()
    )
  }

  fun stopRelay() {
    relayRunning.set(false)
    val s = serverSocket
    serverSocket = null
    try { s?.close() } catch (_: Throwable) {}
  }

  fun setKeepAlive(@Suppress("UNUSED_PARAMETER") enabled: Boolean) {
    // Android foreground playback service handles background survival directly.
  }

  private fun acceptLoop(server: ServerSocket) {
    while (relayRunning.get() && serverSocket === server) {
      val client = try {
        server.accept()
      } catch (_: Throwable) {
        break
      }
      relayExecutor.execute { handleClient(client) }
    }
  }

  private fun handleClient(client: Socket) {
    try {
      client.soTimeout = 15_000
      val reader = BufferedReader(InputStreamReader(client.getInputStream(), StandardCharsets.UTF_8))
      val firstLine = reader.readLine() ?: return
      val parts = firstLine.split(" ")
      if (parts.size < 2) return
      val method = parts[0].uppercase()
      val path = parts[1]
      var rangeHeader: String? = null
      while (true) {
        val line = reader.readLine() ?: break
        if (line.isEmpty()) break
        val idx = line.indexOf(':')
        if (idx > 0 && line.substring(0, idx).trim().equals("range", ignoreCase = true)) {
          rangeHeader = line.substring(idx + 1).trim()
        }
      }
      val out = client.getOutputStream()
      val expectedPath = "/$relayToken"
      if (path != expectedPath && !path.startsWith("$expectedPath?")) {
        writeHeader(out, "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
        return
      }
      val source = relaySource
      if (source.startsWith("file://")) {
        serveLocalFile(out, File(URI(source)), method == "HEAD", rangeHeader)
      } else if (source.startsWith("http://") || source.startsWith("https://")) {
        proxyRemote(out, source, relayHeaders, method == "HEAD", rangeHeader)
      } else {
        writeHeader(out, "HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
      }
    } catch (_: Throwable) {
    } finally {
      try { client.close() } catch (_: Throwable) {}
    }
  }

  private fun serveLocalFile(out: OutputStream, file: File, isHead: Boolean, rangeHeader: String?) {
    if (!file.isFile || !file.canRead()) {
      writeHeader(out, "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
      return
    }
    val total = file.length()
    var start = 0L
    var end = (total - 1).coerceAtLeast(0L)
    var partial = false
    if (rangeHeader != null && rangeHeader.lowercase().startsWith("bytes=")) {
      val spec = rangeHeader.substring(6).substringBefore(',')
      val bounds = spec.split('-')
      if (bounds.size == 2) {
        val s = bounds[0].toLongOrNull()
        val e = bounds[1].toLongOrNull()
        if (s != null && s >= 0 && s < total) {
          start = s
          end = (e ?: (total - 1)).coerceAtMost(total - 1)
          partial = true
        }
      }
    }
    val length = (end - start + 1).coerceAtLeast(0L)
    val mime = mimeType(file.extension)
    val sb = StringBuilder()
    sb.append(if (partial) "HTTP/1.1 206 Partial Content\r\n" else "HTTP/1.1 200 OK\r\n")
    sb.append("Content-Type: ").append(mime).append("\r\n")
    sb.append("Accept-Ranges: bytes\r\n")
    sb.append("Content-Length: ").append(length).append("\r\n")
    if (partial) sb.append("Content-Range: bytes ").append(start).append('-').append(end).append('/').append(total).append("\r\n")
    sb.append("Connection: close\r\n\r\n")
    writeHeader(out, sb.toString())
    if (isHead) return
    RandomAccessFile(file, "r").use { raf ->
      raf.seek(start)
      val buf = ByteArray(65536)
      var remaining = length
      while (remaining > 0) {
        val n = raf.read(buf, 0, minOf(buf.size.toLong(), remaining).toInt())
        if (n <= 0) break
        out.write(buf, 0, n)
        remaining -= n
      }
      out.flush()
    }
  }

  private fun proxyRemote(
    out: OutputStream,
    sourceUrl: String,
    headers: Map<String, String>,
    isHead: Boolean,
    rangeHeader: String?
  ) {
    val conn = (URL(sourceUrl).openConnection() as HttpURLConnection).apply {
      requestMethod = if (isHead) "HEAD" else "GET"
      connectTimeout = 12_000
      readTimeout = 20_000
      instanceFollowRedirects = true
      headers.forEach { (k, v) -> setRequestProperty(k, v) }
      if (rangeHeader != null) setRequestProperty("Range", rangeHeader)
    }
    try {
      val code = conn.responseCode
      val mime = conn.contentType ?: mimeType(sourceUrl.substringAfterLast('.', ""))
      val contentLength = conn.contentLengthLong
      val contentRange = conn.getHeaderField("Content-Range")
      val sb = StringBuilder()
      sb.append("HTTP/1.1 ").append(code).append(if (code == 206) " Partial Content\r\n" else " OK\r\n")
      sb.append("Content-Type: ").append(mime).append("\r\n")
      sb.append("Accept-Ranges: bytes\r\n")
      if (contentRange != null) sb.append("Content-Range: ").append(contentRange).append("\r\n")
      if (contentLength >= 0) sb.append("Content-Length: ").append(contentLength).append("\r\n")
      sb.append("Connection: close\r\n\r\n")
      writeHeader(out, sb.toString())
      if (isHead) return
      val stream = if (code in 200..299) conn.inputStream else conn.errorStream
      if (stream != null) {
        BufferedInputStream(stream).use { input ->
          val buf = ByteArray(65536)
          while (true) {
            val n = input.read(buf)
            if (n <= 0) break
            out.write(buf, 0, n)
          }
          out.flush()
        }
      }
    } finally {
      conn.disconnect()
    }
  }

  private fun writeHeader(out: OutputStream, text: String) {
    out.write(text.toByteArray(StandardCharsets.UTF_8))
    out.flush()
  }

  private fun mimeType(ext: String): String = when (ext.lowercase()) {
    "mp3" -> "audio/mpeg"
    "flac" -> "audio/flac"
    "m4a", "mp4" -> "audio/mp4"
    "aac" -> "audio/aac"
    "wav" -> "audio/wav"
    "ogg" -> "audio/ogg"
    else -> "audio/mpeg"
  }

  private fun localIPv4Address(): String? {
    var fallback: String? = null
    val ifaces = try {
      NetworkInterface.getNetworkInterfaces()
    } catch (_: Throwable) {
      return null
    } ?: return null
    while (ifaces.hasMoreElements()) {
      val iface = ifaces.nextElement()
      if (!iface.isUp || iface.isLoopback) continue
      val addrs = iface.inetAddresses
      while (addrs.hasMoreElements()) {
        val addr = addrs.nextElement()
        if (addr is Inet4Address && !addr.isLoopbackAddress) {
          val host = addr.hostAddress ?: continue
          if (iface.name.startsWith("wlan") || iface.name.startsWith("eth")) return host
          if (fallback == null) fallback = host
        }
      }
    }
    return fallback
  }
}
