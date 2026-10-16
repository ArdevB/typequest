import type { Metadata } from "next";
import Link from "next/link";
import { NotConfigured } from "@/components/app/NotConfigured";
import { DailyChallengeView } from "@/components/challenges/DailyChallengeView";
import { loadDaily } from "@/server/daily";

// Always render fresh: the daily challenge changes at midnight (Nepal time).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daily challenge",
  description: "One text and one set of rules for everyone, every day. Climb today's leaderboard.",
};

export default async function DailyPage() {
  const { configured, challenge, board, error } = await loadDaily();
  if (!configured) return <NotConfigured what="Daily challenges" />;
  if (!challenge) {
    return (
      <div className="tq-card mx-auto my-16 max-w-md text-center">
        <h1 className="font-display text-2xl font-bold text-text">Today&apos;s challenge isn&apos;t available</h1>
        <p className="mt-3 text-sm text-sub">
          Has the Phase 4 database script (<code>supabase/migrations/20261016020000_challenges.sql</code>) been run?
        </p>
        {error && <p className="mt-2 font-mono text-xs text-error">{error}</p>}
        <Link href="/challenges" className="tq-btn mt-5">
          Back to challenges
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col justify-center py-6">
      <DailyChallengeView key={challenge.id} challenge={challenge} board={board} />
    </div>
  );
}
