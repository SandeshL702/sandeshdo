package com.sandesh.sandeshdo;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

/**
 * TickTick / Clock scheduler.
 * Every reminder is an AlarmClock so Doze never delays it. Device-protected
 * storage so alarms restore on LOCKED_BOOT before the user unlocks.
 */
public final class AlarmScheduler {
    private static final String PREFS = "sandeshdo-alarms";
    private static final String KEY_JSON = "alarms-json";
    public static final int DEFAULT_REPEAT_MIN = 15;

    private AlarmScheduler() {}

    static Context store(Context ctx) {
        if (Build.VERSION.SDK_INT >= 24) {
            try {
                Context dp = ctx.createDeviceProtectedStorageContext();
                try {
                    dp.moveSharedPreferencesFrom(ctx, PREFS);
                } catch (Exception ignored) {
                }
                return dp;
            } catch (Exception ignored) {
                return ctx;
            }
        }
        return ctx;
    }

    public static void saveAndSchedule(Context ctx, String json) {
        store(ctx).getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_JSON, json).apply();
        scheduleSaved(ctx);
    }

    public static String savedJson(Context ctx) {
        return store(ctx).getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_JSON, "[]");
    }

    public static int savedCount(Context ctx) {
        try {
            return new JSONArray(savedJson(ctx)).length();
        } catch (Exception e) {
            return 0;
        }
    }

    public static long nextTrigger(Context ctx) {
        try {
            JSONArray arr = new JSONArray(savedJson(ctx));
            long min = 0;
            long now = System.currentTimeMillis();
            for (int i = 0; i < arr.length(); i++) {
                long t = arr.getJSONObject(i).optLong("triggerAt", 0);
                if (t >= now - 5_000 && (min == 0 || t < min)) min = t;
            }
            return min;
        } catch (Exception e) {
            return 0;
        }
    }

    public static void scheduleSaved(Context ctx) {
        String json = savedJson(ctx);
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        cancelAll(ctx, am);
        try {
            JSONArray arr = new JSONArray(json);
            List<JSONObject> rows = new ArrayList<>();
            long now = System.currentTimeMillis();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                long trigger = o.optLong("triggerAt", 0);
                // Overdue / slightly-past still fire — do not drop them.
                if (trigger < now - 6 * 60 * 60_000L) continue;
                rows.add(o);
            }
            Collections.sort(
                    rows,
                    new Comparator<JSONObject>() {
                        @Override
                        public int compare(JSONObject a, JSONObject b) {
                            long d = a.optLong("triggerAt") - b.optLong("triggerAt");
                            return d < 0 ? -1 : d > 0 ? 1 : 0;
                        }
                    });
            int n = Math.min(rows.size(), 48);
            for (int i = 0; i < n; i++) {
                JSONObject o = rows.get(i);
                long trigger = o.optLong("triggerAt", now);
                if (trigger < now) trigger = now + 800;
                PendingIntent pi = alertPi(ctx, o, i);
                setClock(am, ctx, trigger, pi);
            }
        } catch (Exception ignored) {
        }
    }

    public static void scheduleOne(
            Context ctx, String taskId, String title, String body, long triggerAt, boolean overdue) {
        try {
            JSONObject o = new JSONObject();
            o.put("id", "one-" + taskId + "-" + triggerAt);
            o.put("taskId", taskId);
            o.put("title", title);
            o.put("body", body);
            o.put("overdue", overdue);
            o.put("triggerAt", triggerAt);
            o.put("repeatMin", 0);
            JSONArray arr;
            try {
                arr = new JSONArray(savedJson(ctx));
            } catch (Exception e) {
                arr = new JSONArray();
            }
            arr.put(o);
            store(ctx).getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_JSON, arr.toString()).apply();
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            long when = Math.max(triggerAt, System.currentTimeMillis() + 700);
            setClock(am, ctx, when, alertPi(ctx, o, 0));
        } catch (Exception ignored) {
        }
    }

    public static void snooze(Context ctx, String taskId, String title, String body, int minutes) {
        long when = System.currentTimeMillis() + Math.max(1, minutes) * 60_000L;
        try {
            JSONObject o = new JSONObject();
            o.put("id", "snooze-" + taskId);
            o.put("taskId", taskId);
            o.put("title", title == null ? "SandeshDo" : title);
            o.put("body", body == null ? "Snoozed" : body);
            o.put("overdue", true);
            o.put("triggerAt", when);
            o.put("repeatMin", DEFAULT_REPEAT_MIN);
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            setClock(am, ctx, when, alertPi(ctx, o, 1));
            JSONArray arr;
            try {
                arr = new JSONArray(savedJson(ctx));
            } catch (Exception e) {
                arr = new JSONArray();
            }
            JSONArray next = new JSONArray();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject row = arr.getJSONObject(i);
                if (taskId != null && taskId.equals(row.optString("taskId"))) continue;
                next.put(row);
            }
            next.put(o);
            store(ctx).getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_JSON, next.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    public static void onFired(Context ctx, String taskId, String title, String body, int repeatMin) {
        SharedPreferences sp = store(ctx).getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            JSONArray arr = new JSONArray(sp.getString(KEY_JSON, "[]"));
            JSONArray next = new JSONArray();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                if (taskId != null && taskId.equals(o.optString("taskId"))) continue;
                next.put(o);
            }
            if (repeatMin > 0 && taskId != null && !taskId.isEmpty() && !"test".equals(taskId)) {
                JSONObject again = new JSONObject();
                again.put("id", "repeat-" + taskId);
                again.put("taskId", taskId);
                again.put("title", title == null ? "SandeshDo" : title);
                again.put("body", body == null ? "Still pending" : body);
                again.put("triggerAt", System.currentTimeMillis() + repeatMin * 60_000L);
                again.put("overdue", true);
                again.put("repeatMin", repeatMin);
                next.put(again);
            }
            sp.edit().putString(KEY_JSON, next.toString()).apply();
        } catch (Exception ignored) {
        }
        scheduleSaved(ctx);
    }

    public static void cancelTask(Context ctx, String taskId) {
        if (taskId == null || taskId.isEmpty()) return;
        SharedPreferences sp = store(ctx).getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            JSONArray arr = new JSONArray(sp.getString(KEY_JSON, "[]"));
            JSONArray next = new JSONArray();
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                if (taskId.equals(o.optString("taskId"))) {
                    if (am != null) am.cancel(alertPi(ctx, o, i));
                    continue;
                }
                next.put(o);
            }
            sp.edit().putString(KEY_JSON, next.toString()).apply();
            if (am != null) {
                JSONObject snooze = new JSONObject();
                snooze.put("id", "snooze-" + taskId);
                snooze.put("taskId", taskId);
                snooze.put("title", "SandeshDo");
                snooze.put("body", "Snoozed");
                am.cancel(alertPi(ctx, snooze, 1));
            }
        } catch (Exception ignored) {
        }
        scheduleSaved(ctx);
    }

    private static void setClock(AlarmManager am, Context ctx, long trigger, PendingIntent pi) {
        Intent show = new Intent(ctx, AlertActivity.class);
        show.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent showPi =
                PendingIntent.getActivity(
                        ctx, 41, show, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        try {
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(trigger, showPi), pi);
        } catch (Exception e) {
            setExact(am, trigger, pi);
        }
    }

    private static void setExact(AlarmManager am, long trigger, PendingIntent pi) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pi);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pi);
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, trigger, pi);
            }
        } catch (Exception ignored) {
        }
    }

    private static PendingIntent alertPi(Context ctx, JSONObject o, int fallback) {
        Intent intent = new Intent(ctx, AlertReceiver.class);
        intent.setAction("com.sandesh.sandeshdo.ALERT");
        intent.addFlags(Intent.FLAG_RECEIVER_FOREGROUND);
        intent.putExtra("taskId", o.optString("taskId", ""));
        intent.putExtra("title", o.optString("title", "SandeshDo"));
        intent.putExtra("body", o.optString("body", "Due now"));
        intent.putExtra("overdue", o.optBoolean("overdue", false));
        intent.putExtra("repeatMin", o.optInt("repeatMin", DEFAULT_REPEAT_MIN));
        int code = requestCode(o.optString("id", o.optString("taskId", String.valueOf(fallback))));
        return PendingIntent.getBroadcast(
                ctx, code, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void cancelAll(Context ctx, AlarmManager am) {
        String json = savedJson(ctx);
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                am.cancel(alertPi(ctx, o, i));
            }
        } catch (Exception ignored) {
        }
    }

    static int requestCode(String id) {
        int h = id == null ? 0 : id.hashCode();
        if (h == Integer.MIN_VALUE) h = 1;
        return 0x12000000 | (Math.abs(h) & 0x00ffffff);
    }
}
