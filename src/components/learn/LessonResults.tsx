"use client";

import gsap from "gsap";
import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import type { RunResult } from "@/engine";
import type { Lesson } from "@/lessons/catalog";
import { starGoals, type Stars } from "@/lessons/rating";
import { celebrate } from "@/lib/confetti";
import { sound } from "@/lib/sound";
import { getTheme } from "@/themes/registry";
import type { ThemeId } from "@/themes/types";
import { ProgressStrip, type SaveState } from "@/components/progress/ProgressStrip";
import { StarRow } from "./StarRow";

interface Props {
  lesson: Lesson;
  result: RunResult;
  stars: Stars;
  previousStars: Stars;
  next: Lesson | undefined;
  themeId: ThemeId;
  reducedMotion: boolean;
  onRetry: () => void;
  onNext: () => void;
  save: SaveState;
}

const HEADLINES: Record<Stars, string> = {
  0: "Almost there",
  1: "Lesson passed",
  2: "Nice work!",
  3: "Perfect!",
};

export function LessonResults(p: Props) {
  const { lesson, result, stars, previousStars, next, reducedMotion } = p;
  const rootRef = useRef<HTMLElement>(null);
  const starsRef = useRef<HTMLDivElement>(null);
  const goals = starGoals(lesson);
  const passed = stars > 0;
  const unlocked = passed && previousStars === 0 && next;

  useLayoutEffect(() => {
    const root = rootRef.current;
    const starEls = starsRef.current ? Array.from(starsRef.current.querySelectorAll<SVGElement>(".tq-star")) : [];
    if (!root) return;
    const ctx = gsap.context(() => {
      if (reducedMotion) return;
      const tl = gsap.timeline();
      tl.from(".lr-item", { y: 18, opacity: 0, duration: 0.45, stagger: 0.06, ease: "power3.out" });
      starEls.forEach((s, i) => {
        const on = i < stars;
        tl.fromTo(
          s,
          { scale: 0, rotate: -120, opacity: 0 },
          {
            scale: 1,
            rotate: 0,
            opacity: 1,
            duration: on ? 0.5 : 0.3,
            ease: on ? "back.out(2.6)" : "power2.out",
            onStart: () => {
              if (on) sound.play("combo", false);
            },
          },
          0.35 + i * 0.28,
        );
      });
      if (stars === 3) {
        const t = getTheme(p.themeId).config;
        tl.call(() => void celebrate(t.particles?.colors ?? [t.colors.main, t.colors.combo3]), [], "+=0.05");
      }
    }, root);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate once per result
  }, [result]);

  return (
    <section ref={rootRef} className="mx-auto flex w-full max-w-xl flex-col items-center text-center" aria-label="Lesson results">
      <p className="lr-item font-mono text-sm text-sub">
        Lesson {lesson.number} · {lesson.title}
      </p>
      <h2 className="lr-item mt-2 font-display text-3xl font-bold text-text">{HEADLINES[stars]}</h2>

      <StarRow ref={starsRef} stars={stars} size={64} className="my-6" />

      <dl className="lr-item grid w-full grid-cols-3 gap-4">
        <Stat label="wpm" value={Math.round(result.wpm)} />
        <Stat label="accuracy" value={`${Math.round(result.accuracy)}%`} />
        <Stat label="time" value={`${(result.durationMs / 1000).toFixed(1)}s`} />
      </dl>

      <ul className="lr-item mt-6 w-full space-y-1.5 text-left text-sm">
        {goals.map((g) => {
          const met = stars >= g.stars;
          return (
            <li key={g.stars} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2" data-met={met}>
              <StarRow stars={g.stars} size={12} className="w-12 shrink-0" />
              <span className={met ? "text-text" : "text-sub"}>
                {g.accuracy}% accuracy{g.wpm > 0 ? ` and ${g.wpm} WPM` : ""}
              </span>
              <span className="ml-auto" aria-label={met ? "achieved" : "not yet"}>
                {met ? "✓" : ""}
              </span>
            </li>
          );
        })}
      </ul>

      {!passed && (
        <p className="lr-item mt-4 text-sm text-sub">
          Slow down a little. Accuracy matters more than speed while you learn.
        </p>
      )}
      {unlocked && <p className="lr-item mt-4 font-display text-main">Next lesson unlocked: {next.title}</p>}

      <div className="w-full">
        <ProgressStrip save={p.save} reducedMotion={reducedMotion} />
      </div>

      <div className="lr-item mt-6 flex flex-wrap justify-center gap-3">
        {passed && next ? (
          <>
            <button type="button" className="tq-btn tq-btn-primary" onClick={p.onNext} autoFocus>
              Next lesson <kbd>Enter</kbd>
            </button>
            <button type="button" className="tq-btn" onClick={p.onRetry}>
              Try again
            </button>
          </>
        ) : (
          <button type="button" className="tq-btn tq-btn-primary" onClick={p.onRetry} autoFocus>
            Try again <kbd>Enter</kbd>
          </button>
        )}
        <Link href="/learn" className="tq-btn">
          All lessons
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
