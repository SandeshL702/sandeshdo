import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { selectCompletionsByDay, selectDayLoad, selectOpenGroups, useApp } from "@/lib/store";
import { TaskRow } from "@/components/task-row";
import { CompletedRow } from "@/components/completed-row";
import { AlertSetup } from "@/components/alert-setup";
import { ViewSwitch } from "@/components/view-switch";
import { WeekStrip } from "@/components/week-strip";
import { BrandMark } from "@/components/brand-mark";
import { HeaderActions } from "@/components/header-actions";
import { Input } from "@/components/ui";
import { dayKey } from "@/lib/time";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

type HomeSearch = { v?: "done" };

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): HomeSearch => ({
    v: s.v === "done" ? "done" : undefined,
  }),
  component: TodayPage,
});

function TodayPage() {
  const { t } = useT();
  const search = Route.useSearch();
  const doneView = search.v === "done";
  const tasks = useApp((s) => s.tasks);
  const completions = useApp((s) => s.completions);
  const settings = useApp((s) => s.settings);
  const reopenTask = useApp((s) => s.reopenTask);
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "overdue" | "today" | "inbox">("all");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const groups = useMemo(() => selectOpenGroups(tasks, now), [tasks, now]);
  const load = useMemo(() => selectDayLoad(tasks, completions), [tasks, completions]);
  const completedGroups = useMemo(() => selectCompletionsByDay(completions, now), [completions, now]);
  const todayKey = dayKey(now);
  const finishedToday = completions.filter((c) => dayKey(c.completedAt) === todayKey).length;
  const name = settings.userName.trim() || (settings.locale === "hi" ? "dost" : "there");
  const hour = new Date(now).getHours();
  const greetKey = hour < 12 ? "greet.morning" : hour < 17 ? "greet.afternoon" : "greet.evening";
  const leftover = groups.overdue.length + groups.today.length;
  const q = query.trim().toLowerCase();
  const match = (row: Task) => !q || row.title.toLowerCase().includes(q);
  const shown = {
    overdue: filter === "today" || filter === "inbox" ? [] : groups.overdue.filter(match),
    today: filter === "overdue" || filter === "inbox" ? [] : groups.today.filter(match),
    tomorrow: filter === "all" ? groups.tomorrow.filter(match) : [],
    later: filter === "all" ? groups.later.filter(match) : [],
    inbox: filter === "today" || filter === "overdue" ? [] : groups.inbox.filter(match),
  };
  const openCount =
    shown.overdue.length + shown.today.length + shown.tomorrow.length + shown.later.length + shown.inbox.length;

  return (
    <main className="overflow-x-hidden px-5 pt-5 pb-4">
      <header className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <BrandMark compact />
          <HeaderActions />
        </div>
        <p className="mt-3 min-w-0 truncate text-sm text-muted">{t(greetKey, { name })}</p>
        <div className="mt-3">
          <ViewSwitch current={doneView ? "done" : "list"} />
        </div>
        <div className="mt-5 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-title leading-none font-medium tracking-tight">
              {doneView ? t("view.done") : t("today.title")}
            </h1>
            <p className="mt-1.5 text-sm text-muted">{format(now, "EEE d MMM")}</p>
          </div>
          <p className="shrink-0 pb-0.5 text-right text-sm font-medium whitespace-nowrap tabular-nums text-muted">
            {doneView
              ? t("today.done", { n: finishedToday })
              : leftover === 0
                ? t("today.inboxZero")
                : t("today.left", { n: leftover })}
          </p>
        </div>
      </header>

      <AlertSetup />

      {!doneView && (
        <>
          <div className="mb-4">
            <WeekStrip now={now} remainingByDay={load.remaining} />
          </div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("do.search")}
            className="mb-3 h-11"
          />
          <div className="mb-5 flex gap-1.5 overflow-x-auto">
            {(
              [
                ["all", t("do.filterAll")],
                ["overdue", t("do.overdue")],
                ["today", t("today.today")],
                ["inbox", t("do.inbox")],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={cn(
                  "h-9 shrink-0 rounded-full px-3 text-xs font-semibold",
                  filter === id ? "bg-fg text-bg" : "bg-surface text-muted shadow-[var(--sd-card-shadow)]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {doneView ? (
        <section>
          {completedGroups.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">{t("do.emptyDone")}</p>
          ) : (
            <div className="space-y-5">
              {completedGroups.map((group) => (
                <div key={group.key}>
                  <p className="mb-2 px-1 text-micro font-semibold tracking-[0.14em] text-muted uppercase">
                    {group.label} · {group.items.length}
                  </p>
                  <div className="space-y-1.5">
                    {group.items.map((item) => {
                      const task = tasks.find((row) => row.id === item.taskId);
                      return (
                        <CompletedRow
                          key={item.id}
                          item={item}
                          task={task}
                          onReopen={task && task.status === "completed" ? () => reopenTask(task.id) : undefined}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : openCount === 0 ? (
        <EmptyToday finished={finishedToday} searching={Boolean(q) || filter !== "all"} />
      ) : (
        <div className="space-y-5">
          <LedgerGroup label={t("today.overdue")} items={shown.overdue} now={now} overdue />
          <LedgerGroup label={t("today.today")} items={shown.today} now={now} timeline />
          <LedgerGroup label={t("today.tomorrow")} items={shown.tomorrow} now={now} timeline />
          <LedgerGroup label={t("do.later")} items={shown.later} now={now} />
          <LedgerGroup label={t("do.inbox")} items={shown.inbox} now={now} />
        </div>
      )}
    </main>
  );
}

function LedgerGroup({
  label,
  items,
  now,
  timeline = false,
  overdue = false,
}: {
  label: string;
  items: Task[];
  now: number;
  timeline?: boolean;
  overdue?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <p
        className={`mb-2 px-1 text-micro font-semibold tracking-[0.14em] uppercase ${overdue ? "text-overdue" : "text-muted"}`}
      >
        {label} · {items.length}
      </p>
      <div className="space-y-1.5">
        {items.map((row) => (
          <TaskRow key={row.id} task={row} now={now} timeline={timeline} />
        ))}
      </div>
    </section>
  );
}

function EmptyToday({ finished, searching }: { finished: number; searching: boolean }) {
  const { t } = useT();
  return (
    <div className="rounded-3xl px-2 py-10 text-center">
      <p className="font-display text-2xl font-medium">{searching ? t("do.emptyList") : t("today.empty")}</p>
      {!searching && (
        <p className="mt-2 text-sm text-muted">
          {finished > 0 ? t("today.emptyHintDone", { n: finished }) : t("today.emptyHint")}
        </p>
      )}
    </div>
  );
}