import type { TypingEngine } from "@/engine";
import { SimBase } from "./base";
import type { GameOutcome, GameSim } from "./types";

export interface FallingWord {
  /** Index in the engine's word list (typing order). */
  index: number;
  text: string;
  /** 0–1 across the play field. */
  x: number;
  /** 0 = top, 1 = ground. */
  y: number;
  state: "falling" | "destroyed" | "crashed";
}

export interface FallingState {
  words: FallingWord[];
  lives: number;
  score: number;
  level: number;
  destroyed: number;
  /** Fall speed in field-heights per second. */
  speed: number;
  multiplier: number;
}

const START_LIVES = 3;
const WORDS_PER_LEVEL = 8;

const speedFor = (level: number) => 0.055 + (level - 1) * 0.011;
const intervalFor = (level: number) => Math.max(650, 2300 - (level - 1) * 180);

/**
 * Falling Words: words drop from the sky in typing order; finishing a word
 * destroys it. If the oldest word reaches the ground you lose a life and it's
 * skipped. Every word falls at the same (rising) speed, so the oldest word is
 * always the lowest — the one you're typing.
 */
export class FallingWordsSim extends SimBase implements GameSim<FallingState> {
  readonly maxDurationMs = 15 * 60_000;
  readonly state: FallingState = { words: [], lives: START_LIVES, score: 0, level: 1, destroyed: 0, speed: speedFor(1), multiplier: 1 };
  private nextSpawnAt = 0;
  private spawned = 0;

  constructor(engine: TypingEngine, seed: number) {
    super("falling-words", engine, seed);
    // The first two words are already on screen, waiting for the first keystroke.
    this.spawn(0.18);
    this.spawn(0.02);
    this.nextSpawnAt = intervalFor(1) * 0.6;

    this.listen(
      engine.on("wordComplete", (e) => {
        const w = this.state.words.find((x) => x.index === e.wordIndex && x.state === "falling");
        if (!w) return;
        if (!e.correct) return; // skipped words are handled where they crash
        w.state = "destroyed";
        this.state.destroyed += 1;
        // ×1.5 after 5 clean words in a row, ×2 after 10, up to ×3.
        this.state.multiplier = Math.min(3, 1 + Math.floor(this.streak / 5) * 0.5);
        const points = Math.round(e.word.length * 10 * this.state.multiplier);
        this.state.score += points;
        this.state.level = 1 + Math.floor(this.state.destroyed / WORDS_PER_LEVEL);
        this.emit({ type: "destroy", index: w.index, x: w.x, y: w.y, points });
        if (engine.getSnapshot().status === "finished") this.end();
      }),
    );
    this.listen(engine.on("correct", (e) => this.emit({ type: "shot", index: e.wordIndex })));
    this.listen(engine.on("error", () => this.emit({ type: "miss" })));
  }

  private spawn(y = 0): void {
    const words = this.engine.getWords();
    if (this.spawned >= words.length) return;
    const text = words[this.spawned] ?? "";
    // Keep long words inside the field.
    const margin = 0.06 + Math.min(0.2, text.length * 0.012);
    this.state.words.push({ index: this.spawned, text, x: margin + this.rng() * (1 - 2 * margin), y, state: "falling" });
    this.spawned += 1;
  }

  step(t: number): void {
    this.advance(t, (dt, now) => {
      const s = this.state;
      s.speed = speedFor(s.level);
      const active = this.engine.getSnapshot().wordIndex;

      // Never let the player run out of targets.
      if (active >= this.spawned || now >= this.nextSpawnAt) {
        this.spawn();
        this.nextSpawnAt = now + intervalFor(s.level);
      }

      for (const w of s.words) {
        if (w.state !== "falling") continue;
        w.y += s.speed * dt;
        if (w.y >= 1) {
          w.state = "crashed";
          s.lives -= 1;
          this.emit({ type: "crash", index: w.index, x: w.x });
          if (w.index === this.engine.getSnapshot().wordIndex) this.engine.skipWord();
          if (s.lives <= 0) {
            this.end();
            return;
          }
        }
      }
      // Forget old wrecks.
      if (s.words.length > 60) s.words = s.words.filter((w) => w.state === "falling" || w.index > active - 10);
    });
  }

  outcome(): GameOutcome {
    const s = this.state;
    return this.outcomeBase({
      score: s.score,
      won: s.lives > 0,
      wordsDone: s.destroyed,
      summary: `${s.destroyed} words destroyed · level ${s.level}`,
    });
  }
}
