"use client";

import { useEffect } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/stores/authStore";
import { useChallenges } from "@/stores/challengesStore";

let loadedFor: string | null = null;

/** Highest cleared tier per skill challenge: local progress merged with the account's (once per session). */
export function useSkillProgress(): Record<string, number> {
  const userId = useAuth((s) => s.userId);
  const skills = useChallenges((s) => s.skills);
  useEffect(() => {
    if (!userId || loadedFor === userId) return;
    loadedFor = userId;
    void getBrowserSupabase()
      ?.from("challenge_attempts")
      .select("skill_id, tier")
      .eq("user_id", userId)
      .eq("passed", true)
      .not("skill_id", "is", null)
      .then(({ data }) => {
        if (data) useChallenges.getState().mergeSkills(data as { skill_id: string; tier: number }[]);
      });
  }, [userId]);
  return skills;
}
