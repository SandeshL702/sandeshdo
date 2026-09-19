export type Priority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "inbox" | "scheduled" | "due" | "overdue" | "completed";
export type ThemeMode = "system" | "light" | "dark";
export type ReminderInterval = "off" | 15 | 30 | 60 | 120 | 1440;
export type NotifyTone = "gentle" | "off";
export type Locale = "en" | "hi";

export type RecurrenceKind =
  | "none"
  | "daily"
  | "weekdays"
  | "weekly"
  | "monthly"
  | "yearly"
  | "custom";

export interface RecurrenceRule {
  kind: RecurrenceKind;
  /** 0 = Sunday … 6 = Saturday, used by weekly/custom */
  days?: number[];
  /** Day of month 1–31 for monthly */
  monthDay?: number;
  endAt?: number | null;
  maxOccurrences?: number | null;
  occurrencesDone?: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  notes: string;
  categoryId: string | null;
  priority: Priority;
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
  dueAt: number | null;
  deadline: number | null;
  completedAt: number | null;
  estimatedDuration: number | null;
  recurrence: RecurrenceRule | null;
  reminderEnabled: boolean;
  /** Extra offsets in minutes relative to dueAt. Negative = before, 0 = at time, positive = after. */
  reminderOffsets: number[];
  reminderCount: number;
  reminderDayKey: string | null;
  snoozeCount: number;
  rescheduleCount: number;
  overdueCount: number;
  lastReminderAt: number | null;
  lastSnoozeDuration: number | null;
  snoozeHistory: number[];
  snoozedUntil: number | null;
}

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  position: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface Completion {
  id: string;
  taskId: string;
  title: string;
  completedAt: number;
  duration: number | null;
  /** Set when the user undoes — stays in history, leaves the Done tab. */
  undoneAt?: number | null;
}

export interface FinishEvent {
  taskId: string;
  title: string;
  completedAt: number;
  todayCount: number;
  nextId: string | null;
  nextTitle: string | null;
  recurring: boolean;
  xpGain: number;
  coinGain: number;
  combo: number;
  hpGain: number;
  level: number;
  rank: string;
  streak: number;
  levelUp: boolean;
}

export interface Reminder {
  id: string;
  taskId: string;
  triggerAt: number;
  type: "before" | "at" | "after" | "overdue" | "snooze" | "summary" | "paisa";
  status: "pending" | "fired" | "cancelled";
}

export interface FocusState {
  taskId: string | null;
  running: boolean;
  mode: "task" | "pomodoro-work" | "pomodoro-break";
  durationMs: number;
  remainingMs: number;
  endsAt: number | null;
  pomodoroPreset: "25/5" | "50/10" | "custom";
  customWorkMin: number;
  customBreakMin: number;
}

export interface Settings {
  userName: string;
  theme: ThemeMode;
  locale: Locale;
  localeRev?: number;
  reminderInterval: ReminderInterval;
  maxRemindersPerDay: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  aggressiveReminders: boolean;
  smartSnooze: boolean;
  dailySummary: boolean;
  dailySummaryTime: string;
  endOfDaySummary: boolean;
  endOfDaySummaryTime: string;
  lastDailySummaryOn: string | null;
  lastEndOfDayOn: string | null;
  autoCompleteOnSubtasks: boolean;
  defaultReminderOffsets: number[];
  notificationsEnabled: boolean;
  notifyVibrate: boolean;
  notifyTone: NotifyTone;
  seededOnce: boolean;
  lastBackupDay: string | null;
  lastBackupAt: number | null;
  paisaNudgeEnabled: boolean;
  paisaNudgeTime: string;
  lastPaisaNudgeOn: string | null;
  /** Google Gemini key, stored only on this device. Empty = local commands. */
  geminiApiKey?: string;
  notifyRev?: number;
  demoRev?: number;
  pinHash?: string;
  voiceEnabled?: boolean;
}

export interface BackupFile {
  version: 1 | 2;
  app: "SandeshDo";
  exportedAt: number;
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
  recurringSpends?: RecurringSpend[];
  trashTasks?: Task[];
  trashTx?: Transaction[];
  trashNotes?: Note[];
  trashPlans?: Plan[];
}

