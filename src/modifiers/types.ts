/**
 * Challenge modifier contract. Modifiers are stackable plugins: text
 * transforms run in order, error hooks and visual effects all attach, and
 * score multipliers multiply. They never change the engine's rules directly.
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
  /** Short symbol for the card. */
  icon: string;
  /** Moves things on screen; hidden when reduced motion is on. */
  motion?: boolean;
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
