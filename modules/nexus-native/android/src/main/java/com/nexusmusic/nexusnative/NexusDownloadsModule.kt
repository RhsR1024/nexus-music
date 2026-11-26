package com.nexusmusic.nexusnative

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NexusDownloadsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NexusDownloads")

    AsyncFunction("configure") { _: Long -> }
    AsyncFunction("setConcurrency") { _: Int -> }

    AsyncFunction("snapshot") { _: String ->
      null as Map<String, Any>?
    }

    AsyncFunction("begin") { _: String, _: String, _: Map<String, String>, _: Boolean, _: String?, promise: Promise ->
      promise.reject("ANDROID_PHASE3_PENDING", "Android 原生后台下载服务将在 Phase 3 启用", null)
    }

    AsyncFunction("stop") { _: String, _: Boolean -> }
    AsyncFunction("discard") { _: String -> }
    AsyncFunction("acknowledge") { _: String -> }
  }
}
