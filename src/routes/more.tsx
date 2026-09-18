import { Link, createFileRoute } from "@tanstack/react-router";
import { BarChart3, CalendarDays, Lock, NotebookPen, Map, Settings } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { HeaderActions } from "@/components/header-actions";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/more")({ component: MorePage });

export function MorePage() {
  const { t } = useT();
  const items = [
    { to: "/notes" as const, icon: NotebookPen, title: t("more.notes"), hint: t("more.notesHint") },
    { to: "/plans" as const, icon: Map, title: t("more.plans"), hint: t("more.plansHint") },
    { to: "/vault" as const, icon: Lock, title: t("more.vault"), hint: t("more.vaultHint") },
    { to: "/stats" as const, icon: BarChart3, title: t("more.report"), hint: t("more.reportHint") },
    { to: "/calendar" as const, icon: CalendarDays, title: t("more.calendar"), hint: t("guide.mapDiary") },
    { to: "/settings" as const, icon: Settings, title: t("more.settings"), hint: t("settings.tag") },
  ];

  return (
    <main className="overflow-x-hidden px-5 pt-5 pb-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <BrandMark compact />
          <h1 className="font-display mt-3 text-title leading-none font-medium tracking-tight">{t("more.title")}</h1>
          <p className="mt-1.5 text-sm text-muted">{t("guide.mapTitle")}</p>
        </div>
        <HeaderActions />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 rounded-[1.35rem] bg-surface px-4 py-4 shadow-[var(--sd-card-shadow)]"
            >
              <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{item.title}</span>
                <span className="mt-0.5 block truncate text-xs text-muted">{item.hint}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
