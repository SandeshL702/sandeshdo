package com.sandesh.sandeshdo;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/**
 * Clock-app fire path: wake the screen, post a CATEGORY_ALARM notification with
 * a real (soft) sound + full-screen intent, start AlertActivity.
 * Silent channels are skipped by Xiaomi / Vivo / Oppo / Samsung FSI.
 */
public class AlarmService extends Service {
    public static final String CHANNEL = "sandeshdo-lock-v7";
    public static final String PIN_CHANNEL = "sandeshdo-today-pin";
    private PowerManager.WakeLock wakeLock;
    private PowerManager.WakeLock screenLock;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        String taskId = intent.getStringExtra("taskId");
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        boolean overdue = intent.getBooleanExtra("overdue", false);
        int repeatMin = intent.getIntExtra("repeatMin", AlarmScheduler.DEFAULT_REPEAT_MIN);
        if (title == null || title.isEmpty()) title = "SandeshDo";
        if (body == null) body = overdue ? "Still pending" : "Due now";

        acquireWake();
        screenLock = AlertChime.acquireScreen(this, 20_000);
        ensureChannel(this);
        int noteId = noteId(taskId);
        Notification notification = buildAlert(this, taskId, title, body, overdue, noteId);
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(noteId, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else {
                startForeground(noteId, notification);
            }
        } catch (Exception e) {
            try {
                NotificationManagerCompat.from(this).notify(noteId, notification);
            } catch (Exception ignored) {
            }
        }
        try {
            NotificationManagerCompat.from(this).notify(noteId, notification);
        } catch (Exception ignored) {
        }

        AlertReceiver.vibrate(this);
        AlertChime.play(this);

        Intent full = new Intent(this, AlertActivity.class);
        full.putExtra("taskId", taskId);
        full.putExtra("title", title);
        full.putExtra("body", body);
        full.putExtra("overdue", overdue);
        full.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP
                        | Intent.FLAG_ACTIVITY_NO_USER_ACTION
                        | Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS);
        try {
            startActivity(full);
        } catch (Exception ignored) {
        }

        AlarmScheduler.onFired(this, taskId, title, "Still pending", repeatMin);

        new Handler(Looper.getMainLooper())
                .postDelayed(
                        () -> {
                            releaseWake();
                            stopSelf();
                        },
                        25_000);
        return START_NOT_STICKY;
    }

    static Notification buildAlert(
            Context ctx, String taskId, String title, String body, boolean overdue, int noteId) {
        Intent full = new Intent(ctx, AlertActivity.class);
        full.putExtra("taskId", taskId);
        full.putExtra("title", title);
        full.putExtra("body", body);
        full.putExtra("overdue", overdue);
        full.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int code = AlarmScheduler.requestCode("full-" + (taskId == null ? "x" : taskId));
        PendingIntent fullPi =
                PendingIntent.getActivity(
                        ctx, code, full, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent done = new Intent(ctx, ActionReceiver.class);
        done.setAction("com.sandesh.sandeshdo.DONE");
        done.putExtra("taskId", taskId);
        PendingIntent donePi =
                PendingIntent.getBroadcast(
                        ctx,
                        AlarmScheduler.requestCode("done-" + taskId),
                        done,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent snooze = new Intent(ctx, ActionReceiver.class);
        snooze.setAction("com.sandesh.sandeshdo.SNOOZE");
        snooze.putExtra("taskId", taskId);
        snooze.putExtra("title", title);
        snooze.putExtra("body", body);
        PendingIntent snoozePi =
                PendingIntent.getBroadcast(
                        ctx,
                        AlarmScheduler.requestCode("snz-" + taskId),
                        snooze,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Uri sound = Uri.parse("android.resource://" + ctx.getPackageName() + "/" + R.raw.gentle_chime);

        return new NotificationCompat.Builder(ctx, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle(overdue ? "Still pending" : "Due now")
                .setContentText(title)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(title + "\n" + body))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(false)
                .setOngoing(true)
                .setOnlyAlertOnce(false)
                .setSound(sound)
                .setContentIntent(fullPi)
                .setFullScreenIntent(fullPi, true)
                .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
                .setVibrate(new long[] {0, 48, 70, 48, 90})
                .addAction(0, "Done", donePi)
                .addAction(0, "10 min", snoozePi)
                .build();
    }

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return;
        try {
            nm.deleteNotificationChannel("sandeshdo-lock-v6");
            nm.deleteNotificationChannel("sandeshdo-lock-v5");
            nm.deleteNotificationChannel("sandeshdo-lock-v4");
            nm.deleteNotificationChannel("sandeshdo-lock-v3");
        } catch (Exception ignored) {
        }
        Uri sound = Uri.parse("android.resource://" + context.getPackageName() + "/" + R.raw.gentle_chime);
        AudioAttributes alarm =
                new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build();
        NotificationChannel ch =
                new NotificationChannel(CHANNEL, "Task lock-screen alerts", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Full-screen popup when a task is due. Soft chime + light vibrate.");
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[] {0, 48, 70, 48, 90});
        ch.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        ch.setSound(sound, alarm);
        ch.enableLights(true);
        ch.setShowBadge(true);
        try {
            ch.setBypassDnd(true);
        } catch (Exception ignored) {
        }
        nm.createNotificationChannel(ch);

        NotificationChannel pin =
                new NotificationChannel(PIN_CHANNEL, "Today", NotificationManager.IMPORTANCE_LOW);
        pin.setDescription("Pinned list of remaining work");
        pin.setSound(null, null);
        pin.enableVibration(false);
        pin.setShowBadge(false);
        nm.createNotificationChannel(pin);
    }

    static int noteId(String taskId) {
        if (taskId == null || taskId.isEmpty()) return 8801;
        return 8800 + (Math.abs(taskId.hashCode()) % 800);
    }

    static void cancelNote(Context context, String taskId) {
        NotificationManagerCompat.from(context).cancel(noteId(taskId));
        NotificationManagerCompat.from(context).cancel(8801);
    }

    static void pinToday(Context ctx, int count, String lines) {
        ensureChannel(ctx);
        if (count <= 0) {
            NotificationManagerCompat.from(ctx).cancel(7701);
            return;
        }
        Intent open = new Intent(ctx, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi =
                PendingIntent.getActivity(
                        ctx, 77, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n =
                new NotificationCompat.Builder(ctx, PIN_CHANNEL)
                        .setSmallIcon(android.R.drawable.ic_menu_agenda)
                        .setContentTitle(count == 1 ? "1 left today" : count + " left today")
                        .setContentText(lines)
                        .setStyle(new NotificationCompat.BigTextStyle().bigText(lines))
                        .setOngoing(true)
                        .setSilent(true)
                        .setContentIntent(pi)
                        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                        .setPriority(NotificationCompat.PRIORITY_LOW)
                        .build();
        try {
            NotificationManagerCompat.from(ctx).notify(7701, n);
        } catch (SecurityException ignored) {
        }
    }

    private void acquireWake() {
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm == null) return;
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "sandeshdo:alert");
            wakeLock.setReferenceCounted(false);
            wakeLock.acquire(25_000);
        } catch (Exception ignored) {
        }
    }

    private void releaseWake() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        } catch (Exception ignored) {
        }
        wakeLock = null;
        try {
            if (screenLock != null && screenLock.isHeld()) screenLock.release();
        } catch (Exception ignored) {
        }
        screenLock = null;
    }

    @Override
    public void onDestroy() {
        releaseWake();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
