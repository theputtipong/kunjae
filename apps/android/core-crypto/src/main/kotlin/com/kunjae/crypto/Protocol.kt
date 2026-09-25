package com.kunjae.crypto

const val ITEM_AAD_PREFIX = "kunjae.v1.item|"
const val VAULT_META_AAD_PREFIX = "kunjae.v1.vault-meta|"
const val VAULT_KEY_AAD_PREFIX = "kunjae.v1.vault-key|"

fun buildItemAad(itemId: String, version: Int): String = "$ITEM_AAD_PREFIX$itemId|$version"

fun buildVaultMetaAad(vaultId: String, version: Int): String =
    "$VAULT_META_AAD_PREFIX$vaultId|$version"

fun buildVaultKeyAad(vaultId: String): String = "$VAULT_KEY_AAD_PREFIX$vaultId"
