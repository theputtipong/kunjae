plugins {
    kotlin("jvm")
}

kotlin {
    jvmToolchain(17)
    compilerOptions { allWarningsAsErrors.set(true) }
}

dependencies {
    implementation(project(":core-crypto"))
    implementation("org.bouncycastle:bcprov-jdk18on:1.82")

    compileOnly("org.json:json:20250517")
    testImplementation("org.json:json:20250517")
}

val verifyAgainstApi by tasks.registering(JavaExec::class) {
    group = "verification"
    description = "ตรวจว่าชั้น client ของ Android ใช้งานกับ API จริงได้ครบวงจร"

    classpath = sourceSets["test"].runtimeClasspath
    mainClass.set("com.kunjae.client.VerifyClientKt")
}

val verifyAutofill by tasks.registering(JavaExec::class) {
    group = "verification"
    description = "ตรวจว่าการเติมอัตโนมัติจะไม่เติมให้หน้าที่ไม่ใช่ของรายการนั้น"

    classpath = sourceSets["test"].runtimeClasspath
    mainClass.set("com.kunjae.client.VerifyAutofillKt")
}

tasks.named("check") { dependsOn(verifyAutofill) }

val verifyLocalVault by tasks.registering(JavaExec::class) {
    group = "verification"
    description = "ตรวจว่า vault บนเครื่องนี้เข้ารหัส เปิด เปลี่ยนรหัสผ่าน และลบได้ถูกต้อง"

    classpath = sourceSets["test"].runtimeClasspath
    mainClass.set("com.kunjae.client.VerifyLocalVaultKt")
}

tasks.named("check") { dependsOn(verifyLocalVault) }

val verifyItemContent by tasks.registering(JavaExec::class) {
    group = "verification"
    description = "ตรวจว่ารายการที่บันทึกจาก Android ผ่านกติกาเดียวกับ ItemContentSchema ของเว็บ"

    classpath = sourceSets["test"].runtimeClasspath
    mainClass.set("com.kunjae.client.VerifyItemContentKt")
}

tasks.named("check") { dependsOn(verifyItemContent) }

val verifyTotp by tasks.registering(JavaExec::class) {
    group = "verification"
    description = "ตรวจ TOTP และลิงก์ otpauth:// ให้ได้ผลตรงกับฝั่งเว็บ รวมทั้งเวกเตอร์ RFC 6238"

    classpath = sourceSets["test"].runtimeClasspath
    mainClass.set("com.kunjae.client.VerifyTotpKt")
}

tasks.named("check") { dependsOn(verifyTotp) }
