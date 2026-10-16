import { replayGame } from "@/games/registry";
import type { GameOutcome } from "@/games/types";
import type { GamePayload } from "@/lib/payloads";
import { isWeeklySeed } from "@/games/weekly";
import { MAX_WPM, checkLog, type Validation } from "./validateRun";

/** Replays a game from its seed and keystrokes through the same simulation the browser ran. */
export function validateGame(p: GamePayload): Validation<GameOutcome> {
  if (p.game === "weekly-boss" && !isWeeklySeed(p.seed)) return { ok: false, reason: "that Weekly Boss has already left" };
  const problem = checkLog(p.log);
  if (problem) return { ok: false, reason: problem };
  const outcome = replayGame(p.game, p.seed, p.log);
  if (outcome.wpm > MAX_WPM) return { ok: false, reason: "speed is not humanly possible" };
  if (outcome.durationMs < 1000) return { ok: false, reason: "game too short" };
  return { ok: true, value: outcome };
}
