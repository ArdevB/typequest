"use client";

import gsap from "gsap";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { attachGuard, type GuardFailure } from "@/challenges/guard";
import type { ChallengeSetup, Outcome } from "@/challenges/types";
import type { RunResult, TypingEngine } from "@/engine";
import { ProgressStrip, type SaveState } from "@/components/progress/ProgressStrip";
import { TypingSurface } from "@/components/typing/TypingSurface";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { beginSave, saveChallenge } from "@/lib/api/client";
import { celebrate } from "@/lib/confetti";
import type { ChallengePayload } from "@/lib/payloads";
import { sound } from "@/lib/sound";
import { useSettings } from "@/stores/settingsStore";
import { getTheme } from "@/themes/registry";

type Phase =
  | { kind: "intro" }
  | { kind: "typing" }
  | { kind: "results"; result: RunResult; outcome: Outcome; save: SaveState };

export interface ChallengeRunnerProps {
  /** Shown on the intro screen above the Start button. */
  intro: ReactNode;
  setup: ChallengeSetup;
  /** Fixed seed (daily) or a new one per attempt (skills). */
  seed: number | (() => number);
  keyWeights?: Readonly<Record<string, number>>;
  evaluate: (result: RunResult, finishedNaturally: boolean) => Outcome;
  payload: (args: { log: RunResult["log"]; seed: number }) => ChallengePayload;
  /** Local bookkeeping after an attempt (guest progress). */
  onAttempt?: (result: RunResult, outcome: Outcome) => void;
  /** Extra content under the results (e.g. the daily leaderboard). */
  resultsExtra?: ReactNode;
  backHref?: string;
}

const pickSeed = (s: number | (() => number)) => (typeof s === "function" ? s() : s);

