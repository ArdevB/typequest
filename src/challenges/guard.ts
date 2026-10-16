import { wpmFrom, type TypingEngine } from "@/engine";
import type { Guard } from "./types";

export type GuardFailure = "mistake" | "gate";

/**
 * Applies a challenge's live rules to an engine: ends the run on the first
 * mistake (Perfect Run, Sudden Death) or when speed drops under the gate.
 * Pure TS on top of engine events. Pass/fail is still decided afterwards by
 * the challenge's evaluate() (on the client and again on the server).
 */
export function attachGuard(
  engine: TypingEngine,
  guard: Guard,
  onFail: (why: GuardFailure) => void,
): () => void {
  const offs: (() => void)[] = [];
  let failed = false;
  const fail = (why: GuardFailure) => {
    if (failed) return;
    failed = true;
    onFail(why);
    engine.finish();
  };

  if (guard.failOnError) {
    offs.push(engine.on("error", () => fail("mistake")));
  }

  if (guard.gateWpm !== undefined) {
    const gate = guard.gateWpm;
    const grace = (guard.gateGraceSec ?? 5) * 1000;
    offs.push(
      engine.on("tick", ({ elapsedMs }) => {
        if (elapsedMs < grace + 1000) return;
        // Same measure as the results' per-second "wpm": correct keystrokes so far.
        const correct = engine.getHits().filter((h) => h.correct).length;
        if (wpmFrom(correct, elapsedMs) < gate) fail("gate");
      }),
    );
  }

  return () => offs.forEach((off) => off());
}
