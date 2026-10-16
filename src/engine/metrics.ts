import { KeyKind, type KeyHit, type Keystroke, type PerKeyStat, type RunResult, type SecondSample, type TestMode } from "./types";

export interface ResultInput {
  mode: TestMode;
  words: readonly string[];
  typed: readonly string[];
  /** Words fully submitted. A word at index `committed` may be partly typed. */
  committed: number;
  hits: readonly KeyHit[];
  log: readonly Keystroke[];
  durationMs: number;
  maxCombo: number;
}

/** Pauses longer than this are left out of per-key speed. */
const PAUSE_MS = 2000;
/** Keystrokes closer than this are physically implausible for a human (flagged, not rejected here). */
const SUSPICIOUS_MS = 3;

const round2 = (n: number): number => Math.round(n * 100) / 100;

export const wpmFrom = (chars: number, ms: number): number =>
  ms <= 0 ? 0 : chars / 5 / (ms / 60000);

/**
 * Monkeytype-style consistency: maps the coefficient of variation of per-second
 * raw WPM onto 0–100 so that steady typing scores high.
 */
export function consistencyFrom(values: readonly number[]): number {
  if (values.length < 2) return values.length === 1 ? 100 : 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean <= 0) return 0;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  const cov = Math.sqrt(variance) / mean;
  return Math.max(0, Math.min(100, 100 * (1 - Math.tanh(cov + cov ** 3 / 3 + cov ** 5 / 5))));
}

export function computeResults(input: ResultInput): RunResult {
  const { words, typed, committed, hits, log, durationMs } = input;
  const chars = { correct: 0, incorrect: 0, extra: 0, missed: 0 };
  let netChars = 0;
  let grossChars = 0;

  const lastWord = words.length - 1;
  const touched = Math.min(committed, words.length);

  for (let w = 0; w < touched; w++) {
    const t = words[w] ?? "";
    const s = typed[w] ?? "";
    tallyWord(t, s, true, chars);
    const space = w < lastWord ? 1 : 0;
    grossChars += s.length + space;
    if (s === t) netChars += t.length + space;
  }

  // Partly typed word (time mode, or a quit run).
  if (touched < words.length) {
    const t = words[touched] ?? "";
    const s = typed[touched] ?? "";
    if (s.length > 0) {
      tallyWord(t, s, false, chars);
      grossChars += s.length;
      if (t.startsWith(s)) netChars += s.length;
    }
  }

  const correctHits = hits.reduce((n, h) => n + (h.correct ? 1 : 0), 0);
  const perSecond = buildPerSecond(hits, durationMs);
  const fullSeconds = perSecond.filter((_, i) => {
    const isLast = i === perSecond.length - 1;
    return !isLast || durationMs - i * 1000 >= 500;
  });

  return {
    mode: input.mode,
    wpm: round2(wpmFrom(netChars, durationMs)),
    grossWpm: round2(wpmFrom(grossChars, durationMs)),
    rawWpm: round2(wpmFrom(hits.length, durationMs)),
    accuracy: hits.length === 0 ? 0 : round2((correctHits / hits.length) * 100),
    consistency: round2(consistencyFrom(fullSeconds.map((s) => s.raw))),
    chars,
    perSecond,
    perKey: buildPerKey(hits),
    durationMs,
    maxCombo: input.maxCombo,
    words: [...words],
    log: [...log],
    flags: {
      pasteAttempts: log.filter((k) => k[2] === KeyKind.Rejected).length,
      suspiciousIntervals: countSuspicious(hits),
    },
  };
}

function tallyWord(
  target: string,
  typedWord: string,
  submitted: boolean,
  out: RunResult["chars"],
): void {
  const len = Math.max(target.length, typedWord.length);
  for (let i = 0; i < len; i++) {
    if (i < typedWord.length) {
      if (i >= target.length) out.extra += 1;
      else if (typedWord[i] === target[i]) out.correct += 1;
      else out.incorrect += 1;
    } else if (submitted) {
      out.missed += 1;
    }
  }
}

function buildPerSecond(hits: readonly KeyHit[], durationMs: number): SecondSample[] {
  const seconds = Math.max(1, Math.ceil(durationMs / 1000));
  const count = new Array<number>(seconds).fill(0);
  const correct = new Array<number>(seconds).fill(0);
  const errors = new Array<number>(seconds).fill(0);
  for (const h of hits) {
    const b = Math.min(seconds - 1, Math.max(0, Math.floor(h.t / 1000)));
    count[b] = (count[b] ?? 0) + 1;
    if (h.correct) correct[b] = (correct[b] ?? 0) + 1;
    else errors[b] = (errors[b] ?? 0) + 1;
  }
  const out: SecondSample[] = [];
  let cumCorrect = 0;
  for (let i = 0; i < seconds; i++) {
    const end = Math.min(durationMs, (i + 1) * 1000);
    const span = Math.max(1, end - i * 1000);
    cumCorrect += correct[i] ?? 0;
    out.push({
      t: i + 1,
      wpm: round2(wpmFrom(cumCorrect, end)),
      raw: round2(wpmFrom(count[i] ?? 0, span)),
      errors: errors[i] ?? 0,
    });
  }
  return out;
}

function buildPerKey(hits: readonly KeyHit[]): Record<string, PerKeyStat> {
  const acc: Record<string, { attempts: number; errors: number; msSum: number; msN: number }> = {};
  let prevT: number | null = null;
  for (const h of hits) {
    const interval = prevT === null ? null : h.t - prevT;
    prevT = h.t;
    if (h.expected === null) continue; // typed past the end of a word; no key was expected
    const key = h.expected;
    const k = (acc[key] ??= { attempts: 0, errors: 0, msSum: 0, msN: 0 });
    k.attempts += 1;
    if (!h.correct) k.errors += 1;
    if (h.correct && interval !== null && interval < PAUSE_MS) {
      k.msSum += interval;
      k.msN += 1;
    }
  }
  const out: Record<string, PerKeyStat> = {};
  for (const [key, v] of Object.entries(acc)) {
    out[key] = { attempts: v.attempts, errors: v.errors, avgMs: v.msN ? Math.round(v.msSum / v.msN) : 0 };
  }
  return out;
}

function countSuspicious(hits: readonly KeyHit[]): number {
  let n = 0;
  for (let i = 1; i < hits.length; i++) {
    const a = hits[i - 1];
    const b = hits[i];
    if (a && b && b.t - a.t < SUSPICIOUS_MS) n += 1;
  }
  return n;
}
