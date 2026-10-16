import type { LessonProgress } from "@/stores/lessonsStore";
import { LESSONS } from "./catalog";

/** The first lesson is always open; every other lesson opens once the one before it has a star. */
export function isUnlocked(lessonId: string, progress: Record<string, LessonProgress>): boolean {
  const i = LESSONS.findIndex((l) => l.id === lessonId);
  if (i <= 0) return i === 0;
  const prev = LESSONS[i - 1];
  return prev !== undefined && (progress[prev.id]?.stars ?? 0) >= 1;
}

/** The lesson to continue from: the first unlocked lesson without a star. */
export function currentLessonId(progress: Record<string, LessonProgress>): string | null {
  const l = LESSONS.find((x) => (progress[x.id]?.stars ?? 0) === 0 && isUnlocked(x.id, progress));
  return l?.id ?? null;
}
