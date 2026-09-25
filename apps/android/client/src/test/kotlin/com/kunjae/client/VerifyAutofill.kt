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

private const val SAVED = "https://bank.example/login"

private fun allowed(webDomain: String?): Boolean =
    decideAutofill(webDomain, SAVED) is AutofillDecision.Allowed

fun main() {
    println("ตรวจด่านตัดสินการเติมอัตโนมัติของ Android")

    println("\n── 1. กรณีที่ต้องอนุญาต ──")
    check("โฮสต์ตรงกันเป๊ะ", allowed("bank.example"))
    check("ตัวพิมพ์ใหญ่ (ทำให้เป็นพิมพ์เล็กก่อนเทียบ)", allowed("BANK.EXAMPLE"))
    check("มีช่องว่างหัวท้ายติดมา", allowed("  bank.example  "))
    check("ลงท้ายด้วยจุด (ชี้ที่เดียวกัน)", allowed("bank.example."))

    println("\n── 2. ⭐ รูปแบบการโจมตีที่ต้องปฏิเสธ ──")
    check("evil-bank.example (หลอกด้วย endsWith)", !allowed("evil-bank.example"))
    check("bank.example.evil.net (หลอกด้วย startsWith)", !allowed("bank.example.evil.net"))
    check("subdomain: login.bank.example", !allowed("login.bank.example"))
    check("โดเมนแม่: example", !allowed("example"))
    check("โดเมนที่พิมพ์คล้ายกัน: bamk.example", !allowed("bamk.example"))
    check("⭐ โดเมนอักษรซีริลลิกหน้าตาเหมือนกัน", !allowed("bаnk.example"))
    check("ไอพีที่ชี้มาเอง", !allowed("127.0.0.1"))

    println("\n── 3. ⭐ แอปพื้นเมือง (ไม่มี webDomain) ──")
    val nativeApp = decideAutofill(null, SAVED)
    check("⭐ ไม่มี webDomain → ปฏิเสธ ไม่เติมให้แอปพื้นเมือง", nativeApp is AutofillDecision.NotAWebPage)
    check("webDomain ว่างเปล่า → ปฏิเสธเช่นกัน", decideAutofill("", SAVED) is AutofillDecision.NotAWebPage)
    check("webDomain มีแต่ช่องว่าง → ปฏิเสธ", decideAutofill("   ", SAVED) is AutofillDecision.NotAWebPage)

    println("\n── 4. รายการที่ไม่มี URL บันทึกไว้ ──")
    check("ไม่มี URL → ปฏิเสธ", decideAutofill("bank.example", null) is AutofillDecision.NoSavedUrl)
    check("URL ว่าง → ปฏิเสธ", decideAutofill("bank.example", "") is AutofillDecision.NoSavedUrl)
    check("URL ใช้ไม่ได้ → ปฏิเสธ", decideAutofill("bank.example", "ไม่ใช่ url") is AutofillDecision.NoSavedUrl)
    check(
        "URL ที่ไม่ใช่ http/https → ปฏิเสธ",
        decideAutofill("bank.example", "ftp://bank.example/") is AutofillDecision.NoSavedUrl,
    )
    check(
        "URL ที่โดเมนลงท้ายด้วยจุด → ปฏิเสธ",
        decideAutofill("bank.example", "https://bank.example./x") is AutofillDecision.NoSavedUrl,
    )

    println("\n── 5. รายงานเหตุผลให้ผู้ใช้เข้าใจได้ ──")
    val mismatch = decideAutofill("evil.net", SAVED)
    check(
        "บอกทั้งโฮสต์ที่ขอและที่บันทึกไว้",
        mismatch is AutofillDecision.HostMismatch &&
            mismatch.requested == "evil.net" &&
            mismatch.saved == "bank.example",
    )

    println("\n── 6. ตัวช่วยอ่านโฮสต์ ──")
    check("ตัด path และ port ทิ้ง", hostOfSavedUrl("https://bank.example:8443/a/b") == "bank.example")
    check("ทำให้เป็นตัวพิมพ์เล็ก", hostOfSavedUrl("https://BANK.example/") == "bank.example")
    check("ปฏิเสธค่าว่าง", hostOfSavedUrl(null) == null && hostOfSavedUrl("") == null)

    println("\n── 7. ⭐⭐⭐ Digital Asset Links — ด่านของแอปพื้นเมือง ──")

    val REAL_PKG = "com.bank.example"
    val REAL_FP = "AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:" +
        "AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89"
    val OTHER_FP = "11:22:33:44:55:66:77:88:11:22:33:44:55:66:77:88:" +
        "11:22:33:44:55:66:77:88:11:22:33:44:55:66:77:88"

    fun document(
        relation: String = LOGIN_CREDS_RELATION,
        namespace: String = "android_app",
        pkg: String = REAL_PKG,
        fingerprint: String = REAL_FP,
    ) = """[{"relation":["$relation"],"target":{"namespace":"$namespace",""" +
        """"package_name":"$pkg","sha256_cert_fingerprints":["$fingerprint"]}}]"""

    check(
        "⭐ เอกสารที่ถูกต้องครบทุกส่วน → อนุญาต",
        assetLinksAllow(document(), REAL_PKG, setOf(REAL_FP)),
    )
    check(
        "⭐⭐ ชื่อแพ็กเกจตรงแต่ลายนิ้วมือไม่ตรง → ปฏิเสธ (นี่คือแอปปลอมที่ตั้งชื่อเลียนแบบ)",
        !assetLinksAllow(document(), REAL_PKG, setOf(OTHER_FP)),
    )
    check(
        "ลายนิ้วมือตรงแต่ชื่อแพ็กเกจไม่ตรง → ปฏิเสธ",
        !assetLinksAllow(document(), "com.evil.app", setOf(REAL_FP)),
    )
    check(
        "⭐⭐ ความสัมพันธ์เป็น handle_all_urls (App Links) → ปฏิเสธ",
        !assetLinksAllow(
            document(relation = "delegate_permission/common.handle_all_urls"),
            REAL_PKG,
            setOf(REAL_FP),
        ),
    )
    check(
        "namespace เป็น web แทน android_app → ปฏิเสธ",
        !assetLinksAllow(document(namespace = "web"), REAL_PKG, setOf(REAL_FP)),
    )
    check(
        "เอกสารที่อ่าน JSON ไม่ออก → ปฏิเสธ",
        !assetLinksAllow("ไม่ใช่ JSON", REAL_PKG, setOf(REAL_FP)),
    )
    check(
        "เอกสารว่างเปล่า → ปฏิเสธ",
        !assetLinksAllow("[]", REAL_PKG, setOf(REAL_FP)),
    )
    check(
        "ไม่มีลายนิ้วมือของแอปเลย → ปฏิเสธ",
        !assetLinksAllow(document(), REAL_PKG, emptySet()),
    )
    check(
        "⭐ เอกสารหลายรายการ — ตัวที่ถูกต้องอยู่ท้ายสุดก็ยังเจอ",
        assetLinksAllow(
            """[{"relation":["delegate_permission/common.handle_all_urls"],""" +
                """"target":{"namespace":"android_app","package_name":"com.other",""" +
                """"sha256_cert_fingerprints":["$OTHER_FP"]}},""" +
                document().trim('[', ']') + "]",
            REAL_PKG,
            setOf(REAL_FP),
        ),
    )
    check(
        "ลายนิ้วมือตัวพิมพ์เล็กในเอกสาร → ยังเทียบได้",
        assetLinksAllow(document(fingerprint = REAL_FP.lowercase()), REAL_PKG, setOf(REAL_FP)),
    )

    println("\n── 8. รูปแบบของลายนิ้วมือ ──")
    check("ตัวพิมพ์เล็กถูกแปลงเป็นตัวใหญ่", normalizeCertFingerprint(REAL_FP.lowercase()) == REAL_FP)
    check("สั้นกว่า 32 คู่ → ปฏิเสธ", normalizeCertFingerprint("AB:CD") == null)
    check("มีอักขระที่ไม่ใช่เลขฐานสิบหก → ปฏิเสธ", normalizeCertFingerprint(REAL_FP.replace("AB", "ZZ")) == null)
    check("ค่าว่าง → ปฏิเสธ", normalizeCertFingerprint(null) == null && normalizeCertFingerprint("") == null)

    println("\n── 9. ⭐⭐ การตัดสินของแอปพื้นเมืองทั้งเส้นทาง ──")
    var asked: String? = null
    val allowAll: (String) -> Boolean = { host -> asked = host; true }

    check(
        "⭐ โดเมนที่ถูกถามมาจาก 'รายการที่ผู้ใช้บันทึกไว้' ไม่ใช่จากแอป",
        decideAppAutofill(REAL_PKG, "https://bank.example/login", allowAll)
            is AutofillDecision.AllowedByAssetLinks &&
            asked == "bank.example",
    )
    check(
        "⭐⭐ โดเมนไม่รับรองแอปนี้ → ปฏิเสธ",
        decideAppAutofill(REAL_PKG, "https://bank.example/login") { false }
            is AutofillDecision.AppNotAuthorized,
    )
    check(
        "รายการไม่มี URL → ปฏิเสธโดยไม่ยิงเครือข่ายเลย",
        decideAppAutofill(REAL_PKG, null) { error("ต้องไม่ถูกเรียก") }
            is AutofillDecision.NoSavedUrl,
    )
    check(
        "ไม่มีชื่อแพ็กเกจ → ปฏิเสธ",
        decideAppAutofill(null, "https://bank.example/login") { true }
            is AutofillDecision.NotAWebPage,
    )
    check(
        "⭐ ที่อยู่เอกสารเป็น https เสมอและอยู่ในเส้นทางมาตรฐาน",
        assetLinksUrlFor("bank.example") == "https://bank.example/.well-known/assetlinks.json",
    )

    println("\n═══ ผ่าน $passed / ล้มเหลว $failed ═══\n")
    if (failed > 0) kotlin.system.exitProcess(1)
}
