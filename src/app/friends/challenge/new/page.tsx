import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FriendChallengeRunner } from "@/components/friends/FriendChallengeRunner";

export const metadata: Metadata = { title: "Challenge a friend" };

interface Props {
  searchParams: Promise<{ to?: string; name?: string }>;
}

export default async function NewChallengePage({ searchParams }: Props) {
  const { to, name } = await searchParams;
  if (!to || !/^[0-9a-f-]{36}$/i.test(to)) notFound();
  return <FriendChallengeRunner kind="new" opponentId={to} opponentName={(name ?? "your friend").slice(0, 20)} />;
}
