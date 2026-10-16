"use client";

import gsap from "gsap";
import { useLayoutEffect, useRef } from "react";
import { levelProgress } from "@/lib/progression";

interface Props {
  xp: number;
  /** XP before the latest gain, to animate from. */
  fromXp?: number;
  reducedMotion?: boolean;
  showNumbers?: boolean;
  className?: string;
}

/** XP progress bar for the current level. Animates from `fromXp` to `xp`, rolling over on level-ups. */
export function LevelBar({ xp, fromXp, reducedMotion = false, showNumbers = true, className = "" }: Props) {
  const fillRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const end = levelProgress(xp);

  useLayoutEffect(() => {
    const fill = fillRef.current;
    if (!fill) return;
    const finalWidth = `${end.fraction * 100}%`;
    if (reducedMotion || fromXp === undefined || fromXp >= xp) {
      gsap.set(fill, { width: finalWidth });
      return;
    }
    const start = levelProgress(fromXp);
    const tl = gsap.timeline({ delay: 0.3 });
    gsap.set(fill, { width: `${start.fraction * 100}%` });
    // Fill to the end of each level crossed, then wrap around.
    for (let l = start.level; l < end.level; l++) {
      tl.to(fill, { width: "100%", duration: 0.45, ease: "power2.in" }).set(fill, { width: "0%" });
    }
    tl.to(fill, { width: finalWidth, duration: 0.7, ease: "power2.out" });
    return () => {
      tl.kill();
    };
  }, [xp, fromXp, reducedMotion, end.fraction, end.level]);

  return (
    <div className={className}>
      <div
        className="tq-levelbar"
        role="progressbar"
        aria-label={`Level ${end.level} progress`}
        aria-valuemin={0}
        aria-valuemax={end.needed}
        aria-valuenow={end.current}
      >
        <div ref={fillRef} className="tq-levelbar-fill" />
      </div>
      {showNumbers && (
        <span ref={textRef} className="mt-1 block font-mono text-xs text-sub">
          {end.current} / {end.needed} XP to level {end.level + 1}
        </span>
      )}
    </div>
  );
}
