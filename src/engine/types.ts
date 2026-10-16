/**
 * Shared engine types. Nothing in src/engine imports React.
 */

export type TimeSeconds = 15 | 30 | 60 | 120;
export type WordCount = 10 | 25 | 50 | 100;

export type TestMode =
  | { kind: "time"; seconds: TimeSeconds }
  | { kind: "words"; count: WordCount }
  | { kind: "text"; text: string };

export type CharState = "pending" | "correct" | "incorrect" | "extra" | "missed";

export const KeyKind = {
  Char: 0,
  Backspace: 1,
  Space: 2,
  /** Input the engine refused (paste, drop, autocorrect replacement). Kept for anti-cheat. */
  Rejected: 3,
} as const;
export type KeyKind = (typeof KeyKind)[keyof typeof KeyKind];

/**
 * Compact raw log entry: [ms since first keystroke, key, kind].
 * For Backspace the key is "" (char) or "w" (whole word, Ctrl+Backspace).
 * Stored as-is in runs.keystroke_log; replaying it through the engine reproduces the run.
 */
export type Keystroke = [t: number, key: string, kind: KeyKind];

/** One scored keystroke (a char or a space), derived by the engine while typing. */
export interface KeyHit {
  t: number;
  /** What the text expected at that position. null = typed past the end of a word. " " = space. */
  expected: string | null;
  typed: string;
  correct: boolean;
}

export type StopOnError = "off" | "letter" | "word";

export interface WordSource {
  take(n: number): string[];
}

export interface EngineOptions {
  mode: TestMode;
  /** Supplies words lazily. Ignored for { kind: "text" }. */
  source: WordSource;
  /** "off" (default): mistakes stay, space jumps on. "letter": wrong keys are rejected. "word": can't leave a wrong word. */
  stopOnError?: StopOnError;
  /** Backspace from the start of a word goes back into the previous word if it has mistakes. Default true. */
  allowBackspaceToPrevWord?: boolean;
  /** Clock. Defaults to performance.now. Inject for tests and replays. */
  now?: () => number;
  /** Run an internal 100ms timer for time mode and tick events. Default true. Tests/replays set false and call tick(). */
  autoTick?: boolean;
}

export type EngineStatus = "idle" | "running" | "finished";

export interface EngineSnapshot {
  status: EngineStatus;
  words: readonly string[];
  wordIndex: number;
  charIndex: number;
  elapsedMs: number;
  remainingMs: number | null;
  liveWpm: number;
  liveAccuracy: number;
  combo: number;
  maxCombo: number;
}

export type ComboTier = 0 | 1 | 2 | 3;

export interface EngineEvents {
  start: { at: number };
  correct: { char: string; wordIndex: number; charIndex: number; combo: number };
  error: { expected: string | null; typed: string; wordIndex: number; charIndex: number };
  backspace: { wordIndex: number; charIndex: number; wordChanged: boolean };
  wordComplete: { word: string; typed: string; correct: boolean; wordIndex: number };
  /** Fires when the streak reaches a milestone (10, 25, 50, then every 25). */
  combo: { count: number; tier: ComboTier };
  comboBreak: { lost: number };
  /** More words were appended (time mode streams words). */
  wordsAppended: { from: number; words: readonly string[] };
  tick: { elapsedMs: number; remainingMs: number | null };
  finish: RunResult;
  reset: { words: readonly string[] };
}

export interface PerKeyStat {
  attempts: number;
  errors: number;
  avgMs: number;
}

export interface SecondSample {
  /** 1-based second. */
  t: number;
  /** Cumulative net WPM up to the end of this second. */
  wpm: number;
  /** Raw WPM within this second alone. */
  raw: number;
  errors: number;
}

export interface RunResult {
  mode: TestMode;
  /** Net WPM: chars of correctly typed words (plus their spaces) / 5 / minutes. */
  wpm: number;
  /** Every char left in the final text (right or wrong, plus spaces) / 5 / minutes. */
  grossWpm: number;
  /** Every char keystroke, including ones later corrected / 5 / minutes. */
  rawWpm: number;
  accuracy: number;
  consistency: number;
  chars: { correct: number; incorrect: number; extra: number; missed: number };
  perSecond: SecondSample[];
  perKey: Record<string, PerKeyStat>;
  durationMs: number;
  maxCombo: number;
  words: readonly string[];
  log: readonly Keystroke[];
  flags: { pasteAttempts: number; suspiciousIntervals: number };
}
