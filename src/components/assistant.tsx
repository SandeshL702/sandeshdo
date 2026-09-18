import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Mic, Send, Volume2 } from "lucide-react";
import { Sheet } from "@/components/sheet";
import { Button, Input } from "@/components/ui";
import { executeActions, runAssistant, type AssistantResult } from "@/lib/assistant";
import { formatParsedPreview, parseNaturalLanguage } from "@/lib/parser";
import { speak, speechCtor, stopSpeak } from "@/lib/speech";
import { useApp } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Line = { role: "you" | "do"; text: string };

const GO: Record<string, "/" | "/calendar" | "/money" | "/settings" | "/stats" | "/notes" | "/plans" | "/vault" | "/more"> = {
  "go:tasks": "/",
  "go:calendar": "/calendar",
  "go:money": "/money",
  "go:settings": "/settings",
  "go:report": "/stats",
  "go:notes": "/notes",
  "go:plans": "/plans",
  "go:vault": "/vault",
  "go:more": "/more",
};

function SandyFace() {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex size-8 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-fg" aria-hidden>
        <span className="absolute top-[11px] left-[8px] size-1.5 rounded-full bg-current opacity-90" />
        <span className="absolute top-[11px] right-[8px] size-1.5 rounded-full bg-current opacity-90" />
        <span className="absolute bottom-[8px] h-1 w-3 rounded-full bg-current opacity-70" />
      </span>
      <span>Sandy</span>
    </div>
  );
}

export function Assistant({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, locale } = useT();
  const navigate = useNavigate();
  const addTask = useApp((s) => s.addTask);
  const completeTask = useApp((s) => s.completeTask);
  const snoozeTask = useApp((s) => s.snoozeTask);
  const updateTask = useApp((s) => s.updateTask);
  const deleteTask = useApp((s) => s.deleteTask);
  const addTx = useApp((s) => s.addTx);
  const addNote = useApp((s) => s.addNote);
  const addPlan = useApp((s) => s.addPlan);
  const apiKey = useApp((s) => s.settings.geminiApiKey ?? "");
  const voiceOn = useApp((s) => s.settings.voiceEnabled !== false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const voiceOk = typeof window !== "undefined" && speechCtor() != null;
  const hint = useMemo(() => {
    const p = parseNaturalLanguage(text);
    if (!text.trim() || p.confidence === "low" || !p.title) return "";
    return formatParsedPreview(p);
  }, [text]);

  useEffect(() => {
    if (!open) {
      stopSpeak();
      return;
    }
    setLines((cur) =>
      cur.length
        ? cur
        : [{ role: "do", text: t("ai.readyKey") }],
    );
  }, [open, t]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [lines, busy]);

  const apply = (result: AssistantResult, userText: string) => {
    const state = useApp.getState();
    const notes = executeActions(
      result.actions,
      {
        addTask,
        completeTask,
        snoozeTask,
        updateTask,
        deleteTask,
        addTx,
        addNote,
        addPlan,
        tasks: state.tasks,
        moneyCategories: state.moneyCategories,
      },
      userText,
    );
    const go = notes.find((n) => n.startsWith("go:"));
    if (go && go in GO) {
      void navigate({ to: GO[go] });
    }
    const say = result.say.trim() || notes.filter((n) => !n.startsWith("go:")).join(" ") || t("ai.ok");
    setLines((cur) => [...cur, { role: "do", text: say }]);
    if (voiceOn) speak(say, locale);
  };

  const send = async (raw: string) => {
    const prompt = raw.trim();
    if (!prompt || busy) return;
    setText("");
    const nextLines: Line[] = [...lines, { role: "you", text: prompt }];
    setLines(nextLines);
    setBusy(true);
    try {
      const state = useApp.getState();
      const history = nextLines
        .slice(-8)
        .map((l) => `${l.role === "you" ? "User" : "Sandy"}: ${l.text}`)
        .join("\n");
      const result = await runAssistant(
        prompt,
        apiKey,
        {
          tasks: state.tasks,
          transactions: state.transactions,
          moneyCategories: state.moneyCategories,
          notes: state.notes,
          plans: state.plans,
        },
        history,
      );
      apply(result, prompt);
    } catch {
      setLines((cur) => [...cur, { role: "do", text: t("ai.fail") }]);
    } finally {
      setBusy(false);
    }
  };

  const listen = () => {
    const Ctor = speechCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = locale === "hi" ? "hi-IN" : "en-IN";
    rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.onresult = (e) => {
      const heard = e.results[0]?.[0]?.transcript ?? "";
      if (heard) void send(heard);
    };
    rec.start();
  };

  return (
    <Sheet open={open} onClose={onClose} title={<SandyFace />} tall>
      <div ref={scroller} className="flex min-h-48 flex-col gap-2">
        {lines.map((line, i) => (
          <div
            key={`${line.role}-${i}`}
            className={cn(
              "max-w-[90%] rounded-2xl px-3 py-2 text-sm",
              line.role === "you"
                ? "ml-auto bg-primary text-primary-fg"
                : "bg-bg text-fg shadow-[var(--sd-card-shadow)]",
            )}
          >
            {line.text}
          </div>
        ))}
        {busy && <p className="text-xs text-muted">{t("ai.thinking")}</p>}
      </div>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("ai.placeholder")}
          autoComplete="off"
        />
        {voiceOk && (
          <Button
            type="button"
            variant={listening ? "soft" : "secondary"}
            size="icon"
            aria-label={t("ai.voice")}
            onClick={listen}
          >
            <Mic className="size-5" />
          </Button>
        )}
        <Button type="submit" size="icon" aria-label={t("ai.send")} disabled={!text.trim() || busy}>
          <Send className="size-4" />
        </Button>
      </form>
      {hint ? <p className="mt-2 text-xs font-medium text-primary">{hint}</p> : null}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
        <Volume2 className="size-3.5" />
        {voiceOn ? t("ai.voiceOn") : t("ai.hintLocal")}
      </p>
    </Sheet>
  );
}
