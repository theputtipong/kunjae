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

private class MemoryStore : LocalStore {
    var bytes: ByteArray? = null
    var writes = 0

    override fun read(): ByteArray? = bytes?.copyOf()

    override fun write(bytes: ByteArray) {
        this.bytes = bytes.copyOf()
        writes += 1
    }

    override fun clear() {
        bytes = null
    }
}

fun main() {
    println("ตรวจ vault บนเครื่องนี้ (ไม่มีบัญชี ไม่ส่งขึ้น server)")

    val store = MemoryStore()
    val password = "รหัสผ่านของเครื่องนี้-ยาวพอ"
    val wrong = "รหัสผ่านที่ผิด-แต่ยาวพอ"
    val newPassword = "รหัสผ่านใหม่ของเครื่อง-2026"
    val now = Instant.now().toString()

    println("\n── 1. สร้าง vault ──")
    check("รหัสผ่านสั้นกว่า 12 ตัว → ปฏิเสธ", LocalVault.create(store, "short") is CryptoResult.Err)
    check("ยังไม่มีไฟล์หลังปฏิเสธ", !LocalVault.exists(store))

    val vault = valueOf(LocalVault.create(store, password))
    check("สร้างสำเร็จ", vault != null)
    if (vault == null) { report(); return }
    check("เขียนไฟล์แล้ว", LocalVault.exists(store))
    check("สร้างซ้ำทับไฟล์เดิมไม่ได้", LocalVault.create(store, password) is CryptoResult.Err)
    check("มี vault เริ่มต้นหนึ่งใบ", vault.vaultIds().size == 1)

    val vaultId = vault.vaultIds().first()
    val loginId = valueOf(createUlid(System.currentTimeMillis())) ?: ""
    val noteId = valueOf(createUlid(System.currentTimeMillis() + 1)) ?: ""
    val secret = "รหัสผ่านลับ-Aa1!-ห้ามหลุด"

    val login = LoginItem(
        title = "ธนาคาร",
        username = "somchai",
        password = secret,
        urls = listOf("https://bank.example"),
        totpSecret = "JBSWY3DPEHPK3PXP",
        createdAt = now,
        updatedAt = now,
    )
    val note = SecureNoteItem(title = "โน้ต", notes = "ข้อความลับ 🔐", createdAt = now, updatedAt = now)

    println("\n── 2. บันทึกสองรายการ ──")
    check("บันทึกรายการเข้าสู่ระบบ", valueOf(vault.saveItem(loginId, vaultId, 0, login)) == 1)
    check("บันทึกโน้ต", valueOf(vault.saveItem(noteId, vaultId, 0, note)) == 1)
    check("เวอร์ชันล้าสมัย → ปฏิเสธ", vault.saveItem(loginId, vaultId, 0, login) is CryptoResult.Err)

    val raw = String(store.bytes ?: ByteArray(0), Charsets.UTF_8)
    check("⭐ ไฟล์ไม่มีรหัสผ่านของรายการเป็นข้อความธรรมดา", !raw.contains(secret) && !raw.contains("somchai"))
    check("⭐ ไฟล์ไม่มี Master Password ของเครื่อง", !raw.contains(password))
    check("ไฟล์ไม่มีชื่อ vault เป็นข้อความธรรมดา", !raw.contains("Personal"))
    check("นับจำนวนรายการได้โดยไม่ต้องถอดรหัส", LocalVault.peekItemCount(store) == 2)

    val moveTarget = valueOf(vault.addVault("งาน"))
    check("สร้าง vault ใบที่สองได้", moveTarget != null)
    if (moveTarget != null) {
        check("ย้ายโน้ตไปอีก vault ได้", valueOf(vault.saveItem(noteId, moveTarget, 1, note)) == 2)
    }
    vault.lock()
    check("ล็อกแล้วอ่านไม่ได้", vault.state() is CryptoResult.Err)

    println("\n── 3. เปิดใหม่ ──")
    val reopened = valueOf(LocalVault.unlock(store, password))
    check("⭐ รหัสผ่านถูก → เปิดได้", reopened != null)
    val state = reopened?.let { valueOf(it.state()) }
    check("ไม่มีรายการที่ถอดรหัสไม่ได้", state?.brokenItemIds?.isEmpty() == true)
    check("มีสองรายการ", state?.items?.size == 2)
    check("⭐ รหัสผ่านอ่านกลับตรงทุกตัวอักษร", (state?.items?.get(loginId)?.item as? LoginItem)?.password == secret)
    check("TOTP อ่านกลับได้", (state?.items?.get(loginId)?.item as? LoginItem)?.totpSecret == login.totpSecret)
    check("โน้ตอยู่ใน vault ที่ย้ายไป", state?.items?.get(noteId)?.vaultId == moveTarget)
    check("เนื้อโน้ตครบ", state?.items?.get(noteId)?.item?.notes == note.notes)
    check("ชื่อ vault ถอดได้", state?.vaults?.values?.map { it.name }?.toSet() == setOf("Personal", "งาน"))

    check("⭐ รหัสผ่านผิด → เปิดไม่ได้", LocalVault.unlock(store, wrong) is CryptoResult.Err)

    val tampered = MemoryStore().apply { bytes = raw.replace("\"version\":1", "\"version\":7").toByteArray() }
    val tamperedState = valueOf(LocalVault.unlock(tampered, password))?.state()
    check("แก้เลขเวอร์ชันในไฟล์ → ตรวจพบ", tamperedState == null || valueOf(tamperedState)?.brokenItemIds?.isNotEmpty() != false)

    if (reopened == null) { report(); return }

    println("\n── 4. เปลี่ยนรหัสผ่าน ──")
    check("รหัสผ่านปัจจุบันผิด → ปฏิเสธ", reopened.changePassword(wrong, newPassword) is CryptoResult.Err)
    check("รหัสผ่านใหม่สั้นเกินไป → ปฏิเสธ", reopened.changePassword(password, "short") is CryptoResult.Err)
    check("เปลี่ยนสำเร็จ", reopened.changePassword(password, newPassword) is CryptoResult.Ok)
    check("ยังใช้งานต่อได้หลังเปลี่ยน", valueOf(reopened.state())?.items?.size == 2)
    reopened.lock()

    check("⭐ รหัสผ่านเก่าใช้ไม่ได้แล้ว", LocalVault.unlock(store, password) is CryptoResult.Err)
    val afterChange = valueOf(LocalVault.unlock(store, newPassword))
    check("⭐ รหัสผ่านใหม่เปิดได้", afterChange != null)
    val changedState = afterChange?.let { valueOf(it.state()) }
    check("⭐ ข้อมูลครบหลังเปลี่ยนรหัสผ่าน", (changedState?.items?.get(loginId)?.item as? LoginItem)?.password == secret)

    if (afterChange == null) { report(); return }

    println("\n── 5. เปิดด้วยกุญแจที่จำไว้ (ลายนิ้วมือ) ──")
    val remembered = afterChange.withWrappingKey { it.copyOf() }
    val resumed = valueOf(LocalVault.resume(store, remembered))
    check("เปิดด้วยกุญแจที่จำไว้ได้", resumed?.let { valueOf(it.state()) }?.items?.size == 2)
    resumed?.lock()
    check("กุญแจผิด → เปิดไม่ได้", LocalVault.resume(store, ByteArray(32)) is CryptoResult.Err)

    println("\n── 6. ลบรายการและลบ vault บนเครื่อง ──")
    check("ลบรายการได้", afterChange.deleteItem(loginId, 1) is CryptoResult.Ok)
    check("เหลือหนึ่งรายการ", valueOf(afterChange.state())?.items?.keys == setOf(noteId))
    afterChange.delete()
    check("⭐ ลบแล้วไม่เหลือไฟล์", !LocalVault.exists(store) && store.bytes == null)
    check("ลบแล้วเปิดไม่ได้", LocalVault.unlock(store, newPassword) is CryptoResult.Err)
    check("ลบแล้วนับรายการไม่ได้", LocalVault.peekItemCount(store) == null)

    report()
}

private fun report() {
    println("\n═══ ผ่าน $passed / ล้มเหลว $failed ═══\n")
    if (failed > 0) kotlin.system.exitProcess(1)
}
