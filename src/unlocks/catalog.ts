import type { ThemeId } from "@/themes/types";

/** What unlock rules look at. Built from local stores (and the profile when signed in). */
export interface UnlockStats {
  level: number;
  speedTests: number;
  bestWpm: number;
  lessonsPassed: number;
  gameWins: number;
  weeklyBossWins: number;
}

export type MascotOutfit = "none" | "headphones" | "shades" | "crown";

export type Unlockable =
  | { id: string; kind: "theme"; theme: ThemeId; name: string; requirement: string; check: (s: UnlockStats) => boolean }
  | { id: string; kind: "outfit"; outfit: MascotOutfit; name: string; requirement: string; check: (s: UnlockStats) => boolean };

/** Themes available from the start. */
export const FREE_THEMES: readonly ThemeId[] = ["neon-cyber", "minimal-calm"];

export const UNLOCKABLES: readonly Unlockable[] = [
  {
    id: "theme:retro-arcade",
    kind: "theme",
    theme: "retro-arcade",
    name: "Retro Arcade theme",
    requirement: "Finish 10 speed tests or reach level 3",
    check: (s) => s.speedTests >= 10 || s.level >= 3,
  },
  {
    id: "theme:space-shooter",
    kind: "theme",
    theme: "space-shooter",
    name: "Space Shooter theme",
    requirement: "Win 3 games or reach level 6",
    check: (s) => s.gameWins >= 3 || s.level >= 6,
  },
  {
    id: "theme:inferno",
    kind: "theme",
    theme: "inferno",
    name: "Inferno theme",
    requirement: "Defeat a Weekly Boss",
    check: (s) => s.weeklyBossWins >= 1,
  },
  {
    id: "outfit:headphones",
    kind: "outfit",
    outfit: "headphones",
    name: "Headphones for Keeby",
    requirement: "Pass 5 lessons",
    check: (s) => s.lessonsPassed >= 5,
  },
  {
    id: "outfit:shades",
    kind: "outfit",
    outfit: "shades",
    name: "Shades for Keeby",
    requirement: "Hit 60 WPM in a speed test",
    check: (s) => s.bestWpm >= 60,
  },
  {
    id: "outfit:crown",
    kind: "outfit",
    outfit: "crown",
    name: "Crown for Keeby",
    requirement: "Defeat a Weekly Boss",
    check: (s) => s.weeklyBossWins >= 1,
  },
];

export function unlockedIds(stats: UnlockStats): Set<string> {
  return new Set(UNLOCKABLES.filter((u) => u.check(stats)).map((u) => u.id));
}

export function isThemeUnlocked(theme: ThemeId, unlocked: ReadonlySet<string>): boolean {
  return FREE_THEMES.includes(theme) || unlocked.has(`theme:${theme}`);
}

export function isOutfitUnlocked(outfit: MascotOutfit, unlocked: ReadonlySet<string>): boolean {
  return outfit === "none" || unlocked.has(`outfit:${outfit}`);
}
