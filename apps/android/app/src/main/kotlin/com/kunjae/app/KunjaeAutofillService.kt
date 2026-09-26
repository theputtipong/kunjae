package com.kunjae.app

import android.content.Context
import android.app.PendingIntent
import android.app.assist.AssistStructure
import android.content.Intent
import android.os.CancellationSignal
import android.service.autofill.AutofillService
import android.service.autofill.Dataset
import android.service.autofill.FillCallback
import android.service.autofill.FillRequest
import android.service.autofill.FillResponse
import android.service.autofill.SaveCallback
import android.service.autofill.SaveRequest
import android.view.View
import android.view.autofill.AutofillId
import android.util.Log
import android.view.autofill.AutofillValue
import android.widget.RemoteViews
import com.kunjae.client.AutofillDecision
import com.kunjae.client.DecryptedItem
import com.kunjae.client.LoginItem
import com.kunjae.client.decideAppAutofill
import com.kunjae.client.decideAutofill
import java.util.concurrent.Executors

class KunjaeAutofillService : AutofillService() {

    private companion object {
        const val HINT_SMS_OTP = "smsOTPCode"

        const val HINT_ONE_TIME_CODE = "one-time-code"
    }

    private data class Fields(
        val usernameId: AutofillId?,
        val passwordId: AutofillId?,
        val otpId: AutofillId?,
        val webDomain: String?,
    )

    private val verifier = Executors.newSingleThreadExecutor()

    override fun onDestroy() {
        super.onDestroy()
        verifier.shutdownNow()
    }

    override fun onFillRequest(
        request: FillRequest,
        cancellationSignal: CancellationSignal,
        callback: FillCallback,
    ) {
        if (IntegrityGuard.compromised(this)) {
            SessionHolder.lock()
            callback.onSuccess(null)
            return
        }

        val structure = request.fillContexts.lastOrNull()?.structure
        if (structure == null) {
            callback.onSuccess(null)
            return
        }

        val fields = findFields(structure)
        diagnose(
            "onFillRequest: webDomain=${fields.webDomain} password=${fields.passwordId != null} " +
                "username=${fields.usernameId != null} otp=${fields.otpId != null}",
        )

        if (fields.passwordId == null && fields.otpId == null) {
            callback.onSuccess(null)
            return
        }

        if (SessionHolder.active() == null) {
            callback.onSuccess(null)
            return
        }

        val logins = ItemStore.all().filter { it.item is LoginItem }

        if (fields.webDomain != null) {
            val matches = logins.filter { entry ->
                val urls = (entry.item as? LoginItem)?.urls
                decideAutofill(fields.webDomain, urls?.firstOrNull()) is AutofillDecision.Allowed
            }
            diagnose("matches=${matches.size} of ${ItemStore.all().size} items")
            callback.onSuccess(responseFor(matches, fields))
            return
        }

        val target = request.fillContexts.lastOrNull()?.structure?.activityComponent?.packageName

        if (target == null || (target == packageName && !BuildConfig.DEBUG)) {
            callback.onSuccess(null)
            return
        }

        var cancelled = false
        cancellationSignal.setOnCancelListener { cancelled = true }

        verifier.execute {
            val matches = logins.filter { entry ->
                val urls = (entry.item as? LoginItem)?.urls
                decideAppAutofill(target, urls?.firstOrNull()) { host ->
                    AssetLinksVerifier.authorizes(applicationContext, host, target)
                } is AutofillDecision.AllowedByAssetLinks
            }

            diagnose(
                "native app $target: ${matches.size} items verified by Asset Links" +
                    if (AssetLinksVerifier.canReadCertificate(applicationContext, target)) {
                        ""
                    } else {
                        " (could not read that app's certificate)"
                    },
            )

            if (cancelled) return@execute

            if (SessionHolder.active() == null) {
                callback.onSuccess(null)
                return@execute
            }

            callback.onSuccess(responseFor(matches, fields))
        }
    }

