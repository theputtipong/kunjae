package com.kunjae.app

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
    onShowIntro: () -> Unit,
) {
    val activity = LocalContext.current as? Activity
    var creatingVault by remember { mutableStateOf(false) }

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
                title = { Text("ความปลอดภัยและการตั้งค่า") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(KIcons.Back, "กลับ") } },
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
            MessageBanner(state.message, onDismiss = model::dismissMessage)

            SectionCard(title = "บัญชี") {
                SettingsRow(KIcons.Person, state.email, "บัญชีที่ปลดล็อกอยู่")
            }

            SectionCard(title = "ความปลอดภัย") {
                activity?.let { BiometricRow(state, model, it) }
                SettingsRow(
                    KIcons.Key,
                    "เปลี่ยน Master Password",
                    "ต้องใช้ Secret Key · อุปกรณ์อื่นจะถูกออกจากระบบ",
                    enabled = !state.busy,
                    onClick = onChangePassword,
                    trailing = { Icon(KIcons.ChevronRight, contentDescription = null) },
                )
                SettingsRow(KIcons.Lock, "ล็อกอัตโนมัติ", "เมื่อไม่ได้ใช้งาน 15 นาที — ล้างกุญแจออกจากหน่วยความจำ")
                SettingsRow(KIcons.Lock, "ล็อกทันที", onClick = model::lock)
            }

            SectionCard(title = "ป้อนอัตโนมัติ (Autofill)") {
                SettingsRow(
                    KIcons.Shield,
                    if (autofillOn) "เปิดใช้อยู่" else "ตั้ง Kunjae เป็นบริการป้อนอัตโนมัติ",
                    if (autofillOn) "เติมรหัสผ่านในแอปและหน้าเว็บที่รองรับ — ต้องปลดล็อก Kunjae ไว้"
                    else "เปิดหน้าตั้งค่าของระบบให้เลือก Kunjae",
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

            SectionCard(title = "Vault") {
                state.vaults.forEach { vault ->
                    SettingsRow(KIcons.Folder, vault.name, "${vault.itemCount} รายการ")
                }
                SettingsRow(KIcons.Add, "สร้าง vault ใหม่", enabled = !state.busy, onClick = { creatingVault = true })
            }

            SectionCard(title = "ทำได้บนเว็บเท่านั้น") {
                SettingsRow(KIcons.Note, "Emergency Kit", "ดู Secret Key และพิมพ์เก็บ", enabled = false)
                SettingsRow(KIcons.Folder, "ส่งออก / นำเข้าไฟล์สำรอง", "ไฟล์เข้ารหัสด้วยรหัสผ่านที่ตั้งใหม่", enabled = false)
                SettingsRow(KIcons.Logout, "ออกจากระบบทุกอุปกรณ์", enabled = false)
                SettingsRow(KIcons.Delete, "ลบบัญชีถาวร", enabled = false)
            }

            SectionCard(title = "ช่วยเหลือ") {
                SettingsRow(KIcons.Info, "Kunjae ทำงานอย่างไร", "ดูหน้าแนะนำอีกครั้ง", onClick = onShowIntro)
                SettingsRow(KIcons.Info, "เวอร์ชัน", "${BuildConfig.VERSION_NAME}${if (BuildConfig.DEBUG) " (debug)" else ""}")
            }
        }
    }

    if (creatingVault) CreateVaultDialog(onDismiss = { creatingVault = false }, onCreate = model::createVaultNamed)
}

@Composable
private fun BiometricRow(state: VaultViewModel.UiState, model: VaultViewModel, activity: Activity) {
    if (!BiometricGate.isAvailable(activity)) {
        SettingsRow(
            KIcons.Shield,
            "ปลดล็อกด้วยลายนิ้วมือ",
            "เครื่องนี้ยังไม่ได้ตั้งลายนิ้วมือระดับ Strong — ตั้งในการตั้งค่าของระบบก่อน",
            enabled = false,
        )
        return
    }

    val toggle: () -> Unit = {
        if (state.remembered) {
            model.forgetSession(activity)
        } else {
            BiometricVault.beginRemember(activity)?.let { cipher ->
                BiometricGate.authenticate(
                    activity,
                    cipher,
                    title = "เปิดปลดล็อกด้วยลายนิ้วมือ",
                    subtitle = "ยืนยันตัวตนเพื่อเก็บกุญแจไว้ในชิปของเครื่องนี้",
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
        "ปลดล็อกด้วยลายนิ้วมือ",
        if (state.remembered) "เปิดอยู่ — กุญแจถูกห่อด้วยชิป Android Keystore ของเครื่องนี้"
        else "เก็บกุญแจที่คำนวณแล้วไว้ในชิป · ไม่เก็บ Master Password หรือ Secret Key",
        enabled = !state.busy,
        onClick = toggle,
        trailing = { Switch(checked = state.remembered, onCheckedChange = { toggle() }, enabled = !state.busy) },
    )
}

@Composable
private fun CreateVaultDialog(onDismiss: () -> Unit, onCreate: (String) -> Unit) {
    var name by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("สร้าง vault ใหม่") },
        text = {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("ชื่อ vault") },
                placeholder = { Text("เช่น งาน · ครอบครัว") },
                singleLine = true,
            )
        },
        confirmButton = {
            TextButton(onClick = {
                onCreate(name.trim())
                onDismiss()
            }, enabled = name.isNotBlank()) { Text("สร้าง") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("ยกเลิก") } },
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
                title = { Text("เปลี่ยน Master Password") },
                navigationIcon = { IconButton(onClick = cancel) { Icon(KIcons.Close, "ยกเลิก") } },
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
                "อุปกรณ์อื่นทุกเครื่องจะถูกออกจากระบบทันที และลายนิ้วมือที่จำไว้ในเครื่องนี้จะถูกลบ",
            )
            OutlinedTextField(
                value = current,
                onValueChange = { current = it },
                label = { Text("Master Password เดิม") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = next,
                onValueChange = { next = it },
                label = { Text("Master Password ใหม่") },
                supportingText = { Text(if (tooShort) "ต้องยาวอย่างน้อย 12 ตัวอักษร" else "อย่างน้อย 12 ตัวอักษร — วลียาวที่จำได้แข็งแรงกว่ารหัสสั้นที่ซับซ้อน") },
                isError = tooShort,
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = confirm,
                onValueChange = { confirm = it },
                label = { Text("พิมพ์ Master Password ใหม่อีกครั้ง") },
                supportingText = { if (mismatch) Text("รหัสผ่านทั้งสองช่องไม่ตรงกัน") },
                isError = mismatch,
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = secret,
                onValueChange = { secret = it },
                label = { Text("Secret Key") },
                supportingText = { Text("จาก Emergency Kit — ใช้ยืนยันก่อนห่อกุญแจใหม่ ถ้าผิดระบบจะปฏิเสธโดยไม่แตะข้อมูล") },
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
            ) { Text("เปลี่ยนรหัสผ่าน") }
            Text(
                "ผลลัพธ์จะแสดงที่หน้าตั้งค่า",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
