import { hashSeed } from "@/engine";

const NPT_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;
const DAY = 86_400_000;
const WEEK = 7 * DAY;
/** 1970-01-05 was a Monday; weeks run Monday 00:00 → Sunday 23:59, Nepal time. */
const MONDAY_EPOCH = 4 * DAY;

/** Weeks since the epoch, in Nepal time. */
function weekIndex(now: number): number {
  return Math.floor((now + NPT_OFFSET_MS - MONDAY_EPOCH) / WEEK);
}

/** e.g. "2026-W42" (the Monday's ISO year + week number). */
export function weekKey(now: number = Date.now()): string {
  const monday = new Date(weekIndex(now) * WEEK + MONDAY_EPOCH);
  // ISO week number: the week containing the year's first Thursday is week 1.
  const thursday = new Date(monday.getTime() + 3 * DAY);
  const year = thursday.getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const week = Math.floor((thursday.getTime() - jan1) / WEEK) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Everyone fights the same boss with the same words all week. */
export function weeklySeed(now: number = Date.now()): number {
  return hashSeed(`weekly-boss:${weekKey(now)}`) % 2 ** 31;
}

/** The seed is valid for this week, or last week (a fight that started before the reset). */
export function isWeeklySeed(seed: number, now: number = Date.now()): boolean {
  return seed === weeklySeed(now) || seed === weeklySeed(now - WEEK);
}

export function msUntilWeeklyReset(now: number = Date.now()): number {
  return (weekIndex(now) + 1) * WEEK + MONDAY_EPOCH - (now + NPT_OFFSET_MS);
}

export type WeeklyTwist = "none" | "random-case" | "reverse" | "mirror" | "fog";

export const TWIST_INFO: Record<WeeklyTwist, { name: string; description: string }> = {
  none: { name: "Pure fury", description: "No tricks this week — just a bigger, angrier boss." },
  "random-case": { name: "Cursed case", description: "Its curse flips random letters to capitals." },
  reverse: { name: "Backwards spell", description: "Every word is spelled backwards." },
  mirror: { name: "Mirror realm", description: "The words appear in a mirror." },
  fog: { name: "Smoke screen", description: "You can only see the next two words." },
};

const TWISTS: readonly WeeklyTwist[] = ["random-case", "reverse", "mirror", "fog", "none"];

/** The week's twist comes from the seed, so the server's replay sees the same words. */
export function twistFor(seed: number): WeeklyTwist {
  return TWISTS[hashSeed(`twist:${seed}`) % TWISTS.length] ?? "none";
}
