import { addDays, setHours, setMinutes } from "date-fns";
import { parseNaturalLanguage } from "./parser";
import { catsForType, guessCategory } from "./money";
import { liveStatus } from "./engine";
import { dayKey } from "./time";
import type { MoneyCategory, Task, Transaction, TxType } from "./types";

export type AssistantAction =
  | { type: "add_task"; title: string; dueAt?: number | null; priority?: "low" | "medium" | "high" }
  | { type: "complete_task"; query: string }
  | { type: "snooze_task"; query: string; minutes?: number }
  | { type: "log_money"; kind: TxType; amount: number; note?: string; category?: string }
  | { type: "navigate"; to: "tasks" | "calendar" | "money" | "settings" | "report" }
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
      notes.push(`Added “${action.title.trim()}”`);
    } else if (action.type === "complete_task") {
      const task = findTask(ctx.tasks, action.query);
      if (task) {
        ctx.completeTask(task.id);
        notes.push(`Done · ${task.title}`);
      } else {
        notes.push(`Couldn’t find “${action.query}”`);
      }
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
      ctx.addTx({
        type,
        amount: action.amount,
        category: cat,
        note: note || (type === "income" ? "Got" : "Spent"),
        at: Date.now(),
        account: "cash",
      });
      notes.push(`${type === "income" ? "Got" : "Spent"} ₹${Math.round(action.amount)}`);
    } else if (action.type === "navigate") {
      notes.push(`go:${action.to}`);
    }
  }
  return notes;
}

export function localUnderstand(
  raw: string,
  snapshot: { tasks: Task[]; transactions: Transaction[]; moneyCategories: MoneyCategory[] },
): AssistantResult {
  const text = raw.trim();
  const lower = text.toLowerCase();
  const now = Date.now();
  const open = snapshot.tasks.filter((t) => t.status !== "completed");
  const overdue = open.filter((t) => liveStatus(t, now) === "overdue");
  const today = open.filter((t) => t.dueAt && dayKey(t.dueAt) === dayKey(now));

  if (/^(hi|hello|hey|namaste|yo)\b/.test(lower)) {
    return { say: "Hi. Add a task, log paisa, or ask what’s pending.", actions: [], source: "local" };
  }

  if (/\b(report|dashboard|analysis|stats)\b/.test(lower) || /report dikha|dashboard/.test(lower)) {
    return { say: "Opening the report.", actions: [{ type: "navigate", to: "report" }], source: "local" };
  }
  if (/\b(calendar|diary)\b/.test(lower) || /calendar khol/.test(lower)) {
    return { say: "Opening calendar.", actions: [{ type: "navigate", to: "calendar" }], source: "local" };
  }
  if (/\b(paisa|money|khata)\b/.test(lower) && /\b(open|show|khol|dikha)\b/.test(lower)) {
    return { say: "Opening Paisa.", actions: [{ type: "navigate", to: "money" }], source: "local" };
  }
  if (/\bsettings\b/.test(lower)) {
    return { say: "Opening settings.", actions: [{ type: "navigate", to: "settings" }], source: "local" };
  }

  if (/\b(pending|left|bache|overdue|aaj kya|what's left|kya pending)\b/.test(lower)) {
    const lines = [
      overdue.length ? `${overdue.length} overdue` : null,
      `${today.length} due today`,
      `${open.length} open`,
    ]
      .filter(Boolean)
      .join(" · ");
    const titles = [...overdue, ...today].slice(0, 4).map((t) => t.title);
    return {
      say: titles.length ? `${lines}. ${titles.join(", ")}.` : `${lines}. Nothing urgent.`,
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
        say: `${kind === "income" ? "Got" : "Spent"} ₹${amount}${note ? ` · ${note}` : ""}.`,
        actions: [{ type: "log_money", kind, amount, note, category: id }],
        source: "local",
      };
    }
  }

  const done = lower.match(/^(?:done|finish|complete|tick|khatam|ho gaya)\s+(.+)$/i);
  if (done?.[1]) {
    const task = findTask(snapshot.tasks, done[1]);
    return {
      say: task ? `Marking ${task.title} done.` : `I couldn’t find that task.`,
      actions: task ? [{ type: "complete_task", query: done[1] }] : [],
      source: "local",
    };
  }

  const snooze = lower.match(/^(?:snooze|baad mein|later)\s+(.+)$/i);
  if (snooze?.[1]) {
    return {
      say: "Snoozed 10 minutes.",
      actions: [{ type: "snooze_task", query: snooze[1], minutes: 10 }],
      source: "local",
    };
  }

  if (/^(add |remind me |yaad |kaam |task:|todo:)/i.test(text) || parseNaturalLanguage(text).confidence === "high") {
    const parsed = parseNaturalLanguage(text.replace(/^(add |yaad rakh |kaam |task:|todo:)/i, "").trim());
    const title = parsed.title || text;
    if (title.length >= 2) {
      let dueAt = parsed.dueAt;
      if (!dueAt && /\btoday|aaj\b/i.test(text)) dueAt = todayAt(18);
      if (!dueAt && /\btomorrow|kal\b/i.test(text)) dueAt = addDays(new Date(), 1).setHours(9, 0, 0, 0);
      return {
        say: dueAt ? `Added “${title}” with a reminder.` : `Added “${title}”.`,
        actions: [{ type: "add_task", title, dueAt: dueAt ?? null }],
        source: "local",
      };
    }
  }

  return {
    say: "",
    actions: [],
    source: "local",
  };
}

