package com.nexusmusic.nexusnative

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NexusAppIconModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NexusAppIcon")

    AsyncFunction("snapshot") {
      // Activity-alias dynamic app icons are enabled in Phase 3.
      mapOf(
        "supported" to false,
        "current" to null
      )
    }

    AsyncFunction("setIcon") { _: String?, promise: Promise ->
      promise.reject("ANDROID_PHASE3_PENDING", "Android 动态更换桌面图标将在 Phase 3 启用", null)
    }
  }
}
