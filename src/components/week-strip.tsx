import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { useNavigate } from "@tanstack/react-router";
import { dayKey } from "@/lib/time";
import { cn } from "@/lib/utils";

export function WeekStrip({
  now,
  remainingByDay,
}: {
  now: number;
  remainingByDay: Map<string, number>;
}) {
  const navigate = useNavigate();
  const start = startOfWeek(now, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="grid grid-cols-7 gap-0.5">
      {days.map((d) => {
        const key = dayKey(d);
        const today = isSameDay(d, now);
        const count = remainingByDay.get(key) ?? 0;
        return (
          <button
            key={key}
            type="button"
            onClick={() => {
              void navigate({ to: "/calendar", search: { d: key } });
            }}
            className="flex min-h-11 min-w-0 flex-col items-center gap-1 py-1 transition-transform duration-150 ease-out active:scale-[0.96]"
          >
            <span className="text-micro font-semibold tracking-wide text-subtle uppercase">{format(d, "EEEEE")}</span>
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                today ? "bg-primary text-primary-fg" : "text-fg",
              )}
            >
              {format(d, "d")}
            </span>
            <span className={cn("size-1 rounded-full", count > 0 ? "bg-primary" : "bg-transparent")} />
          </button>
        );
      })}
    </div>
  );
}
