import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createTypingEngine, wordSource, type RunResult, type TestMode } from "@/engine";
import { ACHIEVEMENTS } from "@/achievements/catalog";
import { hasRule, newlyEarned, type PlayerStats } from "@/achievements/check";
import { LESSONS } from "@/lessons/catalog";
import { evaluateDaily, msUntilNextDaily, nepalDay, nepalHour, parseChallengeRow } from "./daily";
import { attachGuard } from "./guard";
import { SKILLS, getSkill, lowestWpmAfter } from "./skills";

/** Plays a test at a fixed pace; `mistakeAt` types one wrong key at that keystroke. */
function play(mode: TestMode, gap: number, opts: { mistakeAt?: number; guard?: Parameters<typeof attachGuard>[1]; seed?: number } = {}) {
  const clock = { t: 0 };
  const engine = createTypingEngine({ mode, source: wordSource({ seed: opts.seed ?? 3 }), autoTick: false, now: () => clock.t });
  let failed: string | null = null;
  if (opts.guard) attachGuard(engine, opts.guard, (why) => (failed = why));
  let n = 0;
  for (let w = 0; engine.getSnapshot().status !== "finished" && w < 500; w++) {
    for (const ch of (engine.getWords()[w] ?? "") + " ") {
      if (engine.getSnapshot().status === "finished") break;
      engine.input(n++ === opts.mistakeAt ? "#" : ch);
      clock.t += gap;
      engine.tick();
    }
  }
  return { result: engine.getResult() as RunResult, failed, natural: failed === null };
}

describe("skill challenges", () => {
  it("Perfect Run passes clean runs and stops on the first mistake", () => {
    const skill = getSkill("perfect-run")!;
    const setup = skill.setup(1);
    const clean = play(setup.mode, 150, { guard: setup.guard });
    expect(skill.evaluate(1, clean.result, clean.natural).passed).toBe(true);
    const slip = play(setup.mode, 150, { guard: setup.guard, mistakeAt: 7 });
    expect(slip.failed).toBe("mistake");
    expect(skill.evaluate(1, slip.result, slip.natural).passed).toBe(false);
  });

  it("Speed Gate fails when speed drops under the gate", () => {
    const skill = getSkill("speed-gate")!;
    const setup = skill.setup(2); // 60 WPM gate
    const fast = play(setup.mode, 150, { guard: setup.guard }); // ~80 WPM
    expect(skill.evaluate(2, fast.result, fast.natural).passed).toBe(true);
    const slow = play(setup.mode, 260, { guard: setup.guard }); // ~46 WPM
    expect(slow.failed).toBe("gate");
    expect(skill.evaluate(2, slow.result, slow.natural).passed).toBe(false);
    expect(lowestWpmAfter(fast.result, 5)).toBeGreaterThan(60);
  });

  it("every skill has three tiers that set up valid tests", () => {
    for (const s of SKILLS) {
      for (const t of [1, 2, 3] as const) {
        const setup = s.setup(t);
        expect(["time", "words"]).toContain(setup.mode.kind);
        expect(s.goals[t].length).toBeGreaterThan(3);
      }
    }
  });
});

describe("daily challenges", () => {
  it("parses rows and evaluates goals", () => {
    const c = parseChallengeRow({
      id: "x",
      day: "2026-10-16",
      title: "Precision",
      description: "",
      rules: { mode: { kind: "words", count: 25 }, punctuation: false, numbers: false, stopOnError: "off" },
      goal: { minAccuracy: 97 },
      reward: { xp: 50 },
      seed: "205536089",
      starts_at: "",
      ends_at: "",
    })!;
    expect(c.seed).toBe(205536089);
    const run = play(c.rules.mode, 180, { mistakeAt: 3 });
    expect(evaluateDaily(c.goal, run.result, true).passed).toBe(run.result.accuracy >= 97);
    expect(parseChallengeRow({ id: "y", day: "", title: "", description: "", rules: { mode: { kind: "time", seconds: 7 } }, goal: {}, reward: {}, seed: 1, starts_at: "", ends_at: "" })).toBeNull();
  });

  it("uses Nepal time (UTC+5:45) for days", () => {
    const t = Date.UTC(2026, 9, 15, 18, 14); // 23:59 in Nepal
    expect(nepalDay(t)).toBe("2026-10-15");
    expect(nepalDay(t + 60_000)).toBe("2026-10-16");
    expect(nepalHour(t)).toBe(23);
    expect(msUntilNextDaily(t)).toBe(60_000);
  });
});

describe("achievements", () => {
  const base: PlayerStats = { runs: 0, daily_passed: 0, skill_tiers: [], lessons: {}, best_streak: 0, streak: 0, owned: [] };

  it("every achievement has a rule and a matching row in the migration", () => {
    const sql = readFileSync("supabase/migrations/20261016020000_challenges.sql", "utf8");
    for (const a of ACHIEVEMENTS) {
      expect(hasRule(a.id), a.id).toBe(true);
      expect(sql).toContain(`('${a.id}', '${a.name.replace(/'/g, "''")}'`);
      expect(sql).toContain(`, ${a.hidden}, ${a.xp}, `);
    }
  });

  it("awards run, lesson and dedication achievements once", () => {
    const run = play({ kind: "words", count: 25 }, 120);
    const earned = newlyEarned({ ...base, runs: 1 }, [{ result: run.result, isPB: true, previousBest: null, at: Date.UTC(2026, 0, 1, 6) }]);
    expect(earned).toEqual(expect.arrayContaining(["first-steps", "wpm-40", "wpm-60", "wpm-80", "flawless"]));
    expect(earned).not.toContain("photo-finish");

    const lessons = Object.fromEntries(LESSONS.filter((l) => l.unit === "home").map((l) => [l.id, 3]));
    expect(newlyEarned({ ...base, lessons })).toContain("home-row-hero");
    expect(newlyEarned({ ...base, lessons, owned: ["home-row-hero"] })).not.toContain("home-row-hero");
    expect(newlyEarned({ ...base, streak: 7 })).toContain("streak-7");
    expect(newlyEarned({ ...base, skill_tiers: SKILLS.map((s) => ({ skill: s.id, tier: 1 })) })).toContain("all-skills");
  });
});
