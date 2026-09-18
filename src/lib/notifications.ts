import type { Priority, Settings, Task } from "./types";
import { writeAlarms, type AlarmRecord } from "./alarms";
import type { Reminder } from "./types";
import { liveStatus } from "./engine";
import { dayKey } from "./time";

declare global {
  interface Window {
    __sdCuesArmed?: boolean;
    SandeshDoHost?: {
      syncAlarms: (json: string) => void;
      takeActions: () => string;
      fireTest: (title: string) => void;
      fireNow?: (title: string) => void;
      scheduleTest?: (title: string, seconds: number) => void;
      canExactAlarms: () => boolean;
      openExactAlarmSettings: () => void;
      canFullScreenIntent?: () => boolean;
      openFullScreenSettings?: () => void;
      isIgnoringBattery?: () => boolean;
      openBatterySettings?: () => void;
      requestNotifyPermission?: () => void;
      openAppSettings?: () => void;
      openOemAutostart?: () => void;
      alertHealth?: () => string;
      pinToday?: (json: string) => void;
      saveBackup?: (json: string) => string;
      loadLatestBackup?: () => string;
      shareBackup?: (json: string) => void;
    };
  }
}

export type NotifyChannel = "normal" | "important" | "urgent" | "focus";

const lastByTag = new Map<string, number>();
const LIGHT_VIBRATE: number[] = [36, 54, 36, 54, 48];

let audioCtx: AudioContext | null = null;
let swReady: Promise<ServiceWorkerRegistration | null> | null = null;

function channelFor(priority: Priority, overdue: boolean): NotifyChannel {
  if (priority === "urgent") return "urgent";
  if (priority === "high" || overdue) return "important";
  return "normal";
}

function recent(tag: string, now = Date.now()): boolean {
  const prev = lastByTag.get(tag);
  if (prev != null && now - prev < 8_000) return true;
  lastByTag.set(tag, now);
  return false;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const host = typeof window !== "undefined" ? window.SandeshDoHost : undefined;
  if (host?.requestNotifyPermission) {
    try {
      host.requestNotifyPermission();
    } catch {
      /* native optional */
    }
  }
  if (typeof window === "undefined" || !("Notification" in window)) return Boolean(host);
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return Boolean(host);
  const result = await Notification.requestPermission();
  return result === "granted" || Boolean(host);
}

export function canNotify(): boolean {
  return typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted";
}

export function registerReminderWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }
  if (!swReady) {
    swReady = navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(async (reg) => {
        void reg.update();
        try {
          const periodic = (
            reg as ServiceWorkerRegistration & {
              periodicSync?: { register: (tag: string, opts: { minInterval: number }) => Promise<void> };
            }
          ).periodicSync;
          if (periodic) await periodic.register("sandeshdo-tick", { minInterval: 15 * 60 * 1000 });
        } catch {
          /* periodic sync is optional */
        }
        return reg;
      })
      .catch(() => null);
  }
  return swReady;
}

function getAudio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

