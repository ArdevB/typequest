export * from "./types";
export { createTypingEngine, comboTier, type TypingEngine } from "./typingEngine";
export { attachInput, type InputCaptureOptions } from "./inputCapture";
export { computeResults, consistencyFrom, wpmFrom, type ResultInput } from "./metrics";
export { wordSource, fixedSource, weakKeyWeights, drillText, type WordSourceOptions, type DrillOptions } from "./lessonGen";
export { replayRun, replayDetailed, type ReplayInput, type ReplayOutcome } from "./replay";
export { createRng, hashSeed } from "./rng";
export { QWERTY } from "./layouts/qwerty";
export type { KeyboardLayout, KeyDef, Finger, Hand } from "./layouts/types";
