package com.kunjae.client

import com.kunjae.crypto.CryptoFailure
import com.kunjae.crypto.CryptoResult
import com.kunjae.crypto.TotpAlgorithm
import com.kunjae.crypto.TotpCode
import com.kunjae.crypto.TotpParams
import com.kunjae.crypto.decodeTotpSecret
import com.kunjae.crypto.err
import com.kunjae.crypto.ok
import com.kunjae.crypto.totpFromSecretText
import com.kunjae.crypto.wipe
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction

data class TotpConfig(
    val secret: String,
    val algorithm: String,
    val digits: Int,
    val periodSeconds: Int,
) {
    override fun toString(): String = "TotpConfig(***)"
}

const val DEFAULT_TOTP_ALGORITHM = "SHA1"
const val DEFAULT_TOTP_DIGITS = 6
const val DEFAULT_TOTP_PERIOD = 30

val TOTP_ALGORITHMS = listOf("SHA1", "SHA256", "SHA512")

private const val OTPAUTH_SCHEME = "otpauth://"
private const val TOTP_TYPE = "totp"
private val SHORT_NUMBER = Regex("^\\d{1,4}$")

fun isOtpauthUri(text: String): Boolean = text.trim().lowercase().startsWith(OTPAUTH_SCHEME)

fun cleanTotpSecret(text: String): String =
    text.filterNot { it.isWhitespace() || Character.isSpaceChar(it) || it == '-' }
        .uppercase()
        .trimEnd('=')

private fun decodeUtf8Strict(bytes: ByteArray): String? = try {
    Charsets.UTF_8.newDecoder()
        .onMalformedInput(CodingErrorAction.REPORT)
        .onUnmappableCharacter(CodingErrorAction.REPORT)
        .decode(ByteBuffer.wrap(bytes))
        .toString()
} catch (_: Exception) {
    null
}

private fun hexValue(c: Char): Int = when (c) {
    in '0'..'9' -> c - '0'
    in 'a'..'f' -> c - 'a' + 10
    in 'A'..'F' -> c - 'A' + 10
    else -> -1
}

private fun decodeComponent(text: String): String? {
    val out = StringBuilder()
    val pending = ByteArrayOutputStream()
    var i = 0

    fun flush(): Boolean {
        if (pending.size() == 0) return true
        val decoded = decodeUtf8Strict(pending.toByteArray()) ?: return false
        out.append(decoded)
        pending.reset()
        return true
    }

    while (i < text.length) {
        val c = text[i]
        if (c == '%') {
            if (i + 2 >= text.length) return null
            val hi = hexValue(text[i + 1])
            val lo = hexValue(text[i + 2])
            if (hi < 0 || lo < 0) return null
            pending.write(hi * 16 + lo)
            i += 3
        } else {
            if (!flush()) return null
            out.append(c)
            i += 1
        }
    }

    return if (flush()) out.toString() else null
}

private fun parseQuery(query: String): Map<String, String>? {
    val params = LinkedHashMap<String, String>()

    for (part in query.split("&")) {
        if (part.isEmpty()) continue

        val eq = part.indexOf('=')
        val key = decodeComponent(if (eq < 0) part else part.substring(0, eq)) ?: return null
        val value = decodeComponent(if (eq < 0) "" else part.substring(eq + 1)) ?: return null

        val name = key.lowercase()
        if (name !in params) params[name] = value
    }

    return params
}

private fun parseBoundedInt(text: String?, fallback: Int, min: Int, max: Int): Int? {
    if (text == null) return fallback
    if (!SHORT_NUMBER.matches(text)) return null

    val value = text.toInt()
    return if (value in min..max) value else null
}

private fun parseAlgorithm(text: String?): String? {
    if (text == null) return DEFAULT_TOTP_ALGORITHM

    val name = text.uppercase().replaceFirst("-", "")
    return TOTP_ALGORITHMS.firstOrNull { it == name }
}

