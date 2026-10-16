import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateDaily, parseChallengeRow, type ChallengeRow, type DailyChallenge } from "@/challenges/daily";
import { TIER_XP, getSkill } from "@/challenges/skills";
import type { Outcome } from "@/challenges/types";
import type { RunResult } from "@/engine";
import type { ChallengePayload } from "@/lib/payloads";
import { replayChecked, type Validation } from "./validateRun";

/** Attempts are accepted up to this long after a daily challenge ends (slow connections). */
const GRACE_MS = 10 * 60 * 1000;

export interface CheckedAttempt {
  result: RunResult;
  outcome: Outcome;
  seed: number;
  target: { challengeId: string } | { skillId: string; tier: number };
  /** XP for the first pass. */
  xp: number;
  /** Only finished runs are stored; a live-ended fail is just reported back. */
  store: boolean;
}

/** Loads the challenge (daily) or skill definition, replays the log with its exact words and rules, and evaluates it. */
export async function validateChallenge(admin: SupabaseClient, p: ChallengePayload): Promise<Validation<CheckedAttempt>> {
  if (p.kind === "daily") {
    const { data } = await admin
      .from("challenges")
      .select("id, day, title, description, rules, goal, reward, seed, starts_at, ends_at")
      .eq("id", p.challengeId)
      .maybeSingle<ChallengeRow>();
    const c: DailyChallenge | null = parseChallengeRow(data);
    if (!c) return { ok: false, reason: "unknown challenge" };
    const now = Date.now();
    if (now < Date.parse(c.startsAt) || now > Date.parse(c.endsAt) + GRACE_MS) {
      return { ok: false, reason: "this challenge is closed" };
    }
    const r = replayChecked({ ...c.rules, seed: c.seed, log: p.log });
    if (!r.ok) return r;
    const outcome = evaluateDaily(c.goal, r.value.result, r.value.finishedNaturally);
    return {
      ok: true,
      value: {
        result: r.value.result,
        outcome,
        seed: c.seed,
        target: { challengeId: c.id },
        xp: c.xp,
        store: r.value.finishedNaturally,
      },
    };
  }

  const skill = getSkill(p.skillId);
  if (!skill) return { ok: false, reason: "unknown skill challenge" };
  const setup = skill.setup(p.tier);
  const r = replayChecked({
    mode: setup.mode,
    punctuation: setup.punctuation,
    numbers: setup.numbers,
    stopOnError: setup.stopOnError,
    seed: p.seed,
    log: p.log,
    keyWeights: setup.guard.adaptive ? p.keyWeights : undefined,
  });
  if (!r.ok) return r;
  const outcome = skill.evaluate(p.tier, r.value.result, r.value.finishedNaturally);
  return {
    ok: true,
    value: {
      result: r.value.result,
      outcome,
      seed: p.seed,
      target: { skillId: skill.id, tier: p.tier },
      xp: TIER_XP[p.tier],
      // Skill attempts are stored only when passed (they're practice otherwise).
      store: outcome.passed,
    },
  };
}
