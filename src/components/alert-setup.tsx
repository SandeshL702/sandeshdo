import { useEffect, useState } from "react";
import { Bell, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui";
import { ensureNotificationPermission, readNativeHealth, sendTestPopup } from "@/lib/notifications";
import { useApp } from "@/lib/store";

const SKIP_KEY = "sandeshdo-alert-skip";

export function AlertSetup() {
  const settings = useApp((s) => s.settings);
  const patchSettings = useApp((s) => s.patchSettings);
  const [health, setHealth] = useState(() => readNativeHealth());
  const [skipped, setSkipped] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const native = health.native;

  useEffect(() => {
    try {
      setSkipped(localStorage.getItem(SKIP_KEY) === "1");
    } catch {
      /* private */
    }
    setHealth(readNativeHealth());
    const onVis = () => setHealth(readNativeHealth());
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    window.addEventListener("sandeshdo:native-resume", onVis);
    if (window.SandeshDoHost) {
      void ensureNotificationPermission();
    }
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
      window.removeEventListener("sandeshdo:native-resume", onVis);
    };
  }, []);

  useEffect(() => {
    if (countdown == null || countdown <= 0) return;
    const t = window.setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => window.clearTimeout(t);
  }, [countdown]);

  if (!native) return null;

  const notifyOk = native ? health.notifications : typeof Notification !== "undefined" && Notification.permission === "granted";
  const allOk = notifyOk && health.exactAlarms && health.fullScreen && health.battery;

  if (allOk) return null;
  if (skipped) {
    return (
      <button
        type="button"
        onClick={() => setSkipped(false)}
        className="mb-4 flex w-full items-center gap-3 rounded-2xl bg-urgent px-4 py-3 text-left text-urgent-fg"
      >
        <ShieldAlert className="size-4 shrink-0" />
        <span className="min-w-0">
          <span className="block text-sm font-semibold">Alerts are blocked</span>
          <span className="mt-0.5 block text-xs opacity-80">Tap to allow lock-screen popups</span>
        </span>
      </button>
    );
  }

  const steps: { ok: boolean; label: string; hint: string; go: () => void }[] = [
    {
      ok: notifyOk,
      label: "Notifications",
      hint: "Allow banners",
      go: async () => {
        const ok = await ensureNotificationPermission();
        patchSettings({ notificationsEnabled: ok || true });
        setHealth(readNativeHealth());
      },
    },
    {
      ok: health.exactAlarms,
      label: "Alarms & reminders",
      hint: "Exact time. Required.",
      go: () => window.SandeshDoHost?.openExactAlarmSettings(),
    },
    {
      ok: health.fullScreen,
      label: "Full-screen popup",
      hint: "Takes over a locked phone",
      go: () => window.SandeshDoHost?.openFullScreenSettings?.(),
    },
    {
      ok: health.battery,
      label: "Ignore battery saving",
      hint: "Otherwise the phone kills the alert",
      go: () => window.SandeshDoHost?.openBatterySettings?.(),
    },
  ];
  if (health.needsOem) {
    steps.push({
      ok: false,
      label: `${health.manufacturer || "Phone"} autostart`,
      hint: "Turn SandeshDo on. Xiaomi / Vivo / Oppo hide this.",
      go: () => window.SandeshDoHost?.openOemAutostart?.(),
    });
  }

  const core = steps.filter((s) => !s.label.includes("autostart"));
  const next = core.find((s) => !s.ok) ?? core[0];

  return (
    <section className="mb-5 overflow-hidden rounded-[1.75rem] bg-fg px-4 py-4 text-bg shadow-[var(--sd-dock-shadow)]">
      <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em] uppercase opacity-70">
        <Bell className="size-3.5" />
        Lock-screen alerts
      </div>
      <h2 className="font-display mt-2 text-[1.65rem] leading-tight font-medium">Allow 4 things. Then lock the phone.</h2>
      <p className="mt-2 text-sm opacity-75">
        TickTick-grade. System alarm clock. Soft chime + light vibrate. Works with the app closed.
      </p>
      <ol className="mt-4 space-y-2">
        {steps.map((s, i) => (
          <li key={s.label}>
            <button
              type="button"
              onClick={s.go}
              className="flex w-full items-center gap-3 rounded-2xl bg-bg/12 px-3 py-2.5 text-left"
            >
              <span
                className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold ${
                  s.ok ? "bg-primary text-primary-fg" : "bg-bg text-fg"
                }`}
              >
                {s.ok ? "✓" : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{s.label}</span>
                <span className="block text-xs opacity-70">{s.hint}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <Button
        className="mt-4 h-12 w-full rounded-2xl bg-bg text-fg hover:bg-bg"
        onClick={async () => {
          if (!next.ok) {
            next.go();
            return;
          }
          const ok = await sendTestPopup(settings, "lock");
          if (ok) {
            patchSettings({ notificationsEnabled: true });
            setCountdown(10);
          }
        }}
      >
        {countdown && countdown > 0
          ? `Lock the phone now · ${countdown}s`
          : next.ok
            ? "Fire lock-screen test"
            : `Allow ${next.label}`}
      </Button>
      <button
        type="button"
        className="mt-2 w-full py-2 text-xs font-medium opacity-60"
        onClick={() => {
          try {
            localStorage.setItem(SKIP_KEY, "1");
          } catch {
            /* private */
          }
          setSkipped(true);
        }}
      >
        Later
      </button>
    </section>
  );
}
