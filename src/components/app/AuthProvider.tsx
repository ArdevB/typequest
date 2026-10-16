"use client";

import { useEffect, useRef } from "react";
import { syncGuestProgress } from "@/lib/api/client";
import { loadSupabase } from "@/lib/supabase/lazy";
import { PROFILE_COLUMNS, type ProfileRow } from "@/lib/supabase/types";
import { useAuth } from "@/stores/authStore";
import { useHistory } from "@/stores/historyStore";
import { useHydrated } from "@/stores/hydration";
import { useLessons } from "@/stores/lessonsStore";
import { useSettings } from "@/stores/settingsStore";
import { toast } from "@/stores/toastStore";

/**
 * Tracks the Supabase session, loads the player's profile, and on sign-in
 * uploads progress made as a guest (the server re-verifies every run).
 */
export function AuthProvider() {
  const ready = useHydrated((s) => s.ready);
  const userId = useAuth((s) => s.userId);
  const syncedFor = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    void loadSupabase().then((supabase) => {
      if (cancelled) return;
      const set = useAuth.getState().set;
      if (!supabase) {
        set({ status: "disabled" });
        return;
      }

    const load = async (id: string | null, email: string | null) => {
      if (!id) {
        set({ status: "signedOut", userId: null, email: null, profile: null });
        return;
      }
      const { data } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", id).maybeSingle<ProfileRow>();
      set({ status: "signedIn", userId: id, email, profile: data ?? null });
    };

      // The session in this browser is enough to show who's signed in (no round trip);
      // every write is checked by the server.
      void supabase.auth.getSession().then(({ data }) => load(data.session?.user.id ?? null, data.session?.user.email ?? null));
      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
          void load(session?.user.id ?? null, session?.user.email ?? null);
        }
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  // Once signed in (and local data loaded): pull lesson progress, push guest progress.
  useEffect(() => {
    if (!ready || !userId || syncedFor.current === userId) return;
    syncedFor.current = userId;
    void loadSupabase().then((supabase) => supabase && syncFor(supabase));
  }, [ready, userId]);

  function syncFor(supabase: NonNullable<Awaited<ReturnType<typeof loadSupabase>>>) {
    void supabase
      .from("lessons_progress")
      .select("lesson_id, stars, best_wpm, best_accuracy, attempts")
      .then(({ data }) => {
        if (data) useLessons.getState().mergeRemote(data);
      });

    const runs = useHistory.getState().unsynced;
    const lessons = Object.values(useLessons.getState().unsynced).map(({ lessonId, seed, layout, log }) => ({ lessonId, seed, layout, log }));
    if (runs.length === 0 && lessons.length === 0) return;

    void syncGuestProgress({ runs, lessons }).then((r) => {
      if (!r.ok) {
        toast({ title: "Couldn't upload your guest progress", body: r.error, tone: "error" });
        return;
      }
      useHistory.getState().clearSynced(runs.map((p) => p.clientId ?? ""));
      useLessons.getState().clearSynced(lessons.map((l) => l.lessonId));
      const { runsSaved, lessonsSaved, xpAwarded } = r.data;
      if (runsSaved + lessonsSaved > 0) {
        toast({
          title: "Guest progress saved to your account",
          body: `${runsSaved} run${runsSaved === 1 ? "" : "s"} and ${lessonsSaved} lesson${lessonsSaved === 1 ? "" : "s"} · +${xpAwarded} XP`,
          tone: "success",
        });
      }
    });
  }

  // Remember the chosen theme on the profile (used later for public profile styling).
  const themeId = useSettings((s) => s.themeId);
  const profileTheme = useAuth((s) => s.profile?.selected_theme);
  useEffect(() => {
    if (!ready || !userId || !profileTheme || profileTheme === themeId) return;
    void loadSupabase().then((supabase) =>
      supabase
        ?.from("profiles")
        .update({ selected_theme: themeId })
        .eq("id", userId)
        .then(({ error }) => {
          const { profile, set } = useAuth.getState();
          if (!error && profile) set({ profile: { ...profile, selected_theme: themeId } });
        }),
    );
  }, [ready, userId, themeId, profileTheme]);

  return null;
}
