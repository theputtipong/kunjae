package com.kunjae.app

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import com.kunjae.app.ui.KunjaeTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)

        enableEdgeToEdge()

        setContent {
            KunjaeTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    KunjaeApp()
                }
            }
        }
    }
}

private sealed interface Route {
    data object List : Route
    data class Detail(val itemId: String) : Route
    data class Edit(val itemId: String?) : Route
    data object Settings : Route
    data object ChangePassword : Route
}

@Composable
private fun KunjaeApp(model: VaultViewModel = viewModel()) {
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

    if (!state.unlocked) {
        UnlockScreen(state, model, onHelp = { showOnboarding = true })
        return
    }

    val toList = { route = Route.List }

    when (val current = route) {
        Route.List -> VaultListScreen(
            state,
            model,
            onOpen = { route = Route.Detail(it) },
            onAdd = { route = Route.Edit(null) },
            onSettings = { route = Route.Settings },
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
            onShowIntro = { showOnboarding = true },
        )
        Route.ChangePassword -> ChangePasswordScreen(state, model, onDone = { route = Route.Settings })
    }
}
