import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS, safeStorage } from "@/lib/storage";

/** Challenge progress kept in this browser (guests, and as a quick cache when signed in). */
interface ChallengesState {
  /** Highest tier cleared per skill challenge (1–3). */
  skills: Record<string, number>;
  /** Best result per daily challenge day (YYYY-MM-DD, Nepal time). */
  daily: Record<string, { wpm: number; accuracy: number; passed: boolean }>;
  clearSkill: (skillId: string, tier: number) => void;
  recordDaily: (day: string, r: { wpm: number; accuracy: number; passed: boolean }) => void;
  mergeSkills: (tiers: readonly { skill_id: string; tier: number }[]) => void;
}

export const useChallenges = create<ChallengesState>()(
  persist(
    (set) => ({
      skills: {},
      daily: {},
      clearSkill: (id, tier) => set((s) => ({ skills: { ...s.skills, [id]: Math.max(s.skills[id] ?? 0, tier) } })),
      recordDaily: (day, r) =>
        set((s) => {
          const prev = s.daily[day];
          const better = !prev || (r.passed && !prev.passed) || (r.passed === prev.passed && r.wpm > prev.wpm);
          return better ? { daily: { ...s.daily, [day]: r } } : s;
        }),
      mergeSkills: (rows) =>
        set((s) => {
          const skills = { ...s.skills };
          for (const r of rows) skills[r.skill_id] = Math.max(skills[r.skill_id] ?? 0, r.tier);
          return { skills };
        }),
    }),
    {
      name: STORAGE_KEYS.challenges,
      storage: safeStorage,
      version: 1,
      skipHydration: true,
      partialize: ({ skills, daily }) => ({ skills, daily }),
    },
  ),
);
