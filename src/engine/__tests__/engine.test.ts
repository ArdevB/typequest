import { describe, expect, it } from "vitest";
import {
  KeyKind,
  computeResults,
  consistencyFrom,
  createRng,
  createTypingEngine,
  fixedSource,
  replayRun,
  weakKeyWeights,
  wordSource,
  type EngineOptions,
  type TypingEngine,
} from "../index";

/** Engine with a hand-driven clock. */
function setup(words: string[], over: Partial<EngineOptions> = {}) {
  const clock = { t: 1000 };
  const engine = createTypingEngine({
    mode: { kind: "words", count: 10 },
    source: fixedSource(words),
    autoTick: false,
    now: () => clock.t,
    ...over,
  });
  /** Type text with `ms` between keystrokes. */
  const type = (text: string, ms = 100) => {
    for (const ch of text) {
      engine.input(ch);
      clock.t += ms;
    }
  };
  return { engine, clock, type };
}

const collect = (engine: TypingEngine) => {
  const events: string[] = [];
  engine.on("correct", () => events.push("correct"));
  engine.on("error", () => events.push("error"));
  engine.on("wordComplete", (e) => events.push(`word:${e.word}:${e.correct}`));
  engine.on("combo", (e) => events.push(`combo:${e.count}`));
  engine.on("comboBreak", (e) => events.push(`break:${e.lost}`));
  engine.on("finish", () => events.push("finish"));
  return events;
};

describe("typing engine", () => {
  it("finishes a words test when the last word is typed, with perfect stats", () => {
    const { engine, type } = setup(["hello", "world"]);
    const events = collect(engine);
    type("hello world");
    const r = engine.getResult();
    expect(r).not.toBeNull();
    expect(events.at(-1)).toBe("finish");
    expect(events).toContain("word:hello:true");
    expect(events).toContain("word:world:true");
    expect(r!.accuracy).toBe(100);
    expect(r!.chars).toEqual({ correct: 10, incorrect: 0, extra: 0, missed: 0 });
    // 11 chars over 1000ms (10 gaps × 100ms) = 11/5 per 1/60 min = 132 WPM
    expect(r!.durationMs).toBe(1000);
    expect(r!.wpm).toBe(132);
    expect(r!.rawWpm).toBe(132);
  });

  it("does not start on space and ignores space on an empty word", () => {
    const { engine } = setup(["a", "b"]);
    engine.space();
    expect(engine.getSnapshot().status).toBe("idle");
    engine.input("a");
    engine.space();
    engine.space();
    expect(engine.getSnapshot().wordIndex).toBe(1);
  });

  it("tracks errors, extra chars and missed chars", () => {
    const { engine, type } = setup(["cat", "dog"]);
    const events = collect(engine);
    type("cxtt dg"); // wrong 2nd char, one extra; then "dg" + nothing → still on last word
    engine.space(); // submit "dg" incomplete → finishes (last word)
    const r = engine.getResult()!;
    expect(events).toContain("word:cat:false");
    // "cxtt" vs "cat": x wrong + 1 extra. "dg" vs "dog": g wrong + 1 missed.
    expect(r.chars).toEqual({ correct: 3, incorrect: 2, extra: 1, missed: 1 });
    expect(engine.getCharState(0, 1)).toBe("incorrect");
    expect(engine.getCharState(0, 3)).toBe("extra");
    expect(r.wpm).toBeLessThan(r.rawWpm);
  });

  it("finishes the last word only once its length is reached", () => {
    const { engine, type } = setup(["ab", "cd"]);
    type("ab c");
    expect(engine.getSnapshot().status).toBe("running");
    type("x"); // wrong but length reached → finishes (errors stay, Monkeytype style)
    expect(engine.getSnapshot().status).toBe("finished");
  });

  it("backspace edits the current word and can return to a wrong previous word", () => {
    const { engine, type } = setup(["abc", "def", "ghi"]);
    type("abx ");
    expect(engine.getSnapshot().wordIndex).toBe(1);
    engine.backspace();
    expect(engine.getSnapshot().wordIndex).toBe(0);
    engine.backspace();
    type("c ");
    expect(engine.getTyped(0)).toBe("abc");
    // Correct words are locked.
    engine.backspace();
    expect(engine.getSnapshot().wordIndex).toBe(1);
  });

  it("ctrl+backspace clears the current word", () => {
    const { engine, type } = setup(["hello", "x"]);
    type("hel");
    engine.backspace(true);
    expect(engine.getTyped(0)).toBe("");
    expect(engine.getLog().at(-1)).toEqual([300, "w", KeyKind.Backspace]);
  });

  it("stopOnError=letter rejects wrong keys", () => {
    const { engine, type } = setup(["abc"], { stopOnError: "letter" });
    type("axbc");
    const r = engine.getResult()!;
    expect(engine.getTyped(0)).toBe("abc");
    expect(r.accuracy).toBe(75);
    expect(r.chars.incorrect).toBe(0);
  });

  it("stopOnError=word blocks space on a wrong word", () => {
    const { engine, type } = setup(["ab", "cd"], { stopOnError: "word" });
    type("ax");
    engine.space();
    expect(engine.getSnapshot().wordIndex).toBe(0);
  });

  it("emits combo milestones and breaks", () => {
    const words = Array.from({ length: 10 }, () => "aaaaa");
    const { engine, type } = setup(words);
    const events = collect(engine);
    type("aaaaa aaaaa aaaaa aaaaa aaaaa "); // 30 correct (25 letters + 5 spaces)
    type("b");
    expect(events.filter((e) => e.startsWith("combo:"))).toEqual(["combo:10", "combo:25"]);
    expect(events).toContain("break:30");
    expect(engine.getSnapshot().maxCombo).toBe(30);
  });

  it("time mode streams words and ends exactly at the limit", () => {
    const { engine, clock, type } = setup([], {
      mode: { kind: "time", seconds: 15 },
      source: wordSource({ seed: 1 }),
    });
    const appended: number[] = [];
    engine.on("wordsAppended", (e) => appended.push(e.from));
    const words = engine.getWords();
    expect(words.length).toBe(80);
    for (let i = 0; i < 45; i++) type(`${words[i]} `, 10);
    expect(appended.length).toBeGreaterThan(0);
    clock.t += 60_000;
    engine.tick();
    const r = engine.getResult()!;
    expect(r.durationMs).toBe(15_000);
    expect(r.wpm).toBeGreaterThan(0);
    // Typing after the end does nothing.
    type("abc");
    expect(engine.getLog().length).toBe(r.log.length);
  });

  it("blocks pasted input and reports it", () => {
    const { engine, type } = setup(["ab"]);
    engine.rejectInput("paste");
    type("ab");
    expect(engine.getResult()!.flags.pasteAttempts).toBe(1);
  });

  it("reset() gives a fresh test", () => {
    const { engine, type } = setup(["ab", "cd", "ef", "gh"]);
    type("ab ");
    engine.reset();
    const s = engine.getSnapshot();
    expect(s.status).toBe("idle");
    expect(s.wordIndex).toBe(0);
    expect(engine.getLog()).toHaveLength(0);
  });
});

