package com.nexusmusic.nexusnative

import org.json.JSONObject
import java.nio.charset.StandardCharsets
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

internal interface QuickJSHostBridge {
  fun onEmit(event: String, json: String)
  fun onHttp(id: Int, url: String, optionsJson: String)
  fun onAbortHttp(id: Int)
  fun onTimer(id: Int, delayMs: Double)
  fun onClearTimer(id: Int)
  fun onUtility(operation: String, inputJson: String): String
}

internal class NexusQuickJS(hostBridge: QuickJSHostBridge) : AutoCloseable {
  private val handle = AtomicLong(0L)

  init {
    if (libraryLoaded) {
      handle.set(nativeCreate(hostBridge))
    }
  }

  val isValid: Boolean get() = handle.get() != 0L

  fun setScriptInfo(json: String): Boolean {
    val ptr = handle.get()
    return ptr != 0L && nativeSetScriptInfo(ptr, json)
  }

  fun evaluate(code: String, filename: String): Boolean {
    val ptr = handle.get()
    return ptr != 0L && nativeEvaluate(ptr, code, filename)
  }

  fun callTimer(id: Int): Boolean {
    val ptr = handle.get()
    return ptr != 0L && nativeCallTimer(ptr, id)
  }

  fun callHttp(id: Int, error: String?, responseJson: String?): Boolean {
    val ptr = handle.get()
    return ptr != 0L && nativeCallHttp(ptr, id, error, responseJson)
  }

  fun callInvoke(reqId: String, payloadJson: String): Boolean {
    val ptr = handle.get()
    return ptr != 0L && nativeCallInvoke(ptr, reqId, payloadJson)
  }

  fun interrupt() {
    val ptr = handle.get()
    if (ptr != 0L) nativeInterrupt(ptr)
  }

  override fun close() {
    val ptr = handle.getAndSet(0L)
    if (ptr != 0L) nativeDestroy(ptr)
  }

  private external fun nativeCreate(hostBridge: QuickJSHostBridge): Long
  private external fun nativeSetScriptInfo(handle: Long, infoJson: String): Boolean
  private external fun nativeEvaluate(handle: Long, code: String, filename: String): Boolean
  private external fun nativeCallTimer(handle: Long, id: Int): Boolean
  private external fun nativeCallHttp(handle: Long, id: Int, error: String?, responseJson: String?): Boolean
  private external fun nativeCallInvoke(handle: Long, reqId: String, payloadJson: String): Boolean
  private external fun nativeInterrupt(handle: Long)
  private external fun nativeDestroy(handle: Long)

  companion object {
    val libraryLoaded: Boolean = try {
      System.loadLibrary("nexus_quickjs")
      true
    } catch (_: Throwable) {
      false
    }
  }
}

internal enum class ScriptRuntimeError(val code: String) {
  DESTROYED("SOURCE_DESTROYED"),
  INVALID("SCRIPT_INVALID"),
  TIMEOUT("SCRIPT_TIMEOUT"),
  REQUEST("SCRIPT_REQUEST_FAILED"),
  NOT_READY("SOURCE_NOT_READY"),
  CANCELLED("REQUEST_CANCELLED")
}

/**
 * 1:1 Android parity implementation of iOS ScriptRuntime.swift using isolated QuickJS-ng contexts
 * running the exact same shared common/bootstrap.js.
 */
internal class ScriptRuntime(private val id: String, private val revision: Int) {
  private val serial = Executors.newSingleThreadScheduledExecutor { r ->
    Thread(r, "nexus.lx.$id.$revision").apply { isDaemon = true }
  }

  private var js: NexusQuickJS? = null
  private var http: ScriptHTTP? = null
  private val timers = mutableMapOf<Int, ScheduledFuture<*>>()
  private val requests = mutableMapOf<String, (Result<String>) -> Unit>()
  private val deadlines = mutableMapOf<String, ScheduledFuture<*>>()
  private var initialized = false
  private var destroyed = false
  private var initCallback: ((Result<String>) -> Unit)? = null
  private var initDeadline: ScheduledFuture<*>? = null

  private val bridge = object : QuickJSHostBridge {
    override fun onEmit(event: String, json: String) {
      handleEvent(event, json)
    }

    override fun onHttp(id: Int, url: String, optionsJson: String) {
      http?.start(id, url, optionsJson) { err, respJson ->
        serial.execute {
          if (destroyed) return@execute
          val ok = js?.callHttp(id, err, respJson) ?: false
          if (!ok) scriptException()
        }
      }
    }

    override fun onAbortHttp(id: Int) {
      http?.cancel(id)
    }

    override fun onTimer(id: Int, delayMs: Double) {
      scheduleTimer(id, delayMs)
    }

    override fun onClearTimer(id: Int) {
      timers.remove(id)?.cancel(false)
    }

    override fun onUtility(operation: String, inputJson: String): String {
      return ScriptUtilities.call(operation, inputJson)
    }
  }

