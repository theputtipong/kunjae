package com.kunjae.client

import com.kunjae.crypto.CryptoResult
import org.json.JSONObject

private var passed = 0
private var failed = 0

private fun check(name: String, condition: Boolean) {
    if (condition) {
        passed += 1
        println("  ✔ $name")
    } else {
        failed += 1
        println("  ✘ $name")
    }
}

private const val NOW = "2026-01-01T00:00:00.000Z"

private const val SHA1_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
private const val SHA256_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA"
private const val SHA512_SECRET =
    "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNA"

private val RFC6238 = listOf(
    listOf("59", "94287082", "46119246", "90693936"),
    listOf("1111111109", "07081804", "68084774", "25091201"),
    listOf("1111111111", "14050471", "67062674", "99943326"),
    listOf("1234567890", "89005924", "91819424", "93441116"),
    listOf("2000000000", "69279037", "90698825", "38618901"),
    listOf("20000000000", "65353130", "77737706", "47863826"),
)

private fun login(
    totpSecret: String = "",
    totpAlgorithm: String? = null,
    totpDigits: Int? = null,
    totpPeriod: Int? = null,
) = LoginItem(
    title = "Site",
    username = "",
    password = "",
    totpSecret = totpSecret,
    createdAt = NOW,
    updatedAt = NOW,
    totpAlgorithm = totpAlgorithm,
    totpDigits = totpDigits,
    totpPeriod = totpPeriod,
)

private fun codeOf(item: LoginItem, nowMs: Long): String? =
    (loginTotpCode(item, nowMs) as? CryptoResult.Ok)?.value?.code

private fun parsed(uri: String): TotpConfig? = (parseOtpauthUri(uri) as? CryptoResult.Ok)?.value

