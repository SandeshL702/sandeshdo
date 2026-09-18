import type { Budget, MoneyCategory, Transaction, TxType } from "./types";

export const DEFAULT_MONEY_CATEGORIES: MoneyCategory[] = [
  { id: "food", name: "Food", kind: "out" },
  { id: "travel", name: "Travel", kind: "out" },
  { id: "bills", name: "Bills", kind: "out" },
  { id: "shopping", name: "Shopping", kind: "out" },
  { id: "health", name: "Health", kind: "out" },
  { id: "fun", name: "Fun", kind: "out" },
  { id: "salary", name: "Salary", kind: "in" },
  { id: "freelance", name: "Freelance", kind: "in" },
  { id: "client", name: "Client", kind: "in" },
  { id: "other", name: "Other", kind: "both" },
];

export const DEFAULT_BUDGETS: Budget[] = [
  { category: "food", limit: 8000 },
  { category: "bills", limit: 12000 },
  { category: "travel", limit: 3000 },
  { category: "shopping", limit: 4000 },
  { category: "fun", limit: 2000 },
  { category: "health", limit: 2000 },
];

const NOTE_TO_CAT: Array<{ re: RegExp; id: string }> = [
  { re: /\b(lunch|dinner|breakfast|food|chai|coffee|swiggy|zomato|snack|khana|pizza|biryani)\b/i, id: "food" },
  { re: /\b(uber|ola|petrol|metro|auto|bus|train|travel|fuel|cab)\b/i, id: "travel" },
  { re: /\b(electricity|rent|wifi|recharge|bill|emi|gas|water)\b/i, id: "bills" },
  { re: /\b(amazon|flipkart|clothes|shopping|myntra)\b/i, id: "shopping" },
  { re: /\b(gym|medicine|doctor|health|pharmacy)\b/i, id: "health" },
  { re: /\b(movie|netflix|game|fun|outing)\b/i, id: "fun" },
  { re: /\b(freelance|gig|upwork|fiverr|contract)\b/i, id: "freelance" },
  { re: /\b(client|invoice|retainer|project fee)\b/i, id: "client" },
  { re: /\b(salary|stipend|payroll)\b/i, id: "salary" },
];

export function ensureIncomeCats(cats: MoneyCategory[]): MoneyCategory[] {
  const list = cats.length ? [...cats] : [...DEFAULT_MONEY_CATEGORIES];
  const extras: MoneyCategory[] = [
    { id: "freelance", name: "Freelance", kind: "in" },
    { id: "client", name: "Client", kind: "in" },
  ];
  for (const extra of extras) {
    if (list.some((c) => c.id === extra.id)) continue;
    const otherIdx = list.findIndex((c) => c.id === "other");
    if (otherIdx >= 0) list.splice(otherIdx, 0, extra);
    else list.push(extra);
  }
  return list;
}

export function catsForType(cats: MoneyCategory[], type: TxType): MoneyCategory[] {
  return cats.filter((c) => (type === "income" ? c.kind !== "out" : c.kind !== "in"));
}

export function moneyCatLabel(
  cats: MoneyCategory[],
  id: string,
  translate: (key: string) => string,
): string {
  const cat = cats.find((c) => c.id === id);
  const def = DEFAULT_MONEY_CATEGORIES.find((c) => c.id === id);
  if (cat) {
    if (def && cat.name === def.name) {
      const key = `cat.${id}`;
      const label = translate(key);
      return label === key ? cat.name : label;
    }
    return cat.name;
  }
  if (def) {
    const key = `cat.${id}`;
    const label = translate(key);
    return label === key ? def.name : label;
  }
  return id;
}

export function guessCategory(note: string, type: TxType, cats: MoneyCategory[] = DEFAULT_MONEY_CATEGORIES): string {
  const allowed = catsForType(cats, type);
  const fallback =
    allowed.find((c) => c.id === (type === "income" ? "salary" : "other"))?.id ?? allowed[0]?.id ?? "other";
  if (type === "income") {
    for (const row of NOTE_TO_CAT) {
      if (row.id !== "salary" && row.id !== "freelance" && row.id !== "client") continue;
      if (row.re.test(note) && allowed.some((c) => c.id === row.id)) return row.id;
    }
    const named = allowed.find((c) => c.id !== "salary" && c.id !== "other" && c.name && note.toLowerCase().includes(c.name.toLowerCase()));
    if (named) return named.id;
    return fallback;
  }
  for (const row of NOTE_TO_CAT) {
    if (row.id === "salary") continue;
    if (row.re.test(note) && allowed.some((c) => c.id === row.id)) return row.id;
  }
  return fallback;
}

export function monthKey(at = Date.now()): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatInr(n: number): string {
  const abs = Math.abs(Math.round(n));
  const formatted = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(abs);
  return n < 0 ? `−₹${formatted}` : `₹${formatted}`;
}

export function monthTotals(tx: Transaction[], month = monthKey()) {
  let income = 0;
  let expense = 0;
  const byCat = new Map<string, number>();
  const inByCat = new Map<string, number>();
  for (const t of tx) {
    if (monthKey(t.at) !== month) continue;
    if (t.type === "income") {
      income += t.amount;
      inByCat.set(t.category, (inByCat.get(t.category) ?? 0) + t.amount);
    } else {
      expense += t.amount;
      byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount);
    }
  }
  return { income, expense, net: income - expense, byCat, inByCat };
}

export function budgetLeft(tx: Transaction[], budgets: Budget[], month = monthKey()) {
  const { expense, income, byCat } = monthTotals(tx, month);
  const cap = budgets.reduce((n, b) => n + b.limit, 0);
  const remaining = cap > 0 ? cap - expense : income - expense;
  return { expense, income, cap, remaining, byCat };
}

export function spendByDay(tx: Transaction[], days = 14, now = Date.now()) {
  const rows: { key: string; label: string; spent: number; got: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    let spent = 0;
    let got = 0;
    for (const t of tx) {
      const at = new Date(t.at);
      const k = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
      if (k !== key) continue;
      if (t.type === "expense") spent += t.amount;
      else got += t.amount;
    }
    rows.push({
      key,
      label: d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" }),
      spent,
      got,
    });
  }
  return rows;
}
