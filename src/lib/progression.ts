/**
 * XP, levels and ranks. Pure functions shared by the server (which awards XP)
 * and the UI (which draws level bars and rank badges).
 */

export type Rank = "unranked" | "bronze" | "silver" | "gold" | "diamond" | "master";

export const RANKS: readonly { id: Exclude<Rank, "unranked">; name: string; minWpm: number }[] = [
  { id: "bronze", name: "Bronze", minWpm: 0 },
  { id: "silver", name: "Silver", minWpm: 30 },
  { id: "gold", name: "Gold", minWpm: 50 },
  { id: "diamond", name: "Diamond", minWpm: 70 },
  { id: "master", name: "Master", minWpm: 100 },
];

export const RANK_NAMES: Record<Rank, string> = {
  unranked: "Unranked",
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  diamond: "Diamond",
  master: "Master",
};

/**
 * Rank comes from the rating: the average of a player's best 3 time tests of
 * 30 seconds or more (computed in the database). 0 means no qualifying runs yet.
 */
export function rankFor(ratingWpm: number): Rank {
  if (ratingWpm <= 0) return "unranked";
  let rank: Rank = "bronze";
  for (const r of RANKS) if (ratingWpm >= r.minWpm) rank = r.id;
  return rank;
}

export function nextRank(ratingWpm: number): { id: Rank; minWpm: number } | null {
  const next = RANKS.find((r) => r.minWpm > ratingWpm);
  return next ? { id: next.id, minWpm: next.minWpm } : null;
}

/** Total XP needed to reach `level` (level 1 needs 0). Grows a little faster than linear. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(50 * (level - 1) ** 1.5);
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;
  return level;
}

export interface LevelProgress {
  level: number;
  /** XP earned inside the current level. */
  current: number;
  /** XP the current level spans. */
  needed: number;
  /** 0–1. */
  fraction: number;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp);
  const start = xpForLevel(level);
  const end = xpForLevel(level + 1);
  const current = xp - start;
  const needed = end - start;
  return { level, current, needed, fraction: needed > 0 ? current / needed : 0 };
}

/** XP for a speed test: one point per correctly typed word, scaled by accuracy², plus a finishing bonus. */
export function runXp(r: { wpm: number; accuracy: number; durationMs: number }): number {
  const words = r.wpm * (r.durationMs / 60000);
  return Math.max(0, Math.round(words * (r.accuracy / 100) ** 2) + 5);
}

/** Bonus when a run beats the player's previous best for that mode. */
export const PB_BONUS_XP = 20;

/** Lesson XP: for passing, plus for each star earned for the first time. */
export const LESSON_PASS_XP = 5;
export const LESSON_STAR_XP = 10;

/** Game XP: one point per correct word (scaled by accuracy²), +20 for a win, capped at 150. */
export function gameXp(o: { wordsDone: number; accuracy: number; won: boolean }): number {
  return Math.min(150, Math.max(0, Math.round(o.wordsDone * (o.accuracy / 100) ** 2) + (o.won ? 20 : 0)));
}

const wordsTyped = (r: { wpm: number; durationMs: number }) => r.wpm * (r.durationMs / 60000);

/** Chaos XP: like a speed test, multiplied by the chaos stacked, capped at 120. */
export function chaosXp(r: { wpm: number; accuracy: number; durationMs: number }, multiplier: number): number {
  return Math.min(120, Math.max(0, Math.round(wordsTyped(r) * (r.accuracy / 100) ** 2 * multiplier) + 5));
}

/** Practice XP: half a speed test's, capped at 40 (drills are short and repetitive). */
export function practiceXp(r: { wpm: number; accuracy: number; durationMs: number }): number {
  return Math.min(40, Math.max(0, Math.round(wordsTyped(r) * (r.accuracy / 100) ** 2 * 0.5) + 2));
}
