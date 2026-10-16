import { createRng, pick, randInt } from "./rng";
import type { PerKeyStat, WordSource } from "./types";
import { ENGLISH_COMMON } from "./words/english-common";

export interface WordSourceOptions {
  /** Word pool. Defaults to the common-English list. */
  pool?: readonly string[];
  /** Only use words made entirely of these keys, e.g. "asdfjkl;" for home row. */
  allowedKeys?: string;
  /** Per-key weights (1 = normal). Words containing heavier keys appear more often. */
  keyWeights?: Readonly<Record<string, number>>;
  punctuation?: boolean;
  numbers?: boolean;
  seed?: number | string;
}

/** Below this many real words, drills are padded with generated pseudo-words. */
const MIN_REAL_WORDS = 15;

export function wordSource(options: WordSourceOptions = {}): WordSource {
  const rng = createRng(options.seed ?? Math.floor(Math.random() * 2 ** 32));
  const allowed = options.allowedKeys ? new Set(options.allowedKeys.toLowerCase()) : null;

  let pool = [...(options.pool ?? ENGLISH_COMMON)];
  if (allowed) {
    pool = pool.filter((w) => [...w].every((c) => allowed.has(c)));
    if (pool.length < MIN_REAL_WORDS) {
      const letters = [...allowed].filter((c) => /[a-z]/.test(c));
      if (letters.length > 0) {
        for (let i = 0; pool.length < 60 && i < 200; i++) {
          pool.push(pseudoWord(rng, letters, randInt(rng, 2, 5)));
        }
      }
    }
  }
  if (pool.length === 0) pool = ["the"];

  const weights = pool.map((w) => wordWeight(w, options.keyWeights));
  const cumulative: number[] = [];
  let total = 0;
  for (const w of weights) {
    total += w;
    cumulative.push(total);
  }

  const pickWord = (): string => {
    const r = rng() * total;
    let lo = 0;
    let hi = cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((cumulative[mid] ?? 0) < r) lo = mid + 1;
      else hi = mid;
    }
    return pool[lo] ?? pool[0] ?? "the";
  };

  let prev = "";
  let capitalizeNext = true;

  return {
    take(n) {
      const out: string[] = [];
      for (let i = 0; i < n; i++) {
        let word = pickWord();
        for (let tries = 0; word === prev && pool.length > 1 && tries < 5; tries++) word = pickWord();
        prev = word;

        if (options.numbers && rng() < 0.08) {
          word = String(randInt(rng, 1, 9999));
        }
        if (options.punctuation) {
          if (capitalizeNext) word = word.charAt(0).toUpperCase() + word.slice(1);
          capitalizeNext = false;
          const r = rng();
          if (r < 0.1) word += ",";
          else if (r < 0.16) {
            word += ".";
            capitalizeNext = true;
          } else if (r < 0.18) {
            word += "?";
            capitalizeNext = true;
          } else if (r < 0.2) {
            word += "!";
            capitalizeNext = true;
          }
        }
        out.push(word);
      }
      return out;
    },
  };
}

/** Plays back a stored word list in order (repeat a test, replays, daily challenge). */
export function fixedSource(words: readonly string[]): WordSource {
  let i = 0;
  return {
    take(n) {
      const out = words.slice(i, i + n);
      i += out.length;
      return out;
    },
  };
}

function wordWeight(word: string, keyWeights?: Readonly<Record<string, number>>): number {
  if (!keyWeights) return 1;
  let w = 1;
  for (const c of word.toLowerCase()) w += Math.max(0, (keyWeights[c] ?? 1) - 1);
  return w;
}

function pseudoWord(rng: () => number, letters: readonly string[], len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += pick(rng, letters);
  return s;
}

/**
 * Turns per-key stats into weights for adaptive drills: more errors and slower
 * keys weigh more. Unseen keys stay at 1. Result is clamped to 1–8.
 */
export function weakKeyWeights(perKey: Readonly<Record<string, PerKeyStat>>): Record<string, number> {
  const merged: Record<string, { attempts: number; errors: number; ms: number; msN: number }> = {};
  for (const [rawKey, s] of Object.entries(perKey)) {
    const key = rawKey.toLowerCase();
    if (!/^[a-z]$/.test(key)) continue;
    const m = (merged[key] ??= { attempts: 0, errors: 0, ms: 0, msN: 0 });
    m.attempts += s.attempts;
    m.errors += s.errors;
    if (s.avgMs > 0) {
      m.ms += s.avgMs * s.attempts;
      m.msN += s.attempts;
    }
  }

  const speeds = Object.values(merged).filter((m) => m.msN > 0).map((m) => m.ms / m.msN);
  const meanMs = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;

  const out: Record<string, number> = {};
  for (const [key, m] of Object.entries(merged)) {
    // Smoothed toward a 5% error rate so one slip on a rare key doesn't dominate.
    const errRate = (m.errors + 0.25) / (m.attempts + 5);
    const avg = m.msN ? m.ms / m.msN : meanMs;
    const slowness = meanMs > 0 ? Math.max(0, avg / meanMs - 1) : 0;
    out[key] = Math.min(8, Math.max(1, 1 + 20 * errRate + 3 * slowness));
  }
  return out;
}
