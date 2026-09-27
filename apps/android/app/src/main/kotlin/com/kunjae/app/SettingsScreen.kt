package com.kunjae.app

import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SegmentedButton
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.view.autofill.AutofillManager
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import com.kunjae.app.ui.KIcons
import com.kunjae.app.ui.kunjaeButtonColors
import com.kunjae.app.ui.MessageBanner
import com.kunjae.app.ui.SectionCard
import com.kunjae.app.ui.SettingsRow

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    state: VaultViewModel.UiState,
    model: VaultViewModel,
    onBack: () -> Unit,
    onChangePassword: () -> Unit,
    onLocalChangePassword: () -> Unit,
    onSignInToSync: () -> Unit,
    onShowIntro: () -> Unit,
    themeMode: ThemeMode,
    onThemeChange: (ThemeMode) -> Unit,
) {
    val activity = LocalContext.current as? Activity
    var creatingVault by remember { mutableStateOf(false) }
    var deletingLocal by remember { mutableStateOf(false) }
    val local = state.mode == VaultViewModel.Mode.LOCAL

    BackHandler(onBack = onBack)

    var autofillOn by remember { mutableStateOf(false) }
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(lifecycle) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            autofillOn = activity?.getSystemService(AutofillManager::class.java)?.hasEnabledAutofillServices() == true
            activity?.let { model.checkRemembered(it) }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.settings_title)) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(KIcons.Back, stringResource(R.string.cd_back)) } },
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
            MessageBanner(state.message.asString(), onDismiss = model::dismissMessage)

            if (local) {
                SectionCard(title = stringResource(R.string.section_this_device)) {
                    SettingsRow(KIcons.Shield, stringResource(R.string.local_mode_title), stringResource(R.string.local_mode_subtitle))
                    SettingsRow(
                        KIcons.Key,
                        stringResource(R.string.local_change_password),
                        stringResource(R.string.local_change_password_subtitle),
                        enabled = !state.busy,
                        onClick = onLocalChangePassword,
                        trailing = { Icon(KIcons.ChevronRight, contentDescription = null) },
                    )
                    SettingsRow(
                        KIcons.Sync,
                        stringResource(R.string.local_banner_action),
                        stringResource(R.string.local_sign_in_sync_subtitle),
                        enabled = !state.busy,
                        onClick = onSignInToSync,
                        trailing = { Icon(KIcons.ChevronRight, contentDescription = null) },
                    )
                    SettingsRow(
                        KIcons.Delete,
                        stringResource(R.string.local_delete),
                        stringResource(R.string.local_delete_subtitle),
                        enabled = !state.busy,
                        onClick = { deletingLocal = true },
                    )
                }
            } else {
                SectionCard(title = stringResource(R.string.section_account)) {
                    SettingsRow(KIcons.Person, state.email, stringResource(R.string.account_subtitle))
                    if (state.localExists) {
                        val count = remember(state.localExists, state.busy) { model.localItemCount() ?: 0 }
                        SettingsRow(
                            KIcons.Sync,
                            stringResource(R.string.migrate_row_title),
                            pluralStringResource(R.plurals.migrate_row_subtitle, count, count),
                            enabled = !state.busy && count > 0,
                            onClick = model::offerMigrationAgain,
                            trailing = { Icon(KIcons.ChevronRight, contentDescription = null) },
                        )
                    }
                }
            }

            SectionCard(title = stringResource(R.string.section_security)) {
                activity?.let { BiometricRow(state, model, it) }
                if (!local) {
                    SettingsRow(
                        KIcons.Key,
                        stringResource(R.string.change_master_password),
                        stringResource(R.string.change_master_password_subtitle),
                        enabled = !state.busy,
                        onClick = onChangePassword,
                        trailing = { Icon(KIcons.ChevronRight, contentDescription = null) },
                    )
                }
                SettingsRow(KIcons.Lock, stringResource(R.string.auto_lock), stringResource(R.string.auto_lock_subtitle))
                SettingsRow(KIcons.Lock, stringResource(R.string.lock_now), onClick = model::lock)
            }

            SectionCard(title = stringResource(R.string.section_autofill)) {
                SettingsRow(
                    KIcons.Shield,
                    stringResource(if (autofillOn) R.string.autofill_on else R.string.autofill_off),
                    stringResource(if (autofillOn) R.string.autofill_on_subtitle else R.string.autofill_off_subtitle),
                    onClick = {
                        runCatching {
                            activity?.startActivity(
                                Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE, Uri.parse("package:${activity.packageName}")),
                            )
                        }
                    },
                    trailing = { Icon(KIcons.ChevronRight, contentDescription = null) },
                )
            }

            SectionCard(title = stringResource(R.string.section_vaults)) {
                state.vaults.forEach { vault ->
                    SettingsRow(KIcons.Folder, vault.name, pluralStringResource(R.plurals.vault_item_count, vault.itemCount, vault.itemCount))
                }
                SettingsRow(KIcons.Add, stringResource(R.string.create_vault), enabled = !state.busy, onClick = { creatingVault = true })
            }

            if (!local) {
                SectionCard(title = stringResource(R.string.section_web_only)) {
                    SettingsRow(KIcons.Note, stringResource(R.string.emergency_kit), stringResource(R.string.emergency_kit_subtitle), enabled = false)
                    SettingsRow(KIcons.Folder, stringResource(R.string.export_import), stringResource(R.string.export_import_subtitle), enabled = false)
                    SettingsRow(KIcons.Logout, stringResource(R.string.sign_out_everywhere), enabled = false)
                    SettingsRow(KIcons.Delete, stringResource(R.string.delete_account), enabled = false)
                }
            }

            SectionCard(title = stringResource(R.string.section_appearance)) {
                ChoiceRow(
                    title = stringResource(R.string.theme_title),
                    options = listOf(
                        ThemeMode.SYSTEM to stringResource(R.string.theme_system),
                        ThemeMode.LIGHT to stringResource(R.string.theme_light),
                        ThemeMode.DARK to stringResource(R.string.theme_dark),
                    ),
                    selected = themeMode,
                    onSelect = onThemeChange,
                )
                activity?.let { LanguageRow(it) }
            }

            SectionCard(title = stringResource(R.string.section_help)) {
                SettingsRow(KIcons.Info, stringResource(R.string.how_it_works), stringResource(R.string.how_it_works_subtitle), onClick = onShowIntro)
            }

            SectionCard(title = stringResource(R.string.section_about)) {
                SettingsRow(
                    KIcons.Info,
                    stringResource(R.string.app_name),
                    stringResource(R.string.about_version, BuildConfig.VERSION_NAME + if (BuildConfig.DEBUG) " (debug)" else ""),
                )
                SettingsRow(
                    KIcons.Heart,
                    stringResource(R.string.support_title),
                    stringResource(R.string.support_subtitle),
                    onClick = {
                        runCatching {
                            activity?.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(SUPPORT_URL)))
                        }
                    },
                )
            }

            SectionCard(title = stringResource(R.string.section_legal)) {
                SettingsRow(
                    KIcons.Shield,
                    stringResource(R.string.legal_privacy),
                    onClick = { openLegalPage(activity, LegalPage.PRIVACY) },
                    trailing = { Icon(KIcons.ChevronRight, contentDescription = null) },
                )
                SettingsRow(
                    KIcons.Note,
                    stringResource(R.string.legal_terms),
                    onClick = { openLegalPage(activity, LegalPage.TERMS) },
                    trailing = { Icon(KIcons.ChevronRight, contentDescription = null) },
                )
                SettingsRow(
                    KIcons.Info,
                    stringResource(R.string.legal_contact),
                    onClick = { openLegalPage(activity, LegalPage.CONTACT) },
                    trailing = { Icon(KIcons.ChevronRight, contentDescription = null) },
                )
                SettingsRow(
                    KIcons.Delete,
                    stringResource(R.string.legal_delete_account),
                    stringResource(R.string.legal_delete_account_subtitle),
                    onClick = { openLegalPage(activity, LegalPage.DELETE_ACCOUNT) },
                    trailing = { Icon(KIcons.ChevronRight, contentDescription = null) },
                )
            }
        }
    }

    if (creatingVault) CreateVaultDialog(onDismiss = { creatingVault = false }, onCreate = model::createVaultNamed)

    if (deletingLocal && activity != null) {
        DeleteLocalDialog(
            onDismiss = { deletingLocal = false },
            onConfirm = {
                deletingLocal = false
                model.deleteLocal(activity)
            },
        )
    }
}

