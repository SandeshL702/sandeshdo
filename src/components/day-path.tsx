import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { dayKey } from "@/lib/time";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export function DayPath({
  now,
  remainingByDay,
  finishedByDay,
  streak,
  span = 7,
}: {
  now: number;
  remainingByDay: Map<string, number>;
  finishedByDay: Map<string, number>;
  streak: number;
  span?: number;
}) {
  const { t } = useT();
  const navigate = useNavigate();
  const start = startOfDay(now);
  const back = Math.floor((span - 1) / 2);
  const days = Array.from({ length: span }, (_, i) => addDays(start, i - back));

  return (
    <section className="sd-card rounded-xl px-3 py-4">
      <div className="mb-4 flex items-center justify-between px-1">
        <p className="text-micro font-semibold tracking-[0.14em] text-muted uppercase">{t("path.title")}</p>
        <p className="text-xs tabular-nums text-muted">{t("path.day", { n: Math.max(1, streak) })}</p>
      </div>
      <div className="relative flex items-start justify-between gap-0.5">
        <svg
          className="pointer-events-none absolute top-5 right-6 left-6 h-3 text-border"
          viewBox="0 0 100 12"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M0 7 C 14 2, 20 11, 33 7 S 52 2, 66 7 86 12, 100 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
        {days.map((d) => {
          const key = dayKey(d);
          const today = isSameDay(d, start);
          const past = d.getTime() < start.getTime();
          const left = remainingByDay.get(key) ?? 0;
          const done = finishedByDay.get(key) ?? 0;
          const cleared = (past || today) && left === 0 && done > 0;
          const missed = past && left > 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                void navigate({ to: "/calendar", search: { d: key } });
              }}
              className="relative z-[1] flex min-h-11 min-w-0 flex-1 flex-col items-center gap-1"
            >
              <span
                className={cn(
                  "sd-path-stone relative flex size-8 items-center justify-center rounded-full border-2 bg-surface text-micro font-semibold tabular-nums",
                  today && "sd-path-now size-10 border-primary bg-primary text-primary-fg",
                  cleared && !today && "border-primary bg-primary text-primary-fg",
                  missed && "border-overdue bg-overdue text-primary-fg",
                  !today && !cleared && !missed && "border-border text-muted",
                )}
              >
                {cleared && !today ? <Check className="size-3.5" strokeWidth={2.5} /> : left > 0 ? left : null}
              </span>
              <span className={cn("text-xs font-semibold tabular-nums", today ? "text-primary" : "text-fg")}>
                {format(d, "d")}
              </span>
              <span
                className={cn(
                  "text-micro font-semibold tracking-wide uppercase",
                  today ? "text-primary" : "text-subtle",
                )}
              >
                {today ? t("today.today") : format(d, "EEE")}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
