package com.sandesh.sandeshdo;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;

public class AlertReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        final PendingResult pending = goAsync();
        PowerManager.WakeLock wl = null;
        PowerManager.WakeLock screen = AlertChime.acquireScreen(context, 15_000);
        try {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "sandeshdo:rx");
                wl.setReferenceCounted(false);
                wl.acquire(15_000);
            }
        } catch (Exception ignored) {
        }

        AlarmService.ensureChannel(context);

        Intent svc = new Intent(context, AlarmService.class);
        svc.putExtra("taskId", intent.getStringExtra("taskId"));
        svc.putExtra("title", intent.getStringExtra("title"));
        svc.putExtra("body", intent.getStringExtra("body"));
        svc.putExtra("overdue", intent.getBooleanExtra("overdue", false));
        svc.putExtra("repeatMin", intent.getIntExtra("repeatMin", AlarmScheduler.DEFAULT_REPEAT_MIN));
        boolean started = false;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(svc);
            } else {
                context.startService(svc);
            }
            started = true;
        } catch (Exception ignored) {
        }
        if (!started) {
            try {
                int id = AlarmService.noteId(intent.getStringExtra("taskId"));
                androidx.core.app.NotificationManagerCompat.from(context)
                        .notify(
                                id,
                                AlarmService.buildAlert(
                                        context,
                                        intent.getStringExtra("taskId"),
                                        intent.getStringExtra("title"),
                                        intent.getStringExtra("body"),
                                        intent.getBooleanExtra("overdue", false),
                                        id));
            } catch (Exception ignored) {
            }
            try {
                Intent full = new Intent(context, AlertActivity.class);
                full.putExtras(intent);
                full.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                context.startActivity(full);
            } catch (Exception ignored) {
            }
            AlertChime.play(context);
        }
        vibrate(context);
        final PowerManager.WakeLock held = wl;
        final PowerManager.WakeLock heldScreen = screen;
        new android.os.Handler(android.os.Looper.getMainLooper())
                .postDelayed(
                        () -> {
                            try {
                                if (held != null && held.isHeld()) held.release();
                            } catch (Exception ignored) {
                            }
                            try {
                                if (heldScreen != null && heldScreen.isHeld()) heldScreen.release();
                            } catch (Exception ignored) {
                            }
                            pending.finish();
                        },
                        4000);
    }

    static void vibrate(Context context) {
        try {
            long[] pattern = new long[] {0, 48, 80, 48};
            if (Build.VERSION.SDK_INT >= 31) {
                VibratorManager vm = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vm != null) {
                    vm.getDefaultVibrator().vibrate(VibrationEffect.createWaveform(pattern, -1));
                }
            } else {
                Vibrator v = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null) {
                    if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(pattern, -1));
                    else v.vibrate(pattern, -1);
                }
            }
        } catch (Exception ignored) {
        }
    }

    static void cancelNote(Context context) {
        AlarmService.cancelNote(context, null);
    }

    static void cancelNote(Context context, String taskId) {
        AlarmService.cancelNote(context, taskId);
    }
}
