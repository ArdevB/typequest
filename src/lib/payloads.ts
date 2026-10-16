import { z } from "zod";

/**
 * Request bodies sent to the API. A run is described by how its words were
 * generated (seed + options) and the raw keystroke log, never by its score:
 * the server regenerates the words and replays the log to compute the score.
 */

const keystroke = z.tuple([
  z.number().int().nonnegative().max(3_600_000),
  z.string().max(8),
  z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
]);

export const MAX_LOG = 20_000;

export const runPayload = z.object({
  mode: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("time"), seconds: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(120)]) }),
    z.object({ kind: z.literal("words"), count: z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)]) }),
  ]),
  seed: z.number().int().nonnegative().max(2 ** 32),
  punctuation: z.boolean(),
  numbers: z.boolean(),
  stopOnError: z.enum(["off", "letter", "word"]),
  log: z.array(keystroke).min(1).max(MAX_LOG),
  /** Local id, so a run synced from guest storage is only stored once. */
  clientId: z.string().min(1).max(64).optional(),
  /** When the run happened (epoch ms), for runs synced later. */
  at: z.number().int().positive().optional(),
});
export type RunPayload = z.infer<typeof runPayload>;

export const lessonPayload = z.object({
  lessonId: z.string().min(1).max(40),
  seed: z.number().int().nonnegative().max(2 ** 32),
  /** Keyboard layout the lesson was built for (letter lessons differ per layout). */
  layout: z.enum(["qwerty", "dvorak", "colemak"]).optional(),
  log: z.array(keystroke).min(1).max(MAX_LOG),
});
export type LessonPayload = z.infer<typeof lessonPayload>;

export const syncPayload = z.object({
  runs: z.array(runPayload).max(20),
  lessons: z.array(lessonPayload).max(40),
});
export type SyncPayload = z.infer<typeof syncPayload>;

export const challengePayload = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("daily"), challengeId: z.string().uuid(), log: z.array(keystroke).min(1).max(MAX_LOG) }),
  z.object({
    kind: z.literal("skill"),
    skillId: z.string().min(1).max(40),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    seed: z.number().int().nonnegative().max(2 ** 32),
    log: z.array(keystroke).min(1).max(MAX_LOG),
    /** Weak Key Hunt: the key weights the words were generated with. */
    keyWeights: z.record(z.string().min(1).max(2), z.number().min(1).max(8)).optional(),
  }),
]);
export type ChallengePayload = z.infer<typeof challengePayload>;

export const gamePayload = z.object({
  game: z.enum(["falling-words", "boss-battle", "racing", "stickman-duel", "weekly-boss"]),
  seed: z.number().int().nonnegative().max(2 ** 32),
  log: z.array(keystroke).min(1).max(MAX_LOG),
});
export type GamePayload = z.infer<typeof gamePayload>;

export const chaosPayload = z.object({
  mods: z.array(z.string().min(1).max(30)).max(12),
  seed: z.number().int().nonnegative().max(2 ** 32),
  log: z.array(keystroke).min(1).max(MAX_LOG),
});
export type ChaosPayload = z.infer<typeof chaosPayload>;

const letter = z.string().regex(/^[a-z]$/);
export const practicePayload = z.object({
  drill: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("mix"), keys: z.array(letter).min(1).max(5) }),
    z.object({ kind: z.literal("key"), key: letter }),
  ]),
  seed: z.number().int().nonnegative().max(2 ** 32),
  layout: z.enum(["qwerty", "dvorak", "colemak"]).optional(),
  log: z.array(keystroke).min(1).max(MAX_LOG),
});
export type PracticePayload = z.infer<typeof practicePayload>;

export interface StreakInfo {
  streak: number;
  bestStreak: number;
  freezes: number;
  /** The streak grew today with this activity. */
  changed: boolean;
  /** 3, 7, 30 or 100 when a milestone was just reached. */
  milestone: number | null;
  freezesUsed: number;
}

export interface UnlockedAchievement {
  id: string;
  name: string;
  xp: number;
}

/** What the API returns after recording something. */
export interface ProgressResponse {
  /** Total XP gained by this request (activity + streak milestone + achievements). */
  xpAwarded: number;
  xp: number;
  level: number;
  leveledUp: boolean;
  rank: string;
  isPB?: boolean;
  stars?: number;
  passed?: boolean;
  reason?: string;
  /** Games: best score so far for this game. */
  isBest?: boolean;
  streak?: StreakInfo;
  achievements?: UnlockedAchievement[];
}
