import type { RecurringSpend, Reminder, ReminderInterval, Settings, Task, Transaction } from "./types";
import { dayKey, isInQuietHours, nextQuietHoursEnd } from "./time";
import { uid } from "./utils";

export function intervalMinutes(interval: ReminderInterval): number | null {
  if (interval === "off") return null;
  return interval;
}

export function liveStatus(task: Task, now: number): Task["status"] {
  if (task.status === "completed") return "completed";
  const point = task.snoozedUntil ?? task.dueAt;
  if (point == null) return "inbox";
  if (point <= now) return "overdue";
  const soon = point - now <= 60_000;
  return soon ? "due" : "scheduled";
}

export function effectiveDue(task: Task): number | null {
  return task.snoozedUntil ?? task.dueAt;
}

function reminderCapReached(task: Task, settings: Settings, now: number): boolean {
  const today = dayKey(now);
  const count = task.reminderDayKey === today ? task.reminderCount : 0;
  return count >= settings.maxRemindersPerDay;
}

export function nextReminderAt(task: Task, settings: Settings, now: number): number | null {
  if (!task.reminderEnabled || task.status === "completed") return null;
  if (reminderCapReached(task, settings, now)) return null;
  const due = effectiveDue(task);
  if (due == null) return null;

  const offsets = task.reminderOffsets.length ? task.reminderOffsets : [0];
  const futureOffsets = offsets
    .map((mins) => due + mins * 60_000)
    .filter((t) => t > now)
    .sort((a, b) => a - b);
  if (futureOffsets[0]) return applyQuietHours(futureOffsets[0], task, settings, now);

  if (due > now) return applyQuietHours(due, task, settings, now);

  const step = intervalMinutes(settings.reminderInterval);
  if (step == null) return null;
  const last = task.lastReminderAt ?? due;
  const candidate = Math.max(now, last + step * 60_000);
  return applyQuietHours(candidate, task, settings, now);
}

function applyQuietHours(when: number, task: Task, settings: Settings, now: number): number {
  if (!settings.quietHoursEnabled) return when;
  const due = effectiveDue(task);
  // Overdue work never waits for morning — unfinished stays in the user's face.
  if (due != null && due <= now) return when;
  const urgentBypass = task.priority === "urgent" && settings.aggressiveReminders;
  if (urgentBypass) return when;
  const date = new Date(when);
  if (!isInQuietHours(date, settings.quietHoursStart, settings.quietHoursEnd)) return when;
  const end = nextQuietHoursEnd(date, settings.quietHoursEnd).getTime();
  return Math.max(end, now);
}

export function rebuildReminders(
  tasks: Task[],
  settings: Settings,
  now: number,
  transactions: Pick<Transaction, "at">[] = [],
  recurringSpends: RecurringSpend[] = [],
): Reminder[] {
  const reminders: Reminder[] = [];
  for (const task of tasks) {
    if (task.status === "completed" || !task.reminderEnabled) continue;
    const triggerAt = nextReminderAt(task, settings, now);
    if (triggerAt == null) continue;
    const due = effectiveDue(task) ?? triggerAt;
    let type: Reminder["type"] = "at";
    if (task.snoozedUntil && triggerAt === task.snoozedUntil) type = "snooze";
    else if (triggerAt < due) type = "before";
    else if (triggerAt > due) type = due <= now ? "overdue" : "after";
    reminders.push({
      id: uid(),
      taskId: task.id,
      triggerAt,
      type,
      status: "pending",
    });
  }
  const paisa = buildPaisaReminder(settings, transactions, now);
  if (paisa) reminders.push(paisa);
  const today = dayKey(now);
  const dow = new Date(now).getDay();
  for (const row of recurringSpends) {
    if (!row.enabled) continue;
    if (row.lastPostedDay === today) continue;
    if (row.days.length && !row.days.includes(dow)) continue;
    const at = new Date(now);
    at.setHours(row.hour, row.minute, 0, 0);
    let triggerAt = at.getTime();
    if (triggerAt <= now) triggerAt = now + 8_000;
    reminders.push({
      id: `recurring-${row.id}-${today}`,
      taskId: `recurring-${row.id}`,
      triggerAt,
      type: "paisa",
      status: "pending",
    });
  }
  return reminders.sort((a, b) => a.triggerAt - b.triggerAt);
}

export function buildPaisaReminder(
  settings: Settings,
  transactions: Pick<Transaction, "at">[],
  now: number,
): Reminder | null {
  if (!settings.paisaNudgeEnabled) return null;
  const today = dayKey(now);
  if (settings.lastPaisaNudgeOn === today) return null;
  if (transactions.some((tx) => dayKey(tx.at) === today)) return null;
  const [hh, mm] = (settings.paisaNudgeTime || "20:00").split(":").map(Number);
  const at = new Date(now);
  at.setHours(hh ?? 20, mm ?? 0, 0, 0);
  let triggerAt = at.getTime();
  if (triggerAt <= now) {
    if (new Date(now).getHours() < (hh ?? 20)) return null;
    triggerAt = now + 12_000;
  }
  return {
    id: `paisa-${today}`,
    taskId: "paisa",
    triggerAt,
    type: "paisa",
    status: "pending",
  };
}

export function usualSnoozeMinutes(task: Task): number | null {
  const hist = task.snoozeHistory.slice(-4);
  if (hist.length < 2) return null;
  const last = hist[hist.length - 1];
  if (hist.every((n) => n === last) && last > 0) return last;
  return null;
}

export function agingLabel(task: Task): string | null {
  if (task.snoozeCount >= 2) return `Postponed ${task.snoozeCount} times`;
  if (task.rescheduleCount >= 2) return `Rescheduled ${task.rescheduleCount} times`;
  return null;
}
