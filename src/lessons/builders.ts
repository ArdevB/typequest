import { createRng, drillText, wordSource } from "@/engine";
import { ENGLISH_COMMON } from "@/engine/words/english-common";
import { LESSON_WORDS } from "@/engine/words/english-lessons";

/** A lesson text builder. Gets a fresh seed per attempt. */
export type TextBuilder = (seed: number) => string;

const pickN = <T>(rng: () => number, items: readonly T[], n: number): T[] => {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < n && pool.length > 0) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0] as T);
  }
  return out;
};

const shuffle = <T>(rng: () => number, items: readonly T[]): T[] => pickN(rng, items, items.length);

/**
 * Real words that only use `keys`. Prefers the ~500 most common words and only
 * falls back to the larger list when the key set is too small for them.
 */
function wordsFrom(keys: string): string[] {
  const set = new Set(keys);
  const fits = (w: string) => [...w].every((c) => set.has(c));
  const common = ENGLISH_COMMON.filter(fits);
  if (common.length >= 60) return common;
  return [...new Set([...common, ...LESSON_WORDS.filter(fits)])];
}

/** Weighted random words using only `keys`, favoring words with `emphasis` keys. */
function words(keys: string, emphasis: string, n: number, seed: number): string[] {
  const pool = wordsFrom(keys);
  if (pool.length === 0) return [];
  const keyWeights = Object.fromEntries([...emphasis].map((k) => [k, 5]));
  return wordSource({ pool, keyWeights, seed }).take(n);
}

/** Pure letter-group drill for brand-new keys. */
export const drill =
  (focus: string, review = "", groups = 18): TextBuilder =>
  (seed) =>
    drillText({ focus, review, groups, seed }).join(" ");

/** Drill groups followed by real words (when enough exist for these keys). */
export const drillThenWords =
  (focus: string, keys: string, groups = 12, wordCount = 12): TextBuilder =>
  (seed) => {
    const review = keys.replace(new RegExp(`[${escapeClass(focus)}]`, "g"), "");
    const d = drillText({ focus, review, groups, seed });
    const real = wordsFrom(keys);
    const w = real.length >= 6 ? words(keys, focus, wordCount, seed) : drillText({ focus: keys, groups: wordCount, seed: seed + 1 });
    return [...d, ...w].join(" ");
  };

/** Real words only. */
export const wordsOnly =
  (keys: string, emphasis: string, n = 25): TextBuilder =>
  (seed) =>
    words(keys, emphasis, n, seed).join(" ");

const ALL_LETTERS = "abcdefghijklmnopqrstuvwxyz";

/** Digit drills mixed with words. */
export const numbers =
  (digits: string, reviewDigits: string): TextBuilder =>
  (seed) => {
    const rng = createRng(seed);
    const d = drillText({ focus: digits, review: reviewDigits, groups: 14, minLen: 2, maxLen: 4, seed });
    const w = words(ALL_LETTERS, "", 8, seed);
    return shuffle(rng, [...d, ...w]).join(" ");
  };

/** Words where every third token is a number. */
export const numbersInContext: TextBuilder = (seed) => {
  const rng = createRng(seed);
  return words(ALL_LETTERS, "", 18, seed)
    .flatMap((w, i) => (i % 3 === 2 ? [w, String(1 + Math.floor(rng() * 2025))] : [w]))
    .join(" ");
};

/** Capital letters: practise Shift with the opposite hand. */
export const capitals: TextBuilder = (seed) => {
  const rng = createRng(seed);
  return words(ALL_LETTERS, "", 24, seed)
    .map((w) => (rng() < 0.45 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
};

/** Short phrases ending in , . ? ! with capitals after sentence ends. */
export const punctuation: TextBuilder = (seed) => {
  const rng = createRng(seed);
  const src = words(ALL_LETTERS, "", 30, seed);
  const out: string[] = [];
  let cap = true;
  let sinceMark = 0;
  for (const w of src) {
    let word = cap ? w.charAt(0).toUpperCase() + w.slice(1) : w;
    cap = false;
    sinceMark += 1;
    if (sinceMark >= 2 && rng() < 0.45) {
      const r = rng();
      const mark = r < 0.4 ? "," : r < 0.75 ? "." : r < 0.88 ? "?" : "!";
      word += mark;
      cap = mark !== ",";
      sinceMark = 0;
    }
    out.push(word);
  }
  return out.join(" ");
};

const CONTRACTIONS = ["don't", "it's", "I'm", "can't", "won't", "we're", "they're", "you'll", "she's", "let's", "isn't", "that's", "I've", "didn't"];
const HYPHENATED = ["well-known", "up-to-date", "self-made", "long-term", "part-time", "old-school", "high-five", "x-ray", "five-star", "follow-up"];

/** Apostrophes, quotes and hyphens. */
export const quotes: TextBuilder = (seed) => {
  const rng = createRng(seed);
  const base = words(ALL_LETTERS, "", 8, seed).map((w) => `"${w}"`);
  return shuffle(rng, [...pickN(rng, CONTRACTIONS, 8), ...pickN(rng, HYPHENATED, 6), ...base]).join(" ");
};

/** Brackets, colon and semicolon. */
export const brackets: TextBuilder = (seed) => {
  const rng = createRng(seed);
  const w = words(ALL_LETTERS, "", 22, seed);
  return w
    .map((word, i) => {
      const r = (i * 7 + Math.floor(rng() * 5)) % 5;
      if (r === 0) return `(${word})`;
      if (r === 1) return `${word}:`;
      if (r === 2) return `${word};`;
      return word;
    })
    .join(" ");
};

/** @ # $ % & * in realistic tokens. */
export const symbols: TextBuilder = (seed) => {
  const rng = createRng(seed);
  const w = words(ALL_LETTERS, "", 12, seed);
  const n = () => 1 + Math.floor(rng() * 99);
  const tokens = [
    `@${w[0] ?? "name"}`,
    `#${w[1] ?? "tag"}`,
    `$${n()}`,
    `${n()}%`,
    "&",
    `${n()}*${n()}`,
    `@${w[2] ?? "team"}`,
    `#${n()}`,
    `$${n()}.${10 + Math.floor(rng() * 89)}`,
    `${n()}%`,
    "R&D",
    `${w[3] ?? "a"}*`,
  ];
  return shuffle(rng, [...tokens, ...w.slice(4)]).join(" ");
};

/** A few sentences from a list. */
export const sentences =
  (list: readonly string[], count: number): TextBuilder =>
  (seed) =>
    pickN(createRng(seed), list, count).join(" ");

function escapeClass(s: string): string {
  return s.replace(/[\\\]^-]/g, "\\$&");
}
