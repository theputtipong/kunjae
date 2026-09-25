package com.kunjae.client

import com.kunjae.crypto.CryptoFailure
import com.kunjae.crypto.CryptoResult
import com.kunjae.crypto.Envelope
import com.kunjae.crypto.base64UrlToBytes
import com.kunjae.crypto.err
import com.kunjae.crypto.ok
import org.json.JSONArray
import org.json.JSONObject

private const val ULID_LENGTH = 26
private const val MIN_ACCOUNT_SALT_BYTES = 16
private const val AUTH_KEY_BYTES = 32

private fun JSONObject.requireString(key: String, maxLength: Int): CryptoResult<String> {
    val value = optString(key, "")
    if (value.isEmpty() || value.length > maxLength) return err(CryptoFailure.INVALID_FORMAT)
    return ok(value)
}

private fun JSONObject.requireUlid(key: String): CryptoResult<String> {
    val value = optString(key, "")
    if (value.length != ULID_LENGTH) return err(CryptoFailure.INVALID_FORMAT)
    if (!value.all { it in '0'..'9' || (it in 'A'..'Z' && it !in "ILOU") }) {
        return err(CryptoFailure.INVALID_FORMAT)
    }
    return ok(value)
}

private fun JSONObject.requireBase64Url(
    key: String,
    minBytes: Int,
    maxBytes: Int,
): CryptoResult<String> {
    val text = optString(key, "")
    if (text.isEmpty()) return err(CryptoFailure.INVALID_FORMAT)

    return when (val decoded = base64UrlToBytes(text)) {
        is CryptoResult.Err -> err(CryptoFailure.INVALID_FORMAT)
        is CryptoResult.Ok ->
            if (decoded.value.size < minBytes || decoded.value.size > maxBytes) {
                err(CryptoFailure.INVALID_LENGTH)
            } else {
                ok(text)
            }
    }
}

fun parseEnvelopeObject(json: JSONObject?): CryptoResult<Envelope> {
    if (json == null) return err(CryptoFailure.INVALID_FORMAT)

    if (json.optInt("v", -1) != 1) return err(CryptoFailure.UNSUPPORTED_ALGORITHM)
    if (json.optString("alg", "") != "A256GCM") return err(CryptoFailure.UNSUPPORTED_ALGORITHM)

    val nonce = json.requireBase64Url("n", 12, 12)
    if (nonce is CryptoResult.Err) return nonce

    val ciphertext = json.requireBase64Url("ct", 1, 65_536)
    if (ciphertext is CryptoResult.Err) return ciphertext

    return ok(
        Envelope(
            version = 1,
            algorithm = "A256GCM",
            nonce = (nonce as CryptoResult.Ok).value,
            ciphertext = (ciphertext as CryptoResult.Ok).value,
        ),
    )
}

fun envelopeToJson(envelope: Envelope): JSONObject =
    JSONObject()
        .put("v", envelope.version)
        .put("alg", envelope.algorithm)
        .put("n", envelope.nonce)
        .put("ct", envelope.ciphertext)

data class KdfChallenge(
    val accountSaltBase64Url: String,
    val memoryKiB: Int,
    val iterations: Int,
    val parallelism: Int,
    val hashLength: Int,
)

fun parseKdfChallenge(body: String): CryptoResult<KdfChallenge> = try {
    val json = JSONObject(body)

    val salt = json.requireBase64Url("accountSalt", MIN_ACCOUNT_SALT_BYTES, 64)
    if (salt is CryptoResult.Err) return salt

    val argon2 = json.optJSONObject("argon2") ?: return err(CryptoFailure.INVALID_FORMAT)

    ok(
        KdfChallenge(
            accountSaltBase64Url = (salt as CryptoResult.Ok).value,
            memoryKiB = argon2.optInt("memoryKiB", 0),
            iterations = argon2.optInt("iterations", 0),
            parallelism = argon2.optInt("parallelism", 0),
            hashLength = argon2.optInt("hashLength", 0),
        ),
    )
} catch (_: Exception) {
    err(CryptoFailure.INVALID_FORMAT)
}

data class VaultKeyBundle(val vaultId: String, val wrappedVaultKey: Envelope)

data class LoginResult(
    val accountId: String,
    val token: String,
    val tokenExpiresAtIso: String,
    val vaults: List<VaultKeyBundle>,
)

fun parseLoginResult(body: String): CryptoResult<LoginResult> = try {
    val json = JSONObject(body)

    val accountId = json.requireUlid("accountId")
    if (accountId is CryptoResult.Err) return accountId

    val tokenObject = json.optJSONObject("accessToken") ?: return err(CryptoFailure.INVALID_FORMAT)
    val token = tokenObject.requireString("token", 4096)
    if (token is CryptoResult.Err) return token

    val expiresAt = tokenObject.requireString("expiresAt", 64)
    if (expiresAt is CryptoResult.Err) return expiresAt

    val vaultsArray = json.optJSONArray("vaults") ?: return err(CryptoFailure.INVALID_FORMAT)
    val vaults = parseVaultBundles(vaultsArray)
    if (vaults is CryptoResult.Err) return vaults

    ok(
        LoginResult(
            accountId = (accountId as CryptoResult.Ok).value,
            token = (token as CryptoResult.Ok).value,
            tokenExpiresAtIso = (expiresAt as CryptoResult.Ok).value,
            vaults = (vaults as CryptoResult.Ok).value,
        ),
    )
} catch (_: Exception) {
    err(CryptoFailure.INVALID_FORMAT)
}

