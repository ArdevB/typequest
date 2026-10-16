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
  log: z.array(keystroke).min(1).max(MAX_LOG),
});
export type LessonPayload = z.infer<typeof lessonPayload>;

export const syncPayload = z.object({
  runs: z.array(runPayload).max(20),
  lessons: z.array(lessonPayload).max(40),
});
export type SyncPayload = z.infer<typeof syncPayload>;

/** What the API returns after recording something. */
export interface ProgressResponse {
  xpAwarded: number;
  xp: number;
  level: number;
  leveledUp: boolean;
  rank: string;
  isPB?: boolean;
  stars?: number;
}