export function ChallengeRunner(props: ChallengeRunnerProps) {
  const { setup, evaluate, payload, onAttempt } = props;
  const themeId = useSettings((s) => s.themeId);
  const showLiveWpm = useSettings((s) => s.showLiveWpm);
  const reducedMotion = useReducedMotion();

  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [runKey, setRunKey] = useState(0);
  const [seed, setSeed] = useState(() => pickSeed(props.seed));
  const [engine, setEngine] = useState<TypingEngine | null>(null);
  const failure = useRef<GuardFailure | null>(null);
  const seedProp = props.seed;

  const start = useCallback(() => {
    setSeed(pickSeed(seedProp));
    failure.current = null;
    setRunKey((k) => k + 1);
    setPhase({ kind: "typing" });
  }, [seedProp]);

  // Live rules (sudden death, speed gate) ride on the engine.
  useEffect(() => {
    if (!engine) return;
    return attachGuard(engine, setup.guard, (why) => {
      failure.current = why;
      sound.play("error", false);
    });
  }, [engine, setup.guard]);

  const onFinish = useCallback(
    (result: RunResult) => {
      const natural = failure.current === null;
      const outcome = evaluate(result, natural);
      onAttempt?.(result, outcome);
      const body = payload({ log: [...result.log], seed });
      const save = beginSave({
        valid: result.flags.pasteAttempts === 0,
        send: () => saveChallenge(body),
        queue: () => {},
        update: (next) =>
          setPhase((p) => {
            if (p.kind !== "results" || p.result !== result) return p;
            // The server's verdict wins if it differs.
            const server =
              next.state === "saved" && next.data.passed !== undefined
                ? { passed: next.data.passed, reason: next.data.reason ?? p.outcome.reason }
                : p.outcome;
            return { ...p, save: next, outcome: server };
          }),
      });
      setPhase({ kind: "results", result, outcome, save });
    },
    [evaluate, onAttempt, payload, seed],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.("[role=dialog]")) return;
      const t = e.target as HTMLElement | null;
      if (phase.kind === "intro" && (e.key === "Enter" || e.key === " ")) {
        if (t?.tagName === "A" || t?.tagName === "BUTTON" && !t.classList.contains("tq-btn-primary")) return;
        e.preventDefault();
        start();
      } else if (e.key === "Tab" || e.key === "Escape") {
        if (phase.kind === "intro") return;
        e.preventDefault();
        start();
      } else if (phase.kind === "results" && e.key === "Enter") {
        if (t?.tagName === "A" || (t?.tagName === "BUTTON" && !t.classList.contains("tq-btn-primary"))) return;
        e.preventDefault();
        start();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase.kind, start]);

  const fade = reducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.12 } }
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.22 } };

  const mode = useMemo(() => setup.mode, [setup.mode]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {phase.kind === "intro" && (
        <motion.section key="intro" {...fade} className="mx-auto w-full max-w-2xl text-center">
          {props.intro}
          <button type="button" className="tq-btn tq-btn-primary mt-7 text-lg" onClick={start} autoFocus>
            Start <kbd>Enter</kbd>
          </button>
        </motion.section>
      )}

      {phase.kind === "typing" && (
        <motion.div key={`typing-${runKey}`} {...fade}>
          <TypingSurface
            mode={mode}
            seed={seed}
            punctuation={setup.punctuation}
            numbers={setup.numbers}
            stopOnError={setup.stopOnError}
            keyWeights={setup.guard.adaptive ? props.keyWeights : undefined}
            blind={setup.guard.blind}
            runKey={runKey}
            themeId={themeId}
            reducedMotion={reducedMotion}
            showLiveWpm={showLiveWpm && !setup.guard.blind}
            onFinish={onFinish}
            onEngine={setEngine}
          />
          <p className="tq-chrome mt-6 text-center text-xs text-sub">
            <kbd>Tab</kbd> or <kbd>Esc</kbd> — restart
          </p>
        </motion.div>
      )}

      {phase.kind === "results" && (
        <motion.div key={`results-${runKey}`} {...fade}>
          <ChallengeResults
            result={phase.result}
            outcome={phase.outcome}
            save={phase.save}
            reducedMotion={reducedMotion}
            themeId={themeId}
            onRetry={start}
            backHref={props.backHref ?? "/challenges"}
          />
          {props.resultsExtra}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ChallengeResults(p: {
  result: RunResult;
  outcome: Outcome;
  save: SaveState;
  reducedMotion: boolean;
  themeId: string;
  onRetry: () => void;
  backHref: string;
}) {
  const stampRef = useRef<HTMLSpanElement>(null);
  const { passed, reason } = p.outcome;

  useLayoutEffect(() => {
    const el = stampRef.current;
    if (!el || p.reducedMotion) return;
    const tween = gsap.fromTo(
      el,
      { scale: 2.6, rotate: -18, opacity: 0 },
      { scale: 1, rotate: -4, opacity: 1, duration: 0.4, ease: "power4.in", delay: 0.15 },
    );
    if (passed) {
      const t = getTheme(p.themeId).config;
      tween.eventCallback("onComplete", () => void celebrate(t.particles?.colors ?? [t.colors.main, t.colors.combo3]));
    }
    return () => {
      tween.kill();
    };
  }, [passed, p.reducedMotion, p.themeId]);

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col items-center text-center" aria-label="Challenge result">
      <span ref={stampRef} className="tq-verdict" data-passed={passed}>
        {passed ? "CLEARED" : "FAILED"}
      </span>
      <p className="mt-4 text-text" role="status">
        {reason}
      </p>
      <dl className="mt-6 grid w-full grid-cols-3 gap-4">
        <Stat label="wpm" value={Math.round(p.result.wpm)} />
        <Stat label="accuracy" value={`${Math.round(p.result.accuracy)}%`} />
        <Stat label="time" value={`${(p.result.durationMs / 1000).toFixed(1)}s`} />
      </dl>
      <div className="w-full">
        <ProgressStrip save={p.save} reducedMotion={p.reducedMotion} />
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" className="tq-btn tq-btn-primary" onClick={p.onRetry} autoFocus>
          Try again <kbd>Enter</kbd>
        </button>
        <Link href={p.backHref} className="tq-btn">
          All challenges
        </Link>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.18em] text-sub">{label}</dt>
      <dd className="font-mono text-3xl tabular-nums text-main">{value}</dd>
    </div>
  );
}