private const val SUPPORT_URL = "https://buymeacoffee.com/theputtipong"

@Composable
private fun <T> ChoiceRow(title: String, options: List<Pair<T, String>>, selected: T, onSelect: (T) -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(title, style = MaterialTheme.typography.bodyLarge)
        SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
            options.forEachIndexed { i, (value, label) ->
                SegmentedButton(
                    selected = value == selected,
                    onClick = { onSelect(value) },
                    shape = SegmentedButtonDefaults.itemShape(i, options.size),
                ) { Text(label, maxLines = 1) }
            }
        }
    }
}

@Composable
private fun LanguageRow(activity: Activity) {
    val current = remember { AppLocale.selected(activity) }
    ChoiceRow(
        title = stringResource(R.string.language_title),
        options = listOf("" to stringResource(R.string.language_system)) +
            AppLocale.supported.map { it to AppLocale.displayName(it) },
        selected = current,
        onSelect = { AppLocale.select(activity, it) },
    )
}

@Composable
private fun BiometricRow(state: VaultViewModel.UiState, model: VaultViewModel, activity: Activity) {
    if (!BiometricGate.isAvailable(activity)) {
        SettingsRow(
            KIcons.Shield,
            stringResource(R.string.unlock_with_fingerprint),
            stringResource(R.string.biometric_unavailable_subtitle),
            enabled = false,
        )
        return
    }

    val on = if (state.mode == VaultViewModel.Mode.LOCAL) state.localRemembered else state.remembered

    val toggle: () -> Unit = {
        if (on) {
            model.forgetSession(activity)
        } else {
            model.beginRemember(activity)?.let { cipher ->
                BiometricGate.authenticate(
                    activity,
                    cipher,
                    title = activity.getString(R.string.biometric_enable_title),
                    subtitle = activity.getString(R.string.biometric_enable_subtitle),
                ) { outcome ->
                    when (outcome) {
                        is BiometricGate.Outcome.Approved -> model.rememberSession(activity, outcome.cipher)
                        is BiometricGate.Outcome.Refused -> model.forgetSession(activity, notice = null)
                    }
                }
            }
        }
    }

    SettingsRow(
        KIcons.Shield,
        stringResource(R.string.unlock_with_fingerprint),
        stringResource(if (on) R.string.biometric_on_subtitle else R.string.biometric_off_subtitle),
        enabled = !state.busy,
        onClick = toggle,
        trailing = { Switch(checked = on, onCheckedChange = { toggle() }, enabled = !state.busy) },
    )
}

