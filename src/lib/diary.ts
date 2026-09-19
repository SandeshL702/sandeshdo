import type { Completion, Plan, Task, Transaction } from "./types";
import { dayKey } from "./time";
import { liveStatus } from "./engine";

export type DayEntry =
  | { kind: "done"; at: number; title: string; id: string }
  | { kind: "open"; at: number; title: string; id: string }
  | { kind: "plan"; at: number; title: string; id: string; cost?: number | null; done?: boolean }
  | { kind: "in"; at: number; title: string; id: string; amount: number }
  | { kind: "out"; at: number; title: string; id: string; amount: number };

export function dayMoney(transactions: Transaction[], key: string) {
  let income = 0;
  let expense = 0;
  const rows: Transaction[] = [];
  for (const tx of transactions) {
    if (dayKey(tx.at) !== key) continue;
    rows.push(tx);
    if (tx.type === "income") income += tx.amount;
    else expense += tx.amount;
  }
  rows.sort((a, b) => b.at - a.at);
  return { income, expense, net: income - expense, rows };
}

export function groupTxByDay(transactions: Transaction[]) {
  const map = new Map<string, Transaction[]>();
  const sorted = [...transactions].sort((a, b) => b.at - a.at);
  for (const tx of sorted) {
    const key = dayKey(tx.at);
    const list = map.get(key);
    if (list) list.push(tx);
    else map.set(key, [tx]);
  }
  return [...map.entries()];
}

export function buildDayLog(
  tasks: Task[],
  completions: Completion[],
  transactions: Transaction[],
  key: string,
  now = Date.now(),
  plans: Plan[] = [],
): DayEntry[] {
  const entries: DayEntry[] = [];
  for (const c of completions) {
    if (c.undoneAt) continue;
    if (dayKey(c.completedAt) !== key) continue;
    entries.push({ kind: "done", at: c.completedAt, title: c.title, id: c.id });
  }
  for (const t of tasks) {
    if (t.status === "completed") continue;
    if (!t.dueAt || dayKey(t.dueAt) !== key) continue;
    const st = liveStatus(t, now);
    if (st === "completed") continue;
    entries.push({ kind: "open", at: t.dueAt, title: t.title, id: t.id });
  }
  for (const p of plans) {
    if (!p.when || dayKey(p.when) !== key) continue;
    entries.push({ kind: "plan", at: p.when, title: p.title, id: p.id, cost: p.cost, done: p.done });
  }
  for (const tx of transactions) {
    if (dayKey(tx.at) !== key) continue;
    entries.push({
      kind: tx.type === "income" ? "in" : "out",
      at: tx.at,
      title: tx.note || tx.category,
      id: tx.id,
      amount: tx.amount,
    });
  }
  return entries.sort((a, b) => b.at - a.at);
}
