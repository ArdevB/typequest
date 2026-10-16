"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { LevelBadge, RankBadge } from "@/components/progress/RankBadge";
import { Flame } from "@/components/progress/StreakBadge";
import { declineChallenge, describeSettings, removeFriend, respondToRequest, sendFriendRequest, type FriendChallengeRow, type FriendRow } from "@/lib/friends";
import { levelProgress } from "@/lib/progression";
import { useAuth } from "@/stores/authStore";
import { useFriends } from "@/stores/friendsStore";
import { toast } from "@/stores/toastStore";

export function FriendsView() {
  const status = useAuth((s) => s.status);
  const me = useAuth((s) => s.userId);
  const { friends, challenges, loaded, error, refresh } = useFriends();

  if (status === "loading") return <Skeleton />;
  if (status === "disabled") {
    return (
      <Shell>
        <p className="tq-card text-sub">Friends need accounts, which aren&apos;t set up on this server yet.</p>
      </Shell>
    );
  }
  if (status === "signedOut" || !me) {
    return (
      <Shell>
        <div className="tq-card text-center">
          <p className="text-text">Sign in to add friends, see their levels and challenge them to typing duels.</p>
          <Link href="/auth?next=/friends" className="tq-btn tq-btn-primary mt-4 inline-flex">
            Sign in
          </Link>
        </div>
      </Shell>
    );
  }
  if (!loaded) return <Skeleton />;

  const accepted = friends.filter((f) => f.relation === "friend");
  const incoming = friends.filter((f) => f.relation === "incoming");
  const outgoing = friends.filter((f) => f.relation === "outgoing");
  const yourTurn = challenges.filter((c) => c.status === "open" && c.opponent === me);
  const waiting = challenges.filter((c) => c.status === "open" && c.challenger === me);
  const finished = challenges.filter((c) => c.status !== "open").slice(0, 12);

  return (
    <Shell>
      {error && <p className="tq-card mb-6 text-sm text-error">{error}</p>}
      <AddFriend onDone={refresh} />

      {incoming.length > 0 && (
        <Section title="Friend requests" count={incoming.length}>
          <ul className="space-y-2">
            {incoming.map((f) => (
              <li key={f.friendship_id} className="tq-card flex flex-wrap items-center gap-3 py-3">
                <PlayerLine f={f} />
                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    className="tq-btn tq-btn-primary py-1.5 text-sm"
                    onClick={async () => {
                      const r = await respondToRequest(f.friendship_id, true);
                      toast(r.ok ? { title: `You and ${f.username} are now friends`, tone: "success" } : { title: "Couldn't accept", body: r.error, tone: "error" });
                      void refresh();
                    }}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="tq-btn py-1.5 text-sm"
                    onClick={async () => {
                      await respondToRequest(f.friendship_id, false);
                      void refresh();
                    }}
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {yourTurn.length > 0 && (
        <Section title="Your turn" count={yourTurn.length}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {yourTurn.map((c) => (
              <li key={c.id} className="tq-card tq-challenge-card">
                <p className="text-sm text-sub">
                  <span className="font-medium text-text">{c.challenger_name}</span> challenged you · {describeSettings(c.settings)}
                </p>
                <p className="mt-2 font-display text-2xl font-bold text-text">
                  Beat <span className="text-main">{Math.round(Number(c.challenger_wpm))} WPM</span>
                </p>
                <p className="text-xs text-sub">at {Math.round(Number(c.challenger_accuracy))}% accuracy · same words they had</p>
                <div className="mt-4 flex gap-2">
                  <Link href={`/friends/challenge/${c.id}`} className="tq-btn tq-btn-primary py-1.5 text-sm">
                    Accept challenge
                  </Link>
                  <button
                    type="button"
                    className="tq-btn py-1.5 text-sm"
                    onClick={async () => {
                      await declineChallenge(c.id);
                      void refresh();
                    }}
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Friends" count={accepted.length}>
        {accepted.length === 0 ? (
          <p className="tq-card text-sm text-sub">No friends yet. Add someone by their username above — they&apos;ll get a request.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {accepted.map((f, i) => (
              <FriendCard key={f.user_id} f={f} place={i + 1} onRemoved={refresh} />
            ))}
          </ul>
        )}
        {outgoing.length > 0 && (
          <p className="mt-3 text-sm text-sub">
            Waiting for {outgoing.map((f, i) => (
              <span key={f.user_id}>
                {i > 0 && ", "}
                <Link href={`/profile/${f.username}`} className="text-text hover:text-main">
                  {f.username}
                </Link>{" "}
                <button
                  type="button"
                  className="text-xs underline-offset-2 hover:text-error hover:underline"
                  onClick={async () => {
                    await removeFriend(f.user_id);
                    void refresh();
                  }}
                >
                  (cancel)
                </button>
              </span>
            ))}{" "}
            to accept.
          </p>
        )}
      </Section>

      {waiting.length > 0 && (
        <Section title="Waiting for them" count={waiting.length}>
          <ul className="space-y-2">
            {waiting.map((c) => (
              <li key={c.id} className="tq-card flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span>
                  You challenged <span className="text-text">{c.opponent_name}</span> · {describeSettings(c.settings)}
                </span>
                <span className="font-mono text-sub">
                  your score <span className="text-text">{Math.round(Number(c.challenger_wpm))} wpm</span> · expires {new Date(c.expires_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {finished.length > 0 && (
        <Section title="Results">
          <ul className="space-y-2">
            {finished.map((c) => (
              <ResultRow key={c.id} c={c} me={me} />
            ))}
          </ul>
        </Section>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl py-4">
      <h1 className="font-display text-3xl font-black text-text sm:text-4xl">Friends</h1>
      <p className="mt-2 max-w-2xl text-sub">Add friends, compare levels, and challenge them: you both type the exact same words, and the higher WPM wins.</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="mb-3 flex items-center gap-2 font-display text-sm uppercase tracking-[0.25em] text-sub">
        {title}
        {count !== undefined && count > 0 && <span className="font-mono text-xs tracking-normal">({count})</span>}
      </h2>
      {children}
    </section>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl py-4" aria-label="Loading friends">
      <div className="tq-skel h-9 w-40" />
      <div className="tq-skel mt-8 h-16" />
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <div className="tq-skel h-40" />
        <div className="tq-skel h-40" />
        <div className="tq-skel h-40" />
      </div>
    </div>
  );
}

function AddFriend({ onDone }: { onDone: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const u = name.trim();
    if (!u) return;
    setBusy(true);
    const r = await sendFriendRequest(u);
    setBusy(false);
    setMsg({ ok: r.ok, text: r.message });
    if (r.ok) {
      setName("");
      void onDone();
    }
  };
  return (
    <form onSubmit={submit} className="tq-card flex flex-wrap items-center gap-3">
      <label htmlFor="friend-name" className="text-sm text-sub">
        Add a friend
      </label>
      <input
        id="friend-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="their username"
        autoComplete="off"
        spellCheck={false}
        maxLength={20}
        className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 font-mono text-text outline-none focus:border-main"
      />
      <button type="submit" className="tq-btn tq-btn-primary py-2" disabled={busy || !name.trim()}>
        {busy ? "Sending…" : "Send request"}
      </button>
      {msg && (
        <p className={`w-full text-sm ${msg.ok ? "text-main" : "text-error"}`} role="status">
          {msg.text}
        </p>
      )}
    </form>
  );
}

function PlayerLine({ f }: { f: FriendRow }) {
  return (
    <Link href={`/profile/${f.username}`} className="flex items-center gap-3 text-text hover:text-main">
      <LevelBadge level={f.level} size={34} />
      <span>
        <span className="block font-medium">{f.username}</span>
        <span className="block text-xs text-sub">Level {f.level}</span>
      </span>
    </Link>
  );
}

function FriendCard({ f, place, onRemoved }: { f: FriendRow; place: number; onRemoved: () => Promise<void> }) {
  const [confirm, setConfirm] = useState(false);
  const lp = levelProgress(f.xp);
  return (
    <li className="tq-card flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/profile/${f.username}`} className="flex items-center gap-3 hover:text-main">
          <LevelBadge level={f.level} size={42} />
          <span>
            <span className="block font-display text-lg font-bold text-text">{f.username}</span>
            <span className="block text-xs text-sub">
              Level {f.level} · {f.xp.toLocaleString()} XP
            </span>
          </span>
        </Link>
        <span className="font-mono text-xs text-sub" title="Position among your friends by level">
          #{place}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-bg-alt" aria-label={`${Math.round(lp.fraction * 100)}% to level ${f.level + 1}`}>
        <div className="h-full rounded-full bg-main" style={{ width: `${Math.round(lp.fraction * 100)}%` }} />
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center text-xs text-sub">
        <div>
          <dt>rank</dt>
          <dd className="mt-1">
            <RankBadge rank={f.rank} />
          </dd>
        </div>
        <div>
          <dt>best wpm</dt>
          <dd className="mt-1 font-mono text-base text-text">{Math.round(Number(f.best_wpm)) || "—"}</dd>
        </div>
        <div>
          <dt>streak</dt>
          <dd className="mt-1 inline-flex items-center gap-1 font-mono text-base text-text">
            {f.streak > 0 && <Flame size={14} />}
            {f.streak}
          </dd>
        </div>
      </dl>
      <div className="mt-auto flex gap-2">
        <Link href={`/friends/challenge/new?to=${f.user_id}&name=${encodeURIComponent(f.username)}`} className="tq-btn tq-btn-primary flex-1 justify-center py-1.5 text-sm">
          Challenge
        </Link>
        <button
          type="button"
          className={`tq-btn py-1.5 text-sm ${confirm ? "border-error text-error" : ""}`}
          onClick={async () => {
            if (!confirm) {
              setConfirm(true);
              setTimeout(() => setConfirm(false), 3000);
              return;
            }
            await removeFriend(f.user_id);
            void onRemoved();
          }}
        >
          {confirm ? "Sure?" : "Remove"}
        </button>
      </div>
    </li>
  );
}

function ResultRow({ c, me }: { c: FriendChallengeRow; me: string }) {
  const iAmChallenger = c.challenger === me;
  const them = iAmChallenger ? c.opponent_name : c.challenger_name;
  const mine = iAmChallenger ? c.challenger_wpm : c.opponent_wpm;
  const theirs = iAmChallenger ? c.opponent_wpm : c.challenger_wpm;
  const label =
    c.status === "declined" ? "Declined" : c.status === "expired" ? "Expired" : c.winner === null ? "Draw" : c.winner === me ? "Won" : "Lost";
  const tone = label === "Won" ? "text-main" : label === "Lost" ? "text-error" : "text-sub";
  return (
    <li className="tq-card flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
      <span>
        <span className={`mr-2 font-display text-xs uppercase tracking-widest ${tone}`}>{label}</span>
        vs <span className="text-text">{them}</span> · {describeSettings(c.settings)}
      </span>
      {c.status === "done" && (
        <span className="font-mono text-sub">
          you <span className="text-text">{Math.round(Number(mine))}</span> · them <span className="text-text">{Math.round(Number(theirs))}</span> wpm
        </span>
      )}
    </li>
  );
}
