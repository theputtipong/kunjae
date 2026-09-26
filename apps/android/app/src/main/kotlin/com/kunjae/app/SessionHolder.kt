package com.kunjae.app

import com.kunjae.client.LocalVault
import com.kunjae.client.Session

sealed interface VaultSession {
    fun lock()

    class Account(val session: Session) : VaultSession {
        override fun lock() = session.lock()
        override fun toString(): String = "VaultSession.Account(***)"
    }

    class Local(val vault: LocalVault) : VaultSession {
        override fun lock() = vault.lock()
        override fun toString(): String = "VaultSession.Local(***)"
    }
}

object SessionHolder {

    private const val IDLE_TIMEOUT_MS = 15 * 60 * 1000L

    private var session: VaultSession? = null
    private var lastUsedAtMs = 0L

    @Synchronized
    fun open(newSession: VaultSession, nowMs: Long = System.currentTimeMillis()) {
        lock()
        session = newSession
        lastUsedAtMs = nowMs
    }

    @Synchronized
    fun active(nowMs: Long = System.currentTimeMillis()): VaultSession? {
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
