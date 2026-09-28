package com.kunjae.app

import android.content.ClipData
import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PersistableBundle

object SecureClipboard {

    const val CLEAR_AFTER_SECONDS = 30

    private const val LABEL = "Kunjae"
    private val main = Handler(Looper.getMainLooper())
    private var pendingClear: Runnable? = null

    fun copy(context: Context, text: String, sensitive: Boolean = true) {
        val manager = context.getSystemService(ClipboardManager::class.java) ?: return
        val clip = ClipData.newPlainText(LABEL, text)

        if (sensitive) {
            val key = if (Build.VERSION.SDK_INT >= 33) ClipDescription.EXTRA_IS_SENSITIVE
            else "android.content.extra.IS_SENSITIVE"
            clip.description.extras = PersistableBundle().apply { putBoolean(key, true) }
        }

        manager.setPrimaryClip(clip)

        if (!sensitive) return

        pendingClear?.let(main::removeCallbacks)
        val clear = Runnable {
            val label = runCatching { manager.primaryClipDescription?.label }.getOrNull()
            if (label == null || label == LABEL) {
                runCatching {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) manager.clearPrimaryClip()
                    else manager.setPrimaryClip(ClipData.newPlainText(LABEL, ""))
                }
            }
            pendingClear = null
        }
        pendingClear = clear
        main.postDelayed(clear, CLEAR_AFTER_SECONDS * 1000L)
    }
}
