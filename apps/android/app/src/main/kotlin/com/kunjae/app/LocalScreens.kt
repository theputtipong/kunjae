package com.kunjae.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
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
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import com.kunjae.app.ui.KIcons
import com.kunjae.app.ui.KunjaeMark
import com.kunjae.app.ui.MessageBanner
import com.kunjae.app.ui.kunjaeButtonColors
import com.kunjae.client.LOCAL_MIN_PASSWORD_LENGTH

@Composable
private fun PasswordField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    supporting: String? = null,
    isError: Boolean = false,
    visible: Boolean = false,
    onToggleVisible: (() -> Unit)? = null,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        supportingText = supporting?.let { { Text(it) } },
        isError = isError,
        singleLine = true,
        visualTransformation = if (visible) VisualTransformation.None else PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, autoCorrectEnabled = false),
        trailingIcon = onToggleVisible?.let { toggle ->
            {
                IconButton(onClick = toggle) {
                    Icon(
                        if (visible) KIcons.VisibilityOff else KIcons.Visibility,
                        contentDescription = stringResource(if (visible) R.string.cd_hide_password else R.string.cd_show_password),
                    )
                }
            }
        },
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun BrandHeader() {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        KunjaeMark(40.dp, description = stringResource(R.string.cd_locked))
        Text("Kunjae", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun BusyLabel(busy: Boolean, idle: String) {
    if (busy) {
        CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
        Spacer(Modifier.size(12.dp))
        Text(stringResource(R.string.unlock_deriving))
    } else {
        Icon(KIcons.Lock, contentDescription = null, modifier = Modifier.size(18.dp))
        Spacer(Modifier.size(8.dp))
        Text(idle)
    }
}

@Composable
fun StartScreen(onStartLocal: () -> Unit, onSignIn: () -> Unit, onHelp: () -> Unit) {
    val activity = LocalContext.current as? Activity
    val origin = BuildConfig.WEB_ORIGIN

    Column(
        modifier = Modifier
            .fillMaxSize()
            .safeDrawingPadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Spacer(Modifier.height(24.dp))
        KunjaeMark(96.dp, modifier = Modifier.align(Alignment.CenterHorizontally), description = stringResource(R.string.app_name))
        Text(
            stringResource(R.string.start_title),
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
        Text(
            stringResource(R.string.start_subtitle),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))

        Button(
            onClick = onStartLocal,
            colors = kunjaeButtonColors(),
            modifier = Modifier.fillMaxWidth().height(52.dp),
        ) { Text(stringResource(R.string.start_local)) }
        Text(
            stringResource(R.string.start_local_body),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )

        OutlinedButton(onClick = onSignIn, modifier = Modifier.fillMaxWidth().height(52.dp)) {
            Text(stringResource(R.string.start_sign_in))
        }
        Text(
            stringResource(R.string.start_sign_in_body),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )

        if (origin.isNotEmpty()) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                Text(
                    stringResource(R.string.start_web_note),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    origin.removePrefix("https://").removePrefix("http://"),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary,
                    textDecoration = TextDecoration.Underline,
                    modifier = Modifier
                        .clickable {
                            runCatching { activity?.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(origin))) }
                        }
                        .padding(8.dp),
                )
            }
        } else {
            Text(
                stringResource(R.string.start_web_note_plain),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        TextButton(onClick = onHelp, modifier = Modifier.align(Alignment.CenterHorizontally)) {
            Text(stringResource(R.string.how_it_works))
        }

        AgreementNote()
    }
}

