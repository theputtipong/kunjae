package com.kunjae.crypto

import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

enum class TotpAlgorithm(internal val macName: String) {
    SHA1("HmacSHA1"),
    SHA256("HmacSHA256"),
    SHA512("HmacSHA512"),
}

data class TotpParams(
    val algorithm: TotpAlgorithm = TotpAlgorithm.SHA1,
    val digits: Int = 6,
    val periodSeconds: Int = 30,
)

data class TotpCode(val code: String, val secondsRemaining: Int)

private const val RFC4648_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

private const val MIN_DIGITS = 6
private const val MAX_DIGITS = 8
private const val MIN_PERIOD = 15
private const val MAX_PERIOD = 300

fun decodeTotpSecret(text: String): CryptoResult<ByteArray> {
    val cleaned = text.filterNot { it.isWhitespace() || it == '-' }
        .uppercase()
        .trimEnd('=')

    if (cleaned.isEmpty()) return err(CryptoFailure.INVALID_FORMAT)

    var bits = 0
    var value = 0
    val out = ArrayList<Byte>(cleaned.length)

    for (character in cleaned) {
        val index = RFC4648_ALPHABET.indexOf(character)
        if (index < 0) return err(CryptoFailure.INVALID_FORMAT)

        value = (value shl 5) or index
        bits += 5

        if (bits >= 8) {
            bits -= 8
            out.add(((value shr bits) and 0xFF).toByte())
        }
    }

    if (bits > 0 && (value and ((1 shl bits) - 1)) != 0) return err(CryptoFailure.INVALID_FORMAT)
    if (out.isEmpty()) return err(CryptoFailure.INVALID_FORMAT)

    return ok(out.toByteArray())
}

private fun counterToBytes(counter: Long): ByteArray {
    val out = ByteArray(8)
    var remaining = counter
    for (i in 7 downTo 0) {
        out[i] = (remaining and 0xFF).toByte()
        remaining = remaining ushr 8
    }
    return out
}

private val DIGIT_MODULUS = intArrayOf(0, 0, 0, 0, 0, 0, 1_000_000, 10_000_000, 100_000_000)

fun hotp(secret: ByteArray, counter: Long, params: TotpParams = TotpParams()): CryptoResult<String> {
    if (secret.isEmpty()) return err(CryptoFailure.INVALID_PARAMETER)
    if (counter < 0) return err(CryptoFailure.INVALID_PARAMETER)
    if (params.digits < MIN_DIGITS || params.digits > MAX_DIGITS) {
        return err(CryptoFailure.INVALID_PARAMETER)
    }

    return try {
        val mac = Mac.getInstance(params.algorithm.macName)
        mac.init(SecretKeySpec(secret, params.algorithm.macName))
        val digest = mac.doFinal(counterToBytes(counter))

        val offset = (digest[digest.size - 1].toInt() and 0x0F)

        val binary = ((digest[offset].toInt() and 0x7F) shl 24) or
            ((digest[offset + 1].toInt() and 0xFF) shl 16) or
            ((digest[offset + 2].toInt() and 0xFF) shl 8) or
            (digest[offset + 3].toInt() and 0xFF)

        ok((binary % DIGIT_MODULUS[params.digits]).toString().padStart(params.digits, '0'))
    } catch (_: Exception) {
        err(CryptoFailure.INVALID_PARAMETER)
    }
}

fun totpCounter(nowMs: Long, periodSeconds: Int): Long = nowMs / 1000 / periodSeconds

fun totp(secret: ByteArray, nowMs: Long, params: TotpParams = TotpParams()): CryptoResult<TotpCode> {
    if (nowMs < 0) return err(CryptoFailure.INVALID_PARAMETER)
    if (params.periodSeconds < MIN_PERIOD || params.periodSeconds > MAX_PERIOD) {
        return err(CryptoFailure.INVALID_PARAMETER)
    }

    return when (val code = hotp(secret, totpCounter(nowMs, params.periodSeconds), params)) {
        is CryptoResult.Err -> code
        is CryptoResult.Ok -> {
            val seconds = nowMs / 1000
            val remaining = params.periodSeconds - (seconds % params.periodSeconds).toInt()
            ok(TotpCode(code.value, remaining))
        }
    }
}

fun totpFromSecretText(
    secretText: String,
    nowMs: Long,
    params: TotpParams = TotpParams(),
): CryptoResult<TotpCode> {
    val secret = when (val decoded = decodeTotpSecret(secretText)) {
        is CryptoResult.Err -> return decoded
        is CryptoResult.Ok -> decoded.value
    }

    return try {
        totp(secret, nowMs, params)
    } finally {
        wipe(secret)
    }
}
