package com.kunjae.crypto

import java.io.File
import org.json.JSONArray
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

private fun vectorsDir(): File {
    var dir: File? = File(".").absoluteFile
    while (dir != null) {
        val candidate = File(dir, "packages/crypto-spec/vectors")
        if (candidate.isDirectory) return candidate
        dir = dir.parentFile
    }
    error("ไม่พบโฟลเดอร์ vectors — ต้องรันจากภายใน repo")
}

private fun loadVector(name: String): JSONObject =
    JSONObject(File(vectorsDir(), "$name.json").readText())

private fun hex(value: String): ByteArray =
    (hexToBytes(value) as CryptoResult.Ok).value

private fun checkEncoding() {
    println("\n── encoding.json ──")
    val vector = loadVector("encoding")

    val cases = vector.getJSONArray("encode")
    for (i in 0 until cases.length()) {
        val case = cases.getJSONObject(i)
        val label = case.getString("label")
        val bytes = hex(case.getString("bytesHex"))

        check("hex: $label", bytesToHex(bytes) == case.getString("hex"))
        check("base32: $label", bytesToBase32(bytes) == case.getString("base32"))
        check("base64url: $label", bytesToBase64Url(bytes) == case.getString("base64url"))

        check(
            "base32 ถอดกลับ: $label",
            base32ToBytes(case.getString("base32")).valueOrNull()?.contentEquals(bytes) == true,
        )
        check(
            "base64url ถอดกลับ: $label",
            base64UrlToBytes(case.getString("base64url")).valueOrNull()?.contentEquals(bytes) == true,
        )
    }

    val utf8Cases = vector.getJSONArray("utf8")
    for (i in 0 until utf8Cases.length()) {
        val case = utf8Cases.getJSONObject(i)
        val text = case.getString("text")
        val expected = hex(case.getString("bytesHex"))

        check(
            "utf8: ${case.getString("label")}",
            utf8ToBytes(text).valueOrNull()?.contentEquals(expected) == true,
        )
        check("utf8 ถอดกลับ: ${case.getString("label")}", bytesToUtf8(expected).valueOrNull() == text)
    }

    val reject = vector.getJSONObject("mustReject")
    for (kind in reject.keys()) {
        val list = reject.getJSONArray(kind)
        for (i in 0 until list.length()) {
            val bad = list.getString(i)
            val result = when (kind) {
                "hex" -> hexToBytes(bad)
                "base32" -> base32ToBytes(bad)
                "base64url" -> base64UrlToBytes(bad)
                else -> error("ไม่รู้จักชนิด $kind")
            }
            check("ปฏิเสธ $kind: \"$bad\"", result is CryptoResult.Err)
        }
    }
}

private fun checkKdf() {
    println("\n── kdf.json ──")
    val vector = loadVector("kdf")

    val hkdfCases = vector.getJSONObject("hkdf").getJSONArray("cases")
    for (i in 0 until hkdfCases.length()) {
        val case = hkdfCases.getJSONObject(i)
        val result = hkdfSha256(
            ikm = hex(case.getString("ikmHex")),
            salt = hex(case.getString("saltHex")),
            info = case.getString("purpose").toByteArray(Charsets.UTF_8),
            length = case.getInt("lengthBytes"),
        )
        check(
            "HKDF: ${case.getString("purpose")}",
            result.valueOrNull()?.let { bytesToHex(it) } == case.getString("okmHex"),
        )
    }

    val argon = vector.getJSONObject("argon2id")
    val argonParams = argon.getJSONObject("params")

    val argonResult = deriveKeyFromPassword(
        password = argon.getString("passwordUtf8").toByteArray(Charsets.UTF_8),
        salt = hex(argon.getString("saltHex")),
        params = Argon2Params(
            memoryKiB = argonParams.getInt("memoryKiB"),
            iterations = argonParams.getInt("iterations"),
            parallelism = argonParams.getInt("parallelism"),
            hashLength = argonParams.getInt("hashLength"),
        ),
    )
    check(
        "⭐ Argon2id ให้ผลตรงกับฝั่ง TypeScript ทุกไบต์",
        argonResult.valueOrNull()?.let { bytesToHex(it) } == argon.getString("outputHex"),
    )

    check(
        "ปฏิเสธ m=8 KiB (ต่ำกว่าเกณฑ์ OWASP)",
        validateArgon2Params(Argon2Params(memoryKiB = 8)) is CryptoResult.Err,
    )
    check(
        "ปฏิเสธ t=1 (น้อยเกินไป)",
        validateArgon2Params(Argon2Params(iterations = 1)) is CryptoResult.Err,
    )
    check(
        "ปฏิเสธหน่วยความจำมหาศาล (กัน DoS บนมือถือ)",
        validateArgon2Params(Argon2Params(memoryKiB = 4_194_304)) is CryptoResult.Err,
    )
    check("ยอมรับค่ามาตรฐานของระบบ", validateArgon2Params(Argon2Params()) is CryptoResult.Ok)
}

