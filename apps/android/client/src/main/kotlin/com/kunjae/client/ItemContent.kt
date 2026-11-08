package com.kunjae.client

object ItemLimits {
    const val MAX_CONTENT_BYTES = 32_768
    const val TITLE = 200
    const val USERNAME = 512
    const val PASSWORD = 1024
    const val URL = 2048
    const val URL_COUNT = 32
    const val NOTES = 10_000
    const val TAG_NAME = 40
    const val TAG_COUNT = 24
    const val CUSTOM_FIELD_NAME = 100
    const val CUSTOM_FIELD_VALUE = 2048
    const val CUSTOM_FIELD_COUNT = 48
    const val TOTP_SECRET = 256
    const val TOTP_DIGITS_MIN = 6
    const val TOTP_DIGITS_MAX = 8
    const val TOTP_PERIOD_MIN = 15
    const val TOTP_PERIOD_MAX = 300
    const val CARD_NUMBER = 32
    const val CARDHOLDER_NAME = 200
    const val SECURITY_CODE = 8
}

private const val DATE_SOURCE =
    "(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|" +
        "\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))"

private val DATETIME = Regex(
    "^${DATE_SOURCE}T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$",
)

private val EXPIRY_MONTH = Regex("^(0[1-9]|1[0-2])$")

private val EXPIRY_YEAR = Regex("^\\d{4}$")

private class IssueCollector {
    val paths = LinkedHashSet<String>()

    fun max(path: String, value: String, limit: Int) {
        if (value.length > limit) paths += path
    }

    fun range(path: String, value: String, limit: Int) {
        if (value.isEmpty() || value.length > limit) paths += path
    }

    fun pattern(path: String, value: String, regex: Regex) {
        if (value.isNotEmpty() && !regex.matches(value)) paths += path
    }

    fun <T> list(path: String, values: List<T>, limit: Int, each: (String, T) -> Unit) {
        if (values.size > limit) paths += path
        values.forEachIndexed { i, value -> each("$path.$i", value) }
    }
}

fun invalidItemFields(item: VaultItem): List<String> {
    val c = IssueCollector()

    c.range("title", item.title, ItemLimits.TITLE)
    c.max("notes", item.notes, ItemLimits.NOTES)
    c.list("tags", item.tags, ItemLimits.TAG_COUNT) { path, tag -> c.range(path, tag, ItemLimits.TAG_NAME) }
    c.list("customFields", item.customFields, ItemLimits.CUSTOM_FIELD_COUNT) { path, field ->
        c.range("$path.name", field.name, ItemLimits.CUSTOM_FIELD_NAME)
        c.max("$path.value", field.value, ItemLimits.CUSTOM_FIELD_VALUE)
    }
    if (!DATETIME.matches(item.createdAt)) c.paths += "createdAt"
    if (!DATETIME.matches(item.updatedAt)) c.paths += "updatedAt"

    when (item) {
        is LoginItem -> {
            c.max("username", item.username, ItemLimits.USERNAME)
            c.max("password", item.password, ItemLimits.PASSWORD)
            c.list("urls", item.urls, ItemLimits.URL_COUNT) { path, url -> c.range(path, url, ItemLimits.URL) }
            c.max("totpSecret", item.totpSecret, ItemLimits.TOTP_SECRET)
            if (item.totpAlgorithm != null && item.totpAlgorithm !in TOTP_ALGORITHMS) c.paths += "totpAlgorithm"
            if (item.totpDigits != null && item.totpDigits !in ItemLimits.TOTP_DIGITS_MIN..ItemLimits.TOTP_DIGITS_MAX) {
                c.paths += "totpDigits"
            }
            if (item.totpPeriod != null && item.totpPeriod !in ItemLimits.TOTP_PERIOD_MIN..ItemLimits.TOTP_PERIOD_MAX) {
                c.paths += "totpPeriod"
            }
        }
        is SecureNoteItem -> Unit
        is CardItem -> {
            c.max("cardholderName", item.cardholderName, ItemLimits.CARDHOLDER_NAME)
            c.max("number", item.number, ItemLimits.CARD_NUMBER)
            c.pattern("expiryMonth", item.expiryMonth, EXPIRY_MONTH)
            c.pattern("expiryYear", item.expiryYear, EXPIRY_YEAR)
            c.max("securityCode", item.securityCode, ItemLimits.SECURITY_CODE)
        }
    }

    if (c.paths.isEmpty() && itemContentBytes(item).size > ItemLimits.MAX_CONTENT_BYTES) c.paths += "content"

    return c.paths.toList()
}

internal fun itemContentBytes(item: VaultItem): ByteArray = itemToJson(item).toString().toByteArray(Charsets.UTF_8)
