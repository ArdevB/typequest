import { createRng, createTypingEngine, wordSource, wpmFrom, type TypingEngine } from "@/engine";
import { STEP_MS, type GameFx, type GameId, type GameOutcome } from "./types";

export interface GameEngineOptions {
  seed: number;
  words: number;
  /** Injected clock (replays); defaults to performance.now. */
  now?: () => number;
  /** Rewrites the word list (Weekly Boss twists). Must be deterministic. */
  transform?: (words: string[]) => string[];
}

/**
 * The engine every game uses: a fixed list of seeded words in text mode, with
 * wrong letters rejected (stopOnError "letter") so a word is either being
 * typed correctly or not at all.
 */
export function createGameEngine(o: GameEngineOptions): TypingEngine {
  const base = wordSource({ seed: o.seed }).take(o.words);
  const words = o.transform ? o.transform(base) : base;
  return createTypingEngine({
    mode: { kind: "text", text: words.join(" ") },
    source: wordSource({ seed: o.seed }),
    stopOnError: "letter",
    allowBackspaceToPrevWord: false,
    autoTick: false,
    now: o.now,
  });
}

/** Shared plumbing for sims: fixed-step clock, fx queue, seeded rng, engine stats. */
export class SimBase {
  readonly rng: () => number;
  protected time = 0;
  private fx: GameFx[] = [];
  private offs: (() => void)[] = [];
  over = false;
  /** Correct words in a row (a mistake resets it). Updated before subclass listeners run. */
  protected streak = 0;

  constructor(
    readonly id: GameId,
    readonly engine: TypingEngine,
    seed: number,
  ) {
    // Separate stream from the word generator so gameplay randomness never shifts the words.
    this.rng = createRng(`${id}:${seed}`);
    this.listen(
      engine.on("wordComplete", (e) => {
        this.streak = e.correct ? this.streak + 1 : 0;
      }),
    );
    this.listen(
      engine.on("error", () => {
        this.streak = 0;
      }),
    );
  }

  /** Runs `tick(dtSeconds, now)` once per fixed step up to game time t. */
  protected advance(t: number, tick: (dt: number, now: number) => void): void {
    while (!this.over && this.time + STEP_MS <= t) {
      this.time += STEP_MS;
      tick(STEP_MS / 1000, this.time);
    }
  }

  protected listen(off: () => void): void {
    this.offs.push(off);
  }

  protected emit(fx: Omit<GameFx, "t">): void {
    this.fx.push({ ...fx, t: this.time } as GameFx);
    if (this.fx.length > 200) this.fx.splice(0, this.fx.length - 200);
  }

  drainFx(): GameFx[] {
    const out = this.fx;
    this.fx = [];
    return out;
  }

  protected end(): void {
    if (this.over) return;
    this.over = true;
    this.engine.finish();
  }

  /** WPM/accuracy from the keystrokes so far, over the game's duration. */
  protected stats(): { wpm: number; accuracy: number; durationMs: number } {
    const hits = this.engine.getHits();
    const correct = hits.filter((h) => h.correct).length;
    const durationMs = Math.max(1, this.time);
    return {
      wpm: Math.round(wpmFrom(correct, durationMs) * 10) / 10,
      accuracy: hits.length ? Math.round((correct / hits.length) * 1000) / 10 : 0,
      durationMs: Math.round(this.time),
    };
  }

  protected outcomeBase(extra: Omit<GameOutcome, "game" | "wpm" | "accuracy" | "durationMs">): GameOutcome {
    return { game: this.id, ...this.stats(), ...extra };
  }

  dispose(): void {
    this.offs.forEach((off) => off());
    this.offs = [];
  }
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
