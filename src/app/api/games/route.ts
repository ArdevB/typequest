import { NextResponse } from "next/server";
import { gamePayload } from "@/lib/payloads";
import { jsonError, readJson, requireUser } from "@/server/http";
import { finalize, recordGame } from "@/server/record";
import { validateGame } from "@/server/validateGame";

/** Save a finished game. The server replays it to get the score. */
export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    return jsonError("Invalid request body.", 400);
  }
  const parsed = gamePayload.safeParse(body);
  if (!parsed.success) return jsonError("Invalid game data.", 400);

  const check = validateGame(parsed.data);
  if (!check.ok) return jsonError(`Game not accepted: ${check.reason}.`, 422);

  try {
    const saved = await recordGame(auth.admin, auth.userId, parsed.data.seed, check.value, parsed.data.log);
    const progress = await finalize(auth.admin, auth.userId, saved.xpAwarded);
    return NextResponse.json({ ...progress, isBest: saved.isBest });
  } catch (e) {
    console.error("[api/games]", e);
    return jsonError("Couldn't save the game. Try again in a moment.", 500);
  }
}
