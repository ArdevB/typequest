import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ACHIEVEMENTS_BY_ID } from "@/achievements/catalog";
import { newlyEarned, type PlayerStats, type RunContext } from "@/achievements/check";
import type { RunResult } from "@/engine";
import type { LessonPayload, ProgressResponse, RunPayload, StreakInfo, UnlockedAchievement } from "@/lib/payloads";
import { LESSON_PASS_XP, LESSON_STAR_XP, PB_BONUS_XP, levelForXp, rankFor, runXp } from "@/lib/progression";
import type { Stars } from "@/lessons/rating";

/** Oldest timestamp accepted for a run synced from guest storage. */
const MAX_SYNC_AGE_MS = 30 * 24 * 3600 * 1000;

async function rpc<T>(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

// ---------------------------------------------------------------------------
// Activity writers. Each returns the XP it added; finalize() does the rest.
// ---------------------------------------------------------------------------

export interface RecordedRun {
  xpAwarded: number;
  isPB: boolean;
  previousBest: number | null;
  context: RunContext;
}

/** Writes a validated speed test. Returns null for an already-synced run. */
export async function recordRun(admin: SupabaseClient, userId: string, p: RunPayload, result: RunResult): Promise<RecordedRun | null> {
  const now = Date.now();
  const at = p.at && p.at <= now && now - p.at < MAX_SYNC_AGE_MS ? p.at : now;
  const run = {
    mode: p.mode.kind,
    mode_value: p.mode.kind === "time" ? p.mode.seconds : p.mode.count,
    punctuation: p.punctuation,
    numbers: p.numbers,
    seed: p.seed,
    wpm: result.wpm,
    raw: result.rawWpm,
    accuracy: result.accuracy,
    consistency: result.consistency,
    duration_ms: result.durationMs,
    chars: result.chars,
    max_combo: result.maxCombo,
    keystroke_log: result.log,
    created_at: new Date(at).toISOString(),
    ...(p.clientId ? { client_id: p.clientId } : {}),
  };
  const r = await rpc<{ duplicate: boolean; xp_awarded?: number; is_pb?: boolean; previous_best?: number | null }>(
    admin,
    "record_run",
    { p_user: userId, p_run: run, p_key_stats: result.perKey, p_xp: runXp(result), p_pb_bonus: PB_BONUS_XP },
  );
  if (r.duplicate) return null;
  const previousBest = r.previous_best === null || r.previous_best === undefined ? null : Number(r.previous_best);
  const isPB = Boolean(r.is_pb);
  return { xpAwarded: r.xp_awarded ?? 0, isPB, previousBest, context: { result, isPB, previousBest, at } };
}

/** Writes a validated lesson attempt. */
export async function recordLesson(
  admin: SupabaseClient,
  userId: string,
  p: LessonPayload,
  result: RunResult,
  stars: Stars,
): Promise<{ xpAwarded: number; stars: number }> {
  const r = await rpc<{ xp_awarded: number; stars: number }>(admin, "record_lesson", {
    p_user: userId,
    p_lesson_id: p.lessonId,
    p_stars: stars,
    p_wpm: result.wpm,
    p_accuracy: result.accuracy,
    p_pass_xp: LESSON_PASS_XP,
    p_star_xp: LESSON_STAR_XP,
  });
  return { xpAwarded: r.xp_awarded, stars: r.stars };
}

/** Writes a validated challenge attempt (daily run or skill clear). */
export async function recordChallenge(
  admin: SupabaseClient,
  userId: string,
  target: { challengeId: string } | { skillId: string; tier: number },
  seed: number,
  result: RunResult,
  passed: boolean,
  xpFirst: number,
): Promise<{ xpAwarded: number; firstPass: boolean }> {
  const r = await rpc<{ xp_awarded: number; first_pass: boolean }>(admin, "record_challenge_attempt", {
    p_user: userId,
    p_challenge: "challengeId" in target ? target.challengeId : null,
    p_skill: "skillId" in target ? target.skillId : null,
    p_tier: "tier" in target ? target.tier : null,
    p_attempt: {
      passed,
      seed,
      wpm: result.wpm,
      raw: result.rawWpm,
      accuracy: result.accuracy,
      duration_ms: result.durationMs,
      keystroke_log: result.log,
    },
    p_xp_first: xpFirst,
  });
  return { xpAwarded: r.xp_awarded, firstPass: r.first_pass };
}

// ---------------------------------------------------------------------------
// After any activity: streak, achievements, level and rank.
// ---------------------------------------------------------------------------

interface StreakRpc {
  streak: number;
  best_streak: number;
  freezes: number;
  changed: boolean;
  milestone: number | null;
  xp_awarded: number;
  freezes_used: number;
}

/**
 * Extends the daily streak, grants any newly earned achievements, and saves
 * the resulting level and rank. `activityXp` is the XP the activity itself
 * already added, so the response can report the total gained.
 */
export async function finalize(
  admin: SupabaseClient,
  userId: string,
  activityXp: number,
  runs: readonly RunContext[] = [],
): Promise<ProgressResponse> {
  const s = await rpc<StreakRpc | null>(admin, "touch_streak", { p_user: userId });
  const stats = await rpc<PlayerStats & { xp: number; rating_wpm: number }>(admin, "player_stats", { p_user: userId });

  let achievements: UnlockedAchievement[] = [];
  let achievementXp = 0;
  let xp = stats.xp;
  const earned = newlyEarned(stats, runs);
  if (earned.length > 0) {
    const g = await rpc<{ new: string[]; xp_awarded: number; xp: number }>(admin, "grant_achievements", {
      p_user: userId,
      p_ids: earned,
    });
    achievementXp = g.xp_awarded;
    xp = g.xp;
    achievements = g.new.flatMap((id) => {
      const a = ACHIEVEMENTS_BY_ID.get(id);
      return a ? [{ id, name: a.name, xp: a.xp }] : [];
    });
  }

  const gained = activityXp + (s?.xp_awarded ?? 0) + achievementXp;
  const level = levelForXp(xp);
  const rank = rankFor(Number(stats.rating_wpm));
  await rpc(admin, "set_progression", { p_user: userId, p_level: level, p_rank: rank });

  const streak: StreakInfo | undefined = s
    ? {
        streak: s.streak,
        bestStreak: s.best_streak,
        freezes: s.freezes,
        changed: s.changed,
        milestone: s.milestone,
        freezesUsed: s.freezes_used,
      }
    : undefined;

  return {
    xpAwarded: gained,
    xp,
    level,
    leveledUp: levelForXp(xp - gained) < level,
    rank,
    streak,
    achievements,
  };
}
