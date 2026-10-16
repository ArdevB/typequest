"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LevelBadge } from "@/components/progress/RankBadge";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { getModifier } from "@/modifiers/catalog";
import { useAuth } from "@/stores/authStore";

interface Row {
  position: number;
  user_id: string;
  username: string;
  level: number;
  score: number;
  combo: string;
  multiplier: number;
}

const comboLabel = (combo: string) =>
  combo
    ? combo
        .split("+")
        .map((id) => getModifier(id)?.name ?? id)
        .join(" · ")
    : "no modifiers";

/** Top chaos scores (each player's best mix). Hidden when accounts aren't set up. */
export function ChaosBoard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const viewer = useAuth((s) => s.userId);

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    let live = true;
    void sb.rpc("chaos_leaderboard", { p_limit: 10 }).then(({ data, error }) => {
      if (!live) return;
      if (error) console.warn("[chaos] leaderboard", error.message);
      setRows((data ?? []) as Row[]);
    });
    return () => {
      live = false;
    };
  }, []);

  if (rows === null) return null;
  return (
    <section aria-labelledby="chaos-board" className="mt-10">
      <h2 id="chaos-board" className="mb-3 font-display text-sm uppercase tracking-[0.25em] text-sub">
        Chaos masters
      </h2>
      {rows.length === 0 ? (
        <p className="tq-card text-sm text-sub">No chaos scores yet. Sign in and set the bar.</p>
      ) : (
        <div className="tq-card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-sub">
              <tr>
                <th className="px-4 py-3 font-normal">#</th>
                <th className="px-4 py-3 font-normal">player</th>
                <th className="hidden px-4 py-3 font-normal sm:table-cell">mix</th>
                <th className="px-4 py-3 text-right font-normal">score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} className={`border-t border-border ${r.user_id === viewer ? "bg-main/10" : ""}`}>
                  <td className="px-4 py-2.5 font-mono tabular-nums text-sub">{r.position}</td>
                  <td className="px-4 py-2.5">
                    <Link href={`/profile/${r.username}`} className="inline-flex items-center gap-2 text-text hover:text-main">
                      <LevelBadge level={r.level} />
                      {r.username}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-2.5 text-sub sm:table-cell">
                    {comboLabel(r.combo)} <span className="font-mono text-main">×{Number(r.multiplier).toFixed(2)}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-text">{r.score.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