  fun initialize(script: String, name: String, bootstrap: String, completion: (Result<String>) -> Unit) {
    serial.execute {
      if (destroyed || js != null || script.toByteArray(StandardCharsets.UTF_8).size > 8 * 1024 * 1024) {
        completion(Result.failure(RuntimeException(ScriptRuntimeError.INVALID.code)))
        return@execute
      }
      val engine = NexusQuickJS(bridge)
      if (!engine.isValid) {
        completion(Result.failure(RuntimeException(ScriptRuntimeError.INVALID.code)))
        return@execute
      }
      initCallback = completion
      http = ScriptHTTP()
      js = engine

      val info = JSONObject()
        .put("name", name)
        .put("version", "")
        .put("author", "")
        .put("description", "")
        .put("rawScript", script)
      val header = script.take(16_384)
      for (field in listOf("version", "author", "description", "homepage")) {
        val m = Regex("@$field\\s+([^\\r\\n]*)").find(header)
        if (m != null) {
          info.put(field, m.groupValues[1].replace("*/", "").trim())
        }
      }
      engine.setScriptInfo(info.toString())

      initDeadline = serial.schedule({
        val pending = initCallback ?: return@schedule
        initCallback = null
        pending(Result.failure(RuntimeException(ScriptRuntimeError.TIMEOUT.code)))
        teardown()
      }, 20L, TimeUnit.SECONDS)

      if (!engine.evaluate(bootstrap, "bootstrap.js")) {
        scriptException()
        return@execute
      }
      if (!destroyed && !engine.evaluate(script, "$name.js")) {
        scriptException()
      }
    }
  }

  fun request(reqId: String, payloadJson: String, completion: (Result<String>) -> Unit) {
    serial.execute {
      if (!initialized || destroyed) {
        completion(Result.failure(RuntimeException(ScriptRuntimeError.NOT_READY.code)))
        return@execute
      }
      if (requests.containsKey(reqId) || requests.size >= 32 || payloadJson.toByteArray(StandardCharsets.UTF_8).size > 1024 * 1024) {
        completion(Result.failure(RuntimeException(ScriptRuntimeError.INVALID.code)))
        return@execute
      }
      requests[reqId] = completion
      deadlines[reqId] = serial.schedule({
        finish(reqId, Result.failure(RuntimeException(ScriptRuntimeError.TIMEOUT.code)))
      }, 15L, TimeUnit.SECONDS)

      val ok = js?.callInvoke(reqId, payloadJson) ?: false
      if (!ok) {
        scriptException()
      }
    }
  }

  fun cancel(reqId: String) {
    serial.execute {
      finish(reqId, Result.failure(RuntimeException(ScriptRuntimeError.CANCELLED.code)))
    }
  }

  fun destroy() {
    js?.interrupt()
    serial.execute {
      teardown()
      serial.shutdown()
    }
  }

  private fun scheduleTimer(timerId: Int, delayMs: Double) {
    if (timers.size >= 256 || !delayMs.isFinite()) {
      scriptException()
      return
    }
    val clamped = delayMs.coerceIn(0.0, 60_000.0).toLong()
    timers[timerId] = serial.schedule({
      if (destroyed || timers.remove(timerId) == null) return@schedule
      val ok = js?.callTimer(timerId) ?: false
      if (!ok) scriptException()
    }, clamped, TimeUnit.MILLISECONDS)
  }

  private fun handleEvent(event: String, json: String) {
    if (destroyed || json.toByteArray(StandardCharsets.UTF_8).size > 1024 * 1024) {
      scriptException()
      return
    }
    val obj = try {
      JSONObject(json)
    } catch (_: Throwable) {
      scriptException()
      return
    }
    when (event) {
      "inited" -> {
        if (initialized) return
        val pending = initCallback ?: return
        if (obj.optJSONObject("sources") == null) return
        initialized = true
        initCallback = null
        initDeadline?.cancel(false)
        initDeadline = null
        pending(Result.success(json))
      }
      "requestSucceeded" -> {
        val reqId = obj.optString("id", "")
        if (reqId.isEmpty()) return
        val resVal = if (obj.has("result")) obj.get("result") else JSONObject.NULL
        val serialized = when (resVal) {
          JSONObject.NULL -> "null"
          is String -> JSONObject.quote(resVal)
          else -> resVal.toString()
        }
        finish(reqId, Result.success(serialized))
      }
      "requestFailed" -> {
        val reqId = obj.optString("id", "")
        if (reqId.isNotEmpty()) {
          finish(reqId, Result.failure(RuntimeException(ScriptRuntimeError.REQUEST.code)))
        }
      }
    }
  }

  private fun finish(reqId: String, result: Result<String>) {
    deadlines.remove(reqId)?.cancel(false)
    requests.remove(reqId)?.invoke(result)
  }

  private fun scriptException() {
    initCallback?.let { pending ->
      initCallback = null
      pending(Result.failure(RuntimeException(ScriptRuntimeError.INVALID.code)))
    }
    teardown()
  }

  private fun teardown() {
    if (destroyed) return
    destroyed = true
    initialized = false
    initDeadline?.cancel(false)
    initDeadline = null
    initCallback?.let { pending ->
      initCallback = null
      pending(Result.failure(RuntimeException(ScriptRuntimeError.DESTROYED.code)))
    }
    timers.values.forEach { it.cancel(false) }
    timers.clear()
    deadlines.values.forEach { it.cancel(false) }
    deadlines.clear()
    val pendingReqs = requests.values.toList()
    requests.clear()
    pendingReqs.forEach { it(Result.failure(RuntimeException(ScriptRuntimeError.DESTROYED.code))) }
    http?.destroy()
    http = null
    js?.close()
    js = null
  }
}
