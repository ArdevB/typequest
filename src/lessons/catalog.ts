import {
  brackets,
  capitals,
  drill,
  drillThenWords,
  numbers,
  numbersInContext,
  punctuation,
  quotes,
  sentences,
  symbols,
  wordsOnly,
  type TextBuilder,
} from "./builders";
import { getLayout, translateKeys, type LayoutId } from "@/engine";
import { LONG_SENTENCES, MIXED_SENTENCES, PANGRAMS, SHORT_SENTENCES } from "./sentences";

export type UnitId = "home" | "top" | "bottom" | "numbers" | "symbols" | "sentences";

export interface Unit {
  id: UnitId;
  title: string;
  description: string;
  /** WPM needed for 2 and 3 stars in this unit. */
  goals: { wpm2: number; wpm3: number };
}

export interface Lesson {
  id: string;
  unit: UnitId;
  /** 1-based position in the whole path. */
  number: number;
  title: string;
  /** One or two sentences shown before the lesson starts. */
  intro: string;
  /** Keys taught in this lesson (shown as big keycaps). */
  newKeys: string;
  build: TextBuilder;
}

export const UNITS: readonly Unit[] = [
  { id: "home", title: "Home row", description: "Where your fingers live. Feel for the two keys with bumps.", goals: { wpm2: 15, wpm3: 25 } },
  { id: "top", title: "Top row", description: "Reach up from home, then come straight back.", goals: { wpm2: 18, wpm3: 28 } },
  { id: "bottom", title: "Bottom row", description: "Curl down for the last letters and basic punctuation.", goals: { wpm2: 20, wpm3: 30 } },
  { id: "numbers", title: "Numbers", description: "The long reach to the number row.", goals: { wpm2: 14, wpm3: 22 } },
  { id: "symbols", title: "Shift & symbols", description: "Capitals, punctuation and symbols with the Shift key.", goals: { wpm2: 16, wpm3: 26 } },
  { id: "sentences", title: "Full sentences", description: "Everything together, in real writing.", goals: { wpm2: 25, wpm3: 40 } },
];

const HOME = "asdfghjkl;";
const TOP = "qwertyuiop";
const BOTTOM = "zxcvbnm,./";

/**
 * Lessons are written for QWERTY. For other layouts, the letter lessons teach
 * the keys at the same physical positions (same fingers): `t()` translates a
 * QWERTY key string, and intros use {0} {1} for the new keys, {home} for the
 * home row and {bumps} for the two keys with bumps.
 */
interface Def {
  id: string;
  unit: UnitId;
  /** Fixed title; letter lessons without one are titled from their keys ("F and J"). */
  title?: string;
  /** QWERTY keys taught here. */
  newKeys: string;
  intro: string;
  make: (t: (qwerty: string) => string) => TextBuilder;
}

