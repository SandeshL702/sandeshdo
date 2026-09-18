import * as React from "react";
import { cn } from "@/lib/utils";

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "chip" | "soft";
  size?: "sm" | "md" | "lg" | "icon";
}) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-[transform,background-color,opacity] duration-150 ease-out select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        "disabled:pointer-events-none disabled:opacity-40",
        "active:not-disabled:scale-[0.96]",
        variant === "primary" && "bg-primary text-primary-fg shadow-[var(--sd-card-shadow)]",
        variant === "secondary" && "bg-surface text-fg shadow-[var(--sd-card-shadow)]",
        variant === "ghost" && "bg-transparent text-fg hover:bg-fg/5",
        variant === "danger" && "bg-urgent text-urgent-fg",
        variant === "soft" && "bg-primary/12 text-primary",
        variant === "chip" && "bg-fg/6 text-fg",
        size === "sm" && "h-9 rounded-lg px-3 text-sm",
        size === "md" && "h-11 rounded-xl px-4 text-sm",
        size === "lg" && "h-12 rounded-2xl px-5 text-base",
        size === "icon" && "size-11 rounded-2xl",
        className,
      )}
      {...props}
    />
  );
}

export function IconButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("size-11 shrink-0 text-fg", className)}
      {...props}
    />
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-xl bg-bg px-3.5 text-base text-fg shadow-[var(--sd-card-shadow)]",
          "placeholder:text-subtle outline-none focus:ring-2 focus:ring-primary/35",
          className,
        )}
        {...props}
      />
    );
  },
);

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-xl bg-bg px-3.5 py-3 text-base text-fg shadow-[var(--sd-card-shadow)]",
        "placeholder:text-subtle outline-none focus:ring-2 focus:ring-primary/35",
        className,
      )}
      {...props}
    />
  );
}

export function Switch({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150",
        checked ? "bg-primary" : "bg-fg/15",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-6 rounded-full bg-elevated shadow-sm transition-transform duration-150",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}

export function SectionLabel({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "overdue" }) {
  return (
    <div
      className={cn(
        "px-1 pb-2 text-[11px] font-semibold tracking-[0.16em] uppercase",
        tone === "overdue" ? "text-overdue" : "text-muted",
      )}
    >
      {children}
    </div>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-xs font-medium text-muted">{children}</div>;
}
