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
  { id: "home", title: "Home row", description: "Where your fingers live. Feel the bumps on F and J.", goals: { wpm2: 15, wpm3: 25 } },
  { id: "top", title: "Top row", description: "Reach up from home, then come straight back.", goals: { wpm2: 18, wpm3: 28 } },
  { id: "bottom", title: "Bottom row", description: "Curl down for the last letters and basic punctuation.", goals: { wpm2: 20, wpm3: 30 } },
  { id: "numbers", title: "Numbers", description: "The long reach to the number row.", goals: { wpm2: 14, wpm3: 22 } },
  { id: "symbols", title: "Shift & symbols", description: "Capitals, punctuation and symbols with the Shift key.", goals: { wpm2: 16, wpm3: 26 } },
  { id: "sentences", title: "Full sentences", description: "Everything together, in real writing.", goals: { wpm2: 25, wpm3: 40 } },
];

const HOME = "asdfghjkl;";
const TOP = "qwertyuiop";
const BOTTOM = "zxcvbnm,./";

type Def = Omit<Lesson, "number">;

const DEFS: Def[] = [
  // Home row
  { id: "home-fj", unit: "home", title: "F and J", newKeys: "fj", intro: "Rest your index fingers on F and J. You can feel small bumps on them, so you never need to look.", build: drill("fj", "", 16) },
  { id: "home-dk", unit: "home", title: "D and K", newKeys: "dk", intro: "Your middle fingers sit next to them on D and K.", build: drill("dk", "fj") },
  { id: "home-sl", unit: "home", title: "S and L", newKeys: "sl", intro: "Ring fingers on S and L. Keep your wrists relaxed and off the desk.", build: drill("sl", "fjdk") },
  { id: "home-a", unit: "home", title: "A and ;", newKeys: "a;", intro: "Little fingers on A and ;. That's the whole home row: asdf jkl;", build: drillThenWords("a;", "asdfjkl;") },
  { id: "home-gh", unit: "home", title: "G and H", newKeys: "gh", intro: "Index fingers stretch one key inward for G and H, then return to F and J.", build: drillThenWords("gh", HOME) },
  { id: "home-words", unit: "home", title: "Home row words", newKeys: "", intro: "Real words using only the home row.", build: wordsOnly(HOME, "", 22) },

  // Top row
  { id: "top-ei", unit: "top", title: "E and I", newKeys: "ei", intro: "Middle fingers reach up for E and I. Now real words open up!", build: drillThenWords("ei", HOME + "ei") },
  { id: "top-ru", unit: "top", title: "R and U", newKeys: "ru", intro: "Index fingers reach up and slightly left for R and U.", build: drillThenWords("ru", HOME + "eiru") },
  { id: "top-ty", unit: "top", title: "T and Y", newKeys: "ty", intro: "The index fingers stretch further for T and Y.", build: drillThenWords("ty", HOME + "eiruty") },
  { id: "top-wo", unit: "top", title: "W and O", newKeys: "wo", intro: "Ring fingers reach up for W and O.", build: drillThenWords("wo", HOME + "eirutywo") },
  { id: "top-qp", unit: "top", title: "Q and P", newKeys: "qp", intro: "Little fingers reach up for Q and P.", build: drillThenWords("qp", HOME + TOP) },
  { id: "top-words", unit: "top", title: "Top row words", newKeys: "", intro: "Words using the home and top rows.", build: wordsOnly(HOME + TOP, TOP, 25) },

  // Bottom row
  { id: "bottom-vm", unit: "bottom", title: "V and M", newKeys: "vm", intro: "Index fingers curl down for V and M.", build: drillThenWords("vm", HOME + TOP + "vm") },
  { id: "bottom-c", unit: "bottom", title: "C and comma", newKeys: "c,", intro: "Middle fingers curl down for C and the comma.", build: drillThenWords("c,", HOME + TOP + "vmc,") },
  { id: "bottom-x", unit: "bottom", title: "X and period", newKeys: "x.", intro: "Ring fingers curl down for X and the period.", build: drillThenWords("x.", HOME + TOP + "vmc,x.") },
  { id: "bottom-z", unit: "bottom", title: "Z and slash", newKeys: "z/", intro: "Little fingers curl down for Z and the slash.", build: drillThenWords("z/", HOME + TOP + "vmc,x.z/") },
  { id: "bottom-bn", unit: "bottom", title: "B and N", newKeys: "bn", intro: "Index fingers stretch down and inward for B and N. That's every letter!", build: drillThenWords("bn", HOME + TOP + BOTTOM) },
  { id: "bottom-words", unit: "bottom", title: "All the letters", newKeys: "", intro: "Words that use the whole alphabet.", build: wordsOnly(HOME + TOP + BOTTOM, "zxcvbnm", 28) },

  // Numbers
  { id: "num-4567", unit: "numbers", title: "4 5 6 7", newKeys: "4567", intro: "Index fingers reach two rows up. 4 and 5 are left index, 6 and 7 right index.", build: numbers("4567", "") },
  { id: "num-38", unit: "numbers", title: "3 and 8", newKeys: "38", intro: "Middle fingers reach up for 3 and 8.", build: numbers("38", "4567") },
  { id: "num-29", unit: "numbers", title: "2 and 9", newKeys: "29", intro: "Ring fingers reach up for 2 and 9.", build: numbers("29", "345678") },
  { id: "num-10", unit: "numbers", title: "1 and 0", newKeys: "10", intro: "Little fingers stretch up for 1 and 0.", build: numbers("10", "23456789") },
  { id: "num-context", unit: "numbers", title: "Numbers in text", newKeys: "", intro: "Numbers mixed into everyday words.", build: numbersInContext },

  // Shift & symbols
  { id: "sym-shift", unit: "symbols", title: "Capitals", newKeys: "", intro: "Hold Shift with the little finger of the opposite hand, then press the letter.", build: capitals },
  { id: "sym-punct", unit: "symbols", title: "Punctuation", newKeys: ",.?!", intro: "Commas, periods, question and exclamation marks. Capitalize after a sentence ends.", build: punctuation },
  { id: "sym-quotes", unit: "symbols", title: "Quotes and hyphens", newKeys: "'\"-", intro: "Right little finger for ' and \" (with Shift), and - on the number row.", build: quotes },
  { id: "sym-brackets", unit: "symbols", title: "Brackets and colons", newKeys: "():;", intro: "( and ) are Shift + 9 and 0. : is Shift + ;.", build: brackets },
  { id: "sym-special", unit: "symbols", title: "@ # $ % & *", newKeys: "@#$%&*", intro: "Symbols live above the numbers. Use the opposite hand for Shift.", build: symbols },

  // Sentences
  { id: "sent-short", unit: "sentences", title: "Short sentences", newKeys: "", intro: "Simple sentences. Focus on a steady rhythm.", build: sentences(SHORT_SENTENCES, 4) },
  { id: "sent-pangrams", unit: "sentences", title: "Pangrams", newKeys: "", intro: "Each sentence uses every letter of the alphabet.", build: sentences(PANGRAMS, 3) },
  { id: "sent-long", unit: "sentences", title: "Longer sentences", newKeys: "", intro: "Longer lines. Don't rush; accuracy first.", build: sentences(LONG_SENTENCES, 3) },
  { id: "sent-mixed", unit: "sentences", title: "Real-world text", newKeys: "", intro: "Times, prices and symbols in real sentences. The final test!", build: sentences(MIXED_SENTENCES, 3) },
];

export const LESSONS: readonly Lesson[] = DEFS.map((d, i) => ({ ...d, number: i + 1 }));

const BY_ID = new Map(LESSONS.map((l) => [l.id, l]));

export const getLesson = (id: string): Lesson | undefined => BY_ID.get(id);
export const getUnit = (id: UnitId): Unit => UNITS.find((u) => u.id === id) ?? (UNITS[0] as Unit);
export const lessonsInUnit = (id: UnitId): Lesson[] => LESSONS.filter((l) => l.unit === id);
export const nextLesson = (id: string): Lesson | undefined => {
  const l = BY_ID.get(id);
  return l ? LESSONS[l.number] : undefined;
};

/**
 * Keys taught up to and including this lesson, for dimming the rest of the
 * keyboard. Undefined once every letter is known (numbers, symbols, sentences).
 */
export function keysTaughtThrough(lesson: Lesson): string | undefined {
  if (!["home", "top", "bottom"].includes(lesson.unit)) return undefined;
  return LESSONS.slice(0, lesson.number)
    .map((l) => l.newKeys)
    .join("");
}
