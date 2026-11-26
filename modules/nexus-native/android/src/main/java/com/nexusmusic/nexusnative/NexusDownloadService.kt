package com.nexusmusic.nexusnative

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * Foreground dataSync service keeping active Android offline audio downloads alive
 * when the app moves to background.
 *
 * Guarantees the Android startForegroundService() contract even if a transfer completes
 * in milliseconds before onStartCommand runs: onStartCommand ALWAYS promotes to foreground
 * first, then stops cleanly if [shouldRun] has already flipped to false.
 */
class NexusDownloadService : Service() {
  companion object {
    private const val CHANNEL_ID = "nexus_offline_downloads"
    private const val NOTIFICATION_ID = 202611

    @Volatile private var shouldRun: Boolean = false
    @Volatile private var instance: NexusDownloadService? = null

    fun start(context: Context) {
      shouldRun = true
      if (instance != null) return
      val intent = Intent(context.applicationContext, NexusDownloadService::class.java)
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.applicationContext.startForegroundService(intent)
        } else {
          context.applicationContext.startService(intent)
        }
      } catch (_: Throwable) {
        // Fallback: if OS restricts background FGS start, OkHttp transfer still runs in-process.
      }
    }

    fun stop(context: Context) {
      shouldRun = false
      instance?.stopCleanly()
    }
  }

  override fun onCreate() {
    super.onCreate()
    instance = this
    promoteToForeground()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    promoteToForeground()
    if (!shouldRun) {
      stopCleanly()
    }
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    if (instance === this) instance = null
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun stopCleanly() {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        stopForeground(STOP_FOREGROUND_REMOVE)
      } else {
        @Suppress("DEPRECATION")
        stopForeground(true)
      }
    } catch (_: Throwable) {
    }
    stopSelf()
  }

  private fun promoteToForeground() {
    ensureChannel()
    val notification = Notification.Builder(this, CHANNEL_ID)
      .setContentTitle("音枢离线下载")
      .setContentText("正在后台下载离线音频")
      .setSmallIcon(android.R.drawable.stat_sys_download)
      .setOngoing(true)
      .build()
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (_: Throwable) {
    }
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val nm = getSystemService(NotificationManager::class.java)
      if (nm?.getNotificationChannel(CHANNEL_ID) == null) {
        val channel = NotificationChannel(CHANNEL_ID, "离线音频下载", NotificationManager.IMPORTANCE_LOW)
        nm?.createNotificationChannel(channel)
      }
    }
  }
}
