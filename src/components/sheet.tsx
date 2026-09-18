import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui";

declare global {
  interface Window {
    __sdSheetCount?: number;
    __sdOnBack?: () => boolean;
  }
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  tall = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  tall?: boolean;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    window.__sdSheetCount = (window.__sdSheetCount ?? 0) + 1;
    const close = () => onCloseRef.current();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("sandeshdo:sheet-back", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.__sdSheetCount = Math.max(0, (window.__sdSheetCount ?? 1) - 1);
      window.removeEventListener("sandeshdo:sheet-back", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const html = document.documentElement;
    const scrollY = window.scrollY;
    const prev = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      htmlOverflow: html.style.overflow,
    };
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    html.classList.add("sd-sheet-open");
    const block = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest(".sd-sheet-panel")) return;
      e.preventDefault();
    };
    document.addEventListener("wheel", block, { passive: false, capture: true });
    document.addEventListener("touchmove", block, { passive: false, capture: true });
    return () => {
      document.removeEventListener("wheel", block, true);
      document.removeEventListener("touchmove", block, true);
      html.classList.remove("sd-sheet-open");
      body.style.overflow = prev.overflow;
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      html.style.overflow = prev.htmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="sd-sheet-root fixed inset-0 flex items-end justify-center overscroll-none sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="sd-sheet-backdrop absolute inset-0 bg-fg/45 transition-opacity duration-200"
        onClick={onClose}
      />
      <div
        className={cn(
          "sd-sheet-panel relative flex w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-surface text-fg shadow-[var(--sd-dock-shadow)]",
          "sm:mx-4 sm:rounded-3xl",
          tall ? "max-h-[88dvh]" : "max-h-[80dvh]",
        )}
      >
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-fg/15 sm:hidden" />
        <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-2">
          <h2 className="min-w-0 truncate text-lg font-semibold tracking-tight">{title}</h2>
          <IconButton className="size-10 shrink-0 rounded-xl" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-border px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
