import { minimalCalm } from "./minimal-calm";
import { neonCyber } from "./neon-cyber";
import type { CreateEffects, ThemeColors, ThemeId, ThemePlugin } from "./types";

export const THEMES: Readonly<Record<ThemeId, ThemePlugin>> = {
  "neon-cyber": neonCyber,
  "minimal-calm": minimalCalm,
};

export const THEME_LIST: readonly ThemePlugin[] = Object.values(THEMES);
export const DEFAULT_THEME: ThemeId = "neon-cyber";

export const getTheme = (id: string): ThemePlugin =>
  (THEMES as Record<string, ThemePlugin | undefined>)[id] ?? THEMES[DEFAULT_THEME];

/**
 * With reduced motion, every theme keeps its colors but uses Minimal Calm's
 * effects (no particles, no shake).
 */
export const effectsFor = (id: ThemeId, reducedMotion: boolean): CreateEffects =>
  reducedMotion ? minimalCalm.createEffects : getTheme(id).createEffects;

const VAR: Record<keyof ThemeColors, string> = {
  bg: "--bg",
  bgAlt: "--bg-alt",
  surface: "--surface",
  border: "--border",
  text: "--text",
  sub: "--sub",
  main: "--main",
  caret: "--caret",
  error: "--error",
  errorExtra: "--error-extra",
  errorCb: "--error-cb",
  combo1: "--combo-1",
  combo2: "--combo-2",
  combo3: "--combo-3",
  glow: "--glow",
};

/** CSS custom properties for every theme, generated from the TS configs (single source of truth). */
export function themeCss(): string {
  return THEME_LIST.map(({ config }) => {
    const vars = (Object.keys(VAR) as (keyof ThemeColors)[])
      .map((k) => `${VAR[k]}:${config.colors[k]}`)
      .concat([
        `--font-ui-family:${config.font.ui}`,
        `--font-mono-family:${config.font.mono}`,
        `--font-display-family:${config.font.display}`,
        `color-scheme:${config.dark ? "dark" : "light"}`,
      ])
      .join(";");
    return `html[data-theme="${config.id}"]{${vars}}`;
  }).join("\n");
}