export type TxType = "income" | "expense";
export type MoneyCatKind = "in" | "out" | "both";

export interface MoneyCategory {
  id: string;
  name: string;
  kind: MoneyCatKind;
  /** Parent category id. Food → Tiffin / Eating out / Groceries. */
  parentId?: string | null;
}

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  category: string;
  note: string;
  at: number;
  account: "cash" | "bank";
}

export interface RecurringSpend {
  id: string;
  type: TxType;
  amount: number;
  category: string;
  note: string;
  hour: number;
  minute: number;
  /** empty = every day */
  days: number[];
  lastPostedDay: string | null;
  enabled: boolean;
}

export type NoteColor = "paper" | "teal" | "sand" | "rose";

export interface Note {
  id: string;
  title: string;
  body: string;
  color: NoteColor;
  pinned: boolean;
  updatedAt: number;
}

export interface Plan {
  id: string;
  title: string;
  note: string;
  when: number | null;
  cost: number | null;
  done: boolean;
  createdAt: number;
}

export type VaultKind = "password" | "pin" | "card" | "note";

export interface VaultItem {
  id: string;
  kind: VaultKind;
  label: string;
  secret: string;
  updatedAt: number;
}

export interface Budget {
  category: string;
  limit: number;
}

export interface GameProgress {
  xp: number;
  coins: number;
  streak: number;
  lastActiveDay: string | null;
  hp: number;
  lastDamageDay: string | null;
  combo: number;
  lastFinishAt: number | null;
  questDay: string | null;
  claimedQuests: string[];
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "work", name: "Work", icon: "briefcase" },
  { id: "personal", name: "Personal", icon: "user" },
  { id: "study", name: "Study", icon: "book" },
  { id: "finance", name: "Finance", icon: "wallet" },
  { id: "health", name: "Health", icon: "heart" },
  { id: "important", name: "Important", icon: "star" },
];

export function taskCatLabel(
  cats: Category[],
  id: string | null | undefined,
  translate: (key: string) => string,
): string {
  if (!id) return "";
  const cat = cats.find((c) => c.id === id);
  if (!cat) return "";
  const def = DEFAULT_CATEGORIES.find((c) => c.id === cat.id);
  if (def && cat.name === def.name) {
    const key = `tcat.${cat.id}`;
    const label = translate(key);
    return label === key ? cat.name : label;
  }
  return cat.name;
}

export const DEFAULT_SETTINGS: Settings = {
  userName: "Sandesh",
  theme: "system",
  locale: "en",
  localeRev: 19,
  reminderInterval: 15,
  maxRemindersPerDay: 6,
  quietHoursEnabled: true,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  aggressiveReminders: true,
  smartSnooze: true,
  dailySummary: true,
  dailySummaryTime: "08:00",
  endOfDaySummary: true,
  endOfDaySummaryTime: "21:00",
  lastDailySummaryOn: null,
  lastEndOfDayOn: null,
  autoCompleteOnSubtasks: false,
  defaultReminderOffsets: [0],
  notificationsEnabled: true,
  notifyVibrate: true,
  notifyTone: "gentle",
  seededOnce: false,
  lastBackupDay: null,
  lastBackupAt: null,
  paisaNudgeEnabled: true,
  paisaNudgeTime: "20:00",
  lastPaisaNudgeOn: null,
  geminiApiKey: "",
  notifyRev: 19,
  demoRev: 21,
  pinHash: "",
  voiceEnabled: true,
};

export const SNOOZE_PRESETS = [
  { label: "5 min", minutes: 5 },
  { label: "10 min", minutes: 10 },
  { label: "15 min", minutes: 15 },
  { label: "30 min", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "Tomorrow", minutes: -1 },
] as const;

export const REMINDER_OFFSET_PRESETS = [
  { label: "30 min before", minutes: -30 },
  { label: "At time", minutes: 0 },
  { label: "30 min after", minutes: 30 },
  { label: "1 hour after", minutes: 60 },
] as const;

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const PRIORITY_RANK: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};
