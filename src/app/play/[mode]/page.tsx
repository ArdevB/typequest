import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GamePlayer } from "@/components/games/GamePlayer";
import { GAMES, getGame } from "@/games/registry";

interface Props {
  params: Promise<{ mode: string }>;
}

export function generateStaticParams() {
  return GAMES.map((g) => ({ mode: g.id }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const game = getGame((await params).mode);
  return game ? { title: game.name, description: game.tagline } : {};
}

export default async function GamePage({ params }: Props) {
  const game = getGame((await params).mode);
  if (!game) notFound();
  return <GamePlayer game={game} />;
}
