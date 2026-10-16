"use client";

import gsap from "gsap";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { SecondSample } from "@/engine";

const W = 640;
const H = 210;
const M = { top: 16, right: 12, bottom: 26, left: 36 };

interface Props {
  data: readonly SecondSample[];
  reducedMotion: boolean;
  /** Seconds before the line-draw animation starts. */
  delay?: number;
}

function niceMax(v: number): number {
  if (v <= 0) return 10;
  const step = v > 150 ? 50 : v > 60 ? 20 : 10;
  return Math.ceil((v * 1.1) / step) * step;
}

/** WPM (cumulative), raw (per second) and errors over the run. Plain SVG. */
export function ConsistencyChart({ data, reducedMotion, delay = 0.4 }: Props) {
  const wpmRef = useRef<SVGPathElement>(null);
  const rawRef = useRef<SVGPathElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const geo = useMemo(() => {
    const maxY = niceMax(Math.max(...data.map((d) => Math.max(d.wpm, d.raw)), 0));
    const n = Math.max(1, data.length);
    const iw = W - M.left - M.right;
    const ih = H - M.top - M.bottom;
    const x = (i: number) => M.left + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
    const y = (v: number) => M.top + ih - (v / maxY) * ih;
    const line = (key: "wpm" | "raw") =>
      data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join("");
    const ticks = [0, maxY / 2, maxY];
    const xTicks = data.length <= 15 ? data.map((_, i) => i) : data.map((_, i) => i).filter((i) => (i + 1) % 5 === 0 || i === 0);
    return { x, y, maxY, ticks, xTicks, wpmPath: line("wpm"), rawPath: line("raw"), iw, n };
  }, [data]);

  useLayoutEffect(() => {
    if (reducedMotion) return;
    const paths = [wpmRef.current, rawRef.current].filter((p): p is SVGPathElement => p !== null);
    const ctx = gsap.context(() => {
      for (const p of paths) {
        const len = p.getTotalLength();
        gsap.fromTo(
          p,
          { strokeDasharray: len, strokeDashoffset: len },
          { strokeDashoffset: 0, duration: 1.1, delay, ease: "power2.inOut", clearProps: "strokeDasharray,strokeDashoffset" },
        );
      }
    });
    return () => ctx.revert();
  }, [geo, reducedMotion, delay]);

  const hovered = hover !== null ? data[hover] : undefined;

  return (
    <figure className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label="Speed over time: words per minute, raw speed and errors per second"
        onPointerLeave={() => setHover(null)}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((px - M.left) / geo.iw) * (geo.n - 1));
          setHover(Math.max(0, Math.min(data.length - 1, i)));
        }}
      >
        {geo.ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={geo.y(t)} y2={geo.y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={M.left - 8} y={geo.y(t) + 4} textAnchor="end" className="fill-sub font-mono text-[11px]">
              {Math.round(t)}
            </text>
          </g>
        ))}
        {geo.xTicks.map((i) => (
          <text key={i} x={geo.x(i)} y={H - 6} textAnchor="middle" className="fill-sub font-mono text-[11px]">
            {i + 1}
          </text>
        ))}

        <path ref={rawRef} d={geo.rawPath} fill="none" stroke="var(--sub)" strokeWidth={1.5} strokeLinejoin="round" />
        <path ref={wpmRef} d={geo.wpmPath} fill="none" stroke="var(--main)" strokeWidth={2.75} strokeLinejoin="round" strokeLinecap="round" />

        {data.map((d, i) =>
          d.errors > 0 ? (
            <g key={i} transform={`translate(${geo.x(i)},${geo.y(d.raw)})`} stroke="var(--error)" strokeWidth={2} strokeLinecap="round">
              <line x1={-4} y1={-4} x2={4} y2={4} />
              <line x1={-4} y1={4} x2={4} y2={-4} />
            </g>
          ) : null,
        )}

        {hovered && hover !== null && (
          <g pointerEvents="none">
            <line x1={geo.x(hover)} x2={geo.x(hover)} y1={M.top} y2={H - M.bottom} stroke="var(--sub)" strokeDasharray="3 3" />
            <circle cx={geo.x(hover)} cy={geo.y(hovered.wpm)} r={4} fill="var(--main)" />
            <g transform={`translate(${Math.min(geo.x(hover) + 10, W - 120)},${M.top})`}>
              <rect width={110} height={56} rx={6} fill="var(--surface)" stroke="var(--border)" />
              <text x={10} y={18} className="fill-sub font-mono text-[11px]">second {hovered.t}</text>
              <text x={10} y={33} className="fill-main font-mono text-[11px]">wpm {Math.round(hovered.wpm)}</text>
              <text x={10} y={48} className="fill-sub font-mono text-[11px]">
                raw {Math.round(hovered.raw)} · err {hovered.errors}
              </text>
            </g>
          </g>
        )}
      </svg>
      <figcaption className="mt-1 flex gap-4 font-mono text-xs text-sub">
        <span className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-4 bg-main" /> wpm</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-4 bg-sub" /> raw</span>
        <span className="flex items-center gap-1.5"><i className="not-italic text-error">✕</i> errors</span>
      </figcaption>
    </figure>
  );
}
