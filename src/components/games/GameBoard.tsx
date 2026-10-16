"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LevelBadge } from "@/components/progress/RankBadge";
import { GAMES } from "@/games/registry";
import type { GameId } from "@/games/types";
import { weeklySeed } from "@/games/weekly";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/stores/authStore";

export interface GameBoardRow {
  position: number;
  user_id: string;
  username: string;
  level: number;
  score: number;
  wpm: number;
  won: boolean;
}

/**
 * Top scores for one game, fetched in the browser so the Play page itself is
 * static and opens instantly. `null` rows = accounts aren't set up.
 */
export function GameBoard() {
  const [board, setBoard] = useState<GameId>(GAMES[0]!.id);
  const [rows, setRows] = useState<GameBoardRow[] | null | "loading">("loading");
  const viewerId = useAuth((s) => s.userId);

  // ?board=racing from the results screen's "Leaderboard" link.
  useEffect(() => {
    const b = new URLSearchParams(window.location.search).get("board");
    if (b && GAMES.some((g) => g.id === b)) setBoard(b as GameId);
  }, []);

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) {
      setRows(null);
      return;
    }
    let live = true;
    setRows("loading");
    const q =
      board === "weekly-boss"
        ? sb.rpc("weekly_boss_leaderboard", { p_seed: weeklySeed(), p_limit: 20 })
        : sb.rpc("game_leaderboard", { p_game: board, p_limit: 20 });
    void q.then(({ data, error }) => {
      if (!live) return;
      if (error) console.warn("[play] leaderboard", error.message);
      setRows((data ?? []) as GameBoardRow[]);
    });
    return () => {
      live = false;
    };
  }, [board]);

  const pick = (id: GameId) => {
    setBoard(id);
    window.history.replaceState(null, "", `/play?board=${id}#board`);
  };

  return (
    <section id="board" aria-labelledby="board-title" className="pb-12 pt-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 id="board-title" className="font-display text-sm uppercase tracking-[0.25em] text-sub">
          High scores
        </h2>
        <div className="flex flex-wrap gap-1 text-sm" role="tablist" aria-label="Game">
          {GAMES.map((g) => (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={g.id === board}
              onClick={() => pick(g.id)}
              className={`rounded-full px-3 py-1 ${g.id === board ? "bg-main text-bg" : "text-sub hover:text-text"}`}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>
      {rows === "loading" ? (
        <div className="tq-card h-40 animate-pulse" aria-label="Loading high scores" />
      ) : rows === null ? (
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
