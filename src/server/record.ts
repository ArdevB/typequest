import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RunResult } from "@/engine";
import type { LessonPayload, ProgressResponse, RunPayload } from "@/lib/payloads";
import { LESSON_PASS_XP, LESSON_STAR_XP, PB_BONUS_XP, levelForXp, rankFor, runXp } from "@/lib/progression";
import type { Stars } from "@/lessons/rating";

/** Oldest timestamp accepted for a run synced from guest storage. */
const MAX_SYNC_AGE_MS = 30 * 24 * 3600 * 1000;

interface RecordRunRpc {
  duplicate: boolean;
  run_id?: string;
  xp?: number;
  xp_awarded?: number;
  rating_wpm?: number;
  previous_best?: number | null;
  is_pb?: boolean;
}

async function saveProgression(admin: SupabaseClient, userId: string, xp: number, gained: number, rating: number | null) {
  const level = levelForXp(xp);
  let rank: string;
  if (rating === null) {
    const { data } = await admin.from("profiles").select("rating_wpm").eq("id", userId).single<{ rating_wpm: number }>();
    rank = rankFor(Number(data?.rating_wpm ?? 0));
  } else {
    rank = rankFor(rating);
  }
  const { error } = await admin.rpc("set_progression", { p_user: userId, p_level: level, p_rank: rank });
  if (error) throw new Error(error.message);
  return { level, rank, leveledUp: levelForXp(xp - gained) < level };
}

/** Writes a validated speed test and updates XP, level and rank. Returns null for an already-synced run. */
export async function recordRun(
  admin: SupabaseClient,
  userId: string,
  p: RunPayload,
  result: RunResult,
): Promise<(ProgressResponse & { duplicate?: boolean }) | null> {
  const now = Date.now();
  const at = p.at && p.at <= now && now - p.at < MAX_SYNC_AGE_MS ? new Date(p.at).toISOString() : undefined;
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
    ...(p.clientId ? { client_id: p.clientId } : {}),
    ...(at ? { created_at: at } : {}),
  };

  const { data, error } = await admin.rpc("record_run", {
    p_user: userId,
    p_run: run,
    p_key_stats: result.perKey,
    p_xp: runXp(result),
    p_pb_bonus: PB_BONUS_XP,
  });
  if (error) throw new Error(error.message);
  const r = data as RecordRunRpc;
  if (r.duplicate) return null;

  const xp = r.xp ?? 0;
  const gained = r.xp_awarded ?? 0;
  const prog = await saveProgression(admin, userId, xp, gained, Number(r.rating_wpm ?? 0));
  return { xpAwarded: gained, xp, ...prog, isPB: Boolean(r.is_pb) };
}

interface RecordLessonRpc {
  xp_awarded: number;
  xp: number;
  stars: number;
  previous_stars: number;
}

/** Writes a validated lesson attempt and updates XP and level. */
export async function recordLesson(
  admin: SupabaseClient,
  userId: string,
  p: LessonPayload,
  result: RunResult,
  stars: Stars,
): Promise<ProgressResponse> {
  const { data, error } = await admin.rpc("record_lesson", {
    p_user: userId,
    p_lesson_id: p.lessonId,
    p_stars: stars,
    p_wpm: result.wpm,
    p_accuracy: result.accuracy,
    p_pass_xp: LESSON_PASS_XP,
    p_star_xp: LESSON_STAR_XP,
  });
  if (error) throw new Error(error.message);
  const r = data as RecordLessonRpc;
  const prog = await saveProgression(admin, userId, r.xp, r.xp_awarded, null);
  return { xpAwarded: r.xp_awarded, xp: r.xp, ...prog, stars: r.stars };
}