const DEFS: Def[] = [
  // Home row
  { id: "home-fj", unit: "home", newKeys: "fj", intro: "Rest your index fingers on {0} and {1}. You can feel small bumps on them, so you never need to look.", make: (t) => drill(t("fj"), "", 16) },
  { id: "home-dk", unit: "home", newKeys: "dk", intro: "Your middle fingers sit next to them on {0} and {1}.", make: (t) => drill(t("dk"), t("fj")) },
  { id: "home-sl", unit: "home", newKeys: "sl", intro: "Ring fingers on {0} and {1}. Keep your wrists relaxed and off the desk.", make: (t) => drill(t("sl"), t("fjdk")) },
  { id: "home-a", unit: "home", newKeys: "a;", intro: "Little fingers on {0} and {1}. That's the whole home row: {home}", make: (t) => drillThenWords(t("a;"), t("asdfjkl;")) },
  { id: "home-gh", unit: "home", newKeys: "gh", intro: "Index fingers stretch one key inward for {0} and {1}, then return to {bumps}.", make: (t) => drillThenWords(t("gh"), t(HOME)) },
  { id: "home-words", unit: "home", title: "Home row words", newKeys: "", intro: "Real words using only the home row.", make: (t) => wordsOnly(t(HOME), "", 22) },

  // Top row
  { id: "top-ei", unit: "top", newKeys: "ei", intro: "Middle fingers reach up for {0} and {1}.", make: (t) => drillThenWords(t("ei"), t(HOME + "ei")) },
  { id: "top-ru", unit: "top", newKeys: "ru", intro: "Index fingers reach up and slightly left for {0} and {1}.", make: (t) => drillThenWords(t("ru"), t(HOME + "eiru")) },
  { id: "top-ty", unit: "top", newKeys: "ty", intro: "The index fingers stretch further for {0} and {1}.", make: (t) => drillThenWords(t("ty"), t(HOME + "eiruty")) },
  { id: "top-wo", unit: "top", newKeys: "wo", intro: "Ring fingers reach up for {0} and {1}.", make: (t) => drillThenWords(t("wo"), t(HOME + "eirutywo")) },
  { id: "top-qp", unit: "top", newKeys: "qp", intro: "Little fingers reach up for {0} and {1}.", make: (t) => drillThenWords(t("qp"), t(HOME + TOP)) },
  { id: "top-words", unit: "top", title: "Top row words", newKeys: "", intro: "Words using the home and top rows.", make: (t) => wordsOnly(t(HOME + TOP), t(TOP), 25) },

  // Bottom row
  { id: "bottom-vm", unit: "bottom", newKeys: "vm", intro: "Index fingers curl down for {0} and {1}.", make: (t) => drillThenWords(t("vm"), t(HOME + TOP + "vm")) },
  { id: "bottom-c", unit: "bottom", newKeys: "c,", intro: "Middle fingers curl down for {0} and {1}.", make: (t) => drillThenWords(t("c,"), t(HOME + TOP + "vmc,")) },
  { id: "bottom-x", unit: "bottom", newKeys: "x.", intro: "Ring fingers curl down for {0} and {1}.", make: (t) => drillThenWords(t("x."), t(HOME + TOP + "vmc,x.")) },
  { id: "bottom-z", unit: "bottom", newKeys: "z/", intro: "Little fingers curl down for {0} and {1}.", make: (t) => drillThenWords(t("z/"), t(HOME + TOP + "vmc,x.z/")) },
  { id: "bottom-bn", unit: "bottom", newKeys: "bn", intro: "Index fingers stretch down and inward for {0} and {1}. That's every letter!", make: (t) => drillThenWords(t("bn"), t(HOME + TOP + BOTTOM)) },
  { id: "bottom-words", unit: "bottom", title: "All the letters", newKeys: "", intro: "Words that use the whole alphabet.", make: (t) => wordsOnly(t(HOME + TOP + BOTTOM), t("zxcvbnm"), 28) },

  // Numbers (the number row is the same on every supported layout)
  { id: "num-4567", unit: "numbers", title: "4 5 6 7", newKeys: "4567", intro: "Index fingers reach two rows up. 4 and 5 are left index, 6 and 7 right index.", make: () => numbers("4567", "") },
  { id: "num-38", unit: "numbers", title: "3 and 8", newKeys: "38", intro: "Middle fingers reach up for 3 and 8.", make: () => numbers("38", "4567") },
  { id: "num-29", unit: "numbers", title: "2 and 9", newKeys: "29", intro: "Ring fingers reach up for 2 and 9.", make: () => numbers("29", "345678") },
  { id: "num-10", unit: "numbers", title: "1 and 0", newKeys: "10", intro: "Little fingers stretch up for 1 and 0.", make: () => numbers("10", "23456789") },
  { id: "num-context", unit: "numbers", title: "Numbers in text", newKeys: "", intro: "Numbers mixed into everyday words.", make: () => numbersInContext },

  // Shift & symbols
  { id: "sym-shift", unit: "symbols", title: "Capitals", newKeys: "", intro: "Hold Shift with the little finger of the opposite hand, then press the letter.", make: () => capitals },
  { id: "sym-punct", unit: "symbols", title: "Punctuation", newKeys: ",.?!", intro: "Commas, periods, question and exclamation marks. Capitalize after a sentence ends.", make: () => punctuation },
  { id: "sym-quotes", unit: "symbols", title: "Quotes and hyphens", newKeys: "'\"-", intro: "Apostrophes, quotes (with Shift) and hyphens. The keyboard below shows where they live.", make: () => quotes },
  { id: "sym-brackets", unit: "symbols", title: "Brackets and colons", newKeys: "():;", intro: "( and ) are Shift + 9 and 0. : is Shift + ;.", make: () => brackets },
  { id: "sym-special", unit: "symbols", title: "@ # $ % & *", newKeys: "@#$%&*", intro: "Symbols live above the numbers. Use the opposite hand for Shift.", make: () => symbols },

  // Sentences
  { id: "sent-short", unit: "sentences", title: "Short sentences", newKeys: "", intro: "Simple sentences. Focus on a steady rhythm.", make: () => sentences(SHORT_SENTENCES, 4) },
  { id: "sent-pangrams", unit: "sentences", title: "Pangrams", newKeys: "", intro: "Each sentence uses every letter of the alphabet.", make: () => sentences(PANGRAMS, 3) },
  { id: "sent-long", unit: "sentences", title: "Longer sentences", newKeys: "", intro: "Longer lines. Don't rush; accuracy first.", make: () => sentences(LONG_SENTENCES, 3) },
  { id: "sent-mixed", unit: "sentences", title: "Real-world text", newKeys: "", intro: "Times, prices and symbols in real sentences. The final test!", make: () => sentences(MIXED_SENTENCES, 3) },
];

