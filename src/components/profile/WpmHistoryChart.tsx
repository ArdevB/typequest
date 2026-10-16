/** WPM of recent runs, oldest → newest. Static SVG (server-renderable). */
export function WpmHistoryChart({ points }: { points: readonly { wpm: number; accuracy: number; at: string }[] }) {
  if (points.length < 2) {
    return <p className="py-10 text-center text-sm text-sub">A chart appears here after a few more tests.</p>;
  }
  const W = 640;
  const H = 180;
  const M = { l: 34, r: 10, t: 12, b: 20 };
  const max = Math.max(...points.map((p) => p.wpm));
  const top = Math.ceil((max * 1.15) / 10) * 10 || 10;
  const x = (i: number) => M.l + (i / (points.length - 1)) * (W - M.l - M.r);
  const y = (v: number) => M.t + (1 - v / top) * (H - M.t - M.b);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.wpm).toFixed(1)}`).join("");
  const area = `${line}L${x(points.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;
  const avg = points.reduce((a, p) => a + p.wpm, 0) / points.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`WPM over the last ${points.length} tests, averaging ${Math.round(avg)}`}>
      <defs>
        <linearGradient id="wpm-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--main)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--main)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, top / 2, top].map((t) => (
        <g key={t}>
          <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="var(--border)" />
          <text x={M.l - 6} y={y(t) + 4} textAnchor="end" className="fill-sub font-mono text-[11px]">
            {Math.round(t)}
          </text>
        </g>
      ))}
      <line x1={M.l} x2={W - M.r} y1={y(avg)} y2={y(avg)} stroke="var(--sub)" strokeDasharray="4 4" />
      <path d={area} fill="url(#wpm-area)" />
      <path d={line} fill="none" stroke="var(--main)" strokeWidth={2.5} strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.wpm)} r={3} fill="var(--main)">
          <title>{`${Math.round(p.wpm)} wpm · ${Math.round(p.accuracy)}% · ${new Date(p.at).toLocaleDateString()}`}</title>
        </circle>
      ))}
    </svg>
  );
}