private fun checkSecretKey() {
    println("\n── secret-key.json ──")
    val vector = loadVector("secret-key")

    val formatted = vector.getJSONArray("formatted")
    for (i in 0 until formatted.length()) {
        val case = formatted.getJSONObject(i)
        val bytes = hex(case.getString("bytesHex"))
        check(
            "จัดรูปแบบ: ${case.getString("formatted")}",
            formatSecretKey(bytes).valueOrNull() == case.getString("formatted"),
        )
    }

    val lenient = vector.getJSONObject("parseLenient")
    val expected = hex(lenient.getString("expectedHex"))
    val inputs = lenient.getJSONArray("inputs")
    for (i in 0 until inputs.length()) {
        val input = inputs.getString(i)
        check(
            "อ่านแบบยืดหยุ่น: \"$input\"",
            parseSecretKey(input).valueOrNull()?.contentEquals(expected) == true,
        )
    }

    val reject = vector.getJSONArray("mustReject")
    for (i in 0 until reject.length()) {
        val input = reject.getString(i)
        check("ปฏิเสธ: \"$input\"", parseSecretKey(input) is CryptoResult.Err)
    }
}

private fun checkKeyHierarchy() {
    println("\n── key-hierarchy.json ──")
    val vector = loadVector("key-hierarchy")

    val input = vector.getJSONObject("input")
    val expected = vector.getJSONObject("expected")
    val argon2 = input.getJSONObject("argon2")

    val password = (utf8ToBytes(input.getString("masterPassword")) as CryptoResult.Ok).value
    val secretKey = hex(input.getString("secretKeyHex"))
    val salt = hex(input.getString("accountSaltHex"))
    val params = Argon2Params(
        memoryKiB = argon2.getInt("memoryKiB"),
        iterations = argon2.getInt("iterations"),
        parallelism = argon2.getInt("parallelism"),
        hashLength = argon2.getInt("hashLength"),
    )

    val muk = deriveMasterUnlockKey(password, secretKey, salt, params)
    check(
        "⭐ MUK ตรงกับฝั่ง TypeScript ทุกไบต์",
        muk.valueOrNull()?.let { bytesToHex(it) } == expected.getString("mukHex"),
    )

    val keys = unlockAccount(password, secretKey, salt, params)
    val accountKeys = keys.valueOrNull()

    check(
        "⭐ Auth Key ตรงกัน",
        accountKeys?.let { bytesToHex(it.authKey) } == expected.getString("authKeyHex"),
    )
    check(
        "⭐ Wrapping Key ตรงกัน",
        accountKeys?.let { bytesToHex(it.wrappingKey) } == expected.getString("wrappingKeyHex"),
    )
    check(
        "Auth Key ในรูป base64url ที่ส่งให้ server ตรงกัน",
        accountKeys?.let { encodeAuthKey(it.authKey) } == expected.getString("authKeyBase64Url"),
    )
    check(
        "Auth Key กับ Wrapping Key ไม่เหมือนกัน (domain separation ทำงาน)",
        accountKeys != null && !accountKeys.authKey.contentEquals(accountKeys.wrappingKey),
    )
}

private fun checkAead() {
    println("\n── aead.json ──")
    val vector = loadVector("aead")

    val construction = vector.getJSONObject("aadConstruction").getJSONObject("example")
    val combined = construction.getString("combined").toByteArray(Charsets.UTF_8)
    check(
        "รูปแบบ AAD ที่ผูก header ตรงกัน",
        bytesToHex(combined) == construction.getString("combinedHex"),
    )

    val decrypt = vector.getJSONObject("decrypt")
    val key = hex(decrypt.getString("keyHex"))
    val envelopeJson = decrypt.getJSONObject("envelope")

    val envelope = Envelope(
        version = envelopeJson.getInt("v"),
        algorithm = envelopeJson.getString("alg"),
        nonce = envelopeJson.getString("n"),
        ciphertext = envelopeJson.getString("ct"),
    )

    val aad = buildItemAad(decrypt.getString("itemId"), decrypt.getInt("version"))
        .toByteArray(Charsets.UTF_8)

    val plaintext = openFromEnvelope(key, envelope, aad)
    check(
        "⭐ ถอดรหัส ciphertext ที่สร้างจาก TypeScript ได้",
        plaintext.valueOrNull()?.let { bytesToHex(it) } == decrypt.getString("expectedPlaintextHex"),
    )
    check(
        "ได้ข้อความเดิมรวมอักษรไทย",
        plaintext.valueOrNull()?.let { bytesToUtf8(it).valueOrNull() } ==
            decrypt.getString("expectedPlaintext"),
    )

    val mustFail = vector.getJSONArray("mustFail")
    for (i in 0 until mustFail.length()) {
        val case = mustFail.getJSONObject(i)
        val caseEnvelope = Envelope(
            version = case.optInt("envelopeVersion", envelope.version),
            algorithm = case.optString("envelopeAlg", envelope.algorithm),
            nonce = envelope.nonce,
            ciphertext = envelope.ciphertext,
        )

        val caseAad = buildItemAad(
            case.optString("itemId", decrypt.getString("itemId")),
            case.optInt("version", decrypt.getInt("version")),
        ).toByteArray(Charsets.UTF_8)

        check(
            "⭐ ต้องล้มเหลว: ${case.getString("reason")}",
            openFromEnvelope(key, caseEnvelope, caseAad) is CryptoResult.Err,
        )
    }

    val message = (utf8ToBytes("ข้อความทดสอบ") as CryptoResult.Ok).value
    val sealed = sealToEnvelope(key, message, aad)
    val roundTrip = sealed.valueOrNull()?.let { openFromEnvelope(key, it, aad) }
    check(
        "เข้ารหัสแล้วถอดกลับได้ของเดิม",
        roundTrip?.valueOrNull()?.contentEquals(message) == true,
    )
    check(
        "AAD ต่างกันเพียงเล็กน้อย → ถอดไม่ได้",
        sealed.valueOrNull()?.let {
            openFromEnvelope(key, it, buildItemAad(decrypt.getString("itemId"), 999).toByteArray())
        } is CryptoResult.Err,
    )
}

