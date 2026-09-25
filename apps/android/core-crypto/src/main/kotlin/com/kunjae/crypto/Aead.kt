package com.kunjae.crypto

import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

private const val KEY_BYTES = 32
private const val NONCE_BYTES = 12
private const val TAG_BITS = 128

private val secureRandom = SecureRandom()

data class Sealed(val nonce: ByteArray, val ciphertext: ByteArray) {
    override fun toString(): String = "Sealed(***)"
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is Sealed) return false
        return nonce.contentEquals(other.nonce) && ciphertext.contentEquals(other.ciphertext)
    }

    override fun hashCode(): Int = 31 * nonce.contentHashCode() + ciphertext.contentHashCode()
}

fun randomBytes(length: Int): CryptoResult<ByteArray> {
    if (length <= 0) return err(CryptoFailure.INVALID_PARAMETER)

    val out = ByteArray(length)
    secureRandom.nextBytes(out)
    return ok(out)
}

fun seal(key: ByteArray, plaintext: ByteArray, aad: ByteArray): CryptoResult<Sealed> {
    if (key.size != KEY_BYTES) return err(CryptoFailure.INVALID_LENGTH)

    val nonce = when (val generated = randomBytes(NONCE_BYTES)) {
        is CryptoResult.Ok -> generated.value
        is CryptoResult.Err -> return generated
    }

    return try {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(
            Cipher.ENCRYPT_MODE,
            SecretKeySpec(key, "AES"),
            GCMParameterSpec(TAG_BITS, nonce),
        )
        cipher.updateAAD(aad)
        ok(Sealed(nonce, cipher.doFinal(plaintext)))
    } catch (_: Exception) {
        err(CryptoFailure.ENCRYPTION_FAILED)
    }
}

fun open(key: ByteArray, sealed: Sealed, aad: ByteArray): CryptoResult<ByteArray> {
    if (key.size != KEY_BYTES) return err(CryptoFailure.INVALID_LENGTH)
    if (sealed.nonce.size != NONCE_BYTES) return err(CryptoFailure.DECRYPTION_FAILED)

    return try {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(
            Cipher.DECRYPT_MODE,
            SecretKeySpec(key, "AES"),
            GCMParameterSpec(TAG_BITS, sealed.nonce),
        )
        cipher.updateAAD(aad)
        ok(cipher.doFinal(sealed.ciphertext))
    } catch (_: Exception) {
        err(CryptoFailure.DECRYPTION_FAILED)
    }
}