@Composable
fun CreateLocalScreen(state: VaultViewModel.UiState, model: VaultViewModel, onBack: () -> Unit) {
    var password by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    var visible by remember { mutableStateOf(false) }
    var acknowledged by remember { mutableStateOf(false) }

    val clearAll = {
        password = ""
        confirm = ""
        visible = false
    }
    BackHandler(enabled = !state.busy) {
        clearAll()
        onBack()
    }

    val tooShort = password.isNotEmpty() && password.length < LOCAL_MIN_PASSWORD_LENGTH
    val mismatch = confirm.isNotEmpty() && confirm != password
    val ready = !state.busy && acknowledged && password.length >= LOCAL_MIN_PASSWORD_LENGTH && confirm == password

    Column(
        modifier = Modifier
            .fillMaxSize()
            .safeDrawingPadding()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Spacer(Modifier.height(8.dp))
        BrandHeader()
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(stringResource(R.string.local_create_title), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            Text(
                stringResource(R.string.local_create_subtitle),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        PasswordField(
            value = password,
            onValueChange = { password = it },
            label = stringResource(R.string.local_password_label),
            supporting = stringResource(if (tooShort) R.string.change_password_too_short else R.string.change_password_new_hint),
            isError = tooShort,
            visible = visible,
            onToggleVisible = { visible = !visible },
        )
        PasswordField(
            value = confirm,
            onValueChange = { confirm = it },
            label = stringResource(R.string.local_password_confirm),
            supporting = if (mismatch) stringResource(R.string.change_password_mismatch) else null,
            isError = mismatch,
            visible = visible,
        )

        Surface(
            shape = MaterialTheme.shapes.large,
            color = MaterialTheme.colorScheme.surfaceContainer,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                WarningLine(R.string.local_warn_forget)
                WarningLine(R.string.local_warn_device)
                WarningLine(R.string.local_warn_account)
            }
        }

        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth().clickable { acknowledged = !acknowledged },
        ) {
            Checkbox(checked = acknowledged, onCheckedChange = { acknowledged = it })
            Text(stringResource(R.string.local_ack), style = MaterialTheme.typography.bodyMedium)
        }

        MessageBanner(state.message.asString(), onDismiss = model::dismissMessage)

        Button(
            onClick = {
                model.createLocal(password)
                clearAll()
            },
            enabled = ready,
            colors = kunjaeButtonColors(),
            modifier = Modifier.fillMaxWidth().height(52.dp),
        ) { BusyLabel(state.busy, stringResource(R.string.local_create_action)) }

        if (state.busy) {
            Text(
                stringResource(R.string.unlock_argon_note),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        TextButton(onClick = { clearAll(); onBack() }, enabled = !state.busy, modifier = Modifier.align(Alignment.CenterHorizontally)) {
            Text(stringResource(R.string.onboarding_back))
        }
    }
}

@Composable
private fun WarningLine(text: Int) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
        Icon(KIcons.Info, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
        Text(stringResource(text), style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
fun LocalUnlockScreen(
    state: VaultViewModel.UiState,
    model: VaultViewModel,
    onSignIn: () -> Unit,
    onHelp: () -> Unit,
) {
    var password by remember { mutableStateOf("") }
    var visible by remember { mutableStateOf(false) }
    var forgot by remember { mutableStateOf(false) }

    val activity = LocalContext.current as? Activity

    LaunchedEffect(Unit) { activity?.let { model.checkRemembered(it) } }

    val canBiometric = state.localRemembered && activity != null && BiometricGate.isAvailable(activity)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .safeDrawingPadding()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Spacer(Modifier.height(8.dp))
        BrandHeader()
        LocalChip()
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(stringResource(R.string.local_unlock_title), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            Text(
                stringResource(R.string.local_unlock_subtitle),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        if (canBiometric && activity != null) {
            Button(
                onClick = {
                    val cipher = BiometricVault.beginRecall(activity, BiometricVault.Slot.LOCAL)
                    if (cipher == null) {
                        model.checkRemembered(activity)
                        return@Button
                    }
                    BiometricGate.authenticate(
                        activity,
                        cipher,
                        title = activity.getString(R.string.biometric_unlock_title),
                        subtitle = activity.getString(R.string.biometric_unlock_subtitle),
                    ) { outcome ->
                        when (outcome) {
                            is BiometricGate.Outcome.Approved -> model.resumeLocalFromBiometric(activity, outcome.cipher)
                            is BiometricGate.Outcome.Refused -> Unit
                        }
                    }
                },
                enabled = !state.busy,
                colors = kunjaeButtonColors(),
                modifier = Modifier.fillMaxWidth().height(52.dp),
            ) {
                Icon(KIcons.Shield, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.size(8.dp))
                Text(stringResource(R.string.unlock_with_fingerprint))
            }
        }

        PasswordField(
            value = password,
            onValueChange = { password = it },
            label = stringResource(R.string.local_password_label),
            visible = visible,
            onToggleVisible = { visible = !visible },
        )

        if (!BuildConfig.DEBUG && IntegrityGuard.rooted()) {
            MessageBanner(stringResource(R.string.rooted_warning))
        }

        MessageBanner(state.message.asString(), onDismiss = model::dismissMessage)

        val onUnlock = {
            model.unlockLocal(password)
            password = ""
            visible = false
        }
        val canSubmit = !state.busy && password.isNotEmpty()

        if (canBiometric) {
            OutlinedButton(onClick = onUnlock, enabled = canSubmit, modifier = Modifier.fillMaxWidth().height(52.dp)) {
                BusyLabel(state.busy, stringResource(R.string.unlock_action))
            }
        } else {
            Button(onClick = onUnlock, enabled = canSubmit, colors = kunjaeButtonColors(), modifier = Modifier.fillMaxWidth().height(52.dp)) {
                BusyLabel(state.busy, stringResource(R.string.unlock_action))
            }
        }

        if (state.busy) {
            Text(
                stringResource(R.string.unlock_argon_note),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        OutlinedButton(onClick = onSignIn, enabled = !state.busy, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.local_sign_in_instead))
        }

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            TextButton(onClick = { forgot = true }, enabled = !state.busy) { Text(stringResource(R.string.local_forgot)) }
            TextButton(onClick = onHelp) { Text(stringResource(R.string.how_it_works)) }
        }
    }

    if (forgot && activity != null) {
        DeleteLocalDialog(
            onDismiss = { forgot = false },
            onConfirm = {
                forgot = false
                model.deleteLocal(activity)
            },
        )
    }
}

@Composable
fun LocalChip() {
    Surface(shape = MaterialTheme.shapes.small, color = MaterialTheme.colorScheme.secondaryContainer) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Icon(KIcons.Shield, contentDescription = null, tint = MaterialTheme.colorScheme.onSecondaryContainer, modifier = Modifier.size(12.dp))
            Text(
                stringResource(R.string.local_chip),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSecondaryContainer,
            )
        }
    }
}

@Composable
fun LocalModeBanner(onSignIn: () -> Unit) {
    Surface(
        shape = MaterialTheme.shapes.medium,
        color = MaterialTheme.colorScheme.surfaceContainer,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier.padding(start = 16.dp, end = 4.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(KIcons.Info, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp))
            Text(
                stringResource(R.string.local_banner),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.weight(1f),
            )
            TextButton(onClick = onSignIn) { Text(stringResource(R.string.local_banner_action)) }
        }
    }
}

@Composable
fun DeleteLocalDialog(onDismiss: () -> Unit, onConfirm: () -> Unit) {
    val word = stringResource(R.string.local_delete_word)
    var typed by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.local_delete_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(stringResource(R.string.local_delete_body))
                OutlinedTextField(
                    value = typed,
                    onValueChange = { typed = it },
                    label = { Text(stringResource(R.string.local_delete_type, word)) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(autoCorrectEnabled = false),
                )
            }
        },
        confirmButton = {
            TextButton(onClick = onConfirm, enabled = typed.trim() == word) {
                Text(stringResource(R.string.action_delete), color = MaterialTheme.colorScheme.error)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_cancel)) } },
    )
}

