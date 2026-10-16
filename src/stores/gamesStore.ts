import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GhostTrack } from "@/games/racing";
import { STORAGE_KEYS, safeStorage } from "@/lib/storage";

export interface GameBest {
  score: number;
  wpm: number;
  won: boolean;
  at: number;
}

interface GamesState {
  best: Record<string, GameBest>;
  plays: Record<string, number>;
  wins: Record<string, number>;
  /** Week keys (e.g. "2026-W42") whose Weekly Boss this player has beaten. */
  weeklyWins: string[];
  /** Fastest finished race, replayed as a ghost car. */
  ghost: (GhostTrack & { finishMs: number }) | null;
  record: (game: string, r: { score: number; wpm: number; won: boolean }) => { isBest: boolean; previous: number | null };
  saveGhost: (track: GhostTrack & { finishMs: number }) => boolean;
  beatWeekly: (week: string) => boolean;
  /** Chaos mode bests per modifier combo ("" = no modifiers). */
  chaosBests: Record<string, number>;
  recordChaos: (combo: string, score: number) => { isBest: boolean; previous: number | null; overallBest: boolean };
}

export const useGames = create<GamesState>()(
  persist(
    (set, get) => ({
      best: {},
      plays: {},
      wins: {},
      weeklyWins: [],
      chaosBests: {},
      ghost: null,
      record: (game, r) => {
        const prev = get().best[game];
        const isBest = !prev || r.score > prev.score;
        set((s) => ({
          plays: { ...s.plays, [game]: (s.plays[game] ?? 0) + 1 },
          wins: r.won ? { ...s.wins, [game]: (s.wins[game] ?? 0) + 1 } : s.wins,
          best: isBest ? { ...s.best, [game]: { ...r, at: Date.now() } } : s.best,
        }));
        return { isBest, previous: prev ? prev.score : null };
      },
      recordChaos: (combo, score) => {
        const bests = get().chaosBests;
        const prev = bests[combo];
        const top = Math.max(0, ...Object.values(bests));
        const isBest = prev === undefined || score > prev;
        if (isBest) set({ chaosBests: { ...bests, [combo]: score } });
        return { isBest, previous: prev ?? null, overallBest: score > top };
      },
      beatWeekly: (week) => {
        if (get().weeklyWins.includes(week)) return false;
        set((s) => ({ weeklyWins: [...s.weeklyWins, week] }));
        return true;
      },
      saveGhost: (track) => {
        const cur = get().ghost;
        if (cur && cur.finishMs <= track.finishMs) return false;
        set({ ghost: track });
        return true;
      },
    }),
    {
      name: STORAGE_KEYS.games,
      storage: safeStorage,
      version: 3,
      skipHydration: true,
      migrate: (old) => ({ wins: {}, weeklyWins: [], chaosBests: {}, ...(old as object) }) as unknown as GamesState,
      partialize: ({ best, plays, wins, weeklyWins, chaosBests, ghost }) => ({ best, plays, wins, weeklyWins, chaosBests, ghost }),
    },
  ),
);
