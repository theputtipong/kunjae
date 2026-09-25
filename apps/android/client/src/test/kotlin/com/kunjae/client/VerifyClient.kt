package com.kunjae.client

import com.kunjae.crypto.CryptoResult
import java.time.Instant

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

private fun <T> valueOf(result: CryptoResult<T>): T? = when (result) {
    is CryptoResult.Ok -> result.value
    is CryptoResult.Err -> null
}

fun main() {
    val apiBaseUrl = System.getenv("KUNJAE_API") ?: "http://127.0.0.1:8787"
    val api = ApiClient(apiBaseUrl)

    println("ตรวจชั้น client ของ Android กับ API จริงที่ $apiBaseUrl")

    val email = "android-${System.currentTimeMillis()}@example.co"
    val password = "รหัสผ่านหลักที่ยาวพอสำหรับทดสอบ"

    println("\n── 1. สมัครสมาชิกจาก Kotlin ──")
    val kit = valueOf(signUp(api, email, password))
    check("สมัครสำเร็จ", kit != null)
    if (kit == null) { report(); return }
    check("ได้ Secret Key รูปแบบ K1-…", Regex("^K1-[0-9A-HJKMNP-TV-Z-]+$").matches(kit.secretKey))

    println("\n── 2. เข้าสู่ระบบและดึงข้อมูล ──")
    val session = valueOf(Session.unlock(api, email, password, kit.secretKey))
    check("ปลดล็อกสำเร็จ", session != null)
    if (session == null) { report(); return }
    check("ได้กุญแจของ vault ใบแรก", session.vaultIds().size == 1)

    val state = valueOf(pull(api, session))
    check("ดึงข้อมูลสำเร็จ", state != null)
    check("⭐ ถอดชื่อ vault ที่ Kotlin เข้ารหัสไว้เองได้", state?.vaults?.values?.first()?.name == "ส่วนตัว")

    println("\n── 3. เก็บรหัสผ่านและอ่านกลับ ──")
    val vaultId = session.vaultIds().first()
    val itemId = valueOf(createUlid(System.currentTimeMillis()))
    check("สร้าง id ของรายการได้", itemId != null)
    if (itemId == null) { report(); return }

    val now = Instant.now().toString()
    val secretPassword = "รหัสผ่านลับมาก-Aa1!-ที่ต้องกลับมาเหมือนเดิม"
    val item = LoginItem(
        title = "ธนาคารจากมือถือ",
        username = "somchai",
        password = secretPassword,
        urls = listOf("https://bank.example"),
        createdAt = now,
        updatedAt = now,
    )

    fun loginAt(state: VaultState?, id: String): LoginItem? =
        state?.items?.get(id)?.item as? LoginItem

    val version = valueOf(saveItem(api, session, itemId, vaultId, 0, item))
    check("บันทึกรายการสำเร็จ", version == 1)

    val afterSave = valueOf(pull(api, session))
    check("ดึงกลับมาแล้วเจอรายการ", afterSave?.items?.containsKey(itemId) == true)
    check("⭐ รหัสผ่านที่อ่านกลับตรงทุกตัวอักษร", loginAt(afterSave, itemId)?.password == secretPassword)
    check("ชื่อผู้ใช้ตรงกัน", loginAt(afterSave, itemId)?.username == "somchai")
    check("URL ตรงกัน", loginAt(afterSave, itemId)?.urls == listOf("https://bank.example"))

    println("\n── 4. แก้ไขและชนกัน ──")
    val updated = valueOf(saveItem(api, session, itemId, vaultId, 1, item.copy(title = "แก้ชื่อแล้ว")))
    check("แก้ไขด้วยเวอร์ชันที่ถูกต้องได้", updated == 2)

    val stale = saveItem(api, session, itemId, vaultId, 1, item.copy(title = "เวอร์ชันเก่า"))
    check("⭐ ส่งด้วยเวอร์ชันล้าสมัย → ถูกปฏิเสธ ไม่เขียนทับ", stale is CryptoResult.Err)

    println("\n── 4b. ⭐⭐ รายการประเภทบัตรและโน้ตเดินทางผ่าน API จริงได้ ──")

    val noteId = valueOf(createUlid(System.currentTimeMillis() + 1)) ?: ""
    val cardId = valueOf(createUlid(System.currentTimeMillis() + 2)) ?: ""

    val note = SecureNoteItem(
        title = "โน้ตลับ",
        notes = "ข้อความภาษาไทยกับอีโมจิ 🔐",
        createdAt = now,
        updatedAt = now,
    )
    val card = CardItem(
        title = "บัตรทดสอบ",
        cardholderName = "SOMCHAI J",
        number = "4111111111111111",
        expiryMonth = "07",
        expiryYear = "2031",
        securityCode = "4321",
        createdAt = now,
        updatedAt = now,
    )

    check("บันทึกโน้ตได้", saveItem(api, session, noteId, vaultId, 0, note) is CryptoResult.Ok)
    check("บันทึกบัตรได้", saveItem(api, session, cardId, vaultId, 0, card) is CryptoResult.Ok)

    val mixed = valueOf(pull(api, session))
    check("ไม่มีรายการใดถอดรหัสไม่ได้", mixed?.brokenItemIds?.isEmpty() == true)

    val readNote = mixed?.items?.get(noteId)?.item
    check("⭐ โน้ตกลับมาเป็นประเภทเดิม", readNote is SecureNoteItem)
    check("เนื้อโน้ตภาษาไทยและอีโมจิครบ", readNote?.notes == note.notes)

    val readCard = mixed?.items?.get(cardId)?.item as? CardItem
    check("⭐ บัตรกลับมาเป็นประเภทเดิม", readCard != null)
    check("⭐ เลขบัตร 16 หลักตรงทุกหลัก", readCard?.number == card.number)
    check("วันหมดอายุและรหัสหลังบัตรตรงกัน",
        readCard?.expiryMonth == card.expiryMonth &&
            readCard.expiryYear == card.expiryYear &&
            readCard.securityCode == card.securityCode)

    deleteItem(api, session, noteId, vaultId, 1)
    deleteItem(api, session, cardId, vaultId, 1)

    println("\n── 4c. ⭐⭐⭐ ฟิลด์ที่มือถือยังไม่มีหน้าจอให้แก้ ต้องไม่หายตอนบันทึก ──")

    val richId = valueOf(createUlid(System.currentTimeMillis() + 3)) ?: ""
    val rich = LoginItem(
        title = "รายการที่มีฟิลด์ครบ",
        username = "somchai",
        password = "รหัสผ่านของรายการนี้",
        urls = listOf("https://example.co/login"),
        totpSecret = "JBSWY3DPEHPK3PXP",
        notes = "โน้ต",
        tags = listOf("การเงิน", "สำคัญ"),
        customFields = listOf(
            CustomField("คำถามกันลืม", "ชื่อครูประถม", hidden = false),
            CustomField("PIN สำรอง", "4321", hidden = true),
        ),
        createdAt = now,
        updatedAt = now,
    )

    check("บันทึกรายการที่มีฟิลด์ครบได้", saveItem(api, session, richId, vaultId, 0, rich) is CryptoResult.Ok)

    val readBack = loginAt(valueOf(pull(api, session)), richId)
    check("⭐⭐ ความลับ TOTP อ่านกลับได้", readBack?.totpSecret == rich.totpSecret)
    check("⭐⭐ ป้ายกำกับอ่านกลับได้ครบ", readBack?.tags == rich.tags)
    check("⭐⭐ ฟิลด์ที่ผู้ใช้ตั้งเองอ่านกลับได้ครบ รวมสถานะซ่อน", readBack?.customFields == rich.customFields)

    if (readBack != null) {
        val edited = readBack.copy(title = "แก้เฉพาะชื่อ", updatedAt = now)
        check("แก้ไขได้", saveItem(api, session, richId, vaultId, 1, edited) is CryptoResult.Ok)

        val afterEdit = loginAt(valueOf(pull(api, session)), richId)
        check("⭐⭐⭐ แก้ชื่อแล้ว TOTP ยังอยู่", afterEdit?.totpSecret == rich.totpSecret)
        check("⭐⭐⭐ แก้ชื่อแล้วป้ายกำกับยังอยู่", afterEdit?.tags == rich.tags)
        check("⭐⭐⭐ แก้ชื่อแล้วฟิลด์ที่ผู้ใช้ตั้งเองยังอยู่", afterEdit?.customFields == rich.customFields)
        deleteItem(api, session, richId, vaultId, 2)
    }

    println("\n── 5. ล็อกแล้วเข้าใหม่ ──")
    session.lock()
    val reopened = valueOf(Session.unlock(api, email, password, kit.secretKey))
    check("เข้าสู่ระบบใหม่ได้", reopened != null)
    if (reopened != null) {
        val state2 = valueOf(pull(api, reopened))
        check("⭐ ถอดรหัสข้อมูลเดิมได้หลังเข้าใหม่", loginAt(state2, itemId)?.password == secretPassword)
        check("เห็นชื่อที่แก้ไว้", state2?.items?.get(itemId)?.item?.title == "แก้ชื่อแล้ว")

        val removed = deleteItem(api, reopened, itemId, vaultId, 2)
        check("ลบรายการได้", removed is CryptoResult.Ok)

        val state3 = valueOf(pull(api, reopened))
        check("ลบแล้วไม่เหลือในรายการ", state3?.items?.containsKey(itemId) == false)
        reopened.lock()
    }

    println("\n── 6. ⭐⭐ เปิดบัญชีที่สร้างจากเว็บแอป ──")
    val webEmail = System.getenv("KUNJAE_EMAIL")
    val webPassword = System.getenv("KUNJAE_PASSWORD")
    val webSecret = System.getenv("KUNJAE_SECRET_KEY")

    if (webEmail == null || webPassword == null || webSecret == null) {
        println("  — ข้ามเพราะไม่ได้ส่งบัญชีจากเว็บเข้ามา (ตั้ง KUNJAE_EMAIL / KUNJAE_PASSWORD / KUNJAE_SECRET_KEY)")
    } else {
        val webSession = valueOf(Session.unlock(api, webEmail, webPassword, webSecret))
        check("⭐⭐ Kotlin ปลดล็อกบัญชีที่สร้างจากเว็บได้", webSession != null)

        if (webSession != null) {
            val webState = valueOf(pull(api, webSession))
            check("⭐⭐ ถอดชื่อ vault ที่เว็บเข้ารหัสไว้ได้", webState?.vaults?.isNotEmpty() == true)
            check(
                "⭐⭐ ถอดรหัสรายการที่สร้างจากเว็บได้ครบ",
                webState != null && webState.items.isNotEmpty() && webState.brokenItemIds.isEmpty(),
            )

            val expectedPassword = System.getenv("KUNJAE_ITEM_PASSWORD")
            if (expectedPassword != null) {
                check(
                    "⭐⭐⭐ รหัสผ่านที่เว็บเก็บไว้ อ่านจาก Kotlin ได้ตรงทุกตัวอักษร",
                    webState?.items?.values?.any { (it.item as? LoginItem)?.password == expectedPassword } == true,
                )
            }

            webSession.lock()
        }
    }

    report()
}

private fun report() {
    println("\n═══ ผ่าน $passed / ล้มเหลว $failed ═══\n")
    if (failed > 0) kotlin.system.exitProcess(1)
}
