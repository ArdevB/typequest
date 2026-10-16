import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FriendChallengeRunner } from "@/components/friends/FriendChallengeRunner";

export const metadata: Metadata = { title: "Friend challenge" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PlayChallengePage({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return <FriendChallengeRunner kind="play" challengeId={id} />;
}
