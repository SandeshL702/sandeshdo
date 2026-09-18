package com.sandesh.sandeshdo;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;

public class ActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        String taskId = intent.getStringExtra("taskId");
        if (taskId == null || taskId.isEmpty()) return;
        AlertReceiver.cancelNote(context, taskId);
        if ("com.sandesh.sandeshdo.DONE".equals(intent.getAction())) {
            push(context, "complete", taskId, 0);
            AlarmScheduler.cancelTask(context, taskId);
        } else if ("com.sandesh.sandeshdo.SNOOZE".equals(intent.getAction())) {
            push(context, "snooze", taskId, 10);
            AlarmScheduler.snooze(
                    context,
                    taskId,
                    intent.getStringExtra("title") != null ? intent.getStringExtra("title") : "SandeshDo",
                    "Snoozed",
                    10);
        }
    }

    static void push(Context ctx, String type, String taskId, int minutes) {
        SharedPreferences sp = ctx.getSharedPreferences("sandeshdo-actions", Context.MODE_PRIVATE);
        try {
            JSONArray arr = new JSONArray(sp.getString("queue", "[]"));
            JSONObject o = new JSONObject();
            o.put("type", type);
            o.put("taskId", taskId);
            o.put("minutes", minutes);
            o.put("at", System.currentTimeMillis());
            arr.put(o);
            sp.edit().putString("queue", arr.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    static String drain(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences("sandeshdo-actions", Context.MODE_PRIVATE);
        String q = sp.getString("queue", "[]");
        sp.edit().putString("queue", "[]").apply();
        return q;
    }
}
