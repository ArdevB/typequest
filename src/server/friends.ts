import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RunResult } from "@/engine";
import type { FriendChallengeSettings, RunPayload } from "@/lib/payloads";
import { friendChallengeSettings } from "@/lib/payloads";
import { validateRun } from "./validateRun";

/** XP for winning a friend challenge (on top of the run's own XP). */
export const FRIEND_WIN_XP = 30;

/** A friend-challenge run is an ordinary speed test with the challenge's settings and seed. */
export function challengeRunPayload(settings: FriendChallengeSettings, seed: number, log: RunPayload["log"]): RunPayload {
  return { mode: settings.mode, punctuation: settings.punctuation, numbers: settings.numbers, stopOnError: "off", seed, log };
}

export function checkChallengeRun(settings: FriendChallengeSettings, seed: number, log: RunPayload["log"]) {
  const payload = challengeRunPayload(settings, seed, log);
  const v = validateRun(payload);
  return v.ok ? { ok: true as const, payload, result: v.value } : v;
}

export interface OpenChallenge {
  id: string;
  challenger: string;
  opponent: string;
  settings: FriendChallengeSettings;
  seed: number;
  status: string;
}

export async function loadChallenge(admin: SupabaseClient, id: string): Promise<OpenChallenge | null> {
  const { data } = await admin.from("friend_challenges").select("id, challenger, opponent, settings, seed, status").eq("id", id).maybeSingle();
  if (!data) return null;
  const settings = friendChallengeSettings.safeParse(data.settings);
  if (!settings.success) return null;
  return { ...(data as Omit<OpenChallenge, "settings" | "seed">), settings: settings.data, seed: Number(data.seed) };
}

export async function createChallenge(
  admin: SupabaseClient,
  userId: string,
  opponentId: string,
  settings: FriendChallengeSettings,
  seed: number,
  result: RunResult,
): Promise<{ id?: string; error?: string }> {
  const { data, error } = await admin.rpc("create_friend_challenge", {
    p_user: userId,
    p_opponent: opponentId,
    p_settings: settings,
    p_seed: seed,
    p_wpm: result.wpm,
    p_accuracy: result.accuracy,
    p_log: result.log,
  });
  if (error) throw new Error(`create_friend_challenge: ${error.message}`);
  return data as { id?: string; error?: string };
}

export async function completeChallenge(
  admin: SupabaseClient,
  userId: string,
  id: string,
  result: RunResult,
): Promise<{ winner?: string | null; challenger_wpm?: number; xp_awarded?: number; error?: string }> {
  const { data, error } = await admin.rpc("complete_friend_challenge", {
    p_user: userId,
    p_id: id,
    p_wpm: result.wpm,
    p_accuracy: result.accuracy,
    p_log: result.log,
    p_win_xp: FRIEND_WIN_XP,
  });
  if (error) throw new Error(`complete_friend_challenge: ${error.message}`);
  return data as { winner?: string | null; challenger_wpm?: number; xp_awarded?: number; error?: string };
}
