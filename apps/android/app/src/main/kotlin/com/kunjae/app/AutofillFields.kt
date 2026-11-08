package com.kunjae.app

enum class FieldKind { USERNAME, PASSWORD, OTP, OTHER }

data class FieldNode<I>(
    val id: I,
    val kind: FieldKind,
    val webDomain: String?,
    val webScheme: String?,
)

data class FieldSelection<I>(
    val usernameId: I?,
    val passwordId: I?,
    val otpId: I?,
    val webDomain: String?,
    val webScheme: String?,
)

object AutofillFields {

    private const val HINT_PASSWORD = "password"
    private const val HINT_USERNAME = "username"
    private const val HINT_EMAIL = "emailAddress"
    private const val HINT_SMS_OTP = "smsOTPCode"
    private const val HINT_ONE_TIME_CODE = "one-time-code"

    private const val TYPE_MASK_VARIATION = 0x00000ff0
    private const val VARIATION_PASSWORD = 0x00000080
    private const val VARIATION_VISIBLE_PASSWORD = 0x00000090
    private const val VARIATION_WEB_PASSWORD = 0x000000e0

    fun classify(
        hints: List<String>,
        inputType: Int,
        htmlTag: String?,
        htmlType: String?,
        htmlAutocomplete: String?,
    ): FieldKind {
        val isInput = htmlTag == "input"
        val type = if (isInput) htmlType?.lowercase() else null
        val autocomplete = if (isInput) htmlAutocomplete?.lowercase() else null

        if (hints.any { it == HINT_SMS_OTP || it == HINT_ONE_TIME_CODE } || autocomplete == HINT_ONE_TIME_CODE) {
            return FieldKind.OTP
        }

        val variation = inputType and TYPE_MASK_VARIATION
        val passwordVariation = variation == VARIATION_PASSWORD ||
            variation == VARIATION_WEB_PASSWORD ||
            variation == VARIATION_VISIBLE_PASSWORD

        if (hints.any { it == HINT_PASSWORD } || passwordVariation || type == "password") return FieldKind.PASSWORD

        if (hints.any { it == HINT_USERNAME || it == HINT_EMAIL } || type == "email" || type == "text") {
            return FieldKind.USERNAME
        }

        return FieldKind.OTHER
    }

    fun inherit(own: String?, parent: String?): String? = own?.takeIf { it.isNotBlank() } ?: parent

    fun <I> select(nodes: List<FieldNode<I>>): FieldSelection<I> {
        val password = nodes.firstOrNull { it.kind == FieldKind.PASSWORD }
        val anchor = password ?: nodes.firstOrNull { it.kind == FieldKind.OTP }
            ?: return FieldSelection(null, null, null, null, null)

        val domain = normalize(anchor.webDomain)
        fun sameDomain(node: FieldNode<I>) = normalize(node.webDomain) == domain

        return FieldSelection(
            usernameId = if (password == null) null else nodes.firstOrNull { it.kind == FieldKind.USERNAME && sameDomain(it) }?.id,
            passwordId = password?.id,
            otpId = nodes.firstOrNull { it.kind == FieldKind.OTP && sameDomain(it) }?.id,
            webDomain = anchor.webDomain?.takeIf { it.isNotBlank() },
            webScheme = anchor.webScheme,
        )
    }

    private fun normalize(domain: String?): String? =
        domain?.trim()?.lowercase()?.removeSuffix(".")?.ifEmpty { null }
}
