import type { TypingEngine } from "@/engine";
import type { GhostTrack } from "./racing";
import { createSim, type AnySim } from "./registry";
import type { GameId } from "./types";

export interface LiveGame {
  sim: AnySim;
  /** Pass this (not sim.engine) to attachInput: it steps the sim to each keystroke's exact time first. */
  input: TypingEngine;
  /** Call every animation frame. */
  tick(): void;
  /** Game time in ms (0 until the first keystroke). */
  time(): number;
  started(): boolean;
}

/**
 * Runs a game sim in real time. Keystrokes are stamped with the same clock
 * the sim is stepped to, so the live game and a server replay of its log play
 * out identically (see replayGame).
 */
export function startLiveGame(
  id: GameId,
  seed: number,
  opts: { ghost?: GhostTrack; clock?: () => number } = {},
): LiveGame {
  const clock = opts.clock ?? (() => performance.now());
  let frozen: number | null = null;
  let startAt: number | null = null;
  const sim = createSim(id, seed, { ghost: opts.ghost, now: () => frozen ?? clock() });
  const engine = sim.engine;
  engine.on("start", ({ at }) => {
    startAt = at;
  });

  const gameTime = (abs: number) => (startAt === null ? 0 : Math.round(abs - startAt));

  const wrap =
    <A extends unknown[]>(fn: (...args: A) => void) =>
    (...args: A) => {
      if (sim.over) return;
      frozen = clock();
      if (startAt !== null) sim.step(gameTime(frozen));
      if (!sim.over) fn(...args);
      frozen = null;
    };

  const input: TypingEngine = {
    ...engine,
    input: wrap((c: string) => engine.input(c)),
    space: wrap(() => engine.space()),
    backspace: wrap((w?: boolean) => engine.backspace(w)),
    rejectInput: wrap((r: "paste" | "drop" | "replace") => engine.rejectInput(r)),
  };

  return {
    sim,
    input,
    tick() {
      if (startAt !== null && !sim.over) sim.step(gameTime(clock()));
    },
    time: () => (startAt === null ? 0 : gameTime(clock())),
    started: () => startAt !== null,
  };
}
