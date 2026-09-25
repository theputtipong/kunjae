package com.kunjae.client

import org.json.JSONArray

const val LOGIN_CREDS_RELATION = "delegate_permission/common.get_login_creds"

private const val ANDROID_APP_NAMESPACE = "android_app"

private const val SHA256_BYTES = 32

fun assetLinksUrlFor(host: String): String = "https://$host/.well-known/assetlinks.json"

fun normalizeCertFingerprint(raw: String?): String? {
    if (raw.isNullOrBlank()) return null

    val parts = raw.trim().uppercase().split(":")
    if (parts.size != SHA256_BYTES) return null

    for (part in parts) {
        if (part.length != 2) return null
        if (!part.all { it in '0'..'9' || it in 'A'..'F' }) return null
    }

    return parts.joinToString(":")
}

fun assetLinksAllow(
    document: String,
    packageName: String,
    fingerprints: Set<String>,
): Boolean {
    if (packageName.isBlank() || fingerprints.isEmpty()) return false

    val statements = try {
        JSONArray(document)
    } catch (_: Exception) {
        return false
    }

    for (i in 0 until statements.length()) {
        val statement = statements.optJSONObject(i) ?: continue

        val relations = statement.optJSONArray("relation") ?: continue
        var grantsLoginCreds = false
        for (r in 0 until relations.length()) {
            if (relations.optString(r, "") == LOGIN_CREDS_RELATION) {
                grantsLoginCreds = true
                break
            }
        }
        if (!grantsLoginCreds) continue

        val target = statement.optJSONObject("target") ?: continue
        if (target.optString("namespace", "") != ANDROID_APP_NAMESPACE) continue
        if (target.optString("package_name", "") != packageName) continue

        val declared = target.optJSONArray("sha256_cert_fingerprints") ?: continue
        for (f in 0 until declared.length()) {
            val normalized = normalizeCertFingerprint(declared.optString(f, null)) ?: continue
            if (normalized in fingerprints) return true
        }
    }

    return false
}

fun decideAppAutofill(
    packageName: String?,
    savedUrl: String?,
    authorizes: (host: String) -> Boolean,
): AutofillDecision {
    val host = hostOfSavedUrl(savedUrl) ?: return AutofillDecision.NoSavedUrl

    val app = packageName?.trim()
    if (app.isNullOrEmpty()) return AutofillDecision.NotAWebPage

    if (!authorizes(host)) return AutofillDecision.AppNotAuthorized(app, host)

    return AutofillDecision.AllowedByAssetLinks(host, app)
}
