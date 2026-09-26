package com.kunjae.app

import androidx.compose.ui.res.stringResource
import androidx.compose.ui.platform.LocalContext
import android.content.Context
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.kunjae.app.ui.KIcons
import com.kunjae.app.ui.KunjaeMark
import com.kunjae.app.ui.KunjaeYellow
import com.kunjae.app.ui.OnKunjaeYellow
import com.kunjae.app.ui.LetterAvatar
import com.kunjae.app.ui.MessageBanner
import com.kunjae.app.ui.iconForType

val ITEM_TYPE_CHOICES: List<Pair<String, Int>> = listOf(
    "login" to R.string.type_login,
    "secure-note" to R.string.type_secure_note,
    "card" to R.string.type_card,
)

fun subtitleFor(row: VaultViewModel.ItemRow, context: Context): String = when (row.typeName) {
    "secure-note" -> context.getString(R.string.type_secure_note)
    "card" -> context.getString(R.string.card_subtitle, row.subtitle)
    else -> row.subtitle
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VaultListScreen(
    state: VaultViewModel.UiState,
    model: VaultViewModel,
    onOpen: (String) -> Unit,
    onAdd: () -> Unit,
    onSettings: () -> Unit,
    onSignInToSync: () -> Unit,
) {
    val local = state.mode == VaultViewModel.Mode.LOCAL
    var query by rememberSaveable { mutableStateOf("") }
    var typeFilter by rememberSaveable { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        KunjaeMark(36.dp, unlocked = true, description = stringResource(R.string.cd_unlocked))
                        Column {
                        Text("Kunjae", fontWeight = FontWeight.SemiBold)
                        if (local) {
                            LocalChip()
                        } else {
                            Text(
                                state.email,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                        }
                    }
                },
                actions = {
                    if (!local) {
                        IconButton(onClick = model::sync, enabled = !state.busy) { Icon(KIcons.Sync, stringResource(R.string.cd_sync)) }
                    }
                    IconButton(onClick = onSettings) { Icon(KIcons.Settings, stringResource(R.string.cd_settings)) }
                    IconButton(onClick = model::lock) { Icon(KIcons.Lock, stringResource(R.string.cd_lock)) }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface),
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onAdd, containerColor = KunjaeYellow, contentColor = OnKunjaeYellow) { Icon(KIcons.Add, stringResource(R.string.cd_add_item)) }
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (state.busy) LinearProgressIndicator(modifier = Modifier.fillMaxWidth())

            Column(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    placeholder = { Text(stringResource(R.string.search_placeholder)) },
                    leadingIcon = { Icon(KIcons.Search, contentDescription = null) },
                    trailingIcon = {
                        if (query.isNotEmpty()) IconButton(onClick = { query = "" }) { Icon(KIcons.Close, stringResource(R.string.cd_clear)) }
                    },
                    singleLine = true,
                    shape = MaterialTheme.shapes.extraLarge,
                    modifier = Modifier.fillMaxWidth(),
                )

                MessageBanner(state.message.asString(), onDismiss = model::dismissMessage)

                if (local) LocalModeBanner(onSignIn = onSignInToSync)
            }

            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                item {
                    FilterChip(selected = typeFilter == null, onClick = { typeFilter = null }, label = { Text(stringResource(R.string.filter_all)) })
                }
                items(ITEM_TYPE_CHOICES) { (name, label) ->
                    FilterChip(
                        selected = typeFilter == name,
                        onClick = { typeFilter = if (typeFilter == name) null else name },
                        label = { Text(stringResource(label)) },
                        leadingIcon = { Icon(iconForType(name), contentDescription = null, modifier = Modifier.size(18.dp)) },
                    )
                }
                if (state.vaults.size > 1) item { VaultPicker(state, model) }
            }

            val context = LocalContext.current
            val needle = query.trim().lowercase()
            val visible = state.items
                .filter { state.activeVaultId == null || it.vaultId == state.activeVaultId }
                .filter { typeFilter == null || it.typeName == typeFilter }
                .filter { needle.isEmpty() || it.title.lowercase().contains(needle) || subtitleFor(it, context).lowercase().contains(needle) }

            if (visible.isEmpty()) {
                EmptyState(filtered = state.items.isNotEmpty(), onAdd = onAdd)
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(start = 8.dp, end = 8.dp, top = 8.dp, bottom = 96.dp),
                ) {
                    items(visible, key = { it.itemId }) { row -> ItemListRow(row, onClick = { onOpen(row.itemId) }) }
                }
            }
        }
    }
}

@Composable
private fun ItemListRow(row: VaultViewModel.ItemRow, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        LetterAvatar(row.title)
        Column(modifier = Modifier.weight(1f)) {
            Text(row.title, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
            val context = LocalContext.current
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Icon(
                    iconForType(row.typeName),
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(14.dp),
                )
                Text(
                    subtitleFor(row, context),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        if (row.hasTotp) {
            Surface(shape = MaterialTheme.shapes.small, color = MaterialTheme.colorScheme.tertiaryContainer) {
                Text(
                    "2FA",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onTertiaryContainer,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                )
            }
        }
        Icon(KIcons.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun VaultPicker(state: VaultViewModel.UiState, model: VaultViewModel) {
    var open by remember { mutableStateOf(false) }
    val activeName = state.vaults.firstOrNull { it.vaultId == state.activeVaultId }?.name

    Box {
        FilterChip(
            selected = state.activeVaultId != null,
            onClick = { open = true },
            label = { Text(activeName ?: stringResource(R.string.all_vaults)) },
            leadingIcon = { Icon(KIcons.Folder, contentDescription = null, modifier = Modifier.size(18.dp)) },
            trailingIcon = { Icon(KIcons.DropDown, contentDescription = null, modifier = Modifier.size(18.dp)) },
        )
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(text = { Text(stringResource(R.string.all_vaults)) }, onClick = {
                model.selectVault(null)
                open = false
            })
            state.vaults.forEach { vault ->
                DropdownMenuItem(text = { Text("${vault.name} (${vault.itemCount})") }, onClick = {
                    model.selectVault(vault.vaultId)
                    open = false
                })
            }
        }
    }
}

@Composable
private fun EmptyState(filtered: Boolean, onAdd: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(if (filtered) "🔍" else "🗝️", style = MaterialTheme.typography.displaySmall)
        Text(
            stringResource(if (filtered) R.string.empty_filtered_title else R.string.empty_title),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(top = 12.dp),
        )
        Text(
            stringResource(if (filtered) R.string.empty_filtered_body else R.string.empty_body),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 4.dp).clickable(enabled = !filtered, onClick = onAdd),
        )
    }
}
