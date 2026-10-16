import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LayoutId, StopOnError, TimeSeconds, WordCount } from "@/engine";
import type { SoundPackId } from "@/lib/sound";
import { STORAGE_KEYS, safeStorage } from "@/lib/storage";
import { DEFAULT_THEME } from "@/themes/registry";
import type { ThemeId } from "@/themes/types";
import type { MascotOutfit } from "@/unlocks/catalog";

export type SpeedMode = { kind: "time"; seconds: TimeSeconds } | { kind: "words"; count: WordCount };
export type MotionPref = "system" | "reduce" | "full";

export interface SettingsState {
  themeId: ThemeId;
  soundOn: boolean;
  /** "theme" = use the theme's default pack. */
  soundPack: SoundPackId | "theme";
  volume: number;
  /** Game sound effects (hits, explosions). */
  sfxVolume: number;
  musicOn: boolean;
  musicVolume: number;
  mode: SpeedMode;
  punctuation: boolean;
  numbers: boolean;
  stopOnError: StopOnError;
  motion: MotionPref;
  colorblind: boolean;
  showLiveWpm: boolean;
  /** Keeby, the mascot, on the typing screens. */
  /** Keyboard layout for lessons, the finger guide and practice. */
  layout: LayoutId;
  mascot: boolean;
  mascotOutfit: MascotOutfit;
  /** Unlockables the player has already been told about. */
  seenUnlocks: string[];
  set: <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => void;
}

export type SettingsData = Omit<SettingsState, "set">;

export const DEFAULT_SETTINGS: SettingsData = {
  themeId: DEFAULT_THEME,
  soundOn: true,
  soundPack: "theme",
  volume: 0.45,
  sfxVolume: 0.7,
  musicOn: false,
  musicVolume: 0.35,
  mode: { kind: "time", seconds: 30 },
  punctuation: false,
  numbers: false,
  stopOnError: "off",
  motion: "system",
  colorblind: false,
  showLiveWpm: true,
  layout: "qwerty",
  mascot: true,
  mascotOutfit: "none",
  seenUnlocks: [],
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (key, value) => set({ [key]: value } as Partial<SettingsState>),
    }),
    {
      name: STORAGE_KEYS.settings,
      storage: safeStorage,
      version: 1,
      // Rehydrated in <StoreHydrator/> after mount so server and client HTML match.
      skipHydration: true,
      partialize: ({ set: _set, ...data }) => data,
    },
  ),
);
