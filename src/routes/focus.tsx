import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pause, Play, RotateCcw, Square } from "lucide-react";
import { useApp } from "@/lib/store";
import { formatTimer } from "@/lib/time";
import { Button, FieldLabel, Input } from "@/components/ui";
import { TaskRow } from "@/components/task-row";

export const Route = createFileRoute("/focus")({ component: FocusPage });

export function FocusPage() {
  const focus = useApp((s) => s.focus);
  const tasks = useApp((s) => s.tasks);
  const startFocus = useApp((s) => s.startFocus);
  const pauseFocus = useApp((s) => s.pauseFocus);
  const resumeFocus = useApp((s) => s.resumeFocus);
  const stopFocus = useApp((s) => s.stopFocus);
  const completeFocus = useApp((s) => s.completeFocus);
  const extendFocus = useApp((s) => s.extendFocus);

  const task = tasks.find((t) => t.id === focus.taskId);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!focus.running) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [focus.running]);
  const remaining = focus.running && focus.endsAt ? Math.max(0, focus.endsAt - Date.now()) : focus.remainingMs;
  const progress = focus.durationMs ? 1 - remaining / focus.durationMs : 0;
  const candidates = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== "completed")
        .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity))
        .slice(0, 6),
    [tasks],
  );
  const now = Date.now();
  const workMin =
    focus.pomodoroPreset === "50/10" ? 50 : focus.pomodoroPreset === "custom" ? focus.customWorkMin : 25;

  const done = !focus.running && remaining === 0 && focus.durationMs > 0 && Boolean(focus.endsAt === null && focus.taskId);

  const applyPreset = (p: "25/5" | "50/10" | "custom") => {
    const mins = p === "50/10" ? 50 : p === "custom" ? focus.customWorkMin : 25;
    useApp.setState((s) => ({
      focus: {
        ...s.focus,
        pomodoroPreset: p,
        mode: "pomodoro-work",
        durationMs: mins * 60_000,
        remainingMs: mins * 60_000,
        running: false,
        endsAt: null,
      },
    }));
  };

  const primary = () => {
    if (focus.running) {
      pauseFocus();
      return;
    }
    if (remaining > 0 && remaining < focus.durationMs) {
      resumeFocus();
      return;
    }
    startFocus(focus.taskId ?? candidates[0]?.id ?? null, Math.max(1, Math.round(focus.durationMs / 60_000) || workMin), focus.mode);
  };

  const size = 220;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(1, Math.max(0, progress));

  return (
    <main className="px-5 pt-6">
      <h1 className="font-display text-[2.1rem] font-medium tracking-tight">Focus</h1>
      <p className="mt-2 text-sm text-muted">One task. A timer. Finish it.</p>

      <div className="sd-card mt-6 rounded-3xl px-5 py-8 text-center">
        <p className="text-sm font-medium text-muted">
          {focus.mode === "pomodoro-break" ? "Break" : task?.title ?? "Open session"}
        </p>
        <div className="relative mx-auto mt-5" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90" aria-hidden>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-fg/10" strokeWidth={stroke} />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="currentColor"
              className="text-primary"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-5xl font-semibold tracking-tight text-fg tabular-nums">{formatTimer(remaining)}</div>
          </div>
        </div>

        {done ? (
          <div className="mt-8 grid grid-cols-2 gap-2">
            <Button onClick={completeFocus}>Done</Button>
            <Button variant="secondary" onClick={() => extendFocus(15)}>
              +15 min
            </Button>
          </div>
        ) : (
          <div className="mt-8 flex items-center justify-center gap-2">
            <Button onClick={primary}>
              {focus.running ? (
                <>
                  <Pause className="size-4" /> Pause
                </>
              ) : (
                <>
                  <Play className="size-4" /> {remaining > 0 && remaining < focus.durationMs ? "Resume" : "Start"}
                </>
              )}
            </Button>
            <Button variant="ghost" onClick={stopFocus} aria-label="Stop">
              <Square className="size-4" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => startFocus(focus.taskId, Math.round(focus.durationMs / 60000) || workMin, focus.mode)}
              aria-label="Reset"
            >
              <RotateCcw className="size-4" />
            </Button>
          </div>
        )}
      </div>

      <section className="mt-8">
        <p className="text-micro mb-3 font-semibold tracking-widest text-muted uppercase">Pomodoro</p>
        <div className="grid grid-cols-3 gap-2">
          {(["25/5", "50/10", "custom"] as const).map((p) => (
            <Button
              key={p}
              variant={focus.pomodoroPreset === p ? "soft" : "secondary"}
              size="sm"
              className="uppercase"
              onClick={() => applyPreset(p)}
            >
              {p}
            </Button>
          ))}
        </div>
        {focus.pomodoroPreset === "custom" && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <FieldLabel>Work (min)</FieldLabel>
              <Input
                inputMode="numeric"
                value={focus.customWorkMin}
                onChange={(e) => {
                  const n = Math.max(1, Number(e.target.value) || 1);
                  useApp.setState((s) => ({
                    focus: { ...s.focus, customWorkMin: n, durationMs: n * 60_000, remainingMs: n * 60_000 },
                  }));
                }}
              />
            </div>
            <div>
              <FieldLabel>Break (min)</FieldLabel>
              <Input
                inputMode="numeric"
                value={focus.customBreakMin}
                onChange={(e) => {
                  const n = Math.max(1, Number(e.target.value) || 1);
                  useApp.setState((s) => ({ focus: { ...s.focus, customBreakMin: n } }));
                }}
              />
            </div>
          </div>
        )}
        <p className="mt-2 text-xs text-subtle">Secondary to the task timer. Not a dedicated pomodoro app.</p>
      </section>

      <section className="mt-8">
        <p className="text-micro mb-3 font-semibold tracking-widest text-muted uppercase">Start on a task</p>
        <div className="space-y-2">
          {candidates.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              now={now}
              compact
              onOpen={() => startFocus(t.id, t.estimatedDuration || workMin)}
            />
          ))}
          {candidates.length === 0 && <p className="text-sm text-muted">No open tasks.</p>}
        </div>
      </section>
    </main>
  );
}
