import { fixedSource } from "./lessonGen";
import { createTypingEngine } from "./typingEngine";
import { KeyKind, type Keystroke, type RunResult, type StopOnError, type TestMode } from "./types";

export interface ReplayInput {
  mode: TestMode;
  words: readonly string[];
  log: readonly Keystroke[];
  stopOnError?: StopOnError;
}

/**
 * Feeds a stored keystroke log back through a headless engine and returns the
 * result it produces. Used for server-side score validation, ghost races and
 * replays: the engine is the single source of truth, so nothing is re-implemented.
 */
export function replayRun(input: ReplayInput): RunResult | null {
  let clock = 0;
  const engine = createTypingEngine({
    mode: input.mode,
    source: fixedSource(input.words),
    stopOnError: input.stopOnError,
    autoTick: false,
    now: () => clock,
  });

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

  if (engine.getSnapshot().status === "running") {
    if (input.mode.kind === "time") {
      clock = input.mode.seconds * 1000;
      engine.tick();
    } else {
      engine.finish();
    }
  }
  const result = engine.getResult();
  engine.destroy();
  return result;
}
