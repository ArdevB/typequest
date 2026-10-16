import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VirtualKeyboard } from "@/components/keyboard/VirtualKeyboard";
import { WpmHistoryChart } from "@/components/profile/WpmHistoryChart";
import { LevelBar } from "@/components/progress/LevelBar";
import { LevelBadge, RankBadge } from "@/components/progress/RankBadge";
import { NotConfigured } from "@/components/app/NotConfigured";
import { nextRank, rankFor } from "@/lib/progression";
import { getServerSupabase, getUserId } from "@/lib/supabase/server";
import { PROFILE_COLUMNS, RUN_COLUMNS, type KeyStatRow, type ProfileRow, type RunRow } from "@/lib/supabase/types";

interface Params {
  params: Promise<{ username: string }>;
}

const MODE_LABEL: Record<string, string> = {
  "time-15": "15 seconds",
  "time-30": "30 seconds",
  "time-60": "60 seconds",
  "time-120": "120 seconds",
  "words-10": "10 words",
  "words-25": "25 words",
  "words-50": "50 words",
  "words-100": "100 words",
};

/** Usernames only contain letters, digits and _, but _ is a LIKE wildcard. */
const likeExact = (name: string) => name.replace(/[\\%_]/g, (c) => `\\${c}`);

async function loadProfile(username: string) {
  const supabase = await getServerSupabase();
  if (!supabase || !/^[A-Za-z0-9_]{3,20}$/.test(username)) return { supabase, profile: null };
  const { data } = await supabase.from("profiles").select(PROFILE_COLUMNS).ilike("username", likeExact(username)).maybeSingle<ProfileRow>();
  return { supabase, profile: data };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params;
  return { title: `${username}'s profile`, description: `Typing stats, personal bests and progress for ${username} on TypeQuest.` };
}

