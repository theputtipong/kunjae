package com.kunjae.app

import android.app.Activity
import android.app.LocaleManager
import android.content.Context
import android.content.res.Configuration
import android.os.Build
import android.os.LocaleList
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import java.util.Locale

private const val PREFS_FILE = "kunjae.prefs"

private fun prefs(context: Context) = context.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE)

enum class ThemeMode(val key: String) {
    SYSTEM("system"),
    LIGHT("light"),
    DARK("dark"),
}

@Composable
fun ThemeMode.isDark(): Boolean = when (this) {
    ThemeMode.SYSTEM -> isSystemInDarkTheme()
    ThemeMode.LIGHT -> false
    ThemeMode.DARK -> true
}

object ThemePrefs {
    private const val KEY = "theme.mode.v1"

    fun load(context: Context): ThemeMode {
        val stored = prefs(context).getString(KEY, null)
        return ThemeMode.entries.firstOrNull { it.key == stored } ?: ThemeMode.SYSTEM
    }

    fun save(context: Context, mode: ThemeMode) {
        prefs(context).edit().putString(KEY, mode.key).apply()
    }
}

object AppLocale {
    private const val KEY = "app.locale.v1"

    val supported: List<String> = listOf("en", "th")

    fun displayName(tag: String): String {
        val locale = Locale.forLanguageTag(tag)
        return locale.getDisplayLanguage(locale).replaceFirstChar { it.titlecase(locale) }
    }

    fun selected(context: Context): String =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.getSystemService(LocaleManager::class.java)
                ?.applicationLocales
                ?.takeIf { !it.isEmpty }
                ?.get(0)
                ?.language
                ?.takeIf { it in supported }
                ?: ""
        } else {
            stored(context)
        }

    fun select(activity: Activity, tag: String) {
        val value = tag.takeIf { it in supported } ?: ""
        if (value == selected(activity)) return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            activity.getSystemService(LocaleManager::class.java)?.applicationLocales =
                if (value.isEmpty()) LocaleList.getEmptyLocaleList() else LocaleList.forLanguageTags(value)
        } else {
            prefs(activity).edit().putString(KEY, value).commit()
            activity.recreate()
        }
    }

    fun wrap(base: Context): Context {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) return base
        val tag = stored(base).ifEmpty { return base }

        val configuration = Configuration(base.resources.configuration)
        configuration.setLocales(LocaleList(Locale.forLanguageTag(tag)))
        return base.createConfigurationContext(configuration)
    }

    private fun stored(context: Context): String =
        prefs(context).getString(KEY, null)?.takeIf { it in supported } ?: ""
}
