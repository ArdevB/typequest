"use client";

import { useEffect, useRef, useState } from "react";
import {
  attachInput,
  createTypingEngine,
  wordSource,
  type RunResult,
  type StopOnError,
  type TestMode,
  type TypingEngine,
  type WordSource,
} from "@/engine";
import { createParticleLayer, type ParticleLayer } from "@/lib/particles";
import { sound } from "@/lib/sound";
import { effectsFor, getTheme } from "@/themes/registry";
import type { ThemeId } from "@/themes/types";
import { createWordsRenderer, type WordsRenderer } from "./wordsRenderer";

export interface TypingSurfaceProps {
  /** time / words use random words; text mode types the given text (lessons). */
  mode: TestMode;
  stopOnError: StopOnError;
  punctuation?: boolean;
  numbers?: boolean;
  /** Seed for the random words (time/words modes). Same seed = same words; the server uses it to verify runs. */
  seed?: number;
  /** Weight words toward these keys (Weak Key Hunt). */
  keyWeights?: Readonly<Record<string, number>>;
  /** Supplies the words instead of the default generator (chaos runs). Called once per run; keep it memoized. */
  makeSource?: () => WordSource;
  /** Blind mode: hide right/wrong feedback. */
  blind?: boolean;
  /** Bump to restart. */
  runKey: number;
  themeId: ThemeId;
  reducedMotion: boolean;
  showLiveWpm: boolean;
  onFinish: (result: RunResult) => void;
  /** Gives the live engine to companions (virtual keyboard, hands). Called with null on teardown. */
  onEngine?: (engine: TypingEngine | null) => void;
}

/** Particle canvas overhang around the words, so sparks aren't clipped. */
const PAD = 48;

