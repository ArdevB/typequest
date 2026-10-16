import { NextResponse } from "next/server";
import { lessonPayload } from "@/lib/payloads";
import { jsonError, readJson, requireUser } from "@/server/http";
import { finalize, recordLesson } from "@/server/record";
import { validateLesson } from "@/server/validateRun";

/** Save a lesson attempt. The lesson text is rebuilt from its seed and the log replayed to rate it. */
export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    return jsonError("Invalid request body.", 400);
  }
  const parsed = lessonPayload.safeParse(body);
  if (!parsed.success) return jsonError("Invalid lesson data.", 400);

  const check = validateLesson(parsed.data);
  if (!check.ok) return jsonError(`Lesson not accepted: ${check.reason}.`, 422);

  try {
    const saved = await recordLesson(auth.admin, auth.userId, parsed.data, check.value.result, check.value.stars);
    const progress = await finalize(auth.admin, auth.userId, saved.xpAwarded);
    return NextResponse.json({ ...progress, stars: saved.stars });
  } catch (e) {
    console.error("[api/lessons]", e);
    return jsonError("Couldn't save the lesson. Try again in a moment.", 500);
  }
}
