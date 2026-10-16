"use client";

import { useEffect } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { music, sfx, sound, type MusicTrack } from "@/lib/sound";
import { useMusicScene } from "@/stores/musicScene";
import { useChallenges } from "@/stores/challengesStore";
import { useGames } from "@/stores/gamesStore";
import { useHistory } from "@/stores/historyStore";
import { useLessons } from "@/stores/lessonsStore";
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
    void Promise.all([
      useSettings.persist.rehydrate(),
      useHistory.persist.rehydrate(),
      useLessons.persist.rehydrate(),
      useChallenges.persist.rehydrate(),
      useGames.persist.rehydrate(),
    ]).then(() =>
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

  const sfxVolume = useSettings((s) => s.sfxVolume);
  const musicOn = useSettings((s) => s.musicOn);
  const musicVolume = useSettings((s) => s.musicVolume);
  const scene = useMusicScene((s) => s.scene);

  useEffect(() => {
    if (!ready) return;
    sfx.configure({ enabled: soundOn, volume: sfxVolume });
  }, [ready, soundOn, sfxVolume]);

  useEffect(() => {
    if (!ready) return;
    const track: MusicTrack = scene === "battle" ? "battle" : (getTheme(themeId).config.id as MusicTrack);
    music.configure({ enabled: soundOn && musicOn, volume: musicVolume, track });
  }, [ready, soundOn, musicOn, musicVolume, scene, themeId]);

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

