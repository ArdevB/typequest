import type { RunResult } from "@/engine";
import { getUnit, type Lesson } from "./catalog";

export type Stars = 0 | 1 | 2 | 3;

/** Accuracy needed for each star. Speed goals come from the unit. */
export const ACCURACY_GOALS = { pass: 85, two: 92, three: 97 } as const;

export interface StarGoal {
  stars: 1 | 2 | 3;
  accuracy: number;
  wpm: number;
}

export function starGoals(lesson: Lesson): StarGoal[] {
  const { goals } = getUnit(lesson.unit);
  return [
    { stars: 1, accuracy: ACCURACY_GOALS.pass, wpm: 0 },
    { stars: 2, accuracy: ACCURACY_GOALS.two, wpm: goals.wpm2 },
    { stars: 3, accuracy: ACCURACY_GOALS.three, wpm: goals.wpm3 },
  ];
}

/** 0 stars = not passed. Each star needs both its accuracy and its speed. */
export function rateLesson(lesson: Lesson, result: Pick<RunResult, "wpm" | "accuracy" | "flags">): Stars {
  if (result.flags.pasteAttempts > 0) return 0;
  let stars: Stars = 0;
  for (const g of starGoals(lesson)) {
    if (result.accuracy >= g.accuracy && result.wpm >= g.wpm) stars = g.stars;
  }
  return stars;
}
