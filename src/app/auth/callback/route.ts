import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Landing point for email confirmation links and OAuth: exchanges the code (or
 * token) for a session cookie, then sends the player on.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const rawNext = url.searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const supabase = await getServerSupabase();
  if (!supabase) return NextResponse.redirect(new URL("/auth", url.origin));

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("Missing sign-in code") };

  if (error) {
    const back = new URL("/auth", url.origin);
    back.searchParams.set("error", "That sign-in link is invalid or has expired. Please try again.");
    return NextResponse.redirect(back);
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
