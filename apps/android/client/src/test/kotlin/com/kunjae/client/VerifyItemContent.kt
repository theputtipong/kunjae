package com.kunjae.client

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

private const val NOW = "2026-11-08T10:00:00.000Z"

private fun login(
    title: String = "GitHub",
    username: String = "me",
    password: String = "pw",
    urls: List<String> = listOf("https://github.com"),
    totpSecret: String = "",
    notes: String = "",
    tags: List<String> = emptyList(),
    customFields: List<CustomField> = emptyList(),
    createdAt: String = NOW,
    updatedAt: String = NOW,
) = LoginItem(title, username, password, urls, totpSecret, notes, false, tags, customFields, createdAt, updatedAt)

private fun card(
    number: String = "4242424242424242",
    month: String = "",
    year: String = "",
    cvc: String = "",
    holder: String = "",
) = CardItem("Visa", holder, number, month, year, cvc, createdAt = NOW, updatedAt = NOW)

private fun fields(item: VaultItem) = invalidItemFields(item)

fun main() {
    println("ตรวจว่ารายการที่ Android บันทึกผ่านกติกาเดียวกับ ItemContentSchema")

    println("\n── 1. รายการปกติ ──")
    check("login ปกติผ่าน", fields(login()).isEmpty())
    check("note ปกติผ่าน", fields(SecureNoteItem("n", "x", createdAt = NOW, updatedAt = NOW)).isEmpty())
    check("card ว่างผ่าน", fields(card(number = "")).isEmpty())
    check("card ครบผ่าน", fields(card(month = "01", year = "2030", cvc = "123", holder = "A")).isEmpty())
    check("isoInstant ผ่าน", fields(login(createdAt = isoInstant(0), updatedAt = isoInstant(1_800_000_000_000))).isEmpty())
    check("offset +07:00 ผ่าน", fields(login(createdAt = "2026-11-08T17:00:00+07:00")).isEmpty())

    println("\n── 2. ชื่อรายการ ──")
    check("ชื่อว่าง → title", fields(login(title = "")) == listOf("title"))
    check("ชื่อ 200 ตัวผ่าน", fields(login(title = "a".repeat(200))).isEmpty())
    check("ชื่อ 201 ตัว → title", fields(login(title = "a".repeat(201))) == listOf("title"))

    println("\n── 3. บัตร ──")
    check("เดือน 1 → expiryMonth", fields(card(month = "1")) == listOf("expiryMonth"))
    check("เดือน 13 → expiryMonth", fields(card(month = "13")) == listOf("expiryMonth"))
    check("เดือน 00 → expiryMonth", fields(card(month = "00")) == listOf("expiryMonth"))
    check("เดือน 12 ผ่าน", fields(card(month = "12")).isEmpty())
    check("ปี 30 → expiryYear", fields(card(year = "30")) == listOf("expiryYear"))
    check("ปีเลขไทย → expiryYear", fields(card(year = "๒๐๓๐")) == listOf("expiryYear"))
    check("ปี 2030 ผ่าน", fields(card(year = "2030")).isEmpty())
    check("เลขบัตร 33 ตัว → number", fields(card(number = "1".repeat(33))) == listOf("number"))
    check("CVC 9 ตัว → securityCode", fields(card(cvc = "1".repeat(9))) == listOf("securityCode"))
    check("ชื่อผู้ถือ 201 → cardholderName", fields(card(holder = "a".repeat(201))) == listOf("cardholderName"))

    println("\n── 4. login ──")
    check("username 513 → username", fields(login(username = "a".repeat(513))) == listOf("username"))
    check("password 1025 → password", fields(login(password = "a".repeat(1025))) == listOf("password"))
    check("password 1024 ผ่าน", fields(login(password = "a".repeat(1024))).isEmpty())
    check("url ว่าง → urls.0", fields(login(urls = listOf(""))) == listOf("urls.0"))
    check("url 2049 → urls.0", fields(login(urls = listOf("a".repeat(2049)))) == listOf("urls.0"))
    check("url 33 อัน → urls", fields(login(urls = List(33) { "a" })) == listOf("urls"))
    check("totp 257 → totpSecret", fields(login(totpSecret = "A".repeat(257))) == listOf("totpSecret"))

    println("\n── 5. ฟิลด์ร่วม ──")
    check("notes 10001 → notes", fields(login(notes = "a".repeat(10_001))) == listOf("notes"))
    check("tag ว่าง → tags.0", fields(login(tags = listOf(""))) == listOf("tags.0"))
    check("tag 41 → tags.0", fields(login(tags = listOf("a".repeat(41)))) == listOf("tags.0"))
    check("tag 25 อัน → tags", fields(login(tags = List(25) { "t" })) == listOf("tags"))
    check("custom name ว่าง → customFields.0.name", fields(login(customFields = listOf(CustomField("", "v", false)))) == listOf("customFields.0.name"))
    check("custom value 2049 → customFields.0.value", fields(login(customFields = listOf(CustomField("n", "a".repeat(2049), false)))) == listOf("customFields.0.value"))
    check("custom 49 อัน → customFields", fields(login(customFields = List(49) { CustomField("n", "", false) })) == listOf("customFields"))
    check("createdAt ว่าง → createdAt", fields(login(createdAt = "")) == listOf("createdAt"))
    check("วันที่ไม่มีจริง → updatedAt", fields(login(updatedAt = "2026-02-30T00:00:00Z")) == listOf("updatedAt"))
    check("ไม่มีวินาที → createdAt", fields(login(createdAt = "2026-11-08T10:00Z")) == listOf("createdAt"))
    check("ไม่มีโซนเวลา → createdAt", fields(login(createdAt = "2026-11-08T10:00:00")) == listOf("createdAt"))
    check("29 ก.พ. ปีอธิกสุรทินผ่าน", fields(login(createdAt = "2028-02-29T00:00:00Z")).isEmpty())

    println("\n── 6. ⭐ ด่านสุดท้ายก่อนเข้ารหัส ──")
    val key = ByteArray(32) { it.toByte() }
    check("รายการปกติเข้ารหัสได้", sealItem(key, "01JBCDEFGHJKMNPQRSTVWXYZ00", 1, login()) is com.kunjae.crypto.CryptoResult.Ok)
    check("⭐ เดือนผิด → ไม่เข้ารหัส", sealItem(key, "01JBCDEFGHJKMNPQRSTVWXYZ00", 1, card(month = "13")) is com.kunjae.crypto.CryptoResult.Err)
    check("⭐ ชื่อว่าง → ไม่เข้ารหัส", sealItem(key, "01JBCDEFGHJKMNPQRSTVWXYZ00", 1, login(title = "")) is com.kunjae.crypto.CryptoResult.Err)
    val huge = login(notes = "ก".repeat(10_000), customFields = List(10) { CustomField("n", "ก".repeat(2048), false) })
    check("⭐ เกิน 32768 ไบต์ → content", fields(huge) == listOf("content"))
    check("⭐ เกิน 32768 ไบต์ → ไม่เข้ารหัส", sealItem(key, "01JBCDEFGHJKMNPQRSTVWXYZ00", 1, huge) is com.kunjae.crypto.CryptoResult.Err)

    println("\n═══ ผ่าน $passed / ล้มเหลว $failed ═══\n")
    if (failed > 0) kotlin.system.exitProcess(1)
}
