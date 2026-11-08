package com.kunjae.app

class SessionGate<T : Any>(
    private val idleTimeoutMs: Long,
    private val teardown: (T?) -> Unit,
    private val onUnlockedChange: (Boolean) -> Unit,
) {

    private var session: T? = null
    private var lastUsedAtMs = 0L

    @Synchronized
    fun open(next: T, nowMs: Long) {
        teardown(session)
        session = next
        lastUsedAtMs = nowMs
        onUnlockedChange(true)
    }

    @Synchronized
    fun active(nowMs: Long): T? {
        val current = peek(nowMs) ?: return null
        lastUsedAtMs = nowMs
        return current
    }

    @Synchronized
    fun peek(nowMs: Long): T? {
        val current = session ?: return null

        if (nowMs - lastUsedAtMs > idleTimeoutMs) {
            lock()
            return null
        }

        return current
    }

    @Synchronized
    fun idleRemainingMs(nowMs: Long): Long? {
        if (session == null) return null
        return idleTimeoutMs - (nowMs - lastUsedAtMs)
    }

    @Synchronized
    fun lock() {
        val current = session
        session = null
        lastUsedAtMs = 0L
        teardown(current)
        onUnlockedChange(false)
    }
}

enum class PullOutcome { APPLY, LOCK, DISCARD }

fun pullOutcome(captured: Any, now: Any?): PullOutcome = when {
    now == null -> PullOutcome.LOCK
    now === captured -> PullOutcome.APPLY
    else -> PullOutcome.DISCARD
}
