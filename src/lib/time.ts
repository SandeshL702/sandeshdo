import {
  addDays,
  addMinutes,
  differenceInCalendarDays,
  differenceInMinutes,
  endOfDay,
  format,
  isSameDay,
  isToday,
  isTomorrow,
  isYesterday,
  setHours,
  setMinutes,
  setSeconds,
  startOfDay,
  startOfWeek,
} from "date-fns";

export function dayKey(d: Date | number = Date.now()): string {
  return format(d, "yyyy-MM-dd");
}

export function atTime(base: Date, hours: number, minutes: number): Date {
  return setSeconds(setMinutes(setHours(base, hours), minutes), 0);
}

export function parseHHMM(value: string): { h: number; m: number } {
  const [h, m] = value.split(":").map((n) => Number.parseInt(n, 10));
  return { h: Number.isFinite(h) ? h : 0, m: Number.isFinite(m) ? m : 0 };
}

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function isInQuietHours(now: Date, start: string, end: string): boolean {
  const mins = minutesOfDay(now);
  const s = parseHHMM(start);
  const e = parseHHMM(end);
  const startM = s.h * 60 + s.m;
  const endM = e.h * 60 + e.m;
  if (startM === endM) return false;
  if (startM < endM) return mins >= startM && mins < endM;
  return mins >= startM || mins < endM;
}

export function nextQuietHoursEnd(now: Date, end: string): Date {
  const { h, m } = parseHHMM(end);
  const todayEnd = atTime(now, h, m);
  if (todayEnd.getTime() > now.getTime()) return todayEnd;
  return atTime(addDays(now, 1), h, m);
}

export function dayHeading(ms: number, now = Date.now()): string {
  if (isToday(ms)) return "Today";
  if (isYesterday(ms)) return "Yesterday";
  if (isTomorrow(ms)) return "Tomorrow";
  const days = differenceInCalendarDays(ms, now);
  if (days > 1 && days < 7) return format(ms, "EEEE");
  return format(ms, "EEEE d MMM");
}

export function formatDue(dueAt: number, now = Date.now()): string {
  const d = new Date(dueAt);
  const t = format(d, "h:mm a");
  if (isToday(d)) return t;
  if (isTomorrow(d)) return `Tomorrow ${t}`;
  if (isYesterday(d)) return `Yesterday ${t}`;
  const days = differenceInCalendarDays(d, now);
  if (days > 1 && days < 7) return `${format(d, "EEEE")} ${t}`;
  return `${format(d, "d MMM")} ${t}`;
}

export function formatOverdue(dueAt: number, now = Date.now()): string {
  const mins = Math.max(0, differenceInMinutes(now, dueAt));
  if (mins < 1) return "Overdue just now";
  if (mins < 60) return `Overdue ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    const rem = mins % 60;
    return rem ? `Overdue ${hours}h ${rem}m` : `Overdue ${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return days === 1 ? "Overdue 1 day" : `Overdue ${days} days`;
}

export function formatWhen(dueAt: number | null, now = Date.now()): string {
  if (!dueAt) return "No time";
  if (dueAt <= now) return formatOverdue(dueAt, now);
  return formatDue(dueAt, now);
}

export function formatTimer(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function relativeCreated(createdAt: number, now = Date.now()): string {
  const days = differenceInCalendarDays(now, createdAt);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 14) return `${days} days ago`;
  return format(createdAt, "d MMM yyyy");
}

export function startOfToday(now = Date.now()): number {
  return startOfDay(now).getTime();
}

export function endOfToday(now = Date.now()): number {
  return endOfDay(now).getTime();
}

export function tomorrowMorning(now = Date.now(), hour = 9, minute = 0): number {
  return atTime(addDays(now, 1), hour, minute).getTime();
}

export function laterToday(now = Date.now()): number {
  const inThree = addMinutes(now, 180);
  const cap = atTime(new Date(now), 21, 0);
  if (inThree.getTime() < cap.getTime() && inThree.getHours() >= 6) {
    return inThree.getTime();
  }
  if (new Date(now).getTime() < cap.getTime()) return cap.getTime();
  return tomorrowMorning(now);
}

export function nextWeekSameTime(now = Date.now()): number {
  return addDays(now, 7).getTime();
}

export function weekStart(now = Date.now()): number {
  return startOfWeek(now, { weekStartsOn: 1 }).getTime();
}

export function isSameCalendarDay(a: number, b: number): boolean {
  return isSameDay(a, b);
}

export function clampTimeout(ms: number): number {
  return Math.max(0, Math.min(ms, 30 * 60 * 1000));
}

export function weekdayIndex(name: string): number | null {
  const map: Record<string, number> = {
    sun: 0,
    sunday: 0,
    mon: 1,
    monday: 1,
    tue: 2,
    tues: 2,
    tuesday: 2,
    wed: 3,
    wednesday: 3,
    thu: 4,
    thur: 4,
    thurs: 4,
    thursday: 4,
    fri: 5,
    friday: 5,
    sat: 6,
    saturday: 6,
  };
  return map[name.toLowerCase()] ?? null;
}

export const UNDO_WINDOW_MS = 10 * 60_000;

/** Undo is only allowed for 10 minutes. After that it is locked until Settings delete. */
export function canUndoAt(at: number | null | undefined, now = Date.now()): boolean {
  if (at == null || !Number.isFinite(at)) return false;
  const age = now - at;
  return age >= 0 && age < UNDO_WINDOW_MS;
}

