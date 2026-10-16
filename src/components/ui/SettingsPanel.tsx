"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { SOUND_PACKS, sfx, sound, type SoundPackId } from "@/lib/sound";
import { useSettings, type MotionPref } from "@/stores/settingsStore";
import { THEME_LIST, getTheme } from "@/themes/registry";
import type { ThemeId } from "@/themes/types";
import { LAYOUTS, LAYOUT_IDS, type StopOnError } from "@/engine";
import { useUnlocked } from "@/hooks/useUnlocks";
import { UNLOCKABLES, isOutfitUnlocked, isThemeUnlocked, type MascotOutfit } from "@/unlocks/catalog";

const OUTFITS: readonly { id: MascotOutfit; name: string }[] = [
  { id: "none", name: "Plain" },
  { id: "headphones", name: "Headphones" },
  { id: "shades", name: "Shades" },
  { id: "crown", name: "Crown" },
];

const requirementFor = (id: string) => UNLOCKABLES.find((u) => u.id === id)?.requirement ?? "";

/** Theme swatches + quick settings popover. */
export function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const s = useSettings();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={panelRef} className="tq-chrome relative">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="tq-icon-btn"
          aria-pressed={s.soundOn}
          aria-label={s.soundOn ? "Mute sounds" : "Turn sounds on"}
          onClick={() => s.set("soundOn", !s.soundOn)}
        >
          {s.soundOn ? <SpeakerIcon /> : <MuteIcon />}
        </button>
        <button
          type="button"
          className="tq-icon-btn"
          aria-expanded={open}
          aria-label="Settings"
          onClick={() => setOpen((o) => !o)}
        >
          <GearIcon />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Settings"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 top-11 z-40 max-h-[calc(100dvh-5rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface p-4 shadow-2xl"
          >
            <SettingsForm />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** All quick settings. Used in the header popover and on /settings. */
