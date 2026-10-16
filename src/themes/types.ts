import type { TypingEngine } from "@/engine";
import type { ParticleLayer } from "@/lib/particles";
import type { SoundPackId, SoundPlayer } from "@/lib/sound";

export type ThemeId = "neon-cyber" | "minimal-calm" | "retro-arcade" | "space-shooter" | "inferno";

export interface ThemeColors {
  bg: string;
  bgAlt: string;
  surface: string;
  border: string;
  text: string;
  sub: string;
  main: string;
  caret: string;
  error: string;
  errorExtra: string;
  /** Error color used when the colorblind-safe palette is on (paired with underlines). */
  errorCb: string;
  combo1: string;
  combo2: string;
  combo3: string;
  glow: string;
}

export interface ParticleConfig {
  colors: readonly string[];
  /** Small sparks at the caret while a combo is running. */
  trail: boolean;
}

/** Plain data: safe to serialize into the page for the pre-paint theme script. */
export interface ThemeConfig {
  id: ThemeId;
  name: string;
  description: string;
  dark: boolean;
  colors: ThemeColors;
  font: { ui: string; mono: string; display: string };
  renderer: "dom" | "pixi";
  /** Default key-sound pack for this theme (the user can override it). */
  sounds: SoundPackId;
  particles: ParticleConfig | null;
  /** Background music track; none ship in Phase 1. */
  music: string | null;
  caret: "line" | "block" | "underline";
}

export interface EffectsContext {
  /** Typing surface root. Effects may set data-attributes/classes on it. */
  root: HTMLElement;
  /** Element that shakes on big combos. */
  stage: HTMLElement;
  /** Caret position relative to `root`. */
  getCaretPoint(): { x: number; y: number } | null;
  particles: ParticleLayer | null;
  sound: SoundPlayer;
  comboEl: HTMLElement | null;
  reducedMotion: boolean;
  config: ThemeConfig;
}

/** Subscribes to engine events and renders effects. Returns a cleanup function. Never changes typing state. */
export type CreateEffects = (engine: TypingEngine, ctx: EffectsContext) => () => void;

export interface ThemePlugin {
  config: ThemeConfig;
  createEffects: CreateEffects;
}
