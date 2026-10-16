import { create } from "zustand";
import type { ProfileRow } from "@/lib/supabase/types";

export type AuthStatus = "loading" | "signedOut" | "signedIn" | "disabled";

interface AuthState {
  status: AuthStatus;
  userId: string | null;
  email: string | null;
  profile: ProfileRow | null;
  set: (s: Partial<Omit<AuthState, "set">>) => void;
}

/** Who is signed in. Filled by <AuthProvider/>; not persisted (Supabase keeps the session in cookies). */
export const useAuth = create<AuthState>((set) => ({
  status: "loading",
  userId: null,
  email: null,
  profile: null,
  set: (s) => set(s),
}));
