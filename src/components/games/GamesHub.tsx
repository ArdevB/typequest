"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { GAMES, getGame } from "@/games/registry";
import { TWIST_INFO, msUntilWeeklyReset, twistFor, weekKey, weeklySeed } from "@/games/weekly";
import { useEffect, useState } from "react";
import type { GameId } from "@/games/types";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useGames } from "@/stores/gamesStore";
import { useHydrated } from "@/stores/hydration";

export function GamesHub() {
  const ready = useHydrated((s) => s.ready);
  const best = useGames((s) => s.best);
  const reducedMotion = useReducedMotion();

  return (
    <section className="pb-8 pt-4">
      <h1 className="font-display text-3xl font-black text-text sm:text-4xl">Play</h1>
      <p className="mt-2 max-w-xl text-sub">Same typing, higher stakes. Every game is scored from your keystrokes, so a high score is a real one.</p>

      <WeeklyCard />

      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {GAMES.filter((g) => g.id !== "weekly-boss").map((g, i) => {
          const b = ready ? best[g.id] : undefined;
          return (
            <motion.li
              key={g.id}
              initial={reducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.25 }}
            >
              <Link href={`/play/${g.id}`} className="tq-card tq-game-card group flex h-full gap-4 hover:border-main">
                <GameArt id={g.id} />
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-lg font-bold text-text group-hover:text-main">{g.name}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-sub">{g.tagline}</p>
                  <p className="mt-3 font-mono text-xs text-sub">
                    {b ? (
                      <>
                        best <span className="text-text">{b.score.toLocaleString()}</span> · {Math.round(b.wpm)} wpm
                      </>
                    ) : (
                      "not played yet"
                    )}
                  </p>
                </div>
              </Link>
            </motion.li>
          );
        })}
      </ul>
    </section>
  );
}

function WeeklyCard() {
  const ready = useHydrated((s) => s.ready);
  const weeklyWins = useGames((s) => s.weeklyWins);
  const best = useGames((s) => s.best["weekly-boss"]);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const info = getGame("weekly-boss")!;
  const twist = now ? TWIST_INFO[twistFor(weeklySeed(now))] : null;
  const beaten = ready && now !== null && weeklyWins.includes(weekKey(now));
  const left = now ? msUntilWeeklyReset(now) : 0;
  return (
    <Link href="/play/weekly-boss" className="tq-card tq-weekly-card group mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
      <GameArt id="weekly-boss" />
      <div className="min-w-0 flex-1">
        <p className="font-display text-xs uppercase tracking-[0.25em] text-[#ff8a3d]">Weekly Boss {now ? `· ${weekKey(now)}` : ""}</p>
        <h2 className="mt-1 font-display text-xl font-bold text-text group-hover:text-main">{info.tagline}</h2>
        {twist && (
          <p className="mt-1 text-sm text-sub">
            Twist: <span className="text-text">{twist.name}</span> — {twist.description}
          </p>
        )}
        <p className="mt-2 font-mono text-xs text-sub">
          {beaten ? <span className="text-[var(--combo-3)]">Defeated this week ✓</span> : "Not defeated yet"}
          {ready && best ? <> · your best {best.score.toLocaleString()}</> : null}
          {now ? <> · resets in {Math.floor(left / 86_400_000)}d {Math.floor((left % 86_400_000) / 3_600_000)}h</> : null}
        </p>
      </div>
      <span className="tq-btn tq-btn-primary shrink-0 self-start sm:self-center">Fight →</span>
    </Link>
  );
}

/** Tiny line drawings so each card reads at a glance. */
function GameArt({ id }: { id: GameId }) {
  const common = { width: 72, height: 72, viewBox: "0 0 72 72", "aria-hidden": true, className: "shrink-0" } as const;
  switch (id) {
    case "falling-words":
      return (
        <svg {...common}>
          <rect x="8" y="8" width="22" height="9" rx="3" fill="none" stroke="var(--text)" strokeWidth="2" />
          <rect x="38" y="22" width="26" height="9" rx="3" fill="none" stroke="var(--main)" strokeWidth="2" />
          <path d="M51 34 L51 54" stroke="var(--caret)" strokeWidth="2.5" strokeDasharray="3 3" />
          <path d="M44 62 L51 54 L58 62 Z" fill="var(--caret)" />
          <path d="M4 66 H68" stroke="var(--sub)" strokeWidth="2" />
        </svg>
      );
    case "boss-battle":
      return (
        <svg {...common}>
          <path d="M20 24 L12 6 L28 18 Z M52 24 L60 6 L44 18 Z" fill="var(--error)" />
          <ellipse cx="36" cy="34" rx="22" ry="20" fill="none" stroke="var(--error)" strokeWidth="2.5" />
          <ellipse cx="28" cy="30" rx="4" ry="3" fill="var(--combo-3)" />
          <ellipse cx="44" cy="30" rx="4" ry="3" fill="var(--combo-3)" />
          <rect x="27" y="40" width="18" height="5" rx="2" fill="var(--text)" />
          <circle cx="36" cy="66" r="3" fill="var(--caret)" />
        </svg>
      );
    case "racing":
      return (
        <svg {...common}>
          <path d="M4 22 H68 M4 46 H68" stroke="var(--border)" strokeWidth="2" strokeDasharray="8 6" />
          <rect x="16" y="26" width="30" height="12" rx="4" fill="var(--main)" />
          <circle cx="22" cy="40" r="4" fill="var(--text)" />
          <circle cx="40" cy="40" r="4" fill="var(--text)" />
          <rect x="10" y="52" width="22" height="9" rx="3" fill="var(--sub)" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={60 + (i % 2) * 5} y={6 + i * 10} width="5" height="5" fill="var(--text)" />
          ))}
        </svg>
      );
    case "weekly-boss":
      return (
        <svg {...common} width={88} height={88}>
          <path d="M18 26 L10 4 L28 18 Z M54 26 L62 4 L44 18 Z" fill="#ff5a1f" />
          <path d="M30 16 L36 2 L42 16 Z" fill="var(--combo-3)" />
          <ellipse cx="36" cy="38" rx="24" ry="22" fill="none" stroke="#ff5a1f" strokeWidth="3" />
          <ellipse cx="27" cy="36" rx="4" ry="3" fill="var(--combo-3)" />
          <ellipse cx="45" cy="36" rx="4" ry="3" fill="var(--combo-3)" />
          <ellipse cx="36" cy="27" rx="3.5" ry="2.5" fill="var(--combo-3)" />
          <rect x="26" y="45" width="20" height="6" rx="2" fill="var(--text)" />
          <path d="M8 70 q8 -10 16 0 q8 -10 16 0 q8 -10 16 0 q8 -10 16 0" fill="none" stroke="#ff8a3d" strokeWidth="2" />
        </svg>
      );
    case "stickman-duel":
      return (
        <svg {...common} fill="none" strokeWidth="3" strokeLinecap="round">
          <g stroke="var(--caret)">
            <circle cx="18" cy="16" r="6" />
            <path d="M18 22 L20 42 M20 28 L34 26 M20 30 L10 38 M20 42 L12 60 M20 42 L30 58" />
          </g>
          <g stroke="var(--error)">
            <circle cx="54" cy="18" r="6" />
            <path d="M54 24 L52 44 M52 30 L42 34 M52 30 L62 38 M52 44 L60 60 M52 44 L44 60" />
          </g>
          <path d="M36 22 L40 18 M37 28 L42 28" stroke="var(--combo-3)" />
        </svg>
      );
  }
}
