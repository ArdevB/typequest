"use client";

import { useEffect, useRef } from "react";
import type { TypingEngine } from "@/engine";
import { useUnlocked } from "@/hooks/useUnlocks";
import { isOutfitUnlocked, type MascotOutfit } from "@/unlocks/catalog";
import { useSettings } from "@/stores/settingsStore";

export type MascotMood = "idle" | "happy" | "combo" | "oops" | "sleep" | "cheer" | "sad";

interface Props {
  /** Live engine to react to. Moods are set on the DOM directly, so typing never re-renders React. */
  engine: TypingEngine | null;
  /** Resting mood when there's no engine (results, menus). */
  mood?: MascotMood;
  /** Speech bubble text. */
  tip?: string;
  /** "dock" floats in the corner of typing screens; "inline" sits in the layout. */
  variant?: "inline" | "dock";
  size?: number;
}

/** Seconds without a keystroke before Keeby dozes off (only before/after typing, never mid-run). */
const SLEEP_AFTER = 9000;

/**
 * Keeby, a little keycap who watches you type: bobs while idle, grins at
 * clean words, jumps on combos, winces at mistakes and naps when you stop.
 */
export function Mascot({ engine, mood = "idle", tip, variant = "inline", size = 96 }: Props) {
  const on = useSettings((s) => s.mascot);
  const chosen = useSettings((s) => s.mascotOutfit);
  const unlocked = useUnlocked();
  const outfit: MascotOutfit = isOutfitUnlocked(chosen, unlocked) ? chosen : "none";
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.dataset.mood = mood;
    if (!engine) {
      if (mood !== "idle") return;
      const t = setTimeout(() => (root.dataset.mood = "sleep"), SLEEP_AFTER * 2);
      return () => clearTimeout(t);
    }

    let revert: ReturnType<typeof setTimeout> | undefined;
    let sleep: ReturnType<typeof setTimeout> | undefined;
    let running = false;
    const set = (m: MascotMood, ms = 0) => {
      // A combo celebration isn't cut short by the next clean word.
      if (root.dataset.mood === "combo" && m === "happy") return;
      root.dataset.mood = m;
      clearTimeout(revert);
      if (ms) revert = setTimeout(() => (root.dataset.mood = running ? "idle" : "idle"), ms);
    };
    const napLater = () => {
      clearTimeout(sleep);
      if (!running) sleep = setTimeout(() => (root.dataset.mood = "sleep"), SLEEP_AFTER);
    };

    const offs = [
      engine.on("start", () => {
        running = true;
        clearTimeout(sleep);
        set("idle");
      }),
      engine.on("wordComplete", (e) => e.correct && set("happy", 450)),
      engine.on("combo", () => set("combo", 1300)),
      engine.on("error", () => set("oops", 500)),
      engine.on("finish", (r) => {
        running = false;
        set(r.accuracy >= 90 ? "cheer" : "sad");
        napLater();
      }),
      engine.on("reset", () => {
        running = false;
        set("idle");
        napLater();
      }),
    ];
    napLater();
    return () => {
      offs.forEach((off) => off());
      clearTimeout(revert);
      clearTimeout(sleep);
    };
  }, [engine, mood]);

  if (!on) return null;

  return (
    <div className={`tq-mascot ${variant === "dock" ? "tq-mascot-dock" : ""}`} data-variant={variant}>
      {tip && (
        <p className="tq-mascot-tip" role="status">
          {tip}
        </p>
      )}
      <div ref={rootRef} className="tq-keeby" data-mood={mood} style={{ width: size, height: size }} aria-hidden="true">
        <svg viewBox="0 0 120 120" width={size} height={size}>
          <ellipse className="k-shadow" cx="60" cy="112" rx="30" ry="5" />
          <g className="k-body">
            {/* feet */}
            <rect className="k-foot k-foot-l" x="38" y="96" width="14" height="10" rx="5" />
            <rect className="k-foot k-foot-r" x="68" y="96" width="14" height="10" rx="5" />
            {/* arms */}
            <path className="k-arm k-arm-l" d="M24 62 q-12 4 -14 16" />
            <path className="k-arm k-arm-r" d="M96 62 q12 4 14 16" />
            {/* keycap: skirt + top */}
            <rect className="k-skirt" x="20" y="30" width="80" height="70" rx="16" />
            <rect className="k-top" x="28" y="34" width="64" height="54" rx="12" />
            {/* face */}
            <g className="k-face">
              <g className="k-eyes">
                <ellipse className="k-eye" cx="48" cy="56" rx="5" ry="6.5" />
                <ellipse className="k-eye" cx="72" cy="56" rx="5" ry="6.5" />
                <circle className="k-shine" cx="50" cy="53.5" r="1.6" />
                <circle className="k-shine" cx="74" cy="53.5" r="1.6" />
              </g>
              <path className="k-eyes-closed" d="M43 57 q5 4 10 0 M67 57 q5 4 10 0" />
              <path className="k-eyes-x" d="M44 52 l8 8 M52 52 l-8 8 M68 52 l8 8 M76 52 l-8 8" />
              <ellipse className="k-cheek" cx="40" cy="67" rx="5" ry="3" />
              <ellipse className="k-cheek" cx="80" cy="67" rx="5" ry="3" />
              <path className="k-mouth k-mouth-smile" d="M53 68 q7 6 14 0" />
              <path className="k-mouth k-mouth-grin" d="M50 66 q10 12 20 0 z" />
              <path className="k-mouth k-mouth-o" d="M60 66 m-3.5 0 a3.5 4.5 0 1 0 7 0 a3.5 4.5 0 1 0 -7 0" />
              <path className="k-mouth k-mouth-sad" d="M53 72 q7 -6 14 0" />
            </g>
            {/* outfits */}
            {outfit === "headphones" && (
              <g className="k-outfit">
                <path d="M22 50 q38 -46 76 0" fill="none" stroke="var(--k-outfit)" strokeWidth="6" strokeLinecap="round" />
                <rect x="12" y="46" width="14" height="22" rx="6" fill="var(--k-outfit)" />
                <rect x="94" y="46" width="14" height="22" rx="6" fill="var(--k-outfit)" />
              </g>
            )}
            {outfit === "shades" && (
              <g className="k-outfit">
                <rect x="36" y="49" width="20" height="12" rx="4" fill="#0b0b10" />
                <rect x="64" y="49" width="20" height="12" rx="4" fill="#0b0b10" />
                <path d="M56 54 h8" stroke="#0b0b10" strokeWidth="3" />
                <path d="M39 52 l6 0" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" />
              </g>
            )}
            {outfit === "crown" && (
              <g className="k-outfit">
                <path d="M40 32 l4 -18 l9 10 l7 -14 l7 14 l9 -10 l4 18 z" fill="#ffd23f" stroke="#b8860b" strokeWidth="2" strokeLinejoin="round" />
                <circle cx="60" cy="24" r="2.5" fill="#ff4d6d" />
              </g>
            )}
          </g>
          <g className="k-fx">
            <path className="k-spark" d="M14 26 l3 -8 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 z" />
            <path className="k-spark k-spark-2" d="M100 18 l2 -6 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 z" />
            <text className="k-z" x="92" y="30">z</text>
            <text className="k-z k-z-2" x="102" y="18">z</text>
            <path className="k-sweat" d="M98 40 q4 6 0 10 q-4 -4 0 -10 z" />
          </g>
        </svg>
      </div>
    </div>
  );
}
