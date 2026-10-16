"use client";

import { useSyncExternalStore } from "react";
import { useSettings } from "@/stores/settingsStore";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(cb: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}

export function useSystemReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

/** Effective reduced-motion: the user's setting wins, otherwise the OS preference. */
export function useReducedMotion(): boolean {
  const pref = useSettings((s) => s.motion);
  const system = useSystemReducedMotion();
  return pref === "reduce" || (pref === "system" && system);
}
