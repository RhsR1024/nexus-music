package com.nexusmusic.nexusnative

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NexusMediaLibraryModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NexusMediaLibrary")
    Events("changed")

    AsyncFunction("authorizationStatus") {
      currentStatus()
    }

    AsyncFunction("requestAuthorization") {
      currentStatus()
    }

    AsyncFunction("beginQuery") { _: String ->
      mapOf("token" to "empty", "total" to 0)
    }

    AsyncFunction("page") { _: String, _: Int, _: Int ->
      emptyList<Map<String, Any>>()
    }

    AsyncFunction("resolve") { _: String, _: String, promise: Promise ->
      promise.reject("ANDROID_PHASE3_PENDING", "Android 设备媒体库 MediaStore 查询将在 Phase 3 启用", null)
    }

    AsyncFunction("lyrics") { _: String, _: String ->
      null as String?
    }

    AsyncFunction("artwork") { _: String, _: String ->
      null as String?
    }
  }

  private fun currentStatus(): String {
    val ctx = appContext.reactContext ?: return "unavailable"
    val permission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      Manifest.permission.READ_MEDIA_AUDIO
    } else {
      Manifest.permission.READ_EXTERNAL_STORAGE
    }
    val granted = ContextCompat.checkSelfPermission(ctx, permission) == PackageManager.PERMISSION_GRANTED
    return if (granted) "authorized" else "notDetermined"
  }
}
