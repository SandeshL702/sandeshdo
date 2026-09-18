import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { HeaderActions } from "@/components/header-actions";
import { Sheet } from "@/components/sheet";
import { Button, Input } from "@/components/ui";
import { useApp } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { formatInr } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Plan } from "@/lib/types";

export const Route = createFileRoute("/plans")({ component: PlansPage });

const WHEN_CHIPS: { label: string; days: number | null }[] = [
  { label: "Soon", days: 30 },
  { label: "This year", days: 180 },
  { label: "Later", days: null },
];

export function PlansPage() {
  const { t } = useT();
  const plans = useApp((s) => s.plans);
  const addPlan = useApp((s) => s.addPlan);
  const updatePlan = useApp((s) => s.updatePlan);
  const deletePlan = useApp((s) => s.deletePlan);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [cost, setCost] = useState("");
  const [whenDays, setWhenDays] = useState<number | null>(180);
  const sorted = useMemo(
    () => [...plans].sort((a, b) => Number(a.done) - Number(b.done) || (a.when ?? 9e15) - (b.when ?? 9e15)),
    [plans],
  );

  const startNew = () => {
    setEditing(null);
    setTitle("");
    setNote("");
    setCost("");
    setWhenDays(180);
    setOpen(true);
  };

  const startEdit = (plan: Plan) => {
    setEditing(plan);
    setTitle(plan.title);
    setNote(plan.note);
    setCost(plan.cost ? String(plan.cost) : "");
    setWhenDays(plan.when ? Math.max(1, Math.round((plan.when - Date.now()) / 86_400_000)) : null);
    setOpen(true);
  };

  const save = () => {
    const name = title.trim();
    if (!name) return;
    const when = whenDays == null ? null : Date.now() + whenDays * 86_400_000;
    const n = Number(cost);
    const costN = Number.isFinite(n) && n > 0 ? n : null;
    if (editing) updatePlan(editing.id, { title: name, note, when, cost: costN });
    else addPlan({ title: name, note, when, cost: costN });
    setOpen(false);
  };

  return (
    <main className="overflow-x-hidden px-5 pt-5 pb-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <BrandMark compact />
          <h1 className="font-display mt-3 text-title leading-none font-medium tracking-tight">{t("plans.title")}</h1>
          <p className="mt-1.5 text-sm text-muted">{t("plans.empty")}</p>
        </div>
        <HeaderActions />
      </div>
      <button
        type="button"
        onClick={startNew}
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-primary-fg"
      >
        <Plus className="size-4" />
        {t("plans.add")}
      </button>
      <div className="mt-4 space-y-2">
        {sorted.map((plan) => (
          <div key={plan.id} className="rounded-[1.35rem] bg-surface px-4 py-4 shadow-[var(--sd-card-shadow)]">
            <div className="flex items-start gap-3">
              <button
                type="button"
                aria-label={t("plans.done")}
                onClick={() => updatePlan(plan.id, { done: !plan.done })}
                className={cn(
                  "mt-0.5 size-6 shrink-0 rounded-full border-2",
                  plan.done ? "border-primary bg-primary" : "border-border bg-bg",
                )}
              />
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => startEdit(plan)}>
                <div className={cn("text-sm font-semibold", plan.done && "text-muted line-through")}>{plan.title}</div>
                <div className="mt-1 text-xs text-muted">
                  {plan.when ? format(plan.when, "d MMM yyyy") : t("add.later")}
                  {plan.cost ? ` · ${formatInr(plan.cost)}` : ""}
                </div>
                {plan.note ? <p className="mt-1 text-xs text-muted">{plan.note}</p> : null}
              </button>
            </div>
          </div>
        ))}
      </div>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? t("plans.title") : t("plans.add")}
        footer={
          <div className="flex gap-2">
            {editing && (
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => {
                  deletePlan(editing.id);
                  setOpen(false);
                }}
              >
                {t("notes.delete")}
              </Button>
            )}
            <Button className="flex-1" onClick={save} disabled={!title.trim()}>
              {t("notes.save")}
            </Button>
          </div>
        }
      >
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mahakumbh, laptop…" />
        <Input className="mt-3" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("notes.body")} />
        <Input
          className="mt-3"
          inputMode="numeric"
          value={cost}
          onChange={(e) => setCost(e.target.value.replace(/[^\d]/g, ""))}
          placeholder={t("plans.cost")}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {WHEN_CHIPS.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => setWhenDays(c.days)}
              className={cn(
                "h-10 rounded-full px-3 text-xs font-semibold",
                whenDays === c.days ? "bg-primary text-primary-fg" : "bg-bg text-muted shadow-[var(--sd-card-shadow)]",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </Sheet>
    </main>
  );
}
