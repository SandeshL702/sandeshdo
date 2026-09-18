import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { useT } from "@/lib/i18n";

const KEY = "sandeshdo-hi";

export function Splash() {
  const { t } = useT();
  const name = useApp((s) => s.settings.userName.trim() || "Sandesh");
  const [show, setShow] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY) === "1") {
        setGone(true);
        return;
      }
    } catch {
      /* private */
    }
    setShow(true);
    const hide = window.setTimeout(() => {
      setShow(false);
      try {
        sessionStorage.setItem(KEY, "1");
      } catch {
        /* private */
      }
      window.setTimeout(() => setGone(true), 280);
    }, 1100);
    return () => window.clearTimeout(hide);
  }, []);

  if (gone) return null;

  return (
    <div
      className={`sd-splash ${show ? "sd-splash-in" : "sd-splash-out"}`}
      role="status"
      aria-live="polite"
    >
      <p className="font-display text-3xl font-medium tracking-tight">{t("splash.hi", { name })}</p>
      <p className="mt-2 text-sm font-semibold tracking-wide text-primary-fg/80">SandeshDo</p>
      <p className="mt-1 text-micro font-semibold tracking-[0.16em] text-primary-fg/60 uppercase">
        {t("guide.loop")}
      </p>
    </div>
  );
}
