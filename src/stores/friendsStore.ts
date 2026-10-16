import { create } from "zustand";
import { listFriendChallenges, listFriends, type FriendChallengeRow, type FriendRow } from "@/lib/friends";
import { useAuth } from "./authStore";

interface FriendsState {
  friends: FriendRow[];
  challenges: FriendChallengeRow[];
  loaded: boolean;
  error: string | null;
  /** Things waiting on you: friend requests + challenges you haven't played yet. */
  pending: number;
  refresh: () => Promise<void>;
  clear: () => void;
}

/** The signed-in player's friends and friend challenges (refreshed by <FriendsWatcher/> and after actions). */
export const useFriends = create<FriendsState>((set) => ({
  friends: [],
  challenges: [],
  loaded: false,
  error: null,
  pending: 0,
  refresh: async () => {
    const me = useAuth.getState().userId;
    if (!me) return;
    const [f, c] = await Promise.all([listFriends(), listFriendChallenges()]);
    if (!f.ok || !c.ok) {
      set({ loaded: true, error: (!f.ok ? f.error : null) ?? (!c.ok ? c.error : null) ?? "Couldn't load friends." });
      return;
    }
    const pending =
      f.data.filter((r) => r.relation === "incoming").length + c.data.filter((x) => x.opponent === me && x.status === "open").length;
    set({ friends: f.data, challenges: c.data, loaded: true, error: null, pending });
  },
  clear: () => set({ friends: [], challenges: [], loaded: false, error: null, pending: 0 }),
}));
