import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Keystroke, PerKeyStat, RunResult } from "@/engine";
import { gradeFor, modeKey, type Grade } from "@/lib/grade";
import type { RunPayload } from "@/lib/payloads";
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
  /** Valid runs made as a guest, uploaded (and re-verified) when the player signs in. */
  unsynced: RunPayload[];
  /** Per-key totals across valid runs in this browser (Weak Key Hunt for guests). */
  keyStats: Record<string, PerKeyStat>;
  addRun: (result: RunResult) => RunOutcome;
  queueForSync: (payload: RunPayload) => void;
  clearSynced: (clientIds: readonly string[]) => void;
}

/** Guest runs kept for upload. Personal bests are kept first, then the most recent. */
const MAX_UNSYNCED = 20;

const MAX_RUNS = 200;

function mergeKeyStats(a: Record<string, PerKeyStat>, b: Record<string, PerKeyStat>): Record<string, PerKeyStat> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const p = out[k];
    if (!p) {
      out[k] = { ...v };
      continue;
    }
    const attempts = p.attempts + v.attempts;
    out[k] = {
      attempts,
      errors: p.errors + v.errors,
      avgMs: attempts ? Math.round((p.avgMs * p.attempts + v.avgMs * v.attempts) / attempts) : 0,
    };
  }
  return out;
}

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
      unsynced: [],
      keyStats: {},
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
            keyStats: mergeKeyStats(s.keyStats, result.perKey),
            bests: isPB
              ? { ...s.bests, [key]: { ...summary, words: [...result.words], log: [...result.log] } }
              : s.bests,
          }));
        }
        return { summary, valid, isPB, previousBest };
      },
      queueForSync: (payload) =>
        set((s) => {
          const bestIds = new Set(Object.values(s.bests).map((b) => b.id));
          const all = [payload, ...s.unsynced.filter((p) => p.clientId !== payload.clientId)];
          const keep = [...all.filter((p) => bestIds.has(p.clientId ?? "")), ...all.filter((p) => !bestIds.has(p.clientId ?? ""))];
          return { unsynced: keep.slice(0, MAX_UNSYNCED) };
        }),
      clearSynced: (ids) => set((s) => ({ unsynced: s.unsynced.filter((p) => !ids.includes(p.clientId ?? "")) })),
    }),
    {
      name: STORAGE_KEYS.history,
      storage: safeStorage,
      version: 1,
      skipHydration: true,
      partialize: ({ runs, bests, unsynced, keyStats }) => ({ runs, bests, unsynced, keyStats }),
    },
  ),
);
