package com.sandesh.sandeshdo;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.PowerManager;

/**
 * Quiet alarm-stream chime. OEMs skip full-screen intents on silent channels,
 * so the lock-screen path must play a real (soft) sound on STREAM_ALARM.
 */
public final class AlertChime {
    private AlertChime() {}

    public static void play(Context ctx) {
        try {
            MediaPlayer mp = MediaPlayer.create(ctx, R.raw.gentle_chime);
            if (mp == null) return;
            mp.setAudioAttributes(
                    new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build());
            mp.setVolume(0.32f, 0.32f);
            mp.setOnCompletionListener(
                    player -> {
                        try {
                            player.release();
                        } catch (Exception ignored) {
                        }
                    });
            mp.start();
        } catch (Exception ignored) {
        }
    }

    @SuppressWarnings("deprecation")
    public static PowerManager.WakeLock acquireScreen(Context ctx, long ms) {
        try {
            PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            if (pm == null) return null;
            int flags = PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP;
            PowerManager.WakeLock wl = pm.newWakeLock(flags, "sandeshdo:screen");
            wl.setReferenceCounted(false);
            wl.acquire(ms);
            return wl;
        } catch (Exception ignored) {
            return null;
        }
    }
}
