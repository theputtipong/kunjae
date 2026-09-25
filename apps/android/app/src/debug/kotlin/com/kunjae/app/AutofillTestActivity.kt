package com.kunjae.app

import android.app.Activity
import android.os.Bundle
import android.webkit.WebView
import android.widget.LinearLayout

class AutofillTestActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val url = intent?.getStringExtra("url") ?: "http://10.0.2.2:9000"

        val webView = WebView(this).apply {
            @Suppress("SetJavaScriptEnabled")
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = false
            loadUrl(url)
        }

        setContentView(
            LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                addView(webView)
            },
        )
    }
}
