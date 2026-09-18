import { cn } from "@/lib/utils";

export function BrandMark({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <span
        aria-hidden
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-primary font-display font-semibold text-primary-fg",
          compact ? "size-7 text-sm" : "size-8 text-base",
        )}
      >
        S
      </span>
      <span className={cn("min-w-0 truncate font-display font-medium tracking-tight", compact ? "text-base" : "text-lg")}>
        SandeshDo
      </span>
    </div>
  );
}
