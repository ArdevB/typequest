import { KeyKind, replayDetailed, wordSource, type Keystroke, type RunResult } from "@/engine";
import { getLesson } from "@/lessons/catalog";
import { rateLesson, type Stars } from "@/lessons/rating";
import type { LessonPayload, RunPayload } from "@/lib/payloads";

export type Validation<T> = { ok: true; value: T } | { ok: false; reason: string };

/** Above this, a "run" is not a human typing. */
export const MAX_WPM = 350;
/** Median gap between keystrokes below this (ms) is not humanly sustainable (~480 WPM). */
const MIN_MEDIAN_INTERVAL = 25;
/** Share of near-simultaneous keystrokes (< 4ms) tolerated, e.g. key rollover or IME commits. */
const MAX_INSTANT_SHARE = 0.3;

/** Shape and timing checks on a raw keystroke log. */
export function checkLog(log: readonly Keystroke[], maxMs?: number): string | null {
  if (log.length === 0) return "empty run";
  if (log.some((k) => k[2] === KeyKind.Rejected)) return "pasted or dropped text";
  if ((log[0]?.[0] ?? 0) > 5) return "log must start at 0";
  for (let i = 1; i < log.length; i++) {
    if ((log[i]?.[0] ?? 0) < (log[i - 1]?.[0] ?? 0)) return "keystrokes out of order";
  }
  for (const [, key, kind] of log) {
    if (kind === KeyKind.Char && [...key].length !== 1) return "invalid keystroke";
  }
  const last = log[log.length - 1]?.[0] ?? 0;
  if (maxMs !== undefined && last > maxMs + 100) return "run longer than its time limit";

  const typing = log.filter((k) => k[2] === KeyKind.Char || k[2] === KeyKind.Space);
  if (typing.length >= 20) {
    const gaps: number[] = [];
    for (let i = 1; i < typing.length; i++) gaps.push((typing[i]?.[0] ?? 0) - (typing[i - 1]?.[0] ?? 0));
    gaps.sort((a, b) => a - b);
    const median = gaps[Math.floor(gaps.length / 2)] ?? 0;
    if (median < MIN_MEDIAN_INTERVAL) return "impossibly fast keystrokes";
    const instant = gaps.filter((g) => g < 4).length / gaps.length;
    if (instant > MAX_INSTANT_SHARE) return "too many simultaneous keystrokes";
  }
  return null;
}

export interface ReplaySpec {
  mode: { kind: "time"; seconds: 15 | 30 | 60 | 120 } | { kind: "words"; count: 10 | 25 | 50 | 100 };
  seed: number;
  punctuation: boolean;
  numbers: boolean;
  stopOnError: "off" | "letter" | "word";
  log: readonly Keystroke[];
  keyWeights?: Readonly<Record<string, number>>;
}

/**
 * Regenerates a run's words from its seed and replays the keystroke log
 * through the engine. Rejects tampered or inhuman logs. The caller decides
 * what counts as a pass.
 */
export function replayChecked(p: ReplaySpec): Validation<{ result: RunResult; finishedNaturally: boolean }> {
  const maxMs = p.mode.kind === "time" ? p.mode.seconds * 1000 : undefined;
  const logProblem = checkLog(p.log, maxMs);
  if (logProblem) return { ok: false, reason: logProblem };

  const { result, finishedNaturally } = replayDetailed({
    mode: p.mode,
    log: p.log,
    stopOnError: p.stopOnError,
    source: wordSource({ seed: p.seed, punctuation: p.punctuation, numbers: p.numbers, keyWeights: p.keyWeights }),
  });
  if (!result) return { ok: false, reason: "run did not start" };
  if (result.wpm > MAX_WPM || result.rawWpm > MAX_WPM * 1.2) return { ok: false, reason: "speed is not humanly possible" };
  return { ok: true, value: { result, finishedNaturally } };
}

/**
 * Validates a speed test: regenerates its words from the seed, replays the
 * keystroke log through the engine and returns the engine's own result.
 */
export function validateRun(p: RunPayload): Validation<RunResult> {
  const r = replayChecked(p);
  if (!r.ok) return r;
  const { result, finishedNaturally } = r.value;
  if (!finishedNaturally) return { ok: false, reason: "run was not finished" };
  if (result.accuracy < 50) return { ok: false, reason: "accuracy below 50%" };
  if (result.wpm <= 0) return { ok: false, reason: "no correct words" };
  return { ok: true, value: result };
}

export interface LessonCheck {
  result: RunResult;
  stars: Stars;
}

/** Validates a lesson attempt: rebuilds the lesson text from its seed and replays the log. */
export function validateLesson(p: LessonPayload): Validation<LessonCheck> {
  const lesson = getLesson(p.lessonId);
  if (!lesson) return { ok: false, reason: "unknown lesson" };
  const logProblem = checkLog(p.log);
  if (logProblem) return { ok: false, reason: logProblem };

  const { result, finishedNaturally } = replayDetailed({
    mode: { kind: "text", text: lesson.build(p.seed) },
    log: p.log,
    stopOnError: "letter",
  });
  if (!result || !finishedNaturally) return { ok: false, reason: "lesson was not finished" };
  if (result.wpm > MAX_WPM) return { ok: false, reason: "speed is not humanly possible" };
  return { ok: true, value: { result, stars: rateLesson(lesson, result) } };
}
