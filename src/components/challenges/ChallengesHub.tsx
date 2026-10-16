"use client";

import Link from "next/link";
import { describeRules, nepalDay, type DailyChallenge } from "@/challenges/daily";
import { SKILLS } from "@/challenges/skills";
import { Flame, liveStreak } from "@/components/progress/StreakBadge";
import { useSkillProgress } from "@/hooks/useSkillProgress";
import type { DailyBoardRow } from "@/server/daily";
import { useAuth } from "@/stores/authStore";
import { useChallenges } from "@/stores/challengesStore";
import { useHydrated } from "@/stores/hydration";
import { Countdown } from "./Countdown";

const MILESTONES = [
  { days: 3, reward: "+30 XP" },
  { days: 7, reward: "+75 XP · 1 freeze" },
  { days: 30, reward: "+300 XP · 1 freeze" },
  { days: 100, reward: "+1000 XP · 2 freezes" },
];

export function ChallengesHub(props: { daily: DailyChallenge | null; board: DailyBoardRow[]; configured: boolean }) {
  const { daily, board, configured } = props;
  const ready = useHydrated((s) => s.ready);
  const skills = useSkillProgress();
  const myDaily = useChallenges((s) => (daily ? s.daily[daily.day] : undefined));
  const status = useAuth((s) => s.status);
  const profile = useAuth((s) => s.profile);
  const streak = profile ? liveStreak(profile) : null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 py-4">
      <header className="text-center">
        <h1 className="font-display text-4xl font-black tracking-wide text-text">Challenges</h1>
        <p className="mt-2 text-sub">A new daily text for everyone, skill trials with three tiers, and a streak to protect.</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Daily */}
        <section className="tq-card flex flex-col" aria-labelledby="daily-title">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-main">Daily challenge</p>
          {daily ? (
            <>
              <h2 id="daily-title" className="mt-1 font-display text-2xl font-bold text-text">
                {daily.title}
              </h2>
              <p className="mt-1 text-sm text-sub">{daily.description}</p>
              <p className="mt-3 text-sm text-text">
                {describeRules(daily.rules)}
                {daily.goal.minAccuracy !== undefined && ` · ${daily.goal.minAccuracy}% accuracy`}
                <span className="text-main"> · +{daily.xp} XP</span>
              </p>
              {board.length > 0 && (
                <ol className="mt-4 space-y-1 text-sm">
                  {board.slice(0, 3).map((r) => (
                    <li key={r.user_id} className="flex justify-between">
                      <span className="text-text">
                        {r.position}. {r.username}
                      </span>
                      <span className="font-mono text-main">{Math.round(Number(r.wpm))} wpm</span>
                    </li>
                  ))}
                </ol>
              )}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
                <span className="text-xs text-sub">
                  {ready && myDaily && daily.day === nepalDay()
                    ? myDaily.passed
                      ? `Cleared today · best ${Math.round(myDaily.wpm)} wpm · `
                      : "Attempted today · "
                    : ""}
                  next in <Countdown />
                </span>
                <Link href="/challenges/daily" className="tq-btn tq-btn-primary">
                  {ready && myDaily?.passed ? "Improve your score" : "Play today's challenge"}
                </Link>
              </div>
            </>
          ) : (
            <p id="daily-title" className="mt-2 text-sm text-sub">
              {configured
                ? "Today's challenge couldn't be loaded. Make sure the Phase 4 database script has been run."
                : "Daily challenges need accounts (Supabase) to be set up."}
            </p>
          )}
        </section>

        {/* Streak */}
        <section className="tq-card" aria-labelledby="streak-title">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-main">Streak</p>
          {status === "signedIn" && profile && streak ? (
            <>
              <h2 id="streak-title" className="mt-1 flex items-center gap-2 font-display text-3xl font-bold text-text">
                <Flame size={30} /> {streak.days} day{streak.days === 1 ? "" : "s"}
              </h2>
              <p className="mt-1 text-sm text-sub">
                {streak.playedToday ? "Done for today. See you tomorrow!" : "Finish any test, lesson or challenge today to keep it."}
              </p>
              <p className="mt-2 text-sm text-text">
                Best {profile.best_streak} · ❄️ {profile.streak_freezes ?? 0} freeze{(profile.streak_freezes ?? 0) === 1 ? "" : "s"}
              </p>
            </>
          ) : (
            <p id="streak-title" className="mt-2 text-sm text-sub">
              {status === "disabled" ? "Streaks need accounts to be set up." : "Sign in to start a daily streak."}
            </p>
          )}
          <ul className="mt-4 space-y-1.5 text-sm">
            {MILESTONES.map((m) => {
              const hit = (profile?.best_streak ?? 0) >= m.days;
              return (
                <li key={m.days} className={`flex justify-between ${hit ? "text-text" : "text-sub"}`}>
                  <span>
                    {hit ? "✓ " : ""}
                    {m.days} days
                  </span>
                  <span>{m.reward}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-sub">A freeze covers one missed day automatically.</p>
        </section>
      </div>

      {/* Skills */}
      <section aria-labelledby="skills-title">
        <h2 id="skills-title" className="mb-4 font-display text-xl font-bold text-text">
          Skill challenges
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SKILLS.map((s) => {
            const best = ready ? (skills[s.id] ?? 0) : 0;
            return (
              <li key={s.id}>
                <Link href={`/challenges/${s.id}`} className="tq-card block h-full transition hover:border-main">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold text-text">{s.name}</h3>
                    <span className="flex gap-1" aria-label={`${best} of 3 tiers cleared`}>
                      {[1, 2, 3].map((t) => (
                        <i key={t} className="tq-medal" data-tier={best >= t ? t : 0} />
                      ))}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-sub">{s.tagline}</p>
                  <p className="mt-3 text-xs text-text">Gold: {s.goals[3]}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
