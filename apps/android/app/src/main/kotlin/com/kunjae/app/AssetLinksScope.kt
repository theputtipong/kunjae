package com.kunjae.app

import java.util.concurrent.Callable
import java.util.concurrent.ExecutorService
import java.util.concurrent.TimeUnit

object AssetLinksScope {

    private val secondLevel = setOf("co", "com", "ac", "or", "go", "net", "org", "gov", "edu", "in", "mi", "ne")

    fun relates(host: String, packageName: String): Boolean {
        val site = siteLabel(host.trim().lowercase().removeSuffix(".").split(".")) ?: return false
        val owner = ownerLabel(packageName.trim().lowercase().split(".")) ?: return false
        return site == owner
    }

    fun candidates(packageName: String, hosts: Collection<String>, extra: Set<String> = emptySet()): List<String> =
        hosts.distinct().filter { it in extra || relates(it, packageName) }

    fun verifyAll(
        hosts: List<String>,
        pool: ExecutorService,
        deadlineMs: Long,
        check: (String) -> Boolean,
    ): Set<String> {
        if (hosts.isEmpty()) return emptySet()

        val futures = runCatching {
            pool.invokeAll(hosts.map { host -> Callable { check(host) } }, deadlineMs, TimeUnit.MILLISECONDS)
        }.getOrElse { return emptySet() }

        return hosts.zip(futures)
            .filter { (_, future) -> !future.isCancelled && runCatching { future.get() }.getOrDefault(false) }
            .map { it.first }
            .toSet()
    }

    private fun siteLabel(labels: List<String>): String? {
        if (labels.size < 2 || labels.any { it.isEmpty() }) return null
        if (labels.all { label -> label.all { it.isDigit() } }) return null

        val last = labels.last()
        val index = if (labels.size >= 3 && last.length == 2 && labels[labels.size - 2] in secondLevel) {
            labels.size - 3
        } else {
            labels.size - 2
        }
        return labels[index]
    }

    private fun ownerLabel(segments: List<String>): String? {
        if (segments.size < 2 || segments.any { it.isEmpty() }) return null

        val index = if (segments.size >= 3 && segments[0].length == 2 && segments[1] in secondLevel) 2 else 1
        return segments[index]
    }
}
