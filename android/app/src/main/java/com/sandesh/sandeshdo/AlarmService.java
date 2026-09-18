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
 * Heads-up banner + lock-screen popup when a task is due.
 * AlarmManager still wakes us; full-screen intent + startActivity cover closed-app.
 */
public class AlarmService extends Service {
    public static final String CHANNEL = "sandeshdo-popup-v9";
    public static final String PIN_CHANNEL = "sandeshdo-today-pin";
    public static final String STATUS_CHANNEL = "sandeshdo-status-v9";
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
        int repeatMin = intent.getIntExtra("repeatMin", 0);
        if (title == null || title.isEmpty()) title = "SandeshDo";
        if (body == null) body = overdue ? "Still pending" : "Due now";

        acquireWake();
        screenLock = AlertChime.acquireScreen(this, 12_000);
        ensureChannel(this);
        int noteId = noteId(taskId);
        Notification notification = buildAlert(this, taskId, title, body, overdue);
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
        launchPopup(this, taskId, title, body, overdue);

        AlarmScheduler.onFired(this, taskId, title, "Still pending", repeatMin);

        new Handler(Looper.getMainLooper())
                .postDelayed(
                        () -> {
                            releaseWake();
                            stopSelf();
                        },
                        8_000);
        return START_NOT_STICKY;
    }

    static Notification buildAlert(Context ctx, String taskId, String title, String body, boolean overdue) {
        Intent open = new Intent(ctx, MainActivity.class);
        open.putExtra("taskId", taskId);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int code = AlarmScheduler.requestCode("open-" + (taskId == null ? "x" : taskId));
        PendingIntent openPi =
                PendingIntent.getActivity(
                        ctx, code, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

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

        Intent full = new Intent(ctx, AlertActivity.class);
        full.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        full.putExtra("taskId", taskId);
        full.putExtra("title", title);
        full.putExtra("body", body);
        full.putExtra("overdue", overdue);
        PendingIntent fullPi =
                PendingIntent.getActivity(
                        ctx,
                        AlarmScheduler.requestCode("fsi-" + (taskId == null ? "x" : taskId)),
                        full,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(ctx, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle(overdue ? "Still pending" : "Due now")
                .setContentText(title)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(title + "\n" + body))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setOngoing(false)
                .setOnlyAlertOnce(false)
                .setSound(sound)
                .setContentIntent(openPi)
                .setFullScreenIntent(fullPi, true)
                .setDefaults(0)
                .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
                .setVibrate(new long[] {0, 40, 60, 40})
                .addAction(0, "Done", donePi)
                .addAction(0, "10 min", snoozePi)
                .build();
    }

    static void launchPopup(Context ctx, String taskId, String title, String body, boolean overdue) {
        Intent alert = new Intent(ctx, AlertActivity.class);
        alert.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP
                        | Intent.FLAG_ACTIVITY_SINGLE_TOP
                        | Intent.FLAG_ACTIVITY_NO_USER_ACTION);
        alert.putExtra("taskId", taskId);
        alert.putExtra("title", title == null || title.isEmpty() ? "SandeshDo" : title);
        alert.putExtra("body", body == null ? (overdue ? "Still pending" : "Due now") : body);
        alert.putExtra("overdue", overdue);
        try {
            ctx.startActivity(alert);
        } catch (Exception ignored) {
        }
    }

    static void postHeadsUp(Context ctx, String taskId, String title, String body, boolean overdue) {
        ensureChannel(ctx);
        int id = noteId(taskId);
        try {
            NotificationManagerCompat.from(ctx).notify(id, buildAlert(ctx, taskId, title, body, overdue));
        } catch (SecurityException ignored) {
        }
    }

    static void seedHeadsUp(Context ctx) {
        ensureChannel(ctx);
        Intent open = new Intent(ctx, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi =
                PendingIntent.getActivity(
                        ctx, 91, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n =
                new NotificationCompat.Builder(ctx, STATUS_CHANNEL)
                        .setSmallIcon(android.R.drawable.ic_popup_reminder)
                        .setContentTitle("SandeshDo reminders are on")
                        .setContentText("You’ll get a popup when a task is due.")
                        .setAutoCancel(true)
                        .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                        .setContentIntent(pi)
                        .build();
        try {
            NotificationManagerCompat.from(ctx).notify(7702, n);
        } catch (SecurityException ignored) {
        }
    }

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return;
        try {
            nm.deleteNotificationChannel("sandeshdo-heads-v8");
            nm.deleteNotificationChannel("sandeshdo-status-v8");
            nm.deleteNotificationChannel("sandeshdo-lock-v7");
            nm.deleteNotificationChannel("sandeshdo-lock-v6");
            nm.deleteNotificationChannel("sandeshdo-lock-v5");
            nm.deleteNotificationChannel("sandeshdo-lock-v4");
            nm.deleteNotificationChannel("sandeshdo-lock-v3");
        } catch (Exception ignored) {
        }
        Uri sound = Uri.parse("android.resource://" + context.getPackageName() + "/" + R.raw.gentle_chime);
        AudioAttributes attrs =
                new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build();
        NotificationChannel ch =
                new NotificationChannel(CHANNEL, "Task popups", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Full-screen popup when a task is due, even if SandeshDo is closed.");
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[] {0, 40, 60, 40});
        ch.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        ch.setSound(sound, attrs);
        ch.enableLights(true);
        ch.setShowBadge(true);
        ch.setBypassDnd(false);
        nm.createNotificationChannel(ch);

        NotificationChannel pin =
                new NotificationChannel(PIN_CHANNEL, "Today", NotificationManager.IMPORTANCE_LOW);
        pin.setDescription("Pinned list of remaining work");
        pin.setSound(null, null);
        pin.enableVibration(false);
        pin.setShowBadge(false);
        nm.createNotificationChannel(pin);

        NotificationChannel status =
                new NotificationChannel(STATUS_CHANNEL, "Status", NotificationManager.IMPORTANCE_DEFAULT);
        status.setDescription("Confirms SandeshDo can send notifications");
        status.setShowBadge(false);
        nm.createNotificationChannel(status);
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
            wakeLock.acquire(12_000);
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
