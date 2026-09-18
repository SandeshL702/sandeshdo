import { useState } from "react";
import { Sheet } from "@/components/sheet";
import { Button, FieldLabel, Input } from "@/components/ui";
import { SNOOZE_PRESETS } from "@/lib/types";
import { useApp } from "@/lib/store";
import { usualSnoozeMinutes } from "@/lib/engine";
import { laterToday, nextWeekSameTime, tomorrowMorning } from "@/lib/time";

export function SnoozeSheet({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const task = useApp((s) => s.tasks.find((t) => t.id === taskId));
  const snoozeTask = useApp((s) => s.snoozeTask);
  const rescheduleTask = useApp((s) => s.rescheduleTask);
  const smart = useApp((s) => s.settings.smartSnooze);
  const [customMin, setCustomMin] = useState("20");
  const [tab, setTab] = useState<"snooze" | "reschedule">("snooze");
  const usual = task && smart ? usualSnoozeMinutes(task) : null;

  if (!taskId) return null;

  return (
    <Sheet
      open={Boolean(taskId)}
      onClose={onClose}
      title={tab === "snooze" ? "Snooze" : "Reschedule"}
    >
      <div className="mb-4 grid grid-cols-2 gap-2">
        <Button variant={tab === "snooze" ? "soft" : "secondary"} size="sm" onClick={() => setTab("snooze")}>
          Snooze
        </Button>
        <Button variant={tab === "reschedule" ? "soft" : "secondary"} size="sm" onClick={() => setTab("reschedule")}>
          Reschedule
        </Button>
      </div>

      {tab === "snooze" ? (
        <div className="grid grid-cols-2 gap-2">
          {usual && (
            <Button
              className="col-span-2"
              variant="soft"
              onClick={() => {
                snoozeTask(taskId, usual);
                onClose();
              }}
            >
              You usually snooze this for {usual} min
            </Button>
          )}
          {SNOOZE_PRESETS.map((p) => (
            <Button
              key={p.label}
              variant="secondary"
              onClick={() => {
                snoozeTask(taskId, p.minutes);
                onClose();
              }}
            >
              {p.label}
            </Button>
          ))}
          <div className="col-span-2 mt-2 flex gap-2">
            <Input
              inputMode="numeric"
              value={customMin}
              onChange={(e) => setCustomMin(e.target.value)}
              placeholder="Minutes"
            />
            <Button
              variant="primary"
              onClick={() => {
                const n = Number(customMin);
                if (!n || n < 1) return;
                snoozeTask(taskId, n);
                onClose();
              }}
            >
              Custom
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Button
            className="w-full"
            variant="secondary"
            onClick={() => {
              rescheduleTask(taskId, laterToday());
              onClose();
            }}
          >
            Later today
          </Button>
          <Button
            className="w-full"
            variant="secondary"
            onClick={() => {
              rescheduleTask(taskId, tomorrowMorning());
              onClose();
            }}
          >
            Tomorrow
          </Button>
          <Button
            className="w-full"
            variant="secondary"
            onClick={() => {
              rescheduleTask(taskId, nextWeekSameTime(task?.dueAt ?? Date.now()));
              onClose();
            }}
          >
            Next week
          </Button>
          <FieldLabel>Custom date and time</FieldLabel>
          <Input
            type="datetime-local"
            onChange={(e) => {
              if (!e.target.value) return;
              rescheduleTask(taskId, new Date(e.target.value).getTime());
              onClose();
            }}
          />
        </div>
      )}
    </Sheet>
  );
}
