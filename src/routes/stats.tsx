import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format, startOfDay, subDays } from "date-fns";
import { BrandMark } from "@/components/brand-mark";
import { HeaderActions } from "@/components/header-actions";
import { selectStats, useApp } from "@/lib/store";
import { formatInr, moneyCatLabel, monthKey, monthTotals } from "@/lib/money";
import { dayKey } from "@/lib/time";
import { liveStatus } from "@/lib/engine";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/stats")({
  component: ReportPage,
});

export function ReportPage() {
  const { t } = useT();
  const tasks = useApp((s) => s.tasks);
  const completions = useApp((s) => s.completions);
  const transactions = useApp((s) => s.transactions);
  const moneyCategories = useApp((s) => s.moneyCategories);
  const now = Date.now();
  const stats = useMemo(() => selectStats(tasks, completions, now), [tasks, completions, now]);
  const money = useMemo(() => monthTotals(transactions), [transactions]);
  const week = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = subDays(startOfDay(now), 6 - i);
      const key = dayKey(day.getTime());
      const done = completions.filter((c) => dayKey(c.completedAt) === key).length;
      const spend = transactions
        .filter((tx) => tx.type === "expense" && dayKey(tx.at) === key)
        .reduce((n, tx) => n + tx.amount, 0);
      const got = transactions
        .filter((tx) => tx.type === "income" && dayKey(tx.at) === key)
        .reduce((n, tx) => n + tx.amount, 0);
      return { key, label: format(day, "EEEEE"), done, spend, got };
    });
  }, [completions, transactions, now]);
  const maxDone = Math.max(1, ...week.map((d) => d.done));
  const spendRows = [...money.byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const gotRows = [...money.inByCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxSpend = Math.max(1, ...spendRows.map((r) => r[1]));
  const maxGot = Math.max(1, ...gotRows.map((r) => r[1]));
  const open = tasks.filter((t) => t.status !== "completed").length;
  const overdue = tasks.filter((t) => t.status !== "completed" && liveStatus(t, now) === "overdue").length;
  const analysis = (() => {
    if (open === 0 && money.expense === 0 && money.income === 0) return t("report.emptyHint");
    if (overdue > 0) return t("report.overdueHint", { n: overdue });
    if (money.net < 0) return t("report.spendHint", { n: formatInr(Math.abs(money.net)) });
    if (stats.completedToday > 0) return t("report.goodHint", { n: stats.completedToday });
    return t("report.steadyHint");
  })();

  return (
    <main className="overflow-x-hidden px-5 pt-5 pb-8">
      <header className="mb-5 flex items-center justify-between gap-3">
        <BrandMark compact />
        <HeaderActions />
      </header>
      <h1 className="font-display text-title leading-none font-medium tracking-tight">{t("report.title")}</h1>
      <p className="mt-1.5 text-sm text-muted">{format(now, "EEEE d MMM")} · {monthKey()}</p>
      <p className="mt-4 text-sm text-fg">{analysis}</p>

      <section className="mt-5 grid grid-cols-2 gap-2">
        <StatCard label={t("stats.finishedToday")} value={stats.completedToday} />
        <StatCard label={t("stats.thisWeek")} value={stats.completedWeek} />
        <StatCard label={t("stats.overdue")} value={overdue} warn={overdue > 0} />
        <StatCard label={t("stats.rate")} value={`${stats.rate}%`} />
      </section>

      <section className="mt-6">
        <h2 className="text-micro font-semibold tracking-[0.14em] text-muted uppercase">{t("report.weekTasks")}</h2>
        <div className="mt-3 flex h-32 items-end gap-1.5">
          {week.map((d) => (
            <div key={d.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="flex h-24 w-full items-end justify-center">
                <div
                  className="w-full max-w-7 rounded-t-md bg-primary"
                  style={{ height: `${Math.max(6, Math.round((d.done / maxDone) * 100))}%` }}
                />
              </div>
              <span className="text-micro font-semibold text-subtle">{d.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-[1.75rem] bg-fg px-5 py-5 text-bg shadow-[var(--sd-dock-shadow)]">
        <p className="text-micro font-semibold tracking-[0.16em] uppercase opacity-70">{t("report.paisaMonth")}</p>
        <div className="font-display mt-2 text-4xl leading-none font-medium tracking-tight tabular-nums">
          {formatInr(money.net)}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="opacity-70">{t("money.in")}</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums">{formatInr(money.income)}</div>
          </div>
          <div>
            <div className="opacity-70">{t("money.out")}</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums">{formatInr(money.expense)}</div>
          </div>
        </div>
      </section>

      {gotRows.length > 0 && (
        <section className="mt-6">
          <h2 className="text-micro font-semibold tracking-[0.14em] text-muted uppercase">{t("report.gotCats")}</h2>
          <div className="mt-3 space-y-2.5">
            {gotRows.map(([id, n]) => (
              <BarRow
                key={id}
                label={moneyCatLabel(moneyCategories, id, t)}
                value={formatInr(n)}
                pct={Math.round((n / maxGot) * 100)}
                tone="in"
              />
            ))}
          </div>
        </section>
      )}

      {spendRows.length > 0 && (
        <section className="mt-6">
          <h2 className="text-micro font-semibold tracking-[0.14em] text-muted uppercase">{t("report.spendCats")}</h2>
          <div className="mt-3 space-y-2.5">
            {spendRows.map(([id, n]) => (
              <BarRow
                key={id}
                label={moneyCatLabel(moneyCategories, id, t)}
                value={formatInr(n)}
                pct={Math.round((n / maxSpend) * 100)}
                tone="out"
              />
            ))}
          </div>
        </section>
      )}

      {gotRows.length === 0 && spendRows.length === 0 && (
        <p className="mt-6 py-6 text-center text-sm text-muted">{t("report.noMoney")}</p>
      )}
    </main>
  );
}

function StatCard({ label, value, warn = false }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className="min-w-0 rounded-2xl bg-surface px-4 py-4 shadow-[var(--sd-card-shadow)]">
      <div className={cn("font-display text-3xl leading-none font-medium tabular-nums", warn && "text-overdue")}>
        {value}
      </div>
      <div className="mt-1 truncate text-xs text-muted">{label}</div>
    </div>
  );
}

function BarRow({
  label,
  value,
  pct,
  tone,
}: {
  label: string;
  value: string;
  pct: number;
  tone: "in" | "out";
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-medium">{label}</span>
        <span className="shrink-0 text-sm font-semibold tabular-nums">{value}</span>
      </div>
      <div className="sd-bar">
        <div
          className={cn("h-full rounded-full", tone === "in" ? "bg-primary" : "bg-fg/55")}
          style={{ width: `${Math.max(4, pct)}%` }}
        />
      </div>
    </div>
  );
}
