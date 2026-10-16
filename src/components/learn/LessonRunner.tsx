"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { QWERTY, type RunResult, type TypingEngine } from "@/engine";
import { KeyboardPanel } from "@/components/keyboard/KeyboardPanel";
import { FINGER_NAMES, fingerOf } from "@/components/keyboard/geometry";
import { TypingSurface } from "@/components/typing/TypingSurface";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { getLesson, getUnit, keysTaughtThrough, nextLesson } from "@/lessons/catalog";
import { isUnlocked } from "@/lessons/progress";
import { rateLesson, starGoals, type Stars } from "@/lessons/rating";
import { useHydrated } from "@/stores/hydration";
import { useLessons } from "@/stores/lessonsStore";
import { useSettings } from "@/stores/settingsStore";
import type { SaveState } from "@/components/progress/ProgressStrip";
import { beginSave, saveLesson } from "@/lib/api/client";
import { Mascot } from "@/components/mascot/Mascot";
import { LessonResults } from "./LessonResults";
import { StarRow } from "./StarRow";

type Phase =
  | { kind: "intro" }
  | { kind: "typing" }
  | { kind: "results"; result: RunResult; stars: Stars; previousStars: Stars; save: SaveState };

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

export function LessonRunner({ lessonId }: { lessonId: string }) {
  const lesson = getLesson(lessonId);
  const router = useRouter();
  const ready = useHydrated((s) => s.ready);
  const progress = useLessons((s) => s.progress);
  const record = useLessons((s) => s.record);
  const queueLesson = useLessons((s) => s.queueForSync);
  const themeId = useSettings((s) => s.themeId);
  const showLiveWpm = useSettings((s) => s.showLiveWpm);
  const reducedMotion = useReducedMotion();

  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [seed, setSeed] = useState(newSeed);
  const [runKey, setRunKey] = useState(0);
  const [engine, setEngine] = useState<TypingEngine | null>(null);

  const text = useMemo(() => (lesson ? lesson.build(seed) : ""), [lesson, seed]);
  const mode = useMemo(() => ({ kind: "text" as const, text }), [text]);
  const activeKeys = useMemo(() => (lesson ? keysTaughtThrough(lesson) : undefined), [lesson]);
  const next = lesson ? nextLesson(lesson.id) : undefined;

  const start = useCallback(() => {
    setSeed(newSeed());
    setRunKey((k) => k + 1);
    setPhase({ kind: "typing" });
  }, []);

  const goNext = useCallback(() => {
    if (next) router.push(`/learn/${next.id}`);
  }, [next, router]);

  const onFinish = useCallback(
    (result: RunResult) => {
      if (!lesson) return;
      const stars = rateLesson(lesson, result);
      const outcome = record(lesson.id, { wpm: result.wpm, accuracy: result.accuracy, stars });
      const payload = { lessonId: lesson.id, seed, log: [...result.log] };
      const save = beginSave({
        valid: result.flags.pasteAttempts === 0,
        send: () => saveLesson(payload),
        queue: () => queueLesson(payload, stars),
        update: (next) => setPhase((p) => (p.kind === "results" && p.result === result ? { ...p, save: next } : p)),
      });
      setPhase({ kind: "results", result, stars, previousStars: outcome.previousStars, save });
    },
    [lesson, record, seed, queueLesson],
  );

  // Keyboard: Enter/Space starts from the intro; Tab/Esc restarts; Enter continues from results.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.("[role=dialog]")) return;
      if (phase.kind === "intro" && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        start();
      } else if (e.key === "Tab" || e.key === "Escape") {
        e.preventDefault();
        start();
      } else if (phase.kind === "results" && e.key === "Enter") {
        const t = e.target as HTMLElement | null;
        if (t?.tagName === "BUTTON" || t?.tagName === "A") return; // let the focused button act
        e.preventDefault();
        if (phase.stars > 0 && next) goNext();
        else start();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, start, goNext, next]);

  if (!lesson) return null;
  if (!ready) return <div className="h-96" aria-hidden="true" />;

  if (!isUnlocked(lesson.id, progress)) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-text">This lesson is locked</h1>
        <p className="mt-3 text-sub">Earn at least one star on the lesson before it to open {lesson.title}.</p>
        <Link href="/learn" className="tq-btn tq-btn-primary mt-6">
          Back to lessons
        </Link>
      </div>
    );
  }

  const unit = getUnit(lesson.unit);
  const best = progress[lesson.id];
  const fade = reducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.12 } }
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
        transition: { duration: 0.22 },
      };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
      <nav className="tq-chrome mb-6 flex items-center gap-3 text-sm text-sub" aria-label="Breadcrumb">
        <Link href="/learn" className="hover:text-text">
          ← Lessons
        </Link>
        <span aria-hidden="true">/</span>
        <span>{unit.title}</span>
        <span aria-hidden="true">/</span>
        <span className="text-text">
          {lesson.number}. {lesson.title}
        </span>
        {best && best.stars > 0 && <StarRow stars={best.stars} size={14} className="ml-auto" />}
      </nav>

      <AnimatePresence mode="wait" initial={false}>
        {phase.kind === "intro" && (
          <motion.section key="intro" {...fade} className="mx-auto w-full max-w-2xl text-center" aria-labelledby="lesson-title">
            <p className="font-mono text-sm text-main">
              Lesson {lesson.number} · {unit.title}
            </p>
            <h1 id="lesson-title" className="mt-2 font-display text-3xl font-bold text-text sm:text-4xl">
              {lesson.title}
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-sub">{lesson.intro}</p>

            {lesson.newKeys && (
              <ul className="mt-6 flex flex-wrap justify-center gap-3" aria-label="New keys">
                {[...lesson.newKeys].map((k) => {
                  const def = QWERTY.byChar.get(k);
                  const finger = def ? fingerOf(def) : null;
                  return (
                    <li key={k} className="flex flex-col items-center gap-1.5" data-finger={finger ?? undefined}>
                      <span className="tq-keycap">{/^[a-z]$/.test(k) ? k.toUpperCase() : k}</span>
                      <span className="max-w-24 text-xs text-sub">{finger ? FINGER_NAMES[finger] : ""}</span>
                    </li>
                  );
                })}
              </ul>
            )}

            <ul className="mx-auto mt-6 flex max-w-md flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-sub">
              {starGoals(lesson).map((g) => (
                <li key={g.stars} className="flex items-center gap-1.5">
                  <StarRow stars={g.stars} size={11} />
                  {g.accuracy}%{g.wpm > 0 ? ` · ${g.wpm} wpm` : ""}
                </li>
              ))}
            </ul>

            <button type="button" className="tq-btn tq-btn-primary mt-7 text-lg" onClick={start} autoFocus>
              Start <kbd>Enter</kbd>
            </button>
          </motion.section>
        )}

        {phase.kind === "typing" && (
          <motion.div key={`typing-${runKey}`} {...fade}>
            <TypingSurface
              mode={mode}
              stopOnError="letter"
              runKey={runKey}
              themeId={themeId}
              reducedMotion={reducedMotion}
              showLiveWpm={showLiveWpm}
              onFinish={onFinish}
              onEngine={setEngine}
            />
            <p className="tq-chrome mt-2 text-center text-xs text-sub">
              Wrong keys don&apos;t move you forward — find the right one. <kbd>Tab</kbd> restarts.
            </p>
          </motion.div>
        )}

        {phase.kind === "results" && (
          <motion.div key={`results-${runKey}`} {...fade}>
            <LessonResults
              lesson={lesson}
              result={phase.result}
              stars={phase.stars}
              previousStars={phase.previousStars}
              save={phase.save}
              next={next}
              themeId={themeId}
              reducedMotion={reducedMotion}
              onRetry={start}
              onNext={goNext}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {phase.kind !== "results" && (
        <div className="mt-4">
          <KeyboardPanel
            engine={phase.kind === "typing" ? engine : null}
            activeKeys={activeKeys}
            highlight={phase.kind === "intro" ? lesson.newKeys : undefined}
            reducedMotion={reducedMotion}
          />
        </div>
      )}
      <Mascot
        variant="dock"
        size={72}
        engine={phase.kind === "typing" ? engine : null}
        mood={phase.kind === "results" ? (phase.stars > 0 ? "cheer" : "sad") : "idle"}
        tip={
          phase.kind === "intro"
            ? "Eyes on the screen, fingers on the home row. You've got this."
            : phase.kind === "results"
              ? phase.stars === 3
                ? "Three stars! Flawless."
                : phase.stars > 0
                  ? "Passed! Go again for more stars, or move on."
                  : "Almost. Slow and accurate beats fast and messy."
              : undefined
        }
      />
    </div>
  );
}
