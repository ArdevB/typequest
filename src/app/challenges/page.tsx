import type { Metadata } from "next";
import { ChallengesHub } from "@/components/challenges/ChallengesHub";
import { loadDaily } from "@/server/daily";

// Always render fresh: the daily challenge changes at midnight (Nepal time).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Challenges",
  description: "Daily typing challenge, skill trials (Perfect Run, Sudden Death, Speed Gate, Blind Mode and more) and streaks.",
};

export default async function ChallengesPage() {
  const { configured, challenge, board } = await loadDaily();
  return <ChallengesHub daily={challenge} board={board} configured={configured} />;
}
