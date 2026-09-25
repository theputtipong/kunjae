package com.kunjae.crypto

private const val SECRET_KEY_BYTES = 16
private const val SECRET_KEY_VERSION = "K1"
private const val SECRET_KEY_CHARS = 26

private val GROUP_SIZES = listOf(6, 5, 5, 5, 5)

fun generateSecretKey(): CryptoResult<ByteArray> = randomBytes(SECRET_KEY_BYTES)

fun formatSecretKey(key: ByteArray): CryptoResult<String> {
    if (key.size != SECRET_KEY_BYTES) return err(CryptoFailure.INVALID_LENGTH)

    val body = bytesToBase32(key)
    val groups = StringBuilder(SECRET_KEY_VERSION)

    var offset = 0
    for (size in GROUP_SIZES) {
        groups.append('-').append(body, offset, offset + size)
        offset += size
    }

    return ok(groups.toString())
}

fun parseSecretKey(text: String): CryptoResult<ByteArray> {
    val compact = text.filterNot { it == '-' || it.isWhitespace() }

    if (compact.length != SECRET_KEY_VERSION.length + SECRET_KEY_CHARS) {
        return err(CryptoFailure.INVALID_FORMAT)
    }

    val prefix = compact.substring(0, SECRET_KEY_VERSION.length)
    if (!prefix.equals(SECRET_KEY_VERSION, ignoreCase = true)) {
        return err(CryptoFailure.INVALID_FORMAT)
    }

    val body = compact.substring(SECRET_KEY_VERSION.length)

    return when (val decoded = base32ToBytes(body)) {
        is CryptoResult.Err -> err(CryptoFailure.INVALID_FORMAT)
        is CryptoResult.Ok ->
            if (decoded.value.size != SECRET_KEY_BYTES) err(CryptoFailure.INVALID_LENGTH)
            else ok(decoded.value)
    }
}
