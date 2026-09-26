package com.kunjae.client

import com.kunjae.crypto.Argon2Params
import com.kunjae.crypto.CryptoFailure
import com.kunjae.crypto.CryptoResult
import com.kunjae.crypto.bytesToBase32
import com.kunjae.crypto.bytesToBase64Url
import com.kunjae.crypto.encodeAuthKey
import com.kunjae.crypto.err
import com.kunjae.crypto.formatSecretKey
import com.kunjae.crypto.generateSecretKey
import com.kunjae.crypto.ok
import com.kunjae.crypto.randomBytes
import com.kunjae.crypto.unlockAccount
import com.kunjae.crypto.utf8ToBytes
import com.kunjae.crypto.wipe
import java.time.Instant

data class EmergencyKit(val email: String, val secretKey: String) {
    override fun toString(): String = "EmergencyKit(***)"
}

private const val MIN_PASSWORD_LENGTH = 12

private const val ACCOUNT_SALT_BYTES = 32
private const val ULID_RANDOM_BYTES = 10
private const val CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

fun createUlid(nowMs: Long): CryptoResult<String> {
    if (nowMs < 0) return err(CryptoFailure.INVALID_PARAMETER)

    val time = StringBuilder()
    var remaining = nowMs
    for (i in 0 until 10) {
        time.insert(0, CROCKFORD[(remaining % 32).toInt()])
        remaining /= 32
    }
    if (remaining != 0L) return err(CryptoFailure.INVALID_PARAMETER)

    return when (val bytes = randomBytes(ULID_RANDOM_BYTES)) {
        is CryptoResult.Err -> bytes
        is CryptoResult.Ok -> ok("$time${bytesToBase32(bytes.value)}")
    }
}

fun signUp(
    api: ApiClient,
    email: String,
    masterPassword: String,
    vaultName: String = "Personal",
    nowMs: Long = System.currentTimeMillis(),
): CryptoResult<EmergencyKit> {
    if (masterPassword.length < MIN_PASSWORD_LENGTH) return err(CryptoFailure.INVALID_PARAMETER)

    val secretKey = when (val generated = generateSecretKey()) {
        is CryptoResult.Err -> return generated
        is CryptoResult.Ok -> generated.value
    }

    val accountSalt = when (val generated = randomBytes(ACCOUNT_SALT_BYTES)) {
        is CryptoResult.Err -> { wipe(secretKey); return generated }
        is CryptoResult.Ok -> generated.value
    }

    val accountId = when (val generated = createUlid(nowMs)) {
        is CryptoResult.Err -> { wipe(secretKey); return generated }
        is CryptoResult.Ok -> generated.value
    }

    val vaultId = when (val generated = createUlid(nowMs)) {
        is CryptoResult.Err -> { wipe(secretKey); return generated }
        is CryptoResult.Ok -> generated.value
    }

    val passwordBytes = when (val encoded = utf8ToBytes(masterPassword)) {
        is CryptoResult.Err -> { wipe(secretKey); return encoded }
        is CryptoResult.Ok -> encoded.value
    }

    val params = Argon2Params()

    val keys = try {
        when (val derived = unlockAccount(passwordBytes, secretKey, accountSalt, params)) {
            is CryptoResult.Err -> { wipe(secretKey); return derived }
            is CryptoResult.Ok -> derived.value
        }
    } finally {
        wipe(passwordBytes)
    }

    try {
        val vault = when (
            val created = createVault(
                keys.wrappingKey,
                vaultId,
                VaultMetadata(vaultName, "", ""),
                Instant.ofEpochMilli(nowMs).toString(),
            )
        ) {
            is CryptoResult.Err -> return created
            is CryptoResult.Ok -> created.value
        }

        try {
            val request = signUpRequestJson(
                email = email,
                accountId = accountId,
                accountSaltBase64Url = bytesToBase64Url(accountSalt),
                argon2MemoryKiB = params.memoryKiB,
                argon2Iterations = params.iterations,
                argon2Parallelism = params.parallelism,
                argon2HashLength = params.hashLength,
                authKeyBase64Url = encodeAuthKey(keys.authKey),
                vault = vault,
            )

            return when (api.signUp(request)) {
                is ApiResult.Err -> err(CryptoFailure.INVALID_FORMAT)
                is ApiResult.Ok ->
                    when (val formatted = formatSecretKey(secretKey)) {
                        is CryptoResult.Err -> formatted
                        is CryptoResult.Ok -> ok(EmergencyKit(email, formatted.value))
                    }
            }
        } finally {
            wipe(vault.vaultKey)
        }
    } finally {
        wipe(keys.authKey)
        wipe(keys.wrappingKey)
        wipe(secretKey)
        wipe(accountSalt)
    }
}
