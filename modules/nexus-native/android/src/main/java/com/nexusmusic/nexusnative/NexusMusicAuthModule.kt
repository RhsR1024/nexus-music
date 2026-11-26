package com.nexusmusic.nexusnative

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NexusMusicAuthModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NexusMusicAuth")

    AsyncFunction("scanQQTransfer") { promise: Promise ->
      promise.resolve(null)
    }

    AsyncFunction("receiveQQTransfer") { _: String, _: String, promise: Promise ->
      promise.reject("ANDROID_PHASE3_PENDING", "Android QQ 电脑配对接收将在 Phase 3 启用", null)
    }

    AsyncFunction("cancelQQTransfer") { _: String -> }

    AsyncFunction("open") { _: String, _: String, _: String, promise: Promise ->
      promise.reject("ANDROID_PHASE3_PENDING", "Android 隔离网页账号登录将在 Phase 3 启用", null)
    }

    AsyncFunction("cancel") { _: String -> }

    AsyncFunction("openQQDaily") { _: String, promise: Promise ->
      promise.reject("ANDROID_PHASE3_PENDING", "Android QQ 日推授权将在 Phase 3 启用", null)
    }
  }
}
