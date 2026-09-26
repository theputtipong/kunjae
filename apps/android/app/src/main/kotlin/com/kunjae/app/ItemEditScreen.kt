package com.kunjae.app

import androidx.compose.ui.res.stringResource
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.kunjae.app.ui.KIcons
import com.kunjae.app.ui.iconForType
import com.kunjae.client.CardItem
import com.kunjae.client.LoginItem
import com.kunjae.client.SecureNoteItem
import com.kunjae.client.VaultItem

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ItemEditScreen(
    state: VaultViewModel.UiState,
    model: VaultViewModel,
    itemId: String?,
    onDone: () -> Unit,
) {
    val existing = remember(itemId) { itemId?.let { model.itemAt(it)?.item } }

    var typeName by remember(itemId) { mutableStateOf(existing?.typeName ?: "login") }

    var title by remember(itemId) { mutableStateOf(existing?.title ?: "") }
    var notes by remember(itemId) { mutableStateOf(existing?.notes ?: "") }

    val login = existing as? LoginItem
    var username by remember(itemId) { mutableStateOf(login?.username ?: "") }
    var password by remember(itemId) { mutableStateOf(login?.password ?: "") }
    var url by remember(itemId) { mutableStateOf(login?.urls?.firstOrNull() ?: "") }
    var totpSecret by remember(itemId) { mutableStateOf(login?.totpSecret ?: "") }
    var showPassword by remember(itemId) { mutableStateOf(false) }

    val card = existing as? CardItem
    var holder by remember(itemId) { mutableStateOf(card?.cardholderName ?: "") }
    var number by remember(itemId) { mutableStateOf(card?.number ?: "") }
    var month by remember(itemId) { mutableStateOf(card?.expiryMonth ?: "") }
    var year by remember(itemId) { mutableStateOf(card?.expiryYear ?: "") }
    var cvc by remember(itemId) { mutableStateOf(card?.securityCode ?: "") }

    val clearSecrets = {
        password = ""
        number = ""
        cvc = ""
        totpSecret = ""
        showPassword = false
    }

    val cancel = {
        clearSecrets()
        onDone()
    }

    BackHandler(onBack = cancel)

    val save = save@{
        val now = model.nowIso()

        val createdAt = existing?.createdAt ?: now

        val item: VaultItem = when (typeName) {
            "card" -> CardItem(
                title = title,
                cardholderName = holder,
                number = number,
                expiryMonth = month,
                expiryYear = year,
                securityCode = cvc,
                notes = notes,
                tags = existing?.tags ?: emptyList(),
                customFields = existing?.customFields ?: emptyList(),
                createdAt = createdAt,
                updatedAt = now,
            )
            "secure-note" -> SecureNoteItem(
                title = title,
                notes = notes,
                tags = existing?.tags ?: emptyList(),
                customFields = existing?.customFields ?: emptyList(),
                createdAt = createdAt,
                updatedAt = now,
            )
            else -> LoginItem(
                title = title,
                username = username,
                password = password,
                urls = if (url.isBlank()) emptyList() else listOf(url.trim()),
                totpSecret = totpSecret,
                notes = notes,
                tags = existing?.tags ?: emptyList(),
                customFields = existing?.customFields ?: emptyList(),
                createdAt = createdAt,
                updatedAt = now,
            )
        }

        if (itemId == null) model.createItem(item) else model.updateItem(itemId, item)
        clearSecrets()
        onDone()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(if (itemId == null) R.string.edit_new_title else R.string.edit_title)) },
                navigationIcon = { IconButton(onClick = cancel) { Icon(KIcons.Close, stringResource(R.string.cd_cancel)) } },
                actions = {
                    TextButton(onClick = save, enabled = !state.busy && title.isNotBlank()) { Text(stringResource(R.string.action_save)) }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (itemId == null) {
                SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                    ITEM_TYPE_CHOICES.forEachIndexed { i, (name, label) ->
                        SegmentedButton(
                            selected = typeName == name,
                            onClick = { typeName = name },
                            shape = SegmentedButtonDefaults.itemShape(i, ITEM_TYPE_CHOICES.size),
                            icon = { Icon(iconForType(name), contentDescription = null, modifier = Modifier.size(18.dp)) },
                        ) { Text(stringResource(label)) }
                    }
                }

                val target = state.activeVaultId?.let { id -> state.vaults.firstOrNull { it.vaultId == id }?.name }
                    ?: state.vaults.firstOrNull()?.name
                if (state.vaults.size > 1 && target != null) {
                    Text(
                        stringResource(R.string.edit_target_vault, target),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                label = { Text(stringResource(R.string.label_item_title)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            if (typeName == "login") {
                OutlinedTextField(
                    value = username,
                    onValueChange = { username = it },
                    label = { Text(stringResource(R.string.label_username)) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text(stringResource(R.string.label_password)) },
                    singleLine = true,
                    visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    trailingIcon = {
                        Row {
                            IconButton(onClick = {
                                model.suggestPassword()?.let {
                                    password = it
                                    showPassword = true
                                }
                            }) { Icon(KIcons.Refresh, stringResource(R.string.cd_generate_password)) }
                            IconButton(onClick = { showPassword = !showPassword }) {
                                Icon(if (showPassword) KIcons.VisibilityOff else KIcons.Visibility, stringResource(if (showPassword) R.string.cd_hide else R.string.cd_show))
                            }
                        }
                    },
                    supportingText = { Text(stringResource(R.string.password_generate_hint)) },
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = url,
                    onValueChange = { url = it },
                    label = { Text(stringResource(R.string.label_website)) },
                    placeholder = { Text("github.com") },
                    supportingText = { Text(stringResource(R.string.website_hint)) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = totpSecret,
                    onValueChange = { totpSecret = it },
                    label = { Text(stringResource(R.string.label_totp_secret)) },
                    supportingText = { Text(stringResource(R.string.totp_secret_hint)) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, autoCorrectEnabled = false),
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            if (typeName == "card") {
                OutlinedTextField(
                    value = holder,
                    onValueChange = { holder = it },
                    label = { Text(stringResource(R.string.label_cardholder)) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = number,
                    onValueChange = { number = it },
                    label = { Text(stringResource(R.string.label_card_number)) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = month,
                        onValueChange = { month = it },
                        label = { Text(stringResource(R.string.label_month)) },
                        placeholder = { Text("MM") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f),
                    )
                    OutlinedTextField(
                        value = year,
                        onValueChange = { year = it },
                        label = { Text(stringResource(R.string.label_year)) },
                        placeholder = { Text("YYYY") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f),
                    )
                    OutlinedTextField(
                        value = cvc,
                        onValueChange = { cvc = it },
                        label = { Text("CVC") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text(stringResource(if (typeName == "secure-note") R.string.section_content else R.string.section_notes)) },
                minLines = if (typeName == "secure-note") 6 else 3,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
