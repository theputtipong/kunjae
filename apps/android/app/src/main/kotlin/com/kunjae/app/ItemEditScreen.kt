package com.kunjae.app

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
                title = { Text(if (itemId == null) "รายการใหม่" else "แก้ไขรายการ") },
                navigationIcon = { IconButton(onClick = cancel) { Icon(KIcons.Close, "ยกเลิก") } },
                actions = {
                    TextButton(onClick = save, enabled = !state.busy && title.isNotBlank()) { Text("บันทึก") }
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
                        ) { Text(label) }
                    }
                }

                val target = state.activeVaultId?.let { id -> state.vaults.firstOrNull { it.vaultId == id }?.name }
                    ?: state.vaults.firstOrNull()?.name
                if (state.vaults.size > 1 && target != null) {
                    Text(
                        "จะบันทึกลง vault: $target — เปลี่ยนได้จากตัวเลือก vault ในหน้ารายการ",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                label = { Text("ชื่อรายการ") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            if (typeName == "login") {
                OutlinedTextField(
                    value = username,
                    onValueChange = { username = it },
                    label = { Text("ชื่อผู้ใช้") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("รหัสผ่าน") },
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
                            }) { Icon(KIcons.Refresh, "สร้างรหัสผ่านให้") }
                            IconButton(onClick = { showPassword = !showPassword }) {
                                Icon(if (showPassword) KIcons.VisibilityOff else KIcons.Visibility, if (showPassword) "ซ่อน" else "แสดง")
                            }
                        }
                    },
                    supportingText = { Text("กดไอคอนลูกศรวนเพื่อสร้างรหัสผ่านที่แข็งแรง") },
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = url,
                    onValueChange = { url = it },
                    label = { Text("เว็บไซต์") },
                    placeholder = { Text("github.com") },
                    supportingText = { Text("autofill เทียบโดเมนตรงตัว — ใส่ให้ตรงกับหน้าเข้าสู่ระบบ") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = totpSecret,
                    onValueChange = { totpSecret = it },
                    label = { Text("ความลับ TOTP (ไม่บังคับ)") },
                    supportingText = { Text("รหัสตั้งค่า 2FA จากเว็บไซต์ หรือลิงก์ otpauth://") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, autoCorrectEnabled = false),
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            if (typeName == "card") {
                OutlinedTextField(
                    value = holder,
                    onValueChange = { holder = it },
                    label = { Text("ชื่อบนบัตร") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = number,
                    onValueChange = { number = it },
                    label = { Text("เลขบัตร") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = month,
                        onValueChange = { month = it },
                        label = { Text("เดือน") },
                        placeholder = { Text("MM") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f),
                    )
                    OutlinedTextField(
                        value = year,
                        onValueChange = { year = it },
                        label = { Text("ปี") },
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
                label = { Text(if (typeName == "secure-note") "เนื้อหา" else "โน้ต") },
                minLines = if (typeName == "secure-note") 6 else 3,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
