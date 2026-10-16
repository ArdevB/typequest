import Link from "next/link";
import { LevelBadge } from "@/components/progress/RankBadge";
import type { DailyBoardRow } from "@/server/daily";

/** Today's daily-challenge leaderboard (best passed attempt per player). */
export function DailyBoard({ rows, viewerId }: { rows: readonly DailyBoardRow[]; viewerId?: string | null }) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-sub">Nobody has cleared today&apos;s challenge yet. Be first!</p>;
  return (
    <ol className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.user_id} className="tq-lb-row" data-me={r.user_id === viewerId} data-podium={r.position <= 3 ? r.position : undefined}>
          <span className="tq-lb-pos font-mono">{r.position}</span>
          <LevelBadge level={r.level} size={24} />
          <Link href={`/profile/${r.username}`} className="min-w-0 flex-1 truncate text-text hover:text-main">
            {r.username}
          </Link>
          <span className="font-mono text-lg text-main">{Math.round(Number(r.wpm))}</span>
          <span className="w-12 text-right font-mono text-sm text-sub">{Math.round(Number(r.accuracy))}%</span>
        </li>
      ))}
    </ol>
  );
}
