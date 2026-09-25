package com.kunjae.client

import com.kunjae.crypto.CryptoFailure
import com.kunjae.crypto.CryptoResult
import com.kunjae.crypto.Envelope
import com.kunjae.crypto.buildItemAad
import com.kunjae.crypto.buildVaultKeyAad
import com.kunjae.crypto.buildVaultMetaAad
import com.kunjae.crypto.err
import com.kunjae.crypto.ok
import com.kunjae.crypto.openFromEnvelope
import com.kunjae.crypto.randomBytes
import com.kunjae.crypto.sealToEnvelope
import com.kunjae.crypto.wipe
import org.json.JSONArray
import org.json.JSONObject

private const val VAULT_KEY_BYTES = 32
private const val FIRST_VERSION = 1

data class CustomField(val name: String, val value: String, val hidden: Boolean) {
    override fun toString(): String = "CustomField(***)"
}

sealed interface VaultItem {
    val title: String
    val notes: String
    val favorite: Boolean
    val createdAt: String
    val updatedAt: String

    val tags: List<String>
    val customFields: List<CustomField>

    val typeName: String
}

data class LoginItem(
    override val title: String,
    val username: String,
    val password: String,
    val urls: List<String> = emptyList(),
    val totpSecret: String = "",
    override val notes: String = "",
    override val favorite: Boolean = false,
    override val tags: List<String> = emptyList(),
    override val customFields: List<CustomField> = emptyList(),
    override val createdAt: String,
    override val updatedAt: String,
) : VaultItem {
    override fun toString(): String = "LoginItem(***)"
    override val typeName: String get() = "login"
}

data class SecureNoteItem(
    override val title: String,
    override val notes: String = "",
    override val favorite: Boolean = false,
    override val tags: List<String> = emptyList(),
    override val customFields: List<CustomField> = emptyList(),
    override val createdAt: String,
    override val updatedAt: String,
) : VaultItem {
    override fun toString(): String = "SecureNoteItem(***)"
    override val typeName: String get() = "secure-note"
}

data class CardItem(
    override val title: String,
    val cardholderName: String = "",
    val number: String = "",
    val expiryMonth: String = "",
    val expiryYear: String = "",
    val securityCode: String = "",
    override val notes: String = "",
    override val favorite: Boolean = false,
    override val tags: List<String> = emptyList(),
    override val customFields: List<CustomField> = emptyList(),
    override val createdAt: String,
    override val updatedAt: String,
) : VaultItem {
    override fun toString(): String = "CardItem(***)"
    override val typeName: String get() = "card"
}

data class VaultMetadata(val name: String, val icon: String, val color: String)

fun itemToJson(item: VaultItem): JSONObject {
    val json = JSONObject()
        .put("type", item.typeName)
        .put("title", item.title)
        .put("notes", item.notes)
        .put("tags", item.tags.fold(JSONArray()) { acc, tag -> acc.put(tag) })
        .put("favorite", item.favorite)
        .put(
            "customFields",
            item.customFields.fold(JSONArray()) { acc, field ->
                acc.put(
                    JSONObject()
                        .put("name", field.name)
                        .put("value", field.value)
                        .put("hidden", field.hidden),
                )
            },
        )
        .put("createdAt", item.createdAt)
        .put("updatedAt", item.updatedAt)

    return when (item) {
        is LoginItem -> json
            .put("username", item.username)
            .put("password", item.password)
            .put("urls", item.urls.fold(JSONArray()) { acc, url -> acc.put(url) })
            .put("totpSecret", item.totpSecret)

        is SecureNoteItem -> json

        is CardItem -> json
            .put("cardholderName", item.cardholderName)
            .put("number", item.number)
            .put("expiryMonth", item.expiryMonth)
            .put("expiryYear", item.expiryYear)
            .put("securityCode", item.securityCode)
    }
}

fun itemFromJson(json: JSONObject): CryptoResult<VaultItem> {
    val title = json.optString("title", "")
    val notes = json.optString("notes", "")
    val favorite = json.optBoolean("favorite", false)
    val createdAt = json.optString("createdAt", "")
    val updatedAt = json.optString("updatedAt", "")

    val tagsArray = json.optJSONArray("tags") ?: JSONArray()
    val tags = buildList { for (i in 0 until tagsArray.length()) add(tagsArray.optString(i, "")) }

    val fieldsArray = json.optJSONArray("customFields") ?: JSONArray()
    val customFields = buildList {
        for (i in 0 until fieldsArray.length()) {
            val field = fieldsArray.optJSONObject(i) ?: continue
            add(
                CustomField(
                    name = field.optString("name", ""),
                    value = field.optString("value", ""),
                    hidden = field.optBoolean("hidden", false),
                ),
            )
        }
    }

    return when (json.optString("type", "")) {
        "login" -> {
            val urlsArray = json.optJSONArray("urls") ?: JSONArray()
            val urls = buildList {
                for (i in 0 until urlsArray.length()) add(urlsArray.optString(i, ""))
            }

            ok(
                LoginItem(
                    title = title,
                    username = json.optString("username", ""),
                    password = json.optString("password", ""),
                    urls = urls,
                    totpSecret = json.optString("totpSecret", ""),
                    notes = notes,
                    favorite = favorite,
                    tags = tags,
                    customFields = customFields,
                    createdAt = createdAt,
                    updatedAt = updatedAt,
                ),
            )
        }

        "secure-note" -> ok(
            SecureNoteItem(
                title = title,
                notes = notes,
                favorite = favorite,
                tags = tags,
                customFields = customFields,
                createdAt = createdAt,
                updatedAt = updatedAt,
            ),
        )

        "card" -> ok(
            CardItem(
                title = title,
                cardholderName = json.optString("cardholderName", ""),
                number = json.optString("number", ""),
                expiryMonth = json.optString("expiryMonth", ""),
                expiryYear = json.optString("expiryYear", ""),
                securityCode = json.optString("securityCode", ""),
                notes = notes,
                favorite = favorite,
                tags = tags,
                customFields = customFields,
                createdAt = createdAt,
                updatedAt = updatedAt,
            ),
        )

        else -> err(CryptoFailure.INVALID_FORMAT)
    }
}