fun main() {
    println("ตรวจ TOTP และลิงก์ otpauth:// ให้ตรงกับฝั่งเว็บ")

    println("\n── 1. เวกเตอร์ RFC 6238 ──")
    for ((seconds, sha1, sha256, sha512) in RFC6238) {
        val nowMs = seconds.toLong() * 1000
        check("SHA1 T=$seconds", codeOf(login(SHA1_SECRET, totpDigits = 8), nowMs) == sha1)
        check("SHA256 T=$seconds", codeOf(login(SHA256_SECRET, "SHA256", 8), nowMs) == sha256)
        check("SHA512 T=$seconds", codeOf(login(SHA512_SECRET, "SHA512", 8), nowMs) == sha512)
        check(
            "URI SHA256 T=$seconds",
            codeOf(login("otpauth://totp/Ex:a@b?secret=$SHA256_SECRET&algorithm=SHA256&digits=8"), nowMs) == sha256,
        )
        check(
            "URI SHA512 T=$seconds",
            codeOf(login("otpauth://totp/Ex:a@b?secret=$SHA512_SECRET&algorithm=sha512&digits=8&period=30"), nowMs) == sha512,
        )
    }

    println("\n── 2. รายการเก่า (มีแค่ความลับ base32) ──")
    val oldJson = JSONObject(
        """{"type":"login","title":"Old","notes":"","tags":[],"favorite":false,"customFields":[],""" +
            """"createdAt":"$NOW","updatedAt":"$NOW","username":"","password":"","urls":[],"totpSecret":"$SHA1_SECRET"}""",
    )
    val old = (itemFromJson(oldJson) as? CryptoResult.Ok)?.value as? LoginItem
    check("อ่านรายการเก่าได้", old != null)
    check("ไม่มีพารามิเตอร์ใหม่", old != null && old.totpAlgorithm == null && old.totpDigits == null && old.totpPeriod == null)
    check("ใช้ SHA1/6/30", old != null && codeOf(old, 59_000) == "287082")
    check("เขียนกลับไม่มีฟิลด์ใหม่", old != null && !itemToJson(old).has("totpAlgorithm") && !itemToJson(old).has("totpDigits"))
    check("ผ่านกติกา", old != null && invalidItemFields(old).isEmpty())

    println("\n── 3. ฟิลด์ใหม่ไปกลับผ่าน JSON ──")
    val rich = login(SHA1_SECRET, "SHA256", 8, 60)
    val back = (itemFromJson(itemToJson(rich)) as? CryptoResult.Ok)?.value
    check("ไปกลับได้ครบ", back == rich)
    check("JSON มีฟิลด์ครบ", itemToJson(rich).let { it.getString("totpAlgorithm") == "SHA256" && it.getInt("totpDigits") == 8 && it.getInt("totpPeriod") == 60 })

    println("\n── 4. แยกลิงก์ otpauth:// ──")
    check(
        "อ่านครบทุกพารามิเตอร์",
        parsed("otpauth://totp/ACME%20Co:john@example.com?secret=jbsw%20y3dp-ehpk3pxp&issuer=ACME%20Co&algorithm=SHA256&digits=8&period=60") ==
            TotpConfig("JBSWY3DPEHPK3PXP", "SHA256", 8, 60),
    )
    check("ค่าเริ่มต้นเมื่อไม่ระบุ", parsed("OTPAUTH://TOTP/label?secret=JBSWY3DPEHPK3PXP") == TotpConfig("JBSWY3DPEHPK3PXP", "SHA1", 6, 30))

    val invalidUris = listOf(
        "otpauth://hotp/label?secret=JBSWY3DPEHPK3PXP&counter=1",
        "otpauth://totp/label",
        "otpauth://totp/label?issuer=x",
        "otpauth://totp/label?secret=",
        "otpauth://totp/label?secret=JBSWY3DP!",
        "otpauth://totp/label?secret=JBSWY3DPEHPK3PXP&algorithm=MD5",
        "otpauth://totp/label?secret=JBSWY3DPEHPK3PXP&digits=5",
        "otpauth://totp/label?secret=JBSWY3DPEHPK3PXP&digits=9",
        "otpauth://totp/label?secret=JBSWY3DPEHPK3PXP&digits=six",
        "otpauth://totp/label?secret=JBSWY3DPEHPK3PXP&period=0",
        "otpauth://totp/label?secret=JBSWY3DPEHPK3PXP&period=301",
        "otpauth://totp/label?secret=%ZZ",
        "https://example.com/?secret=JBSWY3DPEHPK3PXP",
    )
    for (uri in invalidUris) check("ปฏิเสธ $uri", parseOtpauthUri(uri) is CryptoResult.Err)

    println("\n── 5. แปลงลิงก์ก่อนบันทึก ──")
    val normalized = normalizeItemTotp(login("otpauth://totp/x?secret=JBSWY3DPEHPK3PXP&algorithm=SHA512&digits=8&period=30"))
    check("เก็บเป็นความลับ + พารามิเตอร์ที่ไม่ใช่ค่าเริ่มต้น", normalized == login("JBSWY3DPEHPK3PXP", "SHA512", 8, null))
    val reset = normalizeItemTotp(login("otpauth://totp/x?secret=JBSWY3DPEHPK3PXP", "SHA256", 8, 60))
    check("ลิงก์ค่าเริ่มต้นล้างพารามิเตอร์เก่า", reset == login("JBSWY3DPEHPK3PXP"))
    check("ลิงก์เสีย → null", normalizeItemTotp(login("otpauth://totp/x?secret=!!")) == null)
    val plain = login("jbsw y3dp", totpPeriod = 60)
    check("ความลับธรรมดาไม่เปลี่ยน", normalizeItemTotp(plain) == plain)
    val note = SecureNoteItem("n", createdAt = NOW, updatedAt = NOW)
    check("รายการประเภทอื่นไม่เปลี่ยน", normalizeItemTotp(note) == note)

    println("\n── 6. กติกาฟิลด์ใหม่ ──")
    check("6/15/SHA1 ผ่าน", invalidItemFields(login(totpDigits = 6, totpPeriod = 15, totpAlgorithm = "SHA1")).isEmpty())
    check("8/300 ผ่าน", invalidItemFields(login(totpDigits = 8, totpPeriod = 300)).isEmpty())
    check("digits 5", invalidItemFields(login(totpDigits = 5)) == listOf("totpDigits"))
    check("digits 9", invalidItemFields(login(totpDigits = 9)) == listOf("totpDigits"))
    check("period 14", invalidItemFields(login(totpPeriod = 14)) == listOf("totpPeriod"))
    check("period 301", invalidItemFields(login(totpPeriod = 301)) == listOf("totpPeriod"))
    check("algorithm MD5", invalidItemFields(login(totpAlgorithm = "MD5")) == listOf("totpAlgorithm"))
    val badJson = itemToJson(login(SHA1_SECRET)).put("totpDigits", 6.5).put("totpAlgorithm", 1)
    val badItem = (itemFromJson(badJson) as? CryptoResult.Ok)?.value
    check("ค่าผิดชนิดจาก JSON ถูกจับได้", badItem != null && invalidItemFields(badItem) == listOf("totpAlgorithm", "totpDigits"))

    println("\n── 7. ความลับอ่านไม่ได้ ──")
    check("base32 เสีย", loginTotpCode(login("not base32!"), 0) is CryptoResult.Err)
    check("ลิงก์ไม่มีความลับ", loginTotpCode(login("otpauth://totp/x?secret="), 0) is CryptoResult.Err)

    println("\n═══ ผ่าน $passed / ล้มเหลว $failed ═══\n")
    if (failed > 0) kotlin.system.exitProcess(1)
}
