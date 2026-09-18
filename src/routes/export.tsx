import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui";
import { selectStats, useApp } from "@/lib/store";
import { formatInr, moneyCatLabel, monthKey, monthTotals, spendByDay } from "@/lib/money";
import { liveStatus } from "@/lib/engine";
import { useT } from "@/lib/i18n";
import { printPdf } from "@/lib/export-report";

export const Route = createFileRoute("/export")({
  component: ExportPage,
});

export function ExportPage() {
  const { t } = useT();
  const tasks = useApp((s) => s.tasks);
  const completions = useApp((s) => s.completions);
  const transactions = useApp((s) => s.transactions);
  const notes = useApp((s) => s.notes);
  const plans = useApp((s) => s.plans);
  const recurringSpends = useApp((s) => s.recurringSpends);
  const moneyCategories = useApp((s) => s.moneyCategories);
  const now = Date.now();
  const stats = useMemo(() => selectStats(tasks, completions, now), [tasks, completions, now]);
  const money = useMemo(() => monthTotals(transactions), [transactions]);
  const daily = useMemo(() => spendByDay(transactions, 14), [transactions]);
  const open = tasks.filter((row) => row.status !== "completed");
  const overdue = open.filter((row) => liveStatus(row, now) === "overdue");
  const liveDone = completions.filter((c) => !c.undoneAt);
  const analysis = (() => {
    if (open.length === 0 && money.expense === 0 && money.income === 0) return t("report.emptyHint");
    if (overdue.length > 0) return t("report.overdueHint", { n: overdue.length });
    if (money.net < 0) return t("report.spendHint", { n: formatInr(Math.abs(money.net)) });
    if (stats.completedToday > 0) return t("report.goodHint", { n: stats.completedToday });
    return t("report.steadyHint");
  })();
  const spendRows = [...money.byCat.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <main className="overflow-x-hidden px-5 pt-5 pb-8 print:px-0">
      <header className="mb-5 flex items-center justify-between gap-3 print:hidden">
        <BrandMark compact />
        <Link to="/settings" className="text-sm font-semibold text-muted">
          {t("settings.title")}
        </Link>
      </header>
      <h1 className="font-display text-title leading-none font-medium tracking-tight">{t("export.title")}</h1>
      <p className="mt-1.5 text-sm text-muted">
        {format(now, "EEEE d MMM yyyy")} · {monthKey()}
      </p>
      <p className="mt-4 text-sm text-fg">{analysis}</p>

      <div className="mt-5 flex gap-2 print:hidden">
        <Button className="flex-1" onClick={() => printPdf()}>
          {t("export.print")}
        </Button>
      </div>

      <section className="mt-6 grid grid-cols-2 gap-2">
        <Stat label={t("stats.finishedToday")} value={stats.completedToday} />
        <Stat label={t("stats.thisWeek")} value={stats.completedWeek} />
        <Stat label={t("stats.overdue")} value={overdue.length} />
        <Stat label={t("money.net")} value={formatInr(money.net)} />
      </section>

      <section className="mt-8">
        <h2 className="text-micro font-semibold tracking-[0.14em] text-muted uppercase">{t("export.analysis")}</h2>
        <div className="mt-3 sd-card space-y-2 rounded-3xl p-4 text-sm">
          <Row k={t("stats.finishedToday")} v={String(stats.completedToday)} />
          <Row k="Open tasks" v={String(open.length)} />
          <Row k={t("money.in")} v={formatInr(money.income)} />
          <Row k={t("money.out")} v={formatInr(money.expense)} />
          <Row k={t("money.net")} v={formatInr(money.net)} />
          <Row k="Notes" v={String(notes.length)} />
          <Row k="Plans" v={String(plans.length)} />
          <Row k={t("money.repeatList")} v={String(recurringSpends.length)} />
        </div>
      </section>

      {spendRows.length > 0 && (
        <section className="mt-8">
          <h2 className="text-micro font-semibold tracking-[0.14em] text-muted uppercase">{t("money.out")}</h2>
          <div className="mt-3 space-y-1.5">
            {spendRows.map(([id, n]) => (
              <div key={id} className="flex items-center justify-between rounded-2xl bg-surface px-3 py-2 text-sm">
                <span>{moneyCatLabel(moneyCategories, id, t)}</span>
                <span className="tabular-nums">{formatInr(n)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-micro font-semibold tracking-[0.14em] text-muted uppercase">{t("view.done")}</h2>
        <div className="mt-3 space-y-1.5">
          {liveDone.slice(0, 40).map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{c.title}</span>
              <span className="shrink-0 text-xs text-muted tabular-nums">{format(c.completedAt, "d MMM, h:mm a")}</span>
            </div>
          ))}
          {liveDone.length === 0 ? <p className="text-sm text-muted">{t("do.emptyDone")}</p> : null}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-micro font-semibold tracking-[0.14em] text-muted uppercase">{t("money.title")}</h2>
        <div className="mt-3 space-y-1.5">
          {transactions.slice(0, 60).map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">
                {row.note} · {moneyCatLabel(moneyCategories, row.category, t)}
              </span>
              <span className="shrink-0 tabular-nums">
                {row.type === "income" ? "+" : "−"}
                {formatInr(row.amount)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {notes.length > 0 && (
        <section className="mt-8">
          <h2 className="text-micro font-semibold tracking-[0.14em] text-muted uppercase">{t("nav.notes")}</h2>
          <div className="mt-3 space-y-3">
            {notes.map((n) => (
              <div key={n.id}>
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted">{n.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="mt-10 hidden text-xs text-subtle print:block">SandeshDo · {format(now, "d MMM yyyy")}</p>
      <p className="mt-4 hidden text-[10px] text-subtle print:block">
        14-day spend {daily.reduce((n, d) => n + d.spent, 0) ? formatInr(daily.reduce((n, d) => n + d.spent, 0)) : ""}
      </p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="sd-card rounded-2xl px-4 py-3">
      <div className="font-display text-2xl font-medium tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-muted">{label}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted">{k}</span>
      <span className="font-semibold tabular-nums">{v}</span>
    </div>
  );
}
