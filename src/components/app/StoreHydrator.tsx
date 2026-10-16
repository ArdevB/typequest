"use client";

import { useEffect } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { sound } from "@/lib/sound";
import { useHistory } from "@/stores/historyStore";
import { useHydrated } from "@/stores/hydration";
import { useSettings } from "@/stores/settingsStore";
import { getTheme } from "@/themes/registry";

/**
 * Loads persisted stores after mount and keeps <html> attributes and the
 * sound player in sync with settings.
 */
export function StoreHydrator() {
  const themeId = useSettings((s) => s.themeId);
  const colorblind = useSettings((s) => s.colorblind);
  const soundOn = useSettings((s) => s.soundOn);
  const soundPack = useSettings((s) => s.soundPack);
  const volume = useSettings((s) => s.volume);
  const reduced = useReducedMotion();
  const ready = useHydrated((s) => s.ready);

  useEffect(() => {
    void Promise.all([useSettings.persist.rehydrate(), useHistory.persist.rehydrate()]).then(() =>
      useHydrated.setState({ ready: true }),
    );
  }, []);

  useEffect(() => {
    if (!ready) return;
    const html = document.documentElement;
    html.dataset.theme = getTheme(themeId).config.id;
    html.dataset.cb = colorblind ? "true" : "false";
    html.dataset.rm = reduced ? "true" : "false";
  }, [ready, themeId, colorblind, reduced]);

  useEffect(() => {
    if (!ready) return;
    sound.configure({
      enabled: soundOn,
      volume,
      pack: soundPack === "theme" ? getTheme(themeId).config.sounds : soundPack,
    });
  }, [ready, soundOn, soundPack, volume, themeId]);

  return null;
}

