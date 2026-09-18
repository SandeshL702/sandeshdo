import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ListTodo, Plus, Wallet } from "lucide-react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { armScheduler, useApp } from "@/lib/store";
import { QuickAdd } from "@/components/quick-add";
import { MoneySheet } from "@/components/money-sheet";
import { TaskDetail } from "@/components/task-detail";
import { ReminderScreen } from "@/components/reminder-screen";
import { FinishScreen } from "@/components/finish-screen";
import { SnoozeSheet } from "@/components/snooze-sheet";
import { registerReminderWorker, armCues, ensureNotificationPermission } from "@/lib/notifications";
import { JuiceLayer } from "@/components/juice";
import { persistBackup, serializeBackup } from "@/lib/backup";
import { useT } from "@/lib/i18n";
import type { TxType } from "@/lib/types";
import { Splash } from "@/components/splash";
import { Assistant } from "@/components/assistant";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const hydrated = useApp((s) => s.hydrated);
  const theme = useApp((s) => s.settings.theme);
  const tickFocus = useApp((s) => s.tickFocus);
  const restoreAlarms = useApp((s) => s.restoreAlarms);
  const applyWorkerActions = useApp((s) => s.applyWorkerActions);
  const completeTask = useApp((s) => s.completeTask);
  const snoozeTask = useApp((s) => s.snoozeTask);
  const focusRunning = useApp((s) => s.focus.running);
  const focusEndsAt = useApp((s) => s.focus.endsAt);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.searchStr });
  const [quickOpen, setQuickOpen] = useState(false);
  const [moneyOpen, setMoneyOpen] = useState(false);
  const [moneyType, setMoneyType] = useState<TxType>("expense");
  const [moneyAmount, setMoneyAmount] = useState("");
  const [prefill, setPrefill] = useState("");
  const [prefillDate, setPrefillDate] = useState("");
  const [prefillWhen, setPrefillWhen] = useState<"today" | "tomorrow" | "">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snoozeId, setSnoozeId] = useState<string | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);

  const nav = [
    {
      to: "/",
      label: t("nav.do"),
      icon: ListTodo,
      match: (p: string) => p === "/" || p.startsWith("/tasks") || p.startsWith("/calendar") || p.startsWith("/focus"),
    },
    { to: "/money", label: t("nav.paisa"), icon: Wallet, match: (p: string) => p.startsWith("/money") },
  ] as const;

  useEffect(() => {
    const boot = () => {
      useApp.getState().finishHydration();
    };
    try {
      void Promise.resolve(useApp.persist.rehydrate()).then(boot, boot);
    } catch {
      boot();
    }
    const timer = window.setTimeout(boot, 50);
    const arm = () => armCues();
    window.addEventListener("pointerdown", arm, { once: true });
    window.addEventListener("keydown", arm, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
  }, []);

  useEffect(() => {
    const resolved =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;
    document.documentElement.classList.toggle("dark", resolved === "dark");
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (useApp.getState().settings.theme === "system") {
        document.documentElement.classList.toggle("dark", mq.matches);
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    if (!hydrated) return;
    void registerReminderWorker();
    armScheduler();
    void ensureNotificationPermission().then((ok) => {
      if (ok || window.SandeshDoHost) {
        useApp.getState().patchSettings({ notificationsEnabled: true, notifyRev: 19 });
      }
    });
    let tz = new Date().getTimezoneOffset();
    const checkClock = () => {
      const next = new Date().getTimezoneOffset();
      if (next !== tz) {
        tz = next;
        restoreAlarms();
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        checkClock();
        void applyWorkerActions();
        restoreAlarms();
        tickFocus();
      } else {
        try {
          persistBackup(serializeBackup(useApp.getState()));
        } catch {
          /* backup optional */
        }
      }
    };
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (id) setSelectedId(id);
    };
    const onSnooze = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (id) setSnoozeId(id);
    };
    const onQuick = (e: Event) => {
      const d = (e as CustomEvent<{ text?: string; date?: string; when?: "today" | "tomorrow" } | string | undefined>)
        .detail;
      if (typeof d === "string") {
        setPrefill(d);
        setPrefillDate("");
        setPrefillWhen("");
      } else if (d && typeof d === "object") {
        setPrefill(d.text ?? "");
        setPrefillDate(d.date ?? "");
        setPrefillWhen(d.when ?? "");
      } else {
        setPrefill("");
        setPrefillDate("");
        setPrefillWhen("");
      }
      setQuickOpen(true);
    };
    const onMoney = (e: Event) => {
      const d = (e as CustomEvent<{ type?: TxType; amount?: string } | undefined>).detail;
      setMoneyType(d?.type === "income" ? "income" : "expense");
      setMoneyAmount(d?.amount ?? "");
      setMoneyOpen(true);
    };
    const onSw = (e: MessageEvent) => {
      const msg = e.data;
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "COMPLETE" && msg.taskId) completeTask(msg.taskId);
      if (msg.type === "SNOOZE" && msg.taskId) snoozeTask(msg.taskId, msg.minutes ?? 10);
      if (msg.type === "OPEN" && msg.taskId) setSelectedId(msg.taskId);
    };
    const armMidnight = () => {
      const n = new Date();
      const next = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 2);
      return window.setTimeout(() => {
        restoreAlarms();
        midnightTimer = armMidnight();
      }, Math.max(1_000, next.getTime() - n.getTime()));
    };
    let midnightTimer = armMidnight();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", checkClock);
    window.addEventListener("sandeshdo:open-task", onOpen);
    window.addEventListener("sandeshdo:select-task", onOpen);
    window.addEventListener("sandeshdo:snooze-task", onSnooze);
    window.addEventListener("sandeshdo:quick-add", onQuick);
    window.addEventListener("sandeshdo:money-add", onMoney);
    const onAssist = () => setAssistantOpen(true);
    window.addEventListener("sandeshdo:assistant", onAssist);
    const onNative = () => {
      void applyWorkerActions();
      restoreAlarms();
    };
    window.addEventListener("sandeshdo:native-resume", onNative);
    navigator.serviceWorker?.addEventListener("message", onSw);
    const watchdog = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        useApp.getState().processDueReminders();
      }
    }, 10_000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", checkClock);
      window.removeEventListener("sandeshdo:open-task", onOpen);
      window.removeEventListener("sandeshdo:select-task", onOpen);
      window.removeEventListener("sandeshdo:snooze-task", onSnooze);
      window.removeEventListener("sandeshdo:quick-add", onQuick);
      window.removeEventListener("sandeshdo:money-add", onMoney);
      window.removeEventListener("sandeshdo:assistant", onAssist);
      window.removeEventListener("sandeshdo:native-resume", onNative);
      navigator.serviceWorker?.removeEventListener("message", onSw);
      window.clearTimeout(midnightTimer);
      window.clearInterval(watchdog);
    };
  }, [hydrated, restoreAlarms, tickFocus, applyWorkerActions, completeTask, snoozeTask]);

  useEffect(() => {
    if (!hydrated || !focusRunning || focusEndsAt == null) return;
    const delay = Math.max(0, Math.min(focusEndsAt - Date.now() + 40, 30_000));
    const id = window.setTimeout(() => tickFocus(), delay);
    return () => window.clearTimeout(id);
  }, [hydrated, focusRunning, focusEndsAt, tickFocus]);

  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams(search);
    const text = params.get("add") ?? params.get("text") ?? params.get("title");
    if (text) {
      setPrefill(text);
      setQuickOpen(true);
    }
    if (params.get("new") === "1") setQuickOpen(true);
    const taskId = params.get("task");
    if (taskId) setSelectedId(taskId);
  }, [hydrated, search]);

  useEffect(() => {
    window.__sdOnBack = () => {
      if ((window.__sdSheetCount ?? 0) > 0) {
        window.dispatchEvent(new Event("sandeshdo:sheet-back"));
        return true;
      }
      const s = useApp.getState();
      if (s.lastFinish) {
        s.dismissFinish();
        return true;
      }
      if (s.activeReminderTaskId) {
        s.dismissReminder();
        return true;
      }
      return false;
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuickOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.__sdOnBack = undefined;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const openPlus = () => {
    if (pathname.startsWith("/money")) {
      setMoneyType("expense");
      setMoneyAmount("");
      setMoneyOpen(true);
      return;
    }
    setPrefill("");
    setPrefillDate("");
    setPrefillWhen(pathname === "/" ? "today" : "");
    setQuickOpen(true);
  };

  return (
    <div className="min-h-dvh bg-bg text-fg" suppressHydrationWarning>
      <Splash />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col lg:border-x lg:border-border">
        <div className="flex-1 pb-28 pt-[env(safe-area-inset-top)]">{children}</div>
        <nav className="pointer-events-none fixed bottom-0 left-1/2 z-30 w-full max-w-xl -translate-x-1/2 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="sd-dock pointer-events-auto grid grid-cols-3 items-end rounded-xl px-1.5 py-1.5">
            <DockLink item={nav[0]} active={nav[0].match(pathname)} />
            <button
              type="button"
              aria-label={pathname.startsWith("/money") ? t("nav.addMoney") : t("nav.addTask")}
              onClick={openPlus}
              className="mx-auto -mt-5 mb-0.5 flex size-14 items-center justify-center rounded-full bg-primary text-primary-fg shadow-[var(--sd-dock-shadow)] transition-transform duration-150 ease-out active:scale-95"
            >
              <Plus className="size-7" strokeWidth={2.2} />
            </button>
            <DockLink item={nav[1]} active={nav[1].match(pathname)} />
          </div>
        </nav>
      </div>
      <QuickAdd
        open={quickOpen}
        prefill={prefill}
        prefillDate={prefillDate}
        prefillWhen={prefillWhen}
        onClose={() => {
          setQuickOpen(false);
          setPrefill("");
          setPrefillDate("");
          setPrefillWhen("");
        }}
      />
      <MoneySheet
        open={moneyOpen}
        initialType={moneyType}
        initialAmount={moneyAmount}
        onClose={() => setMoneyOpen(false)}
      />
      {selectedId && (
        <TaskDetail
          taskId={selectedId}
          onClose={() => setSelectedId(null)}
          onSnooze={(id) => {
            setSelectedId(null);
            setSnoozeId(id);
          }}
        />
      )}
      <SnoozeSheet taskId={snoozeId} onClose={() => setSnoozeId(null)} />
      <Assistant open={assistantOpen} onClose={() => setAssistantOpen(false)} />
      <ReminderScreen />
      <FinishScreen />
      <JuiceLayer />
      <Toaster
        position="top-center"
        toastOptions={{
          className: "bg-elevated text-fg border-border shadow-[var(--sd-card-shadow)]",
        }}
      />
    </div>
  );
}

function DockLink({
  item,
  active,
}: {
  item: { to: string; label: string; icon: typeof ListTodo; match: (p: string) => boolean };
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={cn(
        "flex h-12 flex-col items-center justify-center gap-0.5 rounded-2xl text-micro font-semibold tracking-wide whitespace-nowrap transition-colors duration-150",
        active ? "text-primary" : "text-muted",
      )}
    >
      <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
      {item.label}
    </Link>
  );
}
