import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, format } from "date-fns";
import { Mic } from "lucide-react";
import { toast } from "sonner";
import { Sheet } from "@/components/sheet";
import { Button, Input } from "@/components/ui";
import { parseNaturalLanguage, formatParsedPreview } from "@/lib/parser";
import { useApp } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { taskCatLabel } from "@/lib/types";

const TIME_CHIPS: { labelKey: string; h: number | null; fallback: string }[] = [
  { labelKey: "add.none", h: null, fallback: "None" },
  { labelKey: "add.morning", h: 9, fallback: "9 am" },
  { labelKey: "add.afternoon", h: 13, fallback: "1 pm" },
  { labelKey: "add.evening", h: 18, fallback: "6 pm" },
  { labelKey: "add.night", h: 21, fallback: "9 pm" },
];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function QuickAdd({
  open,
  onClose,
  prefill = "",
  prefillDate = "",
  prefillWhen = "",
}: {
  open: boolean;
  onClose: () => void;
  prefill?: string;
  prefillDate?: string;
  prefillWhen?: "today" | "tomorrow" | "";
}) {
  const { t, locale } = useT();
  const addTask = useApp((s) => s.addTask);
  const categories = useApp((s) => s.categories);
  const addCategory = useApp((s) => s.addCategory);
  const [title, setTitle] = useState("");
  const [important, setImportant] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [newCat, setNewCat] = useState("");
  const [when, setWhen] = useState<"today" | "tomorrow" | "none" | "day">("today");
  const [day, setDay] = useState("");
  const [hour, setHour] = useState<number | null>(18);
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const days = useMemo(() => Array.from({ length: 8 }, (_, i) => addDays(new Date(), i)), []);

  useEffect(() => {
    if (!open) return;
    setTitle(prefill);
    setImportant(false);
    setCategoryId(null);
    setNewCat("");
    const today = ymd(new Date());
    if (prefillDate) {
      setWhen("day");
      setDay(prefillDate);
    } else if (prefillWhen === "tomorrow") {
      setWhen("tomorrow");
      setDay(ymd(addDays(new Date(), 1)));
    } else {
      setWhen("today");
      setDay(today);
    }
    setHour(18);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, prefill, prefillDate, prefillWhen]);

  const parsed = useMemo(() => parseNaturalLanguage(title), [title]);
  const voiceOk = typeof window !== "undefined" && speechCtor() != null;

  useEffect(() => {
    if (!parsed.dueAt || parsed.confidence === "low") return;
    const d = new Date(parsed.dueAt);
    const today = ymd(new Date());
    const tom = ymd(addDays(new Date(), 1));
    const key = ymd(d);
    setDay(key);
    setWhen(key === today ? "today" : key === tom ? "tomorrow" : "day");
    setHour(d.getHours());
  }, [parsed.dueAt, parsed.confidence]);

  const listen = () => {
    const Ctor = speechCtor();
    if (!Ctor) {
      toast(t("add.needTitle"));
      return;
    }
    const rec = new Ctor();
    rec.lang = locale === "hi" ? "hi-IN" : "en-IN";
    rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript?: string }>> }) => {
      const text = e.results[0]?.[0]?.transcript ?? "";
      if (text) setTitle((prev) => (prev ? `${prev} ${text}` : text));
    };
    rec.start();
  };

  const dueFromChips = (): number | null => {
    if (when === "none") return parsed.dueAt;
    const base = (() => {
      if (when === "today") return new Date();
      if (when === "tomorrow") {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d;
      }
      if (day) {
        const [y, m, d] = day.split("-").map(Number);
        return new Date(y, (m ?? 1) - 1, d ?? 1);
      }
      return new Date();
    })();
    const h = hour ?? (when === "today" ? 18 : 9);
    base.setHours(h, 0, 0, 0);
    if (when === "today" && base.getTime() <= Date.now()) {
      base.setHours(new Date().getHours() + 1, 0, 0, 0);
    }
    return base.getTime();
  };

  const submit = () => {
    const text = (parsed.title || title).trim();
    if (!text) {
      toast(t("add.needTitle"));
      return;
    }
    const dueAt = when === "none" ? null : (parsed.dueAt ?? dueFromChips());
    addTask({
      title: text,
      priority: important ? "high" : "medium",
      categoryId,
      dueAt,
      deadline: dueAt,
      recurrence: parsed.recurrence,
      estimatedDuration: parsed.estimatedDuration,
    });
    toast(dueAt ? t("add.alarmSet") : t("add.captured"));
    onClose();
  };

  const chip = (active: boolean) =>
    cn(
      "h-11 shrink-0 rounded-2xl px-3 text-sm font-semibold",
      active ? "bg-primary text-primary-fg" : "bg-bg text-muted shadow-[var(--sd-card-shadow)]",
    );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("add.title")}
      footer={
        <Button
          type="submit"
          form="sd-quick-add"
          className="h-14 w-full rounded-3xl text-base"
          size="lg"
          disabled={!title.trim()}
        >
          {t("add.submit")}
        </Button>
      }
    >
      <form
        id="sd-quick-add"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("add.placeholder")}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {voiceOk && (
          <Button variant={listening ? "soft" : "secondary"} size="icon" aria-label={t("add.voice")} onClick={listen}>
            <Mic className={cn("size-5", listening && "text-primary")} />
          </Button>
        )}
      </div>
      {parsed.confidence !== "low" && parsed.title ? (
        <p className="mt-2 text-xs font-medium text-primary">{formatParsedPreview(parsed)}</p>
      ) : null}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => {
            setWhen("today");
            setDay(ymd(new Date()));
            if (hour == null) setHour(18);
          }}
          className={chip(when === "today")}
        >
          {t("add.today")}
        </button>
        <button
          type="button"
          onClick={() => {
            setWhen("tomorrow");
            setDay(ymd(addDays(new Date(), 1)));
            if (hour == null) setHour(9);
          }}
          className={chip(when === "tomorrow")}
        >
          {t("add.tomorrow")}
        </button>
        <button
          type="button"
          onClick={() => {
            setWhen("none");
            setHour(null);
          }}
          className={chip(when === "none")}
        >
          {t("add.later")}
        </button>
      </div>

      {when !== "none" && (
        <>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {days.map((d, i) => {
              const key = ymd(d);
              const active = day === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setWhen(i === 0 ? "today" : i === 1 ? "tomorrow" : "day");
                    setDay(key);
                  }}
                  className={cn(
                    "flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl text-xs font-semibold",
                    active ? "bg-fg text-bg" : "bg-bg text-muted shadow-[var(--sd-card-shadow)]",
                  )}
                >
                  <span>{i === 0 ? t("add.today") : format(d, "EEE")}</span>
                  <span className="text-sm tabular-nums">{format(d, "d")}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {TIME_CHIPS.map((row) => (
              <button
                key={row.labelKey}
                type="button"
                onClick={() => setHour(row.h)}
                className={cn(
                  "h-10 rounded-full px-3 text-xs font-semibold",
                  hour === row.h ? "bg-primary text-primary-fg" : "bg-bg text-muted shadow-[var(--sd-card-shadow)]",
                )}
              >
                {t(row.labelKey) === row.labelKey ? row.fallback : t(row.labelKey)}
              </button>
            ))}
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => setImportant((v) => !v)}
        className={cn(
          "mt-3 h-11 w-full rounded-2xl text-sm font-semibold",
          important ? "bg-fg text-bg" : "bg-bg text-muted shadow-[var(--sd-card-shadow)]",
        )}
      >
        {t("add.important")}
      </button>
      </form>

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted uppercase">{t("add.category")}</p>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId((cur) => (cur === c.id ? null : c.id))}
              className={cn(
                "h-9 rounded-full px-3 text-xs font-semibold",
                categoryId === c.id ? "bg-fg text-bg" : "bg-bg text-muted shadow-[var(--sd-card-shadow)]",
              )}
            >
              {taskCatLabel(categories, c.id, t)}
            </button>
          ))}
        </div>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const id = addCategory(newCat);
            if (id) {
              setCategoryId(id);
              setNewCat("");
            }
          }}
        >
          <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder={t("add.newCategory")} className="h-10" />
          <Button type="submit" variant="secondary" disabled={!newCat.trim()}>
            {t("settings.add")}
          </Button>
        </form>
      </div>
    </Sheet>
  );
}

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void) | null;
  start: () => void;
};

function speechCtor(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
