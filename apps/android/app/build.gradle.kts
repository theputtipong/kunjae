import java.security.KeyStore
import java.security.MessageDigest
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

val firebaseConfigured = file("google-services.json").exists()
if (firebaseConfigured) {
    apply(plugin = "com.google.gms.google-services")
    apply(plugin = "com.google.firebase.crashlytics")
    apply(plugin = "com.google.firebase.firebase-perf")
}

val keystoreProperties = Properties().apply {
    val file = rootProject.file("keystore.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}

fun signingValue(propertyName: String, environmentName: String): String? =
    keystoreProperties.getProperty(propertyName)?.takeIf { it.isNotBlank() }
        ?: System.getenv(environmentName)?.takeIf { it.isNotBlank() }

val keystorePath = signingValue("storeFile", "KUNJAE_KEYSTORE_PATH")
val keystorePassword = signingValue("storePassword", "KUNJAE_KEYSTORE_PASSWORD")
val keyAliasName = signingValue("keyAlias", "KUNJAE_KEY_ALIAS")
val keyPasswordValue = signingValue("keyPassword", "KUNJAE_KEY_PASSWORD")

val localProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}

fun configValue(propertyName: String, environmentName: String): String =
    providers.gradleProperty(propertyName).orNull?.takeIf { it.isNotBlank() }
        ?: System.getenv(environmentName)?.takeIf { it.isNotBlank() }
        ?: localProperties.getProperty(propertyName)?.takeIf { it.isNotBlank() }
        ?: ""

val releaseApiBaseUrl = configValue("kunjae.releaseApiBaseUrl", "KUNJAE_RELEASE_API_BASE_URL")
val webOrigin = configValue("kunjae.webOrigin", "KUNJAE_WEB_ORIGIN").trimEnd('/')
val appVersionCode = configValue("kunjae.versionCode", "KUNJAE_VERSION_CODE").toIntOrNull() ?: 1
val appVersionName = configValue("kunjae.versionName", "KUNJAE_VERSION_NAME").ifBlank { "0.1.0" }

val assetStatements =
    if (webOrigin.startsWith("https://")) {
        "[{\\\"relation\\\": [\\\"delegate_permission/common.handle_all_urls\\\", \\\"delegate_permission/common.get_login_creds\\\"], " +
            "\\\"target\\\": {\\\"namespace\\\": \\\"web\\\", \\\"site\\\": \\\"$webOrigin\\\"}}]"
    } else {
        "[]"
    }

val hasSigningMaterial = listOf(keystorePath, keystorePassword, keyAliasName, keyPasswordValue)
    .all { it != null } && file(keystorePath ?: "").exists()

fun normalizeFingerprint(value: String): String = value.replace(":", "").trim().uppercase()

val uploadCertSha256: String =
    if (hasSigningMaterial) {
        runCatching {
            val store = KeyStore.getInstance(file(keystorePath!!), keystorePassword!!.toCharArray())
            val cert = store.getCertificate(keyAliasName)
            MessageDigest.getInstance("SHA-256").digest(cert.encoded).joinToString("") { "%02X".format(it) }
        }.getOrDefault("")
    } else {
        ""
    }

val allowedSigningCerts: String =
    (listOf(uploadCertSha256) + configValue("kunjae.playSigningCertSha256", "KUNJAE_PLAY_SIGNING_CERT_SHA256").split(","))
        .map(::normalizeFingerprint)
        .filter { it.length == 64 }
        .distinct()
        .joinToString(",")

android {
    namespace = "com.kunjae.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.kunjae.app"
        minSdk = 24
        targetSdk = 36
        versionCode = appVersionCode
        versionName = appVersionName
        buildConfigField("boolean", "FIREBASE_ENABLED", "$firebaseConfigured")
        resValue("string", "asset_statements", assetStatements)
        buildConfigField("String", "WEB_ORIGIN", "\"${webOrigin.takeIf { it.startsWith("https://") || it.startsWith("http://") } ?: ""}\"")
    }

    signingConfigs {
        if (hasSigningMaterial) {
            create("release") {
                storeFile = file(keystorePath ?: "")
                storePassword = keystorePassword
                keyAlias = keyAliasName
                keyPassword = keyPasswordValue

            }
        }
    }

    buildTypes {
        debug {
            val debugApiBaseUrl = providers.gradleProperty("kunjae.apiBaseUrl")
                .getOrElse("http://10.0.2.2:8787")
            buildConfigField("String", "API_BASE_URL", "\"$debugApiBaseUrl\"")
            buildConfigField("String", "SIGNING_CERTS", "\"\"")
            manifestPlaceholders["firebaseCollection"] = "false"
        }
        release {
            buildConfigField("String", "API_BASE_URL", "\"$releaseApiBaseUrl\"")
            buildConfigField("String", "SIGNING_CERTS", "\"$allowedSigningCerts\"")
            manifestPlaceholders["firebaseCollection"] = firebaseConfigured.toString()

            isMinifyEnabled = true
            isShrinkResources = true
            isDebuggable = false
            vcsInfo.include = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")

            signingConfig = signingConfigs.findByName("release")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
        resValues = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    packaging {
        resources {
            excludes += listOf(
                "META-INF/*.version",
                "META-INF/*.kotlin_module",
                "META-INF/version-control-info.textproto",
                "META-INF/com/android/build/gradle/app-metadata.properties",
                "kotlin/**",
                "DebugProbesKt.bin",
                "**/*.proto",
            )
        }
    }

    dependenciesInfo {
        includeInApk = false
        includeInBundle = true
    }

    sourceSets["main"].kotlin.srcDir("src/main/kotlin")
    sourceSets["debug"].kotlin.srcDir("src/debug/kotlin")
}

dependencies {
    implementation(project(":client"))
    implementation(project(":core-crypto"))

    implementation("org.bouncycastle:bcprov-jdk18on:1.82")

    implementation(platform("androidx.compose:compose-bom:2026.05.01"))
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.9.4")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.4")

    implementation(platform("com.google.firebase:firebase-bom:34.19.0"))
    implementation("com.google.firebase:firebase-crashlytics")
    implementation("com.google.firebase:firebase-config")
    implementation("com.google.firebase:firebase-messaging")
    implementation("com.google.firebase:firebase-perf")
}

tasks.matching { it.name == "preReleaseBuild" }.configureEach {
    doFirst {
        val localHosts = listOf("localhost", "127.0.0.1", "10.0.2.2")
        require(releaseApiBaseUrl.startsWith("https://") && localHosts.none { releaseApiBaseUrl.contains(it) }) {
            "Set kunjae.releaseApiBaseUrl (https) in local.properties or KUNJAE_RELEASE_API_BASE_URL before building a release"
        }
    }
}
