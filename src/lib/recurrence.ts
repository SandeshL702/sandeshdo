import { addDays, addMonths, addYears, setDate } from "date-fns";
import type { RecurrenceRule, Task } from "./types.ts";

export function nextOccurrence(from: number, rule: RecurrenceRule): number | null {
  if (rule.kind === "none") return null;
  const done = (rule.occurrencesDone ?? 0) + 1;
  if (rule.maxOccurrences != null && done >= rule.maxOccurrences) return null;

  let next: Date;
  const src = new Date(from);
  switch (rule.kind) {
    case "daily":
      next = addDays(src, 1);
      break;
    case "weekdays": {
      next = addDays(src, 1);
      while (next.getDay() === 0 || next.getDay() === 6) next = addDays(next, 1);
      break;
    }
    case "weekly":
      next = addDays(src, 7);
      break;
    case "custom": {
      const days = (rule.days ?? []).slice().sort();
      if (!days.length) return null;
      next = addDays(src, 1);
      let guard = 0;
      while (!days.includes(next.getDay()) && guard < 8) {
        next = addDays(next, 1);
        guard += 1;
      }
      break;
    }
    case "monthly": {
      const day = rule.monthDay ?? src.getDate();
      next = addMonths(src, 1);
      const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next = setDate(next, Math.min(day, last));
      break;
    }
    case "yearly":
      next = addYears(src, 1);
      break;
    default:
      return null;
  }

  if (rule.endAt && next.getTime() > rule.endAt) return null;
  return next.getTime();
}

export function nextFutureOccurrence(from: number, rule: RecurrenceRule, now: number): number | null {
  let cursor = from;
  for (let i = 0; i < 400; i++) {
    const next = nextOccurrence(cursor, rule);
    if (next == null) return null;
    if (next > now) return next;
    cursor = next;
  }
  return null;
}

export function canRecur(task: Task): boolean {
  return Boolean(task.recurrence && task.recurrence.kind !== "none");
}

export function recurrenceLabel(rule: RecurrenceRule | null): string | null {
  if (!rule || rule.kind === "none") return null;
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  switch (rule.kind) {
    case "daily":
      return "Every day";
    case "weekdays":
      return "Weekdays";
    case "weekly":
      if (rule.days?.[0] != null) return `Every ${names[rule.days[0]]}`;
      return "Weekly";
    case "monthly":
      return rule.monthDay ? `Monthly on ${rule.monthDay}` : "Monthly";
    case "yearly":
      return "Yearly";
    case "custom":
      if (rule.days?.length) return rule.days.map((d) => names[d]).join(", ");
      return "Custom";
    default:
      return null;
  }
}
