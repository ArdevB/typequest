import { NextResponse } from "next/server";
import { playFriendChallengePayload } from "@/lib/payloads";
import { checkChallengeRun, completeChallenge, loadChallenge } from "@/server/friends";
import { jsonError, readJson, requireUser } from "@/server/http";
import { finalize, recordRun } from "@/server/record";

/** Play a challenge a friend sent you: replayed with the challenge's own seed and settings. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    return jsonError("Invalid request body.", 400);
  }
  const parsed = playFriendChallengePayload.safeParse(body);
  if (!parsed.success) return jsonError("Invalid run.", 400);

  const challenge = await loadChallenge(auth.admin, id);
  if (!challenge || challenge.opponent !== auth.userId) return jsonError("Challenge not found.", 404);
  if (challenge.status !== "open") return jsonError("This challenge is already finished.", 409);

  const check = checkChallengeRun(challenge.settings, challenge.seed, parsed.data.log);
  if (!check.ok) return jsonError(`Run not accepted: ${check.reason}.`, 422);
  try {
    const done = await completeChallenge(auth.admin, auth.userId, id, check.result);
    if (done.error) return jsonError(done.error === "expired" ? "This challenge expired." : "This challenge is already finished.", 409);
    const run = await recordRun(auth.admin, auth.userId, check.payload, check.result);
    const progress = await finalize(auth.admin, auth.userId, (run?.xpAwarded ?? 0) + (done.xp_awarded ?? 0), run ? [run.context] : []);
    return NextResponse.json({ ...progress, winner: done.winner ?? null, challengerWpm: Number(done.challenger_wpm ?? 0) });
  } catch (e) {
    console.error("[api/friends/challenges/id]", e);
    return jsonError("Couldn't save your run. Try again in a moment.", 500);
  }
}
