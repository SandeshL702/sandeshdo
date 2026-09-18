import type {
  BackupFile,
  Budget,
  Category,
  Completion,
  GameProgress,
  MoneyCategory,
  Note,
  Plan,
  Reminder,
  Settings,
  Subtask,
  Task,
  Transaction,
  VaultItem,
} from "./types";

export interface Snapshot {
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
}

const FILE_KEY = "sandeshdo-file-backup";

export function buildBackup(snap: Snapshot): BackupFile {
  return {
    version: 2,
    app: "SandeshDo",
    exportedAt: Date.now(),
    tasks: snap.tasks,
    subtasks: snap.subtasks,
    categories: snap.categories,
    completions: snap.completions,
    reminders: snap.reminders,
    settings: { ...snap.settings, geminiApiKey: "" },
    transactions: snap.transactions ?? [],
    budgets: snap.budgets ?? [],
    moneyCategories: snap.moneyCategories ?? [],
    game: snap.game,
    notes: snap.notes ?? [],
    plans: snap.plans ?? [],
    vault: (snap.vault ?? []).map((item) => ({ ...item, secret: "" })),
  };
}

export function serializeBackup(snap: Snapshot): string {
  return JSON.stringify(buildBackup(snap), null, 2);
}

export function parseBackup(raw: string): BackupFile {
  const data = JSON.parse(raw) as BackupFile;
  if (!data || data.app !== "SandeshDo" || (data.version !== 1 && data.version !== 2)) {
    throw new Error("This file is not a SandeshDo backup.");
  }
  if (!Array.isArray(data.tasks) || !data.settings) {
    throw new Error("Backup is missing required data.");
  }
  return data;
}

export function backupFileName(): string {
  return `sandeshdo-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

export function downloadBackup(json: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadTextReport(text: string, name: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function persistBackup(json: string): "native" | "local" {
  try {
    localStorage.setItem(FILE_KEY, json);
  } catch {
    /* quota */
  }
  try {
    const host = typeof window !== "undefined" ? window.SandeshDoHost : undefined;
    if (host?.saveBackup) {
      const out = host.saveBackup(json);
      if (out) return "native";
    }
  } catch {
    /* native optional */
  }
  return "local";
}

export async function shareBackup(json: string): Promise<"native" | "share" | "download"> {
  persistBackup(json);
  try {
    const host = typeof window !== "undefined" ? window.SandeshDoHost : undefined;
    if (host?.shareBackup) {
      host.shareBackup(json);
      return "native";
    }
  } catch {
    /* fall through */
  }
  try {
    const file = new File([json], backupFileName(), { type: "application/json" });
    const nav = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
      share?: (data: ShareData) => Promise<void>;
    };
    if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
      await nav.share({ files: [file], title: "SandeshDo backup" });
      return "share";
    }
    if (nav.share) {
      await nav.share({ title: "SandeshDo backup", text: json });
      return "share";
    }
  } catch {
    /* user cancelled or unsupported */
  }
  downloadBackup(json);
  return "download";
}

export function tryNativeRestore(): BackupFile | null {
  const read = (): string | null => {
    try {
      const host = typeof window !== "undefined" ? window.SandeshDoHost : undefined;
      const native = host?.loadLatestBackup?.();
      if (native && native.length > 8) return native;
    } catch {
      /* optional */
    }
    try {
      return localStorage.getItem(FILE_KEY);
    } catch {
      return null;
    }
  };
  const raw = read();
  if (!raw) return null;
  try {
    return parseBackup(raw);
  } catch {
    return null;
  }
}
