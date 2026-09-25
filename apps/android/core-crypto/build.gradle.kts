plugins {
    kotlin("jvm")
}

kotlin {
    jvmToolchain(17)

    compilerOptions {
        allWarningsAsErrors.set(true)
    }
}

dependencies {
    implementation("org.bouncycastle:bcprov-jdk18on:1.82")

    compileOnly("org.json:json:20250517")
    testImplementation("org.json:json:20250517")
}

val verifyVectors by tasks.registering(JavaExec::class) {
    group = "verification"
    description = "ตรวจว่าการพอร์ตมา Kotlin ให้ผลตรงกับ TypeScript ทุกไบต์"

    classpath = sourceSets["test"].runtimeClasspath
    mainClass.set("com.kunjae.crypto.VectorCheckKt")
    workingDir = rootProject.projectDir.parentFile.parentFile
}

tasks.named("check") { dependsOn(verifyVectors) }
