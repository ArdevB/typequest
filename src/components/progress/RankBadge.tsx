import { RANK_NAMES, type Rank } from "@/lib/progression";

/** Small colored pill with the rank's name. */
export function RankBadge({ rank, className = "" }: { rank: Rank; className?: string }) {
  return (
    <span className={`tq-rank ${className}`} data-rank={rank}>
      <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2 21 7v10l-9 5-9-5V7z" fill="currentColor" />
      </svg>
      {RANK_NAMES[rank]}
    </span>
  );
}

/** Level number in a hexagon. */
export function LevelBadge({ level, size = 28 }: { level: number; size?: number }) {
  return (
    <span className="tq-level" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-label={`Level ${level}`}>
      {level}
    </span>
  );
}
