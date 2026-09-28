package com.kunjae.app

import androidx.annotation.RequiresApi
import android.os.Build
import android.content.Context
import android.content.pm.PackageManager
import android.content.pm.Signature
import com.kunjae.client.assetLinksAllow
import com.kunjae.client.assetLinksUrlFor
import com.kunjae.client.normalizeCertFingerprint
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

@RequiresApi(Build.VERSION_CODES.P)
object AssetLinksVerifier {

    private const val MAX_DOCUMENT_BYTES = 128 * 1024

    private const val CONNECT_TIMEOUT_MS = 5_000
    private const val READ_TIMEOUT_MS = 5_000

    private const val CACHE_TTL_MS = 6L * 60 * 60 * 1000

    private data class Verdict(val allowed: Boolean, val decidedAtMs: Long)

    private val cache = mutableMapOf<String, Verdict>()

    fun authorizes(context: Context, host: String, packageName: String): Boolean {
        val key = "$packageName@$host"
        val nowMs = System.currentTimeMillis()

        synchronized(cache) {
            val cached = cache[key]
            if (cached != null && nowMs - cached.decidedAtMs < CACHE_TTL_MS) return cached.allowed
        }

        val fingerprints = certFingerprints(context, packageName)

        val allowed = if (fingerprints.isEmpty()) {
            false
        } else {
            val document = fetchDocument(host)
            document != null && assetLinksAllow(document, packageName, fingerprints)
        }

        synchronized(cache) { cache[key] = Verdict(allowed, nowMs) }

        return allowed
    }

    fun canReadCertificate(context: Context, packageName: String): Boolean =
        certFingerprints(context, packageName).isNotEmpty()

    fun clear() {
        synchronized(cache) { cache.clear() }
    }

    private fun certFingerprints(context: Context, packageName: String): Set<String> = runCatching {
        val info = context.packageManager.getPackageInfo(
            packageName,
            PackageManager.GET_SIGNING_CERTIFICATES,
        )

        val signingInfo = info.signingInfo ?: return emptySet()

        val signatures: Array<Signature> = if (signingInfo.hasMultipleSigners()) {
            signingInfo.apkContentsSigners
        } else {
            signingInfo.signingCertificateHistory
        }

        signatures.mapNotNull { normalizeCertFingerprint(sha256Colons(it.toByteArray())) }.toSet()
    }.getOrDefault(emptySet())

    private fun documentUrlFor(host: String): String =
        if (BuildConfig.DEBUG && host == EMULATOR_HOST_ALIAS) {
            "http://$host:$DEV_ASSET_LINKS_PORT/.well-known/assetlinks.json"
        } else {
            assetLinksUrlFor(host)
        }

    private const val EMULATOR_HOST_ALIAS = "10.0.2.2"

    private const val DEV_ASSET_LINKS_PORT = 8788

    private fun sha256Colons(bytes: ByteArray): String =
        MessageDigest.getInstance("SHA-256")
            .digest(bytes)
            .joinToString(":") { "%02X".format(it) }

    private fun fetchDocument(host: String): String? = runCatching {
        val url = URL(documentUrlFor(host))

        val connection = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = CONNECT_TIMEOUT_MS
            readTimeout = READ_TIMEOUT_MS
            instanceFollowRedirects = false
            setRequestProperty("Accept", "application/json")
        }

        try {
            if (connection.responseCode != HttpURLConnection.HTTP_OK) return null

            connection.inputStream.use { stream ->
                val buffer = ByteArray(MAX_DOCUMENT_BYTES + 1)
                var read = 0
                while (read < buffer.size) {
                    val n = stream.read(buffer, read, buffer.size - read)
                    if (n <= 0) break
                    read += n
                }
                if (read > MAX_DOCUMENT_BYTES) return null

                String(buffer, 0, read, Charsets.UTF_8)
            }
        } finally {
            connection.disconnect()
        }
    }.getOrNull()
}