const KEY_NAMES: Record<string, string> = { ",": "comma", ".": "period", "/": "slash", ";": ";", "'": "quote", "-": "dash", "[": "[", "]": "]" };
const keyName = (k: string) => KEY_NAMES[k] ?? k.toUpperCase();
const LETTER_UNITS: readonly UnitId[] = ["home", "top", "bottom"];

function buildLessons(layoutId: LayoutId): Lesson[] {
  const layout = getLayout(layoutId);
  const t = (q: string) => translateKeys(q, layout);
  const home = t("asdf jkl;");
  const bumps = t("fj").toUpperCase().split("").join(" and ");
  return DEFS.map((d, i) => {
    const letters = LETTER_UNITS.includes(d.unit);
    const keys = letters ? t(d.newKeys) : d.newKeys;
    const names = [...keys].map(keyName);
    const title = d.title ?? names.join(" and ");
    const intro = d.intro
      .replace("{0}", names[0] ?? "")
      .replace("{1}", names[1] ?? "")
      .replace("{home}", home)
      .replace("{bumps}", bumps);
    return { id: d.id, unit: d.unit, number: i + 1, title, intro, newKeys: keys, build: d.make(letters ? t : (q) => q) };
  });
}

const CACHE = new Map<LayoutId, Lesson[]>();
/** The lesson path for a keyboard layout (same ids and order for every layout). */
export function lessonsFor(layoutId: LayoutId = "qwerty"): readonly Lesson[] {
  let l = CACHE.get(layoutId);
  if (!l) {
    l = buildLessons(layoutId);
    CACHE.set(layoutId, l);
  }
  return l;
}

/** QWERTY lessons: ids, units and order are the same for every layout. */
export const LESSONS: readonly Lesson[] = lessonsFor("qwerty");

export const getLesson = (id: string, layoutId: LayoutId = "qwerty"): Lesson | undefined => lessonsFor(layoutId).find((l) => l.id === id);
export const getUnit = (id: UnitId): Unit => UNITS.find((u) => u.id === id) ?? (UNITS[0] as Unit);
export const lessonsInUnit = (id: UnitId, layoutId: LayoutId = "qwerty"): Lesson[] => lessonsFor(layoutId).filter((l) => l.unit === id);
export const nextLesson = (id: string, layoutId: LayoutId = "qwerty"): Lesson | undefined => {
  const all = lessonsFor(layoutId);
  const l = all.find((x) => x.id === id);
  return l ? all[l.number] : undefined;
};

/**
 * Keys taught up to and including this lesson, for dimming the rest of the
 * keyboard. Undefined once every letter is known (numbers, symbols, sentences).
 */
export function keysTaughtThrough(lesson: Lesson, layoutId: LayoutId = "qwerty"): string | undefined {
  if (!LETTER_UNITS.includes(lesson.unit)) return undefined;
  return lessonsFor(layoutId)
    .slice(0, lesson.number)
    .map((l) => l.newKeys)
    .join("");
}
