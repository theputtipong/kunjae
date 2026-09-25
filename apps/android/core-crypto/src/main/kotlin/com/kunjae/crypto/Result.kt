package com.kunjae.crypto

enum class CryptoFailure {
    INVALID_ENCODING,
    INVALID_LENGTH,
    INVALID_PARAMETER,
    INVALID_FORMAT,
    UNSUPPORTED_ALGORITHM,
    DECRYPTION_FAILED,
    ENCRYPTION_FAILED,
    KEY_DERIVATION_FAILED,
}

sealed interface CryptoResult<out T> {
    data class Ok<T>(val value: T) : CryptoResult<T>
    data class Err(val failure: CryptoFailure) : CryptoResult<Nothing>
}

fun <T> ok(value: T): CryptoResult<T> = CryptoResult.Ok(value)

fun err(failure: CryptoFailure): CryptoResult<Nothing> = CryptoResult.Err(failure)

fun <T> CryptoResult<T>.valueOrNull(): T? = when (this) {
    is CryptoResult.Ok -> value
    is CryptoResult.Err -> null
}
