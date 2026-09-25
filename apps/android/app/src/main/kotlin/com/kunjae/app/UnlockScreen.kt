package com.kunjae.app

import android.app.Activity
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
fun UnlockScreen(state: VaultViewModel.UiState, model: VaultViewModel, onHelp: () -> Unit) {
    var email by remember { mutableStateOf("") }
    var masterPassword by remember { mutableStateOf("") }
    var secretKey by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }

    val activity = LocalContext.current as? Activity

    LaunchedEffect(Unit) { activity?.let { model.checkRemembered(it) } }

    val canBiometric = state.remembered && activity != null && BiometricGate.isAvailable(activity)

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
            KunjaeMark(40.dp, description = "Kunjae — ล็อกอยู่")
            Text("Kunjae", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.SemiBold)
        }
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("ปลดล็อกคลังข้อมูลของคุณ", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            Text(
                "ทุกการถอดรหัสเกิดขึ้นในเครื่องนี้เท่านั้น",
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
                        title = "ปลดล็อก Kunjae",
                        subtitle = "ยืนยันตัวตนเพื่อใช้กุญแจที่เก็บไว้ในเครื่องนี้",
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
                Text("ปลดล็อกด้วยลายนิ้วมือ")
            }
            Text(
                "หรือกรอกด้วยตัวเองด้านล่าง",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.align(Alignment.CenterHorizontally),
            )
        }

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("อีเมล") },
            supportingText = { Text("อีเมลที่ใช้สมัครบนเว็บ") },
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
                    Text("กุญแจสองชิ้นของคุณ", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                }

                OutlinedTextField(
                    value = masterPassword,
                    onValueChange = { masterPassword = it },
                    label = { Text("Master Password") },
                    supportingText = { Text("รหัสผ่านที่คุณตั้งเองตอนสมัคร") },
                    singleLine = true,
                    visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    trailingIcon = {
                        IconButton(onClick = { showPassword = !showPassword }) {
                            Icon(
                                if (showPassword) KIcons.VisibilityOff else KIcons.Visibility,
                                contentDescription = if (showPassword) "ซ่อนรหัสผ่าน" else "แสดงรหัสผ่าน",
                            )
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                )

                OutlinedTextField(
                    value = secretKey,
                    onValueChange = { secretKey = it },
                    label = { Text("Secret Key") },
                    placeholder = { Text("K1-UUUUUU-UUUUU-UUUUU-UUUUU-UUUUU") },
                    supportingText = { Text("อยู่ใน Emergency Kit ที่ได้ตอนสมัคร — ขีดและช่องว่างไม่สำคัญ") },
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

        MessageBanner(state.message, onDismiss = model::dismissMessage)

        val unlockButton: @Composable () -> Unit = {
            if (state.busy) {
                CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                Spacer(Modifier.size(12.dp))
                Text("กำลังคำนวณกุญแจ…")
            } else {
                Icon(KIcons.Lock, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.size(8.dp))
                Text("ปลดล็อก")
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
                "Argon2id กำลังทำงาน — ความช้านี้คือสิ่งที่ทำให้การเดารหัสผ่านแพงเกินคุ้ม",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        TextButton(onClick = onHelp, modifier = Modifier.align(Alignment.CenterHorizontally)) {
            Text("ยังไม่มีบัญชี? / Secret Key คืออะไร?")
        }
    }
}
