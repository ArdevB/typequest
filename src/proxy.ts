import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/**
 * Keeps the Supabase session fresh: refreshes the auth cookie on each page
 * request. Does nothing when accounts aren't configured.
 */
export async function proxy(request: NextRequest) {
  const url = SUPABASE_URL;
  const key = SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });
  // Do not remove: refreshes an expired session. getClaims() verifies the token locally
  // (no round trip to Supabase on every page, unless the token needs refreshing).
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  // Skip static files, audio and API routes (API routes check the session themselves).
  matcher: ["/((?!_next/static|_next/image|api/|sounds/|music/|icon.svg|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|wav|mp3|ogg|woff2?)$).*)"],
};
