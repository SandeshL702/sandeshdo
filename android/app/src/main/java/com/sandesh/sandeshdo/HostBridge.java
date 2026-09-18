package com.sandesh.sandeshdo;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.content.pm.PackageManager;
import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.PowerManager;
import android.provider.MediaStore;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import java.lang.ref.WeakReference;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONArray;
import org.json.JSONObject;

public class HostBridge {
    private final Context ctx;
    private final WeakReference<Activity> activity;

    public HostBridge(Activity activity) {
        this.activity = new WeakReference<>(activity);
        this.ctx = activity.getApplicationContext();
    }

    @JavascriptInterface
    public void requestNotifyPermission() {
        Activity a = activity.get();
        if (a == null) return;
        a.runOnUiThread(
                () -> {
                    if (Build.VERSION.SDK_INT >= 33) {
                        if (ContextCompat.checkSelfPermission(a, Manifest.permission.POST_NOTIFICATIONS)
                                != PackageManager.PERMISSION_GRANTED) {
                            ActivityCompat.requestPermissions(
                                    a, new String[] {Manifest.permission.POST_NOTIFICATIONS}, 7);
                            return;
                        }
                    }
                    NotificationManager nm = a.getSystemService(NotificationManager.class);
                    if (nm != null && !nm.areNotificationsEnabled()) {
                        try {
                            Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                            i.putExtra(Settings.EXTRA_APP_PACKAGE, a.getPackageName());
                            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            a.startActivity(i);
                        } catch (Exception e) {
                            openAppSettings();
                        }
                    }
                });
    }

    @JavascriptInterface
    public void syncAlarms(String json) {
        if (json == null) json = "[]";
        AlarmScheduler.saveAndSchedule(ctx, json);
    }

    @JavascriptInterface
    public void cancelTask(String taskId) {
        if (taskId == null || taskId.isEmpty()) return;
        AlarmScheduler.cancelTask(ctx, taskId);
        AlarmService.cancelNote(ctx, taskId);
    }

    @JavascriptInterface
    public String takeActions() {
        return ActionReceiver.drain(ctx);
    }

    @JavascriptInterface
    public void fireTest(String title) {
        scheduleTest(title, 10);
    }

    @JavascriptInterface
    public void scheduleTest(String title, int seconds) {
        String t = title == null || title.isEmpty() ? "Pay electricity bill" : title;
        int wait = Math.max(3, Math.min(seconds, 60));
        AlarmScheduler.scheduleOne(
                ctx,
                "test",
                t,
                "Lock-screen test · " + wait + "s",
                System.currentTimeMillis() + wait * 1000L,
                true);
    }

