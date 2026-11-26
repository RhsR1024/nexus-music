package com.nexusmusic.nexusnative

import android.content.ComponentName
import android.content.pm.PackageManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * 1:1 Android parity implementation of iOS NexusAppIconModule using <activity-alias>.
 */
class NexusAppIconModule : Module() {
  companion object {
    val ALTERNATE_NAMES = setOf(
      "NexusAltOrange",
      "NexusAltGreen",
      "NexusAltBlue",
      "NexusAltPurple",
      "NexusAltGraphite"
    )
    private const val PRIMARY_ACTIVITY = "MainActivity"
  }

  override fun definition() = ModuleDefinition {
    Name("NexusAppIcon")

    AsyncFunction("snapshot") {
      val ctx = appContext.reactContext ?: return@AsyncFunction mapOf("supported" to false, "current" to null)
      val current = detectCurrentIcon(ctx.packageManager, ctx.packageName)
      mapOf(
        "supported" to true,
        "current" to current
      )
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setIcon") { name: String?, promise: Promise ->
      if (name != null && name !in ALTERNATE_NAMES) {
        promise.reject("APP_ICON_INVALID", "图标名称无效", null)
        return@AsyncFunction
      }
      val ctx = appContext.reactContext
      if (ctx == null) {
        promise.reject("APP_ICON_UNAVAILABLE", "应用上下文不可用", null)
        return@AsyncFunction
      }
      try {
        val pm = ctx.packageManager
        val pkg = ctx.packageName
        val targetComponent = name ?: PRIMARY_ACTIVITY

        // Enable target first so the launcher always sees at least one active launcher icon.
        val enableName = ComponentName(pkg, "$pkg.$targetComponent")
        pm.setComponentEnabledSetting(
          enableName,
          PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
          PackageManager.DONT_KILL_APP
        )

        val allComponents = listOf(PRIMARY_ACTIVITY) + ALTERNATE_NAMES
        for (comp in allComponents) {
          if (comp == targetComponent) continue
          val state = if (comp == PRIMARY_ACTIVITY) {
            PackageManager.COMPONENT_ENABLED_STATE_DISABLED
          } else {
            PackageManager.COMPONENT_ENABLED_STATE_DISABLED
          }
          pm.setComponentEnabledSetting(
            ComponentName(pkg, "$pkg.$comp"),
            state,
            PackageManager.DONT_KILL_APP
          )
        }
        promise.resolve(detectCurrentIcon(pm, pkg))
      } catch (t: Throwable) {
        promise.reject("APP_ICON_FAILED", t.message ?: "切换图标失败", t)
      }
    }.runOnQueue(Queues.MAIN)
  }

  private fun detectCurrentIcon(pm: PackageManager, pkg: String): String? {
    for (alt in ALTERNATE_NAMES) {
      val state = pm.getComponentEnabledSetting(ComponentName(pkg, "$pkg.$alt"))
      if (state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) {
        return alt
      }
    }
    return null
  }
}
