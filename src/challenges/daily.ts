import type { RunResult } from "@/engine";
import { challengeGoalSchema, challengeRulesSchema, type ChallengeGoal, type ChallengeRules, type Outcome } from "./types";

/** A daily challenge as stored in the `challenges` table. */
export interface DailyChallenge {
  id: string;
  day: string;
  title: string;
  description: string;
  rules: ChallengeRules;
  goal: ChallengeGoal;
  xp: number;
  seed: number;
  startsAt: string;
  endsAt: string;
}

export interface ChallengeRow {
  id: string;
  day: string;
  title: string;
  description: string;
  rules: unknown;
  goal: unknown;
  reward: unknown;
  seed: number | string;
  starts_at: string;
  ends_at: string;
}

/** Parses a database row defensively (rules are jsonb). Null if malformed. */
export function parseChallengeRow(row: ChallengeRow | null | undefined): DailyChallenge | null {
  if (!row) return null;
  const rules = challengeRulesSchema.safeParse(row.rules);
  const goal = challengeGoalSchema.safeParse(row.goal ?? {});
  if (!rules.success || !goal.success) return null;
  const reward = (row.reward ?? {}) as { xp?: unknown };
  return {
    id: row.id,
    day: row.day,
    title: row.title,
    description: row.description,
    rules: rules.data,
    goal: goal.data,
    xp: typeof reward.xp === "number" ? reward.xp : 50,
    seed: Number(row.seed),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  };
}

/** Pass/fail for a daily challenge run. */
export function evaluateDaily(goal: ChallengeGoal, result: RunResult, finishedNaturally: boolean): Outcome {
  if (!finishedNaturally) return { passed: false, reason: "The run wasn't finished." };
  if (goal.minAccuracy !== undefined && result.accuracy < goal.minAccuracy) {
    return { passed: false, reason: `Accuracy ${result.accuracy.toFixed(1)}% — this challenge needs ${goal.minAccuracy}%.` };
  }
  if (result.wpm <= 0) return { passed: false, reason: "No correct words." };
  return { passed: true, reason: "Challenge complete!" };
}

/** Nepal is UTC+5:45 all year (no daylight saving). */
const NPT_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;

/** Today's date in Nepal as YYYY-MM-DD. */
export function nepalDay(now: number = Date.now()): string {
  return new Date(now + NPT_OFFSET_MS).toISOString().slice(0, 10);
}

/** The hour (0–23) in Nepal. */
export function nepalHour(now: number = Date.now()): number {
  return new Date(now + NPT_OFFSET_MS).getUTCHours();
}

/** Milliseconds until the next midnight in Nepal (when the daily challenge changes). */
export function msUntilNextDaily(now: number = Date.now()): number {
  const local = now + NPT_OFFSET_MS;
  const nextMidnight = (Math.floor(local / 86_400_000) + 1) * 86_400_000;
  return nextMidnight - local;
}

export function describeRules(r: ChallengeRules): string {
  const base = r.mode.kind === "time" ? `${r.mode.seconds} seconds` : `${r.mode.count} words`;
  const extras = [r.punctuation && "punctuation", r.numbers && "numbers", r.stopOnError === "word" && "fix every word"].filter(Boolean);
  return extras.length ? `${base} · ${extras.join(" · ")}` : base;
}
