package com.kunjae.client

import com.kunjae.crypto.AccountKeys
import com.kunjae.crypto.CryptoResult
import com.kunjae.crypto.Argon2Params
import com.kunjae.crypto.encodeAuthKey
import com.kunjae.crypto.ok
import com.kunjae.crypto.base64UrlToBytes
import com.kunjae.crypto.openFromEnvelope
import com.kunjae.crypto.buildVaultKeyAad
import com.kunjae.crypto.parseSecretKey
import com.kunjae.crypto.unlockAccount
import com.kunjae.crypto.utf8ToBytes
import com.kunjae.crypto.validateArgon2Params
import com.kunjae.crypto.wipe

class Session private constructor(
    val accountId: String,
    val email: String,
    private val accountKeys: AccountKeys,
    private val vaultKeys: MutableMap<String, ByteArray>,
    private var token: String,
) {
    companion object {
        fun unlock(
            api: ApiClient,
            email: String,
            masterPassword: String,
            secretKeyText: String,
        ): CryptoResult<Session> {
            val secretKey = when (val parsed = parseSecretKey(secretKeyText)) {
                is CryptoResult.Err -> return parsed
                is CryptoResult.Ok -> parsed.value
            }

            try {
                val challenge = when (val result = api.loginBegin(email)) {
                    is ApiResult.Err -> return cryptoError()
                    is ApiResult.Ok -> result.value
                }

                val params = Argon2Params(
                    memoryKiB = challenge.memoryKiB,
                    iterations = challenge.iterations,
                    parallelism = challenge.parallelism,
                    hashLength = challenge.hashLength,
                )

                if (validateArgon2Params(params) is CryptoResult.Err) return cryptoError()

                val salt = when (val decoded = base64UrlToBytes(challenge.accountSaltBase64Url)) {
                    is CryptoResult.Err -> return decoded
                    is CryptoResult.Ok -> decoded.value
                }

                val passwordBytes = when (val encoded = utf8ToBytes(masterPassword)) {
                    is CryptoResult.Err -> return encoded
                    is CryptoResult.Ok -> encoded.value
                }

                val keys = try {
                    when (val derived = unlockAccount(passwordBytes, secretKey, salt, params)) {
                        is CryptoResult.Err -> return derived
                        is CryptoResult.Ok -> derived.value
                    }
                } finally {
                    wipe(passwordBytes)
                }

                val login = when (val result = api.loginFinish(email, encodeAuthKey(keys.authKey))) {
                    is ApiResult.Err -> {
                        wipe(keys.authKey)
                        wipe(keys.wrappingKey)
                        return cryptoError()
                    }
                    is ApiResult.Ok -> result.value
                }

                val vaultKeys = mutableMapOf<String, ByteArray>()
                for (bundle in login.vaults) {
                    val aad = buildVaultKeyAad(bundle.vaultId).toByteArray(Charsets.UTF_8)

                    when (
                        val unwrapped =
                            openFromEnvelope(keys.wrappingKey, bundle.wrappedVaultKey, aad)
                    ) {
                        is CryptoResult.Err -> {
                            for (key in vaultKeys.values) wipe(key)
                            wipe(keys.authKey)
                            wipe(keys.wrappingKey)
                            return unwrapped
                        }
                        is CryptoResult.Ok -> vaultKeys[bundle.vaultId] = unwrapped.value
                    }
                }

                return ok(
                    Session(login.accountId, email, keys, vaultKeys, login.token),
                )
            } finally {
                wipe(secretKey)
            }
        }

        fun resume(
            api: ApiClient,
            email: String,
            authKey: ByteArray,
            wrappingKey: ByteArray,
        ): CryptoResult<Session> {
            val keys = AccountKeys(authKey.copyOf(), wrappingKey.copyOf())

            val login = when (val result = api.loginFinish(email, encodeAuthKey(keys.authKey))) {
                is ApiResult.Err -> {
                    wipe(keys.authKey)
                    wipe(keys.wrappingKey)
                    return cryptoError()
                }
                is ApiResult.Ok -> result.value
            }

            val vaultKeys = mutableMapOf<String, ByteArray>()
            for (bundle in login.vaults) {
                val aad = buildVaultKeyAad(bundle.vaultId).toByteArray(Charsets.UTF_8)

                when (
                    val unwrapped = openFromEnvelope(keys.wrappingKey, bundle.wrappedVaultKey, aad)
                ) {
                    is CryptoResult.Err -> {
                        for (key in vaultKeys.values) wipe(key)
                        wipe(keys.authKey)
                        wipe(keys.wrappingKey)
                        return unwrapped
                    }
                    is CryptoResult.Ok -> vaultKeys[bundle.vaultId] = unwrapped.value
                }
            }

            return ok(Session(login.accountId, email, keys, vaultKeys, login.token))
        }
    }

    fun <T> withVaultKey(vaultId: String, borrow: (ByteArray) -> T): T? {
        val key = vaultKeys[vaultId] ?: return null
        return borrow(key)
    }

    fun <T> withAccountKeys(borrow: (authKey: ByteArray, wrappingKey: ByteArray) -> T): T =
        borrow(accountKeys.authKey, accountKeys.wrappingKey)

    fun <T> withWrappingKey(borrow: (ByteArray) -> T): T = borrow(accountKeys.wrappingKey)

    fun vaultIds(): Set<String> = vaultKeys.keys.toSet()

    fun addVaultKey(vaultId: String, key: ByteArray) {
        vaultKeys[vaultId] = key
    }

    fun accessToken(): String = token

    fun replaceToken(newToken: String) {
        token = newToken
    }

    fun lock() {
        wipe(accountKeys.authKey)
        wipe(accountKeys.wrappingKey)
        for (key in vaultKeys.values) wipe(key)
        vaultKeys.clear()
        token = ""
    }
}
