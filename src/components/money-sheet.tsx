import { useEffect, useState } from "react";
import { Delete } from "lucide-react";
import { toast } from "sonner";
import { Sheet } from "@/components/sheet";
import { Button, Input } from "@/components/ui";
import { useApp } from "@/lib/store";
import { catsForType, formatInr, guessCategory, moneyCatLabel } from "@/lib/money";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { TxType } from "@/lib/types";

export function MoneySheet({
  open,
  onClose,
  initialType = "expense",
  initialAmount = "",
}: {
  open: boolean;
  onClose: () => void;
  initialType?: TxType;
  initialAmount?: string;
}) {
  const { t } = useT();
  const addTx = useApp((s) => s.addTx);
  const addRecurringSpend = useApp((s) => s.addRecurringSpend);
  const moneyCategories = useApp((s) => s.moneyCategories);
  const [type, setType] = useState<TxType>("expense");
  const [digits, setDigits] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("food");
  const [repeat, setRepeat] = useState(false);
  const [repeatAt, setRepeatAt] = useState("20:00");

  const cats = catsForType(moneyCategories, type);

  useEffect(() => {
    if (!open) return;
    setType(initialType);
    setDigits(initialAmount.replace(/[^\d.]/g, ""));
    setNote("");
    setRepeat(false);
    const n = new Date();
    setRepeatAt(`${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`);
    const pool = catsForType(moneyCategories, initialType);
    const preferred =
      pool.find((c) => c.id === (initialType === "income" ? "salary" : "food")) ?? pool[0];
    setCategory(preferred?.id ?? "other");
  }, [open, initialType, initialAmount, moneyCategories]);

  const amount = Number(digits) || 0;

  const push = (ch: string) => {
    setDigits((cur) => {
      if (ch === "." && cur.includes(".")) return cur;
      if (ch === "0" && !cur) return cur;
      if (cur.replace(".", "").length >= 8) return cur;
      return `${cur}${ch}`;
    });
  };

  const submit = () => {
    if (amount <= 0) {
      toast(t("money.needAmount"));
      return;
    }
    const trimmed = note.trim();
    const cat = trimmed ? guessCategory(trimmed, type, moneyCategories) || category : category;
    const label = trimmed || t(type === "income" ? "money.got" : "money.spent");
    addTx({
      type,
      amount,
      category: cat,
      note: label,
      at: Date.now(),
      account: "cash",
    });
    if (repeat) {
      const [hh, mm] = repeatAt.split(":").map(Number);
      addRecurringSpend({
        type,
        amount,
        category: cat,
        note: label,
        hour: Number.isFinite(hh) ? hh : new Date().getHours(),
        minute: Number.isFinite(mm) ? mm : new Date().getMinutes(),
        days: [],
        enabled: true,
      });
    }
    toast(type === "income" ? t("money.loggedIn", { n: formatInr(amount) }) : t("money.loggedOut", { n: formatInr(amount) }));
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={type === "income" ? t("money.aaya") : t("money.gaya")}
      tall
      footer={
        <div>
          <div className="sd-numpad mb-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0"].map((k) => (
              <button key={k} type="button" onClick={() => push(k)}>
                {k}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDigits((d) => d.slice(0, -1))}
              aria-label="backspace"
            >
              <Delete className="mx-auto size-5" />
            </button>
          </div>
          <Button className="h-14 w-full rounded-3xl text-base" size="lg" onClick={submit} disabled={amount <= 0}>
            {t("money.save")}
          </Button>
        </div>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setType("income");
            const pool = catsForType(moneyCategories, "income");
            setCategory(pool.find((c) => c.id === "salary")?.id ?? pool.find((c) => c.id === "freelance")?.id ?? pool[0]?.id ?? "other");
          }}
          className={cn(
            "h-12 rounded-2xl text-sm font-semibold",
            type === "income" ? "bg-primary text-primary-fg" : "bg-bg text-muted shadow-[var(--sd-card-shadow)]",
          )}
        >
          {t("money.aaya")}
        </button>
        <button
          type="button"
          onClick={() => {
            setType("expense");
            const pool = catsForType(moneyCategories, "expense");
            setCategory((cur) => (pool.some((c) => c.id === cur) ? cur : pool[0]?.id ?? "other"));
          }}
          className={cn(
            "h-12 rounded-2xl text-sm font-semibold",
            type === "expense" ? "bg-urgent text-urgent-fg" : "bg-bg text-muted shadow-[var(--sd-card-shadow)]",
          )}
        >
          {t("money.gaya")}
        </button>
      </div>

      <p className="font-display text-center text-5xl font-medium tracking-tight tabular-nums">
        {amount ? formatInr(amount) : "₹0"}
      </p>

      <Input
        className="mt-4"
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          const guessed = guessCategory(e.target.value, type, moneyCategories);
          if (guessed) setCategory(guessed);
        }}
        placeholder={t("money.note")}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {cats.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={cn(
              "h-9 rounded-full px-3 text-xs font-semibold",
              category === c.id ? "bg-fg text-bg" : "bg-bg text-muted shadow-[var(--sd-card-shadow)]",
            )}
          >
            {moneyCatLabel(moneyCategories, c.id, t)}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setRepeat((v) => !v)}
        className={cn(
          "mt-4 flex h-12 w-full items-center justify-between rounded-2xl px-4 text-sm font-semibold",
          repeat ? "bg-fg text-bg" : "bg-bg text-muted shadow-[var(--sd-card-shadow)]",
        )}
      >
        <span>{t("money.repeatDaily")}</span>
        <span className="text-xs opacity-70">{repeat ? t("money.repeatOn") : t("money.repeatOff")}</span>
      </button>
      {repeat ? (
        <label className="mt-2 flex items-center justify-between gap-3 rounded-2xl bg-bg px-4 py-3 text-sm shadow-[var(--sd-card-shadow)]">
          <span className="font-semibold">{t("money.repeatAt")}</span>
          <Input
            type="time"
            className="h-10 w-32"
            value={repeatAt}
            onChange={(e) => setRepeatAt(e.target.value)}
          />
        </label>
      ) : null}
    </Sheet>
  );
}
