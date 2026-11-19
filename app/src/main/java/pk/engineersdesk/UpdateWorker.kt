package pk.engineersdesk

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.*
import java.util.concurrent.TimeUnit

class UpdateWorker(ctx: Context, p: WorkerParameters) : Worker(ctx, p) {
    override fun doWork(): Result {
        return try {
            val r = Updates.fetchLatest()
            val prefs = applicationContext.getSharedPreferences("upd", Context.MODE_PRIVATE)
            if (Updates.isNewer(r.version, BuildConfig.VERSION_NAME) && prefs.getString("notified", "") != r.version) {
                notify(r); prefs.edit().putString("notified", r.version).apply()
            }
            Result.success()
        } catch (e: Exception) { Result.retry() }
    }

    private fun notify(r: Updates.Release) {
        val ctx = applicationContext
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26)
            nm.createNotificationChannel(NotificationChannel("updates", "App updates", NotificationManager.IMPORTANCE_DEFAULT))
        val pi = PendingIntent.getActivity(ctx, 0, Intent(ctx, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val n = NotificationCompat.Builder(ctx, "updates")
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentTitle("Engineer's Desk ${r.version} is available")
            .setContentText(r.notes.lineSequence().firstOrNull { it.isNotBlank() } ?: "Tap to update")
            .setStyle(NotificationCompat.BigTextStyle().bigText("What's new:\n" + r.notes))
            .setContentIntent(pi).setAutoCancel(true).build()
        try { NotificationManagerCompat.from(ctx).notify(1, n) } catch (e: SecurityException) { }
    }

    companion object {
        fun schedule(ctx: Context) {
            val req = PeriodicWorkRequestBuilder<UpdateWorker>(12, TimeUnit.HOURS)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(ctx).enqueueUniquePeriodicWork("updates", ExistingPeriodicWorkPolicy.KEEP, req)
        }
    }
}
