"use client";

import { useEffect, useState } from "react";
import type { PerKeyStat } from "@/engine";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/stores/authStore";
import { useHistory } from "@/stores/historyStore";

export interface KeyStatsView {
  stats: Record<string, PerKeyStat>;
  source: "account" | "browser";
}

/** Per-key stats: the account's when signed in (all synced runs), otherwise this browser's. */
export function useKeyStats(enabled = true): KeyStatsView {
  const local = useHistory((s) => s.keyStats);
  const userId = useAuth((s) => s.userId);
  const [remote, setRemote] = useState<Record<string, PerKeyStat> | null>(null);

  useEffect(() => {
    if (!enabled || !userId) return;
    let live = true;
    void getBrowserSupabase()
      ?.from("key_stats")
      .select("key, attempts, errors, avg_ms")
      .then(({ data }) => {
        if (!data || !live) return;
        setRemote(
          Object.fromEntries(
            (data as { key: string; attempts: number; errors: number; avg_ms: number }[]).map((k) => [
              k.key,
              { attempts: k.attempts, errors: k.errors, avgMs: Number(k.avg_ms) },
            ]),
          ),
        );
      });
    return () => {
      live = false;
    };
  }, [enabled, userId]);

  return remote && Object.keys(remote).length > 0 ? { stats: remote, source: "account" } : { stats: local, source: "browser" };
}
