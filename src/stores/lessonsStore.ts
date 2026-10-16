import { create } from "zustand";
import { persist } from "zustand/middleware";
// Keep this store free of the lesson catalog (only types): it is loaded on every page.
import type { Stars } from "@/lessons/rating";
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
  record: (lessonId: string, r: { wpm: number; accuracy: number; stars: Stars }) => LessonRecordOutcome;
}

const empty = (): LessonProgress => ({ stars: 0, bestWpm: 0, bestAccuracy: 0, attempts: 0, completedAt: null });

export const useLessons = create<LessonsState>()(
  persist(
    (set, get) => ({
      progress: {},
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
      partialize: ({ progress }) => ({ progress }),
    },
  ),
);
