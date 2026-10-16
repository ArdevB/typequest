import { z } from "zod";
import type { RunResult, StopOnError } from "@/engine";

/** Test settings shared by daily and skill challenges (time/words only). */
export const challengeModeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("time"), seconds: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(120)]) }),
  z.object({ kind: z.literal("words"), count: z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)]) }),
]);
export type ChallengeMode = z.infer<typeof challengeModeSchema>;

export const challengeRulesSchema = z.object({
  mode: challengeModeSchema,
  punctuation: z.boolean().default(false),
  numbers: z.boolean().default(false),
  stopOnError: z.enum(["off", "letter", "word"]).default("off"),
});
export type ChallengeRules = z.infer<typeof challengeRulesSchema>;

export const challengeGoalSchema = z.object({ minAccuracy: z.number().min(0).max(100).optional() });
export type ChallengeGoal = z.infer<typeof challengeGoalSchema>;

/**
 * Live rules applied while typing (client) and checked again on the server
 * through `evaluate`. The live part only ends a run early; the evaluation is
 * what decides pass/fail.
 */
export interface Guard {
  /** End the run on the first mistake. */
  failOnError?: boolean;
  /** Keep cumulative WPM at or above this after `gateGraceSec` seconds. */
  gateWpm?: number;
  gateGraceSec?: number;
  /** Hide whether characters were right or wrong. */
  blind?: boolean;
  /** Words weighted toward the player's weakest keys. */
  adaptive?: boolean;
}

export interface Outcome {
  passed: boolean;
  /** Short explanation shown on the results screen. */
  reason: string;
}

export interface ChallengeSetup extends ChallengeRules {
  guard: Guard;
}

export type Evaluate = (result: RunResult, finishedNaturally: boolean) => Outcome;

export const isStopOnError = (v: string): v is StopOnError => v === "off" || v === "letter" || v === "word";
