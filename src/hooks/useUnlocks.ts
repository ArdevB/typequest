"use client";

import { useMemo } from "react";
import { unlockedIds, type UnlockStats } from "@/unlocks/catalog";
import { useAuth } from "@/stores/authStore";
import { useGames } from "@/stores/gamesStore";
import { useHistory } from "@/stores/historyStore";
import { useHydrated } from "@/stores/hydration";
import { useLessons } from "@/stores/lessonsStore";

/** Progress numbers that unlocks depend on, from this browser plus the signed-in profile. */
export function useUnlockStats(): UnlockStats | null {
  const ready = useHydrated((s) => s.ready);
  const runs = useHistory((s) => s.runs);
  const bests = useHistory((s) => s.bests);
  const progress = useLessons((s) => s.progress);
  const wins = useGames((s) => s.wins);
  const weeklyWins = useGames((s) => s.weeklyWins);
  const level = useAuth((s) => s.profile?.level ?? 1);

  return useMemo(() => {
    if (!ready) return null;
    return {
      level,
      speedTests: runs.length,
      bestWpm: Math.max(0, ...Object.values(bests).map((b) => b.wpm)),
      lessonsPassed: Object.values(progress).filter((p) => p.stars > 0).length,
      gameWins: Object.entries(wins).reduce((n, [g, w]) => (g === "weekly-boss" ? n : n + w), 0),
      weeklyBossWins: weeklyWins.length,
    };
  }, [ready, runs, bests, progress, wins, weeklyWins, level]);
}

export function useUnlocked(): ReadonlySet<string> {
  const stats = useUnlockStats();
  return useMemo(() => (stats ? unlockedIds(stats) : new Set<string>()), [stats]);
}
