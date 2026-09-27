package com.kunjae.app

import com.kunjae.app.ui.KunjaeMark
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.Alignment
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.AlertDialog
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Arrangement
import androidx.activity.viewModels
import android.content.Context
import com.kunjae.app.ui.kunjaeButtonColors
import androidx.compose.material3.Button
import android.net.Uri
import android.content.Intent
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
import androidx.compose.runtime.SideEffect
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
    private var integrityCode by mutableStateOf("")

    override fun attachBaseContext(newBase: Context) {
        super.attachBaseContext(AppLocale.wrap(newBase))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.decorView.filterTouchesWhenObscured = true

        themeMode = ThemePrefs.load(this)
        applySystemBars(themeMode)

        integrityCode = IntegrityGuard.code(IntegrityGuard.findings(this))
        FirebaseSupport.start(this, integrityCode)

        setContent {
            KunjaeTheme(darkTheme = themeMode.isDark()) {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    KunjaeApp(
                        themeMode = themeMode,
                        onThemeChange = ::changeTheme,
                        integrityCode = integrityCode,
                        onSecureChange = ::applySecure,
                    )
                }
            }
        }
    }

    private fun applySecure(secure: Boolean) {
        if (secure) window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        else window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
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
        integrityCode = IntegrityGuard.code(IntegrityGuard.findings(this))
        if (integrityCode.isNotEmpty()) {
            val model: VaultViewModel by viewModels()
            if (model.uiState.unlocked && model.uiState.mode == VaultViewModel.Mode.ACCOUNT) model.lock()
        }
    }
}

private fun openStore(context: Context, url: String) {
    val market = Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=${context.packageName}"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    val web = Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    val playUrl = url.startsWith("https://play.google.com/")
    runCatching { context.startActivity(if (playUrl) market else web) }
        .onFailure { runCatching { context.startActivity(web) } }
}

@Composable
private fun ForceUpdateScreen(url: String) {
    val context = LocalContext.current
    BackHandler { }
    Column(
        modifier = Modifier.fillMaxSize().safeDrawingPadding().padding(32.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        KunjaeMark(80.dp)
        Text(
            stringResource(R.string.update_required_title),
            style = MaterialTheme.typography.titleLarge,
            textAlign = TextAlign.Center,
        )
        Text(
            stringResource(R.string.update_required_body),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Button(onClick = { openStore(context, url) }, colors = kunjaeButtonColors()) {
            Text(stringResource(R.string.update_action))
        }
    }
}

@Composable
private fun UpdateAvailableDialog(url: String, onDismiss: () -> Unit) {
    val context = LocalContext.current
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.update_available_title)) },
        text = { Text(stringResource(R.string.update_available_body)) },
        confirmButton = {
            TextButton(onClick = {
                openStore(context, url)
                onDismiss()
            }) { Text(stringResource(R.string.update_action)) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.update_later)) } },
    )
}

@Composable
private fun IntegrityDialog(code: String, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { KunjaeMark(40.dp) },
        title = { Text(stringResource(R.string.integrity_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(stringResource(R.string.integrity_body))
                Text(stringResource(R.string.integrity_disabled))
                Text(stringResource(R.string.integrity_fix))
                Text(
                    stringResource(R.string.integrity_code, code),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.integrity_continue)) } },
    )
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
    integrityCode: String,
    onSecureChange: (Boolean) -> Unit,
    model: VaultViewModel = viewModel(),
) {
    val updateContext = LocalContext.current
    var policy by remember { mutableStateOf(FirebaseSupport.cachedPolicy(updateContext)) }
    var updateDismissed by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { FirebaseSupport.refreshPolicy(updateContext) { policy = it } }
    policy?.let { current ->
        if (current.forced) {
            ForceUpdateScreen(current.updateUrl)
            return
        }
        if (current.available && !updateDismissed) {
            UpdateAvailableDialog(current.updateUrl, onDismiss = { updateDismissed = true })
        }
    }

    val restricted = integrityCode.isNotEmpty()
    var showIntegrity by remember(restricted) { mutableStateOf(restricted) }
    if (showIntegrity) IntegrityDialog(integrityCode, onDismiss = { showIntegrity = false })

    var version by remember { mutableStateOf(0) }
    remember { model.observe { version += 1 } }

    val state = run {
        version
        model.uiState
    }

    val context = LocalContext.current
    var captureAllowed by remember { mutableStateOf(CapturePrefs.load(context)) }
    val secure = state.unlocked && !captureAllowed
    SideEffect { onSecureChange(secure) }
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
            state.remembered && !restricted -> Locked.ACCOUNT_UNLOCK
            else -> Locked.START
        }
        val screen = lockedOverride
            ?.takeIf { !(it == Locked.LOCAL_UNLOCK && !state.localExists) }
            ?.takeIf { !(it == Locked.ACCOUNT_UNLOCK && restricted) }
            ?: default
        val help = { showOnboarding = true }

        when (screen) {
            Locked.START -> StartScreen(
                onStartLocal = { lockedOverride = Locked.CREATE_LOCAL },
                onSignIn = { if (restricted) showIntegrity = true else lockedOverride = Locked.ACCOUNT_UNLOCK },
                onHelp = help,
                accountAllowed = !restricted,
            )
            Locked.CREATE_LOCAL -> CreateLocalScreen(state, model, onBack = { lockedOverride = Locked.START })
            Locked.LOCAL_UNLOCK -> LocalUnlockScreen(
                state,
                model,
                onSignIn = { if (restricted) showIntegrity = true else lockedOverride = Locked.ACCOUNT_UNLOCK },
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
        if (restricted) {
            showIntegrity = true
        } else {
            lockedOverride = Locked.ACCOUNT_UNLOCK
            model.lock()
        }
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
            captureAllowed = captureAllowed,
            onCaptureChange = { allowed ->
                CapturePrefs.save(context, allowed)
                captureAllowed = allowed
            },
        )
        Route.ChangePassword -> ChangePasswordScreen(state, model, onDone = { route = Route.Settings })
        Route.LocalChangePassword -> LocalChangePasswordScreen(state, model, onDone = { route = Route.Settings })
    }

    if (state.mode == VaultViewModel.Mode.ACCOUNT) MigrationDialogs(state, model)
}
