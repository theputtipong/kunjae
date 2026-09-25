package com.kunjae.app

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.kunjae.app.ui.IconBadge
import com.kunjae.app.ui.KIcons
import com.kunjae.app.ui.KunjaeMark
import com.kunjae.app.ui.kunjaeButtonColors

object OnboardingPrefs {
    private const val FILE = "kunjae.prefs"
    private const val KEY_SEEN = "onboarding.seen.v1"

    fun seen(context: Context): Boolean =
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getBoolean(KEY_SEEN, false)

    fun markSeen(context: Context) {
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putBoolean(KEY_SEEN, true).apply()
    }
}

private data class Point(val icon: ImageVector, val title: String, val body: String)

private data class Page(val icon: ImageVector, val title: String, val points: List<Point>)

private fun signUpHint(): String =
    if (BuildConfig.DEBUG) {
        "build ทดสอบนี้ต่อกับ API บน Mac (${BuildConfig.API_BASE_URL}) — " +
            "รัน pnpm dev ใน apps/web แล้วเปิด http://127.0.0.1:5173"
    } else {
        "เปิดเว็บแอป Kunjae บนคอมพิวเตอร์หรือเบราว์เซอร์ของมือถือ แล้วกดสมัคร"
    }

private val welcome = listOf(
    Point(
        KIcons.Lock,
        "เข้ารหัสแบบ Zero-Knowledge",
        "ข้อมูลถูกเข้ารหัสและถอดรหัสในเครื่องนี้เท่านั้น — แม้แต่ผู้พัฒนาก็เปิดดูไม่ได้",
    ),
    Point(
        KIcons.Key,
        "กุญแจสองชั้น",
        "Master Password ที่คุณจำ + Secret Key ที่ระบบสุ่มให้ ต้องมีครบทั้งคู่จึงจะเปิดได้",
    ),
    Point(
        KIcons.Sync,
        "ซิงค์เฉพาะข้อมูลที่อ่านไม่ออก",
        "server เก็บและส่งต่อได้แค่ ciphertext ระหว่างเว็บกับมือถือของคุณ",
    ),
)

private fun pages(): List<Page> = listOf(
    Page(
        KIcons.Key,
        "กุญแจสองชิ้นของคุณ",
        listOf(
            Point(KIcons.Person, "Master Password", "รหัสผ่านที่คุณตั้งเองตอนสมัคร และจำไว้ในหัว — ไม่มีที่ไหนเก็บไว้ให้"),
            Point(
                KIcons.Key,
                "Secret Key",
                "รหัสยาว 128 บิตที่ระบบสุ่มให้ตอนสมัคร หน้าตาแบบ K1-UUUUUU-UUUUU-… (U แทนตัวอักษรจริง) " +
                    "ไม่ต้องจำ แต่ต้องเก็บไว้",
            ),
            Point(
                KIcons.Shield,
                "ทำไมต้องสองชิ้น",
                "ถ้ามีคนขโมยข้อมูลจาก server แล้วเดารหัสผ่านถูก ก็ยังเปิดไม่ได้ เพราะ Secret Key ไม่เคยถูกส่งขึ้น server",
            ),
        ),
    ),
    Page(
        KIcons.Note,
        "ไปเอามาจากไหน",
        listOf(
            Point(KIcons.Person, "ยังไม่มีบัญชี → สมัครบนเว็บก่อน", signUpHint()),
            Point(
                KIcons.Note,
                "เก็บ Emergency Kit",
                "หลังสมัคร เว็บจะแสดง Emergency Kit ครั้งเดียว ในนั้นมีอีเมลและ Secret Key — ดาวน์โหลดหรือพิมพ์เก็บไว้",
            ),
            Point(KIcons.Lock, "มีบัญชีแล้ว", "เปิด Emergency Kit แล้วกรอก อีเมล · Master Password · Secret Key ในหน้าปลดล็อก"),
        ),
    ),
    Page(
        KIcons.Info,
        "ก่อนเริ่ม",
        listOf(
            Point(
                KIcons.Info,
                "ไม่มีปุ่ม \"ลืมรหัสผ่าน\"",
                "ลืม Master Password หรือทำ Secret Key หาย = ข้อมูลหายถาวร ไม่มีใครกู้ให้ได้",
            ),
            Point(KIcons.Folder, "เก็บแยกกัน", "เก็บ Emergency Kit แยกจาก Master Password และอย่าเก็บไว้ใน Kunjae เอง"),
            Point(KIcons.Refresh, "ปลดล็อกใช้เวลาหลายวินาที", "ตั้งใจให้ช้า เพื่อให้การเดารหัสผ่านแพงเกินคุ้ม"),
            Point(KIcons.Shield, "ครั้งต่อไปใช้ลายนิ้วมือได้", "ปลดล็อกแล้วเปิด \"ปลดล็อกด้วยลายนิ้วมือ\" ในหน้าตั้งค่า"),
        ),
    ),
)

@Composable
fun OnboardingScreen(onDone: () -> Unit) {
    val details = remember { pages() }
    var index by remember { mutableStateOf(0) }
    val total = details.size + 1
    val last = index == total - 1

    Column(
        modifier = Modifier
            .fillMaxSize()
            .safeDrawingPadding()
            .padding(horizontal = 24.dp, vertical = 16.dp),
    ) {
        Column(
            modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            if (index == 0) {
                Spacer(Modifier.height(24.dp))
                KunjaeMark(112.dp, modifier = Modifier.align(Alignment.CenterHorizontally), description = "Kunjae")
                Text(
                    "ยินดีต้อนรับสู่ Kunjae",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
                Text(
                    "ตู้เซฟเก็บรหัสผ่าน โน้ตลับ และบัตร ที่มีแต่คุณถือกุญแจ",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
                welcome.forEach { PointRow(it) }
            } else {
                val page = details[index - 1]
                Spacer(Modifier.height(8.dp))
                IconBadge(page.icon, size = 64.dp)
                Text(page.title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
                Surface(
                    shape = MaterialTheme.shapes.large,
                    color = MaterialTheme.colorScheme.surfaceContainer,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        page.points.forEach { PointRow(it) }
                    }
                }
            }
        }

        PageDots(count = total, current = index, modifier = Modifier.align(Alignment.CenterHorizontally).padding(vertical = 16.dp))

        Button(
            onClick = { if (last) onDone() else index += 1 },
            colors = kunjaeButtonColors(),
            modifier = Modifier.fillMaxWidth().height(52.dp),
        ) {
            Text(
                when {
                    index == 0 -> "เริ่มต้นใช้งาน"
                    last -> "เข้าใจแล้ว — ไปหน้าปลดล็อก"
                    else -> "ถัดไป"
                },
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            if (index > 0) TextButton(onClick = { index -= 1 }) { Text("ย้อนกลับ") } else Spacer(Modifier)
            if (!last) TextButton(onClick = onDone) { Text("ข้าม") }
        }
    }
}

@Composable
private fun PointRow(point: Point) {
    Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.Top) {
        IconBadge(point.icon)
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(point.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Text(point.body, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun PageDots(count: Int, current: Int, modifier: Modifier = Modifier) {
    Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        repeat(count) { i ->
            Box(
                modifier = Modifier
                    .size(width = if (i == current) 24.dp else 8.dp, height = 8.dp)
                    .clip(CircleShape)
                    .background(
                        if (i == current) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.outlineVariant,
                    ),
            )
        }
    }
}
