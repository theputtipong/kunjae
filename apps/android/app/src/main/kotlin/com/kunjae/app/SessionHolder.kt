package com.kunjae.app

import com.kunjae.client.Session

object SessionHolder {

    private const val IDLE_TIMEOUT_MS = 15 * 60 * 1000L

    private var session: Session? = null
    private var lastUsedAtMs = 0L

    @Synchronized
    fun open(newSession: Session, nowMs: Long = System.currentTimeMillis()) {
        lock()
        session = newSession
        lastUsedAtMs = nowMs
    }

    @Synchronized
    fun active(nowMs: Long = System.currentTimeMillis()): Session? {
        val current = session ?: return null

        if (nowMs - lastUsedAtMs > IDLE_TIMEOUT_MS) {
            lock()
            return null
        }

        lastUsedAtMs = nowMs
        return current
    }

    @Synchronized
    fun lock() {
        session?.lock()
        session = null
        lastUsedAtMs = 0L
        ItemStore.clear()

        AssetLinksVerifier.clear()
    }

    @Synchronized
    fun isUnlocked(nowMs: Long = System.currentTimeMillis()): Boolean = active(nowMs) != null
}
