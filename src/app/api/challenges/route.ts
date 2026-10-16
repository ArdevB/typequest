import { NextResponse } from "next/server";
import { challengePayload } from "@/lib/payloads";
import { jsonError, readJson, requireUser } from "@/server/http";
import { finalize, recordChallenge } from "@/server/record";
import { validateChallenge } from "@/server/validateChallenge";

/** Save a daily-challenge run or a skill-challenge clear. Pass/fail is decided here by replaying the log. */
export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    return jsonError("Invalid request body.", 400);
  }
  const parsed = challengePayload.safeParse(body);
  if (!parsed.success) return jsonError("Invalid challenge data.", 400);

  try {
    const check = await validateChallenge(auth.admin, parsed.data);
    if (!check.ok) return jsonError(`Attempt not accepted: ${check.reason}.`, 422);
    const a = check.value;

    let activityXp = 0;
    if (a.store) {
      const saved = await recordChallenge(auth.admin, auth.userId, a.target, a.seed, a.result, a.outcome.passed, a.xp);
      activityXp = saved.xpAwarded;
    }
    const progress = await finalize(auth.admin, auth.userId, activityXp);
    return NextResponse.json({ ...progress, passed: a.outcome.passed, reason: a.outcome.reason });
  } catch (e) {
    console.error("[api/challenges]", e);
    return jsonError("Couldn't save the attempt. Try again in a moment.", 500);
  }
}
