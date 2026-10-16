import { NextResponse } from "next/server";
import { practicePayload } from "@/lib/payloads";
import { jsonError, readJson, requireUser } from "@/server/http";
import { finalize, recordPractice } from "@/server/record";
import { validatePractice } from "@/server/validateChaos";

/** Save a practice drill: its per-key stats join the account's, plus a little XP. */
export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    return jsonError("Invalid request body.", 400);
  }
  const parsed = practicePayload.safeParse(body);
  if (!parsed.success) return jsonError("Invalid drill.", 400);
  const check = validatePractice(parsed.data);
  if (!check.ok) return jsonError(`Drill not accepted: ${check.reason}.`, 422);
  try {
    const saved = await recordPractice(auth.admin, auth.userId, check.value);
    const progress = await finalize(auth.admin, auth.userId, saved.xpAwarded);
    return NextResponse.json(progress);
  } catch (e) {
    console.error("[api/practice]", e);
    return jsonError("Couldn't save the drill. Try again in a moment.", 500);
  }
}
