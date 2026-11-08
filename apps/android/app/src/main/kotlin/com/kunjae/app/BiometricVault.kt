package com.kunjae.app

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.security.keystore.StrongBoxUnavailableException
import android.os.Build
import androidx.annotation.RequiresApi
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

object BiometricVault {

    enum class Slot(val keyAlias: String, val fileName: String) {
        ACCOUNT("kunjae.session.v1", "kunjae.session.v1.bin"),
        LOCAL("kunjae.local.session.v1", "kunjae.local.session.v1.bin"),
    }

    private const val KEYSTORE = "AndroidKeyStore"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val GCM_TAG_BITS = 128
    private const val NONCE_BYTES = 12

    data class Remembered(
        val email: String,
        val authKey: ByteArray,
        val wrappingKey: ByteArray,
    ) {
        override fun toString(): String = "Remembered(***)"
        fun wipe() {
            com.kunjae.crypto.wipe(authKey)
            com.kunjae.crypto.wipe(wrappingKey)
        }
    }

    fun hasRemembered(context: Context, slot: Slot = Slot.ACCOUNT): Boolean = file(context, slot).exists()

    fun forget(context: Context, slot: Slot = Slot.ACCOUNT) {
        file(context, slot).delete()
        runCatching {
            keyStore().deleteEntry(slot.keyAlias)
        }
    }

    fun beginRemember(context: Context, slot: Slot = Slot.ACCOUNT): Cipher? = runCatching {
        forget(context, slot)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, createKey(context, slot))
        cipher
    }.getOrNull()

    fun finishRememberLocal(
        context: Context,
        cipher: Cipher,
        wrappingKey: ByteArray,
        nowMs: Long = System.currentTimeMillis(),
    ): Boolean = seal(
        context,
        cipher,
        Slot.LOCAL,
        BiometricPayload.encode("", ByteArray(BiometricPayload.KEY_BYTES), wrappingKey, nowMs),
    )

    fun finishRemember(
        context: Context,
        cipher: Cipher,
        email: String,
        authKey: ByteArray,
        wrappingKey: ByteArray,
        nowMs: Long = System.currentTimeMillis(),
    ): Boolean = seal(context, cipher, Slot.ACCOUNT, BiometricPayload.encode(email, authKey, wrappingKey, nowMs))

    private fun seal(context: Context, cipher: Cipher, slot: Slot, payload: ByteArray): Boolean = runCatching {
        val sealed = try {
            cipher.doFinal(payload)
        } finally {
            com.kunjae.crypto.wipe(payload)
        }

        val nonce = cipher.iv
        require(nonce.size == NONCE_BYTES) { "Unexpected nonce size" }

        val temp = File(file(context, slot).parentFile, "${slot.fileName}.tmp")
        temp.writeBytes(nonce + sealed)
        temp.renameTo(file(context, slot))
    }.getOrDefault(false)

    fun beginRecall(context: Context, slot: Slot = Slot.ACCOUNT): Cipher? {
        val stored = runCatching { file(context, slot).readBytes() }.getOrNull() ?: return null
        if (stored.size <= NONCE_BYTES) {
            forget(context, slot)
            return null
        }

        val key = runCatching { existingKey(slot) }.getOrNull()
        if (key == null) {
            forget(context, slot)
            return null
        }

        return runCatching {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(
                Cipher.DECRYPT_MODE,
                key,
                GCMParameterSpec(GCM_TAG_BITS, stored, 0, NONCE_BYTES),
            )
            cipher
        }.getOrElse {
            forget(context, slot)
            null
        }
    }

    fun finishRecall(
        context: Context,
        cipher: Cipher,
        slot: Slot = Slot.ACCOUNT,
        nowMs: Long = System.currentTimeMillis(),
    ): Remembered? {
        val stored = runCatching { file(context, slot).readBytes() }.getOrNull() ?: return null

        val opened = runCatching {
            cipher.doFinal(stored, NONCE_BYTES, stored.size - NONCE_BYTES)
        }.getOrNull()

        if (opened == null) {
            forget(context, slot)
            return null
        }

        try {
            val parsed = BiometricPayload.decode(opened) ?: run {
                forget(context, slot)
                return null
            }
            val remembered = Remembered(parsed.email, parsed.authKey, parsed.wrappingKey)
            if (BiometricPayload.expired(parsed.savedAtMs, nowMs)) {
                remembered.wipe()
                forget(context, slot)
                return null
            }
            return remembered
        } finally {
            com.kunjae.crypto.wipe(opened)
        }
    }

    private fun file(context: Context, slot: Slot): File = File(context.filesDir, slot.fileName)

    private fun keyStore(): KeyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }

    private fun existingKey(slot: Slot): SecretKey? = keyStore().getKey(slot.keyAlias, null) as? SecretKey

    private fun createKey(context: Context, slot: Slot): SecretKey =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) createKeyOnP(context, slot) else generate(slot, strongBox = false)

    @RequiresApi(Build.VERSION_CODES.P)
    private fun createKeyOnP(context: Context, slot: Slot): SecretKey {
        val hasStrongBox = context.packageManager
            .hasSystemFeature(android.content.pm.PackageManager.FEATURE_STRONGBOX_KEYSTORE)

        return try {
            generate(slot, strongBox = hasStrongBox)
        } catch (_: StrongBoxUnavailableException) {
            generate(slot, strongBox = false)
        }
    }

    private fun generate(slot: Slot, strongBox: Boolean): SecretKey {
        val builder = KeyGenParameterSpec.Builder(
            slot.keyAlias,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)

            .setUserAuthenticationRequired(true)

            .setInvalidatedByBiometricEnrollment(true)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            builder.setUserAuthenticationParameters(
                0,
                KeyProperties.AUTH_BIOMETRIC_STRONG,
            )
        } else {
            @Suppress("DEPRECATION")
            builder.setUserAuthenticationValidityDurationSeconds(-1)
        }

        if (strongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            builder.setIsStrongBoxBacked(true)
        }

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
        generator.init(builder.build())
        return generator.generateKey()
    }
}
