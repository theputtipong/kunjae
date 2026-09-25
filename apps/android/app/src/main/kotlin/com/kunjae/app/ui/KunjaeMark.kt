package com.kunjae.app.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

object KunjaeColors {
    val Ink = Color(0xFF0E131B)
    val Brass = Color(0xFFC68B2C)
    val BrassDeep = Color(0xFF8E5F14)
    val BrassLight = Color(0xFFE3B35C)
}

private const val UNLOCKED_DEG = 32f

private fun DrawScope.fullMark(color: Color) {
    drawCircle(color, radius = 10.5f, center = Offset(32f, 22f), style = Stroke(width = 9f))
    drawRoundRect(color, Offset(26.5f, 30f), Size(11f, 26f), CornerRadius(2f))
    drawRoundRect(color, Offset(37.5f, 40f), Size(11.5f, 6f), CornerRadius(1.5f))
    drawRoundRect(color, Offset(37.5f, 49f), Size(7.5f, 7f), CornerRadius(1.5f))
}

private fun DrawScope.smallMark(color: Color) {
    drawCircle(color, radius = 14f, center = Offset(32f, 22f))
    drawRoundRect(color, Offset(25f, 30f), Size(14f, 26f), CornerRadius(2f))
    drawRoundRect(color, Offset(39f, 39f), Size(12f, 8f), CornerRadius(1f))
    drawRoundRect(color, Offset(39f, 50f), Size(8f, 6f), CornerRadius(1f))
}

@Composable
fun KunjaeMark(
    size: Dp,
    modifier: Modifier = Modifier,
    unlocked: Boolean = false,
    tile: Boolean = true,
    color: Color = KunjaeColors.BrassDeep,
    description: String? = null,
) {
    val angle by animateFloatAsState(if (unlocked) UNLOCKED_DEG else 0f, tween(300), label = "kunjae-mark")

    val markDp = if (tile) size * 0.61f else size
    val small = markDp < 24.dp
    val markColor = if (tile) KunjaeColors.BrassLight else color

    Canvas(
        modifier
            .size(size)
            .let { m -> if (description != null) m.semantics { contentDescription = description } else m },
    ) {
        val side = this.size.minDimension
        if (tile) drawRoundRect(KunjaeColors.Ink, cornerRadius = CornerRadius(side * 0.224f))

        val markSide = if (tile) side * 0.61f else side
        val inset = (side - markSide) / 2f
        translate(inset, inset) {
            scale(markSide / 64f, pivot = Offset.Zero) {
                rotate(angle, pivot = Offset(32f, 32f)) {
                    if (small) smallMark(markColor) else fullMark(markColor)
                }
            }
        }
    }
}