    @JavascriptInterface
    public void fireNow(String title) {
        String t = title == null || title.isEmpty() ? "Pay electricity bill" : title;
        AlarmService.launchPopup(ctx, "test", t, "Test popup · app can be closed", true);
        AlarmService.postHeadsUp(ctx, "test", t, "Test popup · app can be closed", true);
        AlertChime.play(ctx);
        AlertReceiver.vibrate(ctx);
        Intent i = new Intent(ctx, AlarmService.class);
        i.putExtra("title", t);
        i.putExtra("body", "Test popup · app can be closed");
        i.putExtra("overdue", true);
        i.putExtra("taskId", "test");
        i.putExtra("repeatMin", 0);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(i);
            } else {
                ctx.startService(i);
            }
        } catch (Exception ignored) {
        }
    }

    @JavascriptInterface
    public boolean canExactAlarms() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        return am != null && am.canScheduleExactAlarms();
    }

    @JavascriptInterface
    public void openExactAlarmSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Intent i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
            i.setData(Uri.parse("package:" + ctx.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                ctx.startActivity(i);
            } catch (Exception e) {
                Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                fallback.setData(Uri.parse("package:" + ctx.getPackageName()));
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(fallback);
            }
        }
    }

    @JavascriptInterface
    public boolean canFullScreenIntent() {
        if (Build.VERSION.SDK_INT < 34) return true;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        return nm != null && nm.canUseFullScreenIntent();
    }

    @JavascriptInterface
    public void openFullScreenSettings() {
        if (Build.VERSION.SDK_INT >= 34) {
            try {
                Intent i = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
                i.setData(Uri.parse("package:" + ctx.getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(i);
                return;
            } catch (Exception ignored) {
            }
        }
        openAppSettings();
    }

    @JavascriptInterface
    public boolean isIgnoringBattery() {
        if (Build.VERSION.SDK_INT < 23) return true;
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        return pm != null && pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
    }

    @JavascriptInterface
    public void openBatterySettings() {
        try {
            Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            i.setData(Uri.parse("package:" + ctx.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
        } catch (Exception e) {
            openAppSettings();
        }
    }

    @JavascriptInterface
    public void openAppSettings() {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        i.setData(Uri.parse("package:" + ctx.getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(i);
    }

    @JavascriptInterface
    public void openNotificationSettings() {
        try {
            Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            i.putExtra(Settings.EXTRA_APP_PACKAGE, ctx.getPackageName());
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
        } catch (Exception e) {
            openAppSettings();
        }
    }

    @JavascriptInterface
    public void seedNotification() {
        AlarmService.seedHeadsUp(ctx);
    }

    @JavascriptInterface
    public void hideSplash() {
        Activity a = activity.get();
        if (a instanceof MainActivity) {
            a.runOnUiThread(((MainActivity) a)::hideSplash);
        }
    }

    @JavascriptInterface
    public String askGemini(String key, String prompt) {
        String k = sanitizeGeminiKey(key);
        if (k.isEmpty() || prompt == null || prompt.trim().isEmpty()) {
            return "ERR:missing";
        }
        String last = "ERR:no model";
        String[] models = geminiModelOrder();
        int max = Math.min(2, models.length);
        for (int i = 0; i < max; i++) {
            GeminiHit hit = generateGemini(k, models[i], prompt);
            if (hit.text != null && hit.text.length() > 0) {
                cachedGeminiModel = models[i];
                return hit.text;
            }
            if (hit.error != null) last = hit.error;
            if (hit.fatal) return last;
        }
        return last;
    }

    @JavascriptInterface
    public String askHttp(String url, String authorization, String body) {
        if (url == null || url.trim().isEmpty() || body == null) return "ERR:missing";
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Accept", "application/json");
            if (authorization != null && !authorization.trim().isEmpty()) {
                conn.setRequestProperty("Authorization", authorization.trim());
            }
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(12000);
            conn.setDoOutput(true);
            OutputStream os = conn.getOutputStream();
            os.write(body.getBytes(StandardCharsets.UTF_8));
            os.close();
            int code = conn.getResponseCode();
            InputStream in = code >= 200 && code < 300 ? conn.getInputStream() : conn.getErrorStream();
            String raw = in != null ? readStream(in) : "";
            if (code >= 200 && code < 300) return raw == null ? "" : raw;
            return "ERR:" + code + ":" + (raw == null ? "" : raw);
        } catch (Exception e) {
            return "ERR:" + (e.getMessage() == null ? "net" : e.getMessage());
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static volatile String cachedGeminiModel = null;
    private static final String[] GEMINI_MODELS =
            new String[] {
                "gemini-3.8-flash",
                "gemini-3.7-flash",
                "gemini-3.6-flash",
                "gemini-3.5-flash-lite",
                "gemini-3.5-flash",
                "gemini-2.5-flash-lite",
                "gemini-2.5-flash"
            };

    private static class GeminiHit {
        String text;
        String error;
        boolean fatal;
    }

    private static String sanitizeGeminiKey(String key) {
        if (key == null) return "";
        String s = key.trim().replaceAll("(?i)^(Bearer|x-goog-api-key)\\s*[:\\s=]+", "");
        return s.replaceAll("\\s+", "").trim();
    }

    private static String[] geminiModelOrder() {
        if (cachedGeminiModel == null || cachedGeminiModel.isEmpty()) return GEMINI_MODELS;
        String[] out = new String[GEMINI_MODELS.length];
        out[0] = cachedGeminiModel;
        int n = 1;
        for (String m : GEMINI_MODELS) {
            if (!m.equals(cachedGeminiModel)) out[n++] = m;
        }
        return out;
    }

    private GeminiHit generateGemini(String key, String model, String prompt) {
        JSONObject body = new JSONObject();
        try {
            JSONArray contents = new JSONArray();
            JSONObject user = new JSONObject();
            JSONArray parts = new JSONArray();
            JSONObject part = new JSONObject();
            part.put("text", prompt);
            parts.put(part);
            user.put("parts", parts);
            contents.put(user);
            body.put("contents", contents);
            JSONObject gen = new JSONObject();
            gen.put("temperature", 0.2);
            gen.put("maxOutputTokens", 2048);
            JSONObject think = new JSONObject();
            think.put("thinkingBudget", 0);
            gen.put("thinkingConfig", think);
            body.put("generationConfig", gen);
        } catch (Exception ignored) {
        }
        GeminiHit hit =
                geminiPost(
                        "https://generativelanguage.googleapis.com/v1beta/models/"
                                + model
                                + ":generateContent",
                        key,
                        body);
        if (hit.text == null && hit.error != null && !hit.fatal) {
            try {
                body.remove("generationConfig");
                JSONObject gen = new JSONObject();
                gen.put("temperature", 0.2);
                gen.put("maxOutputTokens", 2048);
                body.put("generationConfig", gen);
            } catch (Exception ignored) {
            }
            hit =
                    geminiPost(
                            "https://generativelanguage.googleapis.com/v1beta/models/"
                                    + model
                                    + ":generateContent",
                            key,
                            body);
        }
        return hit;
    }

    private GeminiHit interactGemini(String key, String model, String prompt) {
        JSONObject body = new JSONObject();
        try {
            body.put("model", model);
            body.put("input", prompt);
            JSONObject gen = new JSONObject();
            gen.put("thinking_level", "low");
            gen.put("max_output_tokens", 2048);
            body.put("generation_config", gen);
        } catch (Exception ignored) {
        }
        return geminiPost("https://generativelanguage.googleapis.com/v1beta/interactions", key, body);
    }

    private GeminiHit geminiPost(String url, String key, JSONObject body) {
        GeminiHit hit = new GeminiHit();
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("x-goog-api-key", key);
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(12000);
            conn.setDoOutput(true);
            OutputStream os = conn.getOutputStream();
            os.write(body.toString().getBytes(StandardCharsets.UTF_8));
            os.close();
            int code = conn.getResponseCode();
            InputStream in = code >= 200 && code < 300 ? conn.getInputStream() : conn.getErrorStream();
            String raw = in != null ? readStream(in) : "";
            if (code >= 200 && code < 300) {
                Object parsed = raw.trim().startsWith("[") ? new JSONArray(raw) : new JSONObject(raw);
                String text = extractGeminiText(parsed);
                if (text.length() > 0) {
                    hit.text = text;
                    return hit;
                }
                hit.error = "ERR:" + code + ":empty";
                return hit;
            }
            String message = geminiErrorMessage(code, raw);
            hit.error = "ERR:" + code + ":" + message;
            hit.fatal =
                    code == 403
                            || code == 429
                            || message.toLowerCase().contains("api key not valid")
                            || message.toLowerCase().contains("api_key_invalid");
        } catch (Exception e) {
            hit.error = "ERR:" + (e.getMessage() == null ? "net" : e.getMessage());
        } finally {
            if (conn != null) conn.disconnect();
        }
        return hit;
    }

    private static String geminiErrorMessage(int code, String raw) {
        try {
            Object parsed = raw.trim().startsWith("[") ? new JSONArray(raw) : new JSONObject(raw);
            JSONObject err = null;
            if (parsed instanceof JSONObject) err = ((JSONObject) parsed).optJSONObject("error");
            else if (parsed instanceof JSONArray && ((JSONArray) parsed).length() > 0) {
                JSONObject first = ((JSONArray) parsed).optJSONObject(0);
                if (first != null) err = first.optJSONObject("error");
            }
            if (err != null) {
                String m = err.optString("message", "");
                if (m.length() > 0) return m;
            }
        } catch (Exception ignored) {
        }
        return String.valueOf(code);
    }

    private static String extractGeminiText(Object node) {
        if (node == null || node == JSONObject.NULL) return "";
        if (node instanceof String) return (String) node;
        StringBuilder sb = new StringBuilder();
        if (node instanceof JSONArray) {
            JSONArray a = (JSONArray) node;
            for (int i = 0; i < a.length(); i++) {
                appendGemini(sb, extractGeminiText(a.opt(i)));
            }
            return sb.toString();
        }
        if (!(node instanceof JSONObject)) return "";
        JSONObject o = (JSONObject) node;
        if (o.has("output_text")) return o.optString("output_text", "");
        boolean thought = o.optBoolean("thought", false) || "thought".equals(o.optString("type"));
        if (!thought && o.has("text")) appendGemini(sb, o.optString("text", ""));
        if (o.has("parts")) appendGemini(sb, extractGeminiText(o.opt("parts")));
        if (o.has("candidates")) appendGemini(sb, extractGeminiText(o.opt("candidates")));
        if (o.has("content")) appendGemini(sb, extractGeminiText(o.opt("content")));
        if (o.has("outputs")) appendGemini(sb, extractGeminiText(o.opt("outputs")));
        if (o.has("steps")) appendGemini(sb, extractGeminiText(o.opt("steps")));
        if (o.has("response")) appendGemini(sb, extractGeminiText(o.opt("response")));
        return sb.toString();
    }

    private static void appendGemini(StringBuilder sb, String text) {
        if (text == null) return;
        String t = text.trim();
        if (t.isEmpty()) return;
        if (sb.length() > 0) sb.append('\n');
        sb.append(t);
    }

    @JavascriptInterface
    public void openOemAutostart() {
        String mfr = Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.toLowerCase();
        Intent[] tries = new Intent[] {
            new Intent().setComponent(
                    new ComponentName(
                            "com.miui.securitycenter",
                            "com.miui.permcenter.autostart.AutoStartManagementActivity")),
            new Intent("miui.intent.action.OP_AUTO_START").addCategory(Intent.CATEGORY_DEFAULT),
            new Intent()
                    .setComponent(
                            new ComponentName(
                                    "com.letv.android.letvsafe",
                                    "com.letv.android.letvsafe.AutobootManageActivity")),
            new Intent()
                    .setComponent(
                            new ComponentName(
                                    "com.huawei.systemmanager",
                                    "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity")),
            new Intent()
                    .setComponent(
                            new ComponentName(
                                    "com.huawei.systemmanager",
                                    "com.huawei.systemmanager.optimize.process.ProtectActivity")),
            new Intent()
                    .setComponent(
                            new ComponentName(
                                    "com.coloros.safecenter",
                                    "com.coloros.safecenter.permission.startup.StartupAppListActivity")),
            new Intent()
                    .setComponent(
                            new ComponentName(
                                    "com.oplus.safecenter",
                                    "com.oplus.safecenter.permission.startup.StartupAppListActivity")),
            new Intent()
                    .setComponent(
                            new ComponentName(
                                    "com.vivo.permissionmanager",
                                    "com.vivo.permissionmanager.activity.BgStartUpManagerActivity")),
            new Intent()
                    .setComponent(
                            new ComponentName(
                                    "com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager")),
            new Intent()
                    .setComponent(
                            new ComponentName(
                                    "com.samsung.android.lool",
                                    "com.samsung.android.sm.ui.battery.BatteryActivity")),
            new Intent()
                    .setComponent(
                            new ComponentName(
                                    "com.oneplus.security",
                                    "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity")),
        };
        for (Intent i : tries) {
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                if (i.resolveActivity(ctx.getPackageManager()) != null) {
                    ctx.startActivity(i);
                    return;
                }
            } catch (Exception ignored) {
            }
        }
        if (mfr.contains("xiaomi") || mfr.contains("redmi") || mfr.contains("poco")) {
            try {
                Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                i.setData(Uri.parse("package:" + ctx.getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(i);
                return;
            } catch (Exception ignored) {
            }
        }
        openAppSettings();
    }

    @JavascriptInterface
    public String alertHealth() {
        JSONObject o = new JSONObject();
        try {
            o.put("exactAlarms", canExactAlarms());
            o.put("fullScreen", canFullScreenIntent());
            o.put("battery", isIgnoringBattery());
            o.put("notifications", notificationsOn());
            o.put("native", true);
            o.put("alarmCount", AlarmScheduler.savedCount(ctx));
            o.put("nextAt", AlarmScheduler.nextTrigger(ctx));
            o.put("manufacturer", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER);
            o.put("needsOem", needsOem());
        } catch (Exception ignored) {
        }
        return o.toString();
    }

    private boolean notificationsOn() {
        if (Build.VERSION.SDK_INT >= 33) {
            if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                return false;
            }
        }
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        return nm == null || nm.areNotificationsEnabled();
    }

    private boolean needsOem() {
        String m = Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.toLowerCase();
        return m.contains("xiaomi")
                || m.contains("redmi")
                || m.contains("poco")
                || m.contains("oppo")
                || m.contains("vivo")
                || m.contains("realme")
                || m.contains("oneplus")
                || m.contains("huawei")
                || m.contains("honor")
                || m.contains("samsung")
                || m.contains("iqoo")
                || m.contains("tecno")
                || m.contains("infinix");
    }

    @JavascriptInterface
    public void pinToday(String json) {
        int count = 0;
        String lines = "";
        try {
            JSONObject o = new JSONObject(json == null ? "{}" : json);
            count = o.optInt("count", 0);
            JSONArray titles = o.optJSONArray("titles");
            StringBuilder sb = new StringBuilder();
            if (titles != null) {
                for (int i = 0; i < titles.length(); i++) {
                    if (i > 0) sb.append("\n");
                    sb.append(titles.optString(i));
                }
            }
            lines = sb.toString();
        } catch (Exception ignored) {
        }
        AlarmService.pinToday(ctx, count, lines);
    }

    private static final String BACKUP_NAME = "sandeshdo-backup.json";

    @JavascriptInterface
    public String saveBackup(String json) {
        if (json == null) json = "";
        boolean ok = false;
        try {
            File f = new File(ctx.getFilesDir(), BACKUP_NAME);
            writeBytes(f, json.getBytes(StandardCharsets.UTF_8));
            ok = true;
        } catch (Exception ignored) {
        }
        try {
            ctx.getSharedPreferences("sandeshdo", Context.MODE_PRIVATE)
                    .edit()
                    .putString("backup", json)
                    .apply();
            ok = true;
        } catch (Exception ignored) {
        }
        try {
            writeDownloads(json);
            ok = true;
        } catch (Exception ignored) {
        }
        return ok ? "ok" : "";
    }

    @JavascriptInterface
    public String loadLatestBackup() {
        try {
            File f = new File(ctx.getFilesDir(), BACKUP_NAME);
            if (f.exists() && f.length() > 8) return readFile(f);
        } catch (Exception ignored) {
        }
        try {
            String p = ctx.getSharedPreferences("sandeshdo", Context.MODE_PRIVATE).getString("backup", "");
            if (p != null && p.length() > 8) return p;
        } catch (Exception ignored) {
        }
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                Uri uri = findDownloadsUri();
                if (uri != null) {
                    InputStream in = ctx.getContentResolver().openInputStream(uri);
                    if (in != null) {
                        String s = readStream(in);
                        in.close();
                        if (s.length() > 8) return s;
                    }
                }
            } else {
                File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                File f = new File(dir, BACKUP_NAME);
                if (f.exists()) return readFile(f);
            }
        } catch (Exception ignored) {
        }
        return "";
    }

    @JavascriptInterface
    public void shareBackup(String json) {
        saveBackup(json);
        Activity a = activity.get();
        try {
            File dir = new File(ctx.getCacheDir(), "backup");
            if (!dir.exists()) dir.mkdirs();
            File f = new File(dir, BACKUP_NAME);
            writeBytes(f, (json == null ? "" : json).getBytes(StandardCharsets.UTF_8));
            Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".files", f);
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType("application/json");
            i.putExtra(Intent.EXTRA_SUBJECT, "SandeshDo backup");
            i.putExtra(Intent.EXTRA_STREAM, uri);
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(i, "SandeshDo backup");
            if (a != null) {
                a.startActivity(chooser);
            } else {
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(chooser);
            }
        } catch (Exception e) {
            try {
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("text/plain");
                i.putExtra(Intent.EXTRA_SUBJECT, "SandeshDo backup");
                i.putExtra(Intent.EXTRA_TEXT, json == null ? "" : json);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                Intent chooser = Intent.createChooser(i, "SandeshDo backup");
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(chooser);
            } catch (Exception ignored) {
            }
        }
    }

    @JavascriptInterface
    public void saveToDrive(String json) {
        saveBackup(json);
        Activity a = activity.get();
        if (a instanceof MainActivity) {
            ((MainActivity) a).startCreateBackup(json == null ? "" : json);
            return;
        }
        shareBackup(json);
    }

    @JavascriptInterface
    public void pickRestore() {
        Activity a = activity.get();
        if (a instanceof MainActivity) {
            ((MainActivity) a).startPickRestore();
        }
    }

    private void writeDownloads(String json) throws Exception {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        if (Build.VERSION.SDK_INT >= 29) {
            ContentResolver resolver = ctx.getContentResolver();
            Uri existing = findDownloadsUri();
            if (existing != null) {
                OutputStream os = resolver.openOutputStream(existing, "wt");
                if (os != null) {
                    os.write(bytes);
                    os.close();
                }
                return;
            }
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, BACKUP_NAME);
            values.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri != null) {
                OutputStream os = resolver.openOutputStream(uri);
                if (os != null) {
                    os.write(bytes);
                    os.close();
                }
            }
            return;
        }
        File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        if (dir == null) return;
        dir.mkdirs();
        writeBytes(new File(dir, BACKUP_NAME), bytes);
    }

    private Uri findDownloadsUri() {
        if (Build.VERSION.SDK_INT < 29) return null;
        Cursor c = null;
        try {
            c = ctx.getContentResolver()
                    .query(
                            MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                            new String[] {MediaStore.MediaColumns._ID},
                            MediaStore.MediaColumns.DISPLAY_NAME + "=?",
                            new String[] {BACKUP_NAME},
                            null);
            if (c != null && c.moveToFirst()) {
                long id = c.getLong(0);
                return ContentUris.withAppendedId(MediaStore.Downloads.EXTERNAL_CONTENT_URI, id);
            }
        } catch (Exception ignored) {
        } finally {
            if (c != null) c.close();
        }
        return null;
    }

    private static void writeBytes(File f, byte[] bytes) throws Exception {
        FileOutputStream out = new FileOutputStream(f);
        out.write(bytes);
        out.close();
    }

    private static String readFile(File f) throws Exception {
        FileInputStream in = new FileInputStream(f);
        String s = readStream(in);
        in.close();
        return s;
    }

    private static String readStream(InputStream in) throws Exception {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int n;
        while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
        return bos.toString("UTF-8");
    }
}

