import { describe, expect, it } from "vitest";
import { createRng } from "@/engine";
import type { BossState } from "./bossBattle";
import type { DuelState } from "./duel";
import type { FallingState } from "./fallingWords";
import { startLiveGame } from "./live";
import type { RaceState } from "./racing";
import { GAMES, replayGame } from "./registry";
import type { GameId } from "./types";

/**
 * Plays a game "live" with a fake clock: random frame times, a typist at
 * `msPerKey` who makes a mistake now and then and stops after `maxKeys`.
 */
function playLive(id: GameId, seed: number, msPerKey: number, opts: { errorRate?: number; maxKeys?: number } = {}) {
  let now = 1000;
  const game = startLiveGame(id, seed, { clock: () => now });
  const rng = createRng(seed + 99);
  const engine = game.sim.engine;
  let keys = 0;
  while (!game.sim.over && now < 1000 + game.sim.maxDurationMs) {
    // A few animation frames between keystrokes.
    const until = now + msPerKey * (0.6 + rng() * 0.8);
    while (now < until) {
      now += 10 + rng() * 12;
      game.tick();
    }
    if (game.sim.over) break;
    if (keys >= (opts.maxKeys ?? Infinity)) continue;
    const snap = engine.getSnapshot();
    const word = snap.words[snap.wordIndex] ?? "";
    const typed = engine.getTyped(snap.wordIndex);
    if (rng() < (opts.errorRate ?? 0.03)) game.input.input("#");
    else if (typed.length >= word.length) game.input.space();
    else game.input.input(word[typed.length] ?? "x");
    keys += 1;
  }
  return { outcome: game.sim.outcome(), log: [...engine.getLog()], state: game.sim.state };
}

describe("games are deterministic: live play == server replay", () => {
  for (const g of GAMES) {
    it(`${g.id}`, () => {
      const live = playLive(g.id, 4242, 170, { maxKeys: 260 });
      const replayed = replayGame(g.id, 4242, live.log);
      expect(replayed).toEqual(live.outcome);
    });
  }
});

describe("game rules", () => {
  it("Falling Words: a fast typist survives longer than an idle one", () => {
    const idle = playLive("falling-words", 1, 200, { maxKeys: 5 });
    expect(idle.outcome.won).toBe(false);
    expect((idle.state as FallingState).lives).toBe(0);
    const fast = playLive("falling-words", 1, 110, { maxKeys: 400 });
    expect(fast.outcome.score).toBeGreaterThan(idle.outcome.score);
    expect(fast.outcome.wordsDone).toBeGreaterThan(30);
  });

  it("Boss Battle: a quick, accurate typist beats the boss", () => {
    const r = playLive("boss-battle", 7, 120, { errorRate: 0.01 });
    expect(r.outcome.won).toBe(true);
    expect((r.state as BossState).bossHp).toBe(0);
  });

  it("Boss Battle: mistakes and idling lose", () => {
    const r = playLive("boss-battle", 7, 400, { errorRate: 0.3, maxKeys: 100 });
    expect(r.outcome.won).toBe(false);
    expect((r.state as BossState).playerHp).toBe(0);
  });

  it("Racing: a 90 WPM typist beats every bot", () => {
    const r = playLive("racing", 3, 130, { errorRate: 0 });
    const s = r.state as RaceState;
    expect(s.place).toBe(1);
    expect(r.outcome.won).toBe(true);
  });

  it("Stickman Duel: ends in a KO", () => {
    const r = playLive("stickman-duel", 5, 140, { errorRate: 0.02 });
    expect((r.state as DuelState).stage).toBe("ko");
    expect(r.outcome.won).toBe(true);
  });
});

describe("race share links", async () => {
  const { encodeRace, decodeRace } = await import("./share");
  it("round-trips a race", () => {
    const points: [number, number][] = [[0, 0], [500, 0.04], [1000, 0.1], [23400, 1]];
    const code = encodeRace({ seed: 123456, name: "Ardev ✨", points });
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    const r = decodeRace(code)!;
    expect(r.seed).toBe(123456);
    expect(r.name).toBe("Ardev ✨");
    expect(r.finishMs).toBe(23400);
    expect(r.track.points).toEqual(points);
  });
  it("rejects junk", () => {
    expect(decodeRace("not-a-race")).toBeNull();
    expect(decodeRace("")).toBeNull();
  });
});

describe("weekly boss", async () => {
  const { weekKey, weeklySeed, isWeeklySeed, msUntilWeeklyReset, twistFor } = await import("./weekly");
  const { replayGame, createSim } = await import("./registry");
  it("weeks change on Monday, Nepal time", () => {
    // Sunday 2026-10-18 23:00 NPT = 17:15 UTC; Monday 00:00 NPT = 18:15 UTC Sunday.
    const sunLate = Date.UTC(2026, 9, 18, 17, 15);
    const monEarly = Date.UTC(2026, 9, 18, 18, 20);
    expect(weekKey(sunLate)).toBe("2026-W42");
    expect(weekKey(monEarly)).toBe("2026-W43");
    expect(weeklySeed(sunLate)).not.toBe(weeklySeed(monEarly));
    expect(isWeeklySeed(weeklySeed(sunLate), monEarly)).toBe(true);
    expect(msUntilWeeklyReset(sunLate)).toBe(60 * 60 * 1000);
  });
  it("the twist is part of the replayed words", () => {
    let seed = 1;
    while (twistFor(seed) !== "reverse") seed++;
    const sim = createSim("weekly-boss", seed);
    const plain = createSim("boss-battle", seed);
    expect(sim.engine.getWords()[0]).toBe([...(plain.engine.getWords()[0] ?? "")].reverse().join(""));
    const o = replayGame("weekly-boss", seed, []);
    expect(o.game).toBe("weekly-boss");
  });
});
