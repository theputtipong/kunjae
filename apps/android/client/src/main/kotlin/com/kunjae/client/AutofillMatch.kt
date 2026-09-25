package com.kunjae.client

sealed interface AutofillDecision {
    data class Allowed(val host: String) : AutofillDecision

    data object NotAWebPage : AutofillDecision

    data object NoSavedUrl : AutofillDecision

    data class HostMismatch(val requested: String, val saved: String) : AutofillDecision

    data class AllowedByAssetLinks(val host: String, val packageName: String) : AutofillDecision

    data class AppNotAuthorized(val packageName: String, val host: String) : AutofillDecision
}

fun hostOfSavedUrl(rawUrl: String?): String? {
    if (rawUrl.isNullOrBlank()) return null

    val url = try {
        java.net.URI(rawUrl)
    } catch (_: Exception) {
        return null
    }

    val scheme = url.scheme?.lowercase()
    if (scheme != "https" && scheme != "http") return null

    val host = url.host?.lowercase() ?: return null
    if (host.isEmpty() || host.endsWith(".")) return null

    return host
}

private fun normalizeRequestedHost(webDomain: String?): String? {
    if (webDomain.isNullOrBlank()) return null

    val host = webDomain.trim().lowercase().removeSuffix(".")
    return host.ifEmpty { null }
}

fun decideAutofill(webDomain: String?, savedUrl: String?): AutofillDecision {
    val saved = hostOfSavedUrl(savedUrl) ?: return AutofillDecision.NoSavedUrl
    val requested = normalizeRequestedHost(webDomain) ?: return AutofillDecision.NotAWebPage

    if (requested != saved) return AutofillDecision.HostMismatch(requested, saved)

    return AutofillDecision.Allowed(requested)
}