@Composable
fun MigrationDialogs(state: VaultViewModel.UiState, model: VaultViewModel) {
    val count = state.migrationOffer ?: return
    val activity = LocalContext.current as? Activity ?: return

    var askPassword by remember { mutableStateOf(false) }
    var password by remember { mutableStateOf("") }
    var visible by remember { mutableStateOf(false) }

    val close = {
        password = ""
        visible = false
        askPassword = false
        model.dismissMigration()
    }

    if (!askPassword) {
        AlertDialog(
            onDismissRequest = close,
            title = { Text(stringResource(R.string.migrate_title)) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(pluralStringResource(R.plurals.migrate_question, count, count))
                    Text(
                        stringResource(R.string.migrate_detail),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            },
            confirmButton = { TextButton(onClick = { askPassword = true }) { Text(stringResource(R.string.migrate_action)) } },
            dismissButton = { TextButton(onClick = close) { Text(stringResource(R.string.migrate_not_now)) } },
        )
    } else {
        AlertDialog(
            onDismissRequest = close,
            title = { Text(stringResource(R.string.migrate_password_title)) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(stringResource(R.string.migrate_password_body))
                    PasswordField(
                        value = password,
                        onValueChange = { password = it },
                        label = stringResource(R.string.local_password_label),
                        visible = visible,
                        onToggleVisible = { visible = !visible },
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        val entered = password
                        password = ""
                        visible = false
                        askPassword = false
                        model.migrateLocal(activity, entered)
                    },
                    enabled = password.isNotEmpty() && !state.busy,
                ) { Text(stringResource(R.string.migrate_action)) }
            },
            dismissButton = { TextButton(onClick = close) { Text(stringResource(R.string.migrate_not_now)) } },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocalChangePasswordScreen(state: VaultViewModel.UiState, model: VaultViewModel, onDone: () -> Unit) {
    val activity = LocalContext.current as? Activity ?: return

    var current by remember { mutableStateOf("") }
    var next by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }

    val clearAll = {
        current = ""
        next = ""
        confirm = ""
    }
    val cancel = {
        clearAll()
        onDone()
    }
    BackHandler(onBack = cancel)

    val tooShort = next.isNotEmpty() && next.length < LOCAL_MIN_PASSWORD_LENGTH
    val mismatch = confirm.isNotEmpty() && confirm != next
    val ready = !state.busy && current.isNotEmpty() && next.length >= LOCAL_MIN_PASSWORD_LENGTH && confirm == next

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.local_change_password)) },
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
            MessageBanner(stringResource(R.string.local_change_warning))
            PasswordField(current, { current = it }, stringResource(R.string.change_password_current))
            PasswordField(
                next,
                { next = it },
                stringResource(R.string.change_password_new),
                supporting = stringResource(if (tooShort) R.string.change_password_too_short else R.string.change_password_new_hint),
                isError = tooShort,
            )
            PasswordField(
                confirm,
                { confirm = it },
                stringResource(R.string.change_password_confirm),
                supporting = if (mismatch) stringResource(R.string.change_password_mismatch) else null,
                isError = mismatch,
            )
            Button(
                onClick = {
                    model.changeLocalPassword(activity, current, next)
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
