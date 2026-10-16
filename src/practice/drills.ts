import { drillText, getLayout, translateKeys, wordSource, type LayoutId } from "@/engine";
import { ENGLISH_COMMON } from "@/engine/words/english-common";
import { LESSON_WORDS } from "@/engine/words/english-lessons";

/** A practice drill: a mix of the weakest keys, or one key. Keys are lowercase letters. */
export type Drill = { kind: "mix"; keys: string[] } | { kind: "key"; key: string };

/** Home-row keys (QWERTY positions) mixed into drills so the hand stays anchored. */
const REVIEW = "asdfjkl";

/**
 * Real words containing `key`: common words first, topped up from the larger
 * list for rare letters (q, x, z, j…) that common words hardly use.
 */
function wordsWith(key: string): string[] {
  const common = ENGLISH_COMMON.filter((w) => w.includes(key));
  if (common.length >= 25) return common;
  const more = LESSON_WORDS.filter((w) => w.includes(key) && w.length <= 7);
  return [...new Set([...common, ...more])];
}

/** The drill text. Deterministic for (drill, seed, layout), so the server can rebuild it to check a run. */
export function buildDrill(drill: Drill, seed: number, layoutId: LayoutId = "qwerty"): string {
  const review = translateKeys(REVIEW, getLayout(layoutId));
  if (drill.kind === "mix") {
    // A warm-up group per weak key, then real words that contain them (and ordinary words around them).
    const keys = drill.keys.slice(0, 4);
    const warmup = keys.flatMap((k, i) => drillText({ focus: k, review: review.replace(k, ""), groups: 2, maxLen: 4, seed: seed + i }));
    const pool = [...new Set([...keys.flatMap(wordsWith), ...ENGLISH_COMMON])];
    const words = wordSource({ seed, pool, keyWeights: Object.fromEntries(keys.map((k) => [k, 10])) }).take(26);
    return [...warmup, ...words].join(" ");
  }
  const groups = drillText({ focus: drill.key, review: review.replace(drill.key, ""), groups: 6, maxLen: 4, seed });
  const words = wordSource({ seed, pool: wordsWith(drill.key) }).take(16);
  return [...groups, ...words].join(" ");
}
