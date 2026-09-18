import { useMemo, useState } from "react";
import { Play, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Sheet } from "@/components/sheet";
import { Button, FieldLabel, Input, Switch, Textarea } from "@/components/ui";
import { useApp } from "@/lib/store";
import { PRIORITY_LABEL, REMINDER_OFFSET_PRESETS, type Priority, type RecurrenceRule } from "@/lib/types";
import { formatDue, relativeCreated } from "@/lib/time";
import { agingLabel } from "@/lib/engine";
import { recurrenceLabel } from "@/lib/recurrence";
import { cn } from "@/lib/utils";

const WEEKDAYS = [
  { i: 0, l: "S" },
  { i: 1, l: "M" },
  { i: 2, l: "T" },
  { i: 3, l: "W" },
  { i: 4, l: "T" },
  { i: 5, l: "F" },
  { i: 6, l: "S" },
];

function toLocalInput(ms: number | null | undefined): string {
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TaskDetail({
  taskId,
  onClose,
  onSnooze,
}: {
  taskId: string | null;
  onClose: () => void;
  onSnooze: (id: string) => void;
}) {
  const navigate = useNavigate();
  const task = useApp((s) => s.tasks.find((t) => t.id === taskId) ?? null);
  const allSubtasks = useApp((s) => s.subtasks);
  const categories = useApp((s) => s.categories);
  const subtasks = useMemo(
    () => allSubtasks.filter((st) => st.taskId === taskId).sort((a, b) => a.position - b.position),
    [allSubtasks, taskId],
  );
  const updateTask = useApp((s) => s.updateTask);
  const deleteTask = useApp((s) => s.deleteTask);
  const completeTask = useApp((s) => s.completeTask);
  const addSubtask = useApp((s) => s.addSubtask);
  const toggleSubtask = useApp((s) => s.toggleSubtask);
  const deleteSubtask = useApp((s) => s.deleteSubtask);
  const startFocus = useApp((s) => s.startFocus);
  const autoComplete = useApp((s) => s.settings.autoCompleteOnSubtasks);
  const [newSub, setNewSub] = useState("");

  const allSubsDone = subtasks.length > 0 && subtasks.every((s) => s.isCompleted);
  const aging = task ? agingLabel(task) : null;
  const dueValue = useMemo(() => toLocalInput(task?.dueAt), [task?.dueAt]);
  const deadlineValue = useMemo(() => toLocalInput(task?.deadline), [task?.deadline]);

  if (!task) {
    return (
      <Sheet open={Boolean(taskId)} onClose={onClose} title="Task">
        <p className="text-sm text-muted">This task is no longer here.</p>
      </Sheet>
    );
  }

  const setRecurrence = (kind: RecurrenceRule["kind"]) => {
    if (kind === "none") {
      updateTask(task.id, { recurrence: null });
      return;
    }
    const days =
      kind === "weekly"
        ? [new Date(task.dueAt ?? Date.now()).getDay()]
        : kind === "weekdays"
          ? [1, 2, 3, 4, 5]
          : kind === "custom"
            ? (task.recurrence?.days ?? [1, 2, 3, 4, 5])
            : undefined;
    updateTask(task.id, {
      recurrence: {
        kind,
        days,
        monthDay: new Date(task.dueAt ?? Date.now()).getDate(),
        occurrencesDone: task.recurrence?.occurrencesDone ?? 0,
        endAt: task.recurrence?.endAt ?? null,
        maxOccurrences: task.recurrence?.maxOccurrences ?? null,
      },
    });
  };

  const toggleOffset = (minutes: number) => {
    const current = task.reminderOffsets.length ? task.reminderOffsets : [0];
    const next = current.includes(minutes)
      ? current.filter((m) => m !== minutes)
      : [...current, minutes].sort((a, b) => a - b);
    updateTask(task.id, { reminderOffsets: next.length ? next : [0] });
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Task"
      tall
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => onSnooze(task.id)}>
            Snooze
          </Button>
          <Button
            onClick={() => {
              completeTask(task.id);
              onClose();
            }}
          >
            Complete
          </Button>
        </div>
      }
    >
      <Input
        value={task.title}
        onChange={(e) => updateTask(task.id, { title: e.target.value })}
        className="h-12 text-lg font-medium"
      />

      {aging && (
        <div className="mt-3 rounded-2xl bg-bg px-4 py-3 text-sm shadow-[var(--shadow-border)]">
          <div className="text-micro font-medium tracking-wide text-muted uppercase">{aging}</div>
          <div className="mt-1 text-muted">
            Created {relativeCreated(task.createdAt)} · Snoozed {task.snoozeCount} · Rescheduled {task.rescheduleCount}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="soft"
              onClick={() => {
                startFocus(task.id, task.estimatedDuration || 25);
                onClose();
                void navigate({ to: "/focus" });
              }}
            >
              Do now
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onSnooze(task.id)}>
              Reschedule
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <FieldLabel>When</FieldLabel>
          <Input
            type="datetime-local"
            value={dueValue}
            onChange={(e) =>
              updateTask(task.id, {
                dueAt: e.target.value ? new Date(e.target.value).getTime() : null,
                snoozedUntil: null,
              })
            }
          />
          {task.dueAt && <p className="mt-1 text-xs text-muted">{formatDue(task.dueAt)}</p>}
        </div>
        <div className="col-span-2">
          <FieldLabel>Deadline (optional)</FieldLabel>
          <Input
            type="datetime-local"
            value={deadlineValue}
            onChange={(e) => updateTask(task.id, { deadline: e.target.value ? new Date(e.target.value).getTime() : null })}
          />
        </div>
        <div>
          <FieldLabel>Priority</FieldLabel>
          <select
            className="h-11 w-full rounded-xl bg-bg px-3 text-sm shadow-[var(--shadow-border)] outline-none"
            value={task.priority}
            onChange={(e) => updateTask(task.id, { priority: e.target.value as Priority })}
          >
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Category</FieldLabel>
          <select
            className="h-11 w-full rounded-xl bg-bg px-3 text-sm shadow-[var(--shadow-border)] outline-none"
            value={task.categoryId ?? ""}
            onChange={(e) => updateTask(task.id, { categoryId: e.target.value || null })}
          >
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Duration (min)</FieldLabel>
          <Input
            inputMode="numeric"
            value={task.estimatedDuration ?? ""}
            onChange={(e) => updateTask(task.id, { estimatedDuration: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
        <div>
          <FieldLabel>Repeat</FieldLabel>
          <select
            className="h-11 w-full rounded-xl bg-bg px-3 text-sm shadow-[var(--shadow-border)] outline-none"
            value={task.recurrence?.kind ?? "none"}
            onChange={(e) => setRecurrence(e.target.value as RecurrenceRule["kind"])}
          >
            <option value="none">Off</option>
            <option value="daily">Daily</option>
            <option value="weekdays">Weekdays</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
            <option value="custom">Custom days</option>
          </select>
        </div>
      </div>

      {task.recurrence?.kind === "custom" && (
        <div className="mt-3 flex gap-1">
          {WEEKDAYS.map((d) => {
            const on = task.recurrence?.days?.includes(d.i);
            return (
              <button
                key={d.i}
                type="button"
                onClick={() => {
                  const days = new Set(task.recurrence?.days ?? []);
                  if (days.has(d.i)) days.delete(d.i);
                  else days.add(d.i);
                  updateTask(task.id, {
                    recurrence: { ...task.recurrence!, days: [...days].sort() },
                  });
                }}
                className={cn(
                  "flex size-9 items-center justify-center rounded-full text-xs font-semibold",
                  on ? "bg-primary text-primary-fg" : "bg-bg text-muted shadow-[var(--shadow-border)]",
                )}
              >
                {d.l}
              </button>
            );
          })}
        </div>
      )}

      {recurrenceLabel(task.recurrence) && (
        <p className="mt-2 text-xs text-muted">{recurrenceLabel(task.recurrence)}</p>
      )}

      {task.recurrence && task.recurrence.kind !== "none" && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>End date</FieldLabel>
            <Input
              type="date"
              value={
                task.recurrence.endAt
                  ? new Date(task.recurrence.endAt).toISOString().slice(0, 10)
                  : ""
              }
              onChange={(e) =>
                updateTask(task.id, {
                  recurrence: {
                    ...task.recurrence!,
                    endAt: e.target.value ? new Date(e.target.value).getTime() : null,
                  },
                })
              }
            />
          </div>
          <div>
            <FieldLabel>Max times</FieldLabel>
            <Input
              inputMode="numeric"
              value={task.recurrence.maxOccurrences ?? ""}
              onChange={(e) =>
                updateTask(task.id, {
                  recurrence: {
                    ...task.recurrence!,
                    maxOccurrences: e.target.value ? Number(e.target.value) : null,
                  },
                })
              }
            />
          </div>
        </div>
      )}

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <FieldLabel>Reminders</FieldLabel>
          <Switch
            checked={task.reminderEnabled}
            onCheckedChange={(v) => updateTask(task.id, { reminderEnabled: v })}
            label="Reminders on"
          />
        </div>
        {task.reminderEnabled && (
          <div className="flex flex-wrap gap-2">
            {REMINDER_OFFSET_PRESETS.map((p) => {
              const on = (task.reminderOffsets.length ? task.reminderOffsets : [0]).includes(p.minutes);
              return (
                <Button
                  key={p.minutes}
                  size="sm"
                  variant={on ? "soft" : "secondary"}
                  onClick={() => toggleOffset(p.minutes)}
                >
                  {p.label}
                </Button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4">
        <FieldLabel>Notes</FieldLabel>
        <Textarea
          value={task.notes || task.description}
          onChange={(e) => updateTask(task.id, { notes: e.target.value, description: e.target.value })}
          placeholder="Keep it short"
        />
      </div>

      <div className="mt-5">
        <FieldLabel>Checklist</FieldLabel>
        <div className="space-y-1.5">
          {subtasks.map((st) => (
            <div key={st.id} className="flex items-center gap-2 rounded-xl bg-bg px-3 py-2 shadow-[var(--shadow-border)]">
              <input
                type="checkbox"
                checked={st.isCompleted}
                onChange={() => toggleSubtask(st.id)}
                className="size-4 accent-[var(--sd-primary)]"
              />
              <span className={`flex-1 text-sm ${st.isCompleted ? "text-muted line-through" : ""}`}>{st.title}</span>
              <button type="button" className="text-subtle" onClick={() => deleteSubtask(st.id)} aria-label="Delete subtask">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addSubtask(task.id, newSub);
            setNewSub("");
          }}
        >
          <Input value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="Add a step" />
          <Button type="submit" variant="secondary" size="icon" aria-label="Add subtask">
            <Plus className="size-4" />
          </Button>
        </form>
        {allSubsDone && !autoComplete && task.status !== "completed" && (
          <Button
            className="mt-3 w-full"
            variant="soft"
            onClick={() => {
              completeTask(task.id);
              onClose();
            }}
          >
            Mark task complete
          </Button>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            startFocus(task.id, task.estimatedDuration || 25);
            onClose();
            void navigate({ to: "/focus" });
          }}
        >
          <Play className="size-4" /> Start focus
        </Button>
        <Button
          variant="ghost"
          className="text-urgent"
          onClick={() => {
            deleteTask(task.id);
            onClose();
          }}
        >
          <Trash2 className="size-4" /> Delete
        </Button>
      </div>
    </Sheet>
  );
}
