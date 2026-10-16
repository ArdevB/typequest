"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { UNITS, lessonsFor, lessonsInUnit, type Lesson } from "@/lessons/catalog";
import { useSettings } from "@/stores/settingsStore";
import { currentLessonId, isUnlocked } from "@/lessons/progress";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useHydrated } from "@/stores/hydration";
import { useLessons, type LessonProgress } from "@/stores/lessonsStore";
import { StarRow } from "./StarRow";

/** Horizontal offsets (px) for the winding path; repeats every 4 nodes. */
const OFFSETS = [0, 64, 0, -64];
const STEP = 104;
const PATH_W = 360;

function nodePoints(count: number) {
  return Array.from({ length: count }, (_, i) => ({ x: PATH_W / 2 + (OFFSETS[i % 4] ?? 0), y: 44 + i * STEP }));
}

function pathD(points: { x: number; y: number }[]): string {
  return points
    .map((p, i) => {
      if (i === 0) return `M${p.x},${p.y}`;
      const prev = points[i - 1]!;
      const my = (prev.y + p.y) / 2;
      return `C${prev.x},${my} ${p.x},${my} ${p.x},${p.y}`;
    })
    .join(" ");
}

export function LessonPath() {
  const ready = useHydrated((s) => s.ready);
  const progress = useLessons((s) => s.progress);
  const reducedMotion = useReducedMotion();
  const layoutId = useSettings((s) => s.layout);
  const LESSONS = lessonsFor(layoutId);
  const current = ready ? currentLessonId(progress) : LESSONS[0]?.id ?? null;
  const totalStars = Object.values(progress).reduce((n, p) => n + p.stars, 0);
  const currentLesson = LESSONS.find((l) => l.id === current);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="flex flex-col items-center py-8 text-center">
        <h1 className="font-display text-4xl font-black tracking-wide text-text">Learn to type</h1>
        <p className="mt-3 max-w-md text-sub">
          Start on the home row and work up to full sentences. Earn a star on each lesson to unlock the next one.
        </p>
        <div className="mt-5 flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-mono text-text">
            <StarRow stars={1} size={18} className="[&>svg:not(:first-child)]:hidden" />
            {ready ? totalStars : 0} / {LESSONS.length * 3}
          </span>
          {currentLesson && (
            <Link href={`/learn/${currentLesson.id}`} className="tq-btn tq-btn-primary">
              {totalStars > 0 ? "Continue" : "Start"}: {currentLesson.title}
            </Link>
          )}
        </div>
      </header>

      {UNITS.map((unit) => {
        const lessons = lessonsInUnit(unit.id, layoutId);
        const points = nodePoints(lessons.length);
        const height = (points.at(-1)?.y ?? 0) + 60;
        const unitStars = lessons.reduce((n, l) => n + (progress[l.id]?.stars ?? 0), 0);
        return (
          <section key={unit.id} className="mb-6" aria-labelledby={`unit-${unit.id}`}>
            <div className="mx-auto mb-2 flex max-w-md items-end justify-between border-b border-border pb-2">
              <div>
                <h2 id={`unit-${unit.id}`} className="font-display text-xl font-bold text-text">
                  {unit.title}
                </h2>
                <p className="text-sm text-sub">{unit.description}</p>
              </div>
              <span className="shrink-0 font-mono text-sm text-sub">
                {ready ? unitStars : 0}/{lessons.length * 3} ★
              </span>
            </div>

            <div className="relative mx-auto" style={{ width: PATH_W, height, maxWidth: "100%" }}>
              <svg className="absolute inset-0 overflow-visible" width={PATH_W} height={height} aria-hidden="true">
                <path d={pathD(points)} fill="none" stroke="var(--border)" strokeWidth={6} strokeLinecap="round" strokeDasharray="2 14" />
              </svg>
              <ol>
                {lessons.map((lesson, i) => (
                  <PathNode
                    key={lesson.id}
                    lesson={lesson}
                    point={points[i]!}
                    side={(OFFSETS[i % 4] ?? 0) > 0 ? "left" : "right"}
                    progress={ready ? progress[lesson.id] : undefined}
                    unlocked={ready ? isUnlocked(lesson.id, progress) : lesson.number === 1}
                    current={lesson.id === current}
                    reducedMotion={reducedMotion}
                  />
                ))}
              </ol>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function PathNode(props: {
  lesson: Lesson;
  point: { x: number; y: number };
  side: "left" | "right";
  progress: LessonProgress | undefined;
  unlocked: boolean;
  current: boolean;
  reducedMotion: boolean;
}) {
  const { lesson, point, side, progress, unlocked, current, reducedMotion } = props;
  const stars = progress?.stars ?? 0;
  const state = !unlocked ? "locked" : stars > 0 ? "done" : current ? "current" : "open";
  const label = `Lesson ${lesson.number}: ${lesson.title}${unlocked ? `, ${stars} of 3 stars` : ", locked"}`;

  const circle = (
    <motion.span
      className="tq-node"
      data-state={state}
      whileHover={unlocked && !reducedMotion ? { scale: 1.08 } : undefined}
      whileTap={unlocked && !reducedMotion ? { scale: 0.94 } : undefined}
    >
      {state === "locked" ? <LockIcon /> : state === "done" && stars === 3 ? "★" : lesson.number}
    </motion.span>
  );

  return (
    <li className="absolute" style={{ left: point.x, top: point.y, transform: "translate(-50%, -50%)" }}>
      {unlocked ? (
        <Link href={`/learn/${lesson.id}`} aria-label={label} className="block rounded-full">
          {circle}
        </Link>
      ) : (
        <span aria-label={label} role="img">
          {circle}
        </span>
      )}
      <div
        className={`pointer-events-none absolute top-1/2 w-36 -translate-y-1/2 ${side === "left" ? "right-full mr-4 text-right" : "left-full ml-4 text-left"}`}
      >
        <p className={`text-sm font-medium leading-tight ${unlocked ? "text-text" : "text-sub"}`}>{lesson.title}</p>
        {unlocked && <StarRow stars={stars} size={13} className={`mt-1 ${side === "left" ? "justify-end" : ""}`} />}
      </div>
    </li>
  );
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
