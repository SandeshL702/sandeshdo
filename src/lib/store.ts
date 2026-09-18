import { create } from "zustand";
import { persist } from "zustand/middleware";
import { addMinutes, setHours, setMinutes, startOfDay } from "date-fns";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS,
  PRIORITY_RANK,
  type Budget,
  type Category,
  type Completion,
  type FinishEvent,
  type FocusState,
  type GameProgress,
  type MoneyCatKind,
  type MoneyCategory,
  type Note,
  type NoteColor,
  type Plan,
  type Priority,
  type RecurrenceRule,
  type Reminder,
  type Settings,
  type Subtask,
  type Task,
  type TaskStatus,
  type Transaction,
  type VaultItem,
  type VaultKind,
} from "./types";
import { uid } from "./utils";
import { dayKey, dayHeading, tomorrowMorning } from "./time";
import { canRecur, nextFutureOccurrence } from "./recurrence";
import { liveStatus, rebuildReminders } from "./engine";
import { notifyFocus, notifySummary, notifyTask, playGentleTone, pulseVibrate, syncScheduledAlarms } from "./notifications";
import { takePendingActions } from "./alarms";
import {
  applyFinish,
  applyOverdueDamage,
  applySpendXp,
  awardQuests,
  dailyQuests,
  DEFAULT_GAME,
  levelFromXp,
  rankFromLevel,
  spendHeal as buyHeal,
  spendRevive as buyRevive,
} from "./game";
import { playCompleteSfx, playDamageSfx, playHealSfx, playLevelUpSfx } from "./sfx";
import { persistBackup, serializeBackup, tryNativeRestore } from "./backup";
import { DEFAULT_BUDGETS, DEFAULT_MONEY_CATEGORIES, ensureIncomeCats } from "./money";

export interface DraftTask {
  title: string;
  description?: string;
  notes?: string;
  categoryId?: string | null;
  priority?: Priority;
  dueAt?: number | null;
  deadline?: number | null;
  estimatedDuration?: number | null;
  recurrence?: RecurrenceRule | null;
  reminderEnabled?: boolean;
  reminderOffsets?: number[];
}

export interface AppState {
  hydrated: boolean;
  tasks: Task[];
  subtasks: Subtask[];
  categories: Category[];
  completions: Completion[];
  reminders: Reminder[];
  transactions: Transaction[];
  budgets: Budget[];
  moneyCategories: MoneyCategory[];
  notes: Note[];
  plans: Plan[];
  vault: VaultItem[];
  vaultUnlocked: boolean;
  game: GameProgress;
  settings: Settings;
  focus: FocusState;
  activeReminderTaskId: string | null;
  lastFinish: FinishEvent | null;
  summaryBanner: { kind: "morning" | "evening"; title: string; body: string } | null;

