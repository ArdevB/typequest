import { create } from "zustand";
import { persist } from "zustand/middleware";
// Keep this store free of the lesson catalog (only types): it is loaded on every page.
import type { Stars } from "@/lessons/rating";
import type { LessonPayload } from "@/lib/payloads";
import { STORAGE_KEYS, safeStorage } from "@/lib/storage";

export interface LessonProgress {
  stars: Stars;
  bestWpm: number;
  bestAccuracy: number;
  attempts: number;
  /** First time the lesson was passed (epoch ms). */
  completedAt: number | null;
}

export interface LessonRecordOutcome {
  previousStars: Stars;
  stars: Stars;
  /** The next lesson became available because of this attempt. */
  unlockedNext: boolean;
}

interface LessonsState {
  progress: Record<string, LessonProgress>;
  /** Best passed guest attempt per lesson (seed + keystrokes), uploaded and re-verified on sign-in. */
  unsynced: Record<string, LessonPayload & { stars: Stars }>;
  record: (lessonId: string, r: { wpm: number; accuracy: number; stars: Stars }) => LessonRecordOutcome;
  queueForSync: (payload: LessonPayload, stars: Stars) => void;
  clearSynced: (lessonIds: readonly string[]) => void;
  /** Merge progress loaded from the server (keeps the better of each). */
  mergeRemote: (rows: readonly { lesson_id: string; stars: number; best_wpm: number; best_accuracy: number; attempts: number }[]) => void;
}

const empty = (): LessonProgress => ({ stars: 0, bestWpm: 0, bestAccuracy: 0, attempts: 0, completedAt: null });

export const useLessons = create<LessonsState>()(
  persist(
    (set, get) => ({
      progress: {},
      unsynced: {},
      queueForSync: (payload, stars) =>
        set((s) => {
          const prev = s.unsynced[payload.lessonId];
          if (stars === 0 || (prev && prev.stars >= stars)) return s;
          return { unsynced: { ...s.unsynced, [payload.lessonId]: { ...payload, stars } } };
        }),
      clearSynced: (ids) =>
        set((s) => ({ unsynced: Object.fromEntries(Object.entries(s.unsynced).filter(([id]) => !ids.includes(id))) })),
      mergeRemote: (rows) =>
        set((s) => {
          const progress = { ...s.progress };
          for (const r of rows) {
            const local = progress[r.lesson_id] ?? empty();
            progress[r.lesson_id] = {
              stars: Math.max(local.stars, r.stars) as Stars,
              bestWpm: Math.max(local.bestWpm, Number(r.best_wpm)),
              bestAccuracy: Math.max(local.bestAccuracy, Number(r.best_accuracy)),
              attempts: Math.max(local.attempts, r.attempts),
              completedAt: local.completedAt ?? (r.stars > 0 ? Date.now() : null),
            };
          }
          return { progress };
        }),
      record: (lessonId, r) => {
        const prev = get().progress[lessonId] ?? empty();
        const stars = Math.max(prev.stars, r.stars) as Stars;
        const next: LessonProgress = {
          stars,
          bestWpm: Math.max(prev.bestWpm, r.stars > 0 ? r.wpm : 0),
          bestAccuracy: Math.max(prev.bestAccuracy, r.stars > 0 ? r.accuracy : 0),
          attempts: prev.attempts + 1,
          completedAt: prev.completedAt ?? (r.stars > 0 ? Date.now() : null),
        };
        set((s) => ({ progress: { ...s.progress, [lessonId]: next } }));
        return { previousStars: prev.stars, stars: r.stars, unlockedNext: prev.stars === 0 && r.stars > 0 };
      },
    }),
    {
      name: STORAGE_KEYS.lessons,
      storage: safeStorage,
      version: 1,
      skipHydration: true,
      partialize: ({ progress, unsynced }) => ({ progress, unsynced }),
    },
  ),
);
