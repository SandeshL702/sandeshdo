import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, Mic } from "lucide-react";
import { toast } from "sonner";
import { Sheet } from "@/components/sheet";
import { Button, Input } from "@/components/ui";
import { parseNaturalLanguage } from "@/lib/parser";
import { useApp } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { taskCatLabel } from "@/lib/types";

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
  const [when, setWhen] = useState<"none" | "today" | "tomorrow" | "custom">("today");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle(prefill);
      setImportant(false);
      setCategoryId(null);
      setNewCat("");
      const n = new Date();
      const today = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
      setWhen(prefillDate ? "custom" : prefillWhen === "tomorrow" ? "tomorrow" : "today");
      setDate(prefillDate || today);
      setTime("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, prefill, prefillDate, prefillWhen]);

  const parsed = useMemo(() => parseNaturalLanguage(title), [title]);
  const voiceOk = typeof window !== "undefined" && speechCtor() != null;

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
    rec.onerror = () => {
      setListening(false);
    };
    rec.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript?: string }>> }) => {
      const text = e.results[0]?.[0]?.transcript ?? "";
      if (text) setTitle((prev) => (prev ? `${prev} ${text}` : text));
    };
    rec.start();
  };

  const dueFromChips = (): number | null => {
    if (when === "later" as string || when === "none") return parsed.dueAt;
    const now = new Date();
    if (when === "today") {
      const d = new Date();
      if (time) {
        const [hh, mm] = time.split(":").map(Number);
        d.setHours(hh ?? 18, mm ?? 0, 0, 0);
      } else d.setHours(18, 0, 0, 0);
      if (d.getTime() <= Date.now()) d.setHours(now.getHours() + 1, 0, 0, 0);
      return d.getTime();
    }
    if (when === "tomorrow") {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      if (time) {
        const [hh, mm] = time.split(":").map(Number);
        d.setHours(hh ?? 9, mm ?? 0, 0, 0);
      } else d.setHours(9, 0, 0, 0);
      return d.getTime();
    }
    if (date) {
      const [y, m, d] = date.split("-").map(Number);
      const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
      if (time) {
        const [hh, mm] = time.split(":").map(Number);
        dt.setHours(hh ?? 9, mm ?? 0, 0, 0);
      } else dt.setHours(9, 0, 0, 0);
      return dt.getTime();
    }
    if (time) {
      const [hh, mm] = time.split(":").map(Number);
      const dt = new Date();
      dt.setHours(hh ?? 9, mm ?? 0, 0, 0);
      if (dt.getTime() <= Date.now()) dt.setDate(dt.getDate() + 1);
      return dt.getTime();
    }
    return parsed.dueAt;
  };

  const submit = () => {
    const text = (parsed.title || title).trim();
    if (!text) {
      toast(t("add.needTitle"));
      return;
    }
    const dueAt = dueFromChips();
    addTask({
      title: text,
      priority: important ? "high" : "medium",
      categoryId,
      dueAt,
      recurrence: parsed.recurrence,
      estimatedDuration: parsed.estimatedDuration,
    });
    toast(dueAt ? t("add.alarmSet") : t("add.captured"));
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("add.title")}
      footer={
        <Button className="h-14 w-full rounded-3xl text-base" size="lg" onClick={submit} disabled={!title.trim()}>
          {t("add.submit")}
        </Button>
      }
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
            <Mic className={`size-5 ${listening ? "text-primary" : ""}`} />
          </Button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => {
            setWhen("today");
            const n = new Date();
            setDate(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`);
          }}
          className={cn(
            "h-14 rounded-2xl text-sm font-semibold",
            when === "today" ? "bg-primary text-primary-fg" : "bg-bg text-muted shadow-[var(--sd-card-shadow)]",
          )}
        >
          {t("add.today")}
        </button>
        <button
          type="button"
          onClick={() => {
            setWhen("tomorrow");
            const n = new Date();
            n.setDate(n.getDate() + 1);
            setDate(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`);
          }}
          className={cn(
            "h-14 rounded-2xl text-sm font-semibold",
            when === "tomorrow" ? "bg-fg text-bg" : "bg-bg text-muted shadow-[var(--sd-card-shadow)]",
          )}
        >
          {t("add.tomorrow")}
        </button>
        <button
          type="button"
          onClick={() => setWhen("custom")}
          className={cn(
            "h-14 rounded-2xl text-sm font-semibold",
            when === "custom" ? "bg-fg text-bg" : "bg-bg text-muted shadow-[var(--sd-card-shadow)]",
          )}
        >
          {t("add.date")}
        </button>
      </div>

      <label className="mt-3 flex items-center gap-2 rounded-2xl bg-bg px-3 py-2 shadow-[var(--sd-card-shadow)]">
        <span className="text-xs font-semibold text-muted">{t("add.date")}</span>
        <Input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setWhen("custom");
          }}
          className="h-10 flex-1 shadow-none"
        />
      </label>
      <label className="mt-2 flex items-center gap-2 rounded-2xl bg-bg px-3 py-2 shadow-[var(--sd-card-shadow)]">
        <Clock className="size-4 text-muted" />
        <span className="text-xs font-semibold text-muted">{t("add.time")}</span>
        <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-10 flex-1 shadow-none" />
      </label>

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

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted uppercase">{t("add.category")}</p>
        <p className="mb-2 text-xs text-muted">{t("add.catHint")}</p>
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
          <Input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder={t("add.newCategory")}
            className="h-10"
          />
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