  finishHydration: () => void;
  seedIfNeeded: () => void;
  addTask: (draft: DraftTask) => string;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  completeTask: (id: string) => void;
  reopenTask: (id: string) => void;
  snoozeTask: (id: string, minutes: number) => void;
  rescheduleTask: (id: string, dueAt: number) => void;
  addSubtask: (taskId: string, title: string) => void;
  toggleSubtask: (id: string) => void;
  deleteSubtask: (id: string) => void;
  addCategory: (name: string) => string;
  deleteCategory: (id: string) => void;
  addMoneyCategory: (name: string, kind: MoneyCatKind) => void;
  renameMoneyCategory: (id: string, name: string) => void;
  setMoneyCatKind: (id: string, kind: MoneyCatKind) => void;
  deleteMoneyCategory: (id: string) => void;
  addTx: (draft: Omit<Transaction, "id">) => string;
  deleteTx: (id: string) => void;
  setBudget: (category: string, limit: number) => void;
  addNote: (draft: { title: string; body: string; color?: NoteColor }) => string;
  updateNote: (id: string, patch: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  addPlan: (draft: { title: string; note?: string; when?: number | null; cost?: number | null }) => string;
  updatePlan: (id: string, patch: Partial<Plan>) => void;
  deletePlan: (id: string) => void;
  addVaultItem: (draft: { kind: VaultKind; label: string; secret: string }) => string;
  updateVaultItem: (id: string, patch: Partial<VaultItem>) => void;
  deleteVaultItem: (id: string) => void;
  unlockVault: () => void;
  lockVault: () => void;
  spendHeal: () => boolean;
  spendRevive: () => boolean;
  patchSettings: (patch: Partial<Settings>) => void;
  startFocus: (taskId: string | null, durationMin: number, mode?: FocusState["mode"]) => void;
  pauseFocus: () => void;
  resumeFocus: () => void;
  stopFocus: () => void;
  completeFocus: () => void;
  extendFocus: (minutes: number) => void;
  tickFocus: (now?: number) => void;
  dismissReminder: () => void;
  dismissFinish: () => void;
  previewReminder: (taskId?: string) => void;
  previewFinish: (taskId?: string) => void;
  dismissSummary: () => void;
  processDueReminders: (now?: number, opts?: { popup?: boolean }) => void;
  restoreAlarms: () => void;
  applyWorkerActions: () => Promise<void>;
  importAll: (data: {
    tasks: Task[];
    subtasks: Subtask[];
    categories: Category[];
    completions: Completion[];
    reminders: Reminder[];
    settings: Settings;
    transactions?: Transaction[];
    budgets?: Budget[];
    moneyCategories?: MoneyCategory[];
    game?: GameProgress;
    notes?: Note[];
    plans?: Plan[];
    vault?: VaultItem[];
  }) => void;
  resetDemo: () => void;
}

const DEFAULT_FOCUS: FocusState = {
  taskId: null,
  running: false,
  mode: "task",
  durationMs: 25 * 60_000,
  remainingMs: 25 * 60_000,
  endsAt: null,
  pomodoroPreset: "25/5",
  customWorkMin: 25,
  customBreakMin: 5,
};

function makeTask(draft: DraftTask): Task {
  const now = Date.now();
  const dueAt = draft.dueAt ?? null;
  const status: TaskStatus = dueAt == null ? "inbox" : dueAt <= now ? "overdue" : "scheduled";
  return {
    id: uid(),
    title: draft.title.trim(),
    description: draft.description?.trim() ?? "",
    notes: draft.notes?.trim() ?? "",
    categoryId: draft.categoryId ?? null,
    priority: draft.priority ?? "medium",
    status,
    createdAt: now,
    updatedAt: now,
    dueAt,
    deadline: draft.deadline ?? null,
    completedAt: null,
    estimatedDuration: draft.estimatedDuration ?? null,
    recurrence: draft.recurrence ?? null,
    reminderEnabled: draft.reminderEnabled ?? true,
    reminderOffsets: draft.reminderOffsets ?? [0],
    reminderCount: 0,
    reminderDayKey: null,
    snoozeCount: 0,
    rescheduleCount: 0,
    overdueCount: 0,
    lastReminderAt: null,
    lastSnoozeDuration: null,
    snoozeHistory: [],
    snoozedUntil: null,
  };
}

function refreshStatuses(tasks: Task[], now: number): Task[] {
  return tasks.map((t) => {
    const status = liveStatus(t, now);
    if (status === t.status) return t;
    const overdueCount = status === "overdue" && t.status !== "overdue" ? t.overdueCount + 1 : t.overdueCount;
    return { ...t, status, overdueCount, updatedAt: now };
  });
}

function atToday(hour: number, minute: number, now = Date.now()): number {
  const d = setMinutes(setHours(new Date(now), hour), minute);
  return d.getTime();
}

function demoTasks(now = Date.now()): Task[] {
  const bill = makeTask({
    title: "Pay electricity bill",
    dueAt: now - 42 * 60_000,
    priority: "high",
    categoryId: "finance",
  });
  bill.overdueCount = 1;
  bill.status = "overdue";
  bill.lastReminderAt = now - 3 * 60_000;
  bill.reminderCount = 1;
  bill.reminderDayKey = dayKey(now);

  const callHour = new Date(now).getHours() >= 19 ? 20 : 19;
  const call = makeTask({
    title: "Call client",
    dueAt: atToday(callHour, 0, now) > now ? atToday(callHour, 0, now) : now + 90 * 60_000,
    priority: "medium",
    categoryId: "work",
  });

  const study = makeTask({
    title: "Study Python",
    dueAt: atToday(21, 0, now) > now + 60_000 ? atToday(21, 0, now) : now + 3 * 60 * 60_000,
    priority: "low",
    categoryId: "study",
    estimatedDuration: 45,
    recurrence: { kind: "daily", occurrencesDone: 0 },
  });

  const report = makeTask({
    title: "Submit report",
    dueAt: tomorrowMorning(now, 10, 0),
    priority: "high",
    categoryId: "work",
    reminderOffsets: [-30, 0, 30],
  });

  const walk = makeTask({
    title: "Morning walk",
    dueAt: startOfDay(now).getTime() + 7 * 60 * 60_000,
    priority: "medium",
    categoryId: "health",
    estimatedDuration: 25,
    recurrence: { kind: "weekdays", days: [1, 2, 3, 4, 5], occurrencesDone: 2 },
  });
  if ((walk.dueAt ?? 0) < now - 2 * 60 * 60_000 && walk.recurrence) {
    const next = nextFutureOccurrence(walk.dueAt ?? now, walk.recurrence, now);
    if (next) {
      walk.dueAt = next;
      walk.status = next <= now ? "overdue" : "scheduled";
      walk.completedAt = null;
    } else {
      walk.status = "completed";
      walk.completedAt = startOfDay(now).getTime() + 7.4 * 60 * 60_000;
    }
  }

  const water = makeTask({
    title: "Water plants",
    dueAt: startOfDay(now).getTime() + 8 * 60 * 60_000,
    priority: "low",
    categoryId: "personal",
  });
  water.id = "seed-water";
  water.status = "completed";
  water.completedAt = startOfDay(now).getTime() + 8.2 * 60 * 60_000;
  if ((water.completedAt ?? 0) > now) water.completedAt = now - 90 * 60_000;

  return [bill, call, study, report, walk, water];
}

function demoSubtasks(tasks: Task[]): Subtask[] {
  const report = tasks.find((t) => t.title === "Submit report");
  if (!report) return [];
  return [
    { id: uid(), taskId: report.id, title: "Collect data", isCompleted: true, position: 0 },
    { id: uid(), taskId: report.id, title: "Prepare report", isCompleted: false, position: 1 },
    { id: uid(), taskId: report.id, title: "Review", isCompleted: false, position: 2 },
    { id: uid(), taskId: report.id, title: "Send", isCompleted: false, position: 3 },
  ];
}

function demoCompletions(now = Date.now()): Completion[] {
  const morning = startOfDay(now).getTime() + 8.2 * 60 * 60_000;
  const yesterday = startOfDay(now).getTime() - 5 * 60 * 60_000;
  const lastWeek = startOfDay(now).getTime() - 4 * 24 * 60 * 60_000;
  return [
    { id: uid(), taskId: "seed-water", title: "Water plants", completedAt: morning < now ? morning : now - 90 * 60_000, duration: 8 },
    { id: uid(), taskId: "seed-landlord", title: "Reply to landlord", completedAt: yesterday, duration: 12 },
    { id: uid(), taskId: "seed-bottles", title: "Fill water bottles", completedAt: yesterday - 70 * 60_000, duration: 5 },
    { id: uid(), taskId: "seed-rent", title: "File rent receipt", completedAt: lastWeek, duration: 10 },
  ];
}

function demoTransactions(now: number): Transaction[] {
  return [
    { id: uid(), type: "income", amount: 45000, category: "salary", note: "Salary", at: now - 4 * 24 * 60 * 60_000, account: "bank" },
    { id: uid(), type: "expense", amount: 250, category: "food", note: "Lunch", at: now - 3 * 60 * 60_000, account: "cash" },
    { id: uid(), type: "expense", amount: 80, category: "travel", note: "Metro", at: now - 6 * 60 * 60_000, account: "cash" },
    { id: uid(), type: "expense", amount: 1299, category: "bills", note: "Wifi", at: now - 2 * 24 * 60 * 60_000, account: "bank" },
  ];
}

function bumpReminderCount(task: Task, now: number): Task {
  const today = dayKey(now);
  const reminderCount = task.reminderDayKey === today ? task.reminderCount + 1 : 1;
  return { ...task, reminderCount, reminderDayKey: today, lastReminderAt: now, updatedAt: now };
}

function initialClientData() {
  const now = Date.now();
  return {
    tasks: [] as Task[],
    subtasks: [] as Subtask[],
    completions: [] as Completion[],
    reminders: rebuildReminders([], DEFAULT_SETTINGS, now, []),
    transactions: [] as Transaction[],
    budgets: DEFAULT_BUDGETS,
    moneyCategories: DEFAULT_MONEY_CATEGORIES,
    notes: [] as Note[],
    plans: [] as Plan[],
    vault: [] as VaultItem[],
    game: { ...DEFAULT_GAME },
    settings: {
      ...DEFAULT_SETTINGS,
      seededOnce: true,
      demoRev: 19,
      notifyRev: 19,
    },
  };
}

const BOOT = initialClientData();
let schedulerTimer: number | null = null;
let backupTimer: number | null = null;

function queueBackup(): void {
  if (typeof window === "undefined") return;
  if (backupTimer != null) window.clearTimeout(backupTimer);
  backupTimer = window.setTimeout(() => {
    try {
      const json = serializeBackup(useApp.getState());
      persistBackup(json);
      useApp.setState((s) => ({
        settings: { ...s.settings, lastBackupDay: dayKey(), lastBackupAt: Date.now() },
      }));
    } catch {
      /* backup is best-effort */
    }
  }, 1200);
}

function pushAlarms(): void {
  const { reminders, tasks, settings } = useApp.getState();
  void syncScheduledAlarms(reminders, tasks, settings);
}

function questState(s: { tasks: Task[]; completions: Completion[]; transactions: Transaction[] }, now: number) {
  return dailyQuests({
    finishedToday: s.completions.filter((c) => dayKey(c.completedAt) === dayKey(now)).length,
    overdue: s.tasks.filter((t) => t.status !== "completed" && liveStatus(t, now) === "overdue").length,
    moneyToday: s.transactions.filter((tx) => dayKey(tx.at) === dayKey(now)).length,
  });
}

export function armScheduler(): void {
  if (typeof window === "undefined") return;
  if (schedulerTimer != null) {
    window.clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }
  const { reminders, processDueReminders } = useApp.getState();
  const now = Date.now();
  const next = reminders.find((r) => r.status === "pending" && r.triggerAt >= now) ?? reminders.find((r) => r.status === "pending");
  const delay = next ? Math.max(0, Math.min(next.triggerAt - now, 15 * 60_000)) : 15 * 60_000;
  schedulerTimer = window.setTimeout(() => {
    processDueReminders();
    armScheduler();
  }, delay);
  pushAlarms();
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: true,
      tasks: BOOT.tasks,
      subtasks: BOOT.subtasks,
      categories: DEFAULT_CATEGORIES,
      completions: BOOT.completions,
      reminders: BOOT.reminders,
      transactions: BOOT.transactions,
      budgets: BOOT.budgets,
      moneyCategories: DEFAULT_MONEY_CATEGORIES,
      notes: BOOT.notes,
      plans: BOOT.plans,
      vault: BOOT.vault,
      vaultUnlocked: false,
      game: BOOT.game,
      settings: BOOT.settings,
      focus: DEFAULT_FOCUS,
      activeReminderTaskId: null,
      lastFinish: null,
      summaryBanner: null,

      finishHydration: () => {
        let restored = false;
        try {
          const had = localStorage.getItem("sandeshdo-v2");
          if (!had) {
            const data = tryNativeRestore();
            if (data) {
              get().importAll(data);
              restored = true;
            }
          }
        } catch {
          /* optional */
        }
        set({ hydrated: true });
        if (!get().categories.length) set({ categories: DEFAULT_CATEGORIES });
        if (!get().moneyCategories.length) set({ moneyCategories: DEFAULT_MONEY_CATEGORIES });
        else set({ moneyCategories: ensureIncomeCats(get().moneyCategories) });
        if (!restored) get().seedIfNeeded();
        void get().applyWorkerActions();
        get().restoreAlarms();
      },

      seedIfNeeded: () => {
        const { settings } = get();
        if (settings.seededOnce) return;
        set({
          settings: {
            ...settings,
            seededOnce: true,
            demoRev: 19,
            notifyRev: 19,
            notificationsEnabled: true,
          },
        });
      },

      addTask: (draft) => {
        const task = makeTask({
          ...draft,
          reminderOffsets: draft.reminderOffsets ?? get().settings.defaultReminderOffsets,
        });
        const now = Date.now();
        set((s) => {
          const tasks = refreshStatuses([task, ...s.tasks], now);
          return { tasks, reminders: rebuildReminders(tasks, s.settings, now, s.transactions) };
        });
        armScheduler();
        queueBackup();
        return task.id;
      },

      updateTask: (id, patch) => {
        const now = Date.now();
        set((s) => {
          const tasks = refreshStatuses(
            s.tasks.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: now } : t)),
            now,
          );
          return { tasks, reminders: rebuildReminders(tasks, s.settings, now, s.transactions) };
        });
        armScheduler();
      },

      deleteTask: (id) => {
        const now = Date.now();
        set((s) => {
          const tasks = s.tasks.filter((t) => t.id !== id);
          return {
            tasks,
            subtasks: s.subtasks.filter((st) => st.taskId !== id),
            reminders: rebuildReminders(tasks, s.settings, now, s.transactions),
            activeReminderTaskId: s.activeReminderTaskId === id ? null : s.activeReminderTaskId,
            focus: s.focus.taskId === id ? DEFAULT_FOCUS : s.focus,
          };
        });
        armScheduler();
      },

      completeTask: (id) => {
        const now = Date.now();
        set((s) => {
          const current = s.tasks.find((t) => t.id === id);
          if (!current || current.status === "completed") return s;
          const completion: Completion = {
            id: uid(),
            taskId: id,
            title: current.title,
            completedAt: now,
            duration: current.estimatedDuration,
          };
          let rolled = false;
          let tasks: Task[];
          if (canRecur(current) && current.dueAt && current.recurrence) {
            const next = nextFutureOccurrence(current.dueAt, current.recurrence, now);
            if (next) {
              rolled = true;
              const rec = {
                ...current.recurrence,
                occurrencesDone: (current.recurrence.occurrencesDone ?? 0) + 1,
              };
              const nextTask: Task = {
                ...current,
                dueAt: next,
                snoozedUntil: null,
                completedAt: null,
                status: next <= now ? "overdue" : "scheduled",
                recurrence: rec,
                reminderCount: 0,
                lastReminderAt: null,
                updatedAt: now,
              };
              tasks = s.tasks.map((t) => (t.id === id ? nextTask : t));
            } else {
              tasks = s.tasks.map((t) =>
                t.id === id ? { ...t, status: "completed" as const, completedAt: now, snoozedUntil: null, updatedAt: now } : t,
              );
            }
          } else {
            tasks = s.tasks.map((t) =>
              t.id === id ? { ...t, status: "completed" as const, completedAt: now, snoozedUntil: null, updatedAt: now } : t,
            );
          }
          tasks = refreshStatuses(tasks, now);
          const completions = [completion, ...s.completions];
          const todayCount = completions.filter((c) => dayKey(c.completedAt) === dayKey(now)).length;
          const nextUp = pickNextUp(tasks, now, id);
          const award = applyFinish(s.game, current.priority, now);
          const game = awardQuests(
            award.game,
            dailyQuests({
              finishedToday: todayCount,
              overdue: tasks.filter((t) => liveStatus(t, now) === "overdue").length,
              moneyToday: s.transactions.filter((tx) => dayKey(tx.at) === dayKey(now)).length,
            }),
            now,
          );
          return {
            tasks,
            completions,
            game,
            reminders: rebuildReminders(tasks, s.settings, now, s.transactions),
            activeReminderTaskId: s.activeReminderTaskId === id ? null : s.activeReminderTaskId,
            lastFinish: {
              taskId: id,
              title: current.title,
              completedAt: now,
              todayCount,
              nextId: nextUp?.id ?? null,
              nextTitle: nextUp?.title ?? null,
              recurring: rolled,
              xpGain: award.xpGain,
              coinGain: award.coinGain,
              combo: award.combo,
              hpGain: award.hpGain,
              level: award.level,
              rank: award.rank,
              streak: award.game.streak,
              levelUp: award.levelUp,
            },
          };
        });
        const settings = get().settings;
        const finish = get().lastFinish;
        if (finish?.levelUp) playLevelUpSfx();
        else playCompleteSfx(finish?.combo ?? 1);
        if (settings.notifyTone === "gentle" && !finish?.levelUp) playGentleTone();
        pulseVibrate(settings.notifyVibrate);
        armScheduler();
        queueBackup();
      },

      reopenTask: (id) => {
        const now = Date.now();
        set((s) => {
          const tasks = refreshStatuses(
            s.tasks.map((t) =>
              t.id === id ? { ...t, status: "scheduled", completedAt: null, updatedAt: now } : t,
            ),
            now,
          );
          return { tasks, reminders: rebuildReminders(tasks, s.settings, now, s.transactions) };
        });
        armScheduler();
      },

      snoozeTask: (id, minutes) => {
        const now = Date.now();
        const until = minutes < 0 ? tomorrowMorning(now, 9, 0) : addMinutes(now, minutes).getTime();
        const stored = minutes < 0 ? 24 * 60 : minutes;
        set((s) => {
          const tasks = refreshStatuses(
            s.tasks.map((t) =>
              t.id === id
                ? {
                    ...t,
                    snoozedUntil: until,
                    dueAt: t.dueAt ?? until,
                    snoozeCount: t.snoozeCount + 1,
                    lastSnoozeDuration: stored,
                    snoozeHistory: [...t.snoozeHistory, stored].slice(-8),
                    updatedAt: now,
                  }
                : t,
            ),
            now,
          );
          return {
            tasks,
            reminders: rebuildReminders(tasks, s.settings, now, s.transactions),
            activeReminderTaskId: s.activeReminderTaskId === id ? null : s.activeReminderTaskId,
          };
        });
        armScheduler();
      },

      rescheduleTask: (id, dueAt) => {
        const now = Date.now();
        set((s) => {
          const tasks = refreshStatuses(
            s.tasks.map((t) =>
              t.id === id
                ? {
                    ...t,
                    dueAt,
                    snoozedUntil: null,
                    rescheduleCount: t.rescheduleCount + 1,
                    updatedAt: now,
                  }
                : t,
            ),
            now,
          );
          return {
            tasks,
            reminders: rebuildReminders(tasks, s.settings, now, s.transactions),
            activeReminderTaskId: s.activeReminderTaskId === id ? null : s.activeReminderTaskId,
          };
        });
        armScheduler();
      },

      addSubtask: (taskId, title) => {
        const trimmed = title.trim();
        if (!trimmed) return;
        set((s) => {
          const pos = s.subtasks.filter((st) => st.taskId === taskId).length;
          return {
            subtasks: [...s.subtasks, { id: uid(), taskId, title: trimmed, isCompleted: false, position: pos }],
          };
        });
      },

      toggleSubtask: (id) => {
        set((s) => {
          const subtasks = s.subtasks.map((st) =>
            st.id === id ? { ...st, isCompleted: !st.isCompleted } : st,
          );
          const target = subtasks.find((st) => st.id === id);
          if (target && s.settings.autoCompleteOnSubtasks) {
            const siblings = subtasks.filter((st) => st.taskId === target.taskId);
            if (siblings.length && siblings.every((st) => st.isCompleted)) {
              queueMicrotask(() => get().completeTask(target.taskId));
            }
          }
          return { subtasks };
        });
      },

      deleteSubtask: (id) => {
        set((s) => ({ subtasks: s.subtasks.filter((st) => st.id !== id) }));
      },

      addCategory: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return "";
        const id = uid();
        set((s) => ({
          categories: [...s.categories, { id, name: trimmed, icon: "tag" }],
        }));
        return id;
      },

      deleteCategory: (id) => {
        set((s) => ({
          categories: s.categories.filter((c) => c.id !== id),
          tasks: s.tasks.map((t) => (t.categoryId === id ? { ...t, categoryId: null } : t)),
        }));
      },

      addMoneyCategory: (name, kind) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => {
          if (s.moneyCategories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) return s;
          return { moneyCategories: [...s.moneyCategories, { id: uid(), name: trimmed, kind }] };
        });
        queueBackup();
      },

      renameMoneyCategory: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => ({
          moneyCategories: s.moneyCategories.map((c) => (c.id === id ? { ...c, name: trimmed } : c)),
        }));
        queueBackup();
      },

      setMoneyCatKind: (id, kind) => {
        set((s) => ({
          moneyCategories: s.moneyCategories.map((c) => (c.id === id ? { ...c, kind } : c)),
        }));
        queueBackup();
      },

      deleteMoneyCategory: (id) => {
        set((s) => {
          if (s.moneyCategories.length <= 1) return s;
          const rest = s.moneyCategories.filter((c) => c.id !== id);
          const fallback = rest.find((c) => c.id === "other") ?? rest.find((c) => c.kind === "both") ?? rest[0];
          return {
            moneyCategories: rest,
            transactions: s.transactions.map((tx) => (tx.category === id ? { ...tx, category: fallback.id } : tx)),
            budgets: s.budgets.filter((b) => b.category !== id),
          };
        });
        queueBackup();
      },

      addTx: (draft) => {
        const tx: Transaction = { ...draft, id: uid(), amount: Math.abs(draft.amount) };
        const now = Date.now();
        set((s) => {
          const transactions = [tx, ...s.transactions];
          const game = awardQuests(applySpendXp(s.game, now), questState({ ...s, transactions }, now), now);
          return {
            transactions,
            game,
            reminders: rebuildReminders(s.tasks, s.settings, now, transactions),
            activeReminderTaskId: s.activeReminderTaskId === "paisa" ? null : s.activeReminderTaskId,
          };
        });
        armScheduler();
        queueBackup();
        return tx.id;
      },

      deleteTx: (id) => {
        set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }));
        queueBackup();
      },

      setBudget: (category, limit) => {
        set((s) => {
          const rest = s.budgets.filter((b) => b.category !== category);
          const next = limit > 0 ? [...rest, { category, limit }] : rest;
          return { budgets: next };
        });
      },

      addNote: (draft) => {
        const now = Date.now();
        const note: Note = {
          id: uid(),
          title: draft.title.trim() || "Note",
          body: draft.body.trim(),
          color: draft.color ?? "paper",
          pinned: false,
          updatedAt: now,
        };
        set((s) => ({ notes: [note, ...s.notes] }));
        queueBackup();
        return note.id;
      },
      updateNote: (id, patch) => {
        set((s) => ({
          notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)),
        }));
        queueBackup();
      },
      deleteNote: (id) => {
        set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
        queueBackup();
      },
      addPlan: (draft) => {
        const plan: Plan = {
          id: uid(),
          title: draft.title.trim(),
          note: draft.note?.trim() ?? "",
          when: draft.when ?? null,
          cost: draft.cost ?? null,
          done: false,
          createdAt: Date.now(),
        };
        if (!plan.title) return "";
        set((s) => ({ plans: [plan, ...s.plans] }));
        queueBackup();
        return plan.id;
      },
      updatePlan: (id, patch) => {
        set((s) => ({ plans: s.plans.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
        queueBackup();
      },
      deletePlan: (id) => {
        set((s) => ({ plans: s.plans.filter((p) => p.id !== id) }));
        queueBackup();
      },
      addVaultItem: (draft) => {
        const item: VaultItem = {
          id: uid(),
          kind: draft.kind,
          label: draft.label.trim(),
          secret: draft.secret,
          updatedAt: Date.now(),
        };
        if (!item.label) return "";
        set((s) => ({ vault: [item, ...s.vault] }));
        queueBackup();
        return item.id;
      },
      updateVaultItem: (id, patch) => {
        set((s) => ({
          vault: s.vault.map((v) => (v.id === id ? { ...v, ...patch, updatedAt: Date.now() } : v)),
        }));
        queueBackup();
      },
      deleteVaultItem: (id) => {
        set((s) => ({ vault: s.vault.filter((v) => v.id !== id) }));
        queueBackup();
      },
      unlockVault: () => set({ vaultUnlocked: true }),
      lockVault: () => set({ vaultUnlocked: false }),

      spendHeal: () => {
        const next = buyHeal(get().game);
        if (!next) return false;
        set({ game: next });
        playHealSfx();
        return true;
      },

      spendRevive: () => {
        const next = buyRevive(get().game);
        if (!next) return false;
        set({ game: next });
        playHealSfx();
        return true;
      },

      patchSettings: (patch) => {
        const now = Date.now();
        set((s) => {
          const settings = { ...s.settings, ...patch };
          return { settings, reminders: rebuildReminders(s.tasks, settings, now, s.transactions) };
        });
        armScheduler();
      },

      startFocus: (taskId, durationMin, mode = "task") => {
        const durationMs = Math.max(1, durationMin) * 60_000;
        const now = Date.now();
        set({
          focus: {
            ...get().focus,
            taskId,
            running: true,
            mode,
            durationMs,
            remainingMs: durationMs,
            endsAt: now + durationMs,
          },
        });
      },

      pauseFocus: () => {
        const { focus } = get();
        if (!focus.running || focus.endsAt == null) return;
        const remainingMs = Math.max(0, focus.endsAt - Date.now());
        set({ focus: { ...focus, running: false, remainingMs, endsAt: null } });
      },

      resumeFocus: () => {
        const { focus } = get();
        if (focus.running) return;
        set({
          focus: {
            ...focus,
            running: true,
            endsAt: Date.now() + focus.remainingMs,
          },
        });
      },

      stopFocus: () =>
        set({
          focus: {
            ...get().focus,
            ...DEFAULT_FOCUS,
            pomodoroPreset: get().focus.pomodoroPreset,
            customWorkMin: get().focus.customWorkMin,
            customBreakMin: get().focus.customBreakMin,
          },
        }),

      completeFocus: () => {
        const { focus, completeTask } = get();
        if (focus.taskId) completeTask(focus.taskId);
        get().stopFocus();
      },

      extendFocus: (minutes) => {
        const { focus } = get();
        const extra = minutes * 60_000;
        if (focus.running && focus.endsAt) {
          set({
            focus: {
              ...focus,
              durationMs: focus.durationMs + extra,
              endsAt: focus.endsAt + extra,
              remainingMs: focus.remainingMs + extra,
            },
          });
        } else {
          set({
            focus: {
              ...focus,
              durationMs: focus.durationMs + extra,
              remainingMs: focus.remainingMs + extra,
            },
          });
        }
      },

      tickFocus: (now = Date.now()) => {
        const { focus } = get();
        if (!focus.running || focus.endsAt == null) return;
        const remainingMs = focus.endsAt - now;
        if (remainingMs > 0) {
          if (Math.abs(remainingMs - focus.remainingMs) > 400) {
            set({ focus: { ...focus, remainingMs } });
          }
          return;
        }
        const task = get().tasks.find((t) => t.id === focus.taskId);
        const tone = get().settings;
        if (focus.mode === "pomodoro-work") {
          const breakMin =
            focus.pomodoroPreset === "50/10" ? 10 : focus.pomodoroPreset === "custom" ? focus.customBreakMin : 5;
          notifyFocus("Time complete", task ? `${task.title} · take a short break` : "Work block finished", tone);
          get().startFocus(focus.taskId, breakMin, "pomodoro-break");
          return;
        }
        if (focus.mode === "pomodoro-break") {
          const workMin =
            focus.pomodoroPreset === "50/10" ? 50 : focus.pomodoroPreset === "custom" ? focus.customWorkMin : 25;
          notifyFocus("Break over", "Ready for the next block", tone);
          set({
            focus: {
              ...focus,
              running: false,
              remainingMs: workMin * 60_000,
              durationMs: workMin * 60_000,
              endsAt: null,
              mode: "pomodoro-work",
            },
          });
          return;
        }
        notifyFocus("Time complete", task ? task.title : "Focus session finished", tone);
        set({
          focus: { ...focus, running: false, remainingMs: 0, endsAt: null },
        });
      },

      dismissReminder: () => set({ activeReminderTaskId: null }),
      dismissFinish: () => set({ lastFinish: null }),
      previewReminder: (taskId) => {
        const s = get();
        const task =
          s.tasks.find((t) => t.id === taskId && t.status !== "completed") ??
          s.tasks.find((t) => t.status !== "completed");
        if (!task) return;
        set({ activeReminderTaskId: task.id, lastFinish: null });
        if (s.settings.notifyTone === "gentle") playGentleTone();
        pulseVibrate(s.settings.notifyVibrate);
      },
      previewFinish: (taskId) => {
        const s = get();
        const task = s.tasks.find((t) => t.id === taskId) ?? s.tasks[0];
        if (!task) return;
        const now = Date.now();
        const todayCount = Math.max(
          1,
          s.completions.filter((c) => dayKey(c.completedAt) === dayKey(now)).length,
        );
        const nextUp = pickNextUp(s.tasks, now, task.id);
        const level = levelFromXp(s.game.xp);
        set({
          lastFinish: {
            taskId: task.id,
            title: task.title,
            completedAt: now,
            todayCount,
            nextId: nextUp?.id ?? null,
            nextTitle: nextUp?.title ?? null,
            recurring: false,
            xpGain: 28,
            coinGain: 9,
            combo: Math.max(1, s.game.combo, 2),
            hpGain: 8,
            level,
            rank: rankFromLevel(level),
            streak: Math.max(1, s.game.streak),
            levelUp: false,
          },
          activeReminderTaskId: null,
        });
        playCompleteSfx(2);
        pulseVibrate(s.settings.notifyVibrate);
      },
      dismissSummary: () => set({ summaryBanner: null }),

      processDueReminders: (now = Date.now(), opts) => {
        const s = get();
        let tasks = refreshStatuses(s.tasks, now);
        const due = s.reminders.filter((r) => r.status === "pending" && r.triggerAt <= now);
        let activeReminderTaskId = s.activeReminderTaskId;
        const freshFired: Task[] = [];
        const settings = { ...s.settings };
        const today = dayKey(now);
        const FRESH_MS = 45_000;
        for (const rem of due) {
          const fresh = now - rem.triggerAt < FRESH_MS;
          if (rem.taskId === "paisa" || rem.type === "paisa") {
            if (s.transactions.some((tx) => dayKey(tx.at) === today)) continue;
            if (settings.lastPaisaNudgeOn === today) continue;
            const title = settings.locale === "en" ? "Log today's money" : "Aaj paisa likha?";
            const body = settings.locale === "en" ? "Got or spent — 10 seconds." : "Aaya ya Gaya — 10 second.";
            notifySummary(title, body, settings);
            settings.lastPaisaNudgeOn = today;
            if (opts?.popup !== false && fresh && !s.lastFinish) activeReminderTaskId = "paisa";
            continue;
          }
          const task = tasks.find((t) => t.id === rem.taskId);
          if (!task || task.status === "completed") continue;
          const overdue = liveStatus(task, now) === "overdue";
          const body = overdue ? `${formatOverdueBody(task.dueAt ?? rem.triggerAt, now)}` : "Due now";
          notifyTask(task, body, overdue, s.settings);
          tasks = tasks.map((t) => (t.id === task.id ? bumpReminderCount(t, now) : t));
          if (fresh) freshFired.push(task);
        }
        if (opts?.popup !== false && !s.lastFinish && freshFired.length && activeReminderTaskId !== "paisa") {
          const picked = [...freshFired].sort((a, b) => {
            const ao = liveStatus(a, now) === "overdue" ? 0 : 1;
            const bo = liveStatus(b, now) === "overdue" ? 0 : 1;
            if (ao !== bo) return ao - bo;
            return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
          })[0];
          if (picked) activeReminderTaskId = picked.id;
        }

        let summaryBanner = s.summaryBanner;
        const mins = new Date(now).getHours() * 60 + new Date(now).getMinutes();
        const [sh, sm] = settings.dailySummaryTime.split(":").map(Number);
        const [eh, em] = settings.endOfDaySummaryTime.split(":").map(Number);
        const morningAt = sh * 60 + sm;
        const eveningAt = eh * 60 + em;
        if (settings.dailySummary && settings.lastDailySummaryOn !== today) {
          if (mins >= morningAt && mins < morningAt + 180) {
            const open = tasks.filter((t) => t.status !== "completed");
            const overdue = open.filter((t) => t.status === "overdue");
            const next = open
              .filter((t) => t.dueAt && t.status !== "overdue")
              .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0))[0];
            const body = `Today: ${open.filter((t) => t.dueAt && dayKey(t.dueAt) === today).length} · Overdue: ${overdue.length}${next ? ` · Next: ${next.title}` : ""}`;
            summaryBanner = {
              kind: "morning",
              title: `Good morning, ${settings.userName}`,
              body,
            };
            if (settings.notificationsEnabled) notifySummary(`Good morning, ${settings.userName}`, body, settings);
            settings.lastDailySummaryOn = today;
          } else if (mins >= morningAt + 180) {
            settings.lastDailySummaryOn = today;
          }
        }
        if (settings.endOfDaySummary && settings.lastEndOfDayOn !== today) {
          if (mins >= eveningAt && mins < eveningAt + 180) {
            const completed = s.completions.filter((c) => dayKey(c.completedAt) === today).length;
            const remaining = tasks.filter((t) => t.status !== "completed" && t.dueAt && dayKey(t.dueAt) === today).length;
            const overdue = tasks.filter((t) => t.status === "overdue").length;
            const body = `Completed ${completed} · Remaining ${remaining} · Overdue ${overdue}`;
            summaryBanner = { kind: "evening", title: "Day summary", body };
            if (settings.notificationsEnabled) notifySummary("Day summary", body, settings);
            settings.lastEndOfDayOn = today;
          } else if (mins >= eveningAt + 180) {
            settings.lastEndOfDayOn = today;
          }
        }

        tasks = refreshStatuses(tasks, now);
        set({
          tasks,
          reminders: rebuildReminders(tasks, settings, now, s.transactions),
          settings,
          activeReminderTaskId,
          summaryBanner,
        });
      },

      restoreAlarms: () => {
        const now = Date.now();
        const before = get().game.hp;
        set((s) => {
          const tasks = refreshStatuses(s.tasks, now);
          const overdue = tasks.filter((t) => liveStatus(t, now) === "overdue").length;
          const damaged = applyOverdueDamage(s.game, overdue, now);
          const game = awardQuests(damaged, questState({ ...s, tasks }, now), now);
          return {
            tasks,
            reminders: rebuildReminders(tasks, s.settings, now, s.transactions),
            game,
          };
        });
        if (get().game.hp < before && typeof window !== "undefined" && window.__sdCuesArmed) playDamageSfx();
        get().processDueReminders(now, { popup: true });
        armScheduler();
      },

      applyWorkerActions: async () => {
        try {
          const actions = await takePendingActions();
          for (const action of actions) {
            if (action.type === "complete") get().completeTask(action.taskId);
            if (action.type === "snooze") get().snoozeTask(action.taskId, action.minutes ?? 10);
          }
        } catch {
          /* ignore */
        }
        try {
          const raw = window.SandeshDoHost?.takeActions?.();
          if (raw) {
            const rows = JSON.parse(raw) as Array<{ type: string; taskId: string; minutes?: number }>;
            for (const action of rows) {
              if (action.type === "complete") get().completeTask(action.taskId);
              if (action.type === "snooze") get().snoozeTask(action.taskId, action.minutes ?? 10);
            }
          }
        } catch {
          /* native bridge optional */
        }
      },

      importAll: (data) => {
        const now = Date.now();
        const tasks = refreshStatuses(data.tasks, now);
        set({
          tasks,
          subtasks: data.subtasks ?? [],
          categories: data.categories?.length ? data.categories : DEFAULT_CATEGORIES,
          completions: data.completions ?? [],
          settings: { ...DEFAULT_SETTINGS, ...data.settings, seededOnce: true },
          reminders: rebuildReminders(tasks, { ...DEFAULT_SETTINGS, ...data.settings }, now, data.transactions ?? []),
          transactions: data.transactions ?? [],
          budgets: data.budgets?.length ? data.budgets : DEFAULT_BUDGETS,
          moneyCategories: data.moneyCategories?.length ? data.moneyCategories : DEFAULT_MONEY_CATEGORIES,
          game: { ...DEFAULT_GAME, ...data.game },
          notes: data.notes ?? [],
          plans: data.plans ?? [],
          vault: data.vault ?? [],
          vaultUnlocked: false,
        });
        armScheduler();
        queueBackup();
      },

      resetDemo: () => {
        const tasks = demoTasks();
        const subtasks = demoSubtasks(tasks);
        const now = Date.now();
        const refreshed = refreshStatuses(tasks, now);
        set({
          tasks: refreshed,
          subtasks,
          completions: demoCompletions(now),
          categories: DEFAULT_CATEGORIES,
          reminders: rebuildReminders(refreshed, get().settings, now, get().transactions),
          transactions: demoTransactions(now),
          budgets: DEFAULT_BUDGETS,
          moneyCategories: DEFAULT_MONEY_CATEGORIES,
          game: { ...DEFAULT_GAME, streak: 2, lastActiveDay: dayKey(now) },
          settings: {
            ...DEFAULT_SETTINGS,
            seededOnce: true,
            demoRev: 19,
            notifyRev: 19,
            notificationsEnabled: true,
            theme: get().settings.theme,
            locale: get().settings.locale,
            geminiApiKey: get().settings.geminiApiKey,
            lastDailySummaryOn: dayKey(now),
            lastEndOfDayOn: dayKey(now),
          },
          focus: DEFAULT_FOCUS,
          activeReminderTaskId: null,
          lastFinish: null,
          summaryBanner: null,
        });
        armScheduler();
      },
    }),
    {
      name: "sandeshdo-v2",
      partialize: (s) => ({
        tasks: s.tasks,
        subtasks: s.subtasks,
        categories: s.categories,
        completions: s.completions,
        reminders: s.reminders,
        settings: s.settings,
        transactions: s.transactions,
        budgets: s.budgets,
        moneyCategories: s.moneyCategories,
        game: s.game,
        notes: s.notes,
        plans: s.plans,
        vault: s.vault,
        focus: s.focus.running
          ? s.focus
          : { ...s.focus, running: false, endsAt: null },
      }),
      skipHydration: true,
      merge: (persisted, current) => {
        if (!persisted || typeof persisted !== "object") return current;
        const p = persisted as Partial<AppState>;
        const DEMO_TITLES = new Set([
          "Pay electricity bill",
          "Call client",
          "Study Python",
          "Submit report",
          "Morning walk",
          "Water plants",
        ]);
        const tasksIn = p.tasks ?? current.tasks;
        const onlyDemo =
          tasksIn.length > 0 &&
          tasksIn.every((t) => DEMO_TITLES.has(t.title) || t.id === "seed-water");
        const mergedSettings = (() => {
          const merged = { ...DEFAULT_SETTINGS, ...current.settings, ...p.settings };
          if (!merged.localeRev || merged.localeRev < 19) {
            merged.locale = merged.locale || "en";
            merged.localeRev = 19;
          }
          if (!merged.notifyRev) {
            merged.notificationsEnabled = true;
            merged.notifyRev = 19;
          }
          if (!merged.demoRev) merged.demoRev = 19;
          return merged;
        })();
        const wipeDemo = onlyDemo && !(p.settings?.demoRev);
        return {
          ...current,
          ...p,
          tasks: wipeDemo ? [] : tasksIn,
          subtasks: wipeDemo ? [] : (p.subtasks ?? current.subtasks),
          completions: wipeDemo ? [] : (p.completions ?? current.completions),
          reminders: wipeDemo ? [] : (p.reminders ?? current.reminders),
          transactions: wipeDemo ? [] : (p.transactions ?? current.transactions),
          categories: p.categories?.length ? p.categories : current.categories?.length ? current.categories : DEFAULT_CATEGORIES,
          settings: mergedSettings,
          budgets: p.budgets?.length ? p.budgets : current.budgets,
          moneyCategories: ensureIncomeCats(
            p.moneyCategories?.length
              ? p.moneyCategories
              : current.moneyCategories?.length
                ? current.moneyCategories
                : DEFAULT_MONEY_CATEGORIES,
          ),
          notes: p.notes ?? current.notes ?? [],
          plans: p.plans ?? current.plans ?? [],
          vault: p.vault ?? current.vault ?? [],
          vaultUnlocked: false,
          game: wipeDemo
            ? { ...DEFAULT_GAME }
            : {
                ...DEFAULT_GAME,
                ...current.game,
                ...p.game,
                claimedQuests: p.game?.claimedQuests ?? current.game.claimedQuests ?? [],
              },
        };
      },
    },
  ),
);

