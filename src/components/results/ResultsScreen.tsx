"use client";

import gsap from "gsap";
import { useLayoutEffect, useRef } from "react";
import type { RunResult } from "@/engine";
import { celebrate } from "@/lib/confetti";
import { gradeFor, modeLabel } from "@/lib/grade";
import type { RunOutcome } from "@/stores/historyStore";
import { getTheme } from "@/themes/registry";
import type { ThemeId } from "@/themes/types";
import { ConsistencyChart } from "./ConsistencyChart";
import { GradeStamp } from "./GradeStamp";

interface Props {
  result: RunResult;
  outcome: RunOutcome;
  themeId: ThemeId;
  reducedMotion: boolean;
  onNext: () => void;
  onRepeat: () => void;
}

const fmtInt = (v: number) => String(Math.round(v));
const fmtPct = (v: number) => `${Math.round(v)}%`;

function recordMessage(result: RunResult, o: RunOutcome): { text: string; tone: "pb" | "off" | "first" | "void" } {
  if (!o.valid) {
    return {
      text: result.flags.pasteAttempts > 0 ? "Pasted text was blocked, so this run doesn't count." : "This run doesn't count toward records.",
      tone: "void",
    };
  }
  if (o.isPB) {
    if (o.previousBest === null) return { text: "First run in this mode — that's your record to beat.", tone: "first" };
    return { text: `New personal best! +${(result.wpm - o.previousBest).toFixed(1)} WPM over your old record.`, tone: "pb" };
  }
  const off = (o.previousBest ?? 0) - result.wpm;
  return { text: `You were ${off.toFixed(1)} WPM off your record (${Math.round(o.previousBest ?? 0)}).`, tone: "off" };
}

export function ResultsScreen({ result, outcome, themeId, reducedMotion, onNext, onRepeat }: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const stampRef = useRef<HTMLDivElement>(null);
  const grade = gradeFor(result.wpm, result.accuracy);
  const record = recordMessage(result, outcome);
  const celebrateRun = outcome.isPB;

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const counters = Array.from(root.querySelectorAll<HTMLElement>("[data-count]"));
    const format = (el: HTMLElement, v: number) => (el.dataset.fmt === "pct" ? fmtPct(v) : fmtInt(v));

    const ctx = gsap.context(() => {
      if (reducedMotion) {
        counters.forEach((el) => (el.textContent = format(el, Number(el.dataset.count))));
        gsap.from(".r-item", { opacity: 0, duration: 0.25 });
        return;
      }
      const tl = gsap.timeline();
      tl.from(".r-item", { y: 26, opacity: 0, duration: 0.55, stagger: 0.05, ease: "power3.out" });
      counters.forEach((el) => {
        const obj = { v: 0 };
        tl.to(
          obj,
          {
            v: Number(el.dataset.count),
            duration: 1.15,
            ease: "power3.out",
            onUpdate: () => {
              el.textContent = format(el, obj.v);
            },
          },
          0.15,
        );
      });
      if (stampRef.current) {
        tl.fromTo(
          stampRef.current,
          { scale: 3.4, rotate: -40, opacity: 0 },
          { scale: 1, rotate: -12, opacity: 1, duration: 0.42, ease: "power4.in" },
          1.0,
        );
        tl.to(cardRef.current, { keyframes: { x: [0, -7, 6, -3, 0], y: [0, 3, -2, 1, 0] }, duration: 0.3, ease: "none" });
        tl.fromTo(stampRef.current, { "--ring": 0 }, { "--ring": 1, duration: 0.6, ease: "power2.out" }, "<");
      }
      if (celebrateRun) tl.call(() => void celebrate(getTheme(themeId).config.particles?.colors ?? [getTheme(themeId).config.colors.main]), [], ">-0.2");
    }, root);
    return () => ctx.revert();
  }, [reducedMotion, celebrateRun, themeId]);

  const { correct, incorrect, extra, missed } = result.chars;

  return (
    <section ref={rootRef} className="tq-results mx-auto w-full max-w-5xl" aria-label="Test results">
      <div ref={cardRef} className="relative grid gap-6 md:grid-cols-[200px_1fr]">
        <div className="flex flex-row gap-8 md:flex-col md:gap-4">
          <BigStat label="wpm" value={result.wpm} title={result.wpm.toFixed(2)} />
          <BigStat label="acc" value={result.accuracy} fmt="pct" title={`${result.accuracy.toFixed(2)}%`} />
        </div>
        <div className="r-item min-w-0">
          <ConsistencyChart data={result.perSecond} reducedMotion={reducedMotion} />
        </div>
        <div className="absolute -top-4 right-0 md:-top-10">
          <GradeStamp ref={stampRef} grade={grade} />
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
        <SmallStat label="test type" value={modeLabel(result.mode)} />
        <SmallStat label="raw" value={fmtInt(result.rawWpm)} count={result.rawWpm} title={result.rawWpm.toFixed(2)} />
        <SmallStat label="consistency" value={fmtPct(result.consistency)} count={result.consistency} fmt="pct" />
        <SmallStat
          label="characters"
          value={`${correct}/${incorrect}/${extra}/${missed}`}
          title="correct / incorrect / extra / missed"
        />
        <SmallStat label="max combo" value={String(result.maxCombo)} count={result.maxCombo} />
        <SmallStat label="time" value={`${(result.durationMs / 1000).toFixed(1)}s`} />
      </dl>

      <p className="r-item mt-6 text-center font-display text-lg" data-tone={record.tone}>
        <span className="tq-record">{record.text}</span>
      </p>

      <div className="r-item mt-6 flex flex-wrap items-center justify-center gap-3">
        <button type="button" className="tq-btn tq-btn-primary" onClick={onNext} autoFocus>
          Next test <kbd>Enter</kbd>
        </button>
        <button type="button" className="tq-btn" onClick={onRepeat}>
          Repeat these words
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-sub">
        <kbd>Tab</kbd> or <kbd>Esc</kbd> also starts a new test
      </p>
    </section>
  );
}

function BigStat({ label, value, fmt, title }: { label: string; value: number; fmt?: "pct"; title: string }) {
  return (
    <div className="r-item" title={title}>
      <div className="font-display text-sm uppercase tracking-[0.2em] text-sub">{label}</div>
      <div className="tq-big font-mono tabular-nums text-main" data-count={value} data-fmt={fmt}>
        {fmt === "pct" ? fmtPct(value) : fmtInt(value)}
      </div>
    </div>
  );
}

function SmallStat(p: { label: string; value: string; count?: number; fmt?: "pct"; title?: string }) {
  return (
    <div className="r-item" title={p.title}>
      <dt className="text-xs uppercase tracking-[0.18em] text-sub">{p.label}</dt>
      <dd className="font-mono text-2xl tabular-nums text-text" data-count={p.count} data-fmt={p.fmt}>
        {p.value}
      </dd>
    </div>
  );
}
