package com.kunjae.app

object AutofillPolicy {

    val trustedBrowsers: Set<String> = setOf(
        "com.android.chrome",
        "com.chrome.beta",
        "com.chrome.dev",
        "com.chrome.canary",
        "org.mozilla.firefox",
        "org.mozilla.firefox_beta",
        "org.mozilla.fenix",
        "org.mozilla.focus",
        "com.sec.android.app.sbrowser",
        "com.sec.android.app.sbrowser.beta",
        "com.microsoft.emmx",
        "com.brave.browser",
        "com.opera.browser",
        "com.vivaldi.browser",
        "com.duckduckgo.mobile.android",
    )

    fun honorsWebDomain(callerPackage: String?, extraTrusted: Set<String> = emptySet()): Boolean =
        callerPackage != null && (callerPackage in trustedBrowsers || callerPackage in extraTrusted)

    fun schemeAllows(pageScheme: String?, savedUrl: String?): Boolean {
        val page = pageScheme?.trim()?.lowercase()
        val saved = savedUrl?.trim()?.substringBefore("://", "")?.lowercase()
        return !(page == "http" && saved == "https")
    }
}
