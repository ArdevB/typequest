import type { Rank } from "@/lib/progression";

/** Row shapes of the tables in supabase/migrations. */
export interface ProfileRow {
  id: string;
  username: string;
  level: number;
  xp: number;
  rank: Rank;
  rating_wpm: number;
  streak: number;
  best_streak: number;
  streak_freezes?: number;
  last_active_on?: string | null;
  selected_theme: string;
  created_at: string;
}

export interface RunRow {
  id: string;
  user_id: string;
  mode: "time" | "words";
  mode_value: number;
  mode_key: string;
  punctuation: boolean;
  numbers: boolean;
  wpm: number;
  raw: number;
  accuracy: number;
  consistency: number;
  duration_ms: number;
  max_combo: number;
  xp_awarded: number;
  created_at: string;
}

export interface LeaderboardRow {
  position: number;
  user_id: string;
  username: string;
  level: number;
  rank: Rank;
  wpm: number;
  accuracy: number;
  raw: number;
  run_at: string;
}

export interface KeyStatRow {
  key: string;
  attempts: number;
  errors: number;
  avg_ms: number;
}

export const PROFILE_COLUMNS = "*";
export const RUN_COLUMNS =
  "id, user_id, mode, mode_value, mode_key, punctuation, numbers, wpm, raw, accuracy, consistency, duration_ms, max_combo, xp_awarded, created_at";