export function SettingsForm() {
  const s = useSettings();
  const unlocked = useUnlocked();
  const effectivePack = s.soundPack === "theme" ? getTheme(s.themeId).config.sounds : s.soundPack;
  return (
    <>
      <Section title="Theme">
        <div className="grid grid-cols-2 gap-2">
          {THEME_LIST.map(({ config }) => {
            const open = isThemeUnlocked(config.id, unlocked);
            return (
              <button
                key={config.id}
                type="button"
                aria-pressed={s.themeId === config.id}
                aria-disabled={!open}
                title={open ? config.description : `Locked — ${requirementFor(`theme:${config.id}`)}`}
                onClick={() => open && s.set("themeId", config.id as ThemeId)}
                className="relative overflow-hidden rounded-lg border border-border p-2 text-left transition hover:border-main aria-pressed:border-main aria-pressed:ring-1 aria-pressed:ring-main aria-disabled:cursor-not-allowed aria-disabled:hover:border-border"
                style={{ background: config.colors.bg, color: config.colors.text }}
              >
                <span className={`mb-1.5 flex gap-1 ${open ? "" : "opacity-40"}`}>
                  {[config.colors.main, config.colors.caret, config.colors.sub, config.colors.error].map((c, i) => (
                    <i key={i} className="inline-block h-3 w-3 rounded-full" style={{ background: c }} />
                  ))}
                </span>
                <span className={`text-sm font-medium ${open ? "" : "opacity-60"}`}>{config.name}</span>
                {!open && (
                  <span className="mt-1 flex items-start gap-1 text-[11px] leading-tight opacity-80">
                    <LockIcon />
                    {requirementFor(`theme:${config.id}`)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Key sounds">
        <div className="flex flex-wrap gap-1.5">
          {SOUND_PACKS.map((p) => (
            <Chip
              key={p.id}
              active={s.soundOn && effectivePack === p.id}
              onClick={() => {
                s.set("soundPack", p.id as SoundPackId);
                s.set("soundOn", true);
                setTimeout(() => sound.play("key"), 60);
              }}
            >
              {p.name}
            </Chip>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-3 text-sm text-sub">
          Volume
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.volume}
            onChange={(e) => s.set("volume", Number(e.target.value))}
            className="flex-1 accent-[var(--main)]"
          />
        </label>
      </Section>

      <Section title="Music & game effects">
        <Switch label="Background music" on={s.musicOn} onChange={(v) => s.set("musicOn", v)} />
        <label className="mt-1 flex items-center gap-3 text-sm text-sub">
          Music
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.musicVolume}
            disabled={!s.musicOn}
            onChange={(e) => s.set("musicVolume", Number(e.target.value))}
            className="flex-1 accent-[var(--main)] disabled:opacity-40"
            aria-label="Music volume"
          />
        </label>
        <label className="mt-2 flex items-center gap-3 text-sm text-sub">
          Effects
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.sfxVolume}
            onChange={(e) => {
              s.set("sfxVolume", Number(e.target.value));
              void sfx.preload().then(() => setTimeout(() => sfx.play("hit"), 30));
            }}
            className="flex-1 accent-[var(--main)]"
            aria-label="Game effects volume"
          />
        </label>
        <p className="mt-1 text-xs text-sub">Music follows your theme; games get a battle track. Everything mutes with the speaker button.</p>
      </Section>

      <Section title="Mistakes">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["off", "Keep going"],
              ["letter", "Stop on letter"],
              ["word", "Stop on word"],
            ] as const satisfies readonly (readonly [StopOnError, string])[]
          ).map(([v, label]) => (
            <Chip key={v} active={s.stopOnError === v} onClick={() => s.set("stopOnError", v)}>
              {label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Motion">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["system", "Match system"],
              ["reduce", "Reduced"],
              ["full", "Full"],
            ] as const satisfies readonly (readonly [MotionPref, string])[]
          ).map(([v, label]) => (
            <Chip key={v} active={s.motion === v} onClick={() => s.set("motion", v)}>
              {label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Keyboard layout">
        <div className="flex flex-wrap gap-1.5">
          {LAYOUT_IDS.map((id) => (
            <Chip key={id} active={s.layout === id} onClick={() => s.set("layout", id)}>
              {LAYOUTS[id].name}
            </Chip>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-sub">Lessons, the finger guide and practice follow this. Switch your computer to the same layout too.</p>
      </Section>

      <Section title="Display">
        <Switch label="Colorblind-safe errors" on={s.colorblind} onChange={(v) => s.set("colorblind", v)} />
        <Switch label="Show live WPM" on={s.showLiveWpm} onChange={(v) => s.set("showLiveWpm", v)} />
      </Section>

      <Section title="Keeby (mascot)">
        <Switch label="Show Keeby while typing" on={s.mascot} onChange={(v) => s.set("mascot", v)} />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {OUTFITS.map((o) => {
            const open = isOutfitUnlocked(o.id, unlocked);
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={s.mascotOutfit === o.id}
                aria-disabled={!open}
                title={open ? o.name : `Locked — ${requirementFor(`outfit:${o.id}`)}`}
                onClick={() => open && s.set("mascotOutfit", o.id)}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-sm text-sub transition hover:text-text aria-pressed:border-main aria-pressed:bg-main aria-pressed:text-bg aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
              >
                {!open && <LockIcon />}
                {o.name}
              </button>
            );
          })}
        </div>
      </Section>
    </>
  );
}

function LockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true" className="mt-px shrink-0">
      <rect x="3" y="7" width="10" height="8" rx="1.5" fill="currentColor" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 last:mb-0">
      <h3 className="mb-2 text-xs uppercase tracking-[0.18em] text-sub">{title}</h3>
      {children}
    </section>
  );
}

function Chip(p: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={p.active}
      onClick={p.onClick}
      className="rounded-md border border-border px-2.5 py-1 text-sm text-sub transition hover:text-text aria-pressed:border-main aria-pressed:bg-main aria-pressed:text-bg"
    >
      {p.children}
    </button>
  );
}

function Switch(p: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-1 text-sm text-text">
      {p.label}
      <input type="checkbox" role="switch" checked={p.on} onChange={(e) => p.onChange(e.target.checked)} className="peer sr-only" />
      <span className="relative h-5 w-9 rounded-full bg-border transition peer-checked:bg-main peer-focus-visible:ring-2 peer-focus-visible:ring-main after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-surface after:transition peer-checked:after:translate-x-4" />
    </label>
  );
}

const iconProps = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function SpeakerIcon() {
  return (
    <svg {...iconProps} aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
    </svg>
  );
}
function MuteIcon() {
  return (
    <svg {...iconProps} aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <path d="m22 9-6 6M16 9l6 6" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg {...iconProps} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}
