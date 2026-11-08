package com.kunjae.app

import androidx.annotation.RequiresApi
import android.os.Build
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
import android.view.autofill.AutofillId
import android.util.Log
import android.view.autofill.AutofillValue
import android.widget.RemoteViews
import com.kunjae.client.AutofillDecision
import com.kunjae.client.DecryptedItem
import com.kunjae.client.LoginItem
import com.kunjae.client.decideAppAutofill
import com.kunjae.client.decideAutofill
import com.kunjae.client.hostOfSavedUrl
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

@RequiresApi(Build.VERSION_CODES.P)
class KunjaeAutofillService : AutofillService() {

    private companion object {
        const val VERIFY_DEADLINE_MS = 3_500L

        const val VERIFY_THREADS = 4

        const val EMULATOR_HOST_ALIAS = "10.0.2.2"
    }

    private data class Fields(
        val usernameId: AutofillId?,
        val passwordId: AutofillId?,
        val otpId: AutofillId?,
        val webDomain: String?,
        val webScheme: String?,
    )

    private val verifier = Executors.newCachedThreadPool()

    private val fetchers = Executors.newFixedThreadPool(VERIFY_THREADS)

    override fun onDestroy() {
        super.onDestroy()
        verifier.shutdownNow()
        fetchers.shutdownNow()
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

        if (SessionHolder.peek() == null) {
            callback.onSuccess(null)
            return
        }

        val logins = ItemStore.all().filter { it.item is LoginItem }

        val target = structure.activityComponent?.packageName
        val debugBrowsers = if (BuildConfig.DEBUG) setOf(packageName) else emptySet()

        if (fields.webDomain != null && AutofillPolicy.honorsWebDomain(target, debugBrowsers)) {
            val matches = logins.filter { entry ->
                val saved = (entry.item as? LoginItem)?.urls?.firstOrNull()
                decideAutofill(fields.webDomain, saved) is AutofillDecision.Allowed &&
                    AutofillPolicy.schemeAllows(fields.webScheme, saved)
            }
            diagnose("matches=${matches.size} of ${ItemStore.all().size} items")
            callback.onSuccess(responseFor(matches, fields))
            return
        }

        if (target == null || (target == packageName && !BuildConfig.DEBUG)) {
            callback.onSuccess(null)
            return
        }

        val cancelled = AtomicBoolean(false)
        cancellationSignal.setOnCancelListener { cancelled.set(true) }

        verifier.execute {
            val savedHosts = logins.mapNotNull { entry -> hostOfSavedUrl((entry.item as? LoginItem)?.urls?.firstOrNull()) }
            val debugHosts = if (BuildConfig.DEBUG) setOf(EMULATOR_HOST_ALIAS) else emptySet()
            val candidates = AssetLinksScope.candidates(target, savedHosts, debugHosts)

            val verified = if (cancelled.get()) {
                emptySet()
            } else {
                AssetLinksScope.verifyAll(candidates, fetchers, VERIFY_DEADLINE_MS) { host ->
                    !cancelled.get() && AssetLinksVerifier.authorizes(applicationContext, host, target)
                }
            }

            val matches = logins.filter { entry ->
                val urls = (entry.item as? LoginItem)?.urls
                decideAppAutofill(target, urls?.firstOrNull()) { host -> host in verified } is AutofillDecision.AllowedByAssetLinks
            }

            diagnose(
                "native app $target: ${matches.size} items verified by Asset Links " +
                    "(${verified.size}/${candidates.size} hosts)" +
                    if (AssetLinksVerifier.canReadCertificate(applicationContext, target)) {
                        ""
                    } else {
                        " (could not read that app's certificate)"
                    },
            )

            if (cancelled.get()) return@execute

            if (SessionHolder.peek() == null) {
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
        val nodes = mutableListOf<FieldNode<AutofillId>>()

        fun visit(node: AssistStructure.ViewNode, parentDomain: String?, parentScheme: String?) {
            val ownDomain = node.webDomain?.takeIf { it.isNotBlank() }
            val domain = AutofillFields.inherit(ownDomain, parentDomain)
            val scheme = if (ownDomain != null) node.webScheme else parentScheme

            val html = node.htmlInfo
            val attributes = html?.attributes
            val kind = AutofillFields.classify(
                hints = node.autofillHints?.toList() ?: emptyList(),
                inputType = node.inputType,
                htmlTag = html?.tag,
                htmlType = attributes?.firstOrNull { it.first == "type" }?.second,
                htmlAutocomplete = attributes?.firstOrNull { it.first == "autocomplete" }?.second,
            )

            val id = node.autofillId
            if (id != null && kind != FieldKind.OTHER) nodes += FieldNode(id, kind, domain, scheme)

            for (i in 0 until node.childCount) visit(node.getChildAt(i), domain, scheme)
        }

        for (i in 0 until structure.windowNodeCount) visit(structure.getWindowNodeAt(i).rootViewNode, null, null)

        val selected = AutofillFields.select(nodes)
        return Fields(selected.usernameId, selected.passwordId, selected.otpId, selected.webDomain, selected.webScheme)
    }

    private fun diagnose(message: String) {
        if (BuildConfig.DEBUG) Log.i("KunjaeAutofill", message)
    }

    override fun onSaveRequest(request: SaveRequest, callback: SaveCallback) {
        callback.onFailure(localized().getString(R.string.autofill_save_unsupported))
    }

    private fun localized(): Context = AppLocale.wrap(this)
}