data class CreatedVault(
    val vaultId: String,
    val wrappedVaultKey: Envelope,
    val metadata: Envelope,
    val vaultKey: ByteArray,
) {
    override fun equals(other: Any?): Boolean = this === other
    override fun hashCode(): Int = System.identityHashCode(this)
}

fun createVault(
    wrappingKey: ByteArray,
    vaultId: String,
    metadata: VaultMetadata,
    nowIso: String,
): CryptoResult<CreatedVault> {
    val vaultKey = when (val generated = randomBytes(VAULT_KEY_BYTES)) {
        is CryptoResult.Err -> return generated
        is CryptoResult.Ok -> generated.value
    }

    val wrapped = sealToEnvelope(
        wrappingKey,
        vaultKey,
        buildVaultKeyAad(vaultId).toByteArray(Charsets.UTF_8),
    )
    if (wrapped is CryptoResult.Err) {
        wipe(vaultKey)
        return wrapped
    }

    val metaJson = JSONObject()
        .put("name", metadata.name)
        .put("icon", metadata.icon)
        .put("color", metadata.color)
        .put("createdAt", nowIso)
        .put("updatedAt", nowIso)

    val sealedMeta = sealToEnvelope(
        vaultKey,
        metaJson.toString().toByteArray(Charsets.UTF_8),
        buildVaultMetaAad(vaultId, FIRST_VERSION).toByteArray(Charsets.UTF_8),
    )
    if (sealedMeta is CryptoResult.Err) {
        wipe(vaultKey)
        return sealedMeta
    }

    return ok(
        CreatedVault(
            vaultId = vaultId,
            wrappedVaultKey = (wrapped as CryptoResult.Ok).value,
            metadata = (sealedMeta as CryptoResult.Ok).value,
            vaultKey = vaultKey,
        ),
    )
}

fun openVaultMetadata(
    vaultKey: ByteArray,
    record: VaultRecord,
): CryptoResult<VaultMetadata> {
    val aad = buildVaultMetaAad(record.vaultId, record.version).toByteArray(Charsets.UTF_8)

    return when (val plaintext = openFromEnvelope(vaultKey, record.metadata, aad)) {
        is CryptoResult.Err -> plaintext
        is CryptoResult.Ok -> try {
            val json = JSONObject(String(plaintext.value, Charsets.UTF_8))
            ok(
                VaultMetadata(
                    name = json.optString("name", ""),
                    icon = json.optString("icon", ""),
                    color = json.optString("color", ""),
                ),
            )
        } catch (_: Exception) {
            err(CryptoFailure.INVALID_FORMAT)
        }
    }
}

fun sealItem(
    vaultKey: ByteArray,
    itemId: String,
    newVersion: Int,
    item: VaultItem,
): CryptoResult<Envelope> = sealToEnvelope(
    vaultKey,
    itemToJson(item).toString().toByteArray(Charsets.UTF_8),
    buildItemAad(itemId, newVersion).toByteArray(Charsets.UTF_8),
)

fun openItem(vaultKey: ByteArray, record: ItemRecord): CryptoResult<VaultItem> {
    val envelope = record.envelope ?: return err(CryptoFailure.INVALID_FORMAT)
    val aad = buildItemAad(record.itemId, record.version).toByteArray(Charsets.UTF_8)

    return when (val plaintext = openFromEnvelope(vaultKey, envelope, aad)) {
        is CryptoResult.Err -> plaintext
        is CryptoResult.Ok -> try {
            itemFromJson(JSONObject(String(plaintext.value, Charsets.UTF_8)))
        } catch (_: Exception) {
            err(CryptoFailure.INVALID_FORMAT)
        }
    }
}

fun itemChangeJson(
    itemId: String,
    vaultId: String,
    baseVersion: Int,
    envelope: Envelope?,
): JSONObject {
    val json = JSONObject()
        .put("itemId", itemId)
        .put("vaultId", vaultId)
        .put("baseVersion", baseVersion)
        .put("version", baseVersion + 1)
        .put("deleted", envelope == null)

    if (envelope != null) json.put("envelope", envelopeToJson(envelope))

    return json
}
