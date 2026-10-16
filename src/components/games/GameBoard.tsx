import Link from "next/link";
import { LevelBadge } from "@/components/progress/RankBadge";
import { GAMES } from "@/games/registry";
import type { GameId } from "@/games/types";

export interface GameBoardRow {
  position: number;
  user_id: string;
  username: string;
  level: number;
  score: number;
  wpm: number;
  won: boolean;
}

/** Top scores for one game. `rows` is null when accounts aren't set up. */
export function GameBoard({ board, rows, viewerId }: { board: GameId; rows: GameBoardRow[] | null; viewerId: string | null }) {
  return (
    <section id="board" aria-labelledby="board-title" className="pb-12 pt-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 id="board-title" className="font-display text-sm uppercase tracking-[0.25em] text-sub">
          High scores
        </h2>
        <nav className="flex flex-wrap gap-1 text-sm" aria-label="Game">
          {GAMES.map((g) => (
            <Link
              key={g.id}
              href={`/play?board=${g.id}#board`}
              scroll={false}
              aria-current={g.id === board ? "page" : undefined}
              className={`rounded-full px-3 py-1 ${g.id === board ? "bg-main text-bg" : "text-sub hover:text-text"}`}
            >
              {g.name}
            </Link>
          ))}
        </nav>
      </div>
      {rows === null ? (
        <p className="tq-card text-sm text-sub">High scores appear here once accounts are set up.</p>
      ) : rows.length === 0 ? (
        <p className="tq-card text-sm text-sub">No scores yet. Sign in and play to claim the top spot.</p>
      ) : (
        <div className="tq-card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-sub">
              <tr>
                <th className="px-4 py-3 font-normal">#</th>
                <th className="px-4 py-3 font-normal">player</th>
                <th className="px-4 py-3 text-right font-normal">score</th>
                <th className="px-4 py-3 text-right font-normal">wpm</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} className={`border-t border-border ${r.user_id === viewerId ? "bg-main/10" : ""}`}>
                  <td className="px-4 py-2.5 font-mono tabular-nums text-sub">{r.position}</td>
                  <td className="px-4 py-2.5">
                    <Link href={`/profile/${r.username}`} className="inline-flex items-center gap-2 text-text hover:text-main">
                      <LevelBadge level={r.level} />
                      {r.username}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-text">{r.score.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-sub">{Math.round(Number(r.wpm))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