export async function askGemini(prompt: string, apiKey: string, snapshot: { tasks: Task[] }): Promise<AssistantResult> {
  const open = snapshot.tasks
    .filter((t) => t.status !== "completed")
    .slice(0, 12)
    .map((t) => t.title);
  const system = `You are SandeshDo, a private task and money app. Reply JSON only:
{"say":"short spoken reply","actions":[...]}
Actions:
{"type":"add_task","title":"...","dueAt":null or epoch ms}
{"type":"complete_task","query":"title fragment"}
{"type":"snooze_task","query":"...","minutes":10}
{"type":"log_money","kind":"income"|"expense","amount":number,"note":"..."}
{"type":"navigate","to":"tasks"|"calendar"|"money"|"settings"|"report"}
Open tasks: ${open.join(" | ") || "(none)"}
User said: ${prompt}`;

  const call = async (model: string) => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: system }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 400, responseMimeType: "application/json" },
        }),
      },
    );
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return body.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  };

  let raw = "";
  try {
    raw = await call("gemini-2.0-flash");
  } catch {
    raw = await call("gemini-1.5-flash");
  }
  const parsed = JSON.parse(raw) as { say?: string; actions?: AssistantAction[] };
  return {
    say: parsed.say?.trim() || "Done.",
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    source: "gemini",
  };
}

export async function runAssistant(
  prompt: string,
  apiKey: string,
  snapshot: { tasks: Task[]; transactions: Transaction[]; moneyCategories: MoneyCategory[] },
): Promise<AssistantResult> {
  const local = localUnderstand(prompt, snapshot);
  if (local.say || local.actions.length) return local;
  if (apiKey.trim()) {
    try {
      return await askGemini(prompt, apiKey.trim(), snapshot);
    } catch {
      return {
        say: "Gemini didn’t answer. I can still add tasks and log paisa without the key.",
        actions: [],
        source: "local",
      };
    }
  }
  const parsed = parseNaturalLanguage(prompt);
  if (parsed.title) {
    return {
      say: `Added “${parsed.title}”.`,
      actions: [{ type: "add_task", title: parsed.title, dueAt: parsed.dueAt }],
      source: "local",
    };
  }
  return {
    say: "Try: “Call Rahul tomorrow 5pm”, “got 500 freelance”, or “what’s pending”. Add a Google API key in Settings for full chat.",
    actions: [],
    source: "local",
  };
}
