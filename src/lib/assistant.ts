import { addDays, setHours, setMinutes } from "date-fns";
import { parseNaturalLanguage } from "./parser";
import { catsForType, guessCategory } from "./money";
import { liveStatus } from "./engine";
import { dayKey } from "./time";
import { proxyGemini } from "./gemini-proxy";
import type { MoneyCategory, Note, Plan, Task, Transaction, TxType } from "./types";

export type AssistantAction =
  | { type: "add_task"; title: string; dueAt?: number | null; priority?: "low" | "medium" | "high" }
  | { type: "complete_task"; query: string }
  | { type: "snooze_task"; query: string; minutes?: number }
  | { type: "log_money"; kind: TxType; amount: number; note?: string; category?: string }
  | { type: "add_note"; title: string; body?: string }
  | { type: "add_plan"; title: string; when?: number | null; cost?: number | null }
  | { type: "navigate"; to: "tasks" | "calendar" | "money" | "settings" | "report" | "notes" | "plans" | "vault" | "more" }
  | { type: "none" };

export type AssistantResult = {
  say: string;
  actions: AssistantAction[];
  source: "local" | "gemini";
};

function todayAt(hour: number, minute = 0) {
  const d = setMinutes(setHours(new Date(), hour), minute);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d.getTime();
}

function findTask(tasks: Task[], query: string): Task | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  const open = tasks.filter((t) => t.status !== "completed");
  return (
    open.find((t) => t.title.toLowerCase() === q) ??
    open.find((t) => t.title.toLowerCase().includes(q)) ??
    open.find((t) => q.includes(t.title.toLowerCase()))
  );
}

export function executeActions(
  actions: AssistantAction[],
  ctx: {
    addTask: (draft: { title: string; dueAt?: number | null; priority?: "low" | "medium" | "high" }) => string;
    completeTask: (id: string) => void;
    snoozeTask: (id: string, minutes: number) => void;
    addTx: (draft: Omit<Transaction, "id">) => string;
    addNote: (draft: { title: string; body: string }) => string;
    addPlan: (draft: { title: string; when?: number | null; cost?: number | null }) => string;
    tasks: Task[];
    moneyCategories: MoneyCategory[];
  },
): string[] {
  const notes: string[] = [];
  for (const action of actions) {
    if (action.type === "add_task" && action.title.trim()) {
      ctx.addTask({
        title: action.title.trim(),
        dueAt: action.dueAt ?? null,
        priority: action.priority ?? "medium",
      });
      notes.push(
        action.dueAt
          ? `Added “${action.title.trim()}” with a reminder.`
          : `Added “${action.title.trim()}”.`,
      );
    } else if (action.type === "complete_task") {
      const task = findTask(ctx.tasks, action.query);
      if (task) {
        ctx.completeTask(task.id);
        notes.push(`Done · ${task.title}`);
      } else notes.push(`Couldn’t find “${action.query}”`);
    } else if (action.type === "snooze_task") {
      const task = findTask(ctx.tasks, action.query);
      if (task) {
        ctx.snoozeTask(task.id, action.minutes ?? 10);
        notes.push(`Snoozed ${task.title}`);
      }
    } else if (action.type === "log_money" && action.amount > 0) {
      const type = action.kind;
      const note = action.note?.trim() ?? "";
      const cat =
        action.category && ctx.moneyCategories.some((c) => c.id === action.category)
          ? action.category
          : guessCategory(note, type, ctx.moneyCategories);
      const allowed = catsForType(ctx.moneyCategories, type);
      const id = allowed.some((c) => c.id === cat) ? cat : allowed[0]?.id ?? "other";
      ctx.addTx({
        type,
        amount: action.amount,
        category: id,
        note: note || (type === "income" ? "Got" : "Spent"),
        at: Date.now(),
        account: "cash",
      });
      notes.push(`${type === "income" ? "Got" : "Spent"} ₹${Math.round(action.amount)}`);
    } else if (action.type === "add_note" && action.title.trim()) {
      ctx.addNote({ title: action.title.trim(), body: action.body?.trim() ?? "" });
      notes.push(`Note saved · ${action.title.trim()}`);
    } else if (action.type === "add_plan" && action.title.trim()) {
      ctx.addPlan({ title: action.title.trim(), when: action.when ?? null, cost: action.cost ?? null });
      notes.push(`Plan saved · ${action.title.trim()}`);
    } else if (action.type === "navigate") {
      notes.push(`go:${action.to}`);
    }
  }
  return notes;
}

