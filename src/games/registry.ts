import { KeyKind, type Keystroke, type TypingEngine } from "@/engine";
import { createGameEngine } from "./base";
import { BossBattleSim, WEEKLY_BOSS } from "./bossBattle";
import { createRng } from "@/engine";
import { getModifier } from "@/modifiers/catalog";
import { twistFor } from "./weekly";
import { DuelSim } from "./duel";
import { FallingWordsSim } from "./fallingWords";
import { RACE_WORDS, RacingSim, type GhostTrack } from "./racing";
import type { GameId, GameOutcome, GameSim } from "./types";

export interface GameInfo {
  id: GameId;
  name: string;
  tagline: string;
  howTo: string;
  /** Words generated for one game. */
  words: number;
}

export const GAMES: readonly GameInfo[] = [
  {
    id: "falling-words",
    name: "Falling Words",
    tagline: "Blast words out of the sky before they land.",
    howTo: "Type the lowest word to destroy it. Three words reaching the ground ends the game. It speeds up every 8 words.",
    words: 400,
  },
  {
    id: "boss-battle",
    name: "Boss Battle",
    tagline: "Every word is a hit. Every mistake, it hits back.",
    howTo: "Correct words damage the boss; long words and combos hit harder. Mistakes and its charged slams hurt you.",
    words: 300,
  },
  {
    id: "racing",
    name: "Racing",
    tagline: "Your typing is the engine.",
    howTo: `Type ${RACE_WORDS} words to cross the line. Race three bots, and your own best race as a ghost.`,
    words: RACE_WORDS,
  },
  {
    id: "stickman-duel",
    name: "Stickman Duel",
    tagline: "Every correct word lands a blow. Make it cinematic.",
    howTo: "Short words jab, longer ones kick and uppercut, every 5th clean word is a special. Finish a word just as the rival strikes (watch for the !) to parry. Mistakes open you up to a counter.",
    words: 300,
  },
  {
    id: "weekly-boss",
    name: "Weekly Boss",
    tagline: "One boss, one set of words, everyone. Resets every Monday.",
    howTo: "A tougher boss with a twist that changes every week. Beat it to unlock the Inferno theme and Keeby's crown.",
    words: 400,
  },
];

/** Word-list twist for the Weekly Boss (visual twists like mirror/fog don't touch the words). */
function weeklyTransform(seed: number): ((words: string[]) => string[]) | undefined {
  const twist = twistFor(seed);
  const mod = getModifier(twist);
  if (!mod?.transformText) return undefined;
  const rng = createRng(`weekly-twist:${seed}`);
  return (words) => mod.transformText!(words, rng);
}

export const getGame = (id: string): GameInfo | undefined => GAMES.find((g) => g.id === id);

export type AnySim = GameSim<unknown>;

export interface CreateSimOptions {
  ghost?: GhostTrack;
  now?: () => number;
}

export function createSim(id: GameId, seed: number, opts: CreateSimOptions = {}): AnySim {
  const info = getGame(id);
  if (!info) throw new Error(`unknown game ${id}`);
  const engine: TypingEngine = createGameEngine({
    seed,
    words: info.words,
    now: opts.now,
    transform: id === "weekly-boss" ? weeklyTransform(seed) : undefined,
  });
  switch (id) {
    case "falling-words":
      return new FallingWordsSim(engine, seed);
    case "boss-battle":
      return new BossBattleSim(engine, seed);
    case "racing":
      return new RacingSim(engine, seed, opts.ghost);
    case "stickman-duel":
      return new DuelSim(engine, seed);
    case "weekly-boss":
      return new BossBattleSim(engine, seed, WEEKLY_BOSS);
  }
}

/**
 * Replays a finished game from its seed and keystroke log, headless. Before
 * each keystroke the sim is stepped to that keystroke's time — exactly what
 * the live game does — so the outcome matches what the player saw.
 */
export function replayGame(id: GameId, seed: number, log: readonly Keystroke[]): GameOutcome {
  let clock = 0;
  const sim = createSim(id, seed, { now: () => clock });
  const engine = sim.engine;
  for (const [t, key, kind] of log) {
    if (sim.over) break;
    clock = t;
    sim.step(t);
    if (sim.over) break;
    if (kind === KeyKind.Char) engine.input(key);
    else if (kind === KeyKind.Space) engine.space();
    else if (kind === KeyKind.Backspace) engine.backspace(key === "w");
    else engine.rejectInput(key === "drop" ? "drop" : key === "replace" ? "replace" : "paste");
  }
  // The player stopped typing: let the game play out (words land, the boss attacks…).
  let t = log.length ? (log[log.length - 1]?.[0] ?? 0) : 0;
  while (!sim.over && t < sim.maxDurationMs) {
    t += 1000;
    clock = t;
    sim.step(t);
  }
  const outcome = sim.outcome();
  sim.dispose();
  return outcome;
}
