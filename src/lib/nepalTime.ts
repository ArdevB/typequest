/** Nepal time helpers (UTC+5:45). Kept free of heavy imports: the header uses them. */
export const NPT_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;

/** Today's date in Nepal as YYYY-MM-DD. */
export function nepalDay(now: number = Date.now()): string {
  return new Date(now + NPT_OFFSET_MS).toISOString().slice(0, 10);
}

/** The hour (0–23) in Nepal. */
export function nepalHour(now: number = Date.now()): number {
  return new Date(now + NPT_OFFSET_MS).getUTCHours();
}

/** Milliseconds until the next midnight in Nepal (when the daily challenge changes). */
export function msUntilNextDaily(now: number = Date.now()): number {
  const local = now + NPT_OFFSET_MS;
  const nextMidnight = (Math.floor(local / 86_400_000) + 1) * 86_400_000;
  return nextMidnight - local;
}

