package com.kunjae.app

import com.kunjae.client.DecryptedItem

object ItemStore {

    private var items: List<DecryptedItem> = emptyList()

    @Synchronized
    fun replaceAll(next: Collection<DecryptedItem>) {
        items = next.toList()
    }

    @Synchronized
    fun all(): List<DecryptedItem> = items

    @Synchronized
    fun clear() {
        items = emptyList()
    }
}
