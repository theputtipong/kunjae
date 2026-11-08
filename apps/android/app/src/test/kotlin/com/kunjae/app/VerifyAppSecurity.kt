package com.kunjae.app

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

private const val IDLE_MS = 15 * 60 * 1000L

private class FakeSession {
    var locked = false
}

private class Harness {
    val events = mutableListOf<Boolean>()
    val tornDown = mutableListOf<FakeSession?>()
    val gate = SessionGate<FakeSession>(IDLE_MS, teardown = { s -> s?.locked = true; tornDown += s }, onUnlockedChange = { events += it })
}

fun main() {
    println("ตรวจด่านความปลอดภัยของแอป Android")

    println("\n── 1. webDomain เชื่อได้เฉพาะเบราว์เซอร์ที่รู้จัก ──")
    check("Chrome", AutofillPolicy.honorsWebDomain("com.android.chrome"))
    check("Firefox", AutofillPolicy.honorsWebDomain("org.mozilla.firefox"))
    check("Samsung Internet", AutofillPolicy.honorsWebDomain("com.sec.android.app.sbrowser"))
    check("Edge", AutofillPolicy.honorsWebDomain("com.microsoft.emmx"))
    check("Brave", AutofillPolicy.honorsWebDomain("com.brave.browser"))
    check("⭐ แอปทั่วไปตั้ง webDomain เอง → ไม่เชื่อ", !AutofillPolicy.honorsWebDomain("com.evil.app"))
    check("⭐ ชื่อคล้าย Chrome → ไม่เชื่อ", !AutofillPolicy.honorsWebDomain("com.android.chrome.evil"))
    check("ไม่รู้แพ็กเกจ → ไม่เชื่อ", !AutofillPolicy.honorsWebDomain(null))
    check("แพ็กเกจว่าง → ไม่เชื่อ", !AutofillPolicy.honorsWebDomain(""))
    check("แพ็กเกจที่เพิ่มเอง (debug) → เชื่อ", AutofillPolicy.honorsWebDomain("com.kunjae.app", setOf("com.kunjae.app")))

    println("\n── 2. webScheme ──")
    check("⭐ หน้า http แต่บันทึก https → ปฏิเสธ", !AutofillPolicy.schemeAllows("http", "https://bank.example/login"))
    check("⭐ HTTP ตัวใหญ่ → ปฏิเสธ", !AutofillPolicy.schemeAllows("HTTP", "HTTPS://bank.example"))
    check("https ทั้งคู่ → อนุญาต", AutofillPolicy.schemeAllows("https", "https://bank.example/login"))
    check("https บนรายการ http → อนุญาต", AutofillPolicy.schemeAllows("https", "http://bank.example"))
    check("http ทั้งคู่ → อนุญาต", AutofillPolicy.schemeAllows("http", "http://bank.example"))
    check("ไม่รู้ scheme → อนุญาต (ยังต้องผ่านการเทียบโดเมน)", AutofillPolicy.schemeAllows(null, "https://bank.example"))
    check("ไม่มี URL → อนุญาต (decideAutofill ปฏิเสธเอง)", AutofillPolicy.schemeAllows("http", null))

    println("\n── 3. ล็อกเมื่อไม่ได้ใช้ ──")
    run {
        val h = Harness()
        val s = FakeSession()
        h.gate.open(s, 0)
        check("เปิดแล้วส่งสัญญาณปลดล็อก", h.events == listOf(true))
        check("ภายใน 15 นาที active ได้", h.gate.active(IDLE_MS) === s)
        check("active ต่ออายุ", h.gate.active(IDLE_MS * 2) === s)
        check("⭐ เกิน 15 นาที → null", h.gate.active(IDLE_MS * 3 + 1) == null)
        check("⭐ หมดเวลาแล้วส่งสัญญาณล็อก", h.events.last() == false)
        check("⭐ หมดเวลาแล้วทำลายกุญแจ", s.locked)
        check("หลังล็อก peek ได้ null", h.gate.peek(IDLE_MS * 3 + 2) == null)
    }
    run {
        val h = Harness()
        val s = FakeSession()
        h.gate.open(s, 0)
        check("peek ไม่ต่ออายุ (1)", h.gate.peek(IDLE_MS - 1) === s)
        check("peek ไม่ต่ออายุ (2)", h.gate.peek(IDLE_MS) === s)
        check("⭐ peek อย่างเดียวไม่กันหมดเวลา", h.gate.peek(IDLE_MS + 1) == null)
        check("⭐ peek ที่หมดเวลาส่งสัญญาณล็อก", h.events == listOf(true, false))
        check("ทำลายกุญแจ", s.locked)
    }
    run {
        val h = Harness()
        val s = FakeSession()
        h.gate.open(s, 0)
        h.gate.lock()
        check("lock ส่งสัญญาณ", h.events == listOf(true, false))
        check("lock ทำลายกุญแจ", s.locked && h.tornDown.contains(s))
        check("หลัง lock active ได้ null", h.gate.active(1) == null)
    }
    run {
        val h = Harness()
        val first = FakeSession()
        val second = FakeSession()
        h.gate.open(first, 0)
        h.gate.open(second, 10)
        check("เปิดใหม่ทำลายอันเก่า", first.locked && !second.locked)
        check("เปิดใหม่ไม่ส่งสัญญาณล็อกคั่น", h.events == listOf(true, true))
        check("ใช้อันใหม่", h.gate.active(20) === second)
    }

    println("\n── 4. ⭐ ผลดึงข้อมูลที่กลับมาหลังล็อก ──")
    run {
        val s = FakeSession()
        val other = FakeSession()
        check("session เดิมยังอยู่ → ใช้ผล", pullOutcome(s, s) == PullOutcome.APPLY)
        check("⭐ ล็อกระหว่างดึง → ล็อก UI ไม่ใช้ผล", pullOutcome(s, null) == PullOutcome.LOCK)
        check("⭐ เปิด session ใหม่ระหว่างดึง → ทิ้งผล", pullOutcome(s, other) == PullOutcome.DISCARD)
        val h = Harness()
        h.gate.open(s, 0)
        val captured = h.gate.active(1)!!
        h.gate.lock()
        check("⭐ ลำดับจริง: active → lock → peek = LOCK", pullOutcome(captured, h.gate.peek(2)) == PullOutcome.LOCK)
    }

    println("\n── 5. ⭐ ตัวจับเวลาล็อกเมื่อไม่ได้ใช้ ──")
    run {
        val h = Harness()
        check("ไม่มี session → ไม่ต้องจับเวลา", h.gate.idleRemainingMs(0) == null)
        val s = FakeSession()
        h.gate.open(s, 1_000)
        check("เพิ่งเปิด → เหลือ 15 นาที", h.gate.idleRemainingMs(1_000) == IDLE_MS)
        check("ผ่านไป 10 นาที → เหลือ 5 นาที", h.gate.idleRemainingMs(1_000 + 10 * 60_000) == 5 * 60_000L)
        h.gate.active(1_000 + 10 * 60_000)
        check("⭐ มีการใช้งาน → นับใหม่", h.gate.idleRemainingMs(1_000 + 10 * 60_000) == IDLE_MS)
        check("idleRemainingMs ไม่ต่ออายุ", h.gate.idleRemainingMs(1_000 + 10 * 60_000 + IDLE_MS) == 0L)
        check("⭐ เลยกำหนด → ติดลบ", h.gate.idleRemainingMs(1_000 + 10 * 60_000 + IDLE_MS + 5)!! < 0)
        check("idleRemainingMs ไม่ล็อกเอง", !s.locked)
        h.gate.lock()
        check("ล็อกแล้ว → null", h.gate.idleRemainingMs(1) == null)
    }

    println("\n── 6. ⭐ ข้อมูลที่จำไว้ด้วยไบโอเมตริก ──")
    run {
        val auth = ByteArray(32) { (it + 1).toByte() }
        val wrap = ByteArray(32) { (0xF0 - it).toByte() }
        val savedAt = 1_762_000_000_123L
        val encoded = BiometricPayload.encode("user@example.com", auth, wrap, savedAt)
        check("ความยาว = 8 + 32 + 32 + email", encoded.size == 72 + "user@example.com".length)
        val decoded = BiometricPayload.decode(encoded)
        check("ถอดได้", decoded != null)
        check("email ตรง", decoded?.email == "user@example.com")
        check("authKey ตรง", decoded?.authKey?.contentEquals(auth) == true)
        check("wrappingKey ตรง", decoded?.wrappingKey?.contentEquals(wrap) == true)
        check("เวลาบันทึกตรง", decoded?.savedAtMs == savedAt)
        check("toString ไม่เผยกุญแจ", decoded?.toString()?.contains("user@example.com") == false)
        val thai = BiometricPayload.decode(BiometricPayload.encode("ผู้ใช้@ตัวอย่าง.ไทย", auth, wrap, 0))
        check("email UTF-8", thai?.email == "ผู้ใช้@ตัวอย่าง.ไทย")
        val local = BiometricPayload.decode(BiometricPayload.encode("", ByteArray(32), wrap, 5))
        check("ห้องนิรภัยในเครื่อง email ว่าง", local?.email == "" && local.savedAtMs == 5L)
        check("⭐ สั้นกว่า header → null", BiometricPayload.decode(encoded.copyOf(71)) == null)
        check("⭐ ว่าง → null", BiometricPayload.decode(ByteArray(0)) == null)
        check("header พอดี → email ว่าง", BiometricPayload.decode(encoded.copyOf(72))?.email == "")
        check("⭐ กุญแจผิดขนาดถูกปฏิเสธ", runCatching { BiometricPayload.encode("a", ByteArray(31), wrap, 0) }.isFailure)
        check("⭐ wrappingKey ผิดขนาดถูกปฏิเสธ", runCatching { BiometricPayload.encode("a", auth, ByteArray(33), 0) }.isFailure)
        val day = 24 * 60 * 60 * 1000L
        check("อายุ 0 → ยังใช้ได้", !BiometricPayload.expired(savedAt, savedAt))
        check("อายุ 14 วันพอดี → ยังใช้ได้", !BiometricPayload.expired(savedAt, savedAt + 14 * day))
        check("⭐ 14 วัน + 1ms → หมดอายุ", BiometricPayload.expired(savedAt, savedAt + 14 * day + 1))
        check("14 วัน - 1ms → ยังใช้ได้", !BiometricPayload.expired(savedAt, savedAt + 14 * day - 1))
        check("⭐ เวลาบันทึกอยู่ในอนาคตไกล → หมดอายุ", BiometricPayload.expired(savedAt + 30 * day, savedAt))
        check("เวลาคลาดเล็กน้อย → ยังใช้ได้", !BiometricPayload.expired(savedAt + 60_000, savedAt))
    }

    println("\n── 7. ⭐ เลือกช่องกรอกและโดเมนที่เป็นเจ้าของช่องรหัสผ่าน ──")
    run {
        val pw = AutofillFields.classify(listOf("password"), 0, null, null, null)
        check("hint password", pw == FieldKind.PASSWORD)
        check("inputType password", AutofillFields.classify(emptyList(), 0x00000081, null, null, null) == FieldKind.PASSWORD)
        check("inputType web password", AutofillFields.classify(emptyList(), 0x000000e1, null, null, null) == FieldKind.PASSWORD)
        check("html password", AutofillFields.classify(emptyList(), 0, "input", "password", null) == FieldKind.PASSWORD)
        check("hint username", AutofillFields.classify(listOf("username"), 0, null, null, null) == FieldKind.USERNAME)
        check("hint email", AutofillFields.classify(listOf("emailAddress"), 0, null, null, null) == FieldKind.USERNAME)
        check("html email", AutofillFields.classify(emptyList(), 0, "input", "email", null) == FieldKind.USERNAME)
        check("html otp", AutofillFields.classify(emptyList(), 0, "input", "text", "one-time-code") == FieldKind.OTP)
        check("hint sms otp", AutofillFields.classify(listOf("smsOTPCode"), 0, null, null, null) == FieldKind.OTP)
        check("otp ชนะ password", AutofillFields.classify(listOf("one-time-code", "password"), 0, null, null, null) == FieldKind.OTP)
        check("ช่องทั่วไป", AutofillFields.classify(emptyList(), 1, "div", null, null) == FieldKind.OTHER)

        check("ไม่มีโดเมนตัวเอง → ใช้ของพ่อ", AutofillFields.inherit(null, "bank.example") == "bank.example")
        check("โดเมนว่าง → ใช้ของพ่อ", AutofillFields.inherit("  ", "bank.example") == "bank.example")
        check("iframe มีโดเมนตัวเอง", AutofillFields.inherit("ads.example", "bank.example") == "ads.example")

        val iframe = AutofillFields.select(
            listOf(
                FieldNode("user", FieldKind.USERNAME, "bank.example", "https"),
                FieldNode("pw-ad", FieldKind.PASSWORD, "ads.example", "https"),
            ),
        )
        check("⭐ รหัสผ่านใน iframe → ใช้โดเมน iframe", iframe.webDomain == "ads.example")
        check("⭐ username ต่างโดเมนไม่ถูกเติม", iframe.usernameId == null)
        check("password id", iframe.passwordId == "pw-ad")

        val page = AutofillFields.select(
            listOf(
                FieldNode("search", FieldKind.USERNAME, "ads.example", "https"),
                FieldNode("user", FieldKind.USERNAME, "bank.example", "http"),
                FieldNode("pw", FieldKind.PASSWORD, "bank.example", "http"),
                FieldNode("otp-ad", FieldKind.OTP, "ads.example", "https"),
            ),
        )
        check("⭐ ใช้โดเมนของช่องรหัสผ่าน ไม่ใช่โดเมนแรก", page.webDomain == "bank.example")
        check("⭐ ใช้ scheme ของช่องรหัสผ่าน", page.webScheme == "http")
        check("username โดเมนเดียวกัน", page.usernameId == "user")
        check("⭐ otp ต่างโดเมนไม่ถูกเติม", page.otpId == null)

        val caseInsensitive = AutofillFields.select(
            listOf(
                FieldNode("user", FieldKind.USERNAME, "Bank.Example", "https"),
                FieldNode("pw", FieldKind.PASSWORD, "bank.example", "https"),
            ),
        )
        check("เทียบโดเมนไม่สนตัวพิมพ์", caseInsensitive.usernameId == "user")

        val otpOnly = AutofillFields.select(
            listOf(
                FieldNode("x", FieldKind.OTP, "bank.example", "https"),
                FieldNode("y", FieldKind.OTP, "bank.example", "https"),
            ),
        )
        check("otp อย่างเดียว → ใช้โดเมนของ otp", otpOnly.otpId == "x" && otpOnly.webDomain == "bank.example")

        val native = AutofillFields.select(
            listOf(
                FieldNode(1, FieldKind.USERNAME, null, null),
                FieldNode(2, FieldKind.PASSWORD, null, null),
                FieldNode(3, FieldKind.PASSWORD, null, null),
            ),
        )
        check("แอป native → ไม่มีโดเมน", native.webDomain == null)
        check("แอป native → เลือกช่องแรก", native.usernameId == 1 && native.passwordId == 2)

        val mixed = AutofillFields.select(
            listOf(
                FieldNode(1, FieldKind.USERNAME, "evil.example", "https"),
                FieldNode(2, FieldKind.PASSWORD, null, null),
            ),
        )
        check("⭐ รหัสผ่านไม่มีโดเมนแต่ username มี → ไม่ผสม", mixed.webDomain == null && mixed.usernameId == null)

        val none = AutofillFields.select(listOf(FieldNode(1, FieldKind.USERNAME, "a.example", "https")))
        check("ไม่มีรหัสผ่าน/otp → ไม่เลือกอะไร", none.passwordId == null && none.otpId == null && none.usernameId == null)
    }

    println("\n── 8. ⭐ แอป native ถาม assetlinks เฉพาะโฮสต์ที่เกี่ยวกับแพ็กเกจ ──")
    run {
        check("com.kbank.kplus ↔ kbank.co.th", AssetLinksScope.relates("kbank.co.th", "com.kbank.kplus"))
        check("com.google.android.gm ↔ accounts.google.com", AssetLinksScope.relates("accounts.google.com", "com.google.android.gm"))
        check("com.example.app ↔ example.com", AssetLinksScope.relates("example.com", "com.example.app"))
        check("ตัวพิมพ์ใหญ่", AssetLinksScope.relates("Login.Example.COM", "Com.Example.App"))
        check("com.scb.phone ↔ scb.co.th", AssetLinksScope.relates("www.scb.co.th", "com.scb.phone"))
        check("uk.co.bank.app ↔ bank.co.uk", AssetLinksScope.relates("bank.co.uk", "uk.co.bank.app"))
        check("⭐ แอปอื่น ↔ bank.example ไม่เกี่ยว", !AssetLinksScope.relates("bank.example", "com.evil.app"))
        check("⭐ ชื่อธนาคารซ่อนท้ายแพ็กเกจ → ไม่เกี่ยว", !AssetLinksScope.relates("kbank.co.th", "com.evil.kbank.scb.bbl"))
        check("⭐ ชื่อธนาคารใน org ของโดเมนย่อย → ไม่เกี่ยว", !AssetLinksScope.relates("kbank.evil.com", "com.kbank.kplus"))
        check("แพ็กเกจส่วนเดียว → ไม่เกี่ยว", !AssetLinksScope.relates("example.com", "example"))
        check("โฮสต์ส่วนเดียว → ไม่เกี่ยว", !AssetLinksScope.relates("localhost", "com.localhost.app"))
        check("IP → ไม่เกี่ยว", !AssetLinksScope.relates("10.0.2.2", "com.0.app"))
        val saved = listOf("kbank.co.th", "scb.co.th", "mail.google.com", "kbank.co.th", "news.example")
        check(
            "⭐ คัดเฉพาะโฮสต์ที่เกี่ยว ไม่ซ้ำ",
            AssetLinksScope.candidates("com.kbank.kplus", saved) == listOf("kbank.co.th"),
        )
        check("⭐ แอปไม่เกี่ยว → ไม่ถามใครเลย", AssetLinksScope.candidates("com.evil.app", saved).isEmpty())
        check(
            "ชุดเพิ่ม (debug) ถูกรวม",
            AssetLinksScope.candidates("com.kunjae.app", listOf("10.0.2.2", "x.example"), setOf("10.0.2.2")) == listOf("10.0.2.2"),
        )
    }

    println("\n── 9. ⭐ ตรวจ assetlinks พร้อมกันภายในเส้นตาย ──")
    run {
        val pool = java.util.concurrent.Executors.newFixedThreadPool(4)
        try {
            val started = System.nanoTime()
            val allowed = AssetLinksScope.verifyAll(listOf("a", "b", "c", "slow", "deny"), pool, 1_000) { host ->
                when (host) {
                    "slow" -> { Thread.sleep(5_000); true }
                    "deny" -> false
                    else -> { Thread.sleep(300); true }
                }
            }
            val elapsedMs = (System.nanoTime() - started) / 1_000_000
            check("⭐ ได้เฉพาะที่ตอบทันและอนุญาต", allowed == setOf("a", "b", "c"))
            check("⭐ ไม่รอเกินเส้นตาย ($elapsedMs ms)", elapsedMs < 1_500)

            val parallelStart = System.nanoTime()
            val four = AssetLinksScope.verifyAll(listOf("1", "2", "3", "4"), pool, 2_000) { Thread.sleep(400); true }
            val parallelMs = (System.nanoTime() - parallelStart) / 1_000_000
            check("⭐ 4 โฮสต์ใช้เวลาเท่าโฮสต์เดียว ($parallelMs ms)", four.size == 4 && parallelMs < 1_000)

            check("ไม่มีโฮสต์ → ว่าง", AssetLinksScope.verifyAll(emptyList(), pool, 1_000) { true }.isEmpty())
            check("ข้อผิดพลาด → ไม่อนุญาต", AssetLinksScope.verifyAll(listOf("x"), pool, 1_000) { error("boom") }.isEmpty())
        } finally {
            pool.shutdownNow()
        }
    }

    println("\n═══ ผ่าน $passed / ล้มเหลว $failed ═══\n")
    if (failed > 0) kotlin.system.exitProcess(1)
}
