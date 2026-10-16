"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import type { RunResult } from "@/engine";
import { ResultsScreen } from "@/components/results/ResultsScreen";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useHistory, type RunOutcome } from "@/stores/historyStore";
import { useHydrated } from "@/stores/hydration";
import { useSettings } from "@/stores/settingsStore";
import { ModePicker } from "./ModePicker";
import { TypingSurface } from "./TypingSurface";

type View = { kind: "typing" } | { kind: "results"; result: RunResult; outcome: RunOutcome };

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

  const [view, setView] = useState<View>({ kind: "typing" });
  const [runKey, setRunKey] = useState(0);
  const [repeatWords, setRepeatWords] = useState<readonly string[] | null>(null);

  const restart = useCallback((repeat: readonly string[] | null = null) => {
    setRepeatWords(repeat);
    setRunKey((k) => k + 1);
    setView({ kind: "typing" });
  }, []);

  const onFinish = useCallback(
    (result: RunResult) => setView({ kind: "results", result, outcome: addRun(result) }),
    [addRun],
  );

  // Changing mode or options always starts fresh words.
  useEffect(() => {
    setRepeatWords(null);
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
                  repeatWords={repeatWords}
                  runKey={runKey}
                  themeId={themeId}
                  reducedMotion={reducedMotion}
                  showLiveWpm={showLiveWpm}
                  onFinish={onFinish}
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
                  onRepeat={() => restart(view.result.words)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
