import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  const tasks = useApp((s) => s.tasks);
  const completions = useApp((s) => s.completions);
  const transactions = useApp((s) => s.transactions);
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
  const load = useMemo(() => selectDayLoad(tasks, completions), [tasks, completions]);
  const remainingCount = load.remaining.get(selectedKey) ?? 0;
  const finishedCount = load.finished.get(selectedKey) ?? 0;
  const money = useMemo(() => dayMoney(transactions, selectedKey), [transactions, selectedKey]);
  const log = useMemo(
    () => buildDayLog(tasks, completions, transactions, selectedKey, now).sort((a, b) => a.at - b.at),
    [tasks, completions, transactions, selectedKey, now],
  );

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
          <div className="min-w-0">
            <h1 className="font-display text-title leading-none font-medium tracking-tight">{format(cursor, "MMMM")}</h1>
            <p className="mt-1 text-sm font-semibold tabular-nums text-muted">{format(cursor, "yyyy")}</p>
          </div>
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

      <div className="overflow-hidden rounded-xl">
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
            const titles = load.openTitles.get(key) ?? [];
            const extra = Math.max(0, (load.remaining.get(key) ?? 0) - titles.length);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(d)}
                className={cn(
                  "flex h-20 min-w-0 flex-col items-stretch overflow-hidden rounded-lg px-0.5 py-1 text-left transition-colors duration-150",
                  selectedDay && "bg-primary/10",
                  !inMonth && "opacity-40",
                )}
              >
                <span className="flex justify-center">
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                      isToday(d) && "bg-primary text-primary-fg",
                      selectedDay && !isToday(d) && "ring-2 ring-primary ring-inset",
                      !isToday(d) && inMonth && "text-fg",
                      !inMonth && "text-subtle",
                    )}
                  >
                    {format(d, "d")}
                  </span>
                </span>
                <span className="mt-0.5 min-h-0 flex-1 space-y-0.5 overflow-hidden px-0.5">
                  {titles.map((title) => (
                    <span
                      key={title}
                      className="block truncate rounded-sm bg-primary/15 px-1 text-micro leading-4 font-medium text-primary"
                    >
                      {title}
                    </span>
                  ))}
                  {extra > 0 && <span className="block px-1 text-micro leading-4 text-subtle">+{extra}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display truncate text-xl font-medium tracking-tight">{format(selected, "EEE d MMM")}</h2>
          <p className="mt-1 text-xs text-muted tabular-nums">
            {t("cal.leftChip", { n: remainingCount })} · {t("cal.doneChip", { n: finishedCount })}
            {money.expense + money.income > 0 ? ` · ${formatInr(money.income - money.expense)}` : ""}
          </p>
        </div>
        <Button size="sm" className="shrink-0" onClick={addForDay}>
          {t("cal.addFor")}
        </Button>
      </div>

      <section className="mt-4">
        {log.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">{t("cal.emptyOpen")}</p>
        ) : (
          <div className="space-y-1.5">
            {log.map((entry) => {
              if (entry.kind === "open") {
                const task = tasks.find((row) => row.id === entry.id);
                if (task) return <TaskRow key={entry.id} task={task} now={now} timeline />;
              }
              return (
                <div key={`${entry.kind}-${entry.id}`} className="grid grid-cols-[4.25rem_1fr] items-center gap-2 py-1">
                  <span className="text-xs text-muted tabular-nums" suppressHydrationWarning>
                    {format(entry.at, "h:mm a")}
                  </span>
                  <div className="flex min-w-0 items-center justify-between gap-2 rounded-2xl bg-surface px-3 py-2.5 shadow-[var(--sd-card-shadow)]">
                    <span className={cn("truncate text-sm", entry.kind === "done" && "text-muted")}>{entry.title}</span>
                    <span
                      className={cn(
                        "shrink-0 text-xs font-semibold tabular-nums",
                        entry.kind === "in" && "text-primary",
                        entry.kind === "done" && "text-done",
                      )}
                    >
                      {entry.kind === "done"
                        ? t("cal.finished")
                        : "amount" in entry
                          ? `${entry.kind === "in" ? "+" : "−"}${formatInr(entry.amount)}`
                          : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
