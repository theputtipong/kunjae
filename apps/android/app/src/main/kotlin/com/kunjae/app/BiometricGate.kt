package com.kunjae.app

import android.app.Activity
import android.hardware.biometrics.BiometricManager
import android.hardware.biometrics.BiometricPrompt
import android.os.Build
import android.os.CancellationSignal
import javax.crypto.Cipher

object BiometricGate {

    sealed interface Outcome {
        data class Approved(val cipher: Cipher) : Outcome
        data class Refused(val message: String) : Outcome
    }

    fun isAvailable(activity: Activity): Boolean = runCatching {
        val manager = activity.getSystemService(BiometricManager::class.java) ?: return false

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) ==
                BiometricManager.BIOMETRIC_SUCCESS
        } else {
            @Suppress("DEPRECATION")
            manager.canAuthenticate() == BiometricManager.BIOMETRIC_SUCCESS
        }
    }.getOrDefault(false)

    fun authenticate(
        activity: Activity,
        cipher: Cipher,
        title: String,
        subtitle: String,
        onResult: (Outcome) -> Unit,
    ) {
        val executor = activity.mainExecutor

        val builder = BiometricPrompt.Builder(activity)
            .setTitle(title)
            .setSubtitle(subtitle)
            .setNegativeButton("ยกเลิก", executor) { _, _ -> }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            builder.setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            builder.setConfirmationRequired(true)
        }

        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                val approved = result.cryptoObject?.cipher
                onResult(
                    if (approved == null) Outcome.Refused("ระบบไม่ได้คืนกุญแจที่ยืนยันแล้ว")
                    else Outcome.Approved(approved),
                )
            }

            override fun onAuthenticationError(code: Int, message: CharSequence) {
                onResult(Outcome.Refused(message.toString()))
            }

        }

        builder.build().authenticate(
            BiometricPrompt.CryptoObject(cipher),
            CancellationSignal(),
            executor,
            callback,
        )
    }
}