function pickNextUp(tasks: Task[], now: number, skipId?: string): Task | null {
  const open = tasks.filter((t) => t.id !== skipId && t.status !== "completed" && liveStatus(t, now) !== "completed");
  const overdue = open
    .filter((t) => liveStatus(t, now) === "overdue")
    .sort((a, b) => (effectiveDueSafe(a) ?? 0) - (effectiveDueSafe(b) ?? 0));
  if (overdue[0]) return overdue[0];
  const dated = open
    .filter((t) => t.dueAt != null)
    .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0));
  return dated[0] ?? open[0] ?? null;
}

function formatOverdueBody(dueAt: number, now: number): string {
  const mins = Math.max(0, Math.round((now - dueAt) / 60000));
  if (mins < 60) return `Overdue by ${mins} min`;
  const h = Math.floor(mins / 60);
  return `Overdue by ${h}h ${mins % 60}m`;
}

export function selectBuckets(tasks: Task[], now: number) {
  const active = tasks.filter((t) => t.status !== "completed" && liveStatus(t, now) !== "completed");
  const overdue = active
    .filter((t) => liveStatus(t, now) === "overdue")
    .sort((a, b) => (effectiveDueSafe(a) ?? 0) - (effectiveDueSafe(b) ?? 0));
  const todayKey = dayKey(now);
  const tomorrowKey = dayKey(now + 24 * 60 * 60_000);
  const today = active
    .filter((t) => {
      const st = liveStatus(t, now);
      if (st === "overdue" || st === "completed") return false;
      const due = t.dueAt;
      return due != null && dayKey(due) === todayKey;
    })
    .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0));
  const tomorrow = active
    .filter((t) => {
      if (overdue.includes(t) || today.includes(t)) return false;
      return t.dueAt != null && dayKey(t.dueAt) === tomorrowKey;
    })
    .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0));
  const later = active
    .filter((t) => {
      if (overdue.includes(t) || today.includes(t) || tomorrow.includes(t)) return false;
      return t.dueAt != null && t.dueAt > now;
    })
    .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0))
    .slice(0, 5);
  const finishedToday = tasks.filter(
    (t) => t.status === "completed" && t.completedAt && dayKey(t.completedAt) === todayKey,
  ).length;
  return {
    overdue,
    today,
    tomorrow,
    next: later,
    finishedToday,
    remaining: overdue.length + today.length,
    nextUp: overdue[0] ?? today[0] ?? tomorrow[0] ?? later[0] ?? null,
  };
}

