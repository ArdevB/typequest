import type { TestMode } from "@/engine";

export type Grade = "S" | "A" | "B" | "C";

/** Grades need both speed and accuracy; accuracy gates every tier. */
export function gradeFor(wpm: number, accuracy: number): Grade {
  if (accuracy >= 97 && wpm >= 80) return "S";
  if (accuracy >= 94 && wpm >= 60) return "A";
  if (accuracy >= 90 && wpm >= 40) return "B";
  return "C";
}

export function modeKey(mode: TestMode): string {
  switch (mode.kind) {
    case "time":
      return `time-${mode.seconds}`;
    case "words":
      return `words-${mode.count}`;
    case "text":
      return "text";
  }
}

export function modeLabel(mode: TestMode): string {
  switch (mode.kind) {
    case "time":
      return `${mode.seconds}s`;
    case "words":
      return `${mode.count} words`;
    case "text":
      return "custom text";
  }
}
