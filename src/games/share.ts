import type { GhostTrack } from "./racing";

/** A race someone else ran, carried in a link: same seed (so the same words) plus their progress over time. */
export interface SharedRace {
  seed: number;
  name: string;
  /** Their finishing time (ms). */
  finishMs: number;
  track: GhostTrack;
}

const MAX_POINTS = 400;

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/**
 * Packs a race into a short URL-safe code. Times are stored in 100 ms steps
 * and progress in thousandths, as deltas, so a 30-word race is a few hundred characters.
 */
export function encodeRace(r: { seed: number; name: string; points: readonly (readonly [number, number])[] }): string {
  const pts = r.points.slice(0, MAX_POINTS);
  const flat: number[] = [];
  let lt = 0;
  let lp = 0;
  for (const [t, p] of pts) {
    const ti = Math.round(t / 100);
    const pi = Math.round(p * 1000);
    flat.push(ti - lt, pi - lp);
    lt = ti;
    lp = pi;
  }
  return toBase64Url(JSON.stringify({ v: 1, s: r.seed, n: r.name.slice(0, 24), d: flat }));
}

export function decodeRace(code: string): SharedRace | null {
  try {
    const o = JSON.parse(fromBase64Url(code)) as { v?: unknown; s?: unknown; n?: unknown; d?: unknown };
    if (o.v !== 1 || typeof o.s !== "number" || !Number.isInteger(o.s) || o.s < 0 || o.s > 2 ** 32) return null;
    if (!Array.isArray(o.d) || o.d.length % 2 !== 0 || o.d.length > MAX_POINTS * 2) return null;
    const name = typeof o.n === "string" && o.n.trim() ? o.n.trim().slice(0, 24) : "Friend";
    const points: [number, number][] = [];
    let t = 0;
    let p = 0;
    for (let i = 0; i < o.d.length; i += 2) {
      const dt = o.d[i];
      const dp = o.d[i + 1];
      if (typeof dt !== "number" || typeof dp !== "number" || dt < 0) return null;
      t += dt;
      p += dp;
      points.push([t * 100, Math.max(0, Math.min(1, p / 1000))]);
    }
    if (points.length < 2) return null;
    const done = points.find(([, prog]) => prog >= 1);
    const finishMs = done ? done[0] : (points[points.length - 1]?.[0] ?? 0);
    return { seed: o.s, name, finishMs, track: { name, points } };
  } catch {
    return null;
  }
}
