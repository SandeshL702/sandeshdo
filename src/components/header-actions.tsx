import { Link } from "@tanstack/react-router";
import { BarChart3, Settings, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n";

export function HeaderActions() {
  const { t } = useT();
  return (
    <div className="flex shrink-0 items-center">
      <button
        type="button"
        aria-label={t("ai.title")}
        className="flex size-11 items-center justify-center rounded-2xl text-muted transition-colors duration-150 hover:text-fg"
        onClick={() => window.dispatchEvent(new Event("sandeshdo:assistant"))}
      >
        <Sparkles className="size-5" />
      </button>
      <Link
        to="/stats"
        aria-label={t("report.title")}
        className="flex size-11 items-center justify-center rounded-2xl text-muted transition-colors duration-150 hover:text-fg"
      >
        <BarChart3 className="size-5" />
      </Link>
      <Link
        to="/settings"
        aria-label={t("nav.settings")}
        className="flex size-11 items-center justify-center rounded-2xl text-muted transition-colors duration-150 hover:text-fg"
      >
        <Settings className="size-5" />
      </Link>
    </div>
  );
}