export default async function ProfilePage({ params }: Params) {
  const { username } = await params;
  const { supabase, profile } = await loadProfile(username);
  if (!supabase) return <NotConfigured what="Profiles" />;
  if (!profile) notFound();

  const viewerId = await getUserId(supabase);
  const isOwner = viewerId === profile.id;

  const [recentQ, topQ, countQ, keysQ] = await Promise.all([
    supabase.from("runs").select(RUN_COLUMNS).eq("user_id", profile.id).order("created_at", { ascending: false }).limit(30).returns<RunRow[]>(),
    supabase.from("runs").select(RUN_COLUMNS).eq("user_id", profile.id).eq("punctuation", false).eq("numbers", false).order("wpm", { ascending: false }).limit(200).returns<RunRow[]>(),
    supabase.from("runs").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
    isOwner ? supabase.from("key_stats").select("key, attempts, errors, avg_ms").returns<KeyStatRow[]>() : Promise.resolve({ data: null }),
  ]);

  const recent = recentQ.data ?? [];
  const bests = new Map<string, RunRow>();
  for (const r of topQ.data ?? []) if (!bests.has(r.mode_key)) bests.set(r.mode_key, r);
  const totalRuns = countQ.count ?? 0;
  const avg10 = recent.slice(0, 10);
  const avgWpm = avg10.length ? avg10.reduce((a, r) => a + Number(r.wpm), 0) / avg10.length : 0;
  const avgAcc = avg10.length ? avg10.reduce((a, r) => a + Number(r.accuracy), 0) / avg10.length : 0;
  const best = Math.max(0, ...[...bests.values()].map((r) => Number(r.wpm)));
  const rating = Number(profile.rating_wpm);
  const upcoming = nextRank(rating);

  const heat: Record<string, number> = {};
  for (const k of keysQ.data ?? []) {
    if (k.attempts >= 5 && k.key !== " ") heat[k.key] = Math.min(1, k.errors / k.attempts / 0.15);
  }
  const worst = (keysQ.data ?? [])
    .filter((k) => k.attempts >= 10 && k.key !== " ")
    .sort((a, b) => b.errors / b.attempts - a.errors / a.attempts)
    .slice(0, 5);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 py-4">
      <header className="tq-card flex flex-wrap items-center gap-5">
        <LevelBadge level={profile.level} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-3xl font-bold text-text">{profile.username}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-sub">
            <RankBadge rank={rankFor(rating)} />
            {rating > 0 && <span>rating {rating.toFixed(1)} wpm</span>}
            {upcoming && rating > 0 && (
              <span>
                · {Math.ceil(upcoming.minWpm - rating)} wpm to {upcoming.id}
              </span>
            )}
            <span>· joined {new Date(profile.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span>
          </div>
          <LevelBar xp={profile.xp} className="mt-3 max-w-md" />
        </div>
        {isOwner && (
          <Link href="/settings" className="tq-btn py-1.5 text-sm">
            Edit profile
          </Link>
        )}
      </header>

      <section aria-label="Stats" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Tile label="tests" value={totalRuns.toLocaleString()} />
        <Tile label="best wpm" value={best ? Math.round(best).toString() : "–"} />
        <Tile label="avg wpm (last 10)" value={avgWpm ? Math.round(avgWpm).toString() : "–"} />
        <Tile label="avg accuracy" value={avgAcc ? `${Math.round(avgAcc)}%` : "–"} />
      </section>

      <section aria-labelledby="bests-title">
        <h2 id="bests-title" className="mb-3 font-display text-lg font-bold text-text">Personal bests</h2>
        {bests.size === 0 ? (
          <p className="text-sm text-sub">No tests yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.keys(MODE_LABEL)
              .filter((k) => bests.has(k))
              .map((k) => {
                const r = bests.get(k)!;
                return (
                  <div key={k} className="tq-card py-3">
                    <p className="text-xs uppercase tracking-wider text-sub">{MODE_LABEL[k]}</p>
                    <p className="font-mono text-2xl text-main">{Math.round(Number(r.wpm))}</p>
                    <p className="text-xs text-sub">{Math.round(Number(r.accuracy))}% acc</p>
                  </div>
                );
              })}
          </div>
        )}
      </section>

      <section aria-labelledby="history-title" className="tq-card">
        <h2 id="history-title" className="mb-2 font-display text-lg font-bold text-text">Recent tests</h2>
        <WpmHistoryChart
          points={[...recent].reverse().map((r) => ({ wpm: Number(r.wpm), accuracy: Number(r.accuracy), at: r.created_at }))}
        />
      </section>

      {isOwner && (
        <section aria-labelledby="keys-title" className="tq-card">
          <h2 id="keys-title" className="font-display text-lg font-bold text-text">Your keys</h2>
          <p className="mb-4 text-sm text-sub">
            Error rate per key across all your tests (only you can see this).
            {worst.length > 0 && <> Trickiest: {worst.map((k) => k.key.toUpperCase()).join(", ")}.</>}
          </p>
          {Object.keys(heat).length === 0 ? (
            <p className="text-sm text-sub">Type a few tests to build your key map.</p>
          ) : (
            <div className="mx-auto max-w-3xl">
              <VirtualKeyboard heat={heat} ariaLabel="Error rate per key" />
            </div>
          )}
        </section>
      )}

      {recent.length > 0 && (
        <section aria-labelledby="runs-title">
          <h2 id="runs-title" className="mb-3 font-display text-lg font-bold text-text">History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-sub">
                <tr>
                  <th className="py-2 pr-4 font-normal">wpm</th>
                  <th className="py-2 pr-4 font-normal">accuracy</th>
                  <th className="py-2 pr-4 font-normal">raw</th>
                  <th className="py-2 pr-4 font-normal">test</th>
                  <th className="py-2 pr-4 font-normal">xp</th>
                  <th className="py-2 font-normal">when</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {recent.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-2 pr-4 text-main">{Math.round(Number(r.wpm))}</td>
                    <td className="py-2 pr-4 text-text">{Math.round(Number(r.accuracy))}%</td>
                    <td className="py-2 pr-4 text-sub">{Math.round(Number(r.raw))}</td>
                    <td className="py-2 pr-4 text-sub">
                      {MODE_LABEL[r.mode_key] ?? r.mode_key}
                      {r.punctuation ? " @" : ""}
                      {r.numbers ? " #" : ""}
                    </td>
                    <td className="py-2 pr-4 text-sub">+{r.xp_awarded}</td>
                    <td className="py-2 text-sub">{new Date(r.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="tq-card py-3">
      <p className="text-xs uppercase tracking-wider text-sub">{label}</p>
      <p className="font-mono text-3xl text-text">{value}</p>
    </div>
  );
}
