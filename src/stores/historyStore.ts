import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Keystroke, RunResult } from "@/engine";
import { gradeFor, modeKey, type Grade } from "@/lib/grade";
import { STORAGE_KEYS, safeStorage } from "@/lib/storage";

export interface RunSummary {
  id: string;
  at: number;
  modeKey: string;
  wpm: number;
  accuracy: number;
  raw: number;
  consistency: number;
  durationMs: number;
  grade: Grade;
}

/** Personal bests keep the words and keystroke log for ghost races (Phase 6) and sign-up sync (Phase 3). */
export interface BestRun extends RunSummary {
  words: string[];
  log: Keystroke[];
}

export interface RunOutcome {
  summary: RunSummary;
  valid: boolean;
  isPB: boolean;
  /** Best WPM for this mode before this run, if any. */
  previousBest: number | null;
}

interface HistoryState {
  runs: RunSummary[];
  bests: Record<string, BestRun>;
  addRun: (result: RunResult) => RunOutcome;
}

const MAX_RUNS = 200;

/** Runs with pasted input, or that didn't really happen, never count. */
export function isValidRun(r: RunResult): boolean {
  if (r.flags.pasteAttempts > 0) return false;
  if (r.wpm <= 0 || r.accuracy < 50) return false;
  if (r.mode.kind === "time" && r.durationMs < r.mode.seconds * 1000) return false;
  return true;
}

const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const useHistory = create<HistoryState>()(
  persist(
    (set, get) => ({
      runs: [],
      bests: {},
      addRun: (result) => {
        const key = modeKey(result.mode);
        const summary: RunSummary = {
          id: newId(),
          at: Date.now(),
          modeKey: key,
          wpm: result.wpm,
          accuracy: result.accuracy,
          raw: result.rawWpm,
          consistency: result.consistency,
          durationMs: result.durationMs,
          grade: gradeFor(result.wpm, result.accuracy),
        };
        const valid = isValidRun(result);
        const prev = get().bests[key];
        const previousBest = prev ? prev.wpm : null;
        const isPB = valid && (previousBest === null || result.wpm > previousBest);

        if (valid) {
          set((s) => ({
            runs: [summary, ...s.runs].slice(0, MAX_RUNS),
            bests: isPB
              ? { ...s.bests, [key]: { ...summary, words: [...result.words], log: [...result.log] } }
              : s.bests,
          }));
        }
        return { summary, valid, isPB, previousBest };
      },
    }),
    {
      name: STORAGE_KEYS.history,
      storage: safeStorage,
      version: 1,
      skipHydration: true,
      partialize: ({ runs, bests }) => ({ runs, bests }),
    },
  ),
);
