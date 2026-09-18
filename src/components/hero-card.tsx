import type { ReactNode } from "react";
import { Check, Coins, Flame } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  HEARTS,
  heartsFromHp,
  HEAL_COST,
  isDowned,
  levelFromXp,
  nextRankId,
  rankIdFromLevel,
  REVIVE_COST,
  xpIntoLevel,
  type DailyQuest,
} from "@/lib/game";
import { useApp } from "@/lib/store";
import { formatInr } from "@/lib/money";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { HeroFigure } from "@/components/character";

export function HeroCard({
  raidPct,
  remaining,
  finished,
  moneyLeft,
  nextTitle,
  quests,
}: {
  raidPct: number;
  remaining: number;
  finished: number;
  moneyLeft: number;
  nextTitle: string | null;
  quests: DailyQuest[];
}) {
  const { t } = useT();
  const game = useApp((s) => s.game);
  const lastFinish = useApp((s) => s.lastFinish);
  const spendHeal = useApp((s) => s.spendHeal);
  const spendRevive = useApp((s) => s.spendRevive);
  const level = levelFromXp(game.xp);
  const rank = rankIdFromLevel(level);
  const energy = xpIntoLevel(game.xp);
  const hearts = heartsFromHp(game.hp);
  const downed = isDowned(game);
  const upcoming = nextRankId(level);
  const raidLabel = remaining === 0 ? t("hero.raidClear") : `${finished}/${finished + remaining}`;
  const pose = downed ? "down" : lastFinish ? "win" : "idle";

  return (
    <section className="overflow-hidden rounded-[1.75rem] bg-fg text-bg shadow-[var(--sd-dock-shadow)]">
      <div className="flex items-center justify-between px-4 pt-3 text-[10px] font-semibold tracking-[0.16em] uppercase opacity-65">
        <span>SandeshDo</span>
        <span>{downed ? t("hero.downed") : t("hero.live")}</span>
      </div>

      <div className="px-4 pt-1 pb-2">
        <HeroFigure level={level} hp={game.hp} energyPct={energy.pct} pose={pose} size={168} />
        <p className="font-display mt-1 text-center text-[2rem] leading-none font-medium tracking-tight">
          {t(`rank.${rank}`)}
        </p>
        <div className="mx-10 mt-3">
          <div className="flex items-center justify-between text-[10px] font-semibold tracking-[0.14em] uppercase opacity-60">
            <span>{t("hero.form")}</span>
            <span>{upcoming ? t(`rank.${upcoming}`) : t(`rank.${rank}`)}</span>
          </div>
          <div className="sd-bar mt-1.5">
            <div className="sd-bar-fill bg-primary" style={{ width: `${energy.pct}%` }} />
          </div>
        </div>
        {upcoming && (
          <p className="mt-1.5 text-center text-[11px] font-medium opacity-60">
            {t("hero.nextForm", { rank: t(`rank.${upcoming}`) })}
          </p>
        )}
        <div className="sd-life mt-3" aria-label={t("stats.life")}>
          {Array.from({ length: HEARTS }).map((_, i) => (
            <i key={i} className={i < hearts ? "on" : undefined} />
          ))}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1 px-4">
        <StatChip
          icon={<span className="size-3.5 rounded-full bg-bg/40" />}
          label={String(hearts)}
          hint={t("stats.life")}
          onClick={() => (downed ? spendRevive() : spendHeal())}
        />
        <StatChip icon={<Coins className="size-3.5" strokeWidth={2.2} />} label={String(game.coins)} hint={t("stats.coins")} />
        <StatChip
          icon={<Flame className="size-3.5" strokeWidth={2.2} />}
          label={game.combo > 1 ? t("hero.combo", { n: game.combo }) : t("hero.streak", { n: game.streak })}
          hint={t("stats.streak")}
        />
      </div>

      {downed && (
        <div className="mx-4 mt-3 flex items-center justify-between rounded-2xl bg-bg/12 px-3 py-2.5">
          <p className="text-xs leading-snug opacity-85">{t("hero.downedHint")}</p>
          <button
            type="button"
            onClick={() => spendRevive()}
            disabled={game.coins < REVIVE_COST}
            className="shrink-0 rounded-full bg-bg px-3 py-1.5 text-[11px] font-semibold text-fg disabled:opacity-40"
          >
            {t("hero.revive", { n: REVIVE_COST })}
          </button>
        </div>
      )}

      {!downed && game.hp < 70 && (
        <button
          type="button"
          onClick={() => spendHeal()}
          disabled={game.coins < HEAL_COST}
          className="mx-4 mt-3 block rounded-2xl bg-bg/12 px-3 py-2 text-left text-xs opacity-85 disabled:opacity-40"
        >
          {t("hero.rest", { n: HEAL_COST })}
        </button>
      )}

      <div className="mx-4 mt-3 rounded-2xl bg-bg/10 px-3 py-2.5">
        <div className="flex items-center justify-between text-[10px] font-semibold tracking-[0.14em] uppercase opacity-70">
          <span>{t("hero.todayFight")}</span>
          <span>{raidLabel}</span>
        </div>
        <div className="sd-bar mt-1.5">
          <div className="sd-bar-fill bg-primary" style={{ width: `${raidPct}%` }} />
        </div>
        <p className="mt-1.5 truncate text-xs opacity-80">
          {remaining === 0
            ? t("hero.raidClear")
            : nextTitle
              ? t("hero.next", { title: nextTitle })
              : t("hero.left", { n: remaining })}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-px bg-bg/10">
        {quests.map((q) => (
          <div key={q.id} className="bg-fg px-2.5 py-2.5">
            <div className="flex items-center justify-between gap-1">
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-full border",
                  q.done ? "border-primary bg-primary text-primary-fg" : "border-bg/35",
                )}
              >
                {q.done ? <Check className="size-2.5" strokeWidth={3} /> : null}
              </span>
            </div>
            <div className="mt-1 text-[11px] font-semibold leading-tight">{t(`quest.${q.id}`)}</div>
            <div className="mt-0.5 text-[10px] tabular-nums opacity-60">{q.done ? t("quest.done") : q.progress}</div>
          </div>
        ))}
      </div>

      <Link
        to="/money"
        className="flex items-center justify-between px-4 py-2.5 text-[11px] font-semibold tabular-nums opacity-80"
      >
        <span className="tracking-[0.12em] uppercase">{t("hero.paisa")}</span>
        <span>{t("hero.paisaLeft", { n: formatInr(moneyLeft) })}</span>
      </Link>
    </section>
  );
}

function StatChip({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="opacity-70">{icon}</span>
      <span className="mt-0.5 text-[12px] font-semibold tabular-nums leading-none">{label}</span>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="flex flex-col items-center rounded-2xl bg-bg/10 px-1 py-1.5" aria-label={hint}>
        {inner}
      </button>
    );
  }
  return (
    <div className="flex flex-col items-center rounded-2xl bg-bg/10 px-1 py-1.5" aria-label={hint}>
      {inner}
    </div>
  );
}