export function selectOpenGroups(tasks: Task[], now: number) {
  const active = tasks.filter((t) => t.status !== "completed" && liveStatus(t, now) !== "completed");
  const overdue = active
    .filter((t) => liveStatus(t, now) === "overdue")
    .sort((a, b) => (effectiveDueSafe(a) ?? 0) - (effectiveDueSafe(b) ?? 0));
  const todayKey = dayKey(now);
  const tomorrowKey = dayKey(now + 24 * 60 * 60_000);
  const today = active
    .filter((t) => {
      if (liveStatus(t, now) === "overdue") return false;
      return t.dueAt != null && dayKey(t.dueAt) === todayKey;
    })
    .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0));
  const tomorrow = active
    .filter((t) => {
      if (liveStatus(t, now) === "overdue") return false;
      return t.dueAt != null && dayKey(t.dueAt) === tomorrowKey;
    })
    .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0));
  const later = active
    .filter((t) => {
      if (liveStatus(t, now) === "overdue") return false;
      if (t.dueAt == null) return false;
      const key = dayKey(t.dueAt);
      return key !== todayKey && key !== tomorrowKey && t.dueAt > now;
    })
    .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0));
  const inbox = active.filter((t) => t.dueAt == null && liveStatus(t, now) !== "overdue");
  return {
    overdue,
    today,
    tomorrow,
    later,
    inbox,
    remaining: active.length,
  };
}

