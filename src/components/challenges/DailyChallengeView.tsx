"use client";

import { useCallback, useEffect, useState } from "react";
import { describeRules, evaluateDaily, nepalDay, type DailyChallenge } from "@/challenges/daily";
import type { ChallengeSetup } from "@/challenges/types";
import type { RunResult } from "@/engine";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { DailyBoardRow } from "@/server/daily";
import { useAuth } from "@/stores/authStore";
import { useChallenges } from "@/stores/challengesStore";
import { useHydrated } from "@/stores/hydration";
import { ChallengeRunner } from "./ChallengeRunner";
import { Countdown } from "./Countdown";
import { DailyBoard } from "./DailyBoard";

/** Loads the leaderboard again (after a new attempt has been saved). */
function useBoard(challengeId: string, initial: DailyBoardRow[]) {
  const [rows, setRows] = useState(initial);
  const refresh = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const { data } = await supabase.rpc("challenge_leaderboard", { p_challenge: challengeId, p_limit: 20 });
    if (data) setRows(data as DailyBoardRow[]);
  }, [challengeId]);
  return { rows, refresh };
}

function LiveBoard({ challengeId, initial }: { challengeId: string; initial: DailyBoardRow[] }) {
  const { rows, refresh } = useBoard(challengeId, initial);
  const viewerId = useAuth((s) => s.userId);
  useEffect(() => {
    // Give the save a moment to land, then refresh.
    const t = setTimeout(() => void refresh(), 1800);
    return () => clearTimeout(t);
  }, [refresh]);
  return (
    <section className="mx-auto mt-10 w-full max-w-xl" aria-labelledby="daily-board">
      <h2 id="daily-board" className="mb-3 font-display text-lg font-bold text-text">
        Today&apos;s leaderboard
      </h2>
      <DailyBoard rows={rows} viewerId={viewerId} />
    </section>
  );
}

export function DailyChallengeView({ challenge, board }: { challenge: DailyChallenge; board: DailyBoardRow[] }) {
  const ready = useHydrated((s) => s.ready);
  const status = useAuth((s) => s.status);
  const viewerId = useAuth((s) => s.userId);
  const today = nepalDay();
  const mine = useChallenges((s) => s.daily[challenge.day]);
  const recordDaily = useChallenges((s) => s.recordDaily);

  const setup: ChallengeSetup = { ...challenge.rules, guard: {} };
  const evaluate = useCallback((r: RunResult, natural: boolean) => evaluateDaily(challenge.goal, r, natural), [challenge.goal]);
  const payload = useCallback(
    ({ log }: { log: RunResult["log"] }) => ({ kind: "daily" as const, challengeId: challenge.id, log: [...log] }),
    [challenge.id],
  );
  const onAttempt = useCallback(
    (r: RunResult, o: { passed: boolean }) => recordDaily(challenge.day, { wpm: r.wpm, accuracy: r.accuracy, passed: o.passed }),
    [challenge.day, recordDaily],
  );

  return (
    <ChallengeRunner
      setup={setup}
      seed={challenge.seed}
      evaluate={evaluate}
      payload={payload}
      onAttempt={onAttempt}
      resultsExtra={<LiveBoard challengeId={challenge.id} initial={board} />}
      intro={
        <div>
          <p className="font-mono text-sm text-main">Daily challenge · {challenge.day}</p>
          <h1 className="mt-2 font-display text-4xl font-black tracking-wide text-text">{challenge.title}</h1>
          <p className="mx-auto mt-3 max-w-md text-sub">{challenge.description}</p>
          <div className="mx-auto mt-5 flex max-w-md flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
            <span className="text-text">{describeRules(challenge.rules)}</span>
            {challenge.goal.minAccuracy !== undefined && <span className="text-text">needs {challenge.goal.minAccuracy}% accuracy</span>}
            <span className="text-main">+{challenge.xp} XP first clear</span>
          </div>
          <p className="mt-3 text-xs text-sub">
            Same words for everyone · new challenge in <Countdown />
          </p>
          {ready && mine && challenge.day === today && (
            <p className="mt-4 text-sm text-text">
              Your best today: <span className="font-mono text-main">{Math.round(mine.wpm)} wpm</span>{" "}
              {mine.passed ? "✓ cleared" : "(not cleared yet)"}
            </p>
          )}
          {status === "signedOut" && (
            <p className="mt-3 text-xs text-sub">You can play as a guest; sign in to get on the leaderboard.</p>
          )}
          <div className="mt-8 text-left">
            <h2 className="mb-3 text-center font-display text-sm uppercase tracking-[0.2em] text-sub">Leaderboard</h2>
            <DailyBoard rows={board} viewerId={viewerId} />
          </div>
        </div>
      }
    />
  );
}
