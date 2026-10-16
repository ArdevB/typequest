import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

/**
 * Supabase client for server components and route handlers, acting as the
 * signed-in user (from cookies). Null when accounts aren't configured.
 */
export async function getServerSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a server component: cookies are read-only there. The proxy refreshes sessions.
        }
      },
    },
  });
}

/**
 * The signed-in user's id, or null. The token's signature is verified
 * (getClaims), locally when the project uses asymmetric signing keys, so pages
 * don't wait on a call to Supabase Auth. Writes still go through API routes that
 * check the user with Supabase Auth itself.
 */
export async function getUserId(supabase: SupabaseClient | null): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return typeof sub === "string" ? sub : null;
}