export function TypingSurface(props: TypingSurfaceProps) {
  const {
    mode,
    stopOnError,
    punctuation = false,
    numbers = false,
    seed,
    keyWeights,
    makeSource,
    blind = false,
    runKey,
    themeId,
    reducedMotion,
    showLiveWpm,
  } = props;

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const wordsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const wpmRef = useRef<HTMLSpanElement>(null);
  const comboRef = useRef<HTMLSpanElement>(null);
  const rendererRef = useRef<WordsRenderer | null>(null);
  const onFinishRef = useRef(props.onFinish);
  onFinishRef.current = props.onFinish;
  const onEngineRef = useRef(props.onEngine);
  onEngineRef.current = props.onEngine;

  const [engine, setEngine] = useState<TypingEngine | null>(null);
  const [focused, setFocused] = useState(true);
  const [pasteNotice, setPasteNotice] = useState(false);

  const modeValue = mode.kind === "time" ? mode.seconds : mode.kind === "words" ? mode.count : mode.text;

  // Engine, renderer and input: recreated for every new test.
  useEffect(() => {
    const root = rootRef.current;
    const wordsEl = wordsRef.current;
    const input = inputRef.current;
    if (!root || !wordsEl || !input) return;

    const e = createTypingEngine({
      mode,
      source: makeSource ? makeSource() : wordSource({ punctuation, numbers, seed, keyWeights }),
      stopOnError,
    });
    const renderer = createWordsRenderer(wordsEl, e, getTheme(themeId).config.caret);
    rendererRef.current = renderer;

    let noticeTimer: ReturnType<typeof setTimeout> | undefined;
    const detachInput = attachInput(input, e, {
      onPasteBlocked: () => {
        setPasteNotice(true);
        clearTimeout(noticeTimer);
        noticeTimer = setTimeout(() => setPasteNotice(false), 1800);
      },
    });

    const html = document.documentElement;
    root.dataset.status = "idle";
    const offs = [
      e.on("start", () => {
        root.dataset.status = "running";
        html.dataset.typing = "true";
      }),
      e.on("finish", (r) => {
        root.dataset.status = "finished";
        delete html.dataset.typing;
        onFinishRef.current(r);
      }),
    ];

    // Live stats: read the engine a few times a second and write text directly.
    let lastProgress = "";
    let lastWpm = "";
    const stats = setInterval(() => {
      const s = e.getSnapshot();
      const progress =
        s.remainingMs !== null
          ? String(Math.ceil(s.remainingMs / 1000))
          : `${Math.min(s.wordIndex, s.words.length)}/${s.words.length}`;
      if (progress !== lastProgress && progressRef.current) {
        progressRef.current.textContent = progress;
        lastProgress = progress;
      }
      const wpm = s.status === "running" && s.elapsedMs > 1000 ? String(Math.round(s.liveWpm)) : "";
      if (wpm !== lastWpm && wpmRef.current) {
        wpmRef.current.textContent = wpm;
        lastWpm = wpm;
      }
    }, 100);

    const onMouseMove = () => delete html.dataset.typing;
    window.addEventListener("mousemove", onMouseMove);

    setEngine(e);
    onEngineRef.current?.(e);
    input.focus({ preventScroll: true });

    return () => {
      clearInterval(stats);
      clearTimeout(noticeTimer);
      window.removeEventListener("mousemove", onMouseMove);
      offs.forEach((off) => off());
      detachInput();
      renderer.destroy();
      rendererRef.current = null;
      e.destroy();
      delete html.dataset.typing;
      setEngine(null);
      onEngineRef.current?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mode is tracked by kind + value
  }, [runKey, mode.kind, modeValue, stopOnError, punctuation, numbers, seed, keyWeights, makeSource, themeId]);

  // Theme effects: re-attached when the theme or motion preference changes.
  useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!engine || !root || !stage) return;

    let particles: ParticleLayer | null = null;
    const canvas = canvasRef.current;
    const theme = getTheme(themeId);
    if (canvas && theme.config.particles && !reducedMotion) particles = createParticleLayer(canvas);

    const detach = effectsFor(themeId, reducedMotion)(engine, {
      root,
      stage,
      sound,
      comboEl: comboRef.current,
      reducedMotion,
      config: theme.config,
      particles,
      getCaretPoint: () => {
        const p = rendererRef.current?.getCaretPoint();
        const words = wordsRef.current;
        if (!p || !words) return null;
        return { x: p.x + words.offsetLeft + PAD, y: p.y + words.offsetTop + PAD };
      },
    });

    const onResize = () => particles?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      detach();
      particles?.destroy();
    };
  }, [engine, themeId, reducedMotion]);

  // Typing anywhere refocuses the hidden input.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const input = inputRef.current;
      if (!input || document.activeElement === input) return;
      if (ev.metaKey || ev.ctrlKey || ev.altKey || ev.key.length !== 1) return;
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      input.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const focus = () => inputRef.current?.focus({ preventScroll: true });
  const initialProgress =
    mode.kind === "time"
      ? String(mode.seconds)
      : `0/${mode.kind === "words" ? mode.count : mode.text.trim().split(/\s+/).length}`;

  return (
    <div
      ref={rootRef}
      className="tq-surface"
      data-focused={focused ? "true" : "false"}
      data-status="idle"
      data-blind={blind ? "true" : undefined}
    >
      <div className="mb-3 flex h-9 items-end gap-5 font-mono text-main">
        <span ref={progressRef} className="text-2xl tabular-nums" aria-label="Progress">
          {initialProgress}
        </span>
        <span
          ref={wpmRef}
          className="text-lg tabular-nums text-sub"
          aria-label="Live WPM"
          hidden={!showLiveWpm}
        />
        <span ref={comboRef} className="tq-combo ml-auto text-xl tabular-nums" data-visible="false" aria-live="off" />
      </div>

      <div ref={stageRef} className="relative">
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute"
          style={{ left: -PAD, top: -PAD, width:`calc(100% + ${PAD * 2}px)`, height: `calc(100% + ${PAD * 2}px)` }}
          aria-hidden="true"
        />
        <div ref={wordsRef} className="tq-words" onClick={focus} />
        <input
          ref={inputRef}
          className="tq-input"
          aria-label="Type the words shown"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {!focused && (
          <button type="button" className="tq-focus-overlay" onClick={focus}>
            Click here or press any key to focus
          </button>
        )}
      </div>

      <p className="mt-2 h-5 text-center text-sm text-error transition-opacity" aria-live="polite">
        {pasteNotice ? "Pasting is turned off — type it out!" : ""}
      </p>
    </div>
  );
}
