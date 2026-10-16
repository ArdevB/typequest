import type { RunResult } from "@/engine";
import type { ChallengeSetup, Outcome } from "./types";

export type SkillId = "perfect-run" | "sudden-death" | "speed-gate" | "blind" | "weak-key-hunt" | "marathon";
export type Tier = 1 | 2 | 3;

export const TIER_NAMES: Record<Tier, string> = { 1: "Bronze", 2: "Silver", 3: "Gold" };
export const TIER_XP: Record<Tier, number> = { 1: 25, 2: 50, 3: 100 };

export interface SkillChallenge {
  id: SkillId;
  name: string;
  tagline: string;
  /** Goal for each tier, in words. */
  goals: Record<Tier, string>;
  setup: (tier: Tier) => ChallengeSetup;
  evaluate: (tier: Tier, result: RunResult, finishedNaturally: boolean) => Outcome;
}

const plain = { punctuation: false, numbers: false, stopOnError: "off" as const };
const pct = (n: number) => `${n.toFixed(1)}%`;

/** Lowest cumulative WPM after the grace period, from the per-second samples. */
export function lowestWpmAfter(result: RunResult, graceSec: number): number {
  const samples = result.perSecond.filter((s) => s.t > graceSec);
  return samples.length ? Math.min(...samples.map((s) => s.wpm)) : 0;
}

const PERFECT_WORDS = { 1: 10, 2: 25, 3: 50 } as const;
const SUDDEN_SECONDS = { 1: 15, 2: 30, 3: 60 } as const;
const GATE_WPM = { 1: 40, 2: 60, 3: 80 } as const;
const BLIND_ACC = { 1: 85, 2: 90, 3: 95 } as const;
const HUNT_ACC = { 1: 90, 2: 95, 3: 98 } as const;
const MARATHON_WPM = { 1: 40, 2: 60, 3: 80 } as const;
const GATE_GRACE = 5;

export const SKILLS: readonly SkillChallenge[] = [
  {
    id: "perfect-run",
    name: "Perfect Run",
    tagline: "Not a single mistake.",
    goals: { 1: "10 words, 100% accuracy", 2: "25 words, 100% accuracy", 3: "50 words, 100% accuracy" },
    setup: (t) => ({ mode: { kind: "words", count: PERFECT_WORDS[t] }, ...plain, guard: { failOnError: true } }),
    evaluate: (_t, r, done) =>
      !done ? { passed: false, reason: "A mistake ended the run." }
      : r.accuracy < 100 ? { passed: false, reason: `Accuracy ${pct(r.accuracy)} — needs 100%.` }
      : { passed: true, reason: "Flawless!" },
  },
  {
    id: "sudden-death",
    name: "Sudden Death",
    tagline: "Survive the clock. One slip and it's over.",
    goals: { 1: "15 seconds, no mistakes", 2: "30 seconds, no mistakes", 3: "60 seconds, no mistakes" },
    setup: (t) => ({ mode: { kind: "time", seconds: SUDDEN_SECONDS[t] }, ...plain, guard: { failOnError: true } }),
    evaluate: (_t, r, done) =>
      !done || r.accuracy < 100 ? { passed: false, reason: "A mistake ended the run." }
      : r.wpm < 25 ? { passed: false, reason: "Too slow — keep at least 25 WPM to survive." }
      : { passed: true, reason: "You survived!" },
  },
  {
    id: "speed-gate",
    name: "Speed Gate",
    tagline: "Stay above the line for 30 seconds.",
    goals: { 1: "Hold 40 WPM", 2: "Hold 60 WPM", 3: "Hold 80 WPM" },
    setup: (t) => ({
      mode: { kind: "time", seconds: 30 },
      ...plain,
      guard: { gateWpm: GATE_WPM[t], gateGraceSec: GATE_GRACE },
    }),
    evaluate: (t, r, done) => {
      const low = lowestWpmAfter(r, GATE_GRACE);
      if (!done || low < GATE_WPM[t]) return { passed: false, reason: `Dropped to ${Math.round(low)} WPM — the gate is ${GATE_WPM[t]}.` };
      if (r.accuracy < 90) return { passed: false, reason: `Accuracy ${pct(r.accuracy)} — needs 90%.` };
      return { passed: true, reason: "Through the gate!" };
    },
  },
  {
    id: "blind",
    name: "Blind Mode",
    tagline: "No colors, no error sounds. Trust your fingers.",
    goals: { 1: "85% accuracy", 2: "90% accuracy", 3: "95% accuracy" },
    setup: () => ({ mode: { kind: "time", seconds: 30 }, ...plain, guard: { blind: true } }),
    evaluate: (t, r, done) =>
      !done ? { passed: false, reason: "The run wasn't finished." }
      : r.accuracy < BLIND_ACC[t] ? { passed: false, reason: `Accuracy ${pct(r.accuracy)} — needs ${BLIND_ACC[t]}%.` }
      : r.wpm < 20 ? { passed: false, reason: "Type at least 20 WPM." }
      : { passed: true, reason: "You didn't need to look!" },
  },
  {
    id: "weak-key-hunt",
    name: "Weak Key Hunt",
    tagline: "Words packed with your trickiest keys.",
    goals: { 1: "90% accuracy", 2: "95% accuracy", 3: "98% accuracy" },
    setup: () => ({ mode: { kind: "words", count: 25 }, ...plain, guard: { adaptive: true } }),
    evaluate: (t, r, done) =>
      !done ? { passed: false, reason: "The run wasn't finished." }
      : r.accuracy < HUNT_ACC[t] ? { passed: false, reason: `Accuracy ${pct(r.accuracy)} — needs ${HUNT_ACC[t]}%.` }
      : { passed: true, reason: "Weak keys tamed." },
  },
  {
    id: "marathon",
    name: "Marathon",
    tagline: "Two minutes. Keep the pace and the accuracy.",
    goals: { 1: "40 WPM at 94%+", 2: "60 WPM at 94%+", 3: "80 WPM at 94%+" },
    setup: () => ({ mode: { kind: "time", seconds: 120 }, ...plain, guard: {} }),
    evaluate: (t, r, done) =>
      !done ? { passed: false, reason: "The run wasn't finished." }
      : r.accuracy < 94 ? { passed: false, reason: `Accuracy ${pct(r.accuracy)} — needs 94%.` }
      : r.wpm < MARATHON_WPM[t] ? { passed: false, reason: `${Math.round(r.wpm)} WPM — needs ${MARATHON_WPM[t]}.` }
      : { passed: true, reason: "Marathon complete!" },
  },
];

const BY_ID = new Map<string, SkillChallenge>(SKILLS.map((s) => [s.id, s]));
export const getSkill = (id: string): SkillChallenge | undefined => BY_ID.get(id);
export const isTier = (n: number): n is Tier => n === 1 || n === 2 || n === 3;
