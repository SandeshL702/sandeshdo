import { addDays, addMinutes, nextDay, setHours, setMinutes, setSeconds } from "date-fns";
import type { RecurrenceRule, TxType } from "./types.ts";
import { weekdayIndex } from "./time.ts";
import { nextOccurrence } from "./recurrence.ts";
import { guessCategory } from "./money.ts";

export interface ParsedTask {
  title: string;
  dueAt: number | null;
  recurrence: RecurrenceRule | null;
  estimatedDuration: number | null;
  confidence: "high" | "medium" | "low";
  dateLabel: string | null;
  timeLabel: string | null;
  recurrenceLabel: string | null;
}

const PREFIX =
  /^(?:please\s+)?(?:remind me to|remind me|remember to|don't forget to|dont forget to|i need to|i have to|todo:?|task:?|yaad rakh|yaad dilana|mujhe yaad|add karo?|kaam hai)\s+/i;

const DURATION_RE = /\b(?:for\s+)?(\d+)\s*(minutes?|mins?|hours?|hrs?)\b/i;
const RELATIVE_IN_RE = /\bin\s+(\d+)\s*(minutes?|mins?|hours?|hrs?)\b/i;

function stripOnce(src: string, re: RegExp): { text: string; match: RegExpMatchArray | null } {
  const match = src.match(re);
  if (!match || match.index === undefined) return { text: src, match: null };
  const text = `${src.slice(0, match.index)} ${src.slice(match.index + match[0].length)}`.replace(/\s+/g, " ").trim();
  return { text, match };
}

function parseHour(hour: number, ampm?: string | null): number {
  if (!ampm) {
    if (hour <= 7) return hour + 12;
    return hour;
  }
  const mer = ampm.replace(/\./g, "").toLowerCase();
  if (mer === "am") return hour === 12 ? 0 : hour;
  return hour === 12 ? 12 : hour + 12;
}

function applyTime(base: Date, hour: number, minute: number): Date {
  return setSeconds(setMinutes(setHours(base, hour), minute), 0);
}

function formatTimeLabel(hour: number, minute: number): string {
  const d = applyTime(new Date(2000, 0, 1), hour, minute);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function extractRecurrence(text: string): {
  text: string;
  rule: RecurrenceRule | null;
  label: string | null;
} {
  let working = text;
  const everyWeekday = working.match(/\b(every weekday|weekdays)\b/i);
  if (everyWeekday) {
    working = working.replace(everyWeekday[0], " ").replace(/\s+/g, " ").trim();
    return {
      text: working,
      rule: { kind: "weekdays", days: [1, 2, 3, 4, 5], occurrencesDone: 0 },
      label: "Weekdays",
    };
  }
  const daily = working.match(/\b(every day|everyday|daily)\b/i);
  if (daily) {
    working = working.replace(daily[0], " ").replace(/\s+/g, " ").trim();
    return {
      text: working,
      rule: { kind: "daily", occurrencesDone: 0 },
      label: "Every day",
    };
  }
  const monthly = working.match(/\b(every month|monthly)\b/i);
  if (monthly) {
    working = working.replace(monthly[0], " ").replace(/\s+/g, " ").trim();
    const ordinal = working.match(/\b(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/i);
    let monthDay = new Date().getDate();
    if (ordinal) {
      monthDay = Number(ordinal[1]);
      working = working.replace(ordinal[0], " ").replace(/\s+/g, " ").trim();
    }
    return {
      text: working,
      rule: { kind: "monthly", monthDay, occurrencesDone: 0 },
      label: monthDay ? `Monthly on ${monthDay}` : "Every month",
    };
  }
  const yearly = working.match(/\b(every year|yearly|annually)\b/i);
  if (yearly) {
    working = working.replace(yearly[0], " ").replace(/\s+/g, " ").trim();
    return {
      text: working,
      rule: { kind: "yearly", occurrencesDone: 0 },
      label: "Every year",
    };
  }
  const weeklyBare = working.match(/\b(every week|weekly)\b/i);
  if (weeklyBare) {
    working = working.replace(weeklyBare[0], " ").replace(/\s+/g, " ").trim();
    return {
      text: working,
      rule: { kind: "weekly", days: [new Date().getDay()], occurrencesDone: 0 },
      label: "Every week",
    };
  }
  const everyDayName = working.match(
    /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/i,
  );
  if (everyDayName) {
    const idx = weekdayIndex(everyDayName[1]);
    working = working.replace(everyDayName[0], " ").replace(/\s+/g, " ").trim();
    if (idx !== null) {
      const label = everyDayName[1].charAt(0).toUpperCase() + everyDayName[1].slice(1).toLowerCase();
      return {
        text: working,
        rule: { kind: "weekly", days: [idx], occurrencesDone: 0 },
        label: `Every ${label}`,
      };
    }
  }
  return { text: working, rule: null, label: null };
}

function extractTime(text: string): {
  text: string;
  hour: number;
  minute: number;
  label: string;
} | null {
  const noon = stripOnce(text, /\b(noon|midnight)\b/i);
  if (noon.match) {
    const isNoon = noon.match[1].toLowerCase() === "noon";
    return {
      text: noon.text,
      hour: isNoon ? 12 : 0,
      minute: 0,
      label: isNoon ? "12:00 PM" : "12:00 AM",
    };
  }

  const hm = stripOnce(text, /\b(?:at\s+)?(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)?\b/i);
  if (hm.match) {
    const hour = parseHour(Number(hm.match[1]), hm.match[3]);
    const minute = Number(hm.match[2]);
    return { text: hm.text, hour, minute, label: formatTimeLabel(hour, minute) };
  }

  const hap = stripOnce(text, /\b(?:at\s+)?(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)\b/i);
  if (hap.match) {
    const hour = parseHour(Number(hap.match[1]), hap.match[2]);
    return { text: hap.text, hour, minute: 0, label: formatTimeLabel(hour, 0) };
  }

  const atH = stripOnce(text, /\bat\s+(\d{1,2})\b/i);
  if (atH.match) {
    const hour = parseHour(Number(atH.match[1]), null);
    return { text: atH.text, hour, minute: 0, label: formatTimeLabel(hour, 0) };
  }

  const baje = stripOnce(
    text,
    /\b(\d{1,2})(?:[:.](\d{2}))?\s*(?:baje|bajey|bajkar|pe)\b(?:\s*(subah|shaam|sham|raat|dopahar|subah))?/i,
  );
  if (baje.match) {
    let hour = Number(baje.match[1]);
    const minute = baje.match[2] ? Number(baje.match[2]) : 0;
    const slot = (baje.match[3] ?? "").toLowerCase();
    if (slot === "shaam" || slot === "sham" || slot === "raat") {
      if (hour < 12) hour += 12;
    } else if (slot === "subah" && hour === 12) hour = 0;
    else if (!slot) hour = parseHour(hour, null);
    return { text: baje.text, hour, minute, label: formatTimeLabel(hour, minute) };
  }

  const slotOnly = stripOnce(text, /\b(subah|shaam|sham|dopahar|raat)\b/i);
  if (slotOnly.match) {
    const slot = slotOnly.match[1].toLowerCase();
    const hour = slot === "subah" ? 8 : slot === "dopahar" ? 13 : slot === "raat" ? 21 : 18;
    return { text: slotOnly.text, hour, minute: 0, label: formatTimeLabel(hour, 0) };
  }

  return null;
}

function snapToWeekday(date: Date, day: number): Date {
  if (date.getDay() === day) return date;
  return nextDay(date, day as 0 | 1 | 2 | 3 | 4 | 5 | 6);
}

function rollForward(due: Date, rule: RecurrenceRule, now: number): Date {
  let cursor = due;
  let guard = 0;
  while (cursor.getTime() <= now && guard < 400) {
    const n = nextOccurrence(cursor.getTime(), rule);
    if (n == null) break;
    cursor = new Date(n);
    guard += 1;
  }
  return cursor;
}

export function parseNaturalLanguage(input: string, now = Date.now()): ParsedTask {
  const raw = input.trim();
  if (!raw) {
    return {
      title: "",
      dueAt: null,
      recurrence: null,
      estimatedDuration: null,
      confidence: "low",
      dateLabel: null,
      timeLabel: null,
      recurrenceLabel: null,
    };
  }

  let text = raw.replace(PREFIX, "").trim();
  const rec = extractRecurrence(text);
  text = rec.text;

  let estimatedDuration: number | null = null;
  const duration = text.match(DURATION_RE);
  const relative = text.match(RELATIVE_IN_RE);
  if (duration && !relative) {
    const n = Number(duration[1]);
    const unit = duration[2].toLowerCase();
    estimatedDuration = unit.startsWith("hour") || unit.startsWith("hr") ? n * 60 : n;
    text = text.replace(duration[0], " ").replace(/\s+/g, " ").trim();
  }

  let due: Date | null = null;
  let dateLabel: string | null = null;
  let timeLabel: string | null = null;
  let explicitDate = false;
  let explicitTime = false;

  if (relative) {
    const n = Number(relative[1]);
    const unit = relative[2].toLowerCase();
    const mins = unit.startsWith("hour") || unit.startsWith("hr") ? n * 60 : n;
    due = addMinutes(now, mins);
    dateLabel = "Relative";
    timeLabel = `In ${n} ${unit}`;
    explicitDate = true;
    explicitTime = true;
    text = text.replace(relative[0], " ").replace(/\s+/g, " ").trim();
  }

  const tomorrow = text.match(/\b(tomorrow|kal)\b/i);
  if (tomorrow) {
    due = addDays(new Date(now), 1);
    dateLabel = "Tomorrow";
    explicitDate = true;
    text = text.replace(tomorrow[0], " ").replace(/\s+/g, " ").trim();
  }

  const parso = text.match(/\bparso\b/i);
  if (parso && !explicitDate) {
    due = addDays(new Date(now), 2);
    dateLabel = "Day after";
    explicitDate = true;
    text = text.replace(parso[0], " ").replace(/\s+/g, " ").trim();
  }

  const today = text.match(/\b(today|tonight|aaj)\b/i);
  if (today && !explicitDate) {
    due = new Date(now);
    const word = today[1].toLowerCase();
    dateLabel = word === "tonight" ? "Tonight" : "Today";
    explicitDate = true;
    text = text.replace(today[0], " ").replace(/\s+/g, " ").trim();
    if (word === "tonight" && !extractTime(text)) {
      due = applyTime(due, 20, 0);
      timeLabel = "8:00 PM";
      explicitTime = true;
    }
  }

  const weekday = text.match(
    /\b(next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/i,
  );
  if (weekday && !explicitDate) {
    const isNext = Boolean(weekday[1]);
    const idx = weekdayIndex(weekday[2]);
    if (idx !== null) {
      const current = new Date(now);
      if (isNext) {
        due = nextDay(addDays(current, 1), idx as 0 | 1 | 2 | 3 | 4 | 5 | 6);
      } else if (current.getDay() === idx) {
        due = current;
      } else {
        due = nextDay(current, idx as 0 | 1 | 2 | 3 | 4 | 5 | 6);
      }
      dateLabel = weekday[2].charAt(0).toUpperCase() + weekday[2].slice(1).toLowerCase();
      explicitDate = true;
      text = text.replace(weekday[0], " ").replace(/\s+/g, " ").trim();
    }
  }

  const timeBits = extractTime(text);
  if (timeBits) {
    text = timeBits.text;
    due = applyTime(due ?? new Date(now), timeBits.hour, timeBits.minute);
    timeLabel = timeBits.label;
    explicitTime = true;
  }

  if (rec.rule?.kind === "weekly" && rec.rule.days?.[0] != null) {
    const targetDay = rec.rule.days[0];
    due = snapToWeekday(due ?? applyTime(new Date(now), 9, 0), targetDay);
    if (!dateLabel) {
      const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      dateLabel = names[targetDay] ?? null;
    }
  }

  if (rec.rule?.kind === "monthly" && rec.rule.monthDay && due) {
    due.setDate(Math.min(rec.rule.monthDay, new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate()));
  }

  if (due && rec.rule && !explicitTime) {
    due = applyTime(due, 9, 0);
    if (!timeLabel) timeLabel = "9:00 AM";
  }

  if (due && explicitDate && !explicitTime && rec.rule == null) {
    if (isSameDayLocal(due, new Date(now))) {
      due = addMinutes(now, 60);
      timeLabel = "In 1 hour";
    } else {
      due = applyTime(due, 9, 0);
      timeLabel = "9:00 AM";
    }
  }

  if (due && due.getTime() <= now) {
    if (rec.rule) {
      due = rollForward(due, rec.rule, now);
    } else if (explicitTime) {
      due = addDays(due, 1);
      if (!dateLabel) dateLabel = "Tomorrow";
    }
  }

  if (due && explicitTime && !explicitDate && rec.rule == null) {
    dateLabel = isSameDayLocal(due, new Date(now)) ? "Today" : "Tomorrow";
  }

  const title = text
    .replace(/\b(at|on|for)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  let confidence: ParsedTask["confidence"] = "low";
  if (title && explicitTime && (explicitDate || rec.rule)) confidence = "high";
  else if (title && (explicitTime || explicitDate || rec.rule)) confidence = "medium";
  else if (title) confidence = "low";

  return {
    title: title || raw,
    dueAt: due ? due.getTime() : null,
    recurrence: rec.rule,
    estimatedDuration,
    confidence,
    dateLabel,
    timeLabel,
    recurrenceLabel: rec.label,
  };
}

function isSameDayLocal(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatParsedPreview(parsed: ParsedTask): string {
  const bits = [parsed.title];
  if (parsed.dateLabel) bits.push(parsed.dateLabel);
  if (parsed.timeLabel) bits.push(parsed.timeLabel);
  if (parsed.recurrenceLabel) bits.push(parsed.recurrenceLabel);
  return bits.filter(Boolean).join(" · ");
}

export interface ParsedMoney {
  type: TxType;
  amount: number;
  category: string;
  note: string;
  confidence: "high" | "medium" | "low";
}

export function looksLikeMoney(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/₹/.test(t)) return true;
  if (/\b(spent|paid|pay|got|received|earned|salary|income|kharcha|udhaar)\b/i.test(t) && /\d/.test(t)) return true;
  if (/^\s*(?:rs\.?|inr)?\s*\d{2,7}(?:\.\d{1,2})?\s+\S+/i.test(t)) return true;
  return false;
}

export function parseMoney(raw: string): ParsedMoney | null {
  const src = raw.trim();
  if (!src) return null;
  const income = /\b(got|received|earned|salary|income|credited)\b/i.test(src);
  const expenseHint = /\b(spent|paid|pay|kharcha|debit)\b/i.test(src);
  const amountMatch = src.match(/(?:₹|rs\.?|inr)?\s*(\d{1,7}(?:\.\d{1,2})?)/i);
  if (!amountMatch) return null;
  const amount = Number(amountMatch[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const type: TxType = income && !expenseHint ? "income" : "expense";
  let note = src
    .replace(amountMatch[0], " ")
    .replace(/\b(spent|paid|pay|got|received|earned|salary|income|kharcha|on|for|rs\.?|inr)\b/gi, " ")
    .replace(/₹/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const category = guessCategory(note || src, type);
  if (!note) note = type === "income" ? "Income" : category;
  const confidence: ParsedMoney["confidence"] =
    income || expenseHint || /₹/.test(src) ? "high" : amountMatch.index === 0 ? "medium" : "low";
  return { type, amount, category, note, confidence };
}
