import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
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

val releaseApiBaseUrl: String =
    providers.gradleProperty("kunjae.releaseApiBaseUrl").orNull?.takeIf { it.isNotBlank() }
        ?: System.getenv("KUNJAE_RELEASE_API_BASE_URL")?.takeIf { it.isNotBlank() }
        ?: localProperties.getProperty("kunjae.releaseApiBaseUrl")?.takeIf { it.isNotBlank() }
        ?: ""

val hasSigningMaterial = listOf(keystorePath, keystorePassword, keyAliasName, keyPasswordValue)
    .all { it != null } && file(keystorePath ?: "").exists()

android {
    namespace = "com.kunjae.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.kunjae.app"
        minSdk = 28
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
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
        }
        release {
            buildConfigField("String", "API_BASE_URL", "\"$releaseApiBaseUrl\"")

            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))

            signingConfig = signingConfigs.findByName("release")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
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
}

tasks.matching { it.name == "preReleaseBuild" }.configureEach {
    doFirst {
        val localHosts = listOf("localhost", "127.0.0.1", "10.0.2.2")
        require(releaseApiBaseUrl.startsWith("https://") && localHosts.none { releaseApiBaseUrl.contains(it) }) {
            "ตั้ง kunjae.releaseApiBaseUrl (https) ใน local.properties หรือ env KUNJAE_RELEASE_API_BASE_URL ก่อน build release"
        }
    }
}
