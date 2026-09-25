package com.kunjae.app

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.service.autofill.Dataset
import android.view.autofill.AutofillId
import android.view.autofill.AutofillManager
import android.view.autofill.AutofillValue
import android.widget.RemoteViews
import com.kunjae.client.LoginItem
import com.kunjae.crypto.CryptoResult
import com.kunjae.crypto.totpFromSecretText

class OtpFillActivity : Activity() {

    companion object {
        const val EXTRA_ITEM_ID: String = "com.kunjae.app.ITEM_ID"

        const val EXTRA_FIELD_ID: String = "com.kunjae.app.FIELD_ID"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setResult(RESULT_CANCELED)

        if (IntegrityGuard.compromised(this)) {
            SessionHolder.lock()
            finish()
            return
        }

        val itemId = intent.getStringExtra(EXTRA_ITEM_ID)
        val fieldId: AutofillId? = intent.getParcelableExtra(EXTRA_FIELD_ID, AutofillId::class.java)

        if (itemId == null || fieldId == null) {
            finish()
            return
        }

        if (SessionHolder.active() == null) {
            finish()
            return
        }

        val login = ItemStore.all()
            .firstOrNull { it.itemId == itemId }
            ?.item as? LoginItem

        if (login == null || login.totpSecret.isBlank()) {
            finish()
            return
        }

        val computed = totpFromSecretText(login.totpSecret, System.currentTimeMillis())
        if (computed !is CryptoResult.Ok) {
            finish()
            return
        }

        val presentation = RemoteViews(packageName, android.R.layout.simple_list_item_1).apply {
            setTextViewText(android.R.id.text1, login.title)
        }

        val dataset = Dataset.Builder(presentation)
            .setValue(fieldId, AutofillValue.forText(computed.value.code))
            .build()

        setResult(
            RESULT_OK,
            Intent().putExtra(AutofillManager.EXTRA_AUTHENTICATION_RESULT, dataset),
        )
        finish()
    }
}
