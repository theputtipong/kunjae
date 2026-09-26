package com.kunjae.app.ui

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ButtonColors
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

val KunjaeYellow = Color(0xFFFFC933)
val OnKunjaeYellow = Color(0xFF241A00)

private val Light = lightColorScheme(
    primary = Color(0xFF7A5900),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFFFDF8A),
    onPrimaryContainer = Color(0xFF261A00),
    secondary = Color(0xFF6B5D3F),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFFFEDB8),
    onSecondaryContainer = Color(0xFF251A04),
    tertiary = Color(0xFF4A6547),
    tertiaryContainer = Color(0xFFCCEBC4),
    onTertiaryContainer = Color(0xFF07200A),
    error = Color(0xFFBA1A1A),
    errorContainer = Color(0xFFFFDAD6),
    onErrorContainer = Color(0xFF410002),
    background = Color(0xFFFFF8F0),
    onBackground = Color(0xFF1F1B13),
    surface = Color(0xFFFFF8F0),
    onSurface = Color(0xFF1F1B13),
    surfaceVariant = Color(0xFFEDE1CF),
    onSurfaceVariant = Color(0xFF4D4639),
    surfaceContainerLowest = Color(0xFFFFFFFF),
    surfaceContainerLow = Color(0xFFFCF2E5),
    surfaceContainer = Color(0xFFF6EDDF),
    surfaceContainerHigh = Color(0xFFF0E7D9),
    surfaceContainerHighest = Color(0xFFEAE1D4),
    outline = Color(0xFF7F7667),
    outlineVariant = Color(0xFFD0C5B4),
)

private val Dark = darkColorScheme(
    primary = KunjaeYellow,
    onPrimary = Color(0xFF3F2E00),
    primaryContainer = Color(0xFF5C4200),
    onPrimaryContainer = Color(0xFFFFDF8A),
    secondary = Color(0xFFD8C4A0),
    onSecondary = Color(0xFF3A2F15),
    secondaryContainer = Color(0xFF52452A),
    onSecondaryContainer = Color(0xFFF5E0BB),
    tertiary = Color(0xFFB1CFA9),
    tertiaryContainer = Color(0xFF334D31),
    onTertiaryContainer = Color(0xFFCCEBC4),
    error = Color(0xFFFFB4AB),
    errorContainer = Color(0xFF93000A),
    onErrorContainer = Color(0xFFFFDAD6),
    background = Color(0xFF17130B),
    onBackground = Color(0xFFEBE1D4),
    surface = Color(0xFF17130B),
    onSurface = Color(0xFFEBE1D4),
    surfaceVariant = Color(0xFF4D4639),
    onSurfaceVariant = Color(0xFFD0C5B4),
    surfaceContainerLowest = Color(0xFF110E07),
    surfaceContainerLow = Color(0xFF1F1B13),
    surfaceContainer = Color(0xFF231F17),
    surfaceContainerHigh = Color(0xFF2E2921),
    surfaceContainerHighest = Color(0xFF39342B),
    outline = Color(0xFF999080),
    outlineVariant = Color(0xFF4D4639),
)

@Composable
fun kunjaeButtonColors(): ButtonColors = ButtonDefaults.buttonColors(
    containerColor = KunjaeYellow,
    contentColor = OnKunjaeYellow,
)

private val KunjaeShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(24.dp),
    extraLarge = RoundedCornerShape(32.dp),
)

@Composable
fun KunjaeTheme(darkTheme: Boolean, content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (darkTheme) Dark else Light,
        shapes = KunjaeShapes,
        content = content,
    )
}

private val AvatarPalette = listOf(
    Color(0xFF8A6500), Color(0xFF386A20), Color(0xFF006A6A), Color(0xFF8B5000),
    Color(0xFF984061), Color(0xFF00639B), Color(0xFF6C5E00), Color(0xFF5B5F97),
)

fun avatarColorFor(title: String): Color =
    AvatarPalette[Math.floorMod(title.lowercase().hashCode(), AvatarPalette.size)]
