package com.kunjae.crypto

fun constantTimeEquals(a: ByteArray, b: ByteArray): Boolean {
    if (a.size != b.size) return false

    var difference = 0
    for (i in a.indices) {
        difference = difference or (a[i].toInt() xor b[i].toInt())
    }
    return difference == 0
}

fun wipe(bytes: ByteArray) {
    bytes.fill(0)
}

fun concat(vararg parts: ByteArray): ByteArray {
    val total = parts.sumOf { it.size }
    val out = ByteArray(total)

    var offset = 0
    for (part in parts) {
        part.copyInto(out, offset)
        offset += part.size
    }
    return out
}
