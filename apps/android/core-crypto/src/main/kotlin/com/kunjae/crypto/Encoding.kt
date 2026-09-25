package com.kunjae.crypto

private const val HEX_DIGITS = "0123456789abcdef"

private const val B32_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

private const val B64URL_ALPHABET =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"

private const val INVALID = -1

private val B32_IMPOSSIBLE_REMAINDERS = setOf(1, 3, 6)

private const val B64_IMPOSSIBLE_REMAINDER = 1

private val b32Lookup = IntArray(128) { INVALID }.also { table ->
    for (i in B32_ALPHABET.indices) {
        table[B32_ALPHABET[i].code] = i
        table[B32_ALPHABET[i].code + 32] = i
    }
    for (ch in listOf('i', 'I', 'l', 'L')) table[ch.code] = B32_ALPHABET.indexOf('1')
    for (ch in listOf('o', 'O')) table[ch.code] = B32_ALPHABET.indexOf('0')
}

private val b64Lookup = IntArray(128) { INVALID }.also { table ->
    for (i in B64URL_ALPHABET.indices) table[B64URL_ALPHABET[i].code] = i
}

fun bytesToHex(bytes: ByteArray): String {
    val out = StringBuilder(bytes.size * 2)
    for (byte in bytes) {
        val value = byte.toInt() and 0xff
        out.append(HEX_DIGITS[value ushr 4])
        out.append(HEX_DIGITS[value and 0x0f])
    }
    return out.toString()
}

fun hexToBytes(hex: String): CryptoResult<ByteArray> {
    if (hex.length % 2 != 0) return err(CryptoFailure.INVALID_ENCODING)

    val out = ByteArray(hex.length / 2)
    for (i in out.indices) {
        val high = Character.digit(hex[i * 2], 16)
        val low = Character.digit(hex[i * 2 + 1], 16)
        if (high < 0 || low < 0) return err(CryptoFailure.INVALID_ENCODING)
        out[i] = ((high shl 4) or low).toByte()
    }
    return ok(out)
}

fun bytesToBase32(bytes: ByteArray): String {
    val out = StringBuilder()
    var buffer = 0
    var bits = 0

    for (byte in bytes) {
        buffer = (buffer shl 8) or (byte.toInt() and 0xff)
        bits += 8

        while (bits >= 5) {
            bits -= 5
            out.append(B32_ALPHABET[(buffer ushr bits) and 0b11111])
        }
    }

    if (bits > 0) out.append(B32_ALPHABET[(buffer shl (5 - bits)) and 0b11111])

    return out.toString()
}

fun base32ToBytes(text: String): CryptoResult<ByteArray> {
    if (text.length % 8 in B32_IMPOSSIBLE_REMAINDERS) return err(CryptoFailure.INVALID_ENCODING)

    val out = ByteArray(text.length * 5 / 8)
    var outIndex = 0
    var buffer = 0
    var bits = 0

    for (ch in text) {
        val value = if (ch.code < 128) b32Lookup[ch.code] else INVALID
        if (value == INVALID) return err(CryptoFailure.INVALID_ENCODING)

        buffer = (buffer shl 5) or value
        bits += 5

        if (bits >= 8) {
            bits -= 8
            out[outIndex] = ((buffer ushr bits) and 0xff).toByte()
            outIndex += 1
        }
    }

    if (bits > 0 && (buffer and ((1 shl bits) - 1)) != 0) {
        return err(CryptoFailure.INVALID_ENCODING)
    }

    return ok(out)
}

fun bytesToBase64Url(bytes: ByteArray): String {
    val out = StringBuilder()
    var buffer = 0
    var bits = 0

    for (byte in bytes) {
        buffer = (buffer shl 8) or (byte.toInt() and 0xff)
        bits += 8

        while (bits >= 6) {
            bits -= 6
            out.append(B64URL_ALPHABET[(buffer ushr bits) and 0b111111])
        }
    }

    if (bits > 0) out.append(B64URL_ALPHABET[(buffer shl (6 - bits)) and 0b111111])

    return out.toString()
}

fun base64UrlToBytes(text: String): CryptoResult<ByteArray> {
    if (text.length % 4 == B64_IMPOSSIBLE_REMAINDER) return err(CryptoFailure.INVALID_ENCODING)

    val out = ByteArray(text.length * 6 / 8)
    var outIndex = 0
    var buffer = 0
    var bits = 0

    for (ch in text) {
        val value = if (ch.code < 128) b64Lookup[ch.code] else INVALID
        if (value == INVALID) return err(CryptoFailure.INVALID_ENCODING)

        buffer = (buffer shl 6) or value
        bits += 6

        if (bits >= 8) {
            bits -= 8
            out[outIndex] = ((buffer ushr bits) and 0xff).toByte()
            outIndex += 1
        }
    }

    if (bits > 0 && (buffer and ((1 shl bits) - 1)) != 0) {
        return err(CryptoFailure.INVALID_ENCODING)
    }

    return ok(out)
}

fun utf8ToBytes(text: String): CryptoResult<ByteArray> {
    var index = 0
    while (index < text.length) {
        val ch = text[index]
        if (ch.isHighSurrogate()) {
            val next = if (index + 1 < text.length) text[index + 1] else null
            if (next == null || !next.isLowSurrogate()) return err(CryptoFailure.INVALID_ENCODING)
            index += 2
            continue
        }
        if (ch.isLowSurrogate()) return err(CryptoFailure.INVALID_ENCODING)
        index += 1
    }

    return ok(text.toByteArray(Charsets.UTF_8))
}

fun bytesToUtf8(bytes: ByteArray): CryptoResult<String> {
    val decoder = Charsets.UTF_8.newDecoder()
    return try {
        ok(decoder.decode(java.nio.ByteBuffer.wrap(bytes)).toString())
    } catch (_: java.nio.charset.CharacterCodingException) {
        err(CryptoFailure.INVALID_ENCODING)
    }
}
