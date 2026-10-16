/**
 * Supabase settings. Accounts, saving and leaderboards switch on when these are
 * set in .env.local (see .env.example); without them the app runs guest-only.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = (): boolean => SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

/** Show the "Continue with Google" button (enable the provider in Supabase first). */
export const GOOGLE_AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_GOOGLE === "true";
