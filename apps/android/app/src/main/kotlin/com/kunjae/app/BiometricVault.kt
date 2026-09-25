package com.kunjae.app

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.security.keystore.StrongBoxUnavailableException
import android.os.Build
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

object BiometricVault {

    private const val KEY_ALIAS = "kunjae.session.v1"
    private const val FILE_NAME = "kunjae.session.v1.bin"

    private const val KEYSTORE = "AndroidKeyStore"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val GCM_TAG_BITS = 128
    private const val NONCE_BYTES = 12

    private const val MAX_AGE_MS = 14L * 24 * 60 * 60 * 1000

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

    fun hasRemembered(context: Context): Boolean = file(context).exists()

    fun forget(context: Context) {
        file(context).delete()
        runCatching {
            keyStore().deleteEntry(KEY_ALIAS)
        }
    }

    fun beginRemember(context: Context): Cipher? = runCatching {
        forget(context)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, createKey(context))
        cipher
    }.getOrNull()

    fun finishRemember(
        context: Context,
        cipher: Cipher,
        email: String,
        authKey: ByteArray,
        wrappingKey: ByteArray,
        nowMs: Long = System.currentTimeMillis(),
    ): Boolean = runCatching {
        val payload = encodePayload(email, authKey, wrappingKey, nowMs)

        val sealed = try {
            cipher.doFinal(payload)
        } finally {
            com.kunjae.crypto.wipe(payload)
        }

        val nonce = cipher.iv
        require(nonce.size == NONCE_BYTES) { "ขนาด nonce ไม่ตรงกับที่ออกแบบไว้" }

        val temp = File(file(context).parentFile, "$FILE_NAME.tmp")
        temp.writeBytes(nonce + sealed)
        temp.renameTo(file(context))
    }.getOrDefault(false)

    fun beginRecall(context: Context): Cipher? {
        val stored = runCatching { file(context).readBytes() }.getOrNull() ?: return null
        if (stored.size <= NONCE_BYTES) {
            forget(context)
            return null
        }

        val key = runCatching { existingKey() }.getOrNull()
        if (key == null) {
            forget(context)
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
            forget(context)
            null
        }
    }

    fun finishRecall(
        context: Context,
        cipher: Cipher,
        nowMs: Long = System.currentTimeMillis(),
    ): Remembered? {
        val stored = runCatching { file(context).readBytes() }.getOrNull() ?: return null

        val opened = runCatching {
            cipher.doFinal(stored, NONCE_BYTES, stored.size - NONCE_BYTES)
        }.getOrNull()

        if (opened == null) {
            forget(context)
            return null
        }

        try {
            val parsed = decodePayload(opened)
            if (parsed == null || nowMs - parsed.second > MAX_AGE_MS) {
                parsed?.first?.wipe()
                forget(context)
                return null
            }
            return parsed.first
        } finally {
            com.kunjae.crypto.wipe(opened)
        }
    }

    private const val KEY_BYTES = 32
    private const val HEADER_BYTES = 8 + KEY_BYTES + KEY_BYTES

    private fun encodePayload(
        email: String,
        authKey: ByteArray,
        wrappingKey: ByteArray,
        nowMs: Long,
    ): ByteArray {
        require(authKey.size == KEY_BYTES && wrappingKey.size == KEY_BYTES) {
            "ขนาดกุญแจไม่ตรงกับที่ออกแบบไว้"
        }

        val emailBytes = email.toByteArray(Charsets.UTF_8)
        val out = ByteArray(HEADER_BYTES + emailBytes.size)

        for (i in 0 until 8) out[i] = (nowMs shr (8 * (7 - i))).toByte()
        authKey.copyInto(out, 8)
        wrappingKey.copyInto(out, 8 + KEY_BYTES)
        emailBytes.copyInto(out, HEADER_BYTES)

        return out
    }

    private fun decodePayload(bytes: ByteArray): Pair<Remembered, Long>? {
        if (bytes.size < HEADER_BYTES) return null

        var savedAtMs = 0L
        for (i in 0 until 8) savedAtMs = (savedAtMs shl 8) or (bytes[i].toLong() and 0xFF)

        val email = runCatching {
            String(bytes, HEADER_BYTES, bytes.size - HEADER_BYTES, Charsets.UTF_8)
        }.getOrNull() ?: return null

        return Remembered(
            email = email,
            authKey = bytes.copyOfRange(8, 8 + KEY_BYTES),
            wrappingKey = bytes.copyOfRange(8 + KEY_BYTES, HEADER_BYTES),
        ) to savedAtMs
    }

    private fun file(context: Context): File = File(context.filesDir, FILE_NAME)

    private fun keyStore(): KeyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }

    private fun existingKey(): SecretKey? = keyStore().getKey(KEY_ALIAS, null) as? SecretKey

    private fun createKey(context: Context): SecretKey {
        val hasStrongBox = context.packageManager
            .hasSystemFeature(android.content.pm.PackageManager.FEATURE_STRONGBOX_KEYSTORE)

        return try {
            generate(strongBox = hasStrongBox)
        } catch (_: StrongBoxUnavailableException) {
            generate(strongBox = false)
        }
    }

    private fun generate(strongBox: Boolean): SecretKey {
        val builder = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
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