@Composable
private fun CreateVaultDialog(onDismiss: () -> Unit, onCreate: (String) -> Unit) {
    var name by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.create_vault)) },
        text = {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text(stringResource(R.string.vault_name)) },
                placeholder = { Text(stringResource(R.string.vault_name_placeholder)) },
                singleLine = true,
            )
        },
        confirmButton = {
            TextButton(onClick = {
                onCreate(name.trim())
                onDismiss()
            }, enabled = name.isNotBlank()) { Text(stringResource(R.string.action_create)) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_cancel)) } },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChangePasswordScreen(state: VaultViewModel.UiState, model: VaultViewModel, onDone: () -> Unit) {
    val activity = LocalContext.current as? Activity ?: return

    var current by remember { mutableStateOf("") }
    var next by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    var secret by remember { mutableStateOf("") }

    val clearAll = {
        current = ""
        next = ""
        confirm = ""
        secret = ""
    }
    val cancel = {
        clearAll()
        onDone()
    }
    BackHandler(onBack = cancel)

    val tooShort = next.isNotEmpty() && next.length < 12
    val mismatch = confirm.isNotEmpty() && confirm != next
    val ready = !state.busy && current.isNotEmpty() && next.length >= 12 && confirm == next && secret.isNotBlank()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.change_master_password)) },
                navigationIcon = { IconButton(onClick = cancel) { Icon(KIcons.Close, stringResource(R.string.cd_cancel)) } },
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
            MessageBanner(
                stringResource(R.string.change_password_warning),
            )
            OutlinedTextField(
                value = current,
                onValueChange = { current = it },
                label = { Text(stringResource(R.string.change_password_current)) },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = next,
                onValueChange = { next = it },
                label = { Text(stringResource(R.string.change_password_new)) },
                supportingText = {
                    Text(stringResource(if (tooShort) R.string.change_password_too_short else R.string.change_password_new_hint))
                },
                isError = tooShort,
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = confirm,
                onValueChange = { confirm = it },
                label = { Text(stringResource(R.string.change_password_confirm)) },
                supportingText = { if (mismatch) Text(stringResource(R.string.change_password_mismatch)) },
                isError = mismatch,
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = secret,
                onValueChange = { secret = it },
                label = { Text(stringResource(R.string.secret_key)) },
                supportingText = { Text(stringResource(R.string.change_password_secret_hint)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Button(
                onClick = {
                    model.changePassword(activity, current, next, secret)
                    clearAll()
                    onDone()
                },
                enabled = ready,
                colors = kunjaeButtonColors(),
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            ) { Text(stringResource(R.string.change_password_action)) }
            Text(
                stringResource(R.string.change_password_result_note),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
