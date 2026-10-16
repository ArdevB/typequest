/**
 * Challenge modifier contract (implemented in Phase 6: Mirror, Fog, Shaky,
 * Heat timer, Random case…). Modifiers are stackable: text transforms run in
 * order and score multipliers multiply.
 */
import type { EngineEvents, TypingEngine } from "@/engine";

export interface ModifierContext {
  root: HTMLElement;
  reducedMotion: boolean;
  rng: () => number;
}

export interface ChallengeModifier {
  id: string;
  name: string;
  description: string;
  /** e.g. 1.2 → +20% score. Stacked modifiers multiply. */
  scoreMultiplier: number;
  /** Change the target words before the run starts (e.g. random case). */
  transformText?(words: readonly string[], rng: () => number): string[];
  /** React to a mistake (e.g. Sudden Death ends the run). */
  onError?(event: EngineEvents["error"], engine: TypingEngine): void;
  /** Attach visual effects (fog, mirror, shake). Returns cleanup. */
  renderEffect?(engine: TypingEngine, ctx: ModifierContext): () => void;
}

export const stackMultiplier = (mods: readonly ChallengeModifier[]): number =>
  mods.reduce((m, mod) => m * mod.scoreMultiplier, 1);

export const applyTransforms = (
  words: readonly string[],
  mods: readonly ChallengeModifier[],
  rng: () => number,
): string[] => mods.reduce<string[]>((w, mod) => (mod.transformText ? mod.transformText(w, rng) : w), [...words]);