describe("replay", () => {
  it("reproduces the live result from the keystroke log", () => {
    const { engine, type } = setup(["the", "quick", "brown", "fox"]);
    type("thw", 80);
    engine.backspace();
    type("e quick brwn", 120);
    engine.space();
    type("fox", 90);
    const live = engine.getResult()!;
    const replayed = replayRun({ mode: live.mode, words: live.words, log: live.log });
    expect(replayed).toEqual(live);
  });

  it("reproduces a time-mode run", () => {
    const { engine, clock, type } = setup([], {
      mode: { kind: "time", seconds: 15 },
      source: wordSource({ seed: "replay" }),
    });
    const words = engine.getWords();
    for (let i = 0; i < 20; i++) type(`${words[i]} `, 140);
    clock.t += 20_000;
    engine.tick();
    const live = engine.getResult()!;
    expect(replayRun({ mode: live.mode, words: live.words, log: live.log })).toEqual(live);
  });
});

describe("metrics", () => {
  it("consistency is 100 for perfectly steady typing and lower for bursty typing", () => {
    expect(consistencyFrom([60, 60, 60, 60])).toBe(100);
    expect(consistencyFrom([20, 100, 20, 100])).toBeLessThan(60);
  });

  it("builds per-key stats from expected keys", () => {
    const r = computeResults({
      mode: { kind: "words", count: 10 },
      words: ["ab"],
      typed: ["ab"],
      committed: 1,
      hits: [
        { t: 0, expected: "a", typed: "a", correct: true },
        { t: 100, expected: "b", typed: "x", correct: false },
        { t: 250, expected: "b", typed: "b", correct: true },
      ],
      log: [],
      durationMs: 250,
      maxCombo: 1,
    });
    expect(r.perKey.b).toEqual({ attempts: 2, errors: 1, avgMs: 150 });
    expect(r.perKey.a).toEqual({ attempts: 1, errors: 0, avgMs: 0 });
  });
});

describe("lesson generation", () => {
  it("is deterministic for a seed", () => {
    const a = wordSource({ seed: "daily-2026-10-15" }).take(30);
    const b = wordSource({ seed: "daily-2026-10-15" }).take(30);
    expect(a).toEqual(b);
    expect(createRng(5)()).toBe(createRng(5)());
  });

  it("only uses allowed keys", () => {
    const words = wordSource({ allowedKeys: "asdfjkl", seed: 3 }).take(50);
    for (const w of words) expect(w).toMatch(/^[asdfjkl]+$/);
  });

  it("weights weak keys more heavily", () => {
    const w = weakKeyWeights({
      a: { attempts: 100, errors: 1, avgMs: 150 },
      q: { attempts: 40, errors: 12, avgMs: 320 },
    });
    expect(w.q).toBeGreaterThan(w.a!);
    const drill = wordSource({ keyWeights: w, seed: 9 }).take(300).join("");
    const plain = wordSource({ seed: 9 }).take(300).join("");
    const count = (s: string) => [...s].filter((c) => c === "q").length;
    expect(count(drill)).toBeGreaterThan(count(plain));
  });
});
