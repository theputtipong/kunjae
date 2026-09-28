package com.kunjae.app

import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.content.pm.Signature
import android.os.Build
import android.os.Debug
import java.io.File
import java.security.MessageDigest

object IntegrityGuard {

    enum class Finding(val code: Char) { SIGNATURE('S'), DEBUGGABLE('D'), DEBUGGER('G'), TRACER('T'), HOOK('H') }

    fun code(findings: Set<Finding>): String = findings.sortedBy { it.ordinal }.map { it.code }.joinToString("")

    @Volatile
    private var signatureOk: Boolean? = null

    private val allowedCerts: Set<String> =
        BuildConfig.SIGNING_CERTS.split(",").map { it.trim().uppercase() }.filter { it.length == 64 }.toSet()

    private val enforced: Boolean get() = !BuildConfig.DEBUG

    fun findings(context: Context): Set<Finding> {
        if (!enforced) return emptySet()
        val found = mutableSetOf<Finding>()
        if (!signatureMatches(context)) found += Finding.SIGNATURE
        if ((context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0) found += Finding.DEBUGGABLE
        if (Debug.isDebuggerConnected() || Debug.waitingForDebugger()) found += Finding.DEBUGGER
        if (tracerAttached()) found += Finding.TRACER
        if (hookPresent()) found += Finding.HOOK
        return found
    }

    fun compromised(context: Context): Boolean = findings(context).isNotEmpty()

    fun rooted(): Boolean {
        if (Build.TAGS?.contains("test-keys") == true) return true
        val paths = listOf(
            "/system/bin/su", "/system/xbin/su", "/sbin/su", "/system/su", "/vendor/bin/su",
            "/data/local/su", "/data/local/bin/su", "/data/local/xbin/su", "/data/adb/magisk", "/sbin/.magisk",
        )
        return paths.any { runCatching { File(it).exists() }.getOrDefault(false) }
    }

    private fun signatureMatches(context: Context): Boolean {
        signatureOk?.let { return it }
        val result = runCatching {
            if (allowedCerts.isEmpty()) return@runCatching false
            val digests = currentSigners(context).map { signature ->
                MessageDigest.getInstance("SHA-256").digest(signature.toByteArray()).joinToString("") { "%02X".format(it) }
            }
            digests.isNotEmpty() && digests.all { it in allowedCerts }
        }.getOrDefault(false)
        signatureOk = result
        return result
    }

    private fun currentSigners(context: Context): List<Signature> {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val info = context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_SIGNING_CERTIFICATES)
            val signing = info.signingInfo ?: return emptyList()
            return if (signing.hasMultipleSigners()) {
                signing.apkContentsSigners.orEmpty().toList()
            } else {
                listOfNotNull(signing.signingCertificateHistory?.lastOrNull())
            }
        }
        @Suppress("DEPRECATION")
        val info = context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_SIGNATURES)
        @Suppress("DEPRECATION")
        return info.signatures.orEmpty().toList()
    }

    private fun tracerAttached(): Boolean = runCatching {
        File("/proc/self/status").useLines { lines ->
            lines.firstOrNull { it.startsWith("TracerPid:") }?.substringAfter(":")?.trim()?.toIntOrNull() ?: 0
        } != 0
    }.getOrDefault(false)

    private fun hookPresent(): Boolean {
        val markers = listOf("frida", "gum-js-loop", "linjector", "libsubstrate", "xposed", "lspd", "lsposed", "riru", "zygisk")
        val maps = runCatching {
            File("/proc/self/maps").useLines { lines -> lines.any { line -> markers.any { line.contains(it, ignoreCase = true) } } }
        }.getOrDefault(false)
        if (maps) return true
        val classes = listOf("de.robv.android.xposed.XposedBridge", "de.robv.android.xposed.XC_MethodHook", "com.saurik.substrate.MS")
        if (classes.any { runCatching { Class.forName(it) }.isSuccess }) return true
        val threads = runCatching {
            File("/proc/self/task").listFiles().orEmpty().any { task ->
                runCatching { File(task, "comm").readText().trim() }.getOrDefault("").let { name ->
                    name.startsWith("gum-js") || name.startsWith("frida") || name.startsWith("pool-frida")
                }
            }
        }.getOrDefault(false)
        return threads
    }
}
