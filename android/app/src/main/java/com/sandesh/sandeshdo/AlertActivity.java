package com.sandesh.sandeshdo;

import android.app.KeyguardManager;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;

public class AlertActivity extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applyLockFlags();
        AlarmService.ensureChannel(this);
        AlertReceiver.vibrate(this);
        AlertChime.play(this);
        render(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        applyLockFlags();
        render(intent);
    }

    private void applyLockFlags() {
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
        getWindow()
                .addFlags(
                        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                                | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                                | WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON);
        KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
        if (km != null && Build.VERSION.SDK_INT >= 26) {
            km.requestDismissKeyguard(this, null);
        }
    }

    private void render(Intent intent) {
        if (intent == null) intent = getIntent();
        String title = intent != null ? intent.getStringExtra("title") : null;
        String body = intent != null ? intent.getStringExtra("body") : null;
        String taskId = intent != null ? intent.getStringExtra("taskId") : null;
        boolean overdue = intent != null && intent.getBooleanExtra("overdue", false);
        if (title == null) title = "SandeshDo";
        if (body == null) body = overdue ? "Still pending" : "Due now";

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor("#171614"));
        int pad = dp(28);
        root.setPadding(pad, dp(64), pad, dp(36));
        root.setGravity(Gravity.CENTER_HORIZONTAL);

        TextView brand = label("SANDESHDO", 11, Color.parseColor("#9A978E"));
        brand.setLetterSpacing(0.18f);
        root.addView(brand);

        TextView status = label(overdue ? "STILL PENDING" : "DUE NOW", 12, Color.parseColor("#F87171"));
        status.setPadding(0, dp(28), 0, 0);
        status.setLetterSpacing(0.16f);
        status.setTypeface(Typeface.SANS_SERIF, Typeface.BOLD);
        root.addView(status);

        TextView h = new TextView(this);
        h.setText(title);
        h.setTextColor(Color.parseColor("#F6F3EC"));
        h.setTextSize(TypedValue.COMPLEX_UNIT_SP, 32);
        h.setGravity(Gravity.CENTER);
        h.setPadding(0, dp(16), 0, 0);
        h.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        root.addView(h);

        TextView sub = label(body, 15, Color.parseColor("#C4C1B8"));
        sub.setPadding(0, dp(12), 0, dp(40));
        sub.setGravity(Gravity.CENTER);
        root.addView(sub);

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, dp(72), 1);
        lp.setMargins(dp(6), 0, dp(6), 0);

        Button snooze = action("10 min", "Snooze", Color.parseColor("#2A2926"), Color.parseColor("#F6F3EC"));
        Button done = action("Done", "Finished", Color.parseColor("#0B6B58"), Color.parseColor("#F6F3EC"));
        row.addView(snooze, lp);
        row.addView(done, lp);
        root.addView(row);

        Button open = action("Open SandeshDo", "", Color.parseColor("#F6F3EC"), Color.parseColor("#171614"));
        LinearLayout.LayoutParams openLp =
                new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(56));
        openLp.topMargin = dp(12);
        root.addView(open, openLp);

        final String tid = taskId;
        final String t = title;
        snooze.setOnClickListener(
                v -> {
                    ActionReceiver.push(this, "snooze", tid == null ? "" : tid, 10);
                    AlarmScheduler.snooze(this, tid == null ? "" : tid, t, "Snoozed", 10);
                    AlertReceiver.cancelNote(this, tid);
                    finish();
                });
        done.setOnClickListener(
                v -> {
                    ActionReceiver.push(this, "complete", tid == null ? "" : tid, 0);
                    AlarmScheduler.cancelTask(this, tid == null ? "" : tid);
                    AlertReceiver.cancelNote(this, tid);
                    finish();
                });
        open.setOnClickListener(
                v -> {
                    Intent i = new Intent(this, MainActivity.class);
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    i.putExtra("taskId", tid);
                    startActivity(i);
                    AlertReceiver.cancelNote(this, tid);
                    finish();
                });

        setContentView(root);
    }

    private TextView label(String text, int sp, int color) {
        TextView t = new TextView(this);
        t.setText(text);
        t.setTextColor(color);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setGravity(Gravity.CENTER);
        return t;
    }

    private Button action(String title, String hint, int bg, int fg) {
        Button b = new Button(this);
        b.setAllCaps(false);
        b.setText(hint.isEmpty() ? title : title + "\n" + hint);
        b.setTextColor(fg);
        b.setBackgroundColor(bg);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        return b;
    }

    private int dp(int v) {
        return Math.round(getResources().getDisplayMetrics().density * v);
    }
}
