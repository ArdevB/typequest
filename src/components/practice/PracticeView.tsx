"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getLayout, weakKeyWeights, type PerKeyStat, type RunResult, type TestMode, type TypingEngine } from "@/engine";
import { buildDrill, type Drill } from "@/practice/drills";
import { ProgressStrip, type SaveState } from "@/components/progress/ProgressStrip";
import { beginSave, savePractice } from "@/lib/api/client";
import { KeyboardPanel } from "@/components/keyboard/KeyboardPanel";
import { FINGER_NAMES, fingerOf } from "@/components/keyboard/geometry";
import { VirtualKeyboard } from "@/components/keyboard/VirtualKeyboard";
import { Mascot } from "@/components/mascot/Mascot";
import { TypingSurface } from "@/components/typing/TypingSurface";
import { useKeyStats } from "@/hooks/useKeyStats";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useHistory } from "@/stores/historyStore";
import { useHydrated } from "@/stores/hydration";
import { useSettings } from "@/stores/settingsStore";

/** "Left index finger" for a letter key. */
function fingerName(key: string): string {
  const def = getLayout(useSettings.getState().layout).byChar.get(key);
  return def ? FINGER_NAMES[fingerOf(def)].toLowerCase() : "finger";
}

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

/** Keystrokes needed before the weak-key analysis means anything. */
const MIN_ATTEMPTS = 150;

export interface KeyRow {
  key: string;
  attempts: number;
  errors: number;
  errRate: number;
  avgMs: number;
  weight: number;
}

/** Letter keys with their stats and weakness weight, weakest first. */
export function analyseKeys(stats: Readonly<Record<string, PerKeyStat>>): KeyRow[] {
  const weights = weakKeyWeights(stats);
  const merged: Record<string, { attempts: number; errors: number; ms: number; n: number }> = {};
  for (const [raw, s] of Object.entries(stats)) {
    const k = raw.toLowerCase();
    if (!/^[a-z]$/.test(k)) continue;
    const m = (merged[k] ??= { attempts: 0, errors: 0, ms: 0, n: 0 });
    m.attempts += s.attempts;
    m.errors += s.errors;
    if (s.avgMs > 0) {
      m.ms += s.avgMs * s.attempts;
      m.n += s.attempts;
    }
  }
  return Object.entries(merged)
    .map(([key, m]) => ({
      key,
      attempts: m.attempts,
      errors: m.errors,
      errRate: m.attempts ? m.errors / m.attempts : 0,
      avgMs: m.n ? Math.round(m.ms / m.n) : 0,
      weight: weights[key] ?? 1,
    }))
    .sort((a, b) => b.weight - a.weight);
}

type View =
  | { kind: "overview" }
  | { kind: "typing"; drill: Drill }
  | { kind: "done"; drill: Drill; result: RunResult; save: SaveState };

