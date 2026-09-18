import { Play } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui";
import { useApp } from "@/lib/store";
import { formatOverdue } from "@/lib/time";
import { liveStatus } from "@/lib/engine";
import { armCues, playGentleTone, pulseVibrate } from "@/lib/notifications";
import { useT } from "@/lib/i18n";

export function ReminderScreen() {
  const navigate = useNavigate();
  const { t } = useT();
  const id = useApp((s) => s.activeReminderTaskId);
  const task = useApp((s) => s.tasks.find((row) => row.id === id) ?? null);
  const completeTask = useApp((s) => s.completeTask);
  const snoozeTask = useApp((s) => s.snoozeTask);
  const startFocus = useApp((s) => s.startFocus);
  const dismissReminder = useApp((s) => s.dismissReminder);
  const now = Date.now();
  const overdue = task ? liveStatus(task, now) === "overdue" : false;
  const paisa = id === "paisa";

  useEffect(() => {
    if (!task && !paisa) return;
    const hadGesture = Boolean(window.__sdCuesArmed);
    armCues();
    playGentleTone();
    if (hadGesture) pulseVibrate(useApp.getState().settings.notifyVibrate);
  }, [task?.id, paisa]);

  if (paisa) {
    return (
      <div role="dialog" aria-modal="true" className="sd-overlay flex flex-col bg-fg text-bg">
        <div className="flex flex-1 flex-col items-center justify-center px-8 pt-[max(3rem,env(safe-area-inset-top))] text-center">
          <p className="text-micro font-semibold tracking-[0.22em] uppercase opacity-60">SandeshDo</p>
          <div className="sd-call-mark relative mt-8 flex size-40 items-center justify-center">
            <span className="sd-call-ring" />
            <span className="sd-call-ring sd-call-ring-delay" />
            <span className="relative flex size-24 items-center justify-center rounded-full bg-primary text-primary-fg">
              <span className="font-display text-3xl font-medium">₹</span>
            </span>
          </div>
          <h2 className="font-display mt-8 max-w-sm text-4xl leading-[1.05] font-medium tracking-tight">
            {t("nudge.paisaTitle")}
          </h2>
          <p className="mt-4 max-w-xs text-base opacity-75">{t("nudge.paisaBody")}</p>
        </div>
        <div className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="flex h-28 flex-col items-center justify-center rounded-[1.75rem] bg-primary text-primary-fg"
              onClick={() => {
                dismissReminder();
                window.dispatchEvent(new CustomEvent("sandeshdo:money-add", { detail: { type: "income" } }));
              }}
            >
              <span className="text-lg font-semibold">{t("money.aaya")}</span>
            </button>
            <button
              type="button"
              className="flex h-28 flex-col items-center justify-center rounded-[1.75rem] bg-bg text-fg"
              onClick={() => {
                dismissReminder();
                window.dispatchEvent(new CustomEvent("sandeshdo:money-add", { detail: { type: "expense" } }));
              }}
            >
              <span className="text-lg font-semibold">{t("money.gaya")}</span>
            </button>
          </div>
          <Button variant="ghost" className="mt-3 w-full text-bg hover:bg-bg/10" onClick={dismissReminder}>
            {t("nudge.later")}
          </Button>
        </div>
      </div>
    );
  }

  if (!task) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sd-call-title"
      className="sd-overlay flex flex-col bg-fg text-bg"
    >
      <div className="flex flex-1 flex-col items-center justify-center px-8 pt-[max(3rem,env(safe-area-inset-top))] text-center">
        <p className="text-micro font-semibold tracking-[0.22em] uppercase opacity-60">SandeshDo</p>
        <div className="sd-call-mark relative mt-8 flex size-40 items-center justify-center">
          <span className="sd-call-ring" />
          <span className="sd-call-ring sd-call-ring-delay" />
          <span className="relative flex size-24 items-center justify-center rounded-full bg-urgent text-urgent-fg">
            <Play className="size-10 translate-x-0.5" strokeWidth={2.2} fill="currentColor" />
          </span>
        </div>
        <p className="mt-8 text-xs font-semibold tracking-[0.18em] uppercase opacity-70">
          {overdue ? "Still pending" : "Due now"}
        </p>
        <h2 id="sd-call-title" className="font-display mt-3 max-w-sm text-4xl leading-[1.05] font-medium tracking-tight text-balance">
          {task.title}
        </h2>
        <p className="mt-4 max-w-xs text-base opacity-75">
          {overdue && task.dueAt ? formatOverdue(task.dueAt, now) : "On this phone. App can be closed."}
        </p>
      </div>

      <div className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className="flex h-28 flex-col items-center justify-center rounded-[1.75rem] bg-bg/12 text-bg"
            onClick={() => {
              snoozeTask(task.id, 10);
              dismissReminder();
            }}
          >
            <span className="text-lg font-semibold">10 min</span>
            <span className="mt-1 text-xs opacity-70">Snooze</span>
          </button>
          <button
            type="button"
            className="flex h-28 flex-col items-center justify-center rounded-[1.75rem] bg-primary text-primary-fg"
            onClick={() => {
              completeTask(task.id);
              dismissReminder();
            }}
          >
            <span className="text-lg font-semibold">Done</span>
            <span className="mt-1 text-xs opacity-80">Finished</span>
          </button>
        </div>
        <Button
          size="lg"
          className="mt-3 h-14 w-full rounded-3xl bg-bg text-fg hover:bg-bg"
          onClick={() => {
            startFocus(task.id, task.estimatedDuration || 25);
            dismissReminder();
            void navigate({ to: "/focus" });
          }}
        >
          <Play className="size-4" /> Do it now
        </Button>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button
            variant="ghost"
            className="text-bg hover:bg-bg/10"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("sandeshdo:snooze-task", { detail: task.id }));
              dismissReminder();
            }}
          >
            Reschedule
          </Button>
          <Button variant="ghost" className="text-bg hover:bg-bg/10" onClick={dismissReminder}>
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}
