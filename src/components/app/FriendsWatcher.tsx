"use client";

import { useEffect } from "react";
import { useAuth } from "@/stores/authStore";
import { useFriends } from "@/stores/friendsStore";

/** Keeps the friends badge fresh: on sign-in, every 90 s, and when the tab regains focus. */
export function FriendsWatcher() {
  const userId = useAuth((s) => s.userId);
  useEffect(() => {
    const { refresh, clear } = useFriends.getState();
    if (!userId) {
      clear();
      return;
    }
    void refresh();
    const t = setInterval(() => void refresh(), 90_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [userId]);
  return null;
}
