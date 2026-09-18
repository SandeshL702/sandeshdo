import { Link } from "@tanstack/react-router";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function ViewSwitch({ current }: { current: "list" | "cal" | "done" }) {
  const { t } = useT();
  const item = (active: boolean) =>
    cn(
      "flex h-9 items-center justify-center rounded-full text-sm font-semibold whitespace-nowrap",
      "transition-[background-color,color] duration-150 ease-out",
      active ? "bg-fg text-bg" : "text-muted",
    );
  return (
    <div className="sd-seg grid grid-cols-3">
      <Link to="/" search={{ v: undefined }} className={item(current === "list")}>
        {t("view.list")}
      </Link>
      <Link to="/calendar" className={item(current === "cal")}>
        {t("view.calendar")}
      </Link>
      <Link to="/" search={{ v: "done" }} className={item(current === "done")}>
        {t("view.done")}
      </Link>
    </div>
  );
}
