import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { selectDayLoad, useApp } from "@/lib/store";
import { dayKey } from "@/lib/time";
import { TaskRow } from "@/components/task-row";
import { Button, IconButton } from "@/components/ui";
import { ViewSwitch } from "@/components/view-switch";
import { BrandMark } from "@/components/brand-mark";
import { HeaderActions } from "@/components/header-actions";
import { cn } from "@/lib/utils";
import { formatInr } from "@/lib/money";
import { buildDayLog, dayMoney } from "@/lib/diary";
import { tList, useT } from "@/lib/i18n";

type CalSearch = { d?: string };

export const Route = createFileRoute("/calendar")({
  validateSearch: (s: Record<string, unknown>): CalSearch => ({
    d: typeof s.d === "string" ? s.d : undefined,
  }),
  component: CalendarPage,
});

export function CalendarPage() {
  const { t, locale } = useT();
  const week = tList(locale, "cal.week");
  const search = Route.useSearch();
  const navigate = useNavigate();
  const tasks = useApp((s) => s.tasks);
  const completions = useApp((s) => s.completions);
  const transactions = useApp((s) => s.transactions);
  const plans = useApp((s) => s.plans);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => new Date());
  const now = Date.now();

  useEffect(() => {
    if (!search.d) return;
    const parsed = parseISO(search.d);
    if (Number.isNaN(parsed.getTime())) return;
    setSelected(parsed);
    setCursor(startOfMonth(parsed));
  }, [search.d]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const selectedKey = dayKey(selected);
  const load = useMemo(
    () => selectDayLoad(tasks, completions, plans, transactions),
    [tasks, completions, plans, transactions],
  );
  const remainingCount = load.remaining.get(selectedKey) ?? 0;
  const finishedCount = load.finished.get(selectedKey) ?? 0;
  const plannedCount = load.planned.get(selectedKey) ?? 0;
  const money = useMemo(() => dayMoney(transactions, selectedKey), [transactions, selectedKey]);
  const log = useMemo(
    () => buildDayLog(tasks, completions, transactions, selectedKey, now, plans).sort((a, b) => a.at - b.at),
    [tasks, completions, transactions, plans, selectedKey, now],
  );
  const openToday = tasks.filter((row) => row.status !== "completed" && row.dueAt && dayKey(row.dueAt) === selectedKey);

  const addForDay = () => {
    window.dispatchEvent(
      new CustomEvent("sandeshdo:quick-add", { detail: { date: format(selected, "yyyy-MM-dd") } }),
    );
  };

  const jumpToday = () => {
    const d = new Date();
    setSelected(d);
    setCursor(startOfMonth(d));
  };

  return (
    <main className="overflow-x-hidden px-5 pt-5 pb-8">
      <header className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <BrandMark compact />
          <HeaderActions />
        </div>
        <div className="mt-3">
          <ViewSwitch current="cal" />
        </div>
        <div className="mt-5 flex items-center justify-between gap-2">
          <h1 className="font-display min-w-0 text-[1.85rem] leading-none font-medium tracking-tight">
            {format(cursor, "MMMM yyyy")}
          </h1>
          <div className="flex shrink-0 items-center">
            <IconButton className="size-10" onClick={() => setCursor((d) => subMonths(d, 1))} aria-label="Previous month">
              <ChevronLeft className="size-5" />
            </IconButton>
            <button
              type="button"
              onClick={jumpToday}
              className="h-10 px-2 text-sm font-semibold text-primary whitespace-nowrap"
            >
              {t("cal.todayJump")}
            </button>
            <IconButton className="size-10" onClick={() => setCursor((d) => addMonths(d, 1))} aria-label="Next month">
              <ChevronRight className="size-5" />
            </IconButton>
          </div>
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl bg-surface px-1 pt-2 pb-1 shadow-[var(--sd-card-shadow)]">
        <div className="grid grid-cols-7 text-center">
          {week.map((d) => (
            <div key={d} className="py-2 text-micro font-semibold tracking-wider text-subtle uppercase">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const key = dayKey(d);
            const selectedDay = key === selectedKey;
            const inMonth = isSameMonth(d, cursor);
            const remain = load.remaining.get(key) ?? 0;
            const done = load.finished.get(key) ?? 0;
            const planN = load.planned.get(key) ?? 0;
            const moneyN = load.money.get(key) ?? 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(d)}
                className={cn(
                  "flex h-[3.35rem] min-w-0 flex-col items-center justify-start gap-1 rounded-xl px-0.5 pt-1 text-left transition-colors duration-150",
                  selectedDay && "bg-primary/12",
                  !inMonth && "opacity-35",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                    isToday(d) && "bg-primary text-primary-fg",
                    selectedDay && !isToday(d) && "bg-fg text-bg",
                    !isToday(d) && !selectedDay && inMonth && "text-fg",
                    !inMonth && "text-subtle",
                  )}
                >
                  {format(d, "d")}
                </span>
                <span className="flex h-1.5 items-center justify-center gap-0.5">
                  {remain > 0 && <span className="size-1.5 rounded-full bg-primary" />}
                  {planN > 0 && <span className="size-1.5 rounded-full bg-high" />}
                  {moneyN > 0 && remain === 0 && planN === 0 && <span className="size-1.5 rounded-full bg-snooze" />}
                  {done > 0 && remain === 0 && planN === 0 && moneyN === 0 && (
                    <span className="size-1.5 rounded-full bg-fg/35" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display truncate text-xl font-medium tracking-tight">{format(selected, "EEEE d MMM")}</h2>
          <p className="mt-1 text-xs text-muted tabular-nums">
            {t("cal.leftChip", { n: remainingCount })} · {t("cal.doneChip", { n: finishedCount })}
            {plannedCount > 0 ? ` · ${t("cal.plansChip", { n: plannedCount })}` : ""}
            {money.expense + money.income > 0 ? ` · ${formatInr(money.income - money.expense)}` : ""}
          </p>
        </div>
        <Button size="sm" className="shrink-0" onClick={addForDay}>
          <Plus className="size-3.5" />
          {t("cal.addFor")}
        </Button>
      </div>

      <section className="mt-4">
        {openToday.length === 0 && log.length === 0 ? (
          <button
            type="button"
            onClick={addForDay}
            className="w-full rounded-2xl bg-surface px-4 py-8 text-center shadow-[var(--sd-card-shadow)]"
          >
            <p className="text-sm text-muted">{t("cal.emptyOpen")}</p>
            <p className="mt-2 text-sm font-semibold text-primary">{t("cal.addFor")}</p>
          </button>
        ) : (
          <div className="space-y-1.5">
            {openToday.map((task) => (
              <TaskRow key={task.id} task={task} now={now} timeline />
            ))}
            {log
              .filter((entry) => entry.kind !== "open")
              .map((entry) => (
                <div key={`${entry.kind}-${entry.id}`} className="grid grid-cols-[4.25rem_1fr] items-center gap-2 py-1">
                  <span className="text-xs text-muted tabular-nums" suppressHydrationWarning>
                    {entry.kind === "plan" ? format(entry.at, "d MMM") : format(entry.at, "h:mm a")}
                  </span>
                  <button
                    type="button"
                    className="flex min-w-0 items-center justify-between gap-2 rounded-2xl bg-surface px-3 py-2.5 text-left shadow-[var(--sd-card-shadow)]"
                    onClick={() => {
                      if (entry.kind === "plan") void navigate({ to: "/plans" });
                    }}
                  >
                    <span
                      className={cn(
                        "truncate text-sm",
                        entry.kind === "done" && "text-muted",
                        entry.kind === "plan" && "done" in entry && entry.done && "text-muted line-through",
                      )}
                    >
                      {entry.title}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-xs font-semibold tabular-nums",
                        entry.kind === "in" && "text-primary",
                        entry.kind === "done" && "text-done",
                        entry.kind === "plan" && "text-high",
                      )}
                    >
                      {entry.kind === "done"
                        ? t("cal.finished")
                        : entry.kind === "plan"
                          ? "cost" in entry && entry.cost
                            ? formatInr(entry.cost)
                            : t("cal.plan")
                          : "amount" in entry
                            ? `${entry.kind === "in" ? "+" : "−"}${formatInr(entry.amount)}`
                            : ""}
                    </span>
                  </button>
                </div>
              ))}
          </div>
        )}
      </section>
    </main>
  );
}
