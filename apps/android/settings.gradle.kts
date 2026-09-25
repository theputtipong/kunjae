pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

rootProject.name = "kunjae-android"

include(":core-crypto")
include(":client")
include(":app")

dependencyResolutionManagement {
    repositories {
        mavenCentral()
        google()
    }
}