export function PracticeView() {
  const ready = useHydrated((s) => s.ready);
  const themeId = useSettings((s) => s.themeId);
  const showLiveWpm = useSettings((s) => s.showLiveWpm);
  const layoutId = useSettings((s) => s.layout);
  const reducedMotion = useReducedMotion();
  const addPracticeStats = useHistory((s) => s.addPracticeStats);
  const { stats, source } = useKeyStats();

  const [heatBy, setHeatBy] = useState<"errors" | "speed">("errors");
  const [view, setView] = useState<View>({ kind: "overview" });
  const [seed, setSeed] = useState(newSeed);
  const [runKey, setRunKey] = useState(0);
  const [engine, setEngine] = useState<TypingEngine | null>(null);

  const rows = useMemo(() => analyseKeys(stats), [stats]);
  const totalAttempts = rows.reduce((n, r) => n + r.attempts, 0);
  const enoughData = totalAttempts >= MIN_ATTEMPTS;
  const weakest = rows.filter((r) => r.attempts >= 5).slice(0, 5);

  const heat = useMemo(() => {
    const h: Record<string, number> = {};
    const timed = rows.filter((r) => r.avgMs > 0 && r.attempts >= 5);
    const mean = timed.length ? timed.reduce((n, r) => n + r.avgMs, 0) / timed.length : 0;
    for (const r of rows) {
      if (r.attempts < 5) continue;
      h[r.key] = heatBy === "errors" ? Math.min(1, r.errRate / 0.15) : mean ? Math.max(0, Math.min(1, (r.avgMs / mean - 0.8) / 0.7)) : 0;
    }
    return h;
  }, [rows, heatBy]);

  const drillRef = useRef<Drill | null>(null);
  const start = useCallback((drill: Drill) => {
    drillRef.current = drill;
    setSeed(newSeed());
    setRunKey((k) => k + 1);
    setView({ kind: "typing", drill });
  }, []);

  const startMix = useCallback(() => {
    if (weakest.length) start({ kind: "mix", keys: weakest.map((r) => r.key) });
  }, [weakest, start]);

  const drill = view.kind === "overview" ? null : view.drill;
  const mode = useMemo<TestMode>(() => ({ kind: "text", text: drill ? buildDrill(drill, seed, layoutId) : "" }), [drill, seed, layoutId]);

  const onFinish = useCallback(
    (result: RunResult) => {
      const valid = result.flags.pasteAttempts === 0 && result.accuracy >= 50;
      if (valid) addPracticeStats(result.perKey);
      const drill = drillRef.current;
      if (!drill) return;
      const save = beginSave({
        valid,
        send: () => savePractice({ drill, seed, layout: layoutId, log: [...result.log] }),
        // Guests keep drill stats in this browser only.
        queue: () => {},
        update: (next) => setView((cur) => (cur.kind === "done" && cur.result === result ? { ...cur, save: next } : cur)),
      });
      setView({ kind: "done", drill, result, save });
    },
    [addPracticeStats, seed, layoutId],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (view.kind === "overview") return;
      if (e.key === "Escape") {
        e.preventDefault();
        setView({ kind: "overview" });
      } else if (e.key === "Tab") {
        e.preventDefault();
        start(view.drill);
      } else if (e.key === "Enter" && view.kind === "done") {
        const t = e.target as HTMLElement | null;
        if (t?.tagName === "BUTTON" || t?.tagName === "A") return;
        e.preventDefault();
        start(view.drill);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, start]);

  if (!ready) return <div className="tq-words-skeleton" aria-hidden="true" />;

  const fade = reducedMotion ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } } : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 } };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <AnimatePresence mode="wait" initial={false}>
        {view.kind === "overview" && (
          <motion.section key="overview" {...fade} transition={{ duration: 0.2 }} className="py-4">
            <h1 className="font-display text-3xl font-black text-text sm:text-4xl">Practice</h1>
            <p className="mt-2 max-w-2xl text-sub">
              Drills built from your own mistakes. The heatmap shows where they happen; the drills go straight at them.
              {source === "account" ? " Using every run saved to your account." : " Using the speed tests you've done in this browser."}
            </p>

            <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_18rem]">
              <div className="tq-card">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-sm uppercase tracking-[0.2em] text-sub">Key heatmap</h2>
                  <div className="flex gap-1 text-sm" role="group" aria-label="Color keys by">
                    {(["errors", "speed"] as const).map((h) => (
                      <button
                        key={h}
                        type="button"
                        aria-pressed={heatBy === h}
                        onClick={() => setHeatBy(h)}
                        className="rounded-full px-3 py-0.5 text-sub aria-pressed:bg-main aria-pressed:text-bg"
                      >
                        {h === "errors" ? "mistakes" : "slow keys"}
                      </button>
                    ))}
                  </div>
                </div>
                {enoughData ? (
                  <>
                    <VirtualKeyboard layout={getLayout(layoutId)} heat={heat} ariaLabel={heatBy === "errors" ? "Mistake rate per key" : "Speed per key"} />
                    <p className="mt-3 flex items-center gap-2 text-xs text-sub">
                      <span className="tq-heat-legend" aria-hidden="true" /> cool = fine, hot = needs work
                    </p>
                  </>
                ) : (
                  <div className="py-6 text-center text-sub">
                    <p>
                      Not enough typing yet to find your weak keys ({totalAttempts}/{MIN_ATTEMPTS} keystrokes).
                    </p>
                    <p className="mt-2">
                      Take a couple of{" "}
                      <Link href="/test" className="text-main underline-offset-4 hover:underline">
                        speed tests
                      </Link>{" "}
                      first, or drill any key below.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4">
                <div className="tq-card">
                  <h2 className="font-display text-sm uppercase tracking-[0.2em] text-sub">Weakest keys</h2>
                  {weakest.length ? (
                    <ul className="mt-3 space-y-2">
                      {weakest.map((r) => (
                        <li key={r.key}>
                          <button type="button" onClick={() => start({ kind: "key", key: r.key })} className="tq-weak-key group w-full">
                            <kbd className="tq-keycap">{r.key.toUpperCase()}</kbd>
                            <span className="flex-1 whitespace-nowrap text-left text-sm text-sub">
                              <span className="text-text">{Math.round(r.errRate * 100)}%</span> missed
                              {r.avgMs > 0 && <> · {r.avgMs}ms</>}
                            </span>
                            <span className="text-xs text-sub group-hover:text-main">drill →</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-sub">Nothing to show yet.</p>
                  )}
                  <button type="button" className="tq-btn tq-btn-primary mt-4 w-full" onClick={startMix} disabled={!enoughData}>
                    Weak-key drill
                  </button>
                  {!enoughData && <p className="mt-2 text-xs text-sub">Unlocks after {MIN_ATTEMPTS} keystrokes.</p>}
                </div>
                <Mascot mood="idle" engine={null} tip={tipFor(weakest)} />
              </div>
            </div>

            <div className="mt-8">
              <h2 className="mb-3 font-display text-sm uppercase tracking-[0.2em] text-sub">Drill any key</h2>
              <div className="flex flex-wrap gap-1.5">
                {"qwertyuiopasdfghjklzxcvbnm".split("").map((k) => (
                  <button key={k} type="button" className="tq-keycap tq-keycap-btn" onClick={() => start({ kind: "key", key: k })} aria-label={`Drill the ${k.toUpperCase()} key`}>
                    {k.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </motion.section>
        )}

        {view.kind === "typing" && (
          <motion.section key={`typing-${runKey}`} {...fade} transition={{ duration: 0.18 }} className="py-4">
            <DrillHeader drill={view.drill} onBack={() => setView({ kind: "overview" })} />
            <TypingSurface
              mode={mode}
              stopOnError="off"
              runKey={runKey}
              themeId={themeId}
              reducedMotion={reducedMotion}
              showLiveWpm={showLiveWpm}
              onFinish={onFinish}
              onEngine={setEngine}
            />
            <div className="mt-6">
              <KeyboardPanel engine={engine} reducedMotion={reducedMotion} showHands={false} />
            </div>
            <p className="tq-chrome mt-4 text-center text-xs text-sub">
              <kbd>Tab</kbd> — new drill · <kbd>Esc</kbd> — back
            </p>
          </motion.section>
        )}

        {view.kind === "done" && (
          <motion.section key={`done-${runKey}`} {...fade} transition={{ duration: 0.2 }} className="py-8">
            <DrillResults drill={view.drill} result={view.result} save={view.save} reducedMotion={reducedMotion} rows={rows} onAgain={() => start(view.drill)} onBack={() => setView({ kind: "overview" })} />
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

function tipFor(weakest: readonly KeyRow[]): string {
  const k = weakest[0];
  if (!k) return "Do a few speed tests and I'll find the keys that trip you up.";
  const finger = fingerName(k.key);
  return `Your trickiest key is ${k.key.toUpperCase()}. It's your ${finger} — keep it light and come back to home row.`;
}

function DrillHeader({ drill, onBack }: { drill: Drill; onBack: () => void }) {
  return (
    <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
      <button type="button" onClick={onBack} className="text-sm text-sub hover:text-main">
        ← practice
      </button>
      <p className="text-sm text-sub">
        {drill.kind === "mix" ? (
          <>
            Weak-key mix: <span className="font-mono text-text">{drill.keys.map((k) => k.toUpperCase()).join(" ")}</span>
          </>
        ) : (
          <>
            Focus: <span className="font-mono text-text">{drill.key.toUpperCase()}</span> · {fingerName(drill.key)}
          </>
        )}
      </p>
    </div>
  );
}

function DrillResults({
  drill,
  result,
  save,
  reducedMotion,
  rows,
  onAgain,
  onBack,
}: {
  drill: Drill;
  result: RunResult;
  save: SaveState;
  reducedMotion: boolean;
  rows: KeyRow[];
  onAgain: () => void;
  onBack: () => void;
}) {
  const keys = drill.kind === "mix" ? drill.keys : [drill.key];
  const thisRun = analyseKeys(result.perKey);
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="font-display text-sm uppercase tracking-[0.3em] text-main">Drill done</p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="tq-card">
          <div className="text-xs uppercase tracking-widest text-sub">wpm</div>
          <div className="mt-1 font-mono text-3xl tabular-nums text-text">{Math.round(result.wpm)}</div>
        </div>
        <div className="tq-card">
          <div className="text-xs uppercase tracking-widest text-sub">accuracy</div>
          <div className="mt-1 font-mono text-3xl tabular-nums text-text">{Math.round(result.accuracy)}%</div>
        </div>
      </div>

      <h2 className="mt-8 font-display text-sm uppercase tracking-[0.2em] text-sub">Your focus keys</h2>
      <table className="mx-auto mt-3 w-full max-w-md text-sm">
        <thead className="text-xs uppercase tracking-wider text-sub">
          <tr>
            <th className="py-1 text-left font-normal">key</th>
            <th className="py-1 text-right font-normal">this drill</th>
            <th className="py-1 text-right font-normal">overall</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => {
            const now = thisRun.find((r) => r.key === k);
            const before = rows.find((r) => r.key === k);
            const nowAcc = now && now.attempts ? 100 - Math.round(now.errRate * 100) : null;
            const beforeAcc = before && before.attempts ? 100 - Math.round(before.errRate * 100) : null;
            const better = nowAcc !== null && beforeAcc !== null && nowAcc > beforeAcc;
            return (
              <tr key={k} className="border-t border-border">
                <td className="py-2 text-left">
                  <kbd className="tq-keycap">{k.toUpperCase()}</kbd>
                </td>
                <td className={`py-2 text-right font-mono tabular-nums ${better ? "text-main" : "text-text"}`}>
                  {nowAcc === null ? "—" : `${nowAcc}%`} {better && <span aria-label="improved">↑</span>}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-sub">{beforeAcc === null ? "—" : `${beforeAcc}%`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-sub">Drills update your key stats (and your account&apos;s, when signed in). They don&apos;t count as speed tests.</p>
      <div className="mt-5">
        <ProgressStrip save={save} reducedMotion={reducedMotion} />
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" className="tq-btn tq-btn-primary" onClick={onAgain} autoFocus>
          Again
        </button>
        <button type="button" className="tq-btn" onClick={onBack}>
          Back to practice
        </button>
      </div>
      <p className="tq-chrome mt-4 text-xs text-sub">
        <kbd>Enter</kbd> — again
      </p>
    </div>
  );
}
