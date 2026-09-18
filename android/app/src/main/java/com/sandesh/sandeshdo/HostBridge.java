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
import java.lang.ref.WeakReference;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
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
        Intent i = new Intent(ctx, AlarmService.class);
        i.putExtra("title", title == null || title.isEmpty() ? "Pay electricity bill" : title);
        i.putExtra("body", "Test alert · lock screen popup");
        i.putExtra("overdue", true);
        i.putExtra("taskId", "test");
        i.putExtra("repeatMin", 0);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(i);
            } else {
                ctx.startService(i);
            }
        } catch (Exception e) {
            Intent a = new Intent(ctx, AlertActivity.class);
            a.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            a.putExtra("title", title == null || title.isEmpty() ? "Pay electricity bill" : title);
            a.putExtra("body", "Test alert · lock screen popup");
            a.putExtra("overdue", true);
            a.putExtra("taskId", "test");
            ctx.startActivity(a);
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

