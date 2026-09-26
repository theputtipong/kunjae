package com.kunjae.app

import com.kunjae.app.ui.KunjaeMark
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.Alignment
import androidx.compose.material3.Text
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Arrangement
import androidx.activity.viewModels
import android.content.Context
import android.graphics.Color
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.viewmodel.compose.viewModel
import com.kunjae.app.ui.KunjaeTheme

class MainActivity : ComponentActivity() {

    private var themeMode by mutableStateOf(ThemeMode.SYSTEM)

    override fun attachBaseContext(newBase: Context) {
        super.attachBaseContext(AppLocale.wrap(newBase))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        window.decorView.filterTouchesWhenObscured = true

        themeMode = ThemePrefs.load(this)
        applySystemBars(themeMode)

        if (IntegrityGuard.compromised(this)) {
            shutDown()
            return
        }

        setContent {
            KunjaeTheme(darkTheme = themeMode.isDark()) {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    KunjaeApp(themeMode = themeMode, onThemeChange = ::changeTheme)
                }
            }
        }
    }

    private fun changeTheme(mode: ThemeMode) {
        if (mode == themeMode) return
        ThemePrefs.save(this, mode)
        themeMode = mode
        applySystemBars(mode)
    }

    private fun applySystemBars(mode: ThemeMode) {
        val lightScrim = Color.argb(0xe6, 0xFF, 0xFF, 0xFF)
        val darkScrim = Color.argb(0x80, 0x1b, 0x1b, 0x1b)
        when (mode) {
            ThemeMode.SYSTEM -> enableEdgeToEdge(
                statusBarStyle = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT),
                navigationBarStyle = SystemBarStyle.auto(lightScrim, darkScrim),
            )
            ThemeMode.LIGHT -> enableEdgeToEdge(
                statusBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
                navigationBarStyle = SystemBarStyle.light(lightScrim, darkScrim),
            )
            ThemeMode.DARK -> enableEdgeToEdge(
                statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
                navigationBarStyle = SystemBarStyle.dark(darkScrim),
            )
        }
    }

    override fun onResume() {
        super.onResume()
        if (IntegrityGuard.compromised(this)) shutDown()
    }

    private fun shutDown() {
        val model: VaultViewModel by viewModels()
        model.lock()
        SessionHolder.lock()
        setContent {
            KunjaeTheme(darkTheme = themeMode.isDark()) {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    TamperedScreen()
                }
            }
        }
    }
}

@Composable
private fun TamperedScreen() {
    Column(
        modifier = Modifier.fillMaxSize().safeDrawingPadding().padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        KunjaeMark(80.dp)
        Text(
            stringResource(R.string.tamper_title),
            style = MaterialTheme.typography.titleLarge,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 24.dp),
        )
        Text(
            stringResource(R.string.tamper_body),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}

private sealed interface Route {
    data object List : Route
    data class Detail(val itemId: String) : Route
    data class Edit(val itemId: String?) : Route
    data object Settings : Route
    data object ChangePassword : Route
    data object LocalChangePassword : Route
}

private enum class Locked { START, CREATE_LOCAL, LOCAL_UNLOCK, ACCOUNT_UNLOCK }

@Composable
private fun KunjaeApp(
    themeMode: ThemeMode,
    onThemeChange: (ThemeMode) -> Unit,
    model: VaultViewModel = viewModel(),
) {
    var version by remember { mutableStateOf(0) }
    remember { model.observe { version += 1 } }

    val state = run {
        version
        model.uiState
    }

    val context = LocalContext.current
    var showOnboarding by remember { mutableStateOf(!OnboardingPrefs.seen(context)) }
    var route by remember(state.unlocked) { mutableStateOf<Route>(Route.List) }

    val finishOnboarding = {
        OnboardingPrefs.markSeen(context)
        showOnboarding = false
    }

    if (showOnboarding) {
        if (state.unlocked) BackHandler { finishOnboarding() }
        OnboardingScreen(onDone = finishOnboarding)
        return
    }

    var lockedOverride by remember { mutableStateOf<Locked?>(null) }
    LaunchedEffect(Unit) { model.checkRemembered(context) }
    LaunchedEffect(state.unlocked) { if (state.unlocked) lockedOverride = null }

    if (!state.unlocked) {
        val default = when {
            state.localExists -> Locked.LOCAL_UNLOCK
            state.remembered -> Locked.ACCOUNT_UNLOCK
            else -> Locked.START
        }
        val screen = lockedOverride?.takeIf { !(it == Locked.LOCAL_UNLOCK && !state.localExists) } ?: default
        val help = { showOnboarding = true }

        when (screen) {
            Locked.START -> StartScreen(
                onStartLocal = { lockedOverride = Locked.CREATE_LOCAL },
                onSignIn = { lockedOverride = Locked.ACCOUNT_UNLOCK },
                onHelp = help,
            )
            Locked.CREATE_LOCAL -> CreateLocalScreen(state, model, onBack = { lockedOverride = Locked.START })
            Locked.LOCAL_UNLOCK -> LocalUnlockScreen(
                state,
                model,
                onSignIn = { lockedOverride = Locked.ACCOUNT_UNLOCK },
                onHelp = help,
            )
            Locked.ACCOUNT_UNLOCK -> UnlockScreen(
                state,
                model,
                onHelp = help,
                onBack = { lockedOverride = if (state.localExists) Locked.LOCAL_UNLOCK else Locked.START },
            )
        }
        return
    }

    val toList = { route = Route.List }
    val signInToSync = {
        lockedOverride = Locked.ACCOUNT_UNLOCK
        model.lock()
    }

    when (val current = route) {
        Route.List -> VaultListScreen(
            state,
            model,
            onOpen = { route = Route.Detail(it) },
            onAdd = { route = Route.Edit(null) },
            onSettings = { route = Route.Settings },
            onSignInToSync = signInToSync,
        )
        is Route.Detail -> {
            BackHandler(onBack = toList)
            ItemDetailScreen(state, model, current.itemId, onBack = toList, onEdit = { route = Route.Edit(current.itemId) })
        }
        is Route.Edit -> ItemEditScreen(state, model, current.itemId, onDone = {
            route = current.itemId?.let { Route.Detail(it) } ?: Route.List
        })
        Route.Settings -> SettingsScreen(
            state,
            model,
            onBack = toList,
            onChangePassword = { route = Route.ChangePassword },
            onLocalChangePassword = { route = Route.LocalChangePassword },
            onSignInToSync = signInToSync,
            onShowIntro = { showOnboarding = true },
            themeMode = themeMode,
            onThemeChange = onThemeChange,
        )
        Route.ChangePassword -> ChangePasswordScreen(state, model, onDone = { route = Route.Settings })
        Route.LocalChangePassword -> LocalChangePasswordScreen(state, model, onDone = { route = Route.Settings })
    }

    if (state.mode == VaultViewModel.Mode.ACCOUNT) MigrationDialogs(state, model)
}
