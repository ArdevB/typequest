"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { RunResult, TestMode, TypingEngine } from "@/engine";
import { Mascot } from "@/components/mascot/Mascot";
import { TypingSurface } from "@/components/typing/TypingSurface";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { playFriendChallenge, sendFriendChallenge } from "@/lib/api/client";
import { celebrate } from "@/lib/confetti";
import { describeSettings, loadChallenge, type FriendChallengeRow } from "@/lib/friends";
import type { FriendChallengeSettings } from "@/lib/payloads";
import { useAuth } from "@/stores/authStore";
import { useFriends } from "@/stores/friendsStore";
import { useSettings } from "@/stores/settingsStore";

type Props = { kind: "new"; opponentId: string; opponentName: string } | { kind: "play"; challengeId: string };

type Phase =
  | { kind: "setup" }
  | { kind: "typing" }
  | { kind: "saving"; result: RunResult }
  | { kind: "sent"; result: RunResult }
  | { kind: "played"; result: RunResult; winner: string | null; theirWpm: number }
  | { kind: "error"; message: string; result?: RunResult };

const MODES: { label: string; mode: FriendChallengeSettings["mode"] }[] = [
  { label: "15s", mode: { kind: "time", seconds: 15 } },
  { label: "30s", mode: { kind: "time", seconds: 30 } },
  { label: "60s", mode: { kind: "time", seconds: 60 } },
  { label: "25 words", mode: { kind: "words", count: 25 } },
  { label: "50 words", mode: { kind: "words", count: 50 } },
];

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

