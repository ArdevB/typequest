import "server-only";
import { parseChallengeRow, type ChallengeRow, type DailyChallenge } from "@/challenges/daily";
import { getServerSupabase } from "@/lib/supabase/server";
import type { LeaderboardRow } from "@/lib/supabase/types";

export interface DailyBoardRow extends Omit<LeaderboardRow, "raw" | "run_at"> {
  attempt_at: string;
}

/**
 * Today's daily challenge (created on demand if the midnight job hasn't run)
 * and its leaderboard. `configured` is false without Supabase settings.
 */
export async function loadDaily(): Promise<{
  configured: boolean;
  challenge: DailyChallenge | null;
  board: DailyBoardRow[];
  error: string | null;
}> {
  const supabase = await getServerSupabase();
  if (!supabase) return { configured: false, challenge: null, board: [], error: null };
  const { data, error } = await supabase.rpc("ensure_daily_challenge");
  if (error) return { configured: true, challenge: null, board: [], error: error.message };
  const challenge = parseChallengeRow(data as ChallengeRow);
  if (!challenge) return { configured: true, challenge: null, board: [], error: "bad challenge data" };
  const lb = await supabase.rpc("challenge_leaderboard", { p_challenge: challenge.id, p_limit: 20 });
  return { configured: true, challenge, board: (lb.data ?? []) as DailyBoardRow[], error: null };
}
