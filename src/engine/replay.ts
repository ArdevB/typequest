import { fixedSource } from "./lessonGen";
import { createTypingEngine, type TypingEngine } from "./typingEngine";
import { KeyKind, type Keystroke, type RunResult, type StopOnError, type TestMode, type WordSource } from "./types";

export interface ReplayInput {
  mode: TestMode;
  log: readonly Keystroke[];
  /** The words of the run, in order. Ignored if `source` is given; unused in text mode. */
  words?: readonly string[];
  /** Regenerates the words (e.g. a seeded wordSource) instead of trusting a stored list. */
  source?: WordSource;
  stopOnError?: StopOnError;
  /** Hooks rules onto the replay engine (chaos modifiers) exactly as the live run had them. */
  attach?: (engine: TypingEngine) => void;
}

export interface ReplayOutcome {
  result: RunResult | null;
  /** The run ended on its own (last word typed / time ran out), not cut short. */
  finishedNaturally: boolean;
}

/**
 * Feeds a stored keystroke log back through a headless engine. Used for
 * server-side score validation, ghost races and replays: the engine is the
 * single source of truth, so nothing is re-implemented.
 */
export function replayDetailed(input: ReplayInput): ReplayOutcome {
  let clock = 0;
  const engine = createTypingEngine({
    mode: input.mode,
    source: input.source ?? fixedSource(input.words ?? []),
    stopOnError: input.stopOnError,
    autoTick: false,
    now: () => clock,
  });
  input.attach?.(engine);

  let finishedNaturally = false;
  for (const [t, key, kind] of input.log) {
    clock = t;
    engine.tick();
    if (engine.getSnapshot().status === "finished") break;
    switch (kind) {
      case KeyKind.Char:
        engine.input(key);
        break;
      case KeyKind.Space:
        engine.space();
        break;
      case KeyKind.Backspace:
        engine.backspace(key === "w");
        break;
      case KeyKind.Rejected:
        engine.rejectInput(key === "drop" ? "drop" : key === "replace" ? "replace" : "paste");
        break;
    }
  }

  if (engine.getSnapshot().status === "finished") {
    finishedNaturally = true;
  } else if (engine.getSnapshot().status === "running") {
    if (input.mode.kind === "time") {
      clock = input.mode.seconds * 1000;
      engine.tick();
      finishedNaturally = true;
    } else {
      engine.finish();
    }
  }
  const result = engine.getResult();
  engine.destroy();
  return { result, finishedNaturally };
}

/** Replays a run and returns only its result. */
export function replayRun(input: ReplayInput): RunResult | null {
  return replayDetailed(input).result;
}
