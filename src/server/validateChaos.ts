import { replayDetailed, type RunResult } from "@/engine";
import type { ChaosPayload, PracticePayload } from "@/lib/payloads";
import { CHAOS_SECONDS, attachModifierRules, chaosScore, chaosSource, resolveModifiers } from "@/modifiers/catalog";
import { stackMultiplier } from "@/modifiers/types";
import { buildDrill } from "@/practice/drills";
import { MAX_WPM, checkLog, type Validation } from "./validateRun";

export interface ChaosCheck {
  result: RunResult;
  score: number;
  multiplier: number;
  /** Normalized modifier ids, e.g. "mirror+random-case". */
  combo: string;
  mods: string[];
}

/** Rebuilds a chaos run (seeded words + modifier transforms + modifier rules) and replays it. */
export function validateChaos(p: ChaosPayload): Validation<ChaosCheck> {
  const unique = new Set(p.mods);
  const mods = resolveModifiers(p.mods);
  if (mods.length !== unique.size) return { ok: false, reason: "unknown modifier" };
  const problem = checkLog(p.log);
  if (problem) return { ok: false, reason: problem };
  const { result } = replayDetailed({
    mode: { kind: "time", seconds: CHAOS_SECONDS },
    log: p.log,
    source: chaosSource(p.seed, mods),
    attach: (engine) => {
      attachModifierRules(engine, mods);
    },
  });
  if (!result) return { ok: false, reason: "run was not started" };
  if (result.flags.pasteAttempts > 0) return { ok: false, reason: "pasting isn't allowed" };
  if (result.wpm <= 0) return { ok: false, reason: "no correct words" };
  if (result.wpm > MAX_WPM) return { ok: false, reason: "speed is not humanly possible" };
  const multiplier = stackMultiplier(mods);
  return {
    ok: true,
    value: {
      result,
      multiplier,
      score: chaosScore(result.wpm, result.accuracy, multiplier),
      combo: mods.map((m) => m.id).join("+"),
      mods: mods.map((m) => m.id),
    },
  };
}

/** Rebuilds a practice drill from its keys, seed and layout and replays it. */
export function validatePractice(p: PracticePayload): Validation<RunResult> {
  const problem = checkLog(p.log);
  if (problem) return { ok: false, reason: problem };
  const text = buildDrill(p.drill, p.seed, p.layout ?? "qwerty");
  const { result, finishedNaturally } = replayDetailed({ mode: { kind: "text", text }, log: p.log, stopOnError: "off" });
  if (!result || !finishedNaturally) return { ok: false, reason: "drill was not finished" };
  if (result.flags.pasteAttempts > 0) return { ok: false, reason: "pasting isn't allowed" };
  if (result.accuracy < 50) return { ok: false, reason: "accuracy below 50%" };
  if (result.wpm > MAX_WPM) return { ok: false, reason: "speed is not humanly possible" };
  return { ok: true, value: result };
}
