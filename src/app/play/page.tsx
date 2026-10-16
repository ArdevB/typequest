import type { Metadata } from "next";
import { GameBoard } from "@/components/games/GameBoard";
import { GamesHub } from "@/components/games/GamesHub";

export const metadata: Metadata = {
  title: "Play",
  description: "Typing games: Falling Words, Boss Battle, Racing, Stickman Duel and the Weekly Boss.",
};

/** Static: the high scores load in the browser, so the page opens instantly. */
export default function PlayPage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <GamesHub />
      <GameBoard />
    </div>
  );
}
