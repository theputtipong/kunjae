package com.kunjae.client

import com.kunjae.crypto.Argon2Params
import com.kunjae.crypto.CryptoFailure
import com.kunjae.crypto.CryptoResult
import com.kunjae.crypto.Envelope
import com.kunjae.crypto.base64UrlToBytes
import com.kunjae.crypto.buildVaultKeyAad
import com.kunjae.crypto.bytesToBase64Url
import com.kunjae.crypto.constantTimeEquals
import com.kunjae.crypto.deriveKeyFromPassword
import com.kunjae.crypto.err
import com.kunjae.crypto.hkdfSha256
import com.kunjae.crypto.ok
import com.kunjae.crypto.openFromEnvelope
import com.kunjae.crypto.randomBytes
import com.kunjae.crypto.sealToEnvelope
import com.kunjae.crypto.utf8ToBytes
import com.kunjae.crypto.validateArgon2Params
import com.kunjae.crypto.wipe
import org.json.JSONArray
import org.json.JSONObject

interface LocalStore {
    fun read(): ByteArray?
    fun write(bytes: ByteArray)
    fun clear()
}

const val LOCAL_MIN_PASSWORD_LENGTH = 12

private const val LOCAL_FORMAT = "kunjae.local.v1"
private const val LOCAL_WRAP_INFO = "kunjae.local.wrap.v1"
private const val LOCAL_SALT_BYTES = 32
private const val LOCAL_KEY_BYTES = 32
private const val MAX_LOCAL_RECORDS = 100_000

private data class LocalFile(
    val salt: ByteArray,
    val params: Argon2Params,
    val vaults: List<VaultRecord>,
    val items: List<ItemRecord>,
) {
    override fun toString(): String = "LocalFile(***)"
    override fun equals(other: Any?): Boolean = this === other
    override fun hashCode(): Int = System.identityHashCode(this)
}

