"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { friendStatus, removeFriend, respondToRequest, sendFriendRequest, type Relation } from "@/lib/friends";
import { useAuth } from "@/stores/authStore";
import { useFriends } from "@/stores/friendsStore";
import { toast } from "@/stores/toastStore";

/** On someone else's profile: add / accept / pending / friends + challenge. */
export function FriendButton({ userId, username }: { userId: string; username: string }) {
  const status = useAuth((s) => s.status);
  const me = useAuth((s) => s.userId);
  const [rel, setRel] = useState<{ relation: Relation; id?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status !== "signedIn" || me === userId) return;
    void friendStatus(userId).then((r) => r.ok && setRel(r.data));
  }, [status, me, userId]);

  if (status !== "signedIn" || me === userId || !rel) return null;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    await fn();
    const r = await friendStatus(userId);
    if (r.ok) setRel(r.data);
    setBusy(false);
    void useFriends.getState().refresh();
  };

  if (rel.relation === "friend") {
    return (
      <div className="flex flex-wrap gap-2">
        <Link href={`/friends/challenge/new?to=${userId}&name=${encodeURIComponent(username)}`} className="tq-btn tq-btn-primary py-1.5 text-sm">
          Challenge
        </Link>
        <span className="tq-btn cursor-default py-1.5 text-sm text-sub">✓ Friends</span>
      </div>
    );
  }
  if (rel.relation === "incoming") {
    return (
      <button type="button" disabled={busy} className="tq-btn tq-btn-primary py-1.5 text-sm" onClick={() => run(() => respondToRequest(rel.id!, true))}>
        Accept friend request
      </button>
    );
  }
  if (rel.relation === "outgoing") {
    return (
      <button type="button" disabled={busy} className="tq-btn py-1.5 text-sm" onClick={() => run(() => removeFriend(userId))} title="Cancel request">
        Request sent · cancel
      </button>
    );
  }
  return (
    <button
      type="button"
      disabled={busy}
      className="tq-btn tq-btn-primary py-1.5 text-sm"
      onClick={() =>
        run(async () => {
          const r = await sendFriendRequest(username);
          toast({ title: r.message, tone: r.ok ? "success" : "error" });
        })
      }
    >
      Add friend
    </button>
  );
}
