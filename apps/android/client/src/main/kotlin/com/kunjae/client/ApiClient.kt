package com.kunjae.client

import com.kunjae.crypto.CryptoFailure
import com.kunjae.crypto.CryptoResult
import com.kunjae.crypto.err
import com.kunjae.crypto.ok
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import org.json.JSONObject

sealed interface ApiFailure {
    data object NetworkUnavailable : ApiFailure

    data class Rejected(val code: String) : ApiFailure

    data object UntrustedResponse : ApiFailure
}

sealed interface ApiResult<out T> {
    data class Ok<T>(val value: T) : ApiResult<T>
    data class Err(val failure: ApiFailure) : ApiResult<Nothing>
}

private const val TIMEOUT_MS = 20_000

private const val MAX_RESPONSE_BYTES = 16 * 1024 * 1024

class ApiClient(baseUrl: String) {
    private val base: String

    init {
        val uri = URI.create(baseUrl)

        val isLoopback = uri.host == "127.0.0.1" || uri.host == "10.0.2.2"
        val safe = uri.scheme == "https" || (uri.scheme == "http" && isLoopback)
        require(safe) { "The API address must use https (except for a local address during development)" }

        base = baseUrl.trimEnd('/')
    }

    private fun post(path: String, body: JSONObject, token: String?): ApiResult<String> {
        val connection = try {
            URL("$base$path").openConnection() as HttpURLConnection
        } catch (_: Exception) {
            return ApiResult.Err(ApiFailure.NetworkUnavailable)
        }

        return try {
            connection.requestMethod = "POST"
            connection.connectTimeout = TIMEOUT_MS
            connection.readTimeout = TIMEOUT_MS
            connection.doOutput = true

            connection.instanceFollowRedirects = false

            connection.setRequestProperty("Content-Type", "application/json")
            if (token != null) connection.setRequestProperty("Authorization", "Bearer $token")

            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }

            val status = connection.responseCode
            val stream: InputStream? =
                if (status in 200..299) connection.inputStream else connection.errorStream

            val text = stream?.let { readLimited(it) } ?: ""

            if (text.length > MAX_RESPONSE_BYTES) {
                return ApiResult.Err(ApiFailure.UntrustedResponse)
            }

            if (status in 200..299) return ApiResult.Ok(text)

            try {
                val code = JSONObject(text).optString("code", "")
                if (code.isEmpty()) ApiResult.Err(ApiFailure.UntrustedResponse)
                else ApiResult.Err(ApiFailure.Rejected(code))
            } catch (_: Exception) {
                ApiResult.Err(ApiFailure.UntrustedResponse)
            }
        } catch (_: Exception) {
            ApiResult.Err(ApiFailure.NetworkUnavailable)
        } finally {
            connection.disconnect()
        }
    }

    private fun readLimited(stream: InputStream): String {
        val buffer = ByteArray(8192)
        val out = StringBuilder()

        stream.use {
            while (true) {
                val read = it.read(buffer)
                if (read <= 0) break

                out.append(String(buffer, 0, read, Charsets.UTF_8))
                if (out.length > MAX_RESPONSE_BYTES) break
            }
        }

        return out.toString()
    }

    private fun <T> validated(parsed: CryptoResult<T>): ApiResult<T> = when (parsed) {
        is CryptoResult.Ok -> ApiResult.Ok(parsed.value)
        is CryptoResult.Err -> ApiResult.Err(ApiFailure.UntrustedResponse)
    }

    fun signUp(request: JSONObject): ApiResult<String> {
        return when (val response = post("/v1/auth/sign-up", request, null)) {
            is ApiResult.Err -> response
            is ApiResult.Ok -> {
                val accountId = try {
                    JSONObject(response.value).optString("accountId", "")
                } catch (_: Exception) {
                    ""
                }
                if (accountId.length != 26) ApiResult.Err(ApiFailure.UntrustedResponse)
                else ApiResult.Ok(accountId)
            }
        }
    }

    fun loginBegin(email: String): ApiResult<KdfChallenge> =
        when (val response = post("/v1/auth/login/begin", JSONObject().put("email", email), null)) {
            is ApiResult.Err -> response
            is ApiResult.Ok -> validated(parseKdfChallenge(response.value))
        }

    fun loginFinish(email: String, authKeyBase64Url: String): ApiResult<LoginResult> {
        if (!isValidAuthKey(authKeyBase64Url)) return ApiResult.Err(ApiFailure.UntrustedResponse)

        val body = JSONObject().put("email", email).put("authKey", authKeyBase64Url)

        return when (val response = post("/v1/auth/login/finish", body, null)) {
            is ApiResult.Err -> response
            is ApiResult.Ok -> validated(parseLoginResult(response.value))
        }
    }

    fun changePassword(body: JSONObject, token: String): ApiResult<Unit> =
        when (val response = post("/v1/auth/change-password", body, token)) {
            is ApiResult.Err -> response
            is ApiResult.Ok -> ApiResult.Ok(Unit)
        }

    fun createVault(body: JSONObject, token: String): ApiResult<Unit> =
        when (val response = post("/v1/vaults", body, token)) {
            is ApiResult.Err -> response
            is ApiResult.Ok -> ApiResult.Ok(Unit)
        }

    fun syncPull(since: Int, token: String): ApiResult<SyncPage> =
        when (val response = post("/v1/sync/pull", JSONObject().put("since", since), token)) {
            is ApiResult.Err -> response
            is ApiResult.Ok -> validated(parseSyncPage(response.value))
        }

    fun syncPush(changes: List<JSONObject>, token: String): ApiResult<PushResult> {
        val body = JSONObject().put("changes", changes.fold(org.json.JSONArray()) { acc, c -> acc.put(c) })

        return when (val response = post("/v1/sync/push", body, token)) {
            is ApiResult.Err -> response
            is ApiResult.Ok -> validated(parsePushResult(response.value))
        }
    }
}

internal fun <T> CryptoResult<T>.orFailure(): ApiResult<T> = when (this) {
    is CryptoResult.Ok -> ApiResult.Ok(value)
    is CryptoResult.Err -> ApiResult.Err(ApiFailure.UntrustedResponse)
}

internal fun cryptoError(): CryptoResult<Nothing> = err(CryptoFailure.INVALID_FORMAT)

internal fun unitOk(): CryptoResult<Unit> = ok(Unit)
