import type { Metadata } from "next";
import { FriendsView } from "@/components/friends/FriendsView";

export const metadata: Metadata = {
  title: "Friends",
  description: "Add friends, see their levels and challenge them to typing duels on the same words.",
};

export default function FriendsPage() {
  return <FriendsView />;
}
