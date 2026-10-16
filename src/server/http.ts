import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase, getUserId } from "@/lib/supabase/server";

export const jsonError = (error: string, status: number) => NextResponse.json({ error }, { status });

/**
 * Common start of every write endpoint: accounts must be configured and the
 * caller signed in. Returns the service-role client and the user's id.
 */
export async function requireUser(): Promise<
  { ok: true; admin: SupabaseClient; userId: string } | { ok: false; response: NextResponse }
> {
  const admin = getAdminSupabase();
  if (!admin) return { ok: false, response: jsonError("Accounts aren't set up on this server yet.", 503) };
  const userId = await getUserId(await getServerSupabase());
  if (!userId) return { ok: false, response: jsonError("Sign in to save your progress.", 401) };
  return { ok: true, admin, userId };
}

/** Reads a JSON body, capped in size. */
export async function readJson(req: Request, maxBytes = 1_500_000): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new Error("too large");
  return JSON.parse(text);
}
