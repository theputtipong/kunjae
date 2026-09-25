package com.kunjae.app

import android.app.Activity
import android.os.Bundle
import android.util.Log
import android.widget.ScrollView
import android.widget.TextView
import com.kunjae.crypto.Argon2Params
import com.kunjae.crypto.CryptoResult
import com.kunjae.crypto.deriveKeyFromPassword
import com.kunjae.crypto.wipe
import kotlin.concurrent.thread

class Argon2BenchActivity : Activity() {

    private companion object {
        const val TAG = "KunjaeArgon2Bench"

        const val WARMUP = 1

        const val ROUNDS = 5
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val output = TextView(this).apply { setPadding(32, 64, 32, 32) }
        setContentView(ScrollView(this).apply { addView(output) })

        output.text = "กำลังวัด…"

        thread {
            val report = StringBuilder()
            report.appendLine("Argon2id — เวลาต่อการปลดล็อกหนึ่งครั้ง")
            report.appendLine("คอร์ที่ใช้ได้: ${Runtime.getRuntime().availableProcessors()}")
            report.appendLine()

            val cases = listOf(
                "ค่าปัจจุบัน (64 MiB, 3 รอบ)" to Argon2Params(65_536, 3, 1, 32),
                "ครึ่งหนึ่งของหน่วยความจำ (32 MiB, 3 รอบ)" to Argon2Params(32_768, 3, 1, 32),
                "ลดรอบลง (64 MiB, 2 รอบ)" to Argon2Params(65_536, 2, 1, 32),
                "เบาที่สุดที่ยังยอมรับ (32 MiB, 2 รอบ)" to Argon2Params(32_768, 2, 1, 32),
            )

            for ((label, params) in cases) {
                val times = measure(params)
                val line = "%-42s ต่ำสุด %5d ms · กลาง %5d ms · สูงสุด %5d ms"
                    .format(label, times.first(), times[times.size / 2], times.last())

                Log.i(TAG, line)
                report.appendLine(line)
                runOnUiThread { output.text = report.toString() }
            }

            Log.i(TAG, "วัดเสร็จ")
            runOnUiThread { output.text = report.toString() + "\nวัดเสร็จ" }
        }
    }

    private fun measure(params: Argon2Params): List<Long> {
        val password = "รหัสผ่านหลักตัวอย่างที่ยาวพอสมควร-2026".toByteArray(Charsets.UTF_8)
        val salt = ByteArray(32) { it.toByte() }

        repeat(WARMUP) { runOnce(password, salt, params) }

        return (1..ROUNDS).map { runOnce(password, salt, params) }.sorted()
    }

    private fun runOnce(password: ByteArray, salt: ByteArray, params: Argon2Params): Long {
        val startedAt = System.nanoTime()
        val derived = deriveKeyFromPassword(password, salt, params)
        val elapsed = (System.nanoTime() - startedAt) / 1_000_000

        if (derived is CryptoResult.Ok) wipe(derived.value)

        return elapsed
    }
}
