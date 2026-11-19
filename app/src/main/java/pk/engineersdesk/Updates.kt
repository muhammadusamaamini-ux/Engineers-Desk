package pk.engineersdesk

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

object Updates {
    private const val API = "https://api.github.com/repos/muhammadusamaamini-ux/engineers-desk/releases/latest"
    data class Release(val version: String, val notes: String, val url: String)

    fun fetchLatest(): Release {
        val c = URL(API).openConnection() as HttpURLConnection
        c.setRequestProperty("Accept", "application/vnd.github+json")
        c.connectTimeout = 10000; c.readTimeout = 15000
        val body = c.inputStream.bufferedReader().use { it.readText() }
        val j = JSONObject(body)
        val tag = j.getString("tag_name").removePrefix("v")
        val assets = j.getJSONArray("assets")
        var url = j.getString("html_url")
        for (i in 0 until assets.length()) {
            val a = assets.getJSONObject(i)
            if (a.getString("name").endsWith(".apk")) { url = a.getString("browser_download_url"); break }
        }
        return Release(tag, j.optString("body", ""), url)
    }

    fun isNewer(latest: String, current: String): Boolean {
        val a = latest.split(".").map { it.toIntOrNull() ?: 0 }
        val b = current.split(".").map { it.toIntOrNull() ?: 0 }
        for (i in 0 until maxOf(a.size, b.size)) {
            val x = a.getOrElse(i) { 0 }; val y = b.getOrElse(i) { 0 }
            if (x != y) return x > y
        }
        return false
    }
}
