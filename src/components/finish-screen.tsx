import { Undo2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui";
import { useApp } from "@/lib/store";
import { useT } from "@/lib/i18n";

export function FinishScreen() {
  const { t } = useT();
  const navigate = useNavigate();
  const event = useApp((s) => s.lastFinish);
  const reopenTask = useApp((s) => s.reopenTask);
  const dismissFinish = useApp((s) => s.dismissFinish);
  const startFocus = useApp((s) => s.startFocus);

  if (!event) return null;

  const todayLabel =
    event.todayCount === 1 ? t("finish.todayCountOne") : t("finish.todayCount", { n: event.todayCount });
  const status =
    event.combo > 1 ? t("finish.combo", { n: event.combo }) : t("finish.done");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sd-finish-title"
      className="sd-overlay flex flex-col bg-fg text-bg"
    >
      <div className="flex flex-1 flex-col items-center justify-center px-8 pt-[max(3rem,env(safe-area-inset-top))] text-center">
        <p className="text-micro font-semibold tracking-[0.22em] uppercase opacity-70">{status}</p>
        <h2
          id="sd-finish-title"
          className="font-display mt-4 max-w-sm text-4xl leading-[1.05] font-medium tracking-tight text-balance"
        >
          {event.title}
        </h2>
        <p className="mt-3 text-sm opacity-75">{todayLabel}</p>
        {event.nextTitle && (
          <p className="mt-6 max-w-xs text-sm opacity-70">{t("finish.nextHit", { title: event.nextTitle })}</p>
        )}
      </div>

      <div className="flex flex-col gap-2 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {event.nextId && (
          <Button
            size="lg"
            className="h-14 w-full rounded-3xl bg-bg text-fg hover:bg-bg"
            onClick={() => {
              const id = event.nextId;
              dismissFinish();
              if (!id) return;
              const task = useApp.getState().tasks.find((row) => row.id === id);
              startFocus(id, task?.estimatedDuration || 25);
              void navigate({ to: "/focus" });
            }}
          >
            {t("finish.next")}
          </Button>
        )}
        <Button
          size="lg"
          variant={event.nextId ? "ghost" : "primary"}
          className={
            event.nextId
              ? "h-14 w-full rounded-3xl text-bg hover:bg-bg/10"
              : "h-14 w-full rounded-3xl bg-bg text-fg hover:bg-bg"
          }
          onClick={dismissFinish}
        >
          {t("finish.continue")}
        </Button>
        {!event.recurring && (
          <button
            type="button"
            className="mt-1 inline-flex h-11 items-center justify-center gap-2 text-sm font-medium text-bg/70"
            onClick={() => {
              reopenTask(event.taskId);
              dismissFinish();
            }}
          >
            <Undo2 className="size-4" />
            {t("finish.undo")}
          </button>
        )}
      </div>
    </div>
  );
}

