import { NextResponse } from "next/server";
import type { RunContext } from "@/achievements/check";
import { syncPayload } from "@/lib/payloads";
import { jsonError, readJson, requireUser } from "@/server/http";
import { finalize, recordLesson, recordRun } from "@/server/record";
import { validateLesson, validateRun } from "@/server/validateRun";

/**
 * Uploads progress made as a guest after signing in. Every run and lesson is
 * validated exactly like a live one; anything that fails is skipped.
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await readJson(req, 6_000_000);
  } catch {
    return jsonError("Invalid request body.", 400);
  }
  const parsed = syncPayload.safeParse(body);
  if (!parsed.success) return jsonError("Invalid sync data.", 400);

  let runsSaved = 0;
  let lessonsSaved = 0;
  let rejected = 0;
  let activityXp = 0;
  const contexts: RunContext[] = [];

  try {
    // Oldest first, so personal bests and XP accumulate in order.
    const runs = [...parsed.data.runs].sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
    for (const p of runs) {
      const check = validateRun(p);
      if (!check.ok) {
        rejected += 1;
        continue;
      }
      const saved = await recordRun(auth.admin, auth.userId, p, check.value);
      if (!saved) continue; // already synced earlier
      runsSaved += 1;
      activityXp += saved.xpAwarded;
      contexts.push(saved.context);
    }
    for (const p of parsed.data.lessons) {
      const check = validateLesson(p);
      if (!check.ok || check.value.stars === 0) {
        rejected += 1;
        continue;
      }
      const saved = await recordLesson(auth.admin, auth.userId, p, check.value.result, check.value.stars);
      lessonsSaved += 1;
      activityXp += saved.xpAwarded;
    }
    const progress = await finalize(auth.admin, auth.userId, activityXp, contexts);
    return NextResponse.json({ ...progress, runsSaved, lessonsSaved, rejected });
  } catch (e) {
    console.error("[api/sync]", e);
    return jsonError("Couldn't upload your guest progress. It's still saved in this browser.", 500);
  }
}
