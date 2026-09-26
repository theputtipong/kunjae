package com.kunjae.app

import androidx.compose.ui.res.stringResource
import android.app.Activity
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.kunjae.app.ui.KIcons
import com.kunjae.app.ui.KunjaeMark
import com.kunjae.app.ui.kunjaeButtonColors
import com.kunjae.app.ui.MessageBanner

@Composable
fun UnlockScreen(state: VaultViewModel.UiState, model: VaultViewModel, onHelp: () -> Unit, onBack: (() -> Unit)? = null) {
    var email by remember { mutableStateOf("") }
    var masterPassword by remember { mutableStateOf("") }
    var secretKey by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }

    val activity = LocalContext.current as? Activity

    LaunchedEffect(Unit) { activity?.let { model.checkRemembered(it) } }

    val canBiometric = state.remembered && activity != null && BiometricGate.isAvailable(activity)

    if (onBack != null) BackHandler(enabled = !state.busy, onBack = onBack)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .safeDrawingPadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Spacer(Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            KunjaeMark(40.dp, description = stringResource(R.string.cd_locked))
            Text("Kunjae", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.SemiBold)
        }
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(stringResource(R.string.unlock_title), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            Text(
                stringResource(R.string.unlock_subtitle),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        if (canBiometric && activity != null) {
            Button(
                onClick = {
                    val cipher = BiometricVault.beginRecall(activity)
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
                            is BiometricGate.Outcome.Approved -> model.resumeFromBiometric(activity, outcome.cipher)
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
            Text(
                stringResource(R.string.unlock_or_manual),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.align(Alignment.CenterHorizontally),
            )
        }

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text(stringResource(R.string.label_email)) },
            supportingText = { Text(stringResource(R.string.email_hint)) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth(),
        )

        Surface(
            shape = MaterialTheme.shapes.large,
            color = MaterialTheme.colorScheme.surfaceContainer,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    KunjaeMark(18.dp, tile = false, color = MaterialTheme.colorScheme.primary)
                    Text(stringResource(R.string.keys_title), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                }

                OutlinedTextField(
                    value = masterPassword,
                    onValueChange = { masterPassword = it },
                    label = { Text(stringResource(R.string.master_password)) },
                    supportingText = { Text(stringResource(R.string.master_password_hint)) },
                    singleLine = true,
                    visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    trailingIcon = {
                        IconButton(onClick = { showPassword = !showPassword }) {
                            Icon(
                                if (showPassword) KIcons.VisibilityOff else KIcons.Visibility,
                                contentDescription = stringResource(if (showPassword) R.string.cd_hide_password else R.string.cd_show_password),
                            )
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                )

                OutlinedTextField(
                    value = secretKey,
                    onValueChange = { secretKey = it },
                    label = { Text(stringResource(R.string.secret_key)) },
                    placeholder = { Text("K1-UUUUUU-UUUUU-UUUUU-UUUUU-UUUUU") },
                    supportingText = { Text(stringResource(R.string.secret_key_hint)) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        capitalization = KeyboardCapitalization.Characters,
                        autoCorrectEnabled = false,
                    ),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }

        if (!BuildConfig.DEBUG && IntegrityGuard.rooted()) {
            MessageBanner(stringResource(R.string.rooted_warning))
        }

        MessageBanner(state.message.asString(), onDismiss = model::dismissMessage)

        val unlockButton: @Composable () -> Unit = {
            if (state.busy) {
                CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                Spacer(Modifier.size(12.dp))
                Text(stringResource(R.string.unlock_deriving))
            } else {
                Icon(KIcons.Lock, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.size(8.dp))
                Text(stringResource(R.string.unlock_action))
            }
        }
        val onUnlock = {
            model.unlock(email, masterPassword, secretKey)
            masterPassword = ""
            secretKey = ""
            showPassword = false
        }
        val canSubmit = !state.busy && email.isNotBlank() && masterPassword.isNotEmpty() && secretKey.isNotBlank()

        if (canBiometric) {
            OutlinedButton(onClick = onUnlock, enabled = canSubmit, modifier = Modifier.fillMaxWidth().height(52.dp)) { unlockButton() }
        } else {
            Button(onClick = onUnlock, enabled = canSubmit, colors = kunjaeButtonColors(), modifier = Modifier.fillMaxWidth().height(52.dp)) { unlockButton() }
        }

        if (state.busy) {
            Text(
                stringResource(R.string.unlock_argon_note),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        TextButton(onClick = onHelp, modifier = Modifier.align(Alignment.CenterHorizontally)) {
            Text(stringResource(R.string.unlock_help))
        }

        if (onBack != null) {
            TextButton(onClick = onBack, enabled = !state.busy, modifier = Modifier.align(Alignment.CenterHorizontally)) {
                Text(stringResource(if (state.localExists) R.string.local_back_to_device else R.string.onboarding_back))
            }
        }
    }
}
