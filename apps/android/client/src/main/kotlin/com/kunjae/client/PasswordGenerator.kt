package com.kunjae.client

import com.kunjae.crypto.CryptoFailure
import com.kunjae.crypto.CryptoResult
import com.kunjae.crypto.err
import com.kunjae.crypto.ok
import com.kunjae.crypto.randomBytes

object PasswordCharsets {
    const val LOWERCASE = "abcdefghijklmnopqrstuvwxyz"
    const val UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    const val DIGITS = "0123456789"

    const val SYMBOLS = "!#$%&()*+,-./:;<=>?@[]^_{|}~"
}

private const val MIN_LENGTH = 8
private const val MAX_LENGTH = 128

private fun randomInt(bound: Int): CryptoResult<Int> {
    if (bound <= 0) return err(CryptoFailure.INVALID_PARAMETER)

    val limit = 256 - (256 % bound)

    repeat(100) {
        val byte = when (val bytes = randomBytes(1)) {
            is CryptoResult.Err -> return bytes
            is CryptoResult.Ok -> bytes.value[0].toInt() and 0xff
        }

        if (byte < limit) return ok(byte % bound)
    }

    return err(CryptoFailure.KEY_DERIVATION_FAILED)
}

data class PasswordOptions(
    val length: Int = 20,
    val lowercase: Boolean = true,
    val uppercase: Boolean = true,
    val digits: Boolean = true,
    val symbols: Boolean = true,
    val requireEachSet: Boolean = true,
)

private fun shuffle(chars: MutableList<Char>): CryptoResult<Unit> {
    for (i in chars.indices.reversed()) {
        if (i == 0) break

        val j = when (val drawn = randomInt(i + 1)) {
            is CryptoResult.Err -> return drawn
            is CryptoResult.Ok -> drawn.value
        }

        val temp = chars[i]
        chars[i] = chars[j]
        chars[j] = temp
    }

    return ok(Unit)
}

fun generatePassword(options: PasswordOptions = PasswordOptions()): CryptoResult<String> {
    if (options.length < MIN_LENGTH || options.length > MAX_LENGTH) {
        return err(CryptoFailure.INVALID_PARAMETER)
    }

    val sets = buildList {
        if (options.lowercase) add(PasswordCharsets.LOWERCASE)
        if (options.uppercase) add(PasswordCharsets.UPPERCASE)
        if (options.digits) add(PasswordCharsets.DIGITS)
        if (options.symbols) add(PasswordCharsets.SYMBOLS)
    }

    if (sets.isEmpty()) return err(CryptoFailure.INVALID_PARAMETER)
    if (options.requireEachSet && options.length < sets.size) {
        return err(CryptoFailure.INVALID_PARAMETER)
    }

    val combined = sets.joinToString("")
    val chars = mutableListOf<Char>()

    if (options.requireEachSet) {
        for (set in sets) {
            val index = when (val drawn = randomInt(set.length)) {
                is CryptoResult.Err -> return drawn
                is CryptoResult.Ok -> drawn.value
            }
            chars.add(set[index])
        }
    }

    while (chars.size < options.length) {
        val index = when (val drawn = randomInt(combined.length)) {
            is CryptoResult.Err -> return drawn
            is CryptoResult.Ok -> drawn.value
        }
        chars.add(combined[index])
    }

    val shuffled = shuffle(chars)
    if (shuffled is CryptoResult.Err) return shuffled

    return ok(chars.joinToString(""))
}
