import { NextResponse } from "next/server";
import { chaosPayload } from "@/lib/payloads";
import { jsonError, readJson, requireUser } from "@/server/http";
import { finalize, recordChaos } from "@/server/record";
import { validateChaos } from "@/server/validateChaos";

/** Save a chaos run. The server rebuilds the words and modifier rules and replays it for the score. */
export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    return jsonError("Invalid request body.", 400);
  }
  const parsed = chaosPayload.safeParse(body);
  if (!parsed.success) return jsonError("Invalid chaos run.", 400);
  const check = validateChaos(parsed.data);
  if (!check.ok) return jsonError(`Run not accepted: ${check.reason}.`, 422);
  try {
    const saved = await recordChaos(auth.admin, auth.userId, parsed.data.seed, check.value);
    const progress = await finalize(auth.admin, auth.userId, saved.xpAwarded);
    return NextResponse.json({ ...progress, isBest: saved.isBest, score: check.value.score });
  } catch (e) {
    console.error("[api/chaos]", e);
    return jsonError("Couldn't save the run. Try again in a moment.", 500);
  }
}