    private fun responseFor(matches: List<DecryptedItem>, fields: Fields): FillResponse? {
        if (matches.isEmpty()) return null

        val response = FillResponse.Builder()
        var added = 0

        for ((index, entry) in matches.withIndex()) {
            val login = entry.item as? LoginItem ?: continue

            if (fields.usernameId != null || fields.passwordId != null) {
                response.addDataset(buildDataset(login, fields))
                added += 1
            }

            if (fields.otpId != null && login.totpSecret.isNotBlank()) {
                response.addDataset(buildOtpDataset(entry.itemId, login, fields.otpId, index))
                added += 1
            }
        }

        if (added == 0) return null
        return response.build()
    }

    private fun buildOtpDataset(
        itemId: String,
        item: LoginItem,
        otpId: AutofillId,
        requestCode: Int,
    ): Dataset {
        val presentation = RemoteViews(packageName, android.R.layout.simple_list_item_1).apply {
            setTextViewText(android.R.id.text1, localized().getString(R.string.autofill_otp_label, item.title))
        }

        val intent = Intent(this, OtpFillActivity::class.java)
            .putExtra(OtpFillActivity.EXTRA_ITEM_ID, itemId)
            .putExtra(OtpFillActivity.EXTRA_FIELD_ID, otpId)

        val pending = PendingIntent.getActivity(
            this,
            requestCode,
            intent,
            PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_CANCEL_CURRENT,
        )

        return Dataset.Builder(presentation)
            .setValue(otpId, null)
            .setAuthentication(pending.intentSender)
            .build()
    }

    private fun buildDataset(item: LoginItem, fields: Fields): Dataset {
        val presentation = RemoteViews(packageName, android.R.layout.simple_list_item_1).apply {
            setTextViewText(android.R.id.text1, "${item.title} · ${item.username}")
        }

        val builder = Dataset.Builder(presentation)

        fields.usernameId?.let {
            builder.setValue(it, AutofillValue.forText(item.username))
        }
        fields.passwordId?.let {
            builder.setValue(it, AutofillValue.forText(item.password))
        }

        return builder.build()
    }

    private fun findFields(structure: AssistStructure): Fields {
        var usernameId: AutofillId? = null
        var passwordId: AutofillId? = null
        var otpId: AutofillId? = null
        var webDomain: String? = null

        fun visit(node: AssistStructure.ViewNode) {
            node.webDomain?.let { if (it.isNotBlank() && webDomain == null) webDomain = it }

            val hints = node.autofillHints?.toList() ?: emptyList()

            val variation = node.inputType and android.text.InputType.TYPE_MASK_VARIATION
            val isPasswordVariation = variation == android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD ||
                variation == android.text.InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD ||
                variation == android.text.InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD

            val html = node.htmlInfo
            val htmlType = if (html?.tag == "input") {
                html.attributes?.firstOrNull { it.first == "type" }?.second?.lowercase()
            } else {
                null
            }

            val isPassword = hints.any { it == View.AUTOFILL_HINT_PASSWORD } ||
                isPasswordVariation ||
                htmlType == "password"

            val isUsername = hints.any {
                it == View.AUTOFILL_HINT_USERNAME || it == View.AUTOFILL_HINT_EMAIL_ADDRESS
            } || htmlType == "email" || htmlType == "text"

            val htmlAutocomplete = if (html?.tag == "input") {
                html.attributes?.firstOrNull { it.first == "autocomplete" }?.second?.lowercase()
            } else {
                null
            }

            val isOtp = hints.any { it == HINT_SMS_OTP || it == HINT_ONE_TIME_CODE } ||
                htmlAutocomplete == "one-time-code"

            val id = node.autofillId
            if (id != null) {
                if (isOtp && otpId == null) otpId = id
                else if (isPassword && passwordId == null) passwordId = id
                else if (isUsername && usernameId == null) usernameId = id
            }

            for (i in 0 until node.childCount) visit(node.getChildAt(i))
        }

        for (i in 0 until structure.windowNodeCount) visit(structure.getWindowNodeAt(i).rootViewNode)

        return Fields(usernameId, passwordId, otpId, webDomain)
    }

    private fun diagnose(message: String) {
        if (BuildConfig.DEBUG) Log.i("KunjaeAutofill", message)
    }

    override fun onSaveRequest(request: SaveRequest, callback: SaveCallback) {
        callback.onFailure(localized().getString(R.string.autofill_save_unsupported))
    }

    private fun localized(): Context = AppLocale.wrap(this)
}
