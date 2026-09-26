package com.kunjae.app

import android.app.Application
import android.content.Context
import androidx.annotation.StringRes
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.kunjae.client.DecryptedItem
import com.kunjae.client.Session
import com.kunjae.client.VaultState
import com.kunjae.client.CardItem
import com.kunjae.client.LoginItem
import com.kunjae.client.SecureNoteItem
import com.kunjae.client.VaultItem
import com.kunjae.client.LocalVault
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

class VaultViewModel(application: Application) : AndroidViewModel(application) {

    enum class Mode { ACCOUNT, LOCAL }

    data class UiState(
        val unlocked: Boolean = false,
        val busy: Boolean = false,
        val message: UiText? = null,
        val email: String = "",
        val vaults: List<VaultRow> = emptyList(),

        val activeVaultId: String? = null,
        val items: List<ItemRow> = emptyList(),

        val remembered: Boolean = false,

        val mode: Mode = Mode.ACCOUNT,
        val localExists: Boolean = false,
        val localRemembered: Boolean = false,
        val migrationOffer: Int? = null,
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

    data class PlainField(@StringRes val labelRes: Int, val value: String)

    data class RevealedItem(
        @StringRes val labelRes: Int,
        val value: String,
        val expiryMonth: String? = null,
        val expiryYear: String? = null,
        val securityCode: String? = null,
    ) {
        override fun toString(): String = "RevealedItem(***)"
    }

    private val current: VaultSession? get() = SessionHolder.active()

    private val session: Session? get() = (current as? VaultSession.Account)?.session

    private val localStore = LocalVaultFile(application)

    private var state: VaultState? = null

    private val api = ApiClientHolder.api

    var uiState: UiState = UiState(localExists = LocalVault.exists(localStore))
        private set

    private var onChange: (() -> Unit)? = null

    fun observe(listener: () -> Unit) {
        onChange = listener
    }

    fun checkRemembered(context: Context) {
        val found = BiometricVault.hasRemembered(context, BiometricVault.Slot.ACCOUNT)
        val localFound = BiometricVault.hasRemembered(context, BiometricVault.Slot.LOCAL)
        val exists = LocalVault.exists(localStore)
        if (found != uiState.remembered || localFound != uiState.localRemembered || exists != uiState.localExists) {
            update(uiState.copy(remembered = found, localRemembered = localFound, localExists = exists))
        }
    }

    private fun update(next: UiState) {
        uiState = next
        onChange?.invoke()
    }

    private fun slotOf(mode: Mode): BiometricVault.Slot =
        if (mode == Mode.LOCAL) BiometricVault.Slot.LOCAL else BiometricVault.Slot.ACCOUNT

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
                        message = UiText.Res(R.string.msg_unlock_failed),
                    ),
                )

                is CryptoResult.Ok -> {
                    SessionHolder.open(VaultSession.Account(result.value))
                    refresh(email)
                    offerMigration()
                }
            }
        }
    }

    fun resumeFromBiometric(context: Context, cipher: javax.crypto.Cipher) {
        update(uiState.copy(busy = true, message = null))

        viewModelScope.launch {
            val recalled = withContext(Dispatchers.Default) {
                BiometricVault.finishRecall(context, cipher, BiometricVault.Slot.ACCOUNT)
            }

            if (recalled == null) {
                update(
                    uiState.copy(
                        busy = false,
                        remembered = false,
                        message = UiText.Res(R.string.msg_remembered_invalid),
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
                    uiState.copy(busy = false, message = UiText.Res(R.string.msg_resume_failed)),
                )
                is CryptoResult.Ok -> {
                    SessionHolder.open(VaultSession.Account(result.value))
                    refresh(recalled.email, remembered = true)
                    offerMigration()
                }
            }
        }
    }

    fun createLocal(masterPassword: String) {
        update(uiState.copy(busy = true, message = null))

        viewModelScope.launch {
            val result = withContext(Dispatchers.Default) {
                LocalVault.create(localStore, masterPassword, getApplication<Application>().getString(R.string.local_default_vault_name))
            }

            when (result) {
                is CryptoResult.Err -> update(
                    uiState.copy(
                        busy = false,
                        localExists = LocalVault.exists(localStore),
                        message = UiText.Res(R.string.msg_local_create_failed),
                    ),
                )
                is CryptoResult.Ok -> {
                    BiometricVault.forget(getApplication(), BiometricVault.Slot.LOCAL)
                    SessionHolder.open(VaultSession.Local(result.value))
                    update(uiState.copy(localExists = true, localRemembered = false))
                    refresh("")
                }
            }
        }
    }

    fun unlockLocal(masterPassword: String) {
        update(uiState.copy(busy = true, message = null))

        viewModelScope.launch {
            val result = withContext(Dispatchers.Default) { LocalVault.unlock(localStore, masterPassword) }

            when (result) {
                is CryptoResult.Err -> update(
                    uiState.copy(
                        busy = false,
                        localExists = LocalVault.exists(localStore),
                        message = UiText.Res(R.string.msg_local_unlock_failed),
                    ),
                )
                is CryptoResult.Ok -> {
                    SessionHolder.open(VaultSession.Local(result.value))
                    refresh("")
                }
            }
        }
    }

    fun resumeLocalFromBiometric(context: Context, cipher: javax.crypto.Cipher) {
        update(uiState.copy(busy = true, message = null))

        viewModelScope.launch {
            val recalled = withContext(Dispatchers.Default) {
                BiometricVault.finishRecall(context, cipher, BiometricVault.Slot.LOCAL)
            }

            if (recalled == null) {
                update(
                    uiState.copy(
                        busy = false,
                        localRemembered = false,
                        message = UiText.Res(R.string.msg_local_remembered_invalid),
                    ),
                )
                return@launch
            }

            val result = try {
                withContext(Dispatchers.IO) { LocalVault.resume(localStore, recalled.wrappingKey) }
            } finally {
                recalled.wipe()
            }

            when (result) {
                is CryptoResult.Err -> {
                    BiometricVault.forget(context, BiometricVault.Slot.LOCAL)
                    update(
                        uiState.copy(
                            busy = false,
                            localRemembered = false,
                            message = UiText.Res(R.string.msg_local_remembered_invalid),
                        ),
                    )
                }
                is CryptoResult.Ok -> {
                    SessionHolder.open(VaultSession.Local(result.value))
                    refresh("")
                }
            }
        }
    }

    fun rememberSession(context: Context, cipher: javax.crypto.Cipher) {
        val saved = when (val active = current) {
            null -> return
            is VaultSession.Account -> active.session.withAccountKeys { authKey, wrappingKey ->
                BiometricVault.finishRemember(context, cipher, uiState.email, authKey, wrappingKey)
            }
            is VaultSession.Local -> active.vault.withWrappingKey { wrappingKey ->
                BiometricVault.finishRememberLocal(context, cipher, wrappingKey)
            }
        }

        val message = UiText.Res(if (saved) R.string.msg_remember_ok else R.string.msg_remember_failed)
        update(
            if (uiState.mode == Mode.LOCAL) uiState.copy(localRemembered = saved, message = message)
            else uiState.copy(remembered = saved, message = message),
        )
    }

    fun beginRemember(context: Context): javax.crypto.Cipher? =
        BiometricVault.beginRemember(context, slotOf(uiState.mode))

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
                        message = UiText.Res(R.string.msg_change_failed),
                    ),
                )

                is CryptoResult.Ok -> {
                    SessionHolder.open(VaultSession.Account(result.value))
                    BiometricVault.forget(context, BiometricVault.Slot.ACCOUNT)

                    update(
                        uiState.copy(
                            busy = false,
                            remembered = false,
                            message = UiText.Res(R.string.msg_change_ok),
                        ),
                    )
                }
            }
        }
    }

    fun changeLocalPassword(context: Context, currentMasterPassword: String, newMasterPassword: String) {
        val local = (current as? VaultSession.Local)?.vault ?: return

        update(uiState.copy(busy = true, message = null))

        viewModelScope.launch {
            val result = withContext(Dispatchers.Default) {
                local.changePassword(currentMasterPassword, newMasterPassword)
            }

            when (result) {
                is CryptoResult.Err -> update(
                    uiState.copy(busy = false, message = UiText.Res(R.string.msg_local_change_failed)),
                )
                is CryptoResult.Ok -> {
                    BiometricVault.forget(context, BiometricVault.Slot.LOCAL)
                    update(
                        uiState.copy(
                            busy = false,
                            localRemembered = false,
                            message = UiText.Res(R.string.msg_local_change_ok),
                        ),
                    )
                }
            }
        }
    }

    fun deleteLocal(context: Context) {
        val active = current
        if (active is VaultSession.Local) {
            active.vault.delete()
        } else {
            runCatching { localStore.clear() }
        }
        BiometricVault.forget(context, BiometricVault.Slot.LOCAL)

        if (active is VaultSession.Local) {
            SessionHolder.lock()
            state = null
        }

        val base = if (active is VaultSession.Local) UiState(remembered = uiState.remembered) else uiState
        update(
            base.copy(
                localExists = LocalVault.exists(localStore),
                localRemembered = false,
                migrationOffer = null,
                message = UiText.Res(R.string.msg_local_deleted),
            ),
        )
    }

    fun forgetSession(context: Context, notice: UiText? = UiText.Res(R.string.msg_forgotten)) {
        BiometricVault.forget(context, slotOf(uiState.mode))
        update(
            if (uiState.mode == Mode.LOCAL) uiState.copy(localRemembered = false, message = notice)
            else uiState.copy(remembered = false, message = notice),
        )
    }

    private fun offerMigration() {
        if (current !is VaultSession.Account) return
        val count = LocalVault.peekItemCount(localStore) ?: return
        if (count > 0) update(uiState.copy(migrationOffer = count, localExists = true))
    }

    fun localItemCount(): Int? = LocalVault.peekItemCount(localStore)

    fun offerMigrationAgain() {
        if (current !is VaultSession.Account) return
        val count = LocalVault.peekItemCount(localStore) ?: return
        update(uiState.copy(migrationOffer = count))
    }

    fun dismissMigration() {
        if (uiState.migrationOffer != null) update(uiState.copy(migrationOffer = null))
    }

    fun migrateLocal(context: Context, deviceMasterPassword: String) {
        val account = session ?: return

        update(uiState.copy(busy = true, message = null, migrationOffer = null))

        viewModelScope.launch {
            val opened = withContext(Dispatchers.Default) { LocalVault.unlock(localStore, deviceMasterPassword) }

            val local = when (opened) {
                is CryptoResult.Err -> {
                    update(uiState.copy(busy = false, message = UiText.Res(R.string.msg_migrate_wrong_password)))
                    return@launch
                }
                is CryptoResult.Ok -> opened.value
            }

            val message: UiText = try {
                withContext(Dispatchers.IO) { moveAll(account, local, context) }
            } finally {
                local.lock()
            }

            val stillThere = LocalVault.exists(localStore)
            update(
                uiState.copy(
                    localExists = stillThere,
                    localRemembered = stillThere && BiometricVault.hasRemembered(context, BiometricVault.Slot.LOCAL),
                ),
            )
            refresh(uiState.email)
            update(uiState.copy(busy = false, message = message))
        }
    }

    private fun moveAll(account: Session, local: LocalVault, context: Context): UiText {
        val decrypted = when (val opened = local.state()) {
            is CryptoResult.Err -> return UiText.Res(R.string.msg_migrate_failed)
            is CryptoResult.Ok -> opened.value
        }

        val target = account.vaultIds().minOrNull() ?: return UiText.Res(R.string.msg_migrate_failed)

        var moved = 0
        var failed = 0

        for (entry in decrypted.items.values.sortedBy { it.itemId }) {
            val newId = when (val generated = createUlid(System.currentTimeMillis())) {
                is CryptoResult.Err -> { failed += 1; continue }
                is CryptoResult.Ok -> generated.value
            }

            when (saveItem(api, account, newId, target, 0, entry.item)) {
                is CryptoResult.Err -> failed += 1
                is CryptoResult.Ok -> {
                    moved += 1
                    local.deleteItem(entry.itemId, entry.version)
                }
            }
        }

        val leftBehind = failed + decrypted.brokenItemIds.size
        if (leftBehind > 0) return UiText.Res(R.string.msg_migrate_partial, listOf(moved, leftBehind))

        local.delete()
        BiometricVault.forget(context, BiometricVault.Slot.LOCAL)
        return UiText.Plural(R.plurals.msg_migrate_done, moved)
    }

    private fun loadState(active: VaultSession): CryptoResult<VaultState> = when (active) {
        is VaultSession.Account -> pull(api, active.session)
        is VaultSession.Local -> active.vault.state()
    }

    private fun persistItem(
        active: VaultSession,
        itemId: String,
        vaultId: String,
        baseVersion: Int,
        item: VaultItem,
    ): CryptoResult<Int> = when (active) {
        is VaultSession.Account -> saveItem(api, active.session, itemId, vaultId, baseVersion, item)
        is VaultSession.Local -> active.vault.saveItem(itemId, vaultId, baseVersion, item)
    }

    private suspend fun refresh(email: String, remembered: Boolean = uiState.remembered) {
        val active = current
        if (active == null) {
            lock()
            return
        }

        val mode = if (active is VaultSession.Local) Mode.LOCAL else Mode.ACCOUNT

        val pulled = withContext(Dispatchers.IO) { loadState(active) }

        when (pulled) {
            is CryptoResult.Err -> update(
                uiState.copy(
                    busy = false,
                    unlocked = true,
                    mode = mode,
                    email = email,
                    remembered = remembered,
                    message = UiText.Res(R.string.msg_pull_failed),
                ),
            )

            is CryptoResult.Ok -> {
                state = pulled.value

                ItemStore.replaceAll(pulled.value.items.values)

                update(
                    uiState.copy(
                        unlocked = true,
                        busy = false,
                        mode = mode,
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
                        else UiText.Plural(R.plurals.msg_broken_items, pulled.value.brokenItemIds.size),
                    ),
                )
            }
        }
    }

    fun revealSecret(itemId: String): RevealedItem? = when (val item = itemAt(itemId)?.item) {
        null -> null

        is LoginItem -> RevealedItem(R.string.label_password, item.password)

        is CardItem -> RevealedItem(
            R.string.label_card_number,
            item.number,
            expiryMonth = item.expiryMonth,
            expiryYear = item.expiryYear,
            securityCode = item.securityCode,
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
            item.username.takeIf { it.isNotBlank() }?.let { PlainField(R.string.label_username, it) },
            item.urls.firstOrNull()?.takeIf { it.isNotBlank() }?.let { PlainField(R.string.label_website, it) },
        )
        is CardItem -> listOfNotNull(
            item.cardholderName.takeIf { it.isNotBlank() }?.let { PlainField(R.string.label_cardholder, it) },
        )
        is SecureNoteItem -> emptyList()
    }

    fun notesOf(itemId: String): String? = itemAt(itemId)?.item?.notes?.takeIf { it.isNotBlank() }

    private fun subtitleOf(item: VaultItem): String = when (item) {
        is LoginItem -> item.username
        is SecureNoteItem -> ""
        is CardItem -> item.number.takeLast(4)
    }

    fun itemAt(itemId: String): DecryptedItem? = state?.items?.get(itemId)

    fun suggestPassword(): String? = when (val generated = generatePassword(PasswordOptions())) {
        is CryptoResult.Err -> null
        is CryptoResult.Ok -> generated.value
    }

    fun createItem(item: VaultItem) {
        val active = current ?: return

        val vaultId = uiState.activeVaultId
            ?: uiState.vaults.firstOrNull()?.vaultId
            ?: return

        update(uiState.copy(busy = true, message = null))

        viewModelScope.launch {
            val itemId = when (val generated = createUlid(System.currentTimeMillis())) {
                is CryptoResult.Err -> {
                    update(uiState.copy(busy = false, message = UiText.Res(R.string.msg_id_failed)))
                    return@launch
                }
                is CryptoResult.Ok -> generated.value
            }

            val saved = withContext(Dispatchers.IO) {
                persistItem(active, itemId, vaultId, 0, item)
            }

            when (saved) {
                is CryptoResult.Err ->
                    update(uiState.copy(busy = false, message = UiText.Res(R.string.msg_save_failed)))
                is CryptoResult.Ok -> refresh(uiState.email)
            }
        }
    }

    fun selectVault(vaultId: String?) {
        update(uiState.copy(activeVaultId = vaultId))
    }

    fun createVaultNamed(name: String) {
        val active = current ?: return

        update(uiState.copy(busy = true, message = null))

        viewModelScope.launch {
            val created = withContext(Dispatchers.IO) {
                when (active) {
                    is VaultSession.Account -> createNewVault(api, active.session, name)
                    is VaultSession.Local -> active.vault.addVault(name)
                }
            }

            when (created) {
                is CryptoResult.Err ->
                    update(uiState.copy(busy = false, message = UiText.Res(R.string.msg_create_vault_failed)))
                is CryptoResult.Ok -> {
                    refresh(uiState.email)
                    update(uiState.copy(activeVaultId = created.value))
                }
            }
        }
    }

    fun nowIso(): String = java.time.Instant.now().toString()

    fun updateItem(itemId: String, item: VaultItem) {
        val active = current ?: return
        val existing = itemAt(itemId) ?: return

        if (existing.item.typeName != item.typeName) {
            update(uiState.copy(message = UiText.Res(R.string.msg_type_change)))
            return
        }

        update(uiState.copy(busy = true, message = null))

        viewModelScope.launch {
            val saved = withContext(Dispatchers.IO) {
                persistItem(active, itemId, existing.vaultId, existing.version, item)
            }

            when (saved) {
                is CryptoResult.Err -> update(
                    uiState.copy(
                        busy = false,
                        message = UiText.Res(R.string.msg_update_conflict),
                    ),
                )
                is CryptoResult.Ok -> refresh(uiState.email)
            }
        }
    }

    fun moveItem(itemId: String, targetVaultId: String) {
        val active = current ?: return
        val existing = itemAt(itemId) ?: return

        if (existing.vaultId == targetVaultId) return

        update(uiState.copy(busy = true, message = null))

        viewModelScope.launch {
            val moved = withContext(Dispatchers.IO) {
                persistItem(active, itemId, targetVaultId, existing.version, existing.item)
            }

            when (moved) {
                is CryptoResult.Err -> update(
                    uiState.copy(
                        busy = false,
                        message = UiText.Res(R.string.msg_move_failed),
                    ),
                )
                is CryptoResult.Ok -> refresh(uiState.email)
            }
        }
    }

    fun sync() {
        if (current == null) {
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
        val active = current ?: return
        val existing = itemAt(itemId) ?: return

        update(uiState.copy(busy = true, message = null))

        viewModelScope.launch {
            val removed = withContext(Dispatchers.IO) {
                when (active) {
                    is VaultSession.Account -> deleteItem(api, active.session, itemId, existing.vaultId, existing.version)
                    is VaultSession.Local -> active.vault.deleteItem(itemId, existing.version)
                }
            }

            when (removed) {
                is CryptoResult.Err -> update(uiState.copy(busy = false, message = UiText.Res(R.string.msg_delete_failed)))
                is CryptoResult.Ok -> refresh(uiState.email)
            }
        }
    }

    fun lock() {
        SessionHolder.lock()
        state = null

        update(
            UiState(
                remembered = uiState.remembered,
                localRemembered = uiState.localRemembered,
                localExists = LocalVault.exists(localStore),
                message = uiState.message.takeIf { !uiState.unlocked },
            ),
        )
    }

    override fun onCleared() {
        super.onCleared()
        lock()
    }
}
