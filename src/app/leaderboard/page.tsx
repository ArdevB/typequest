import type { Metadata } from "next";
import Link from "next/link";
import { NotConfigured } from "@/components/app/NotConfigured";
import { LevelBadge, RankBadge } from "@/components/progress/RankBadge";
import { getServerSupabase, getUserId } from "@/lib/supabase/server";
import type { LeaderboardRow } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "The fastest typists on TypeQuest — today, this week and all time.",
};

const MODES = [
  { key: "time-15", label: "15s" },
  { key: "time-30", label: "30s" },
  { key: "time-60", label: "60s" },
  { key: "time-120", label: "120s" },
  { key: "words-25", label: "25 words" },
  { key: "words-50", label: "50 words" },
] as const;

const PERIODS = [
  { key: "day", label: "Today" },
  { key: "week", label: "This week" },
  { key: "all", label: "All time" },
] as const;

type ModeKey = (typeof MODES)[number]["key"];
type PeriodKey = (typeof PERIODS)[number]["key"];

interface Props {
  searchParams: Promise<{ mode?: string; period?: string }>;
}

export default async function LeaderboardPage({ searchParams }: Props) {
  const sp = await searchParams;
  const mode: ModeKey = MODES.some((m) => m.key === sp.mode) ? (sp.mode as ModeKey) : "time-60";
  const period: PeriodKey = PERIODS.some((p) => p.key === sp.period) ? (sp.period as PeriodKey) : "week";

  const supabase = await getServerSupabase();
  if (!supabase) return <NotConfigured what="Leaderboards" />;

  const [{ data, error }, viewerId] = await Promise.all([
    supabase.rpc("leaderboard", { p_mode_key: mode, p_period: period, p_limit: 50 }),
    getUserId(supabase),
  ]);
  const rows = (data ?? []) as LeaderboardRow[];
  const href = (m: string, p: string) => `/leaderboard?mode=${m}&period=${p}`;

  return (
    <div className="mx-auto w-full max-w-4xl py-4">
      <h1 className="text-center font-display text-4xl font-black tracking-wide text-text">Leaderboard</h1>
      <p className="mt-2 text-center text-sm text-sub">
        Each typist&apos;s best plain test (no punctuation or numbers). Days and weeks follow Nepal time.
      </p>

      <nav className="mt-6 flex flex-wrap justify-center gap-1.5" aria-label="Test type">
        {MODES.map((m) => (
          <Link key={m.key} href={href(m.key, period)} aria-current={m.key === mode ? "page" : undefined} className="tq-tab">
            {m.label}
          </Link>
        ))}
      </nav>
      <nav className="mt-2 flex justify-center gap-1.5" aria-label="Period">
        {PERIODS.map((p) => (
          <Link key={p.key} href={href(mode, p.key)} aria-current={p.key === period ? "page" : undefined} className="tq-tab tq-tab-sm">
            {p.label}
          </Link>
        ))}
      </nav>

      {error ? (
        <p className="mt-10 text-center text-error">Couldn&apos;t load the leaderboard. Has the database migration been run?</p>
      ) : rows.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-sub">No runs here yet. Be the first!</p>
          <Link href="/test" className="tq-btn tq-btn-primary mt-4">
            Take a test
          </Link>
        </div>
      ) : (
        <ol className="mt-8 space-y-1.5">
          {rows.map((r) => {
            const me = r.user_id === viewerId;
            return (
              <li key={r.user_id} className="tq-lb-row" data-me={me} data-podium={r.position <= 3 ? r.position : undefined}>
                <span className="tq-lb-pos font-mono">{r.position}</span>
                <LevelBadge level={r.level} size={26} />
                <Link href={`/profile/${r.username}`} className="min-w-0 flex-1 truncate font-medium text-text hover:text-main">
                  {r.username}
                  {me && <span className="ml-2 text-xs text-main">you</span>}
                </Link>
                <RankBadge rank={r.rank} className="hidden sm:inline-flex" />
                <span className="w-16 text-right font-mono text-xl text-main">{Math.round(Number(r.wpm))}</span>
                <span className="hidden w-14 text-right font-mono text-sm text-sub sm:inline">{Math.round(Number(r.accuracy))}%</span>
                <span className="hidden w-24 text-right text-xs text-sub md:inline">{new Date(r.run_at).toLocaleDateString()}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
