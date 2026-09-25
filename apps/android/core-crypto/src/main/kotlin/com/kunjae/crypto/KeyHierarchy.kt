package com.kunjae.crypto

private const val PURPOSE_SECRET_KEY_STRETCH = "kunjae.v1.secret-key-stretch"
private const val PURPOSE_MASTER_UNLOCK_KEY = "kunjae.v1.master-unlock-key"
private const val PURPOSE_AUTHENTICATION = "kunjae.v1.authentication"
private const val PURPOSE_VAULT_KEY_WRAPPING = "kunjae.v1.vault-key-wrapping"

private const val KEY_BYTES = 32
private const val MIN_ACCOUNT_SALT_BYTES = 16

data class AccountKeys(val authKey: ByteArray, val wrappingKey: ByteArray) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is AccountKeys) return false
        return authKey.contentEquals(other.authKey) && wrappingKey.contentEquals(other.wrappingKey)
    }

    override fun hashCode(): Int = 31 * authKey.contentHashCode() + wrappingKey.contentHashCode()
}

private fun derive(ikm: ByteArray, salt: ByteArray, purpose: String): CryptoResult<ByteArray> =
    hkdfSha256(ikm, salt, purpose.toByteArray(Charsets.UTF_8), KEY_BYTES)

fun deriveMasterUnlockKey(
    masterPassword: ByteArray,
    secretKey: ByteArray,
    accountSalt: ByteArray,
    argon2: Argon2Params,
): CryptoResult<ByteArray> {
    if (accountSalt.size < MIN_ACCOUNT_SALT_BYTES) return err(CryptoFailure.INVALID_PARAMETER)

    val kPassword = when (val result = deriveKeyFromPassword(masterPassword, accountSalt, argon2)) {
        is CryptoResult.Err -> return result
        is CryptoResult.Ok -> result.value
    }

    val kSecret = when (val result = derive(secretKey, accountSalt, PURPOSE_SECRET_KEY_STRETCH)) {
        is CryptoResult.Err -> { wipe(kPassword); return result }
        is CryptoResult.Ok -> result.value
    }

    val combined = concat(kPassword, kSecret)

    return try {
        derive(combined, accountSalt, PURPOSE_MASTER_UNLOCK_KEY)
    } finally {
        wipe(kPassword)
        wipe(kSecret)
        wipe(combined)
    }
}

fun deriveAccountKeys(muk: ByteArray, accountSalt: ByteArray): CryptoResult<AccountKeys> {
    val authKey = when (val result = derive(muk, accountSalt, PURPOSE_AUTHENTICATION)) {
        is CryptoResult.Err -> return result
        is CryptoResult.Ok -> result.value
    }

    return when (val result = derive(muk, accountSalt, PURPOSE_VAULT_KEY_WRAPPING)) {
        is CryptoResult.Err -> { wipe(authKey); result }
        is CryptoResult.Ok -> ok(AccountKeys(authKey, result.value))
    }
}

fun unlockAccount(
    masterPassword: ByteArray,
    secretKey: ByteArray,
    accountSalt: ByteArray,
    argon2: Argon2Params,
): CryptoResult<AccountKeys> {
    val muk = when (
        val result = deriveMasterUnlockKey(masterPassword, secretKey, accountSalt, argon2)
    ) {
        is CryptoResult.Err -> return result
        is CryptoResult.Ok -> result.value
    }

    return try {
        deriveAccountKeys(muk, accountSalt)
    } finally {
        wipe(muk)
    }
}

fun encodeAuthKey(authKey: ByteArray): String = bytesToBase64Url(authKey)
