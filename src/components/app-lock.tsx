import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { pinMatches } from "@/lib/crypto";
import { useApp } from "@/lib/store";
import { useT } from "@/lib/i18n";

export function AppLock() {
  const { t } = useT();
  const pinHash = useApp((s) => s.settings.pinHash ?? "");
  const unlocked = useApp((s) => s.vaultUnlocked);
  const unlock = useApp((s) => s.unlockVault);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!pinHash || unlocked) return null;

  const submit = async () => {
    if (pin.length < 4 || busy) return;
    setBusy(true);
    const ok = await pinMatches(pin, pinHash);
    setBusy(false);
    if (ok) {
      unlock();
      setPin("");
      setErr(false);
    } else {
      setErr(true);
      setPin("");
    }
  };

  return (
    <div className="sd-lock fixed inset-0 z-[95] flex items-center justify-center bg-primary px-6 text-primary-fg">
      <form
        className="w-full max-w-sm text-center"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p className="font-display text-3xl font-medium tracking-tight">SandeshDo</p>
        <p className="mt-2 text-sm text-primary-fg/75">{t("lock.title")}</p>
        <Input
          className="mt-6 h-14 text-center text-2xl tracking-[0.4em]"
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, "").slice(0, 8));
            setErr(false);
          }}
          placeholder="••••"
          autoFocus
        />
        {err && <p className="mt-2 text-xs text-primary-fg/80">{t("vault.wrong")}</p>}
        <Button type="submit" className="mt-4 h-12 w-full bg-bg text-fg hover:bg-bg" disabled={pin.length < 4 || busy}>
          {t("lock.unlock")}
        </Button>
      </form>
    </div>
  );
}