function effectiveDueSafe(task: Task): number | null {
  return task.snoozedUntil ?? task.dueAt;
}

export function selectStats(tasks: Task[], completions: Completion[], now: number) {
  const today = dayKey(now);
  const completedToday = completions.filter((c) => dayKey(c.completedAt) === today).length;
  const weekAgo = now - 6 * 24 * 60 * 60_000;
  const completedWeek = completions.filter((c) => c.completedAt >= weekAgo).length;
  const overdue = tasks.filter((t) => t.status !== "completed" && liveStatus(t, now) === "overdue").length;
  const open = tasks.filter((t) => t.status !== "completed").length;
  const denom = completions.length + open;
  const rate = denom === 0 ? 100 : Math.round((completions.length / denom) * 100);
  const days = new Set(completions.map((c) => dayKey(c.completedAt)));
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const key = dayKey(now - i * 24 * 60 * 60_000);
    if (days.has(key) || (i === 0 && completedToday === 0 && streak === 0)) {
      if (days.has(key)) streak += 1;
      else if (i === 0) continue;
      else break;
    } else break;
  }
  return { completedToday, completedWeek, overdue, rate, streak };
}

export function selectCompletionsByDay(completions: Completion[], now: number) {
  const map = new Map<string, Completion[]>();
  for (const item of completions) {
    const key = dayKey(item.completedAt);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return [...map.entries()].map(([key, items]) => ({
    key,
    label: dayHeading(items[0]?.completedAt ?? now, now),
    items,
  }));
}

export function selectDayLoad(tasks: Task[], completions: Completion[]) {
  const remaining = new Map<string, number>();
  const finished = new Map<string, number>();
  const openTitles = new Map<string, string[]>();
  for (const t of tasks) {
    if (t.status === "completed" || !t.dueAt) continue;
    const key = dayKey(t.dueAt);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
    const list = openTitles.get(key) ?? [];
    if (list.length < 2) list.push(t.title);
    openTitles.set(key, list);
  }
  for (const c of completions) {
    const key = dayKey(c.completedAt);
    finished.set(key, (finished.get(key) ?? 0) + 1);
  }
  return { remaining, finished, openTitles };
}
