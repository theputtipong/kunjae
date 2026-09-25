package com.kunjae.client

import com.kunjae.crypto.Argon2Params
import com.kunjae.crypto.CryptoFailure
import com.kunjae.crypto.CryptoResult
import com.kunjae.crypto.buildVaultKeyAad
import com.kunjae.crypto.bytesToBase64Url
import com.kunjae.crypto.base64UrlToBytes
import com.kunjae.crypto.constantTimeEquals
import com.kunjae.crypto.encodeAuthKey
import com.kunjae.crypto.err
import com.kunjae.crypto.parseSecretKey
import com.kunjae.crypto.randomBytes
import com.kunjae.crypto.sealToEnvelope
import com.kunjae.crypto.unlockAccount
import com.kunjae.crypto.utf8ToBytes
import com.kunjae.crypto.validateArgon2Params
import com.kunjae.crypto.wipe
import org.json.JSONArray
import org.json.JSONObject

private const val MIN_NEW_PASSWORD_LENGTH = 12

private const val ACCOUNT_SALT_BYTES = 32

fun changeMasterPassword(
    api: ApiClient,
    session: Session,
    currentMasterPassword: String,
    newMasterPassword: String,
    secretKeyText: String,
): CryptoResult<Session> {
    if (newMasterPassword.length < MIN_NEW_PASSWORD_LENGTH) {
        return err(CryptoFailure.INVALID_PARAMETER)
    }

    val secretKey = when (val parsed = parseSecretKey(secretKeyText)) {
        is CryptoResult.Err -> return parsed
        is CryptoResult.Ok -> parsed.value
    }

    try {
        val challenge = when (val result = api.loginBegin(session.email)) {
            is ApiResult.Err -> return cryptoError()
            is ApiResult.Ok -> result.value
        }

        val oldParams = Argon2Params(
            memoryKiB = challenge.memoryKiB,
            iterations = challenge.iterations,
            parallelism = challenge.parallelism,
            hashLength = challenge.hashLength,
        )

        if (validateArgon2Params(oldParams) is CryptoResult.Err) return cryptoError()

        val oldSalt = when (val decoded = base64UrlToBytes(challenge.accountSaltBase64Url)) {
            is CryptoResult.Err -> return decoded
            is CryptoResult.Ok -> decoded.value
        }

        val currentKeys = when (val derived = deriveWith(currentMasterPassword, secretKey, oldSalt, oldParams)) {
            is CryptoResult.Err -> return derived
            is CryptoResult.Ok -> derived.value
        }

        try {
            val matches = session.withAccountKeys { sessionAuthKey, _ ->
                constantTimeEquals(currentKeys.authKey, sessionAuthKey)
            }
            if (!matches) return err(CryptoFailure.INVALID_PARAMETER)

            val newSalt = when (val generated = randomBytes(ACCOUNT_SALT_BYTES)) {
                is CryptoResult.Err -> return generated
                is CryptoResult.Ok -> generated.value
            }

            val newParams = Argon2Params()

            val newKeys = when (val derived = deriveWith(newMasterPassword, secretKey, newSalt, newParams)) {
                is CryptoResult.Err -> { wipe(newSalt); return derived }
                is CryptoResult.Ok -> derived.value
            }

            try {
                val bundles = JSONArray()

                for (vaultId in session.vaultIds()) {
                    val aad = buildVaultKeyAad(vaultId).toByteArray(Charsets.UTF_8)

                    val wrapped = session.withVaultKey(vaultId) { vaultKey ->
                        sealToEnvelope(newKeys.wrappingKey, vaultKey, aad)
                    } ?: return cryptoError()

                    when (wrapped) {
                        is CryptoResult.Err -> return wrapped
                        is CryptoResult.Ok -> bundles.put(
                            JSONObject()
                                .put("vaultId", vaultId)
                                .put("wrappedVaultKey", envelopeToJson(wrapped.value)),
                        )
                    }
                }

                if (bundles.length() == 0) return cryptoError()

                val body = JSONObject()
                    .put("currentAuthKey", encodeAuthKey(currentKeys.authKey))
                    .put("newAccountSalt", bytesToBase64Url(newSalt))
                    .put(
                        "newArgon2",
                        JSONObject()
                            .put("memoryKiB", newParams.memoryKiB)
                            .put("iterations", newParams.iterations)
                            .put("parallelism", newParams.parallelism)
                            .put("hashLength", newParams.hashLength),
                    )
                    .put("newAuthKey", encodeAuthKey(newKeys.authKey))
                    .put("rewrappedVaults", bundles)

                when (api.changePassword(body, session.accessToken())) {
                    is ApiResult.Err -> return cryptoError()
                    is ApiResult.Ok -> Unit
                }

                return Session.resume(api, session.email, newKeys.authKey, newKeys.wrappingKey)
            } finally {
                wipe(newKeys.authKey)
                wipe(newKeys.wrappingKey)
                wipe(newSalt)
            }
        } finally {
            wipe(currentKeys.authKey)
            wipe(currentKeys.wrappingKey)
        }
    } finally {
        wipe(secretKey)
    }
}

private fun deriveWith(
    masterPassword: String,
    secretKey: ByteArray,
    salt: ByteArray,
    params: Argon2Params,
): CryptoResult<com.kunjae.crypto.AccountKeys> {
    val passwordBytes = when (val encoded = utf8ToBytes(masterPassword)) {
        is CryptoResult.Err -> return encoded
        is CryptoResult.Ok -> encoded.value
    }

    return try {
        unlockAccount(passwordBytes, secretKey, salt, params)
    } finally {
        wipe(passwordBytes)
    }
}
