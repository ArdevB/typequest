"use client";

import { LayoutGroup, motion } from "motion/react";
import type { TimeSeconds, WordCount } from "@/engine";
import { useSettings, type SpeedMode } from "@/stores/settingsStore";

const TIMES: readonly TimeSeconds[] = [15, 30, 60, 120];
const COUNTS: readonly WordCount[] = [10, 25, 50, 100];

function Pill(props: { active: boolean; group: string; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.active}
      aria-label={props.label}
      className="relative rounded-md px-2.5 py-1 font-mono text-sm transition-colors hover:text-text aria-pressed:text-bg"
    >
      {props.active && (
        <motion.span
          layoutId={`pill-${props.group}`}
          className="absolute inset-0 rounded-md bg-main"
          transition={{ type: "spring", stiffness: 500, damping: 36 }}
        />
      )}
      <span className="relative">{props.children}</span>
    </button>
  );
}

function Toggle(props: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.on}
      className="rounded-md px-2.5 py-1 font-mono text-sm text-sub transition-colors hover:text-text aria-pressed:text-main"
    >
      {props.children}
    </button>
  );
}

export function ModePicker() {
  const mode = useSettings((s) => s.mode);
  const punctuation = useSettings((s) => s.punctuation);
  const numbers = useSettings((s) => s.numbers);
  const set = useSettings((s) => s.set);
  const setMode = (m: SpeedMode) => set("mode", m);

  return (
    <LayoutGroup id="mode-picker">
      <div className="tq-chrome flex flex-wrap items-center justify-center gap-1 rounded-xl bg-bg-alt/80 px-2 py-1.5 text-sub">
        <Toggle on={punctuation} onClick={() => set("punctuation", !punctuation)}>
          @ punctuation
        </Toggle>
        <Toggle on={numbers} onClick={() => set("numbers", !numbers)}>
          # numbers
        </Toggle>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <Pill group="kind" active={mode.kind === "time"} onClick={() => mode.kind !== "time" && setMode({ kind: "time", seconds: 30 })}>
          time
        </Pill>
        <Pill group="kind" active={mode.kind === "words"} onClick={() => mode.kind !== "words" && setMode({ kind: "words", count: 25 })}>
          words
        </Pill>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        {mode.kind === "time"
          ? TIMES.map((s) => (
              <Pill key={s} group="value" active={mode.seconds === s} onClick={() => setMode({ kind: "time", seconds: s })} label={`${s} seconds`}>
                {s}
              </Pill>
            ))
          : COUNTS.map((c) => (
              <Pill key={c} group="value" active={mode.count === c} onClick={() => setMode({ kind: "words", count: c })} label={`${c} words`}>
                {c}
              </Pill>
            ))}
      </div>
    </LayoutGroup>
  );
}
