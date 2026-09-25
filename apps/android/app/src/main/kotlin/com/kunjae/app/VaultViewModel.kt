package com.kunjae.app

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kunjae.client.DecryptedItem
import com.kunjae.client.Session
import com.kunjae.client.VaultState
import com.kunjae.client.CardItem
import com.kunjae.client.LoginItem
import com.kunjae.client.SecureNoteItem
import com.kunjae.client.VaultItem
import com.kunjae.client.PasswordOptions
import com.kunjae.client.changeMasterPassword
import com.kunjae.client.createNewVault
import com.kunjae.client.createUlid
import com.kunjae.client.deleteItem
import com.kunjae.client.generatePassword
import com.kunjae.client.pull
import com.kunjae.client.saveItem
import com.kunjae.crypto.CryptoResult
import com.kunjae.crypto.TotpCode
import com.kunjae.crypto.totpFromSecretText
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class VaultViewModel : ViewModel() {

    data class UiState(
        val unlocked: Boolean = false,
        val busy: Boolean = false,
        val message: String? = null,
        val email: String = "",
        val vaults: List<VaultRow> = emptyList(),

        val activeVaultId: String? = null,
        val items: List<ItemRow> = emptyList(),

        val remembered: Boolean = false,
    )

    data class VaultRow(val vaultId: String, val name: String, val itemCount: Int)

    data class ItemRow(
        val itemId: String,
        val title: String,
        val subtitle: String,
        val typeName: String,
        val editable: Boolean,
        val vaultId: String,
        val hasTotp: Boolean = false,
    )

    data class PlainField(val label: String, val value: String)

    data class RevealedItem(val label: String, val value: String, val extra: String?) {
        override fun toString(): String = "RevealedItem(***)"
    }

    private val session: Session? get() = SessionHolder.active()

    private var state: VaultState? = null

    private val api = ApiClientHolder.api

    var uiState: UiState = UiState()
        private set

    private var onChange: (() -> Unit)? = null

    fun observe(listener: () -> Unit) {
        onChange = listener
    }

    fun checkRemembered(context: Context) {
        val found = BiometricVault.hasRemembered(context)
        if (found != uiState.remembered) update(uiState.copy(remembered = found))
    }

    private fun update(next: UiState) {
        uiState = next
        onChange?.invoke()
    }

    fun unlock(email: String, masterPassword: String, secretKeyText: String) {
        update(uiState.copy(busy = true, message = null))

        viewModelScope.launch {
            val result = withContext(Dispatchers.Default) {
                Session.unlock(api, email, masterPassword, secretKeyText)
            }

            when (result) {
                is CryptoResult.Err -> update(
                    uiState.copy(
                        busy = false,
                        message = "ปลดล็อกไม่สำเร็จ — ตรวจสอบอีเมล รหัสผ่าน และ Secret Key",
                    ),
                )

                is CryptoResult.Ok -> {
                    SessionHolder.open(result.value)
                    refresh(email)
                }
            }
        }
    }

    fun resumeFromBiometric(context: Context, cipher: javax.crypto.Cipher) {
        update(uiState.copy(busy = true, message = null))

        viewModelScope.launch {
            val recalled = withContext(Dispatchers.Default) {
                BiometricVault.finishRecall(context, cipher)
            }

            if (recalled == null) {
                update(
                    uiState.copy(
                        busy = false,
                        remembered = false,
                        message = "ข้อมูลที่จำไว้ใช้ไม่ได้แล้ว — กรุณาปลดล็อกด้วยรหัสผ่านหลัก",
                    ),
                )
                return@launch
            }

            val result = try {
                withContext(Dispatchers.IO) {
                    Session.resume(api, recalled.email, recalled.authKey, recalled.wrappingKey)
                }
            } finally {
                recalled.wipe()
            }

            when (result) {
                is CryptoResult.Err -> update(
                    uiState.copy(busy = false, message = "กลับเข้าใช้งานไม่สำเร็จ — ลองปลดล็อกด้วยรหัสผ่านหลัก"),
                )
                is CryptoResult.Ok -> {
                    SessionHolder.open(result.value)
                    refresh(recalled.email, remembered = true)
                }
            }
        }
    }

    fun rememberSession(context: Context, cipher: javax.crypto.Cipher) {
        val active = session ?: return

        val saved = active.withAccountKeys { authKey, wrappingKey ->
            BiometricVault.finishRemember(context, cipher, uiState.email, authKey, wrappingKey)
        }

        update(
            uiState.copy(
                remembered = saved,
                message = if (saved) "จำไว้แล้ว — ครั้งต่อไปใช้ลายนิ้วมือปลดล็อกได้"
                else "จำไม่สำเร็จ",
            ),
        )
    }

    fun changePassword(
        context: Context,
        currentMasterPassword: String,
        newMasterPassword: String,
        secretKeyText: String,
    ) {
        val active = session ?: return

        update(uiState.copy(busy = true, message = null))

        viewModelScope.launch {
            val result = withContext(Dispatchers.Default) {
                changeMasterPassword(api, active, currentMasterPassword, newMasterPassword, secretKeyText)
            }

            when (result) {
                is CryptoResult.Err -> update(
                    uiState.copy(
                        busy = false,
                        message = "เปลี่ยนรหัสผ่านไม่สำเร็จ — ตรวจสอบรหัสผ่านเดิมและ Secret Key " +
                            "(รหัสผ่านใหม่ต้องยาวอย่างน้อย 12 ตัวอักษร)",
                    ),
                )

                is CryptoResult.Ok -> {
                    SessionHolder.open(result.value)
                    BiometricVault.forget(context)

                    update(
                        uiState.copy(
                            busy = false,
                            remembered = false,
                            message = "เปลี่ยนรหัสผ่านหลักแล้ว — อุปกรณ์อื่นทุกเครื่องถูกเตะออก " +
                                "และต้องตั้งลายนิ้วมือใหม่ในเครื่องนี้",
                        ),
                    )
                }
            }
        }
    }

    fun forgetSession(context: Context, notice: String? = "ลบข้อมูลที่จำไว้แล้ว") {
        BiometricVault.forget(context)
        update(uiState.copy(remembered = false, message = notice))
    }

    private suspend fun refresh(email: String, remembered: Boolean = uiState.remembered) {
        val active = session ?: return

        val pulled = withContext(Dispatchers.IO) { pull(api, active) }

        when (pulled) {
            is CryptoResult.Err -> update(
                uiState.copy(
                    busy = false,
                    unlocked = true,
                    email = email,
                    remembered = remembered,
                    message = "ดึงข้อมูลไม่สำเร็จ",
                ),
            )

            is CryptoResult.Ok -> {
                state = pulled.value

                ItemStore.replaceAll(pulled.value.items.values)

                update(
                    UiState(
                        unlocked = true,
                        busy = false,
                        email = email,
                        remembered = remembered,
                        vaults = pulled.value.vaults.entries
                            .map { (vaultId, metadata) ->
                                VaultRow(
                                    vaultId = vaultId,
                                    name = metadata.name,
                                    itemCount = pulled.value.items.values.count { it.vaultId == vaultId },
                                )
                            }
                            .sortedBy { it.name },

                        activeVaultId = uiState.activeVaultId
                            ?.takeIf { id -> pulled.value.vaults.containsKey(id) },
                        items = pulled.value.items.values
                            .map {
                                ItemRow(
                                    itemId = it.itemId,
                                    title = it.item.title,
                                    subtitle = subtitleOf(it.item),
                                    typeName = it.item.typeName,
                                    editable = true,
                                    vaultId = it.vaultId,
                                    hasTotp = (it.item as? LoginItem)?.totpSecret?.isNotBlank() == true,
                                )
                            }
                            .sortedBy { it.title },
                        message = if (pulled.value.brokenItemIds.isEmpty()) null
                        else "มี ${pulled.value.brokenItemIds.size} รายการที่ถอดรหัสไม่ได้",
                    ),
                )
            }
        }
    }

    fun revealSecret(itemId: String): RevealedItem? = when (val item = itemAt(itemId)?.item) {
        null -> null

        is LoginItem -> RevealedItem("รหัสผ่าน", item.password, null)

        is CardItem -> RevealedItem(
            "เลขบัตร",
            item.number,
            "หมดอายุ ${item.expiryMonth}/${item.expiryYear} · รหัสหลังบัตร ${item.securityCode}",
        )

        is SecureNoteItem -> null
    }

    fun totpOf(itemId: String, nowMs: Long): TotpCode? {
        val login = itemAt(itemId)?.item as? LoginItem ?: return null
        if (login.totpSecret.isBlank()) return null

        return when (val code = totpFromSecretText(login.totpSecret, nowMs)) {
            is CryptoResult.Err -> null
            is CryptoResult.Ok -> code.value
        }
    }

    fun hasTotp(itemId: String): Boolean =
        (itemAt(itemId)?.item as? LoginItem)?.totpSecret?.isNotBlank() == true

    fun plainFieldsOf(itemId: String): List<PlainField> = when (val item = itemAt(itemId)?.item) {
        null -> emptyList()
        is LoginItem -> listOfNotNull(
            item.username.takeIf { it.isNotBlank() }?.let { PlainField("ชื่อผู้ใช้", it) },
            item.urls.firstOrNull()?.takeIf { it.isNotBlank() }?.let { PlainField("เว็บไซต์", it) },
        )
        is CardItem -> listOfNotNull(
            item.cardholderName.takeIf { it.isNotBlank() }?.let { PlainField("ชื่อบนบัตร", it) },
        )
        is SecureNoteItem -> emptyList()
    }

    fun notesOf(itemId: String): String? = itemAt(itemId)?.item?.notes?.takeIf { it.isNotBlank() }

    private fun subtitleOf(item: VaultItem): String = when (item) {
        is LoginItem -> item.username
        is SecureNoteItem -> "โน้ตลับ"
        is CardItem -> "บัตร •••• ${item.number.takeLast(4)}"
    }

    fun itemAt(itemId: String): DecryptedItem? = state?.items?.get(itemId)

    fun suggestPassword(): String? = when (val generated = generatePassword(PasswordOptions())) {
        is CryptoResult.Err -> null
        is CryptoResult.Ok -> generated.value
    }

    fun createItem(item: VaultItem) {
        val active = session ?: return

        val vaultId = uiState.activeVaultId
            ?: uiState.vaults.firstOrNull()?.vaultId
            ?: return

        update(uiState.copy(busy = true, message = null))

        viewModelScope.launch {
            val itemId = when (val generated = createUlid(System.currentTimeMillis())) {
                is CryptoResult.Err -> {
                    update(uiState.copy(busy = false, message = "สร้างรหัสรายการไม่สำเร็จ"))
                    return@launch
                }
                is CryptoResult.Ok -> generated.value
            }

            val saved = withContext(Dispatchers.IO) {
                saveItem(api, active, itemId, vaultId, 0, item)
            }

            when (saved) {
                is CryptoResult.Err ->
                    update(uiState.copy(busy = false, message = "บันทึกไม่สำเร็จ"))
                is CryptoResult.Ok -> refresh(uiState.email)
            }
        }
    }

    fun selectVault(vaultId: String?) {
        update(uiState.copy(activeVaultId = vaultId))
    }

    fun createVaultNamed(name: String) {
        val active = session ?: return

        update(uiState.copy(busy = true, message = null))

        viewModelScope.launch {
            val created = withContext(Dispatchers.IO) { createNewVault(api, active, name) }

            when (created) {
                is CryptoResult.Err ->
                    update(uiState.copy(busy = false, message = "สร้าง vault ไม่สำเร็จ"))
                is CryptoResult.Ok -> {
                    refresh(uiState.email)
                    update(uiState.copy(activeVaultId = created.value))
                }
            }
        }
    }

    fun nowIso(): String = java.time.Instant.now().toString()

    fun updateItem(itemId: String, item: VaultItem) {
        val active = session ?: return
        val existing = itemAt(itemId) ?: return

        if (existing.item.typeName != item.typeName) {
            update(uiState.copy(message = "เปลี่ยนประเภทของรายการที่มีอยู่แล้วไม่ได้"))
            return
        }

        update(uiState.copy(busy = true, message = null))

        viewModelScope.launch {
            val saved = withContext(Dispatchers.IO) {
                saveItem(api, active, itemId, existing.vaultId, existing.version, item)
            }

            when (saved) {
                is CryptoResult.Err -> update(
                    uiState.copy(
                        busy = false,
                        message = "บันทึกไม่สำเร็จ — อาจมีเครื่องอื่นแก้รายการนี้ไปแล้ว ลองดึงข้อมูลใหม่",
                    ),
                )
                is CryptoResult.Ok -> refresh(uiState.email)
            }
        }
    }

    fun moveItem(itemId: String, targetVaultId: String) {
        val active = session ?: return
        val existing = itemAt(itemId) ?: return

        if (existing.vaultId == targetVaultId) return

        update(uiState.copy(busy = true, message = null))

        viewModelScope.launch {
            val moved = withContext(Dispatchers.IO) {
                saveItem(api, active, itemId, targetVaultId, existing.version, existing.item)
            }

            when (moved) {
                is CryptoResult.Err -> update(
                    uiState.copy(
                        busy = false,
                        message = "ย้ายไม่สำเร็จ — อาจมีเครื่องอื่นแก้รายการนี้ไปแล้ว",
                    ),
                )
                is CryptoResult.Ok -> refresh(uiState.email)
            }
        }
    }

    fun sync() {
        if (session == null) {
            lock()
            return
        }
        update(uiState.copy(busy = true, message = null))
        viewModelScope.launch { refresh(uiState.email) }
    }

    fun dismissMessage() {
        if (uiState.message != null) update(uiState.copy(message = null))
    }

    fun removeItem(itemId: String) {
        val active = session ?: return
        val existing = itemAt(itemId) ?: return

        update(uiState.copy(busy = true, message = null))

        viewModelScope.launch {
            val removed = withContext(Dispatchers.IO) {
                deleteItem(api, active, itemId, existing.vaultId, existing.version)
            }

            when (removed) {
                is CryptoResult.Err -> update(uiState.copy(busy = false, message = "ลบไม่สำเร็จ"))
                is CryptoResult.Ok -> refresh(uiState.email)
            }
        }
    }

    fun lock() {
        SessionHolder.lock()
        state = null

        update(UiState(remembered = uiState.remembered))
    }

    override fun onCleared() {
        super.onCleared()
        lock()
    }
}
