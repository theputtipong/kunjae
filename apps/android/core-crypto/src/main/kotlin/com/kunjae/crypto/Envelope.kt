package com.kunjae.crypto

import org.json.JSONObject

private const val ENVELOPE_VERSION = 1
private const val ENVELOPE_ALGORITHM = "A256GCM"

data class Envelope(
    val version: Int,
    val algorithm: String,
    val nonce: String,
    val ciphertext: String,
)

private fun headerAad(version: Int, algorithm: String): ByteArray =
    "kunjae.env.$version.$algorithm|".toByteArray(Charsets.UTF_8)

private fun bindAad(version: Int, algorithm: String, callerAad: ByteArray): ByteArray =
    concat(headerAad(version, algorithm), callerAad)

fun sealToEnvelope(
    key: ByteArray,
    plaintext: ByteArray,
    callerAad: ByteArray,
): CryptoResult<Envelope> {
    val aad = bindAad(ENVELOPE_VERSION, ENVELOPE_ALGORITHM, callerAad)

    return when (val sealed = seal(key, plaintext, aad)) {
        is CryptoResult.Err -> sealed
        is CryptoResult.Ok -> ok(
            Envelope(
                version = ENVELOPE_VERSION,
                algorithm = ENVELOPE_ALGORITHM,
                nonce = bytesToBase64Url(sealed.value.nonce),
                ciphertext = bytesToBase64Url(sealed.value.ciphertext),
            ),
        )
    }
}

fun openFromEnvelope(
    key: ByteArray,
    envelope: Envelope,
    callerAad: ByteArray,
): CryptoResult<ByteArray> {
    if (envelope.version != ENVELOPE_VERSION) return err(CryptoFailure.UNSUPPORTED_ALGORITHM)
    if (envelope.algorithm != ENVELOPE_ALGORITHM) return err(CryptoFailure.UNSUPPORTED_ALGORITHM)

    val nonce = when (val decoded = base64UrlToBytes(envelope.nonce)) {
        is CryptoResult.Err -> return err(CryptoFailure.DECRYPTION_FAILED)
        is CryptoResult.Ok -> decoded.value
    }

    val ciphertext = when (val decoded = base64UrlToBytes(envelope.ciphertext)) {
        is CryptoResult.Err -> return err(CryptoFailure.DECRYPTION_FAILED)
        is CryptoResult.Ok -> decoded.value
    }

    val aad = bindAad(envelope.version, envelope.algorithm, callerAad)

    return open(key, Sealed(nonce, ciphertext), aad)
}

fun parseEnvelope(json: String): CryptoResult<Envelope> = try {
    val obj = JSONObject(json)

    val version = obj.getInt("v")
    val algorithm = obj.getString("alg")
    val nonce = obj.getString("n")
    val ciphertext = obj.getString("ct")

    if (version != ENVELOPE_VERSION || algorithm != ENVELOPE_ALGORITHM) {
        err(CryptoFailure.UNSUPPORTED_ALGORITHM)
    } else {
        ok(Envelope(version, algorithm, nonce, ciphertext))
    }
} catch (_: Exception) {
    err(CryptoFailure.INVALID_FORMAT)
}

fun encodeEnvelope(envelope: Envelope): String =
    """{"v":${envelope.version},"alg":"${envelope.algorithm}","n":"${envelope.nonce}","ct":"${envelope.ciphertext}"}"""
