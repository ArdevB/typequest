import type { TypingEngine } from "@/engine";
import { SimBase, clamp } from "./base";
import type { GameOutcome, GameSim } from "./types";

/** A recorded run to race against: progress (0–1) at points in time. */
export interface GhostTrack {
  name: string;
  /** [ms, progress 0–1], increasing. */
  points: readonly (readonly [number, number])[];
}

export interface Racer {
  id: string;
  name: string;
  kind: "player" | "bot" | "ghost";
  /** 0–1 along the track. */
  progress: number;
  finishedAt: number | null;
  wpm: number;
}

export interface RaceState {
  racers: Racer[];
  totalChars: number;
  /** Player's finishing place (1-based) once finished. */
  place: number | null;
}

export const RACE_WORDS = 30;
const BOT_WPM = [38, 56, 74] as const;
const BOT_NAMES = ["Rookie", "Cruiser", "Turbo"] as const;

/** Progress along a ghost track at time t (linear between samples). */
export function ghostProgress(track: GhostTrack, t: number): number {
  const pts = track.points;
  if (pts.length === 0) return 0;
  if (t <= (pts[0]?.[0] ?? 0)) return pts[0]?.[1] ?? 0;
  for (let i = 1; i < pts.length; i++) {
    const [t1, p1] = pts[i]!;
    if (t <= t1) {
      const [t0, p0] = pts[i - 1]!;
      return p0 + ((p1 - p0) * (t - t0)) / Math.max(1, t1 - t0);
    }
  }
  return pts[pts.length - 1]![1];
}

/**
 * Racing: your typing drives your car. Bots drive at steady speeds (with a
 * little seeded wobble) and an optional ghost replays one of your earlier
 * races. Ghosts are display-only: placement for scoring is against bots.
 */
export class RacingSim extends SimBase implements GameSim<RaceState> {
  readonly maxDurationMs = 6 * 60_000;
  readonly state: RaceState;
  private readonly charsBefore: number[] = [];
  private readonly ghost?: GhostTrack;
  private readonly wobble: number[];
  /** Player progress samples for saving this race as a future ghost. */
  readonly trace: [number, number][] = [[0, 0]];

  constructor(engine: TypingEngine, seed: number, ghost?: GhostTrack) {
    super("racing", engine, seed);
    const words = engine.getWords();
    let acc = 0;
    for (const w of words) {
      this.charsBefore.push(acc);
      acc += w.length + 1;
    }
    const totalChars = acc - 1;
    this.ghost = ghost;
    this.wobble = BOT_WPM.map(() => 0.9 + this.rng() * 0.2);
    this.state = {
      totalChars,
      place: null,
      racers: [
        { id: "you", name: "You", kind: "player", progress: 0, finishedAt: null, wpm: 0 },
        ...BOT_WPM.map((wpm, i) => ({
          id: `bot${i}`,
          name: BOT_NAMES[i] ?? "Bot",
          kind: "bot" as const,
          progress: 0,
          finishedAt: null,
          wpm: Math.round(wpm * (this.wobble[i] ?? 1)),
        })),
        ...(ghost ? [{ id: "ghost", name: ghost.name, kind: "ghost" as const, progress: 0, finishedAt: null, wpm: 0 }] : []),
      ],
    };
    this.listen(engine.on("wordComplete", () => this.emit({ type: "word" })));
    this.listen(engine.on("error", () => this.emit({ type: "skid" })));
  }

  private playerProgress(): number {
    const snap = this.engine.getSnapshot();
    if (snap.status === "finished") return 1;
    const typed = this.engine.getTyped(snap.wordIndex).length;
    return clamp(((this.charsBefore[snap.wordIndex] ?? 0) + typed) / this.state.totalChars, 0, 1);
  }

  step(t: number): void {
    this.advance(t, (_dt, now) => {
      const s = this.state;
      for (const r of s.racers) {
        if (r.finishedAt !== null) continue;
        if (r.kind === "player") {
          r.progress = this.playerProgress();
          const minutes = now / 60000;
          r.wpm = minutes > 0 ? Math.round((r.progress * s.totalChars) / 5 / minutes) : 0;
        } else if (r.kind === "bot") {
          // Slight pace changes so bots don't look robotic.
          const surge = 1 + 0.06 * Math.sin(now / 1700 + r.wpm);
          r.progress = clamp(r.progress + (((r.wpm * 5) / 60000) * (1000 / 60) * surge) / s.totalChars, 0, 1);
        } else if (this.ghost) {
          r.progress = clamp(ghostProgress(this.ghost, now), 0, 1);
        }
        if (r.progress >= 1) {
          r.progress = 1;
          r.finishedAt = now;
          this.emit({ type: "finish", racer: r.id });
          if (r.kind === "player") {
            s.place = 1 + s.racers.filter((o) => o.kind === "bot" && o.finishedAt !== null && o.finishedAt < now).length;
            this.end();
          }
        }
      }
      const last = this.trace[this.trace.length - 1];
      if (!last || now - last[0] >= 500) this.trace.push([Math.round(now), Math.round(this.playerProgress() * 1000) / 1000]);
    });
  }

  outcome(): GameOutcome {
    const s = this.state;
    const place = s.place;
    const { wpm, accuracy } = this.stats();
    const finished = place !== null;
    return this.outcomeBase({
      score: finished ? Math.round(wpm * 10 * (accuracy / 100) + (5 - place) * 100) : Math.round(wpm * 5),
      won: place === 1,
      wordsDone: this.engine.getSnapshot().wordIndex,
      summary: finished ? `Finished ${["1st", "2nd", "3rd", "4th"][place - 1] ?? `${place}th`} at ${Math.round(wpm)} WPM` : "Did not finish",
    });
  }
}
