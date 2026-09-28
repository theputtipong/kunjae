package com.kunjae.crypto

import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import org.bouncycastle.crypto.generators.Argon2BytesGenerator
import org.bouncycastle.crypto.params.Argon2Parameters

private const val HASH_ALGORITHM = "HmacSHA256"
private const val HASH_LENGTH = 32

private const val MAX_OKM_LENGTH = 255 * HASH_LENGTH

private fun hmac(key: ByteArray, message: ByteArray): ByteArray {
    val mac = Mac.getInstance(HASH_ALGORITHM)
    val material = if (key.isEmpty()) ByteArray(HASH_LENGTH) else key
    mac.init(SecretKeySpec(material, HASH_ALGORITHM))
    return mac.doFinal(message)
}

fun hkdfSha256(
    ikm: ByteArray,
    salt: ByteArray,
    info: ByteArray,
    length: Int,
): CryptoResult<ByteArray> {
    if (length <= 0 || length > MAX_OKM_LENGTH) return err(CryptoFailure.INVALID_PARAMETER)
    if (ikm.isEmpty()) return err(CryptoFailure.INVALID_PARAMETER)

    val prk = hmac(salt, ikm)

    val out = ByteArray(length)
    var previous = ByteArray(0)
    var offset = 0
    var counter = 1

    while (offset < length) {
        val block = hmac(prk, concat(previous, info, byteArrayOf(counter.toByte())))
        val take = minOf(block.size, length - offset)
        block.copyInto(out, offset, 0, take)

        previous = block
        offset += take
        counter += 1
    }

    wipe(prk)
    return ok(out)
}

data class Argon2Params(
    val memoryKiB: Int = 65_536,
    val iterations: Int = 3,
    val parallelism: Int = 1,
    val hashLength: Int = 32,
)

private object Argon2Limits {
    const val MIN_MEMORY_KIB = 19_456
    const val MAX_MEMORY_KIB = 1_048_576
    const val MIN_ITERATIONS = 2
    const val MAX_ITERATIONS = 16
    const val MIN_PARALLELISM = 1
    const val MAX_PARALLELISM = 4
    const val MIN_HASH_LENGTH = 16
    const val MAX_HASH_LENGTH = 64
    const val MIN_SALT_BYTES = 16
}

fun validateArgon2Params(params: Argon2Params): CryptoResult<Argon2Params> {
    if (params.memoryKiB < Argon2Limits.MIN_MEMORY_KIB ||
        params.memoryKiB > Argon2Limits.MAX_MEMORY_KIB
    ) return err(CryptoFailure.INVALID_PARAMETER)

    if (params.iterations < Argon2Limits.MIN_ITERATIONS ||
        params.iterations > Argon2Limits.MAX_ITERATIONS
    ) return err(CryptoFailure.INVALID_PARAMETER)

    if (params.parallelism < Argon2Limits.MIN_PARALLELISM ||
        params.parallelism > Argon2Limits.MAX_PARALLELISM
    ) return err(CryptoFailure.INVALID_PARAMETER)

    if (params.hashLength < Argon2Limits.MIN_HASH_LENGTH ||
        params.hashLength > Argon2Limits.MAX_HASH_LENGTH
    ) return err(CryptoFailure.INVALID_PARAMETER)

    return ok(params)
}

fun deriveKeyFromPassword(
    password: ByteArray,
    salt: ByteArray,
    params: Argon2Params,
): CryptoResult<ByteArray> {
    val validated = validateArgon2Params(params)
    if (validated is CryptoResult.Err) return validated
    if (salt.size < Argon2Limits.MIN_SALT_BYTES) return err(CryptoFailure.INVALID_PARAMETER)
    if (password.isEmpty()) return err(CryptoFailure.INVALID_PARAMETER)

    val builder = Argon2Parameters.Builder(Argon2Parameters.ARGON2_id)
        .withVersion(Argon2Parameters.ARGON2_VERSION_13)
        .withSalt(salt)
        .withMemoryAsKB(params.memoryKiB)
        .withIterations(params.iterations)
        .withParallelism(params.parallelism)

    val out = ByteArray(params.hashLength)
    try {
        val generator = Argon2BytesGenerator()
        generator.init(builder.build())
        generator.generateBytes(password, out)
    } catch (_: OutOfMemoryError) {
        return err(CryptoFailure.KEY_DERIVATION_FAILED)
    }

    return ok(out)
}
