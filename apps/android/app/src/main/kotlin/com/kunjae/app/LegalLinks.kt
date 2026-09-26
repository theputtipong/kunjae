package com.kunjae.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign

private const val PRODUCTION_WEB_ORIGIN = "https://kunjae.pdouvch.com"

enum class LegalPage(val path: String) {
    PRIVACY("/privacy"),
    TERMS("/terms"),
}

fun legalUrl(page: LegalPage): String {
    val origin = BuildConfig.WEB_ORIGIN.ifEmpty { PRODUCTION_WEB_ORIGIN }
    return origin.trimEnd('/') + page.path
}

fun openLegalPage(activity: Activity?, page: LegalPage) {
    runCatching { activity?.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(legalUrl(page)))) }
}

@Composable
fun AgreementNote(modifier: Modifier = Modifier) {
    val activity = LocalContext.current as? Activity
    Column(modifier = modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            stringResource(R.string.legal_agreement),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
        Row(horizontalArrangement = Arrangement.Center) {
            TextButton(onClick = { openLegalPage(activity, LegalPage.TERMS) }) { Text(stringResource(R.string.legal_terms)) }
            TextButton(onClick = { openLegalPage(activity, LegalPage.PRIVACY) }) { Text(stringResource(R.string.legal_privacy)) }
        }
    }
}
