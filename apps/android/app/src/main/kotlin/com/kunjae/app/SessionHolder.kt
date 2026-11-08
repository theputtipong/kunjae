package com.kunjae.app

import com.kunjae.client.LocalVault
import com.kunjae.client.Session
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

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

    private val unlockedState = MutableStateFlow(false)

    val unlocked: StateFlow<Boolean> = unlockedState.asStateFlow()

    private val gate = SessionGate<VaultSession>(
        IDLE_TIMEOUT_MS,
        teardown = ::teardown,
        onUnlockedChange = { unlockedState.value = it },
    )

    fun open(newSession: VaultSession, nowMs: Long = System.currentTimeMillis()) = gate.open(newSession, nowMs)

    fun active(nowMs: Long = System.currentTimeMillis()): VaultSession? = gate.active(nowMs)

    fun peek(nowMs: Long = System.currentTimeMillis()): VaultSession? = gate.peek(nowMs)

    fun lock() = gate.lock()

    fun idleRemainingMs(nowMs: Long = System.currentTimeMillis()): Long? = gate.idleRemainingMs(nowMs)

    fun isUnlocked(nowMs: Long = System.currentTimeMillis()): Boolean = peek(nowMs) != null

    private fun teardown(session: VaultSession?) {
        session?.lock()
        ItemStore.clear()

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) AssetLinksVerifier.clear()
    }
}
