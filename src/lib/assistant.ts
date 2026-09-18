import { addDays, setHours, setMinutes } from "date-fns";
import { parseNaturalLanguage, tidyTitle } from "./parser";
import { catsForType, formatInr, guessCategory, monthTotals } from "./money";
import { liveStatus } from "./engine";
import { dayKey } from "./time";
import { proxyGemini } from "./gemini-proxy";
import { sanitizeGeminiKey } from "./gemini-client";
import {
  detectLlmProvider,
  extractAnyLlmText,
  friendlyLlmError,
  generateWithLlm,
  openAiRequest,
} from "./llm";
import { askSandyBrain } from "./sandy-brain";
import type { MoneyCategory, Note, Plan, Priority, Task, Transaction, TxType } from "./types";

export type AssistantAction =
  | { type: "add_task"; title: string; dueAt?: number | null; priority?: Priority; deadline?: number | null }
  | { type: "complete_task"; query: string }
  | { type: "snooze_task"; query: string; minutes?: number }
  | { type: "update_task"; query: string; title?: string; dueAt?: number | null; priority?: Priority }
  | { type: "delete_task"; query: string }
  | { type: "log_money"; kind: TxType; amount: number; note?: string; category?: string }
  | { type: "add_note"; title: string; body?: string }
  | { type: "add_plan"; title: string; when?: number | null; cost?: number | null }
  | { type: "navigate"; to: "tasks" | "calendar" | "money" | "settings" | "report" | "notes" | "plans" | "vault" | "more" }
  | { type: "report" }
  | { type: "none" };

export type AssistantResult = {
  say: string;
  actions: AssistantAction[];
  source: "local" | "gemini";
};

export type AssistantSnapshot = {
  tasks: Task[];
  transactions: Transaction[];
  moneyCategories: MoneyCategory[];
  notes: Note[];
  plans: Plan[];
};

function todayAt(hour: number, minute = 0) {
  const d = setMinutes(setHours(new Date(), hour), minute);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d.getTime();
}

function asEpoch(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v > 0 && v < 1e12 ? Math.round(v * 1000) : v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n < 1e12 ? Math.round(n * 1000) : n;
    const p = Date.parse(v);
    return Number.isNaN(p) ? null : p;
  }
  return null;
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

function polishTask(title: string, dueAt: number | null | undefined, userText: string) {
  const fromUser = parseNaturalLanguage(userText);
  const fromTitle = parseNaturalLanguage(title);
  const clean = tidyTitle(fromUser.title || fromTitle.title || title);
  const due = asEpoch(dueAt) ?? fromUser.dueAt ?? fromTitle.dueAt ?? null;
  return { title: clean || title.trim(), dueAt: due, deadline: due };
}