private fun parseVaultBundles(array: JSONArray): CryptoResult<List<VaultKeyBundle>> {
    val out = mutableListOf<VaultKeyBundle>()

    for (i in 0 until array.length()) {
        val item = array.optJSONObject(i) ?: return err(CryptoFailure.INVALID_FORMAT)

        val vaultId = item.requireUlid("vaultId")
        if (vaultId is CryptoResult.Err) return vaultId

        val wrapped = parseEnvelopeObject(item.optJSONObject("wrappedVaultKey"))
        if (wrapped is CryptoResult.Err) return wrapped

        out.add(
            VaultKeyBundle(
                (vaultId as CryptoResult.Ok).value,
                (wrapped as CryptoResult.Ok).value,
            ),
        )
    }

    return ok(out)
}

data class VaultRecord(
    val vaultId: String,
    val version: Int,
    val wrappedVaultKey: Envelope,
    val metadata: Envelope,
)

data class ItemRecord(
    val itemId: String,
    val vaultId: String,
    val version: Int,
    val deleted: Boolean,
    val envelope: Envelope?,
)

data class SyncPage(
    val vaults: List<VaultRecord>,
    val items: List<ItemRecord>,
    val revision: Int,
    val hasMore: Boolean,
)

fun parseSyncPage(body: String): CryptoResult<SyncPage> = try {
    val json = JSONObject(body)

    val vaultsArray = json.optJSONArray("vaults") ?: return err(CryptoFailure.INVALID_FORMAT)
    val vaults = mutableListOf<VaultRecord>()

    for (i in 0 until vaultsArray.length()) {
        val row = vaultsArray.optJSONObject(i) ?: return err(CryptoFailure.INVALID_FORMAT)

        val vaultId = row.requireUlid("vaultId")
        if (vaultId is CryptoResult.Err) return vaultId

        val wrapped = parseEnvelopeObject(row.optJSONObject("wrappedVaultKey"))
        if (wrapped is CryptoResult.Err) return wrapped

        val metadata = parseEnvelopeObject(row.optJSONObject("metadata"))
        if (metadata is CryptoResult.Err) return metadata

        vaults.add(
            VaultRecord(
                vaultId = (vaultId as CryptoResult.Ok).value,
                version = row.optInt("version", 0),
                wrappedVaultKey = (wrapped as CryptoResult.Ok).value,
                metadata = (metadata as CryptoResult.Ok).value,
            ),
        )
    }

    val itemsArray = json.optJSONArray("items") ?: return err(CryptoFailure.INVALID_FORMAT)
    val items = mutableListOf<ItemRecord>()

    for (i in 0 until itemsArray.length()) {
        val row = itemsArray.optJSONObject(i) ?: return err(CryptoFailure.INVALID_FORMAT)

        val itemId = row.requireUlid("itemId")
        if (itemId is CryptoResult.Err) return itemId

        val vaultId = row.requireUlid("vaultId")
        if (vaultId is CryptoResult.Err) return vaultId

        val deleted = row.optBoolean("deleted", false)

        val envelope = if (deleted) {
            if (row.has("envelope")) return err(CryptoFailure.INVALID_FORMAT)
            null
        } else {
            when (val parsed = parseEnvelopeObject(row.optJSONObject("envelope"))) {
                is CryptoResult.Err -> return parsed
                is CryptoResult.Ok -> parsed.value
            }
        }

        items.add(
            ItemRecord(
                itemId = (itemId as CryptoResult.Ok).value,
                vaultId = (vaultId as CryptoResult.Ok).value,
                version = row.optInt("version", 0),
                deleted = deleted,
                envelope = envelope,
            ),
        )
    }

    ok(
        SyncPage(
            vaults = vaults,
            items = items,
            revision = json.optInt("revision", -1).takeIf { it >= 0 }
                ?: return err(CryptoFailure.INVALID_FORMAT),
            hasMore = json.optBoolean("hasMore", false),
        ),
    )
} catch (_: Exception) {
    err(CryptoFailure.INVALID_FORMAT)
}

data class PushResult(val appliedVersions: Map<String, Int>, val conflicts: Set<String>, val revision: Int)

fun parsePushResult(body: String): CryptoResult<PushResult> = try {
    val json = JSONObject(body)

    val applied = mutableMapOf<String, Int>()
    val appliedArray = json.optJSONArray("applied") ?: return err(CryptoFailure.INVALID_FORMAT)
    for (i in 0 until appliedArray.length()) {
        val row = appliedArray.optJSONObject(i) ?: return err(CryptoFailure.INVALID_FORMAT)
        applied[row.optString("itemId", "")] = row.optInt("version", 0)
    }

    val conflicts = mutableSetOf<String>()
    val conflictArray = json.optJSONArray("conflicts") ?: return err(CryptoFailure.INVALID_FORMAT)
    for (i in 0 until conflictArray.length()) {
        val row = conflictArray.optJSONObject(i) ?: return err(CryptoFailure.INVALID_FORMAT)
        conflicts.add(row.optString("itemId", ""))
    }

    ok(PushResult(applied, conflicts, json.optInt("revision", 0)))
} catch (_: Exception) {
    err(CryptoFailure.INVALID_FORMAT)
}

fun isValidAuthKey(base64Url: String): Boolean =
    when (val decoded = base64UrlToBytes(base64Url)) {
        is CryptoResult.Err -> false
        is CryptoResult.Ok -> decoded.value.size == AUTH_KEY_BYTES
    }
