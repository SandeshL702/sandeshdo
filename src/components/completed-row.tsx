import { format } from "date-fns";
import type { Completion, Task } from "@/lib/types";
import { useT } from "@/lib/i18n";

export function CompletedRow({
  item,
  task,
  onReopen,
}: {
  item: Completion;
  task?: Task;
  onReopen?: () => void;
}) {
  const { t } = useT();
  const canReopen = Boolean(onReopen);
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface px-3 py-3 shadow-[var(--sd-card-shadow)]">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-muted">{item.title}</div>
        <div className="mt-0.5 text-xs text-subtle">{t("do.completed")}</div>
      </div>
      <div className="text-sm font-semibold tabular-nums text-done" suppressHydrationWarning>
        {format(item.completedAt, "h:mm a")}
      </div>
      {canReopen && (
        <button type="button" className="h-10 shrink-0 px-1 text-xs font-medium text-muted" onClick={onReopen}>
          {t("finish.undo")}
        </button>
      )}
    </div>
  );
}