private fun isDecodableSecret(secret: String): Boolean =
    when (val bytes = decodeTotpSecret(secret)) {
        is CryptoResult.Err -> false
        is CryptoResult.Ok -> {
            wipe(bytes.value)
            true
        }
    }

fun parseOtpauthUri(text: String): CryptoResult<TotpConfig> {
    val trimmed = text.trim()
    if (!trimmed.lowercase().startsWith(OTPAUTH_SCHEME)) return err(CryptoFailure.INVALID_FORMAT)

    val rest = trimmed.substring(OTPAUTH_SCHEME.length)
    val typeEnd = rest.indexOf('/')
    if (typeEnd < 0 || rest.substring(0, typeEnd).lowercase() != TOTP_TYPE) return err(CryptoFailure.INVALID_FORMAT)

    val afterType = rest.substring(typeEnd + 1)
    val queryStart = afterType.indexOf('?')
    if (queryStart < 0) return err(CryptoFailure.INVALID_FORMAT)

    val queryWithFragment = afterType.substring(queryStart + 1)
    val fragment = queryWithFragment.indexOf('#')
    val params = parseQuery(if (fragment < 0) queryWithFragment else queryWithFragment.substring(0, fragment))
        ?: return err(CryptoFailure.INVALID_FORMAT)

    val secret = cleanTotpSecret(params["secret"] ?: "")
    if (secret.isEmpty() || !isDecodableSecret(secret)) return err(CryptoFailure.INVALID_FORMAT)

    val algorithm = parseAlgorithm(params["algorithm"])
    val digits = parseBoundedInt(params["digits"], DEFAULT_TOTP_DIGITS, ItemLimits.TOTP_DIGITS_MIN, ItemLimits.TOTP_DIGITS_MAX)
    val period = parseBoundedInt(params["period"], DEFAULT_TOTP_PERIOD, ItemLimits.TOTP_PERIOD_MIN, ItemLimits.TOTP_PERIOD_MAX)
    if (algorithm == null || digits == null || period == null) return err(CryptoFailure.INVALID_FORMAT)

    return ok(TotpConfig(secret, algorithm, digits, period))
}

fun totpConfigOf(login: LoginItem): CryptoResult<TotpConfig> {
    if (isOtpauthUri(login.totpSecret)) return parseOtpauthUri(login.totpSecret)

    return ok(
        TotpConfig(
            secret = login.totpSecret,
            algorithm = login.totpAlgorithm ?: DEFAULT_TOTP_ALGORITHM,
            digits = login.totpDigits ?: DEFAULT_TOTP_DIGITS,
            periodSeconds = login.totpPeriod ?: DEFAULT_TOTP_PERIOD,
        ),
    )
}

fun loginTotpCode(login: LoginItem, nowMs: Long): CryptoResult<TotpCode> {
    val config = when (val resolved = totpConfigOf(login)) {
        is CryptoResult.Err -> return resolved
        is CryptoResult.Ok -> resolved.value
    }

    val algorithm = TotpAlgorithm.entries.firstOrNull { it.name == config.algorithm }
        ?: return err(CryptoFailure.INVALID_FORMAT)

    return totpFromSecretText(config.secret, nowMs, TotpParams(algorithm, config.digits, config.periodSeconds))
}

fun normalizeItemTotp(item: VaultItem): VaultItem? {
    if (item !is LoginItem || !isOtpauthUri(item.totpSecret)) return item

    val config = when (val parsed = parseOtpauthUri(item.totpSecret)) {
        is CryptoResult.Err -> return null
        is CryptoResult.Ok -> parsed.value
    }

    return item.copy(
        totpSecret = config.secret,
        totpAlgorithm = config.algorithm.takeIf { it != DEFAULT_TOTP_ALGORITHM },
        totpDigits = config.digits.takeIf { it != DEFAULT_TOTP_DIGITS },
        totpPeriod = config.periodSeconds.takeIf { it != DEFAULT_TOTP_PERIOD },
    )
}
