package com.kunjae.app

import com.kunjae.client.ApiClient

object ApiClientHolder {
    val api: ApiClient by lazy { ApiClient(BuildConfig.API_BASE_URL) }
}
