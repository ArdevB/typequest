"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { TIER_NAMES, TIER_XP, getSkill, type SkillId, type Tier } from "@/challenges/skills";
import type { Outcome } from "@/challenges/types";
import { weakKeyWeights, type RunResult } from "@/engine";
import { useKeyStats } from "@/hooks/useKeyStats";
import { useSkillProgress } from "@/hooks/useSkillProgress";
import { useChallenges } from "@/stores/challengesStore";
import { ChallengeRunner } from "./ChallengeRunner";

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

/** Weak Key Hunt: weights from the account's key stats when signed in, otherwise this browser's. */
function useKeyWeights(enabled: boolean): { weights: Record<string, number> | undefined; weakest: string[] } {
  const { stats } = useKeyStats(enabled);
  return useMemo(() => {
    if (!enabled || Object.keys(stats).length === 0) return { weights: undefined, weakest: [] };
    const weights = weakKeyWeights(stats);
    const weakest = Object.entries(weights)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k);
    return { weights, weakest };
  }, [enabled, stats]);
}

export function SkillChallengeView({ skillId }: { skillId: SkillId }) {
  const skill = getSkill(skillId)!;
  const cleared = useSkillProgress()[skillId] ?? 0;
  const clearSkill = useChallenges((s) => s.clearSkill);
  const [tier, setTier] = useState<Tier>(() => (Math.min(3, cleared + 1) as Tier) || 1);
  const setup = useMemo(() => skill.setup(tier), [skill, tier]);
  const { weights, weakest } = useKeyWeights(Boolean(setup.guard.adaptive));

  const evaluate = useCallback((r: RunResult, natural: boolean) => skill.evaluate(tier, r, natural), [skill, tier]);
  const payload = useCallback(
    ({ log, seed }: { log: RunResult["log"]; seed: number }) => ({
      kind: "skill" as const,
      skillId,
      tier,
      seed,
      log: [...log],
      ...(setup.guard.adaptive && weights ? { keyWeights: weights } : {}),
    }),
    [skillId, tier, setup.guard.adaptive, weights],
  );
  const onAttempt = useCallback(
    (_r: RunResult, o: Outcome) => {
      if (o.passed) clearSkill(skillId, tier);
    },
    [clearSkill, skillId, tier],
  );

  return (
    <ChallengeRunner
      key={tier}
      setup={setup}
      seed={newSeed}
      keyWeights={weights}
      evaluate={evaluate}
      payload={payload}
      onAttempt={onAttempt}
      intro={
        <div>
          <p className="font-mono text-sm text-main">Skill challenge</p>
          <h1 className="mt-2 font-display text-4xl font-black tracking-wide text-text">{skill.name}</h1>
          <p className="mx-auto mt-3 max-w-md text-sub">{skill.tagline}</p>

          <div className="mx-auto mt-6 grid max-w-lg gap-2 sm:grid-cols-3" role="group" aria-label="Tier">
            {([1, 2, 3] as const).map((t) => (
              <button
                key={t}
                type="button"
                className="tq-tier"
                aria-pressed={tier === t}
                data-cleared={cleared >= t}
                onClick={() => setTier(t)}
              >
                <span className="tq-tier-name flex items-center gap-2 text-sm font-medium text-text">
                  <i className="tq-medal" data-tier={t} />
                  {TIER_NAMES[t]}
                </span>
                <span className="mt-1 block text-xs text-sub">{skill.goals[t]}</span>
                <span className="mt-1 block text-xs text-main">+{TIER_XP[t]} XP</span>
              </button>
            ))}
          </div>

          {setup.guard.adaptive && (
            <p className="mt-4 text-sm text-sub">
              {weakest.length > 0 ? (
                <>
                  Targeting your weakest keys: <span className="font-mono text-text">{weakest.map((k) => k.toUpperCase()).join(" ")}</span>
                </>
              ) : (
                <>Do a few speed tests first so we can find your weak keys. For now you&apos;ll get normal words.</>
              )}
            </p>
          )}
          {setup.guard.failOnError && <p className="mt-4 text-sm text-error">One mistake ends the run.</p>}
          {setup.guard.blind && <p className="mt-4 text-sm text-sub">Right and wrong letters look the same, and errors are silent.</p>}
          <p className="mt-4 text-xs text-sub">
            <Link href="/challenges" className="hover:text-text">
              ← All challenges
            </Link>
          </p>
        </div>
      }
    />
  );
}
