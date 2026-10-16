import type { Metadata } from "next";
import { GameBoard, type GameBoardRow } from "@/components/games/GameBoard";
import { GamesHub } from "@/components/games/GamesHub";
import { GAMES } from "@/games/registry";
import { weeklySeed } from "@/games/weekly";
import { getServerSupabase, getUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Play",
  description: "Typing games: Falling Words, Boss Battle, Racing and Stickman Duel.",
};

interface Props {
  searchParams: Promise<{ board?: string }>;
}

export default async function PlayPage({ searchParams }: Props) {
  const sp = await searchParams;
  const board = GAMES.find((g) => g.id === sp.board)?.id ?? GAMES[0]!.id;

  const supabase = await getServerSupabase();
  let rows: GameBoardRow[] | null = null;
  let viewerId: string | null = null;
  if (supabase) {
    const [{ data, error }, uid] = await Promise.all([
      board === "weekly-boss"
        ? supabase.rpc("weekly_boss_leaderboard", { p_seed: weeklySeed(), p_limit: 20 })
        : supabase.rpc("game_leaderboard", { p_game: board, p_limit: 20 }),
      getUserId(supabase),
    ]);
    if (error) console.warn("[play] game_leaderboard", error.message);
    rows = (data ?? []) as GameBoardRow[];
    viewerId = uid;
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <GamesHub />
      <GameBoard board={board} rows={rows} viewerId={viewerId} />
    </div>
  );
}
