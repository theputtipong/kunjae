package com.kunjae.app

import androidx.compose.ui.res.stringResource
import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.kunjae.app.ui.FieldRow
import com.kunjae.app.ui.KIcons
import com.kunjae.app.ui.LetterAvatar
import com.kunjae.app.ui.MessageBanner
import com.kunjae.app.ui.SectionCard
import com.kunjae.app.ui.SettingsRow

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ItemDetailScreen(
    state: VaultViewModel.UiState,
    model: VaultViewModel,
    itemId: String,
    onBack: () -> Unit,
    onEdit: () -> Unit,
) {
    val context = LocalContext.current
    val row = state.items.firstOrNull { it.itemId == itemId }

    if (row == null) {
        LaunchedEffect(Unit) { onBack() }
        return
    }

    var revealed by remember(itemId) { mutableStateOf<VaultViewModel.RevealedItem?>(null) }
    var confirmDelete by remember { mutableStateOf(false) }

    val copy: (String, Boolean) -> Unit = { text, sensitive ->
        SecureClipboard.copy(context, text, sensitive)
        Toast.makeText(
            context,
            if (sensitive) context.getString(R.string.copied_sensitive, SecureClipboard.CLEAR_AFTER_SECONDS)
            else context.getString(R.string.copied),
            Toast.LENGTH_SHORT,
        ).show()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(KIcons.Back, stringResource(R.string.cd_back)) } },
                actions = {
                    if (row.editable) {
                        IconButton(onClick = {
                            revealed = null
                            onEdit()
                        }, enabled = !state.busy) { Icon(KIcons.Edit, stringResource(R.string.cd_edit)) }
                    }
                    IconButton(onClick = { confirmDelete = true }, enabled = !state.busy) { Icon(KIcons.Delete, stringResource(R.string.cd_delete)) }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            if (state.busy) LinearProgressIndicator(modifier = Modifier.fillMaxWidth())

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                LetterAvatar(row.title, size = 56.dp)
                Column {
                    Text(row.title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
                    val typeLabel = ITEM_TYPE_CHOICES.firstOrNull { it.first == row.typeName }?.second?.let { stringResource(it) } ?: row.typeName
                    val vaultName = state.vaults.firstOrNull { it.vaultId == row.vaultId }?.name
                    Text(
                        listOfNotNull(typeLabel, vaultName).joinToString(" · "),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            MessageBanner(state.message.asString(), onDismiss = model::dismissMessage)

            val plain = model.plainFieldsOf(itemId)
            val hasSecret = row.typeName != "secure-note"

            if (plain.isNotEmpty() || hasSecret) {
                SectionCard {
                    plain.forEachIndexed { i, field ->
                        if (i > 0) HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                        FieldRow(stringResource(field.labelRes), field.value, onCopy = { copy(field.value, false) })
                    }
                    if (hasSecret) {
                        if (plain.isNotEmpty()) HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                        val secretLabel = if (row.typeName == "card") R.string.label_card_number else R.string.label_password
                        FieldRow(
                            label = stringResource(revealed?.labelRes ?: secretLabel),
                            value = revealed?.value ?: "",
                            monospace = true,
                            revealed = revealed != null,
                            onReveal = { revealed = if (revealed == null) model.revealSecret(itemId) else null },
                            onCopy = { model.revealSecret(itemId)?.value?.let { copy(it, true) } },
                        )
                        revealed?.takeIf { it.securityCode != null }?.let {
                            Text(
                                stringResource(
                                    R.string.card_expiry_cvc,
                                    it.expiryMonth.orEmpty(),
                                    it.expiryYear.orEmpty(),
                                    it.securityCode.orEmpty(),
                                ),
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.padding(start = 16.dp, end = 16.dp, bottom = 12.dp),
                            )
                        }
                    }
                }
            }

            if (row.hasTotp) TotpCard(model, itemId, onCopy = { copy(it, true) })

            model.notesOf(itemId)?.let { notes ->
                SectionCard(title = stringResource(if (row.typeName == "secure-note") R.string.section_content else R.string.section_notes)) {
                    Text(notes, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(16.dp))
                }
            }

            val destinations = state.vaults.filter { it.vaultId != row.vaultId }
            if (destinations.isNotEmpty()) {
                SectionCard(title = stringResource(R.string.move_to_vault)) {
                    destinations.forEach { vault ->
                        SettingsRow(
                            icon = KIcons.Folder,
                            title = vault.name,
                            enabled = !state.busy,
                            onClick = {
                                revealed = null
                                model.moveItem(itemId, vault.vaultId)
                            },
                        )
                    }
                }
            }
        }
    }

    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text(stringResource(R.string.delete_title, row.title)) },
            text = {
                Text(
                    stringResource(
                        if (state.mode == VaultViewModel.Mode.LOCAL) R.string.delete_body_local else R.string.delete_body,
                    ),
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    confirmDelete = false
                    revealed = null
                    model.removeItem(itemId)
                    onBack()
                }) { Text(stringResource(R.string.action_delete), color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text(stringResource(R.string.action_cancel)) } },
        )
    }
}

@Composable
private fun TotpCard(model: VaultViewModel, itemId: String, onCopy: (String) -> Unit) {
    var now by remember(itemId) { mutableStateOf(System.currentTimeMillis()) }

    LaunchedEffect(itemId) {
        while (true) {
            kotlinx.coroutines.delay(1000)
            now = System.currentTimeMillis()
        }
    }

    val code = model.totpOf(itemId, now)

    SectionCard(title = stringResource(R.string.totp_title)) {
        if (code == null) {
            Text(
                stringResource(R.string.totp_unreadable),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(16.dp),
            )
            return@SectionCard
        }

        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 4.dp, top = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                code.code.chunked(if (code.code.length == 8) 4 else 3).joinToString(" "),
                style = MaterialTheme.typography.headlineMedium,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.weight(1f),
            )
            Text(stringResource(R.string.totp_seconds, code.secondsRemaining), style = MaterialTheme.typography.labelLarge)
            IconButton(onClick = { onCopy(code.code) }) { Icon(KIcons.Copy, stringResource(R.string.cd_copy_code)) }
        }
        LinearProgressIndicator(
            progress = { (code.secondsRemaining / 30f).coerceIn(0f, 1f) },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
        )
    }
}
