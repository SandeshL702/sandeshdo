import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Mic, Send } from "lucide-react";
import { Sheet } from "@/components/sheet";
import { Button, Input } from "@/components/ui";
import { executeActions, runAssistant, type AssistantResult } from "@/lib/assistant";
import { speechCtor } from "@/lib/speech";
import { useApp } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Line = { role: "you" | "do"; text: string };

export function Assistant({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, locale } = useT();
  const navigate = useNavigate();
  const addTask = useApp((s) => s.addTask);
  const completeTask = useApp((s) => s.completeTask);
  const snoozeTask = useApp((s) => s.snoozeTask);
  const addTx = useApp((s) => s.addTx);
  const apiKey = useApp((s) => s.settings.geminiApiKey ?? "");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const voiceOk = typeof window !== "undefined" && speechCtor() != null;

  useEffect(() => {
    if (!open) return;
    setLines((cur) =>
      cur.length
        ? cur
        : [{ role: "do", text: apiKey.trim() ? t("ai.readyKey") : t("ai.readyLocal") }],
    );
  }, [open, apiKey, t]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [lines, busy]);

  const apply = (result: AssistantResult) => {
    const notes = executeActions(result.actions, {
      addTask,
      completeTask,
      snoozeTask,
      addTx,
      tasks: useApp.getState().tasks,
      moneyCategories: useApp.getState().moneyCategories,
    });
    const go = notes.find((n) => n.startsWith("go:"));
    const speak = notes.filter((n) => !n.startsWith("go:"));
    const map = {
      "go:tasks": "/",
      "go:calendar": "/calendar",
      "go:money": "/money",
      "go:settings": "/settings",
      "go:report": "/stats",
    } as const;
    if (go && go in map) {
      void navigate({ to: map[go as keyof typeof map] });
      onClose();
    }
    const say = [result.say, ...speak].filter(Boolean).join(" ");
    setLines((cur) => [...cur, { role: "do", text: say || t("ai.ok") }]);
  };

  const send = async (raw: string) => {
    const prompt = raw.trim();
    if (!prompt || busy) return;
    setText("");
    setLines((cur) => [...cur, { role: "you", text: prompt }]);
    setBusy(true);
    try {
      const result = await runAssistant(prompt, apiKey, {
        tasks: useApp.getState().tasks,
        transactions: useApp.getState().transactions,
        moneyCategories: useApp.getState().moneyCategories,
      });
      apply(result);
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
    <Sheet open={open} onClose={onClose} title={t("ai.title")} tall>
      <div ref={scroller} className="flex min-h-48 flex-col gap-2">
        {lines.map((line, i) => (
          <div
            key={`${line.role}-${i}`}
            className={cn(
              "max-w-[90%] rounded-2xl px-3 py-2 text-sm",
              line.role === "you" ? "ml-auto bg-primary text-primary-fg" : "bg-bg text-fg shadow-[var(--sd-card-shadow)]",
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
      <p className="mt-3 text-xs text-muted">
        {apiKey.trim() ? t("ai.hintKey") : t("ai.hintLocal")}
      </p>
    </Sheet>
  );
}
