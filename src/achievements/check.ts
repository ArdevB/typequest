import { KeyKind, type RunResult } from "@/engine";
import { SKILLS } from "@/challenges/skills";
import { nepalHour } from "@/challenges/daily";
import { LESSONS, type UnitId } from "@/lessons/catalog";
import { ACHIEVEMENTS } from "./catalog";

/** What the database knows about a player (public.player_stats). */
export interface PlayerStats {
  runs: number;
  daily_passed: number;
  skill_tiers: { skill: string; tier: number }[];
  lessons: Record<string, number>;
  best_streak: number;
  streak: number;
  owned: string[];
}

export interface RunContext {
  result: RunResult;
  isPB: boolean;
  previousBest: number | null;
  /** When the run finished (epoch ms). */
  at: number;
}

const unitPassed = (lessons: Record<string, number>, units: UnitId[]) =>
  LESSONS.filter((l) => units.includes(l.unit)).every((l) => (lessons[l.id] ?? 0) >= 1);

type Rule = (s: PlayerStats, runs: readonly RunContext[]) => boolean;
const anyRun = (f: (r: RunContext) => boolean): Rule => (_s, runs) => runs.some(f);

const RULES: Record<string, Rule> = {
  "first-steps": (s) => s.runs >= 1,
  "wpm-40": anyRun((r) => r.result.wpm >= 40),
  "wpm-60": anyRun((r) => r.result.wpm >= 60),
  "wpm-80": anyRun((r) => r.result.wpm >= 80),
  "wpm-100": anyRun((r) => r.result.wpm >= 100),
  "wpm-120": anyRun((r) => r.result.wpm >= 120),
  flawless: anyRun((r) => r.result.accuracy === 100 && r.result.chars.correct >= 100),
  metronome: anyRun((r) => r.result.consistency >= 90 && r.result.durationMs >= 30_000),
  "combo-50": anyRun((r) => r.result.maxCombo >= 50),
  "combo-100": anyRun((r) => r.result.maxCombo >= 100),
  "combo-250": anyRun((r) => r.result.maxCombo >= 250),
  "home-row-hero": (s) => unitPassed(s.lessons, ["home"]),
  alphabet: (s) => unitPassed(s.lessons, ["home", "top", "bottom"]),
  graduate: (s) => LESSONS.every((l) => (s.lessons[l.id] ?? 0) >= 1),
  "star-collector": (s) => Object.values(s.lessons).filter((n) => n >= 3).length >= 10,
  "tests-10": (s) => s.runs >= 10,
  "tests-100": (s) => s.runs >= 100,
  "tests-1000": (s) => s.runs >= 1000,
  "streak-7": (s) => Math.max(s.best_streak, s.streak) >= 7,
  "streak-30": (s) => Math.max(s.best_streak, s.streak) >= 30,
  "streak-100": (s) => Math.max(s.best_streak, s.streak) >= 100,
  "daily-1": (s) => s.daily_passed >= 1,
  "daily-7": (s) => s.daily_passed >= 7,
  "skill-gold": (s) => s.skill_tiers.some((t) => t.tier >= 3),
  "all-skills": (s) => SKILLS.every((sk) => s.skill_tiers.some((t) => t.skill === sk.id)),
  "night-owl": anyRun((r) => nepalHour(r.at) < 4),
  "early-bird": anyRun((r) => {
    const h = nepalHour(r.at);
    return h >= 5 && h < 7;
  }),
  "the-answer": anyRun((r) => Math.round(r.result.wpm) === 42),
  "photo-finish": anyRun((r) => r.isPB && r.previousBest !== null && r.result.wpm - r.previousBest < 0.5),
  "slow-and-steady": anyRun((r) => r.result.accuracy === 100 && r.result.durationMs >= 60_000 && r.result.wpm > 0 && r.result.wpm < 30),
  "backspace-hero": anyRun(
    (r) => r.result.accuracy >= 95 && r.result.log.filter((k) => k[2] === KeyKind.Backspace).length >= 30,
  ),
};

/** Achievement ids the player has just earned (not already owned). */
export function newlyEarned(stats: PlayerStats, runs: readonly RunContext[] = []): string[] {
  const owned = new Set(stats.owned);
  return ACHIEVEMENTS.filter((a) => !owned.has(a.id) && RULES[a.id]?.(stats, runs)).map((a) => a.id);
}

/** Every catalog entry has a rule (checked in tests). */
export const hasRule = (id: string): boolean => id in RULES;
