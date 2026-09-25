package com.kunjae.client

import com.kunjae.crypto.CryptoFailure
import com.kunjae.crypto.CryptoResult
import com.kunjae.crypto.err
import com.kunjae.crypto.ok
import com.kunjae.crypto.wipe
import org.json.JSONObject

data class DecryptedItem(
    val itemId: String,
    val vaultId: String,
    val version: Int,
    val item: VaultItem,
)

data class VaultState(
    val vaults: Map<String, VaultMetadata>,
    val items: Map<String, DecryptedItem>,
    val brokenItemIds: Set<String>,
    val revision: Int,
)

private const val MAX_PULL_ROUNDS = 100

fun pull(api: ApiClient, session: Session, since: Int = 0): CryptoResult<VaultState> {
    val vaults = mutableMapOf<String, VaultMetadata>()
    val items = mutableMapOf<String, DecryptedItem>()
    val broken = mutableSetOf<String>()

    var cursor = since

    for (round in 0 until MAX_PULL_ROUNDS) {
        val page = when (val result = api.syncPull(cursor, session.accessToken())) {
            is ApiResult.Err -> return err(CryptoFailure.INVALID_FORMAT)
            is ApiResult.Ok -> result.value
        }

        for (record in page.vaults) {
            if (session.withVaultKey(record.vaultId) { true } != true) {
                val unwrapped = session.withWrappingKey { wrappingKey ->
                    com.kunjae.crypto.openFromEnvelope(
                        wrappingKey,
                        record.wrappedVaultKey,
                        com.kunjae.crypto.buildVaultKeyAad(record.vaultId)
                            .toByteArray(Charsets.UTF_8),
                    )
                }

                when (unwrapped) {
                    is CryptoResult.Err -> return unwrapped
                    is CryptoResult.Ok -> session.addVaultKey(record.vaultId, unwrapped.value)
                }
            }

            val metadata = session.withVaultKey(record.vaultId) { key ->
                openVaultMetadata(key, record)
            } ?: return err(CryptoFailure.DECRYPTION_FAILED)

            when (metadata) {
                is CryptoResult.Err -> return metadata
                is CryptoResult.Ok -> vaults[record.vaultId] = metadata.value
            }
        }

        for (record in page.items) {
            if (record.deleted) {
                items.remove(record.itemId)
                continue
            }

            val opened = session.withVaultKey(record.vaultId) { key -> openItem(key, record) }

            if (opened == null || opened is CryptoResult.Err) {
                broken.add(record.itemId)
                continue
            }

            items[record.itemId] = DecryptedItem(
                itemId = record.itemId,
                vaultId = record.vaultId,
                version = record.version,
                item = (opened as CryptoResult.Ok).value,
            )
        }

        cursor = page.revision
        if (!page.hasMore) {
            return ok(VaultState(vaults, items, broken, cursor))
        }
    }

    return err(CryptoFailure.INVALID_FORMAT)
}

fun saveItem(
    api: ApiClient,
    session: Session,
    itemId: String,
    vaultId: String,
    baseVersion: Int,
    item: VaultItem,
): CryptoResult<Int> {
    val newVersion = baseVersion + 1

    val sealed = session.withVaultKey(vaultId) { key -> sealItem(key, itemId, newVersion, item) }
        ?: return err(CryptoFailure.DECRYPTION_FAILED)

    val envelope = when (sealed) {
        is CryptoResult.Err -> return sealed
        is CryptoResult.Ok -> sealed.value
    }

    val change = itemChangeJson(itemId, vaultId, baseVersion, envelope)

    return when (val result = api.syncPush(listOf(change), session.accessToken())) {
        is ApiResult.Err -> err(CryptoFailure.INVALID_FORMAT)
        is ApiResult.Ok ->
            if (result.value.conflicts.contains(itemId)) err(CryptoFailure.INVALID_PARAMETER)
            else ok(result.value.appliedVersions[itemId] ?: newVersion)
    }
}

fun deleteItem(
    api: ApiClient,
    session: Session,
    itemId: String,
    vaultId: String,
    baseVersion: Int,
): CryptoResult<Unit> {
    val change = itemChangeJson(itemId, vaultId, baseVersion, null)

    return when (val result = api.syncPush(listOf(change), session.accessToken())) {
        is ApiResult.Err -> err(CryptoFailure.INVALID_FORMAT)
        is ApiResult.Ok ->
            if (result.value.conflicts.contains(itemId)) err(CryptoFailure.INVALID_PARAMETER)
            else ok(Unit)
    }
}

internal fun signUpRequestJson(
    email: String,
    accountId: String,
    accountSaltBase64Url: String,
    argon2MemoryKiB: Int,
    argon2Iterations: Int,
    argon2Parallelism: Int,
    argon2HashLength: Int,
    authKeyBase64Url: String,
    vault: CreatedVault,
): JSONObject = JSONObject()
    .put("email", email)
    .put("accountId", accountId)
    .put("accountSalt", accountSaltBase64Url)
    .put(
        "argon2",
        JSONObject()
            .put("memoryKiB", argon2MemoryKiB)
            .put("iterations", argon2Iterations)
            .put("parallelism", argon2Parallelism)
            .put("hashLength", argon2HashLength),
    )
    .put("authKey", authKeyBase64Url)
    .put(
        "vault",
        JSONObject()
            .put("vaultId", vault.vaultId)
            .put("wrappedVaultKey", envelopeToJson(vault.wrappedVaultKey))
            .put("metadata", envelopeToJson(vault.metadata)),
    )

fun createNewVault(
    api: ApiClient,
    session: Session,
    name: String,
    nowMs: Long = System.currentTimeMillis(),
): CryptoResult<String> {
    if (name.isBlank()) return err(CryptoFailure.INVALID_PARAMETER)

    val vaultId = when (val generated = createUlid(nowMs)) {
        is CryptoResult.Err -> return generated
        is CryptoResult.Ok -> generated.value
    }

    val created = session.withWrappingKey { wrappingKey ->
        createVault(
            wrappingKey,
            vaultId,
            VaultMetadata(name, "", ""),
            java.time.Instant.ofEpochMilli(nowMs).toString(),
        )
    }

    val vault = when (created) {
        is CryptoResult.Err -> return created
        is CryptoResult.Ok -> created.value
    }

    val body = JSONObject().put(
        "vault",
        JSONObject()
            .put("vaultId", vault.vaultId)
            .put("wrappedVaultKey", envelopeToJson(vault.wrappedVaultKey))
            .put("metadata", envelopeToJson(vault.metadata)),
    )

    return when (api.createVault(body, session.accessToken())) {
        is ApiResult.Err -> {
            wipe(vault.vaultKey)
            cryptoError()
        }
        is ApiResult.Ok -> {
            session.addVaultKey(vault.vaultId, vault.vaultKey)
            ok(vaultId)
        }
    }
}