export function executeActions(
  actions: AssistantAction[],
  ctx: {
    addTask: (draft: {
      title: string;
      dueAt?: number | null;
      deadline?: number | null;
      priority?: Priority;
    }) => string;
    completeTask: (id: string) => void;
    snoozeTask: (id: string, minutes: number) => void;
    updateTask: (id: string, patch: Partial<Task>) => void;
    deleteTask: (id: string) => void;
    addTx: (draft: Omit<Transaction, "id">) => string;
    addNote: (draft: { title: string; body: string }) => string;
    addPlan: (draft: { title: string; when?: number | null; cost?: number | null }) => string;
    tasks: Task[];
    moneyCategories: MoneyCategory[];
  },
  userText = "",
): string[] {
  const notes: string[] = [];
  for (const action of actions) {
    if (action.type === "add_task" && action.title.trim()) {
      const polished = polishTask(action.title, action.dueAt, userText || action.title);
      ctx.addTask({
        title: polished.title,
        dueAt: polished.dueAt,
        deadline: polished.deadline,
        priority: action.priority ?? "medium",
      });
      notes.push(polished.dueAt ? `Laga diya: ${polished.title} — reminder on.` : `Laga diya: ${polished.title}.`);
    } else if (action.type === "complete_task") {
      const task = findTask(ctx.tasks, action.query);
      if (task) {
        ctx.completeTask(task.id);
        notes.push(`Done · ${task.title}`);
      } else notes.push(`Woh task nahi mila: ${action.query}`);
    } else if (action.type === "snooze_task") {
      const task = findTask(ctx.tasks, action.query);
      if (task) {
        ctx.snoozeTask(task.id, action.minutes ?? 10);
        notes.push(`Snooze · ${task.title}`);
      }
    } else if (action.type === "update_task") {
      const task = findTask(ctx.tasks, action.query);
      if (task) {
        const patch: Partial<Task> = {};
        if (action.title) patch.title = tidyTitle(action.title);
        if (action.dueAt !== undefined) {
          const due = asEpoch(action.dueAt);
          patch.dueAt = due;
          patch.deadline = due;
        }
        if (action.priority) patch.priority = action.priority;
        ctx.updateTask(task.id, patch);
        notes.push(`Update · ${task.title}`);
      } else notes.push(`Update nahi hua — “${action.query}” nahi mila.`);
    } else if (action.type === "delete_task") {
      const task = findTask(ctx.tasks, action.query);
      if (task) {
        ctx.deleteTask(task.id);
        notes.push(`Hata diya · ${task.title}`);
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
      notes.push(`${type === "income" ? "Aaya" : "Gaya"} ₹${Math.round(action.amount)}`);
    } else if (action.type === "add_note" && action.title.trim()) {
      ctx.addNote({ title: action.title.trim(), body: action.body?.trim() ?? "" });
      notes.push(`Note saved · ${action.title.trim()}`);
    } else if (action.type === "add_plan" && action.title.trim()) {
      ctx.addPlan({ title: action.title.trim(), when: asEpoch(action.when) ?? null, cost: action.cost ?? null });
      notes.push(`Plan saved · ${action.title.trim()}`);
    } else if (action.type === "navigate") {
      notes.push(`go:${action.to}`);
    } else if (action.type === "report") {
      notes.push("go:report");
    }
  }
  return notes;
}

function speakReport(snapshot: AssistantSnapshot): string {
  const now = Date.now();
  const open = snapshot.tasks.filter((t) => t.status !== "completed");
  const overdue = open.filter((t) => liveStatus(t, now) === "overdue");
  const today = open.filter((t) => t.dueAt && dayKey(t.dueAt) === dayKey(now));
  const money = monthTotals(snapshot.transactions);
  const topOpen = [...overdue, ...today.filter((t) => !overdue.includes(t))].slice(0, 4).map((t) => t.title);
  const bits = [
    `${open.length} open`,
    `${overdue.length} overdue`,
    `${today.length} aaj`,
    `gaya ${formatInr(money.expense)}`,
    `aaya ${formatInr(money.income)}`,
  ];
  if (snapshot.notes.length) bits.push(`${snapshot.notes.length} notes`);
  if (snapshot.plans.length) bits.push(`${snapshot.plans.length} plans`);
  const list = topOpen.length ? ` Pehle: ${topOpen.join(", ")}.` : " Sab clear.";
  return `Report — ${bits.join(" · ")}.${list}`;
}

export function localUnderstand(raw: string, snapshot: AssistantSnapshot): AssistantResult {
  const text = raw.trim();
  const lower = text.toLowerCase();
  const now = Date.now();
  const open = snapshot.tasks.filter((t) => t.status !== "completed");
  const overdue = open.filter((t) => liveStatus(t, now) === "overdue");
  const today = open.filter((t) => t.dueAt && dayKey(t.dueAt) === dayKey(now));

  if (/^(hi|hello|hey|namaste|yo|sandy|bhai)\b/.test(lower)) {
    return {
      say: "Sandy bol raha hoon. Task, paisa, note, plan, report — bol, main laga deta hoon.",
      actions: [],
      source: "local",
    };
  }

  if (/\b(report|dashboard|analysis|summary)\b|report (bana|dikha|generate|khol)|hisab dikha/i.test(lower)) {
    return { say: speakReport(snapshot), actions: [{ type: "report" }], source: "local" };
  }

  if (/\b(kitna kharch|kitna gaya|spend|kharcha)\b/i.test(lower)) {
    const money = monthTotals(snapshot.transactions);
    return {
      say: `Is mahine gaya ${formatInr(money.expense)}, aaya ${formatInr(money.income)}. Net ${formatInr(money.net)}.`,
      actions: [{ type: "navigate", to: "money" }],
      source: "local",
    };
  }

  const goMap: Array<{ re: RegExp; to: Extract<AssistantAction, { type: "navigate" }>["to"]; say: string }> = [
    { re: /\b(calendar|diary)\b|calendar khol/i, to: "calendar", say: "Calendar khol raha hoon." },
    { re: /\b(paisa|money|khata)\b.*\b(open|show|khol|dikha)\b|\bpaisa khol/i, to: "money", say: "Paisa." },
    { re: /\bnotes?\b|notes khol/i, to: "notes", say: "Notes." },
    { re: /\b(plan|plans|mahakumbh|long.?term)\b/i, to: "plans", say: "Plans." },
    { re: /\b(vault|password|passwords)\b/i, to: "vault", say: "Vault." },
    { re: /\bsettings\b/, to: "settings", say: "Settings." },
    { re: /\bmore\b/, to: "more", say: "More." },
  ];
  for (const row of goMap) {
    if (row.re.test(lower) && !/\b(add|new|likh|bana)\b/.test(lower)) {
      return { say: row.say, actions: [{ type: "navigate", to: row.to }], source: "local" };
    }
  }

  if (/\b(pending|left|bache|overdue|aaj kya|what's left|kya pending|kya hai|kya karna)\b/.test(lower) && !/\b(karna hai|khatam)\b/.test(lower)) {
    const titles = [...overdue, ...today].slice(0, 4).map((t) => t.title);
    const lines = `${overdue.length} overdue · ${today.length} aaj · ${open.length} open`;
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

  const del = lower.match(/^(?:delete|hata|remove)\s+(.+)$/i);
  if (del?.[1]) {
    const task = findTask(snapshot.tasks, del[1]);
    return {
      say: task ? `Hata diya: ${task.title}.` : `Woh task nahi mila.`,
      actions: task ? [{ type: "delete_task", query: del[1] }] : [],
      source: "local",
    };
  }

  const parsed = parseNaturalLanguage(text.replace(/^(add |yaad rakh |kaam |task:|todo:)/i, "").trim());
  const looksAdd = /^(add |remind me |yaad |kaam |task:|todo:)/i.test(text);
  const looksTask =
    looksAdd ||
    parsed.confidence !== "low" ||
    /\b(karna hai|khatam|deadline|yaad|remind|baje|aaj|kal|parso|sham|shaam|subah)\b/i.test(text);
  if (looksTask) {
    const title = tidyTitle((parsed.title || text).replace(/^(add |yaad rakh |kaam )/i, ""));
    if (title.length >= 2) {
      let dueAt = parsed.dueAt;
      if (!dueAt && /\btoday|aaj\b/i.test(text)) dueAt = todayAt(18);
      if (!dueAt && /\btomorrow|kal\b/i.test(text)) dueAt = addDays(new Date(), 1).setHours(9, 0, 0, 0);
      return {
        say: dueAt
          ? `Laga diya: ${title}. Deadline set.`
          : `Laga diya: ${title}. Time bolo to reminder set hoga.`,
        actions: [{ type: "add_task", title, dueAt: dueAt ?? null, deadline: dueAt ?? null }],
        source: "local",
      };
    }
  }

  return { say: "", actions: [], source: "local" };
}

function fmtDue(ms: number | null | undefined) {
  if (!ms) return "no time";
  try {
    return new Date(ms).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return String(ms);
  }
}

function appBrief(snapshot: AssistantSnapshot) {
  const now = Date.now();
  const open = snapshot.tasks.filter((t) => t.status !== "completed");
  const overdue = open.filter((t) => liveStatus(t, now) === "overdue");
  const today = open.filter((t) => t.dueAt && dayKey(t.dueAt) === dayKey(now));
  const money = monthTotals(snapshot.transactions);
  const openLines = open
    .slice(0, 20)
    .map((t) => `- ${t.title} [${fmtDue(t.dueAt)}]`)
    .join("\n");
  const txLines = snapshot.transactions
    .slice(0, 10)
    .map((t) => `- ${t.type} ₹${Math.round(t.amount)} ${t.note}`)
    .join("\n");
  const notes = snapshot.notes.slice(0, 8).map((n) => n.title).join(", ");
  const plans = snapshot.plans.slice(0, 8).map((p) => p.title).join(", ");
  return `Open (${open.length}, ${overdue.length} overdue, ${today.length} today):\n${openLines || "(none)"}
This month paisa: in ${Math.round(money.income)} out ${Math.round(money.expense)} net ${Math.round(money.net)}
Recent paisa:\n${txLines || "(none)"}
Notes: ${notes || "(none)"}
Plans: ${plans || "(none)"}`;
}

function sandyPrompt(user: string, snapshot: AssistantSnapshot) {
  const now = new Date();
  return `You are Sandy — a young man who runs SandeshDo. Hinglish. Short. JSON only: {"say":"...","actions":[...]}
Now: ${now.toISOString()}
${appBrief(snapshot)}
User: ${user}`;
}

function extractJsonObject(raw: string): { say?: string; actions?: AssistantAction[] } | null {
  let s = raw.trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?\s*/i, "").replace(/```[\s\S]*$/i, "").trim();
  const tryParse = (chunk: string) => {
    try {
      return JSON.parse(chunk) as { say?: string; actions?: AssistantAction[] };
    } catch {
      return null;
    }
  };
  const direct = tryParse(s);
  if (direct && typeof direct === "object") return direct;
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) return tryParse(s.slice(start, end + 1));
  return null;
}

function parseGeminiText(raw: string): AssistantResult {
  const parsed = extractJsonObject(raw);
  if (!parsed) {
    const say = raw.replace(/^ERR:[\s\S]*/, "").trim().slice(0, 280);
    return { say: say || "Ho gaya.", actions: [], source: "gemini" };
  }
  return {
    say: parsed.say?.trim() || "Ho gaya.",
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    source: "gemini",
  };
}

function polishResult(result: AssistantResult, userText: string): AssistantResult {
  const actions = result.actions.map((action) => {
    if (action.type !== "add_task") return action;
    const polished = polishTask(action.title, action.dueAt, userText);
    return { ...action, title: polished.title, dueAt: polished.dueAt, deadline: polished.deadline };
  });
  return { ...result, actions };
}

async function callLlmRaw(apiKey: string, prompt: string): Promise<string> {
  const key = sanitizeGeminiKey(apiKey);
  const host = typeof window !== "undefined" ? window.SandeshDoHost : undefined;
  const provider = detectLlmProvider(key);

  if (host?.askGemini && provider === "gemini") {
    const raw = host.askGemini(key, prompt);
    if (raw && !raw.startsWith("ERR:")) return raw;
    throw new Error(raw || "native gemini failed");
  }

  if (host?.askHttp && provider !== "gemini") {
    const req = openAiRequest(provider, key, prompt);
    const raw = host.askHttp(req.url, req.authorization, req.body);
    const text = extractAnyLlmText(raw ?? "");
    if (text && !text.startsWith("ERR:")) return text;
    throw new Error(text || "native llm failed");
  }

  try {
    const res = await fetch("/api/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, prompt }),
    });
    const raw = await res.text();
    if (res.status !== 404 && raw && !raw.trim().startsWith("<")) {
      const data = JSON.parse(raw) as { ok?: boolean; text?: string; error?: string };
      if (data.ok && data.text) return data.text;
      if (data.error) throw new Error(data.error);
      if (!res.ok) throw new Error(`AI ${res.status}`);
    }
  } catch (err) {
    if (err instanceof Error && !/fetch|NetworkError|404|Failed to fetch|Unexpected token/i.test(err.message)) {
      throw err;
    }
  }

  const res = await proxyGemini({ data: { key, prompt } });
  if (!res.ok) throw new Error(res.error);
  return res.text;
}

export async function askGemini(prompt: string, apiKey: string, snapshot: AssistantSnapshot): Promise<AssistantResult> {
  const raw = await callLlmRaw(apiKey, sandyPrompt(prompt, snapshot));
  return polishResult(parseGeminiText(raw), prompt);
}

async function askGrokClient(prompt: string, snapshot: AssistantSnapshot, history: string): Promise<AssistantResult | null> {
  const payload = {
    prompt,
    brief: appBrief(snapshot),
    history,
    now: `${new Date().toISOString()} (${new Date().toLocaleString("en-IN")})`,
  };
  try {
    const res = await fetch("/api/sandy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const raw = await res.text();
    if (res.ok && raw && !raw.trim().startsWith("<")) {
      const data = JSON.parse(raw) as { ok?: boolean; text?: string };
      if (data.ok && data.text) return polishResult(parseGeminiText(data.text), prompt);
    }
  } catch {
    /* server fn */
  }
  try {
    const grok = await askSandyBrain({ data: payload });
    if (grok.ok) return polishResult(parseGeminiText(grok.text), prompt);
  } catch {
    /* none */
  }
  return null;
}

export async function testGeminiKey(apiKey: string): Promise<{ ok: boolean; message: string }> {
  const ping = 'Reply with JSON only, no markdown: {"say":"Sandy ready","actions":[]}';
  const empty: AssistantSnapshot = { tasks: [], transactions: [], moneyCategories: [], notes: [], plans: [] };
  try {
    const grok = await askGrokClient(ping, empty, "");
    if (grok?.say) return { ok: true, message: grok.say };
  } catch {
    /* user key */
  }
  const key = sanitizeGeminiKey(apiKey);
  if (!key) return { ok: true, message: "Sandy ready — local Hinglish on." };
  try {
    const via = await generateWithLlm(key, ping);
    if (via.ok) return { ok: true, message: parseGeminiText(via.text).say || "Sandy ready" };
    return { ok: true, message: parseGeminiText(await callLlmRaw(key, ping)).say || "Sandy ready" };
  } catch (err) {
    return { ok: false, message: friendlyLlmError(err instanceof Error ? err.message : "fail") };
  }
}

export async function runAssistant(
  prompt: string,
  apiKey: string,
  snapshot: AssistantSnapshot,
  history = "",
): Promise<AssistantResult> {
  const local = localUnderstand(prompt, snapshot);
  const localAdd = local.actions.find((a) => a.type === "add_task");
  const localSolid =
    local.actions.some((a) => a.type !== "add_task") ||
    (localAdd && localAdd.type === "add_task" && Boolean(localAdd.dueAt));
  const asking = /\?|\b(kaise|why|how|should i|batao|priority|pehle kya|advice|help me|kya karun|kya pehle)\b/i.test(
    prompt,
  );

  const finishRemote = (remote: AssistantResult): AssistantResult => {
    if (localAdd && localAdd.type === "add_task" && remote.actions.length === 0) return local;
    if (localAdd && localAdd.type === "add_task") {
      const remoteAdd = remote.actions.find((a) => a.type === "add_task");
      if (remoteAdd && remoteAdd.type === "add_task") {
        const polished = polishTask(remoteAdd.title || localAdd.title, remoteAdd.dueAt ?? localAdd.dueAt, prompt);
        return {
          say: remote.say || local.say,
          actions: remote.actions.map((a) =>
            a.type === "add_task" ? { ...a, title: polished.title, dueAt: polished.dueAt, deadline: polished.deadline } : a,
          ),
          source: "gemini",
        };
      }
    }
    return remote;
  };

  if (localSolid && !asking) return local;

  const grok = await askGrokClient(prompt, snapshot, history);
  if (grok) return finishRemote(grok);

  if (apiKey.trim()) {
    try {
      return finishRemote(await askGemini(prompt, apiKey.trim(), snapshot));
    } catch {
      if (local.actions.length || local.say) return local;
    }
  }

  if (local.actions.length || local.say) return local;
  const parsed = parseNaturalLanguage(prompt);
  if (parsed.title && parsed.title.length >= 2) {
    return {
      say: parsed.dueAt
        ? `Laga diya: ${parsed.title}. Reminder on.`
        : `Laga diya: ${parsed.title}. Time bhi bolo next time — “kal 5 baje”.`,
      actions: [{ type: "add_task", title: parsed.title, dueAt: parsed.dueAt, deadline: parsed.dueAt }],
      source: "local",
    };
  }
  return {
    say: "Sandy sun raha hoon. Bol — task, paisa, report. Jaise “Yash ka video aaj sham ko khatam karna hai”.",
    actions: [],
    source: "local",
  };
}
