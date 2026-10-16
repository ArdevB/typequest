import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "./env";

/**
 * Loads the Supabase browser client on demand, so the ~250 KB library isn't
 * part of every page's first load (the header and auth tracking use this).
 */
export async function loadSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;
  const { getBrowserSupabase } = await import("./client");
  return getBrowserSupabase();
}
