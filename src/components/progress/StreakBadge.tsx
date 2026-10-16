import { nepalDay } from "@/lib/nepalTime";

export interface StreakFields {
  streak: number;
  streak_freezes?: number;
  last_active_on?: string | null;
}

/**
 * The streak that's still alive today: kept if you played today or yesterday
 * (Nepal time), or if your streak freezes cover the missed days.
 */
export function liveStreak(p: StreakFields, now: number = Date.now()): { days: number; playedToday: boolean } {
  if (!p.last_active_on || p.streak <= 0) return { days: 0, playedToday: false };
  const today = Date.parse(nepalDay(now));
  const last = Date.parse(p.last_active_on);
  const gap = Math.round((today - last) / 86_400_000);
  if (gap <= 0) return { days: p.streak, playedToday: true };
  if (gap === 1 || gap - 1 <= (p.streak_freezes ?? 0)) return { days: p.streak, playedToday: false };
  return { days: 0, playedToday: false };
}

export function Flame({ size = 16 }: { size?: number }) {
  return (
    <svg className="tq-flame" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2c1 4-3 5.5-3 9.5A3 3 0 0 0 12 15a3 3 0 0 0 3-3.5c2 1.5 3 3.6 3 5.5a6 6 0 0 1-12 0c0-5 6-7 6-15z" />
    </svg>
  );
}

/** 🔥 n — dimmed when today's activity is still missing. */
export function StreakBadge({ profile, className = "" }: { profile: StreakFields; className?: string }) {
  const { days, playedToday } = liveStreak(profile);
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-sm ${playedToday ? "text-text" : "text-sub"} ${className}`}
      title={
        days === 0
          ? "No streak yet — finish a test, lesson or challenge today"
          : playedToday
            ? `${days}-day streak · done for today`
            : `${days}-day streak · play today to keep it`
      }
    >
      <Flame />
      {days}
    </span>
  );
}
