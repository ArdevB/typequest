import { createJSONStorage, type StateStorage } from "zustand/middleware";

/** localStorage that never throws (private mode, blocked storage, SSR). */
const safeLocal: StateStorage = {
  getItem: (name) => {
    try {
      return typeof window === "undefined" ? null : window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      /* storage full or blocked: progress just isn't saved */
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

export const safeStorage = createJSONStorage(() => safeLocal);

export const STORAGE_KEYS = {
  settings: "tq-settings",
  history: "tq-history",
  lessons: "tq-lessons",
  challenges: "tq-challenges",
} as const;
