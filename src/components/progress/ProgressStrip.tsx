"use client";

import gsap from "gsap";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef } from "react";
import type { ProgressResponse } from "@/lib/payloads";
import type { Rank } from "@/lib/progression";
import { LevelBar } from "./LevelBar";
import { LevelBadge, RankBadge } from "./RankBadge";

/** Where saving a finished run/lesson stands, shown under the results. */
export type SaveState =
  | { state: "off" }
  | { state: "skipped" }
  | { state: "guest" }
  | { state: "saving"; fromXp: number }
  | { state: "saved"; fromXp: number; data: ProgressResponse }
  | { state: "error"; error: string };

export function ProgressStrip({ save, reducedMotion }: { save: SaveState; reducedMotion: boolean }) {
  const pathname = usePathname();
  const gainRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (save.state !== "saved" || reducedMotion || !gainRef.current) return;
    const tween = gsap.fromTo(
      gainRef.current,
      { scale: 0.4, opacity: 0, y: 8 },
      { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: "back.out(3)", delay: 0.2 },
    );
    return () => {
      tween.kill();
    };
  }, [save, reducedMotion]);

  if (save.state === "off" || save.state === "skipped") return null;

  if (save.state === "guest") {
    return (
      <div className="tq-card mx-auto mt-6 flex max-w-xl flex-wrap items-center justify-between gap-3 text-left">
        <p className="text-sm text-sub">
          <span className="text-text">Playing as a guest.</span> Sign in to save this to your profile, earn XP and get on the
          leaderboard. Your progress here comes with you.
        </p>
        <Link href={`/auth?mode=signup&next=${encodeURIComponent(pathname)}`} className="tq-btn tq-btn-primary shrink-0 py-1.5 text-sm">
          Sign up
        </Link>
      </div>
    );
  }

  if (save.state === "error") {
    return <p className="mt-5 text-center text-sm text-error">{save.error}</p>;
  }

  const saved = save.state === "saved" ? save.data : null;
  const xp = saved ? saved.xp : save.fromXp;
  return (
    <div className="tq-card mx-auto mt-6 w-full max-w-xl" aria-live="polite">
      <div className="mb-2 flex items-center gap-3">
        <LevelBadge level={saved?.level ?? 1} size={30} />
        <div className="flex-1 text-left">
          <p className="text-sm text-text">
            {saved ? (saved.leveledUp ? `Level up! You reached level ${saved.level}` : `Level ${saved.level}`) : "Saving…"}
          </p>
        </div>
        {saved && <RankBadge rank={saved.rank as Rank} />}
        {saved && (
          <span ref={gainRef} className="font-display text-xl font-bold text-main">
            +{saved.xpAwarded} XP
          </span>
        )}
      </div>
      <LevelBar xp={xp} fromXp={saved ? save.fromXp : undefined} reducedMotion={reducedMotion} />
    </div>
  );
}
