import type { ThemeConfig } from "../types";

/** Reward theme: unlocked by defeating a Weekly Boss. */
export const infernoConfig: ThemeConfig = {
  id: "inferno",
  name: "Inferno",
  description: "The Weekly Boss's lair: embers, heat haze and molten type.",
  dark: true,
  colors: {
    bg: "#120605",
    bgAlt: "#1c0a08",
    surface: "#24100c",
    border: "#4a1d14",
    text: "#ffe9dc",
    sub: "#8a5444",
    main: "#ff5a1f",
    caret: "#ffc53d",
    error: "#ff2e63",
    errorExtra: "#8f1f3d",
    errorCb: "#4dc3ff",
    combo1: "#ffc53d",
    combo2: "#ff8a3d",
    combo3: "#fff1a8",
    glow: "#ff5a1f",
  },
  font: {
    ui: '"Inter Variable", system-ui, sans-serif',
    mono: '"JetBrains Mono Variable", ui-monospace, monospace',
    display: '"Orbitron", "Inter Variable", sans-serif',
  },
  renderer: "dom",
  sounds: "scifi",
  particles: { colors: ["#ffc53d", "#ff8a3d", "#ff5a1f"], trail: true },
  music: null,
  caret: "line",
};
