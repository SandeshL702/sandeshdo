import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format, isToday, isYesterday } from "date-fns";
import { Button, Input, SectionLabel } from "@/components/ui";
import { useApp } from "@/lib/store";
import { budgetLeft, formatInr, moneyCatLabel, monthKey, spendByDay } from "@/lib/money";
import { groupTxByDay } from "@/lib/diary";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";
import { HeaderActions } from "@/components/header-actions";

export const Route = createFileRoute("/money")({ component: MoneyPage });

export function MoneyPage() {
  const { t } = useT();
  const transactions = useApp((s) => s.transactions);
  const budgets = useApp((s) => s.budgets);
  const moneyCategories = useApp((s) => s.moneyCategories);
  const deleteTx = useApp((s) => s.deleteTx);
  const setBudget = useApp((s) => s.setBudget);
  const month = monthKey();
  const stats = useMemo(() => budgetLeft(transactions, budgets, month), [transactions, budgets, month]);
  const [editing, setEditing] = useState<string | null>(null);
  const [limitDraft, setLimitDraft] = useState("");
  const groups = useMemo(() => groupTxByDay(transactions).slice(0, 8), [transactions]);
  const remaining = stats.remaining;
  const usedPct = stats.cap > 0 ? Math.min(100, Math.round((stats.expense / stats.cap) * 100)) : 0;
  const daily = useMemo(() => spendByDay(transactions, 14), [transactions]);
  const maxSpend = Math.max(1, ...daily.map((d) => d.spent));
  const todayRow = daily[daily.length - 1];


  const dayLabel = (key: string) => {
    const d = new Date(`${key}T12:00:00`);
    if (isToday(d)) return t("money.today");
    if (isYesterday(d)) return t("money.yesterday");
    return format(d, "EEE d MMM");
  };

  return (
    <main className="overflow-x-hidden px-5 pt-5 pb-8">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <BrandMark compact />
          <h1 className="font-display mt-3 text-title leading-none font-medium tracking-tight">{t("money.month")}</h1>
          <p className="mt-1.5 text-sm text-muted">{format(new Date(), "MMMM yyyy")}</p>
        </div>
        <HeaderActions />
      </div>

      <section className="mt-6 overflow-hidden rounded-[1.75rem] bg-fg px-5 py-6 text-bg shadow-[var(--sd-dock-shadow)]">
        <p className="text-[11px] font-semibold tracking-[0.16em] uppercase opacity-70">
          {remaining >= 0 ? t("money.left") : t("money.over")}
        </p>
        <div className="font-display mt-2 text-5xl leading-none font-medium tracking-tight tabular-nums">
          {formatInr(remaining)}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="opacity-70">{t("money.in")}</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums">{formatInr(stats.income)}</div>
          </div>
          <div>
            <div className="opacity-70">{t("money.out")}</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums">{formatInr(stats.expense)}</div>
          </div>
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-bg/20">
          <div className="h-full rounded-full bg-bg" style={{ width: `${usedPct}%` }} />
        </div>
        <p className="mt-2 text-xs opacity-70 tabular-nums">{t("money.used", { n: usedPct })}</p>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("sandeshdo:money-add", { detail: { type: "income" } }))
          }
          className="h-16 rounded-[1.35rem] bg-primary text-primary-fg shadow-[var(--sd-card-shadow)]"
        >
          <span className="block text-[11px] font-semibold tracking-[0.14em] uppercase opacity-80">
            {t("money.got")}
          </span>
          <span className="font-display text-2xl font-medium">{t("money.aaya")}</span>
        </button>
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("sandeshdo:money-add", { detail: { type: "expense" } }))
          }
          className="h-16 rounded-[1.35rem] bg-urgent text-urgent-fg shadow-[var(--sd-card-shadow)]"
        >
          <span className="block text-[11px] font-semibold tracking-[0.14em] uppercase opacity-80">
            {t("money.spent")}
          </span>
          <span className="font-display text-2xl font-medium">{t("money.gaya")}</span>
        </button>
      </div>

      <section className="mt-6">
        <SectionLabel>{t("money.daily")}</SectionLabel>
        <div className="mt-3 rounded-[1.35rem] bg-surface px-4 py-4 shadow-[var(--sd-card-shadow)]">
          <div className="flex h-28 items-end gap-1">
            {daily.map((d) => (
              <div key={d.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <div className="flex h-24 w-full items-end justify-center">
                  <div
                    className="w-full max-w-4 rounded-t-md bg-primary"
                    style={{ height: `${Math.max(4, Math.round((d.spent / maxSpend) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-micro font-semibold text-subtle">
            <span>{daily[0]?.label}</span>
            <span>{todayRow?.label}</span>
          </div>
          <p className="mt-3 text-sm text-muted">
            {t("money.todaySpend")} · {formatInr(todayRow?.spent ?? 0)}
          </p>
        </div>
      </section>

      <section className="mt-8">
        <SectionLabel>{t("money.title")}</SectionLabel>
        {groups.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t("money.empty")}</p>
        ) : (
          <div className="space-y-5">
            {groups.map(([key, rows]) => (
              <div key={key}>
                <p className="mb-2 px-1 text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
                  {dayLabel(key)}
                </p>
                <div className="space-y-1.5">
                  {rows.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center gap-3 rounded-2xl bg-surface px-3 py-3 shadow-[var(--sd-card-shadow)]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{row.note}</div>
                        <div className="mt-0.5 text-xs text-muted">
                          {moneyCatLabel(moneyCategories, row.category, t)} · {format(row.at, "h:mm a")}
                        </div>
                      </div>
                      <div
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          row.type === "income" ? "text-primary" : "text-fg",
                        )}
                      >
                        {row.type === "income" ? "+" : "−"}
                        {formatInr(row.amount)}
                      </div>
                      <button type="button" className="h-10 px-1 text-xs text-muted" onClick={() => deleteTx(row.id)}>
                        {t("money.undo")}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <SectionLabel>{t("money.budgets")}</SectionLabel>
        <div className="space-y-2">
          {moneyCategories
            .filter((c) => c.kind !== "in")
            .map((c) => {
            const spent = stats.byCat.get(c.id) ?? 0;
            const limit = budgets.find((b) => b.category === c.id)?.limit ?? 0;
            const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
            return (
              <div key={c.id} className="sd-card rounded-2xl px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{moneyCatLabel(moneyCategories, c.id, t)}</div>
                    <div className="text-xs text-muted tabular-nums">
                      {formatInr(spent)}
                      {limit > 0 ? ` / ${formatInr(limit)}` : ` · ${t("money.noCap")}`}
                    </div>
                  </div>
                  {editing === c.id ? (
                    <form
                      className="flex items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        setBudget(c.id, Number(limitDraft) || 0);
                        setEditing(null);
                      }}
                    >
                      <Input
                        className="h-10 w-24"
                        inputMode="numeric"
                        value={limitDraft}
                        onChange={(e) => setLimitDraft(e.target.value)}
                        autoFocus
                      />
                      <Button size="sm" type="submit">
                        {t("money.set")}
                      </Button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="h-10 px-2 text-xs font-medium text-muted"
                      onClick={() => {
                        setEditing(c.id);
                        setLimitDraft(String(limit || ""));
                      }}
                    >
                      {t("money.edit")}
                    </button>
                  )}
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-fg/8">
                  <div className={cn("h-full rounded-full", pct >= 100 ? "bg-urgent" : "bg-primary")} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
