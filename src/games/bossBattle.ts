import type { TypingEngine } from "@/engine";
import { SimBase, clamp } from "./base";
import type { GameOutcome, GameSim } from "./types";

export interface BossState {
  bossHp: number;
  bossMaxHp: number;
  playerHp: number;
  playerMaxHp: number;
  /** 1–3: the boss gets faster and hits harder as it weakens. */
  phase: 1 | 2 | 3;
  /** 0–1: progress of the boss's next timed attack (for the wind-up bar). */
  charge: number;
  damageDealt: number;
  wordsDone: number;
  /** The Weekly Boss: tougher, faster, different look. */
  weekly: boolean;
}

export interface BossOptions {
  hp: number;
  /** Multiplies the boss's slam and counter damage. */
  damage: number;
  /** Multiplies the time between slams (lower = faster). */
  tempo: number;
  weekly: boolean;
}

const NORMAL: BossOptions = { hp: 2800, damage: 1, tempo: 1, weekly: false };
export const WEEKLY_BOSS: BossOptions = { hp: 4200, damage: 1.25, tempo: 0.88, weekly: true };

const PLAYER_HP = 100;
const ATTACK_EVERY: Record<1 | 2 | 3, number> = { 1: 7000, 2: 5500, 3: 4000 };
const TIMED_DAMAGE: Record<1 | 2 | 3, number> = { 1: 6, 2: 8, 3: 10 };
const ERROR_DAMAGE: Record<1 | 2 | 3, number> = { 1: 3, 2: 4, 3: 5 };

/**
 * Boss Battle: every correct word hits the boss (longer words and combos hit
 * harder). Every mistake lets the boss strike back, and it also attacks on a
 * timer that speeds up through three phases.
 */
export class BossBattleSim extends SimBase implements GameSim<BossState> {
  readonly maxDurationMs = 10 * 60_000;
  readonly state: BossState;
  private nextAttackAt: number;
  private lastAttackAt = 0;
  private readonly opts: BossOptions;

  constructor(engine: TypingEngine, seed: number, opts: BossOptions = NORMAL) {
    super(opts.weekly ? "weekly-boss" : "boss-battle", engine, seed);
    this.opts = opts;
    this.state = {
      bossHp: opts.hp,
      bossMaxHp: opts.hp,
      playerHp: PLAYER_HP,
      playerMaxHp: PLAYER_HP,
      phase: 1,
      charge: 0,
      damageDealt: 0,
      wordsDone: 0,
      weekly: opts.weekly,
    };
    this.nextAttackAt = ATTACK_EVERY[1] * opts.tempo;
    this.listen(
      engine.on("wordComplete", (e) => {
        if (!e.correct || this.over) return;
        // Clean streaks hit harder (up to +50%) and can crit.
        const crit = this.streak >= 5 && this.rng() < 0.2 + Math.min(this.streak, 20) / 100;
        const dmg = Math.round((e.word.length * 9 + 6) * (1 + Math.min(this.streak, 20) / 40) * (crit ? 1.6 : 1));
        const s = this.state;
        s.bossHp = clamp(s.bossHp - dmg, 0, s.bossMaxHp);
        s.damageDealt += dmg;
        s.wordsDone += 1;
        this.emit({ type: "bossHit", damage: dmg, crit, length: e.word.length });
        this.updatePhase();
        if (s.bossHp <= 0) {
          this.emit({ type: "bossDefeated" });
          this.end();
        } else if (engine.getSnapshot().status === "finished") {
          this.end(); // ran out of words
        }
      }),
    );
    this.listen(
      engine.on("error", () => {
        if (this.over) return;
        this.hitPlayer(Math.round(ERROR_DAMAGE[this.state.phase] * this.opts.damage), "counter");
      }),
    );
  }

  private updatePhase(): void {
    const s = this.state;
    const frac = s.bossHp / s.bossMaxHp;
    const phase: 1 | 2 | 3 = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
    if (phase !== s.phase) {
      s.phase = phase;
      this.emit({ type: "phase", phase });
    }
  }

  private hitPlayer(dmg: number, kind: "counter" | "slam"): void {
    const s = this.state;
    s.playerHp = clamp(s.playerHp - dmg, 0, s.playerMaxHp);
    this.emit({ type: "playerHit", damage: dmg, kind });
    if (s.playerHp <= 0) {
      this.emit({ type: "playerDefeated" });
      this.end();
    }
  }

  step(t: number): void {
    this.advance(t, (_dt, now) => {
      const every = ATTACK_EVERY[this.state.phase] * this.opts.tempo;
      this.state.charge = clamp((now - this.lastAttackAt) / every, 0, 1);
      if (now >= this.nextAttackAt) {
        this.lastAttackAt = now;
        this.nextAttackAt = now + every;
        this.hitPlayer(Math.round(TIMED_DAMAGE[this.state.phase] * this.opts.damage), "slam");
      }
    });
  }

  outcome(): GameOutcome {
    const s = this.state;
    const won = s.bossHp <= 0;
    const { durationMs } = this.stats();
    // Faster wins and more HP left score higher.
    const score = won
      ? Math.round((s.weekly ? 8000 : 5000) + s.playerHp * 30 + Math.max(0, 180_000 - durationMs) / 30)
      : Math.round(s.damageDealt * 2);
    return this.outcomeBase({
      score,
      won,
      wordsDone: s.wordsDone,
      summary: won
        ? `Boss defeated in ${(durationMs / 1000).toFixed(1)}s with ${s.playerHp} HP left`
        : `Boss at ${Math.round((s.bossHp / s.bossMaxHp) * 100)}% — ${s.damageDealt} damage dealt`,
    });
  }
}