class LocalVault private constructor(
    private val store: LocalStore,
    private var file: LocalFile,
    private val wrappingKey: ByteArray,
    private val vaultKeys: MutableMap<String, ByteArray>,
) {
    companion object {
        fun exists(store: LocalStore): Boolean = runCatching { store.read() != null }.getOrDefault(false)

        fun peekItemCount(store: LocalStore): Int? {
            val bytes = runCatching { store.read() }.getOrNull() ?: return null
            return when (val parsed = parseFile(bytes)) {
                is CryptoResult.Err -> null
                is CryptoResult.Ok -> parsed.value.items.size
            }
        }

        fun create(
            store: LocalStore,
            masterPassword: String,
            vaultName: String = "Personal",
            nowMs: Long = System.currentTimeMillis(),
        ): CryptoResult<LocalVault> {
            if (masterPassword.length < LOCAL_MIN_PASSWORD_LENGTH) return err(CryptoFailure.INVALID_PARAMETER)
            if (exists(store)) return err(CryptoFailure.INVALID_PARAMETER)

            val salt = when (val generated = randomBytes(LOCAL_SALT_BYTES)) {
                is CryptoResult.Err -> return generated
                is CryptoResult.Ok -> generated.value
            }
            val params = Argon2Params()

            val wrappingKey = when (val derived = deriveWrappingKey(masterPassword, salt, params)) {
                is CryptoResult.Err -> return derived
                is CryptoResult.Ok -> derived.value
            }

            val vaultId = when (val generated = createUlid(nowMs)) {
                is CryptoResult.Err -> { wipe(wrappingKey); return generated }
                is CryptoResult.Ok -> generated.value
            }

            val created = when (
                val result = createVault(
                    wrappingKey,
                    vaultId,
                    VaultMetadata(vaultName, "", ""),
                    isoInstant(nowMs),
                )
            ) {
                is CryptoResult.Err -> { wipe(wrappingKey); return result }
                is CryptoResult.Ok -> result.value
            }

            val file = LocalFile(
                salt = salt,
                params = params,
                vaults = listOf(VaultRecord(vaultId, 1, created.wrappedVaultKey, created.metadata)),
                items = emptyList(),
            )

            val vault = LocalVault(store, file, wrappingKey, mutableMapOf(vaultId to created.vaultKey))
            if (!vault.persist(file)) {
                vault.lock()
                return err(CryptoFailure.ENCRYPTION_FAILED)
            }
            return ok(vault)
        }

        fun unlock(store: LocalStore, masterPassword: String): CryptoResult<LocalVault> {
            val file = when (val loaded = load(store)) {
                is CryptoResult.Err -> return loaded
                is CryptoResult.Ok -> loaded.value
            }

            val wrappingKey = when (val derived = deriveWrappingKey(masterPassword, file.salt, file.params)) {
                is CryptoResult.Err -> return derived
                is CryptoResult.Ok -> derived.value
            }

            return open(store, file, wrappingKey)
        }

        fun resume(store: LocalStore, wrappingKey: ByteArray): CryptoResult<LocalVault> {
            if (wrappingKey.size != LOCAL_KEY_BYTES) return err(CryptoFailure.INVALID_LENGTH)

            val file = when (val loaded = load(store)) {
                is CryptoResult.Err -> return loaded
                is CryptoResult.Ok -> loaded.value
            }

            return open(store, file, wrappingKey.copyOf())
        }

        private fun open(store: LocalStore, file: LocalFile, wrappingKey: ByteArray): CryptoResult<LocalVault> {
            return when (val keys = unwrapAll(wrappingKey, file.vaults)) {
                is CryptoResult.Err -> { wipe(wrappingKey); keys }
                is CryptoResult.Ok -> ok(LocalVault(store, file, wrappingKey, keys.value))
            }
        }

        private fun load(store: LocalStore): CryptoResult<LocalFile> {
            val bytes = runCatching { store.read() }.getOrNull() ?: return err(CryptoFailure.INVALID_FORMAT)
            return parseFile(bytes)
        }

        private fun unwrapAll(
            wrappingKey: ByteArray,
            vaults: List<VaultRecord>,
        ): CryptoResult<MutableMap<String, ByteArray>> {
            val keys = mutableMapOf<String, ByteArray>()
            for (record in vaults) {
                val aad = buildVaultKeyAad(record.vaultId).toByteArray(Charsets.UTF_8)
                when (val unwrapped = openFromEnvelope(wrappingKey, record.wrappedVaultKey, aad)) {
                    is CryptoResult.Err -> {
                        for (key in keys.values) wipe(key)
                        return err(CryptoFailure.DECRYPTION_FAILED)
                    }
                    is CryptoResult.Ok -> keys[record.vaultId] = unwrapped.value
                }
            }
            return ok(keys)
        }

        private fun deriveWrappingKey(
            masterPassword: String,
            salt: ByteArray,
            params: Argon2Params,
        ): CryptoResult<ByteArray> {
            val passwordBytes = when (val encoded = utf8ToBytes(masterPassword)) {
                is CryptoResult.Err -> return encoded
                is CryptoResult.Ok -> encoded.value
            }

            val stretched = try {
                when (val derived = deriveKeyFromPassword(passwordBytes, salt, params)) {
                    is CryptoResult.Err -> return derived
                    is CryptoResult.Ok -> derived.value
                }
            } finally {
                wipe(passwordBytes)
            }

            return try {
                hkdfSha256(stretched, salt, LOCAL_WRAP_INFO.toByteArray(Charsets.UTF_8), LOCAL_KEY_BYTES)
            } finally {
                wipe(stretched)
            }
        }

        private fun parseFile(bytes: ByteArray): CryptoResult<LocalFile> = try {
            val json = JSONObject(String(bytes, Charsets.UTF_8))
            if (json.getString("format") != LOCAL_FORMAT) throw IllegalArgumentException()

            val salt = when (val decoded = base64UrlToBytes(json.getString("salt"))) {
                is CryptoResult.Err -> throw IllegalArgumentException()
                is CryptoResult.Ok -> decoded.value
            }
            if (salt.size != LOCAL_SALT_BYTES) throw IllegalArgumentException()

            val argon = json.getJSONObject("argon2")
            val params = Argon2Params(
                memoryKiB = argon.getInt("memoryKiB"),
                iterations = argon.getInt("iterations"),
                parallelism = argon.getInt("parallelism"),
                hashLength = argon.getInt("hashLength"),
            )
            if (validateArgon2Params(params) is CryptoResult.Err) throw IllegalArgumentException()

            val vaultArray = json.getJSONArray("vaults")
            val itemArray = json.getJSONArray("items")
            if (vaultArray.length() == 0 || vaultArray.length() > MAX_LOCAL_RECORDS) throw IllegalArgumentException()
            if (itemArray.length() > MAX_LOCAL_RECORDS) throw IllegalArgumentException()

            val vaults = buildList {
                for (i in 0 until vaultArray.length()) {
                    val record = vaultArray.getJSONObject(i)
                    add(
                        VaultRecord(
                            vaultId = record.getString("vaultId"),
                            version = record.getInt("version"),
                            wrappedVaultKey = envelopeOrThrow(record.optJSONObject("wrappedVaultKey")),
                            metadata = envelopeOrThrow(record.optJSONObject("metadata")),
                        ),
                    )
                }
            }
            val vaultIds = vaults.map { it.vaultId }.toSet()
            if (vaultIds.size != vaults.size) throw IllegalArgumentException()

            val items = buildList {
                for (i in 0 until itemArray.length()) {
                    val record = itemArray.getJSONObject(i)
                    val vaultId = record.getString("vaultId")
                    if (vaultId !in vaultIds) throw IllegalArgumentException()
                    add(
                        ItemRecord(
                            itemId = record.getString("itemId"),
                            vaultId = vaultId,
                            version = record.getInt("version"),
                            deleted = false,
                            envelope = envelopeOrThrow(record.optJSONObject("envelope")),
                        ),
                    )
                }
            }
            if (items.map { it.itemId }.toSet().size != items.size) throw IllegalArgumentException()

            ok(LocalFile(salt, params, vaults, items))
        } catch (_: Exception) {
            err(CryptoFailure.INVALID_FORMAT)
        }

        private fun envelopeOrThrow(json: JSONObject?): Envelope =
            when (val parsed = parseEnvelopeObject(json)) {
                is CryptoResult.Err -> throw IllegalArgumentException()
                is CryptoResult.Ok -> parsed.value
            }

        private fun encodeFile(file: LocalFile): ByteArray {
            val vaults = JSONArray()
            for (record in file.vaults) {
                vaults.put(
                    JSONObject()
                        .put("vaultId", record.vaultId)
                        .put("version", record.version)
                        .put("wrappedVaultKey", envelopeToJson(record.wrappedVaultKey))
                        .put("metadata", envelopeToJson(record.metadata)),
                )
            }

            val items = JSONArray()
            for (record in file.items) {
                val envelope = record.envelope ?: continue
                items.put(
                    JSONObject()
                        .put("itemId", record.itemId)
                        .put("vaultId", record.vaultId)
                        .put("version", record.version)
                        .put("envelope", envelopeToJson(envelope)),
                )
            }

            return JSONObject()
                .put("format", LOCAL_FORMAT)
                .put("salt", bytesToBase64Url(file.salt))
                .put(
                    "argon2",
                    JSONObject()
                        .put("memoryKiB", file.params.memoryKiB)
                        .put("iterations", file.params.iterations)
                        .put("parallelism", file.params.parallelism)
                        .put("hashLength", file.params.hashLength),
                )
                .put("vaults", vaults)
                .put("items", items)
                .toString()
                .toByteArray(Charsets.UTF_8)
        }
    }

    private var locked = false

    override fun toString(): String = "LocalVault(***)"

    private fun persist(next: LocalFile): Boolean = runCatching {
        store.write(encodeFile(next))
        file = next
    }.isSuccess

    fun vaultIds(): Set<String> = vaultKeys.keys.toSet()

    fun itemCount(): Int = file.items.size

    fun <T> withWrappingKey(borrow: (ByteArray) -> T): T = borrow(wrappingKey)

    fun state(): CryptoResult<VaultState> {
        if (locked) return err(CryptoFailure.INVALID_PARAMETER)

        val vaults = mutableMapOf<String, VaultMetadata>()
        for (record in file.vaults) {
            val key = vaultKeys[record.vaultId] ?: return err(CryptoFailure.DECRYPTION_FAILED)
            when (val metadata = openVaultMetadata(key, record)) {
                is CryptoResult.Err -> return metadata
                is CryptoResult.Ok -> vaults[record.vaultId] = metadata.value
            }
        }

        val items = mutableMapOf<String, DecryptedItem>()
        val broken = mutableSetOf<String>()
        for (record in file.items) {
            val key = vaultKeys[record.vaultId]
            val opened = if (key == null) null else openItem(key, record)
            if (opened !is CryptoResult.Ok) {
                broken.add(record.itemId)
                continue
            }
            items[record.itemId] = DecryptedItem(record.itemId, record.vaultId, record.version, opened.value)
        }

        return ok(VaultState(vaults, items, broken, 0))
    }

    fun saveItem(itemId: String, vaultId: String, baseVersion: Int, item: VaultItem): CryptoResult<Int> {
        if (locked) return err(CryptoFailure.INVALID_PARAMETER)
        val key = vaultKeys[vaultId] ?: return err(CryptoFailure.INVALID_PARAMETER)

        val existing = file.items.firstOrNull { it.itemId == itemId }
        if ((existing?.version ?: 0) != baseVersion) return err(CryptoFailure.INVALID_PARAMETER)

        val newVersion = baseVersion + 1
        val envelope = when (val sealed = sealItem(key, itemId, newVersion, item)) {
            is CryptoResult.Err -> return sealed
            is CryptoResult.Ok -> sealed.value
        }

        val record = ItemRecord(itemId, vaultId, newVersion, false, envelope)
        val nextItems = file.items.filter { it.itemId != itemId } + record

        return if (persist(file.copy(items = nextItems))) ok(newVersion) else err(CryptoFailure.ENCRYPTION_FAILED)
    }

    fun deleteItem(itemId: String, baseVersion: Int): CryptoResult<Unit> {
        if (locked) return err(CryptoFailure.INVALID_PARAMETER)
        val existing = file.items.firstOrNull { it.itemId == itemId } ?: return err(CryptoFailure.INVALID_PARAMETER)
        if (existing.version != baseVersion) return err(CryptoFailure.INVALID_PARAMETER)

        val nextItems = file.items.filter { it.itemId != itemId }
        return if (persist(file.copy(items = nextItems))) ok(Unit) else err(CryptoFailure.ENCRYPTION_FAILED)
    }

    fun addVault(name: String, nowMs: Long = System.currentTimeMillis()): CryptoResult<String> {
        if (locked) return err(CryptoFailure.INVALID_PARAMETER)
        if (name.isBlank()) return err(CryptoFailure.INVALID_PARAMETER)

        val vaultId = when (val generated = createUlid(nowMs)) {
            is CryptoResult.Err -> return generated
            is CryptoResult.Ok -> generated.value
        }
        if (vaultKeys.containsKey(vaultId)) return err(CryptoFailure.INVALID_PARAMETER)

        val created = when (
            val result = createVault(
                wrappingKey,
                vaultId,
                VaultMetadata(name, "", ""),
                isoInstant(nowMs),
            )
        ) {
            is CryptoResult.Err -> return result
            is CryptoResult.Ok -> result.value
        }

        val record = VaultRecord(vaultId, 1, created.wrappedVaultKey, created.metadata)
        if (!persist(file.copy(vaults = file.vaults + record))) {
            wipe(created.vaultKey)
            return err(CryptoFailure.ENCRYPTION_FAILED)
        }

        vaultKeys[vaultId] = created.vaultKey
        return ok(vaultId)
    }

    fun changePassword(currentMasterPassword: String, newMasterPassword: String): CryptoResult<Unit> {
        if (locked) return err(CryptoFailure.INVALID_PARAMETER)
        if (newMasterPassword.length < LOCAL_MIN_PASSWORD_LENGTH) return err(CryptoFailure.INVALID_PARAMETER)

        val current = when (val derived = deriveWrappingKey(currentMasterPassword, file.salt, file.params)) {
            is CryptoResult.Err -> return derived
            is CryptoResult.Ok -> derived.value
        }
        val matches = try {
            constantTimeEquals(current, wrappingKey)
        } finally {
            wipe(current)
        }
        if (!matches) return err(CryptoFailure.DECRYPTION_FAILED)

        val newSalt = when (val generated = randomBytes(LOCAL_SALT_BYTES)) {
            is CryptoResult.Err -> return generated
            is CryptoResult.Ok -> generated.value
        }
        val newParams = Argon2Params()

        val newKey = when (val derived = deriveWrappingKey(newMasterPassword, newSalt, newParams)) {
            is CryptoResult.Err -> return derived
            is CryptoResult.Ok -> derived.value
        }

        try {
            val rewrapped = mutableListOf<VaultRecord>()
            for (record in file.vaults) {
                val key = vaultKeys[record.vaultId] ?: return err(CryptoFailure.DECRYPTION_FAILED)
                val aad = buildVaultKeyAad(record.vaultId).toByteArray(Charsets.UTF_8)
                when (val wrapped = sealToEnvelope(newKey, key, aad)) {
                    is CryptoResult.Err -> return wrapped
                    is CryptoResult.Ok -> rewrapped.add(record.copy(wrappedVaultKey = wrapped.value))
                }
            }

            if (!persist(file.copy(salt = newSalt, params = newParams, vaults = rewrapped))) {
                return err(CryptoFailure.ENCRYPTION_FAILED)
            }

            newKey.copyInto(wrappingKey)
            return ok(Unit)
        } finally {
            wipe(newKey)
        }
    }

    fun delete() {
        runCatching { store.clear() }
        lock()
    }

    fun lock() {
        locked = true
        wipe(wrappingKey)
        for (key in vaultKeys.values) wipe(key)
        vaultKeys.clear()
    }
}
