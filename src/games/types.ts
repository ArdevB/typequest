import type { TypingEngine } from "@/engine";

export type GameId = "falling-words" | "boss-battle" | "racing" | "stickman-duel" | "weekly-boss";

/** One-off visual events a sim emits for its renderer (hits, explosions, KOs). */
export interface GameFx {
  type: string;
  /** Game time (ms) when it happened. */
  t: number;
  /** Optional details (target index, damage, crit…). */
  [key: string]: unknown;
}

export interface GameOutcome {
  game: GameId;
  score: number;
  won: boolean;
  wpm: number;
  accuracy: number;
  durationMs: number;
  wordsDone: number;
  /** Short line for the results screen. */
  summary: string;
}

/**
 * A game simulation: pure TS on top of the typing engine. It advances in
 * fixed 1/60s steps driven only by game time and engine events, so the same
 * seed and keystroke log always produce the same game — in the browser and
 * when the server replays it to award XP.
 *
 * Game time is the engine's clock: it starts at the first keystroke.
 */
export interface GameSim<S> {
  readonly id: GameId;
  readonly engine: TypingEngine;
  readonly state: S;
  /** Advance to game time `t` (ms). Call with increasing values. */
  step(t: number): void;
  readonly over: boolean;
  outcome(): GameOutcome;
  /** Visual events since the last drain (renderers only). */
  drainFx(): GameFx[];
  /** Hard cap on game length, for replays of abandoned games. */
  readonly maxDurationMs: number;
  dispose(): void;
}

export const STEP_MS = 1000 / 60;
