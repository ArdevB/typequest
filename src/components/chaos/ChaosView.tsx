"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRng, type RunResult, type TestMode, type TypingEngine } from "@/engine";
import { Mascot } from "@/components/mascot/Mascot";
import { TypingSurface } from "@/components/typing/TypingSurface";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { celebrate } from "@/lib/confetti";
import { MODIFIERS, chaosScore } from "@/modifiers/catalog";
import { applyTransforms, stackMultiplier } from "@/modifiers/types";
import { useGames } from "@/stores/gamesStore";
import { useHydrated } from "@/stores/hydration";
import { useSettings } from "@/stores/settingsStore";

const SECONDS = 30;
const MODE: TestMode = { kind: "time", seconds: SECONDS };
const newSeed = () => Math.floor(Math.random() * 2 ** 31);

type View = { kind: "pick" } | { kind: "typing" } | { kind: "done"; result: RunResult; score: number; isBest: boolean; previous: number | null; overallBest: boolean };

export function ChaosView() {
  const ready = useHydrated((s) => s.ready);
  const themeId = useSettings((s) => s.themeId);
  const showLiveWpm = useSettings((s) => s.showLiveWpm);
  const reducedMotion = useReducedMotion();
  const chaosBests = useGames((s) => s.chaosBests);
  const recordChaos = useGames((s) => s.recordChaos);

  const available = useMemo(() => MODIFIERS.filter((m) => !(reducedMotion && m.motion)), [reducedMotion]);
  const [picked, setPicked] = useState<string[]>(["mirror", "random-case"]);
  const active = useMemo(() => available.filter((m) => picked.includes(m.id)), [available, picked]);
  const combo = active.map((m) => m.id).join("+");
  const multiplier = stackMultiplier(active);

  const [view, setView] = useState<View>({ kind: "pick" });
  const [seed, setSeed] = useState(newSeed);
  const [runKey, setRunKey] = useState(0);
  const [engine, setEngine] = useState<TypingEngine | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // A fresh, seeded transform per run so the random case pattern is stable within the run.
  const transformWords = useMemo(() => {
    if (!active.some((m) => m.transformText)) return undefined;
    const rng = createRng(`chaos:${seed}`);
    return (words: string[]) => applyTransforms(words, active, rng);
  }, [active, seed]);

  const start = useCallback(() => {
    setSeed(newSeed());
    setRunKey((k) => k + 1);
    setView({ kind: "typing" });
  }, []);

  // Error hooks and visual effects attach to the live engine.
  useEffect(() => {
    const root = rootRef.current;
    if (!engine || !root || view.kind !== "typing") return;
    const rng = createRng(`chaos-fx:${seed}`);
    const cleanups = active.map((m) => m.renderEffect?.(engine, { root, reducedMotion, rng }) ?? (() => {}));
    const offErr = engine.on("error", (e) => active.forEach((m) => m.onError?.(e, engine)));
    return () => {
      offErr();
      cleanups.forEach((c) => c());
    };
  }, [engine, active, seed, reducedMotion, view.kind]);

  const onFinish = useCallback(
    (result: RunResult) => {
      const valid = result.flags.pasteAttempts === 0 && result.wpm > 0;
      const score = valid ? chaosScore(result.wpm, result.accuracy, multiplier) : 0;
      const r = valid ? recordChaos(combo, score) : { isBest: false, previous: null, overallBest: false };
      if (r.overallBest && score > 0 && !reducedMotion) {
        const css = getComputedStyle(document.documentElement);
        void celebrate(["--main", "--caret", "--combo-3"].map((v) => css.getPropertyValue(v).trim()).filter(Boolean));
      }
      setView({ kind: "done", result, score, ...r });
    },
    [multiplier, combo, recordChaos, reducedMotion],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (view.kind === "pick") return;
      if (e.key === "Escape") {
        e.preventDefault();
        setView({ kind: "pick" });
      } else if (e.key === "Tab" || (e.key === "Enter" && view.kind === "done" && !(e.target as HTMLElement | null)?.closest("button,a"))) {
        e.preventDefault();
        start();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view.kind, start]);

  if (!ready) return <div className="tq-words-skeleton" aria-hidden="true" />;

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const bestHere = chaosBests[combo];
  const topScore = Math.max(0, ...Object.values(chaosBests));

  return (
    <div className="mx-auto w-full max-w-5xl">
      <AnimatePresence mode="wait" initial={false}>
        {view.kind === "pick" && (
          <motion.section key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="py-4">
            <h1 className="font-display text-3xl font-black text-text sm:text-4xl">Chaos</h1>
            <p className="mt-2 max-w-2xl text-sub">
              Stack modifiers, survive {SECONDS} seconds. Every modifier multiplies your score, so the more chaos you can handle, the higher you go.
            </p>

            <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Modifiers">
              {available.map((m) => {
                const on = picked.includes(m.id);
                return (
                  <li key={m.id}>
                    <button type="button" aria-pressed={on} onClick={() => toggle(m.id)} className="tq-card tq-mod-card h-full w-full text-left">
                      <span className="flex items-start justify-between gap-2">
                        <span className="tq-mod-icon" aria-hidden="true">
                          {m.icon}
                        </span>
                        <span className="font-mono text-sm text-main">×{m.scoreMultiplier.toFixed(2)}</span>
                      </span>
                      <span className="mt-3 block font-display text-base font-bold text-text">{m.name}</span>
                      <span className="mt-1 block text-sm leading-snug text-sub">{m.description}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {reducedMotion && <p className="mt-3 text-xs text-sub">Modifiers that shake the screen are hidden because reduced motion is on.</p>}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border p-4 sm:p-5">
              <div>
                <div className="text-xs uppercase tracking-widest text-sub">score multiplier</div>
                <div className="font-mono text-3xl tabular-nums text-text">×{multiplier.toFixed(2)}</div>
                <div className="mt-1 text-xs text-sub">
                  {bestHere !== undefined ? <>best with this mix: {bestHere.toLocaleString()}</> : "no score with this mix yet"}
                  {topScore > 0 && <> · all-time chaos best: {topScore.toLocaleString()}</>}
                </div>
              </div>
              <button type="button" className="tq-btn tq-btn-primary text-lg" onClick={start}>
                Unleash chaos →
              </button>
            </div>
          </motion.section>
        )}

        {view.kind === "typing" && (
          <motion.section key={`typing-${runKey}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="py-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-2 text-sm text-sub">
              <button type="button" onClick={() => setView({ kind: "pick" })} className="hover:text-main">
                ← modifiers
              </button>
              <span>
                {active.length ? active.map((m) => m.name).join(" · ") : "No modifiers"} <span className="ml-2 font-mono text-main">×{multiplier.toFixed(2)}</span>
              </span>
            </div>
            <div ref={rootRef} className="tq-chaos relative" data-chaos={active.map((m) => m.id).join(" ")}>
              <TypingSurface
                mode={MODE}
                stopOnError="off"
                seed={seed}
                transformWords={transformWords}
                runKey={runKey}
                themeId={themeId}
                reducedMotion={reducedMotion}
                showLiveWpm={showLiveWpm}
                onFinish={onFinish}
                onEngine={setEngine}
              />
            </div>
            <p className="tq-chrome mt-8 text-center text-xs text-sub">
              <kbd>Tab</kbd> — restart · <kbd>Esc</kbd> — modifiers
            </p>
            <Mascot variant="dock" size={72} engine={engine} />
          </motion.section>
        )}

        {view.kind === "done" && (
          <motion.section key={`done-${runKey}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} className="py-8 text-center">
            <p className="font-display text-sm uppercase tracking-[0.3em] text-main">Chaos survived</p>
            <div className="tq-big mt-3 font-display text-6xl font-black text-text">{view.score.toLocaleString()}</div>
            <p className="mt-2 text-sm text-sub">
              {Math.round(view.result.wpm)} wpm × {Math.round(view.result.accuracy)}%² accuracy × {multiplier.toFixed(2)} chaos
            </p>
            <p className="mt-4 text-sm">
              {view.overallBest ? (
                <span className="text-[var(--combo-3)]">New all-time chaos best!</span>
              ) : view.isBest ? (
                <span className="text-[var(--combo-3)]">{view.previous === null ? "First score with this mix." : `Best with this mix — up from ${view.previous.toLocaleString()}.`}</span>
              ) : (
                <span className="text-sub">Best with this mix: {view.previous?.toLocaleString()}</span>
              )}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button type="button" className="tq-btn tq-btn-primary" onClick={start} autoFocus>
                Again
              </button>
              <button type="button" className="tq-btn" onClick={() => setView({ kind: "pick" })}>
                Change modifiers
              </button>
            </div>
            <p className="tq-chrome mt-4 text-xs text-sub">
              <kbd>Enter</kbd> — again
            </p>
            <p className="mt-6 text-xs text-sub">Chaos scores are kept in this browser.</p>
            <div className="mt-6 flex justify-center">
              <Mascot engine={null} mood={view.isBest ? "cheer" : view.result.accuracy >= 90 ? "happy" : "sad"} size={80} />
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
