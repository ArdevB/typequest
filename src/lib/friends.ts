"use client";

import type { FriendChallengeSettings } from "@/lib/payloads";
import type { Rank } from "@/lib/progression";
import { loadSupabase } from "@/lib/supabase/lazy";

export type Relation = "none" | "friend" | "incoming" | "outgoing";

export interface FriendRow {
  friendship_id: string;
  user_id: string;
  username: string;
  level: number;
  xp: number;
  rank: Rank;
  rating_wpm: number;
  streak: number;
  best_wpm: number;
  relation: Exclude<Relation, "none">;
  since: string;
}

export interface FriendChallengeRow {
  id: string;
  challenger: string;
  challenger_name: string;
  challenger_level: number;
  opponent: string;
  opponent_name: string;
  opponent_level: number;
  settings: FriendChallengeSettings;
  seed: number;
  challenger_wpm: number;
  challenger_accuracy: number;
  opponent_wpm: number | null;
  opponent_accuracy: number | null;
  status: "open" | "done" | "declined" | "expired";
  winner: string | null;
  created_at: string;
  expires_at: string;
}

type Res<T> = { ok: true; data: T } | { ok: false; error: string };

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<Res<T>> {
  const sb = await loadSupabase();
  if (!sb) return { ok: false, error: "Accounts aren't set up yet." };
  const { data, error } = await sb.rpc(fn, args);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data as T };
}

export const listFriends = () => rpc<FriendRow[]>("my_friends");
export const listFriendChallenges = () => rpc<FriendChallengeRow[]>("my_friend_challenges", { p_limit: 40 });
export const friendStatus = (userId: string) => rpc<{ relation: Relation; id?: string }>("friend_status", { p_other: userId });
export const respondToRequest = (id: string, accept: boolean) => rpc<boolean>("respond_friend_request", { p_id: id, p_accept: accept });
export const removeFriend = (userId: string) => rpc<boolean>("remove_friend", { p_other: userId });
export const declineChallenge = (id: string) => rpc<boolean>("decline_friend_challenge", { p_id: id });

const SEND_MESSAGES: Record<string, string> = {
  sent: "Request sent!",
  accepted: "You're now friends!",
  already_sent: "You already sent them a request.",
  already_friends: "You're already friends.",
  self: "That's you!",
  not_found: "No player with that username.",
  signed_out: "Sign in to add friends.",
};

export async function sendFriendRequest(username: string): Promise<{ ok: boolean; status: string; message: string }> {
  const r = await rpc<{ status: string }>("send_friend_request", { p_username: username });
  if (!r.ok) return { ok: false, status: "error", message: r.error };
  const status = r.data.status;
  return { ok: status === "sent" || status === "accepted", status, message: SEND_MESSAGES[status] ?? status };
}

export async function loadChallenge(id: string): Promise<FriendChallengeRow | null> {
  const r = await listFriendChallenges();
  return r.ok ? (r.data.find((c) => c.id === id) ?? null) : null;
}

export function describeSettings(s: FriendChallengeSettings): string {
  const base = s.mode.kind === "time" ? `${s.mode.seconds} seconds` : `${s.mode.count} words`;
  const extras = [s.punctuation && "punctuation", s.numbers && "numbers"].filter(Boolean);
  return extras.length ? `${base} · ${extras.join(" · ")}` : base;
}
