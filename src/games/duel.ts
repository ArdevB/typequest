import type { TypingEngine } from "@/engine";
import { SimBase, clamp } from "./base";
import type { GameOutcome, GameSim } from "./types";

export type DuelMove = "jab" | "kick" | "uppercut" | "spin" | "finisher";

export interface DuelState {
  playerHp: number;
  rivalHp: number;
  maxHp: number;
  rivalMaxHp: number;
  /** Consecutive correct words (drives the special move). */
  chain: number;
  /** 0–1 wind-up of the rival's next timed attack. */
  rivalCharge: number;
  wordsDone: number;
  /** "intro" before the first keystroke, then "fight", then "ko". */
  stage: "intro" | "fight" | "ko";
  winner: "player" | "rival" | null;
  parries: number;
}

const MAX_HP = 100;
/** The rival takes ~25 words to put down: long enough for a proper fight scene. */
const RIVAL_HP = 240;
const RIVAL_EVERY = 5200;
const RIVAL_DAMAGE = 7;
const COUNTER_DAMAGE = 5;
const SPECIAL_EVERY = 5;
/** Finish a word this close (ms) before the rival's strike lands and you parry it. */
export const PARRY_WINDOW = 450;
const PARRY_DAMAGE = 9;

/** Which move a word turns into: longer words hit harder; every 5th word in a row is a special. */
export function moveFor(length: number, chain: number): DuelMove {
  if (chain > 0 && chain % SPECIAL_EVERY === 0) return "spin";
  if (length <= 3) return "jab";
  if (length <= 5) return "kick";
  return "uppercut";
}

const DAMAGE: Record<DuelMove, number> = { jab: 5, kick: 8, uppercut: 11, spin: 16, finisher: 0 };

/**
 * Stickman Duel: two stick fighters, one fight. Each correct word is one of
 * your moves landing; mistakes let the rival counter, and the rival also
 * attacks on a timer. The blow that empties a health bar is the finisher
 * (shown in slow motion).
 */
export class DuelSim extends SimBase implements GameSim<DuelState> {
  readonly maxDurationMs = 8 * 60_000;
  readonly state: DuelState = {
    playerHp: MAX_HP,
    rivalHp: RIVAL_HP,
    maxHp: MAX_HP,
    rivalMaxHp: RIVAL_HP,
    chain: 0,
    rivalCharge: 0,
    wordsDone: 0,
    stage: "intro",
    winner: null,
    parries: 0,
  };
  private lastCorrectAt = -Infinity;
  private nextRivalAt = RIVAL_EVERY;
  private lastRivalAt = 0;

  constructor(engine: TypingEngine, seed: number) {
    super("stickman-duel", engine, seed);
    this.listen(
      engine.on("start", () => {
        this.state.stage = "fight";
      }),
    );
    this.listen(
      engine.on("wordComplete", (e) => {
        if (!e.correct || this.over) return;
        const s = this.state;
        s.chain = this.streak;
        s.wordsDone += 1;
        this.lastCorrectAt = this.time;
        let move = moveFor(e.word.length, s.chain);
        const dmg = Math.round(DAMAGE[move] * (1 + Math.min(s.chain, 20) / 40));
        s.rivalHp = clamp(s.rivalHp - dmg, 0, RIVAL_HP);
        if (s.rivalHp <= 0) move = "finisher";
        this.emit({ type: "playerAttack", move, damage: dmg });
        if (s.rivalHp <= 0) this.ko("player");
        else if (engine.getSnapshot().status === "finished") this.ko(s.playerHp >= s.rivalHp ? "player" : "rival");
      }),
    );
    this.listen(
      engine.on("error", () => {
        if (this.over) return;
        this.state.chain = 0;
        this.hitPlayer(COUNTER_DAMAGE, "counter");
      }),
    );
  }

  private hitPlayer(dmg: number, kind: "counter" | "attack"): void {
    const s = this.state;
    s.playerHp = clamp(s.playerHp - dmg, 0, MAX_HP);
    this.emit({ type: "rivalAttack", kind, damage: dmg, finisher: s.playerHp <= 0 });
    if (s.playerHp <= 0) this.ko("rival");
  }

  /** A word finished just as the rival struck: the blow is turned aside and punished. */
  private parry(): void {
    const s = this.state;
    s.parries += 1;
    s.rivalHp = clamp(s.rivalHp - PARRY_DAMAGE, 0, RIVAL_HP);
    this.emit({ type: "parry", damage: PARRY_DAMAGE, finisher: s.rivalHp <= 0 });
    if (s.rivalHp <= 0) this.ko("player");
  }

  private ko(winner: "player" | "rival"): void {
    this.state.stage = "ko";
    this.state.winner = winner;
    this.emit({ type: "ko", winner });
    this.end();
  }

  step(t: number): void {
    this.advance(t, (_dt, now) => {
      this.state.rivalCharge = clamp((now - this.lastRivalAt) / RIVAL_EVERY, 0, 1);
      if (now >= this.nextRivalAt) {
        this.lastRivalAt = now;
        this.nextRivalAt = now + RIVAL_EVERY;
        if (now - this.lastCorrectAt <= PARRY_WINDOW) this.parry();
        else this.hitPlayer(RIVAL_DAMAGE, "attack");
      }
    });
  }

  outcome(): GameOutcome {
    const s = this.state;
    const won = s.winner === "player";
    const { durationMs } = this.stats();
    return this.outcomeBase({
      score: won ? Math.round(3000 + s.playerHp * 25 + Math.max(0, 120_000 - durationMs) / 40) : Math.round(((RIVAL_HP - s.rivalHp) / RIVAL_HP) * 2000),
      won,
      wordsDone: s.wordsDone,
      summary: won ? `K.O.! You won with ${s.playerHp} HP left` : `Knocked out — rival at ${s.rivalHp} HP`,
    });
  }
}
