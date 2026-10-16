import { describe, expect, it } from "vitest";
import { drillText } from "@/engine";
import { LESSONS, UNITS, getLesson, nextLesson } from "./catalog";
import { isUnlocked, currentLessonId } from "./progress";
import { rateLesson } from "./rating";

/** Characters a lesson is allowed to use: everything taught up to and including it. */
function taughtSoFar(index: number): Set<string> {
  const set = new Set<string>([" "]);
  for (let i = 0; i <= index; i++) for (const c of LESSONS[i]!.newKeys) set.add(c);
  return set;
}

describe("lesson catalog", () => {
  it("has unique ids, valid units and a non-empty text for every lesson", () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
    for (const l of LESSONS) {
      expect(UNITS.some((u) => u.id === l.unit)).toBe(true);
      for (const seed of [1, 2, 3]) {
        const text = l.build(seed);
        expect(text.trim().length, l.id).toBeGreaterThan(20);
        expect(text, l.id).not.toMatch(/\s{2,}/);
      }
    }
  });

  it("letter lessons only use keys taught so far", () => {
    const letterLessons = LESSONS.filter((l) => ["home", "top", "bottom"].includes(l.unit));
    for (const l of letterLessons) {
      const allowed = taughtSoFar(LESSONS.indexOf(l));
      for (const seed of [11, 12, 13]) {
        for (const ch of l.build(seed)) expect(allowed.has(ch), `${l.id}: "${ch}"`).toBe(true);
      }
    }
  });

  it("is deterministic per seed", () => {
    for (const l of LESSONS) expect(l.build(42)).toBe(l.build(42));
  });

  it("links lessons in order", () => {
    expect(getLesson("home-fj")?.number).toBe(1);
    expect(nextLesson("home-fj")?.id).toBe("home-dk");
    expect(nextLesson(LESSONS.at(-1)!.id)).toBeUndefined();
  });
});

describe("drills", () => {
  it("starts with focus keys only, then mixes in review keys", () => {
    const groups = drillText({ focus: "gh", review: "asdfjkl", groups: 20, seed: 4 });
    expect(groups).toHaveLength(20);
    for (const g of groups.slice(0, 4)) expect(g).toMatch(/^[gh]+$/);
    expect(groups.join("")).toMatch(/[asdfjkl]/);
  });
});

describe("rating and unlocks", () => {
  const lesson = getLesson("home-fj")!;
  const r = (wpm: number, accuracy: number) => rateLesson(lesson, { wpm, accuracy, flags: { pasteAttempts: 0, suspiciousIntervals: 0 } });

  it("needs both accuracy and speed for each star", () => {
    expect(r(40, 80)).toBe(0);
    expect(r(5, 90)).toBe(1);
    expect(r(16, 93)).toBe(2);
    expect(r(30, 93)).toBe(2);
    expect(r(26, 98)).toBe(3);
  });

  it("unlocks lessons one at a time", () => {
    expect(isUnlocked("home-fj", {})).toBe(true);
    expect(isUnlocked("home-dk", {})).toBe(false);
    const progress = { "home-fj": { stars: 1 as const, bestWpm: 10, bestAccuracy: 90, attempts: 1, completedAt: 1 } };
    expect(isUnlocked("home-dk", progress)).toBe(true);
    expect(currentLessonId(progress)).toBe("home-dk");
  });
});

describe("other keyboard layouts", async () => {
  const { lessonsFor, getLesson } = await import("./catalog");
  const { DVORAK, COLEMAK, translateKeys } = await import("@/engine");
  it("maps QWERTY positions onto Dvorak and Colemak", () => {
    expect(translateKeys("asdf jkl;", DVORAK)).toBe("aoeu htns");
    expect(translateKeys("asdf jkl;", COLEMAK)).toBe("arst neio");
    expect(translateKeys("Hello!", COLEMAK)).toBe("Hfiiy!");
    expect(DVORAK.byChar.get("u")?.bump).toBe(true);
    expect(COLEMAK.byChar.get("n")?.finger).toBe("index");
  });
  it("teaches the same fingers with the layout's keys", () => {
    const d = getLesson("home-fj", "dvorak")!;
    expect(d.newKeys).toBe("uh");
    expect(d.title).toBe("U and H");
    expect(d.intro).toContain("U and H");
    expect(d.build(3).replace(/ /g, "")).toMatch(/^[uh]+$/);
    const words = getLesson("home-words", "colemak")!.build(5).split(" ");
    for (const w of words) expect(w).toMatch(/^[arstdhneio']+$/);
    expect(lessonsFor("dvorak").map((l) => l.id)).toEqual(lessonsFor("qwerty").map((l) => l.id));
  });
});
