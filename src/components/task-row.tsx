import { useRef, useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";
import { formatDue } from "@/lib/time";
import { liveStatus } from "@/lib/engine";
import { useApp } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { taskCatLabel } from "@/lib/types";

export function TaskRow({
  task,
  now,
  compact = false,
  timeline = false,
  onOpen,
}: {
  task: Task;
  now: number;
  compact?: boolean;
  timeline?: boolean;
  featured?: boolean;
  onOpen?: (id: string) => void;
}) {
  const { t } = useT();
  const completeTask = useApp((s) => s.completeTask);
  const reopenTask = useApp((s) => s.reopenTask);
  const categories = useApp((s) => s.categories);
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);
  const status = liveStatus(task, now);
  const overdue = status === "overdue";
  const done = task.status === "completed";
  const category = taskCatLabel(categories, task.categoryId, t);
  const due = task.snoozedUntil ?? task.dueAt;

  const onPointerDown = (e: React.PointerEvent) => {
    if (done) return;
    if ((e.target as HTMLElement).closest("button")) return;
    startX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startX.current == null) return;
    const next = Math.max(-120, Math.min(120, e.clientX - startX.current));
    setDx(next);
  };
  const onPointerUp = () => {
    if (Math.abs(dx) > 72) {
      if (dx > 0) completeTask(task.id);
      else window.dispatchEvent(new CustomEvent("sandeshdo:snooze-task", { detail: task.id }));
    }
    startX.current = null;
    setDx(0);
  };

  const timeLabel = due
    ? overdue
      ? format(due, "h:mm a")
      : timeline
        ? format(due, "h:mm a")
        : formatDue(due, now)
    : null;

  const meta = [
    category && !done ? category : null,
    overdue && !done ? t("do.overdue") : null,
    task.snoozeCount >= 2 && !done ? t("do.postponed", { n: task.snoozeCount }) : null,
  ].filter(Boolean);

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-4 text-xs font-semibold tracking-wide">
        <span className={cn("text-done", dx <= 8 && "opacity-0")}>{t("do.markDone")}</span>
        <span className={cn("text-snooze", dx >= -8 && "opacity-0")}>Snooze</span>
      </div>
      <div
        className={cn(
          "relative flex items-center gap-3 bg-surface px-3 py-3 shadow-[var(--sd-card-shadow)]",
          "rounded-2xl transition-transform duration-150 ease-out",
          dx !== 0 && "duration-0",
          done && "opacity-60",
        )}
        style={{ transform: `translateX(${dx}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={() => {
          if (Math.abs(dx) > 8) return;
          if (onOpen) onOpen(task.id);
          else window.dispatchEvent(new CustomEvent("sandeshdo:select-task", { detail: task.id }));
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("sandeshdo:select-task", { detail: task.id }));
        }}
      >
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className={cn("truncate text-sm font-medium", done && "text-muted line-through")}>{task.title}</div>
          {!compact && meta.length > 0 && (
            <div className={cn("mt-0.5 truncate text-xs", overdue && !done ? "text-overdue" : "text-muted")}>
              {meta.join(" · ")}
            </div>
          )}
        </div>
        {timeLabel && (
          <div
            className={cn(
              "shrink-0 text-sm font-semibold whitespace-nowrap tabular-nums",
              overdue && !done ? "text-overdue" : "text-fg",
            )}
            suppressHydrationWarning
          >
            {timeLabel}
          </div>
        )}
        <button
          type="button"
          className="h-10 shrink-0 whitespace-nowrap px-1 text-xs font-medium text-muted"
          onClick={(e) => {
            e.stopPropagation();
            if (done) reopenTask(task.id);
            else completeTask(task.id);
          }}
        >
          {done ? t("finish.undo") : t("do.markDone")}
        </button>
      </div>
    </div>
  );
}