export function armCues(): void {
  window.__sdCuesArmed = true;
  const ctx = getAudio();
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

export function playGentleTone(): void {
  if (typeof window === "undefined") return;
  const ctx = getAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const beep = (freq: number, start: number, dur: number, vol: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const over = ctx.createOscillator();
    const overGain = ctx.createGain();
    osc.type = "sine";
    over.type = "sine";
    osc.frequency.value = freq;
    over.frequency.value = freq * 2;
    gain.gain.setValueAtTime(0.0001, now + start);
    gain.gain.exponentialRampToValueAtTime(vol, now + start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
    overGain.gain.setValueAtTime(0.0001, now + start);
    overGain.gain.exponentialRampToValueAtTime(vol * 0.18, now + start + 0.03);
    overGain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
    osc.connect(gain);
    over.connect(overGain);
    gain.connect(ctx.destination);
    overGain.connect(ctx.destination);
    osc.start(now + start);
    over.start(now + start);
    osc.stop(now + start + dur + 0.04);
    over.stop(now + start + dur + 0.04);
  };
  beep(659.25, 0, 0.42, 0.16);
  beep(830.61, 0.14, 0.44, 0.14);
  beep(987.77, 0.28, 0.5, 0.13);
  beep(1318.51, 0.44, 0.7, 0.11);
  beep(1975.53, 0.72, 0.85, 0.07);
}

export function pulseVibrate(enabled: boolean): void {
  if (!enabled || typeof window === "undefined" || !window.__sdCuesArmed) return;
  if (!navigator.vibrate) return;
  try {
    navigator.vibrate(LIGHT_VIBRATE);
  } catch {
    /* ignore */
  }
}

export function readNativeHealth(): {
  native: boolean;
  exactAlarms: boolean;
  fullScreen: boolean;
  battery: boolean;
  notifications: boolean;
  needsOem: boolean;
  manufacturer: string;
  alarmCount: number;
  nextAt: number;
} {
  const empty = {
    native: false,
    exactAlarms: true,
    fullScreen: true,
    battery: true,
    notifications: typeof Notification !== "undefined" && Notification.permission === "granted",
    needsOem: false,
    manufacturer: "",
    alarmCount: 0,
    nextAt: 0,
  };
  const host = typeof window !== "undefined" ? window.SandeshDoHost : undefined;
  if (!host) return empty;
  try {
    if (host.alertHealth) {
      const parsed = JSON.parse(host.alertHealth()) as Partial<typeof empty>;
      return {
        native: true,
        exactAlarms: parsed.exactAlarms ?? host.canExactAlarms(),
        fullScreen: parsed.fullScreen ?? host.canFullScreenIntent?.() ?? true,
        battery: parsed.battery ?? host.isIgnoringBattery?.() ?? true,
        notifications: parsed.notifications ?? (typeof Notification !== "undefined" && Notification.permission === "granted"),
        needsOem: Boolean(parsed.needsOem),
        manufacturer: parsed.manufacturer ?? "",
        alarmCount: parsed.alarmCount ?? 0,
        nextAt: parsed.nextAt ?? 0,
      };
    }
    return {
      native: true,
      exactAlarms: host.canExactAlarms(),
      fullScreen: host.canFullScreenIntent?.() ?? true,
      battery: host.isIgnoringBattery?.() ?? true,
      notifications: typeof Notification !== "undefined" && Notification.permission === "granted",
      needsOem: false,
      manufacturer: "",
      alarmCount: 0,
      nextAt: 0,
    };
  } catch {
    return { ...empty, native: true };
  }
}

export async function sendTestPopup(settings: Settings, mode: "lock" | "now"): Promise<boolean> {
  const host = typeof window !== "undefined" ? window.SandeshDoHost : undefined;
  if (host) {
    if (mode === "now" && host.fireNow) host.fireNow("Pay electricity bill");
    else if (host.scheduleTest) host.scheduleTest("Pay electricity bill", 10);
    else host.fireTest("Pay electricity bill");
    return true;
  }
  const ok = await ensureNotificationPermission();
  if (!ok) return false;
  playGentleTone();
  pulseVibrate(settings.notifyVibrate);
  return true;
}

export function notifyTask(task: Task, body: string, overdue: boolean, settings: Settings): void {
  if (!settings.notificationsEnabled) return;
  const tag = `task-${task.id}`;
  if (recent(tag)) return;
  pulseVibrate(settings.notifyVibrate);
  if (settings.notifyTone === "gentle") playGentleTone();
  if (!canNotify()) return;
  const channel = channelFor(task.priority, overdue);
  void showWebNotification(task.title, body, tag, channel);
}

export function notifyFocus(title: string, body: string, settings: Settings): void {
  pulseVibrate(settings.notifyVibrate);
  if (settings.notifyTone === "gentle") playGentleTone();
  if (!settings.notificationsEnabled || !canNotify()) return;
  void showWebNotification(title, body, "focus", "focus");
}

export function notifySummary(title: string, body: string, settings: Settings): void {
  if (!settings.notificationsEnabled) return;
  pulseVibrate(settings.notifyVibrate);
  if (!canNotify()) return;
  void showWebNotification(title, body, `summary-${dayKey()}`, "normal");
}

async function showWebNotification(title: string, body: string, tag: string, channel: NotifyChannel): Promise<void> {
  try {
    const reg = await registerReminderWorker();
    const opts: NotificationOptions = {
      body,
      tag,
      silent: false,
      data: { channel },
    };
    if (reg) await reg.showNotification(title, opts);
    else new Notification(title, opts);
  } catch {
    /* notification optional */
  }
}

export async function syncScheduledAlarms(reminders: Reminder[], tasks: Task[], settings: Settings): Promise<void> {
  const host = typeof window !== "undefined" ? window.SandeshDoHost : undefined;
  const now = Date.now();
  const open = tasks.filter((t) => t.status !== "completed");
  const records: AlarmRecord[] = reminders
    .filter((r) => r.status === "pending" && r.triggerAt >= now - 30_000)
    .map((r) => {
      if (r.taskId === "paisa" || r.type === "paisa") {
        return {
          id: r.id,
          taskId: "paisa",
          title: settings.locale === "en" ? "Log today's money" : "Aaj paisa likha?",
          body: settings.locale === "en" ? "Got or spent. 10 seconds." : "Aaya ya Gaya. 10 second.",
          triggerAt: r.triggerAt,
          overdue: false,
          priority: "high",
          repeatMin: 0,
        };
      }
      const task = open.find((t) => t.id === r.taskId);
      return {
        id: r.id,
        taskId: r.taskId,
        title: task?.title ?? "SandeshDo",
        body: r.type === "overdue" ? "Overdue" : "Due now",
        triggerAt: r.triggerAt,
        overdue: task ? liveStatus(task, now) === "overdue" : r.type === "overdue",
        priority: task?.priority ?? "medium",
        repeatMin: 15,
      };
    });
  if (host?.syncAlarms) {
    host.syncAlarms(JSON.stringify(records));
  } else {
    void writeAlarms(records);
  }
  if (host?.pinToday) {
    const today = dayKey(now);
    const titles = open
      .filter((t) => t.dueAt && dayKey(t.dueAt) === today)
      .slice(0, 3)
      .map((t) => t.title);
    host.pinToday(JSON.stringify({ count: titles.length, titles }));
  }
}
