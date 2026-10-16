import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { StopOnError, TimeSeconds, WordCount } from "@/engine";
import type { SoundPackId } from "@/lib/sound";
import { STORAGE_KEYS, safeStorage } from "@/lib/storage";
import { DEFAULT_THEME } from "@/themes/registry";
import type { ThemeId } from "@/themes/types";

export type SpeedMode = { kind: "time"; seconds: TimeSeconds } | { kind: "words"; count: WordCount };
export type MotionPref = "system" | "reduce" | "full";

export interface SettingsState {
  themeId: ThemeId;
  soundOn: boolean;
  /** "theme" = use the theme's default pack. */
  soundPack: SoundPackId | "theme";
  volume: number;
  mode: SpeedMode;
  punctuation: boolean;
  numbers: boolean;
  stopOnError: StopOnError;
  motion: MotionPref;
  colorblind: boolean;
  showLiveWpm: boolean;
  set: <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => void;
}

export type SettingsData = Omit<SettingsState, "set">;

export const DEFAULT_SETTINGS: SettingsData = {
  themeId: DEFAULT_THEME,
  soundOn: true,
  soundPack: "theme",
  volume: 0.45,
  mode: { kind: "time", seconds: 30 },
  punctuation: false,
  numbers: false,
  stopOnError: "off",
  motion: "system",
  colorblind: false,
  showLiveWpm: true,
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
