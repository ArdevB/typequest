import { NextResponse } from "next/server";
import { runPayload } from "@/lib/payloads";
import { jsonError, readJson, requireUser } from "@/server/http";
import { finalize, recordRun } from "@/server/record";
import { validateRun } from "@/server/validateRun";

/** Save a finished speed test. The score is recomputed here from the seed and keystroke log. */
export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    return jsonError("Invalid request body.", 400);
  }
  const parsed = runPayload.safeParse(body);
  if (!parsed.success) return jsonError("Invalid run data.", 400);

  const check = validateRun(parsed.data);
  if (!check.ok) return jsonError(`Run not accepted: ${check.reason}.`, 422);

  try {
    const saved = await recordRun(auth.admin, auth.userId, parsed.data, check.value);
    if (!saved) return NextResponse.json({ duplicate: true }, { status: 200 });
    const progress = await finalize(auth.admin, auth.userId, saved.xpAwarded, [saved.context]);
    return NextResponse.json({ ...progress, isPB: saved.isPB });
  } catch (e) {
    console.error("[api/runs]", e);
    return jsonError("Couldn't save the run. Try again in a moment.", 500);
  }
}
