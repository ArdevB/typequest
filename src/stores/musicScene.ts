import { create } from "zustand";

/** What the music should follow: the theme's track, or the battle track while a game is open. */
export const useMusicScene = create<{ scene: "theme" | "battle"; set: (scene: "theme" | "battle") => void }>((set) => ({
  scene: "theme",
  set: (scene) => set({ scene }),
}));
