package com.kunjae.app

import android.content.Context
import androidx.annotation.StringRes
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.kunjae.app.ui.IconBadge
import com.kunjae.app.ui.KIcons
import com.kunjae.app.ui.KunjaeMark
import com.kunjae.app.ui.kunjaeButtonColors

object OnboardingPrefs {
    private const val FILE = "kunjae.prefs"
    private const val KEY_SEEN = "onboarding.seen.v1"

    fun seen(context: Context): Boolean =
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getBoolean(KEY_SEEN, false)

    fun markSeen(context: Context) {
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putBoolean(KEY_SEEN, true).apply()
    }
}

private data class Point(val icon: ImageVector, @StringRes val title: Int, @StringRes val body: Int, val bodyArgs: List<Any> = emptyList())

private data class Section(val icon: ImageVector?, @StringRes val heading: Int?, val points: List<Point>)

private data class Page(val icon: ImageVector, @StringRes val title: Int, val sections: List<Section>, @StringRes val footer: Int? = null)

private fun webSignUp(): Point = when {
    BuildConfig.WEB_ORIGIN.isNotEmpty() ->
        Point(KIcons.Person, R.string.two_ways_account_web_title, R.string.two_ways_account_web_origin, listOf(BuildConfig.WEB_ORIGIN))
    BuildConfig.DEBUG ->
        Point(KIcons.Person, R.string.two_ways_account_web_title, R.string.onboarding_hint_debug, listOf(BuildConfig.API_BASE_URL))
    else -> Point(KIcons.Person, R.string.two_ways_account_web_title, R.string.onboarding_hint_release)
}

private val welcome = listOf(
    Point(KIcons.Lock, R.string.welcome_zk_title, R.string.welcome_zk_body),
    Point(KIcons.Shield, R.string.onboarding_local_title, R.string.onboarding_local_body),
    Point(KIcons.Sync, R.string.welcome_sync_title, R.string.welcome_sync_body),
)

private fun pages(): List<Page> = listOf(
    Page(
        KIcons.Folder,
        R.string.two_ways_title,
        listOf(
            Section(
                KIcons.Shield,
                R.string.two_ways_local_heading,
                listOf(
                    Point(KIcons.Lock, R.string.two_ways_local_data_title, R.string.two_ways_local_data_body),
                    Point(KIcons.Info, R.string.two_ways_local_recovery_title, R.string.two_ways_local_recovery_body),
                    Point(KIcons.Folder, R.string.two_ways_local_separate_title, R.string.two_ways_local_separate_body),
                ),
            ),
            Section(
                KIcons.Sync,
                R.string.two_ways_account_heading,
                listOf(
                    Point(KIcons.Sync, R.string.two_ways_account_sync_title, R.string.two_ways_account_sync_body),
                    Point(KIcons.Key, R.string.two_ways_account_keys_title, R.string.two_ways_account_keys_body),
                    webSignUp(),
                ),
            ),
        ),
        footer = R.string.two_ways_move,
    ),
    Page(
        KIcons.Key,
        R.string.keys_title,
        listOf(
            Section(
                null,
                null,
                listOf(
                    Point(KIcons.Person, R.string.master_password, R.string.keys_master_body),
                    Point(KIcons.Key, R.string.keys_secret_title, R.string.keys_secret_body),
                ),
            ),
        ),
    ),
    Page(
        KIcons.Info,
        R.string.before_title,
        listOf(
            Section(
                null,
                null,
                listOf(
                    Point(KIcons.Info, R.string.before_no_reset_title, R.string.before_no_reset_body),
                    Point(KIcons.Folder, R.string.before_separate_title, R.string.before_separate_body),
                    Point(KIcons.Refresh, R.string.before_slow_title, R.string.before_slow_body),
                    Point(KIcons.Shield, R.string.before_biometric_title, R.string.before_biometric_body),
                ),
            ),
        ),
    ),
)

@Composable
fun OnboardingScreen(onDone: () -> Unit) {
    val details = remember { pages() }
    var index by remember { mutableStateOf(0) }
    val total = details.size + 1
    val last = index == total - 1

    Column(
        modifier = Modifier
            .fillMaxSize()
            .safeDrawingPadding()
            .padding(horizontal = 24.dp, vertical = 16.dp),
    ) {
        Column(
            modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            if (index == 0) {
                Spacer(Modifier.height(24.dp))
                KunjaeMark(112.dp, modifier = Modifier.align(Alignment.CenterHorizontally), description = stringResource(R.string.app_name))
                Text(
                    stringResource(R.string.welcome_title),
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
                Text(
                    stringResource(R.string.welcome_tagline),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
                welcome.forEach { PointRow(it) }
            } else {
                val page = details[index - 1]
                Spacer(Modifier.height(8.dp))
                IconBadge(page.icon, size = 64.dp)
                Text(stringResource(page.title), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
                page.sections.forEach { section ->
                    Surface(
                        shape = MaterialTheme.shapes.large,
                        color = MaterialTheme.colorScheme.surfaceContainer,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(16.dp),
                        ) {
                            if (section.heading != null) {
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                    if (section.icon != null) {
                                        Icon(section.icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
                                    }
                                    Text(stringResource(section.heading), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                                }
                            }
                            section.points.forEach { PointRow(it) }
                        }
                    }
                }
                page.footer?.let { footer ->
                    Surface(
                        shape = MaterialTheme.shapes.large,
                        color = MaterialTheme.colorScheme.primaryContainer,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(KIcons.Refresh, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimaryContainer, modifier = Modifier.size(20.dp))
                            Text(stringResource(footer), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
                        }
                    }
                }
            }
        }

        PageDots(count = total, current = index, modifier = Modifier.align(Alignment.CenterHorizontally).padding(vertical = 16.dp))

        Button(
            onClick = { if (last) onDone() else index += 1 },
            colors = kunjaeButtonColors(),
            modifier = Modifier.fillMaxWidth().height(52.dp),
        ) {
            Text(
                stringResource(
                    when {
                        index == 0 -> R.string.onboarding_start
                        last -> R.string.onboarding_finish
                        else -> R.string.onboarding_next
                    },
                ),
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            if (index > 0) TextButton(onClick = { index -= 1 }) { Text(stringResource(R.string.onboarding_back)) } else Spacer(Modifier)
            if (!last) TextButton(onClick = onDone) { Text(stringResource(R.string.onboarding_skip)) }
        }
    }
}

@Composable
private fun PointRow(point: Point) {
    Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.Top) {
        IconBadge(point.icon)
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(stringResource(point.title), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Text(stringResource(point.body, *point.bodyArgs.toTypedArray()), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun PageDots(count: Int, current: Int, modifier: Modifier = Modifier) {
    Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        repeat(count) { i ->
            Box(
                modifier = Modifier
                    .size(width = if (i == current) 24.dp else 8.dp, height = 8.dp)
                    .clip(CircleShape)
                    .background(
                        if (i == current) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.outlineVariant,
                    ),
            )
        }
    }
}
