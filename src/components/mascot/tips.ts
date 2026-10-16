import type { RunResult } from "@/engine";
import type { RunOutcome } from "@/stores/historyStore";

/** What Keeby says after a speed test: one short, specific nudge. */
export function resultTip(r: RunResult, o: RunOutcome): string {
  if (!o.valid) return "That one didn't count. Finish the whole test without pasting and I'll log it.";
  if (o.isPB && o.previousBest !== null) return `New personal best! ${Math.round(r.wpm - o.previousBest)} WPM faster than before.`;
  if (o.isPB) return "First score on the board. Now let's beat it!";
  if (r.accuracy < 90) return "Slow down a touch. Speed comes once accuracy is 95%+.";
  if (r.consistency < 60) return "Your pace jumps around. Try a steady rhythm, even on hard words.";
  const worst = Object.entries(r.perKey)
    .filter(([k, s]) => /^[a-z]$/.test(k) && s.attempts >= 3 && s.errors > 0)
    .sort((a, b) => b[1].errors / b[1].attempts - a[1].errors / a[1].attempts)[0];
  if (worst) return `${worst[0].toUpperCase()} tripped you up. Practice can drill it.`;
  if (r.accuracy >= 98) return "Super clean! Push the pace a little next time.";
  return "Nice run. One more?";
}
