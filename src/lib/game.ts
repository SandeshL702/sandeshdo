import type { GameProgress, Priority } from "./types";
import { dayKey } from "./time";

export const XP_PER_LEVEL = 100;

export type RankId = "spark" | "doer" | "closer" | "finisher" | "legend";

export const RANKS: ReadonlyArray<{ minLevel: number; id: RankId; mark: number }> = [
  { minLevel: 1, id: "spark", mark: 1 },
  { minLevel: 3, id: "doer", mark: 2 },
  { minLevel: 6, id: "closer", mark: 3 },
  { minLevel: 10, id: "finisher", mark: 4 },
  { minLevel: 16, id: "legend", mark: 5 },
];

export const DEFAULT_GAME: GameProgress = {
  xp: 80,
  coins: 25,
  lastActiveDay: null,
  streak: 0,
  hp: 80,
  lastDamageDay: null,
  combo: 0,
  lastFinishAt: null,
  questDay: null,
  claimedQuests: [],
};

export const MAX_HP = 100;
export const HEARTS = 5;
export const HEAL_COST = 25;
export const HEAL_AMOUNT = 28;
export const REVIVE_COST = 50;
export const COMBO_WINDOW_MS = 90 * 60_000;

export function heartsFromHp(hp: number): number {
  return Math.max(0, Math.min(HEARTS, Math.ceil((hp / MAX_HP) * HEARTS)));
}

export function isDowned(game: GameProgress): boolean {
  return game.hp <= 0;
}

export function applyOverdueDamage(game: GameProgress, overdueCount: number, now = Date.now()): GameProgress {
  const today = dayKey(now);
  if (game.lastDamageDay === today) return game;
  if (overdueCount <= 0) return { ...game, lastDamageDay: today };
  const hit = Math.min(50, overdueCount * 10);
  const hp = Math.max(0, game.hp - hit);
  return {
    ...game,
    hp,
    lastDamageDay: today,
    streak: hp === 0 || overdueCount >= 3 ? 0 : game.streak,
    combo: hp === 0 ? 0 : game.combo,
  };
}

export function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1);
}

export function rankIdFromLevel(level: number): RankId {
  let id: RankId = RANKS[0].id;
  for (const r of RANKS) {
    if (level >= r.minLevel) id = r.id;
  }
  return id;
}

export function rankFromLevel(level: number): RankId {
  return rankIdFromLevel(level);
}

export function nextRankId(level: number): RankId | null {
  const current = rankIdFromLevel(level);
  const idx = RANKS.findIndex((r) => r.id === current);
  return RANKS[idx + 1]?.id ?? null;
}

export function rankMark(level: number): number {
  let mark = 1;
  for (const r of RANKS) {
    if (level >= r.minLevel) mark = r.mark;
  }
  return mark;
}

export function xpIntoLevel(xp: number): { into: number; need: number; pct: number } {
  const into = xp % XP_PER_LEVEL;
  return { into, need: XP_PER_LEVEL, pct: Math.round((into / XP_PER_LEVEL) * 100) };
}

export function xpForTask(priority: Priority, streak: number, combo = 1): number {
  const base = priority === "urgent" ? 48 : priority === "high" ? 36 : priority === "low" ? 18 : 24;
  const streakBonus = Math.min(24, streak * 3);
  const comboBonus = Math.min(40, Math.max(0, combo - 1) * 10);
  return base + streakBonus + comboBonus;
}

export function applyFinish(
  game: GameProgress,
  priority: Priority,
  now = Date.now(),
): {
  game: GameProgress;
  xpGain: number;
  coinGain: number;
  combo: number;
  levelUp: boolean;
  level: number;
  rank: RankId;
  hpGain: number;
} {
  const today = dayKey(now);
  let streak = game.streak;
  if (game.lastActiveDay === today) {
    streak = Math.max(1, streak);
  } else if (game.lastActiveDay === dayKey(now - 24 * 60 * 60_000)) {
    streak += 1;
  } else {
    streak = 1;
  }
  const combo =
    game.lastFinishAt && now - game.lastFinishAt <= COMBO_WINDOW_MS ? Math.max(1, game.combo) + 1 : 1;
  const xpGain = xpForTask(priority, streak, combo);
  const coinGain = 5 + Math.min(15, combo * 2);
  const hpGain = Math.min(12, 6 + combo);
  const prevLevel = levelFromXp(game.xp);
  const next: GameProgress = {
    ...game,
    xp: game.xp + xpGain,
    coins: game.coins + coinGain,
    streak,
    lastActiveDay: today,
    hp: Math.min(MAX_HP, Math.max(1, game.hp) + hpGain),
    combo,
    lastFinishAt: now,
  };
  const level = levelFromXp(next.xp);
  return {
    game: next,
    xpGain,
    coinGain,
    combo,
    levelUp: level > prevLevel,
    level,
    rank: rankIdFromLevel(level),
    hpGain,
  };
}

export function applySpendXp(game: GameProgress, now = Date.now()): GameProgress {
  const today = dayKey(now);
  return {
    ...game,
    xp: game.xp + 4,
    coins: game.coins + 1,
    lastActiveDay: today,
    streak:
      game.lastActiveDay === today || game.lastActiveDay === dayKey(now - 24 * 60 * 60_000)
        ? Math.max(game.streak, 1)
        : game.streak,
  };
}

export function spendHeal(game: GameProgress): GameProgress | null {
  if (game.coins < HEAL_COST || game.hp >= MAX_HP) return null;
  return { ...game, coins: game.coins - HEAL_COST, hp: Math.min(MAX_HP, game.hp + HEAL_AMOUNT) };
}

export function spendRevive(game: GameProgress): GameProgress | null {
  if (game.hp > 0) return spendHeal(game);
  if (game.coins < REVIVE_COST) return null;
  return { ...game, coins: game.coins - REVIVE_COST, hp: 40, combo: 0 };
}

export type DailyQuest = {
  id: string;
  title: string;
  hint: string;
  done: boolean;
  reward: number;
  progress: string;
};

export function dailyQuests(input: {
  finishedToday: number;
  overdue: number;
  moneyToday: number;
}): DailyQuest[] {
  return [
    {
      id: "close3",
      title: "Close 3",
      hint: "Finish three tasks",
      done: input.finishedToday >= 3,
      reward: 15,
      progress: `${Math.min(3, input.finishedToday)}/3`,
    },
    {
      id: "clean",
      title: "Clear overdue",
      hint: "Nothing waiting from before",
      done: input.overdue === 0 && input.finishedToday > 0,
      reward: 20,
      progress: input.overdue === 0 ? "Clear" : `${input.overdue} left`,
    },
    {
      id: "paisa",
      title: "Log paisa",
      hint: "One money entry today",
      done: input.moneyToday > 0,
      reward: 10,
      progress: input.moneyToday > 0 ? "Logged" : "Open",
    },
  ];
}

export function awardQuests(game: GameProgress, quests: DailyQuest[], now = Date.now()): GameProgress {
  const today = dayKey(now);
  const claimed = game.questDay === today ? [...game.claimedQuests] : [];
  let coins = game.coins;
  let xp = game.xp;
  for (const q of quests) {
    if (q.done && !claimed.includes(q.id)) {
      claimed.push(q.id);
      coins += q.reward;
      xp += 8;
    }
  }
  return { ...game, coins, xp, claimedQuests: claimed, questDay: today };
}
