package com.kunjae.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.crashlytics.FirebaseCrashlytics
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.remoteconfig.FirebaseRemoteConfig
import com.google.firebase.remoteconfig.FirebaseRemoteConfigSettings

object FirebaseSupport {

    const val KEY_MIN_VERSION = "android_min_version_code"
    const val KEY_LATEST_VERSION = "android_latest_version_code"
    const val KEY_UPDATE_URL = "android_update_url"

    private const val TOPIC_ALL = "all"
    private const val TOPIC_ANDROID = "android"
    private const val PLAY_URL = "https://play.google.com/store/apps/details?id=com.kunjae.app"

    data class UpdatePolicy(val minVersion: Long, val latestVersion: Long, val updateUrl: String) {
        val current: Long get() = BuildConfig.VERSION_CODE.toLong()
        val forced: Boolean get() = minVersion > current
        val available: Boolean get() = latestVersion > current
    }

    @Volatile
    private var started = false

    fun enabled(context: Context): Boolean =
        BuildConfig.FIREBASE_ENABLED && FirebaseApp.getApps(context.applicationContext).isNotEmpty()

    fun start(context: Context, integrityCode: String) {
        if (!enabled(context)) return
        if (!started) {
            started = true
            createChannel(context)
            runCatching {
                FirebaseMessaging.getInstance().subscribeToTopic(TOPIC_ALL)
                FirebaseMessaging.getInstance().subscribeToTopic(TOPIC_ANDROID)
            }
        }
        reportIntegrity(integrityCode)
    }

    private fun reportIntegrity(code: String) = runCatching {
        val crashlytics = FirebaseCrashlytics.getInstance()
        crashlytics.setCustomKey("integrity", code.ifEmpty { "ok" })
        if (code.isNotEmpty()) crashlytics.recordException(IntegrityException(code))
    }

    fun cachedPolicy(context: Context): UpdatePolicy? {
        if (!enabled(context)) return null
        return runCatching { policyOf(remoteConfig()) }.getOrNull()
    }

    fun refreshPolicy(context: Context, onResult: (UpdatePolicy) -> Unit) {
        if (!enabled(context)) return
        runCatching {
            val config = remoteConfig()
            config.fetchAndActivate().addOnCompleteListener { onResult(policyOf(config)) }
        }
    }

    private fun remoteConfig(): FirebaseRemoteConfig {
        val config = FirebaseRemoteConfig.getInstance()
        config.setConfigSettingsAsync(
            FirebaseRemoteConfigSettings.Builder()
                .setMinimumFetchIntervalInSeconds(if (BuildConfig.DEBUG) 0 else 3600)
                .build(),
        )
        config.setDefaultsAsync(
            mapOf(
                KEY_MIN_VERSION to 0L,
                KEY_LATEST_VERSION to 0L,
                KEY_UPDATE_URL to PLAY_URL,
            ),
        )
        return config
    }

    private fun policyOf(config: FirebaseRemoteConfig) = UpdatePolicy(
        minVersion = config.getLong(KEY_MIN_VERSION),
        latestVersion = config.getLong(KEY_LATEST_VERSION),
        updateUrl = config.getString(KEY_UPDATE_URL).takeIf { it.startsWith("https://") } ?: PLAY_URL,
    )

    fun createChannel(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        val channel = NotificationChannel(
            context.getString(R.string.notification_channel_id),
            context.getString(R.string.notification_channel_name),
            NotificationManager.IMPORTANCE_DEFAULT,
        )
        manager.createNotificationChannel(channel)
    }

    private class IntegrityException(code: String) : Exception("integrity:$code")
}