export function localUnderstand(
  raw: string,
  snapshot: {
    tasks: Task[];
    transactions: Transaction[];
    moneyCategories: MoneyCategory[];
    notes: Note[];
    plans: Plan[];
  },
): AssistantResult {
  const text = raw.trim();
  const lower = text.toLowerCase();
  const now = Date.now();
  const open = snapshot.tasks.filter((t) => t.status !== "completed");
  const overdue = open.filter((t) => liveStatus(t, now) === "overdue");
  const today = open.filter((t) => t.dueAt && dayKey(t.dueAt) === dayKey(now));

  if (/^(hi|hello|hey|namaste|yo|sandy)\b/.test(lower)) {
    return {
      say: "Sandy here. Bol — task, paisa, note, plan. Hinglish chalega.",
      actions: [],
      source: "local",
    };
  }

  const goMap: Array<{ re: RegExp; to: Extract<AssistantAction, { type: "navigate" }>["to"]; say: string }> = [
    { re: /\b(report|dashboard|analysis)\b|report dikha/i, to: "report", say: "Report khol rahi hoon." },
    { re: /\b(calendar|diary)\b|calendar khol/i, to: "calendar", say: "Calendar." },
    { re: /\b(paisa|money|khata)\b.*\b(open|show|khol|dikha)\b|\bpaisa khol/i, to: "money", say: "Paisa." },
    { re: /\bnotes?\b|notes khol/i, to: "notes", say: "Notes." },
    { re: /\b(plan|plans|mahakumbh|long.?term)\b/i, to: "plans", say: "Plans." },
    { re: /\b(vault|password|passwords)\b/i, to: "vault", say: "Vault. PIN chahiye." },
    { re: /\bsettings\b/, to: "settings", say: "Settings." },
    { re: /\bmore\b/, to: "more", say: "More." },
  ];
  for (const row of goMap) {
    if (row.re.test(lower) && !/\b(add|new|likh|bana)\b/.test(lower)) {
      return { say: row.say, actions: [{ type: "navigate", to: row.to }], source: "local" };
    }
  }

  if (/\b(pending|left|bache|overdue|aaj kya|what's left|kya pending|kya hai)\b/.test(lower)) {
    const titles = [...overdue, ...today].slice(0, 4).map((t) => t.title);
    const lines = `${overdue.length} overdue · ${today.length} today · ${open.length} open`;
    return {
      say: titles.length ? `${lines}. ${titles.join(", ")}.` : `${lines}. Sab clear.`,
      actions: [],
      source: "local",
    };
  }

  const money = lower.match(
    /(?:(?:got|aaya|received|income|mila)\s*(?:₹|rs\.?\s*)?(\d+)|(?:spent|gaya|pay|paid|kharch)\s*(?:₹|rs\.?\s*)?(\d+)|(?:₹|rs\.?\s*)(\d+)\s*(aaya|got|gaya|spent|income)?)/i,
  );
  if (money) {
    const amount = Number(money[1] || money[2] || money[3]);
    const kind: TxType = money[1] || /aaya|got|income|received|mila/.test(lower) ? "income" : "expense";
    if (amount > 0) {
      const note = text.replace(money[0], "").replace(/₹|rs\.?/gi, "").trim();
      const cat = guessCategory(note, kind, snapshot.moneyCategories);
      const allowed = catsForType(snapshot.moneyCategories, kind);
      const id = allowed.some((c) => c.id === cat) ? cat : allowed[0]?.id;
      return {
        say: `${kind === "income" ? "Aaya" : "Gaya"} ₹${amount}${note ? ` · ${note}` : ""}. Likh diya.`,
        actions: [{ type: "log_money", kind, amount, note, category: id }],
        source: "local",
      };
    }
  }

  const noteCmd = lower.match(/^(?:note|likh|yaad note)\s+(.+)$/i);
  if (noteCmd?.[1]) {
    return {
      say: `Note saved.`,
      actions: [{ type: "add_note", title: noteCmd[1].slice(0, 48), body: noteCmd[1] }],
      source: "local",
    };
  }

  const planCmd = lower.match(/^(?:plan|trip|jaana hai|lena hai)\s+(.+)$/i);
  if (planCmd?.[1]) {
    const parsed = parseNaturalLanguage(planCmd[1]);
    return {
      say: `Plan saved${parsed.dueAt ? " with a date" : ""}.`,
      actions: [{ type: "add_plan", title: parsed.title || planCmd[1], when: parsed.dueAt }],
      source: "local",
    };
  }

  const done = lower.match(/^(?:done|finish|complete|tick|khatam|ho gaya)\s+(.+)$/i);
  if (done?.[1]) {
    const task = findTask(snapshot.tasks, done[1]);
    return {
      say: task ? `${task.title} done.` : `Woh task nahi mila.`,
      actions: task ? [{ type: "complete_task", query: done[1] }] : [],
      source: "local",
    };
  }

  const snooze = lower.match(/^(?:snooze|baad mein|later)\s+(.+)$/i);
  if (snooze?.[1]) {
    return {
      say: "10 minute snooze.",
      actions: [{ type: "snooze_task", query: snooze[1], minutes: 10 }],
      source: "local",
    };
  }

  const parsed = parseNaturalLanguage(text.replace(/^(add |yaad rakh |kaam |task:|todo:)/i, "").trim());
  const looksAdd = /^(add |remind me |yaad |kaam |task:|todo:)/i.test(text);
  if (looksAdd || parsed.confidence !== "low") {
    const title = (parsed.title || text).replace(/^(add |yaad rakh |kaam )/i, "").trim();
    if (title.length >= 2) {
      let dueAt = parsed.dueAt;
      if (!dueAt && /\btoday|aaj\b/i.test(text)) dueAt = todayAt(18);
      if (!dueAt && /\btomorrow|kal\b/i.test(text)) dueAt = addDays(new Date(), 1).setHours(9, 0, 0, 0);
      if (dueAt || looksAdd) {
        return {
          say: dueAt ? `Laga diya: ${title}. Reminder on.` : `Laga diya: ${title}. Time bolo to reminder set hoga.`,
          actions: [{ type: "add_task", title, dueAt: dueAt ?? null }],
          source: "local",
        };
      }
    }
  }

  return { say: "", actions: [], source: "local" };
}

function sandyPrompt(user: string, snapshot: { tasks: Task[] }) {
  const open = snapshot.tasks
    .filter((t) => t.status !== "completed")
    .slice(0, 12)
    .map((t) => `${t.title}${t.dueAt ? ` @ ${new Date(t.dueAt).toISOString()}` : ""}`);
  const now = new Date().toISOString();
  return `You are Sandy, the voice of SandeshDo. Talk like a sharp friend. Mix English + Hindi (Hinglish) if the user does. Short replies. You control the whole app.
Now: ${now}
Reply JSON only: {"say":"...","actions":[...]}
Actions:
{"type":"add_task","title":"...","dueAt":epoch_ms_or_null}
{"type":"complete_task","query":"..."}
{"type":"snooze_task","query":"...","minutes":10}
{"type":"log_money","kind":"income"|"expense","amount":number,"note":"..."}
{"type":"add_note","title":"...","body":"..."}
{"type":"add_plan","title":"...","when":epoch_ms_or_null,"cost":number_or_null}
{"type":"navigate","to":"tasks"|"calendar"|"money"|"settings"|"report"|"notes"|"plans"|"vault"|"more"}
Always set dueAt when the user mentions aaj, kal, parso, baje, time, date, tomorrow, today.
Open tasks: ${open.join(" | ") || "(none)"}
User: ${user}`;
}

async function parseGeminiText(raw: string): Promise<AssistantResult> {
  let s = raw.trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(s) as { say?: string; actions?: AssistantAction[] };
  return {
    say: parsed.say?.trim() || "Ho gaya.",
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    source: "gemini",
  };
}

export async function askGemini(prompt: string, apiKey: string, snapshot: { tasks: Task[] }): Promise<AssistantResult> {
  const body = sandyPrompt(prompt, snapshot);
  const host = typeof window !== "undefined" ? window.SandeshDoHost : undefined;
  if (host?.askGemini) {
    const raw = host.askGemini(apiKey, body);
    if (raw && !raw.startsWith("ERR:")) return parseGeminiText(raw);
    throw new Error(raw || "native gemini failed");
  }
  const res = await proxyGemini({ data: { key: apiKey, prompt: body } });
  if (!res.ok) throw new Error(res.error);
  return parseGeminiText(res.text);
}

export async function runAssistant(
  prompt: string,
  apiKey: string,
  snapshot: {
    tasks: Task[];
    transactions: Transaction[];
    moneyCategories: MoneyCategory[];
    notes: Note[];
    plans: Plan[];
  },
): Promise<AssistantResult> {
  const local = localUnderstand(prompt, snapshot);
  const incompleteAdd = local.actions.some((a) => a.type === "add_task" && !a.dueAt);
  if (local.actions.length && !(incompleteAdd && apiKey.trim())) {
    if (local.say || local.actions.length) return local;
  }
  if (apiKey.trim()) {
    try {
      return await askGemini(prompt, apiKey.trim(), snapshot);
    } catch {
      if (local.actions.length) return local;
      return {
        say: "Gemini nahi mila. Local pe try kar: “kal 5 baje dentist”, “gaya 80 chai”.",
        actions: [],
        source: "local",
      };
    }
  }
  if (local.actions.length || local.say) return local;
  const parsed = parseNaturalLanguage(prompt);
  if (parsed.title && parsed.title.length >= 2) {
    return {
      say: parsed.dueAt
        ? `Laga diya: ${parsed.title}. Reminder on.`
        : `Laga diya: ${parsed.title}. Time bhi bolo next time — “kal 5 baje”.`,
      actions: [{ type: "add_task", title: parsed.title, dueAt: parsed.dueAt }],
      source: "local",
    };
  }
  return {
    say: "Sandy sun rahi hai. “Kal 5 baje Rahul ko call”, “gaya 80 chai”, “note laptop bill”, “plan Mahakumbh”. Gemini key Settings mein daalo for full chat.",
    actions: [],
    source: "local",
  };
}