private fun checkProtocol() {
    println("\n── protocol.json ──")
    val vector = loadVector("protocol")

    val itemAads: JSONArray = vector.getJSONArray("itemAad")
    for (i in 0 until itemAads.length()) {
        val case = itemAads.getJSONObject(i)
        val built = buildItemAad(case.getString("itemId"), case.getInt("version"))

        check("AAD ของรายการ เวอร์ชัน ${case.getInt("version")}", built == case.getString("aad"))
        check(
            "AAD ของรายการเป็นไบต์ตรงกัน เวอร์ชัน ${case.getInt("version")}",
            bytesToHex(built.toByteArray(Charsets.UTF_8)) == case.getString("aadHex"),
        )
    }

    val vaultAads = vector.getJSONArray("vaultMetaAad")
    for (i in 0 until vaultAads.length()) {
        val case = vaultAads.getJSONObject(i)
        val built = buildVaultMetaAad(case.getString("vaultId"), case.getInt("version"))

        check("AAD ของ vault เวอร์ชัน ${case.getInt("version")}", built == case.getString("aad"))
        check(
            "AAD ของ vault เป็นไบต์ตรงกัน เวอร์ชัน ${case.getInt("version")}",
            bytesToHex(built.toByteArray(Charsets.UTF_8)) == case.getString("aadHex"),
        )
    }
}

private fun checkTotp() {
    println("\n── totp.json ──")
    val vector = loadVector("totp")

    val algorithms = mapOf(
        "SHA1" to TotpAlgorithm.SHA1,
        "SHA256" to TotpAlgorithm.SHA256,
        "SHA512" to TotpAlgorithm.SHA512,
    )

    val rfc6238 = vector.getJSONArray("rfc6238")
    for (i in 0 until rfc6238.length()) {
        val case = rfc6238.getJSONObject(i)
        val seed = (hexToBytes(case.getString("seedHex")) as CryptoResult.Ok).value
        val algorithm = algorithms.getValue(case.getString("algorithm"))

        val result = totp(
            seed,
            case.getLong("unixSeconds") * 1000,
            TotpParams(algorithm, case.getInt("digits"), case.getInt("periodSeconds")),
        )

        check(
            "RFC 6238 T=${case.getLong("unixSeconds")} ${case.getString("algorithm")}",
            result is CryptoResult.Ok && result.value.code == case.getString("code"),
        )
    }

    val rfc4226 = vector.getJSONArray("rfc4226")
    for (i in 0 until rfc4226.length()) {
        val case = rfc4226.getJSONObject(i)
        val seed = (hexToBytes(case.getString("seedHex")) as CryptoResult.Ok).value

        val result = hotp(
            seed,
            case.getLong("counter"),
            TotpParams(TotpAlgorithm.SHA1, case.getInt("digits"), 30),
        )

        check(
            "RFC 4226 counter=${case.getInt("counter")}",
            result is CryptoResult.Ok && result.value == case.getString("code"),
        )
    }

    val decode = vector.getJSONArray("decode")
    for (i in 0 until decode.length()) {
        val case = decode.getJSONObject(i)
        val result = decodeTotpSecret(case.getString("text"))

        check(
            "ถอด base32 ของ RFC 4648: ${case.getString("label")}",
            result is CryptoResult.Ok && bytesToHex(result.value) == case.getString("bytesHex"),
        )
    }

    val rejects = vector.getJSONArray("rejectDecode")
    for (i in 0 until rejects.length()) {
        val case = rejects.getJSONObject(i)
        check(
            "ปฏิเสธ: ${case.getString("label")}",
            decodeTotpSecret(case.getString("text")) is CryptoResult.Err,
        )
    }
}

fun main() {
    println("ตรวจการพอร์ต core-crypto มาเป็น Kotlin เทียบกับชุดข้อมูลทดสอบของ TypeScript")

    checkEncoding()
    checkKdf()
    checkSecretKey()
    checkKeyHierarchy()
    checkAead()
    checkProtocol()
    checkTotp()

    println("\n═══ ผ่าน $passed / ล้มเหลว $failed ═══\n")
    if (failed > 0) kotlin.system.exitProcess(1)
}