/** Sending a challenge (you type first) or playing one a friend sent (same seed, same settings). */
export function FriendChallengeRunner(props: Props) {
  const status = useAuth((s) => s.status);
  const me = useAuth((s) => s.userId);
  const themeId = useSettings((s) => s.themeId);
  const showLiveWpm = useSettings((s) => s.showLiveWpm);
  const reducedMotion = useReducedMotion();

  const [settings, setSettings] = useState<FriendChallengeSettings>({ mode: { kind: "time", seconds: 30 }, punctuation: false, numbers: false });
  const [seed, setSeed] = useState(newSeed);
  const [challenge, setChallenge] = useState<FriendChallengeRow | null | "loading">(props.kind === "play" ? "loading" : null);
  const [phase, setPhase] = useState<Phase>({ kind: "setup" });
  const [runKey, setRunKey] = useState(0);
  const [, setEngine] = useState<TypingEngine | null>(null);

  // Load the challenge you're answering.
  useEffect(() => {
    if (props.kind !== "play" || status !== "signedIn") return;
    void loadChallenge(props.challengeId).then((c) => {
      setChallenge(c);
      if (c) {
        setSettings(c.settings);
        setSeed(Number(c.seed));
      }
    });
  }, [props, status]);

  const mode: TestMode = settings.mode;

  const start = () => {
    setRunKey((k) => k + 1);
    setPhase({ kind: "typing" });
  };

  const onFinish = useCallback(
    (result: RunResult) => {
      setPhase({ kind: "saving", result });
      const log = [...result.log];
      if (props.kind === "new") {
        void sendFriendChallenge({ opponentId: props.opponentId, settings, seed, log }).then((r) => {
          setPhase(r.ok ? { kind: "sent", result } : { kind: "error", message: r.error, result });
          if (r.ok) void useFriends.getState().refresh();
        });
      } else {
        void playFriendChallenge(props.challengeId, log).then((r) => {
          if (!r.ok) {
            setPhase({ kind: "error", message: r.error, result });
            return;
          }
          setPhase({ kind: "played", result, winner: r.data.winner, theirWpm: r.data.challengerWpm });
          void useFriends.getState().refresh();
          if (r.data.winner === me && !reducedMotion) {
            const css = getComputedStyle(document.documentElement);
            void celebrate(["--main", "--caret", "--combo-3"].map((v) => css.getPropertyValue(v).trim()).filter(Boolean));
          }
        });
      }
    },
    [props, settings, seed, me, reducedMotion],
  );

  // Esc goes back to the intro while typing.
  useEffect(() => {
    if (phase.kind !== "typing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setPhase({ kind: "setup" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase.kind]);

  if (status === "loading" || challenge === "loading") return <div className="tq-skel mx-auto mt-10 h-64 max-w-2xl" />;
  if (status !== "signedIn") {
    return (
      <Box>
        <p className="text-text">Sign in to play friend challenges.</p>
        <Link href="/auth" className="tq-btn tq-btn-primary mt-4 inline-flex">
          Sign in
        </Link>
      </Box>
    );
  }
  if (props.kind === "play" && (!challenge || challenge.opponent !== me)) {
    return (
      <Box>
        <p className="text-text">This challenge doesn&apos;t exist, or it isn&apos;t for you.</p>
        <Link href="/friends" className="tq-btn mt-4 inline-flex">
          Back to friends
        </Link>
      </Box>
    );
  }
  if (props.kind === "play" && challenge && challenge.status !== "open") {
    return (
      <Box>
        <p className="text-text">This challenge is {challenge.status === "done" ? "already played" : challenge.status}.</p>
        <Link href="/friends" className="tq-btn mt-4 inline-flex">
          Back to friends
        </Link>
      </Box>
    );
  }

  const target = props.kind === "play" && challenge ? Math.round(Number(challenge.challenger_wpm)) : null;
  const rival = props.kind === "play" && challenge ? challenge.challenger_name : props.kind === "new" ? props.opponentName : "";

  if (phase.kind === "typing") {
    return (
      <div className="mx-auto w-full max-w-5xl py-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 text-sm text-sub">
          <span>
            {props.kind === "new" ? "Challenge for" : "Challenge from"} <span className="text-text">{rival}</span> · {describeSettings(settings)}
          </span>
          {target !== null && (
            <span className="font-mono">
              beat <span className="text-main">{target} wpm</span>
            </span>
          )}
        </div>
        <TypingSurface
          mode={mode}
          stopOnError="off"
          punctuation={settings.punctuation}
          numbers={settings.numbers}
          seed={seed}
          runKey={runKey}
          themeId={themeId}
          reducedMotion={reducedMotion}
          showLiveWpm={showLiveWpm}
          onFinish={onFinish}
          onEngine={setEngine}
        />
        <p className="tq-chrome mt-8 text-center text-xs text-sub">
          <kbd>Esc</kbd> — back
        </p>
      </div>
    );
  }

  if (phase.kind === "saving") return <Box>Checking your run…</Box>;

  if (phase.kind === "sent") {
    return (
      <Box>
        <Mascot engine={null} mood="cheer" size={80} />
        <p className="mt-3 font-display text-sm uppercase tracking-[0.3em] text-main">Challenge sent</p>
        <p className="mt-2 font-display text-3xl font-black text-text">{Math.round(phase.result.wpm)} WPM</p>
        <p className="mt-1 text-sub">
          {Math.round(phase.result.accuracy)}% accuracy. {rival} now gets the same words — they have 7 days to beat you.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/friends" className="tq-btn tq-btn-primary">
            Back to friends
          </Link>
        </div>
      </Box>
    );
  }

  if (phase.kind === "played") {
    const mine = Math.round(phase.result.wpm);
    const theirs = Math.round(phase.theirWpm);
    const outcome = phase.winner === null ? "draw" : phase.winner === me ? "win" : "loss";
    return (
      <Box>
        <Mascot engine={null} mood={outcome === "win" ? "cheer" : outcome === "draw" ? "happy" : "sad"} size={80} />
        <p className={`mt-3 font-display text-sm uppercase tracking-[0.3em] ${outcome === "win" ? "text-main" : outcome === "loss" ? "text-error" : "text-sub"}`}>
          {outcome === "win" ? "You win!" : outcome === "loss" ? `${rival} wins` : "It's a draw"}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="tq-card">
            <div className="text-xs uppercase tracking-widest text-sub">you</div>
            <div className={`mt-1 font-mono text-3xl tabular-nums ${outcome === "win" ? "text-main" : "text-text"}`}>{mine}</div>
            <div className="text-xs text-sub">{Math.round(phase.result.accuracy)}% acc</div>
          </div>
          <div className="tq-card">
            <div className="text-xs uppercase tracking-widest text-sub">{rival}</div>
            <div className={`mt-1 font-mono text-3xl tabular-nums ${outcome === "loss" ? "text-error" : "text-text"}`}>{theirs}</div>
            <div className="text-xs text-sub">wpm</div>
          </div>
        </div>
        {outcome === "win" && <p className="mt-3 text-sm text-[var(--combo-3)]">+30 XP for the win</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {challenge && (
            <Link
              href={`/friends/challenge/new?to=${challenge.challenger}&name=${encodeURIComponent(challenge.challenger_name)}`}
              className="tq-btn tq-btn-primary"
            >
              Rematch
            </Link>
          )}
          <Link href="/friends" className="tq-btn">
            Back to friends
          </Link>
        </div>
      </Box>
    );
  }

  // Setup / intro (and errors, which return here).
  return (
    <Box>
      {phase.kind === "error" && <p className="tq-card mb-5 text-sm text-error">{phase.message}</p>}
      {props.kind === "new" ? (
        <>
          <p className="font-display text-sm uppercase tracking-[0.3em] text-main">Challenge {rival}</p>
          <p className="mt-2 text-sub">You type first. {rival} gets exactly the same words and has 7 days to beat your WPM.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-1.5" role="group" aria-label="Test length">
            {MODES.map((m) => {
              const on = JSON.stringify(m.mode) === JSON.stringify(settings.mode);
              return (
                <button
                  key={m.label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSettings((s) => ({ ...s, mode: m.mode }))}
                  className="rounded-md border border-border px-3 py-1 text-sm text-sub aria-pressed:border-main aria-pressed:bg-main aria-pressed:text-bg"
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex justify-center gap-4 text-sm text-sub">
            {(["punctuation", "numbers"] as const).map((k) => (
              <label key={k} className="inline-flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={settings[k]} onChange={(e) => setSettings((s) => ({ ...s, [k]: e.target.checked }))} className="accent-[var(--main)]" />
                {k}
              </label>
            ))}
          </div>
          <button
            type="button"
            className="tq-btn tq-btn-primary mt-6 text-lg"
            onClick={() => {
              setSeed(newSeed());
              start();
            }}
          >
            Start — set the score
          </button>
        </>
      ) : (
        <>
          <p className="font-display text-sm uppercase tracking-[0.3em] text-main">{rival} challenged you</p>
          <p className="mt-3 font-display text-4xl font-black text-text">
            Beat <span className="text-main">{target} WPM</span>
          </p>
          <p className="mt-2 text-sub">
            {describeSettings(settings)} · the same words {rival} typed. One try — make it count.
          </p>
          <button type="button" className="tq-btn tq-btn-primary mt-6 text-lg" onClick={start}>
            I&apos;m ready
          </button>
        </>
      )}
    </Box>
  );
}

function Box({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto mt-10 flex w-full max-w-xl flex-col items-center text-center">{children}</div>;
}
