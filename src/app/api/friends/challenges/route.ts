import { NextResponse } from "next/server";
import { createFriendChallengePayload } from "@/lib/payloads";
import { checkChallengeRun, createChallenge } from "@/server/friends";
import { jsonError, readJson, requireUser } from "@/server/http";
import { finalize, recordRun } from "@/server/record";

const ERRORS: Record<string, [string, number]> = {
  not_friends: ["You can only challenge friends.", 403],
  too_many_open: ["You already have 3 open challenges with this friend. Wait for them to play.", 409],
};

/** Send a friend challenge: your run is checked and saved, then your friend gets the same words. */
export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    return jsonError("Invalid request body.", 400);
  }
  const parsed = createFriendChallengePayload.safeParse(body);
  if (!parsed.success) return jsonError("Invalid challenge.", 400);
  const { opponentId, settings, seed, log } = parsed.data;
  if (opponentId === auth.userId) return jsonError("You can't challenge yourself.", 400);

  const check = checkChallengeRun(settings, seed, log);
  if (!check.ok) return jsonError(`Run not accepted: ${check.reason}.`, 422);
  try {
    const created = await createChallenge(auth.admin, auth.userId, opponentId, settings, seed, check.result);
    if (created.error) {
      const [msg, status] = ERRORS[created.error] ?? ["Couldn't create the challenge.", 400];
      return jsonError(msg, status);
    }
    // It's also a normal speed test: XP, personal bests, streak.
    const run = await recordRun(auth.admin, auth.userId, check.payload, check.result);
    const progress = await finalize(auth.admin, auth.userId, run?.xpAwarded ?? 0, run ? [run.context] : []);
    return NextResponse.json({ ...progress, challengeId: created.id });
  } catch (e) {
    console.error("[api/friends/challenges]", e);
    return jsonError("Couldn't send the challenge. Try again in a moment.", 500);
  }
}
