import type { Budget, MoneyCategory, Transaction, TxType } from "./types";

export const DEFAULT_MONEY_CATEGORIES: MoneyCategory[] = [
  { id: "food", name: "Food", kind: "out" },
  { id: "food-tiffin", name: "Tiffin", kind: "out", parentId: "food" },
  { id: "food-out", name: "Eating out", kind: "out", parentId: "food" },
  { id: "food-grocery", name: "Groceries", kind: "out", parentId: "food" },
  { id: "food-chai", name: "Chai & snacks", kind: "out", parentId: "food" },
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

const FOOD_SUBS: MoneyCategory[] = DEFAULT_MONEY_CATEGORIES.filter((c) => c.parentId === "food");

export const DEFAULT_BUDGETS: Budget[] = [];

export function isDemoBudgets(budgets: Budget[]): boolean {
  if (!budgets.length) return false;
  const map = Object.fromEntries(budgets.map((b) => [b.category, b.limit]));
  if (map.food !== 8000 || map.bills !== 12000 || map.travel !== 3000) return false;
  const extras = budgets.filter((b) => !["food", "bills", "travel", "shopping", "health", "fun"].includes(b.category));
  return extras.length === 0;
}

const NOTE_TO_CAT: Array<{ re: RegExp; id: string }> = [
  { re: /\b(tiffin|thali|dabba|mess|canteen)\b/i, id: "food-tiffin" },
  { re: /\b(swiggy|zomato|restaurant|hotel|dine|eating out)\b/i, id: "food-out" },
  { re: /\b(grocery|kirana|sabzi|vegetables|ration|bazaar)\b/i, id: "food-grocery" },
  { re: /\b(chai|coffee|tea|snack|samosa|biscuit|cutting)\b/i, id: "food-chai" },
  { re: /\b(lunch|dinner|breakfast|food|khana|pizza|biryani)\b/i, id: "food" },
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
  return ensureMoneyCats(cats);
}

export function ensureMoneyCats(cats: MoneyCategory[]): MoneyCategory[] {
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
  if (!list.some((c) => c.id === "food")) {
    list.unshift({ id: "food", name: "Food", kind: "out" });
  }
  const foodIdx = list.findIndex((c) => c.id === "food");
  let insertAt = foodIdx >= 0 ? foodIdx + 1 : list.length;
  for (const sub of FOOD_SUBS) {
    const existing = list.find((c) => c.id === sub.id);
    if (existing) {
      if (!existing.parentId) existing.parentId = "food";
      continue;
    }
    list.splice(insertAt, 0, { ...sub });
    insertAt += 1;
  }
  return list;
}

export function parentCats(cats: MoneyCategory[], kind?: TxType): MoneyCategory[] {
  return cats.filter((c) => {
    if (c.parentId) return false;
    if (!kind) return true;
    return kind === "income" ? c.kind !== "out" : c.kind !== "in";
  });
}

export function childCats(cats: MoneyCategory[], parentId: string): MoneyCategory[] {
  return cats.filter((c) => c.parentId === parentId);
}

export function rootCatId(cats: MoneyCategory[], id: string): string {
  const cat = cats.find((c) => c.id === id);
  return cat?.parentId || id;
}

export function catGroupIds(cats: MoneyCategory[], id: string): string[] {
  const kids = cats.filter((c) => c.parentId === id).map((c) => c.id);
  return [id, ...kids];
}

export function monthCatSpend(tx: Transaction[], ids: string[], month = monthKey()): number {
  const set = new Set(ids);
  let n = 0;
  for (const t of tx) {
    if (t.type !== "expense") continue;
    if (monthKey(t.at) !== month) continue;
    if (set.has(t.category)) n += t.amount;
  }
  return n;
}

function envelopeCaps(budgets: Budget[], cats: MoneyCategory[]): Budget[] {
  if (!cats.length) return budgets;
  const parentCapped = new Set(
    budgets
      .filter((b) => {
        const c = cats.find((x) => x.id === b.category);
        return Boolean(c && !c.parentId && b.limit > 0);
      })
      .map((b) => b.category),
  );
  return budgets.filter((b) => {
    const c = cats.find((x) => x.id === b.category);
    if (!c?.parentId) return true;
    return !parentCapped.has(c.parentId);
  });
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

export function budgetLeft(
  tx: Transaction[],
  budgets: Budget[],
  month = monthKey(),
  cats: MoneyCategory[] = [],
) {
  const { expense, income, byCat } = monthTotals(tx, month);
  const cap = envelopeCaps(budgets, cats).reduce((n, b) => n + b.limit, 0);
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
