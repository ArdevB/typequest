"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import type { RunResult, TypingEngine } from "@/engine";
import { Mascot } from "@/components/mascot/Mascot";
import { resultTip } from "@/components/mascot/tips";
import type { SaveState } from "@/components/progress/ProgressStrip";
import { ResultsScreen } from "@/components/results/ResultsScreen";
import { beginSave, saveRun } from "@/lib/api/client";
import type { RunPayload } from "@/lib/payloads";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useHistory, type RunOutcome } from "@/stores/historyStore";
import { useHydrated } from "@/stores/hydration";
import { useSettings } from "@/stores/settingsStore";
import { ModePicker } from "./ModePicker";
import { TypingSurface } from "./TypingSurface";

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

type View = { kind: "typing" } | { kind: "results"; result: RunResult; outcome: RunOutcome; save: SaveState };

export function SpeedTest() {
  const ready = useHydrated((s) => s.ready);
  const mode = useSettings((s) => s.mode);
  const stopOnError = useSettings((s) => s.stopOnError);
  const punctuation = useSettings((s) => s.punctuation);
  const numbers = useSettings((s) => s.numbers);
  const themeId = useSettings((s) => s.themeId);
  const showLiveWpm = useSettings((s) => s.showLiveWpm);
  const reducedMotion = useReducedMotion();
  const addRun = useHistory((s) => s.addRun);
  const queueForSync = useHistory((s) => s.queueForSync);

  const [view, setView] = useState<View>({ kind: "typing" });
  const [runKey, setRunKey] = useState(0);
  // Same seed = same words ("repeat"); the server also uses it to verify the run.
  const [seed, setSeed] = useState(newSeed);
  const [engine, setEngine] = useState<TypingEngine | null>(null);

  const restart = useCallback((repeat = false) => {
    if (!repeat) setSeed(newSeed());
    setRunKey((k) => k + 1);
    setView({ kind: "typing" });
  }, []);

  const onFinish = useCallback(
    (result: RunResult) => {
      const outcome = addRun(result);
      const payload: RunPayload = {
        mode,
        seed,
        punctuation,
        numbers,
        stopOnError,
        log: [...result.log],
        clientId: outcome.summary.id,
        at: outcome.summary.at,
      };
      const save = beginSave({
        valid: outcome.valid,
        send: () => saveRun(payload),
        queue: () => queueForSync(payload),
        update: (next) =>
          setView((v) => (v.kind === "results" && v.outcome.summary.id === outcome.summary.id ? { ...v, save: next } : v)),
      });
      setView({ kind: "results", result, outcome, save });
    },
    [addRun, queueForSync, mode, seed, punctuation, numbers, stopOnError],
  );

  // Changing mode or options always starts fresh words.
  useEffect(() => {
    setSeed(newSeed());
    setView({ kind: "typing" });
  }, [mode, punctuation, numbers, stopOnError]);

  // Tab / Esc restart anywhere; Enter on results goes to the next test.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab" || e.key === "Escape") {
        if ((e.target as HTMLElement | null)?.closest?.("[role=dialog]")) return;
        e.preventDefault();
        restart();
      } else if (e.key === "Enter" && view.kind === "results") {
        const t = e.target as HTMLElement | null;
        if (t?.tagName === "BUTTON" && !t.classList.contains("tq-btn-primary")) return;
        e.preventDefault();
        restart();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [restart, view.kind]);

  const fade = reducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.12 } }
    : {
        initial: { opacity: 0, y: 14, filter: "blur(4px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)" },
        exit: { opacity: 0, y: -10, filter: "blur(4px)" },
        transition: { duration: 0.22, ease: [0.2, 0.7, 0.3, 1] as const },
      };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
      <div className="flex justify-center">
        <ModePicker />
      </div>

      <div className="flex flex-1 flex-col justify-center py-10">
        {!ready ? (
          <div className="tq-words-skeleton" aria-hidden="true" />
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            {view.kind === "typing" ? (
              <motion.div key={`typing-${runKey}`} {...fade}>
                <TypingSurface
                  mode={mode}
                  stopOnError={stopOnError}
                  punctuation={punctuation}
                  numbers={numbers}
                  seed={seed}
                  runKey={runKey}
                  themeId={themeId}
                  reducedMotion={reducedMotion}
                  showLiveWpm={showLiveWpm}
                  onFinish={onFinish}
                  onEngine={setEngine}
                />
                <p className="tq-chrome mt-8 text-center text-xs text-sub">
                  <kbd>Tab</kbd> or <kbd>Esc</kbd> — restart
                </p>
              </motion.div>
            ) : (
              <motion.div key={`results-${runKey}`} {...fade}>
                <ResultsScreen
                  result={view.result}
                  outcome={view.outcome}
                  themeId={themeId}
                  reducedMotion={reducedMotion}
                  onNext={() => restart()}
                  onRepeat={() => restart(true)}
                  save={view.save}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
      {ready && (
        <Mascot
          variant="dock"
          size={76}
          engine={view.kind === "typing" ? engine : null}
          mood={view.kind === "results" ? (view.outcome.isPB ? "cheer" : view.result.accuracy >= 90 ? "happy" : "sad") : "idle"}
          tip={view.kind === "results" ? resultTip(view.result, view.outcome) : undefined}
        />
      )}
    </div>
  );
}
