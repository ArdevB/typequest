import { describe, expect, it } from "vitest";
import { KeyKind, createTypingEngine, wordSource, type Keystroke, type StopOnError, type TestMode } from "@/engine";
import { getLesson } from "@/lessons/catalog";
import type { RunPayload } from "@/lib/payloads";
import { levelForXp, levelProgress, rankFor, runXp, xpForLevel } from "@/lib/progression";
import { checkLog, validateLesson, validateRun } from "./validateRun";

/** Types a test "perfectly" with a fixed gap between keys, like a client would. */
function play(mode: TestMode, seed: number, gap = 110, opts: { punctuation?: boolean; stopOnError?: StopOnError; extraMs?: number } = {}) {
  const clock = { t: 0 };
  const engine = createTypingEngine({
    mode,
    source: wordSource({ seed, punctuation: opts.punctuation ?? false, numbers: false }),
    stopOnError: opts.stopOnError,
    autoTick: false,
    now: () => clock.t,
  });
  for (let w = 0; engine.getSnapshot().status !== "finished" && w < 400; w++) {
    const word = engine.getWords()[w] ?? "";
    for (const ch of word + " ") {
      engine.input(ch);
      clock.t += gap;
      engine.tick();
      if (engine.getSnapshot().status === "finished") break;
    }
  }
  return engine.getResult()!;
}

const payload = (over: Partial<RunPayload>): RunPayload => ({
  mode: { kind: "words", count: 25 },
  seed: 7,
  punctuation: false,
  numbers: false,
  stopOnError: "off",
  log: [],
  ...over,
});

describe("validateRun", () => {
  it("accepts an honest words run and reproduces its score", () => {
    const live = play({ kind: "words", count: 25 }, 7);
    const v = validateRun(payload({ log: [...live.log] }));
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.value.wpm).toBe(live.wpm);
      expect(v.value.accuracy).toBe(live.accuracy);
    }
  });

  it("accepts an honest time run", () => {
    const live = play({ kind: "time", seconds: 15 }, 99, 150, { punctuation: true });
    const v = validateRun(payload({ mode: { kind: "time", seconds: 15 }, seed: 99, punctuation: true, log: [...live.log] }));
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.value.durationMs).toBe(15_000);
  });

  it("rejects a log that doesn't match the seed's words", () => {
    const live = play({ kind: "words", count: 25 }, 7);
    const v = validateRun(payload({ seed: 8, log: [...live.log] }));
    expect(v.ok).toBe(false);
  });

  it("rejects bot-speed typing", () => {
    const live = play({ kind: "words", count: 25 }, 7, 8);
    const v = validateRun(payload({ log: [...live.log] }));
    expect(v).toEqual({ ok: false, reason: "impossibly fast keystrokes" });
  });

  it("rejects pasted input", () => {
    const live = play({ kind: "words", count: 10 }, 7);
    const log: Keystroke[] = [[0, "paste", KeyKind.Rejected], ...live.log];
    expect(validateRun(payload({ mode: { kind: "words", count: 10 }, log })).ok).toBe(false);
  });

  it("rejects unfinished runs and runs past the time limit", () => {
    const live = play({ kind: "words", count: 25 }, 7);
    expect(validateRun(payload({ log: live.log.slice(0, 40) }))).toEqual({ ok: false, reason: "run was not finished" });
    const late: Keystroke[] = [...live.log, [20_000, "a", KeyKind.Char]];
    expect(validateRun(payload({ mode: { kind: "time", seconds: 15 }, log: late })).ok).toBe(false);
  });

  it("checks timestamps are ordered", () => {
    expect(checkLog([[0, "a", 0], [50, "b", 0], [20, "c", 0]])).toBe("keystrokes out of order");
  });
});

describe("validateLesson", () => {
  it("rebuilds the lesson from its seed and rates it", () => {
    const lesson = getLesson("home-fj")!;
    const text = lesson.build(1234);
    const clock = { t: 0 };
    const engine = createTypingEngine({
      mode: { kind: "text", text },
      source: wordSource(),
      stopOnError: "letter",
      autoTick: false,
      now: () => clock.t,
    });
    for (const ch of text) {
      engine.input(ch);
      clock.t += 200;
    }
    const v = validateLesson({ lessonId: "home-fj", seed: 1234, log: [...engine.getLog()] });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.value.stars).toBe(3); // 100% accuracy at 60 WPM
    expect(validateLesson({ lessonId: "home-fj", seed: 999, log: [...engine.getLog()] }).ok).toBe(false);
    expect(validateLesson({ lessonId: "nope", seed: 1, log: [[0, "a", 0]] }).ok).toBe(false);
  });
});

describe("progression", () => {
  it("levels grow with XP", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(50);
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(49)).toBe(1);
    expect(levelForXp(50)).toBe(2);
    expect(levelForXp(xpForLevel(10))).toBe(10);
    const p = levelProgress(xpForLevel(4) + 10);
    expect(p.level).toBe(4);
    expect(p.current).toBe(10);
  });

  it("ranks by rating WPM", () => {
    expect(rankFor(0)).toBe("unranked");
    expect(rankFor(12)).toBe("bronze");
    expect(rankFor(30)).toBe("silver");
    expect(rankFor(69.9)).toBe("gold");
    expect(rankFor(70)).toBe("diamond");
    expect(rankFor(140)).toBe("master");
  });

  it("awards XP for correct words, scaled by accuracy", () => {
    expect(runXp({ wpm: 60, accuracy: 100, durationMs: 60_000 })).toBe(65);
    expect(runXp({ wpm: 60, accuracy: 90, durationMs: 60_000 })).toBe(54);
  });
});
