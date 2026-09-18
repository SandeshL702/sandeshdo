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
        PowerManager.WakeLock screen = AlertChime.acquireScreen(context, 8_000);
        try {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "sandeshdo:rx");
                wl.setReferenceCounted(false);
                wl.acquire(8_000);
            }
        } catch (Exception ignored) {
        }

        AlarmService.ensureChannel(context);
        String taskId = intent.getStringExtra("taskId");
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        boolean overdue = intent.getBooleanExtra("overdue", false);
        int repeatMin = intent.getIntExtra("repeatMin", 0);

        // Heads-up + lock-screen popup. AlarmClock fire is allowed to start an activity.
        AlarmService.postHeadsUp(context, taskId, title, body, overdue);
        AlarmService.launchPopup(context, taskId, title, body, overdue);
        AlertChime.play(context);
        vibrate(context);

        Intent svc = new Intent(context, AlarmService.class);
        svc.putExtra("taskId", taskId);
        svc.putExtra("title", title);
        svc.putExtra("body", body);
        svc.putExtra("overdue", overdue);
        svc.putExtra("repeatMin", repeatMin);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(svc);
            } else {
                context.startService(svc);
            }
        } catch (Exception ignored) {
            AlarmScheduler.onFired(context, taskId, title, "Still pending", repeatMin);
        }

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
                        2500);
    }

    static void vibrate(Context context) {
        try {
            long[] pattern = new long[] {0, 40, 70, 40};
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
