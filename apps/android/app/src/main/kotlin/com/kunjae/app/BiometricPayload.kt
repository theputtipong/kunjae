package com.kunjae.app

object BiometricPayload {

    const val KEY_BYTES = 32

    private const val TIME_BYTES = 8
    private const val HEADER_BYTES = TIME_BYTES + KEY_BYTES + KEY_BYTES

    private const val MAX_AGE_MS = 14L * 24 * 60 * 60 * 1000
    private const val MAX_CLOCK_SKEW_MS = 5L * 60 * 1000

    class Decoded(
        val email: String,
        val authKey: ByteArray,
        val wrappingKey: ByteArray,
        val savedAtMs: Long,
    ) {
        override fun toString(): String = "BiometricPayload.Decoded(***)"
    }

    fun encode(email: String, authKey: ByteArray, wrappingKey: ByteArray, nowMs: Long): ByteArray {
        require(authKey.size == KEY_BYTES && wrappingKey.size == KEY_BYTES) { "Unexpected key size" }

        val emailBytes = email.toByteArray(Charsets.UTF_8)
        val out = ByteArray(HEADER_BYTES + emailBytes.size)

        for (i in 0 until TIME_BYTES) out[i] = (nowMs shr (8 * (TIME_BYTES - 1 - i))).toByte()
        authKey.copyInto(out, TIME_BYTES)
        wrappingKey.copyInto(out, TIME_BYTES + KEY_BYTES)
        emailBytes.copyInto(out, HEADER_BYTES)

        return out
    }

    fun decode(bytes: ByteArray): Decoded? {
        if (bytes.size < HEADER_BYTES) return null

        var savedAtMs = 0L
        for (i in 0 until TIME_BYTES) savedAtMs = (savedAtMs shl 8) or (bytes[i].toLong() and 0xFF)

        val email = runCatching {
            String(bytes, HEADER_BYTES, bytes.size - HEADER_BYTES, Charsets.UTF_8)
        }.getOrNull() ?: return null

        return Decoded(
            email = email,
            authKey = bytes.copyOfRange(TIME_BYTES, TIME_BYTES + KEY_BYTES),
            wrappingKey = bytes.copyOfRange(TIME_BYTES + KEY_BYTES, HEADER_BYTES),
            savedAtMs = savedAtMs,
        )
    }

    fun expired(savedAtMs: Long, nowMs: Long): Boolean =
        nowMs - savedAtMs > MAX_AGE_MS || savedAtMs - nowMs > MAX_CLOCK_SKEW_MS
}
