"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { attachInput, type Keystroke } from "@/engine";
import type { BossState } from "@/games/bossBattle";
import type { DuelState } from "@/games/duel";
import type { FallingState } from "@/games/fallingWords";
import { startLiveGame, type LiveGame } from "@/games/live";
import type { GhostTrack, RaceState, RacingSim } from "@/games/racing";
import type { GameInfo } from "@/games/registry";
import { decodeRace, encodeRace, type SharedRace } from "@/games/share";
import type { GameOutcome } from "@/games/types";
import { TWIST_INFO, msUntilWeeklyReset, twistFor, weekKey, weeklySeed } from "@/games/weekly";
import { Mascot } from "@/components/mascot/Mascot";
import { useAuth } from "@/stores/authStore";
import { toast } from "@/stores/toastStore";
import { ProgressStrip, type SaveState } from "@/components/progress/ProgressStrip";
import { createWordsRenderer } from "@/components/typing/wordsRenderer";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { beginSave, saveGame } from "@/lib/api/client";
import { celebrate } from "@/lib/confetti";
import { sound } from "@/lib/sound";
import { useGames } from "@/stores/gamesStore";
import { useHydrated } from "@/stores/hydration";
import { useSettings } from "@/stores/settingsStore";

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

/** How long the last moment plays before the results appear (KO slow-mo, explosions). */
const END_DELAY: Record<string, number> = { "stickman-duel": 3800, "boss-battle": 1800, "weekly-boss": 2200, racing: 1400, "falling-words": 1400 };

interface Result {
  outcome: GameOutcome;
  isBest: boolean;
  previous: number | null;
  ghostSaved: boolean;
  save: SaveState;
  /** Racing: a link that lets a friend race this exact run. */
  shareCode?: string;
  /** Racing against a shared ghost: how it went. */
  versus?: { name: string; margin: number };
}

type Hud =
  | { kind: "falling"; s: Pick<FallingState, "lives" | "score" | "level" | "multiplier"> }
  | { kind: "boss"; s: Pick<BossState, "bossHp" | "bossMaxHp" | "playerHp" | "playerMaxHp" | "phase" | "charge"> }
  | { kind: "race"; s: { place: number | null; pos: number; total: number; done: number; words: number } }
  | { kind: "duel"; s: Pick<DuelState, "playerHp" | "rivalHp" | "maxHp" | "rivalMaxHp" | "chain" | "rivalCharge"> };

function readHud(live: LiveGame): Hud {
  const st = live.sim.state;
  switch (live.sim.id) {
    case "falling-words": {
      const s = st as FallingState;
      return { kind: "falling", s: { lives: s.lives, score: s.score, level: s.level, multiplier: s.multiplier } };
    }
    case "boss-battle":
    case "weekly-boss": {
      const s = st as BossState;
      return {
        kind: "boss",
        s: { bossHp: s.bossHp, bossMaxHp: s.bossMaxHp, playerHp: s.playerHp, playerMaxHp: s.playerMaxHp, phase: s.phase, charge: Math.round(s.charge * 20) / 20 },
      };
    }
    case "racing": {
      const s = st as RaceState;
      const me = s.racers.find((r) => r.kind === "player");
      const scoring = s.racers.filter((r) => r.kind !== "ghost");
      const ahead = scoring.filter((r) => r.kind === "bot" && me && r.progress > me.progress).length;
      const snap = live.sim.engine.getSnapshot();
      return { kind: "race", s: { place: s.place, pos: ahead + 1, total: scoring.length, done: Math.min(snap.wordIndex, snap.words.length), words: snap.words.length } };
    }
    case "stickman-duel": {
      const s = st as DuelState;
      return { kind: "duel", s: { playerHp: s.playerHp, rivalHp: s.rivalHp, maxHp: s.maxHp, rivalMaxHp: s.rivalMaxHp, chain: s.chain, rivalCharge: Math.round(s.rivalCharge * 20) / 20 } };
    }
  }
}

export function GamePlayer({ game }: { game: GameInfo }) {
  const ready = useHydrated((s) => s.ready);
  const themeId = useSettings((s) => s.themeId);
  const colorblind = useSettings((s) => s.colorblind);
  const reducedMotion = useReducedMotion();

  const weekly = game.id === "weekly-boss";
  const [runKey, setRunKey] = useState(0);
  const [seed, setSeed] = useState(() => (weekly ? weeklySeed() : newSeed()));
  const [result, setResult] = useState<Result | null>(null);
  // A race shared by a friend (?race=…): same words, their run as the ghost.
  const [versus, setVersus] = useState<SharedRace | null>(null);

  useEffect(() => {
    if (game.id !== "racing") return;
    const code = new URLSearchParams(window.location.search).get("race");
    const race = code ? decodeRace(code) : null;
    if (code && !race) toast({ title: "That race link is broken", body: "Starting a normal race instead.", tone: "error" });
    if (race) {
      setVersus(race);
      setSeed(race.seed);
      setRunKey((k) => k + 1);
    }
  }, [game.id]);

  const restart = useCallback(() => {
    // The Weekly Boss and a friend's race always use the same words.
    setSeed(weekly ? weeklySeed() : versus ? versus.seed : newSeed());
    setResult(null);
    setRunKey((k) => k + 1);
  }, [weekly, versus]);

  const leaveVersus = useCallback(() => {
    setVersus(null);
    window.history.replaceState(null, "", window.location.pathname);
    setSeed(newSeed());
    setResult(null);
    setRunKey((k) => k + 1);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab" || e.key === "Escape") {
        if ((e.target as HTMLElement | null)?.closest?.("[role=dialog]")) return;
        e.preventDefault();
        restart();
      } else if (e.key === "Enter" && result) {
        const t = e.target as HTMLElement | null;
        if (t?.tagName === "BUTTON" || t?.tagName === "A") return;
        e.preventDefault();
        restart();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [restart, result]);

  const onDone = useCallback(
    (outcome: GameOutcome, log: readonly Keystroke[], sim: LiveGame["sim"]) => {
      const games = useGames.getState();
      const { isBest, previous } = games.record(game.id, { score: outcome.score, wpm: outcome.wpm, won: outcome.won });
      let ghostSaved = false;
      let shareCode: string | undefined;
      let vs: Result["versus"];
      if (game.id === "racing") {
        const race = sim as unknown as RacingSim;
        if (race.state.place !== null) {
          const points = race.trace.map(([t, p]) => [t, p] as const);
          // A friend's ghost isn't your own best: don't overwrite it with a run on their words.
          if (!versus) ghostSaved = games.saveGhost({ name: "Your best", points, finishMs: outcome.durationMs });
          const name = useAuth.getState().profile?.username ?? "A friend";
          shareCode = encodeRace({ seed, name, points: [...points, [outcome.durationMs, 1]] });
          if (versus) vs = { name: versus.name, margin: versus.finishMs - outcome.durationMs };
        }
      }
      if (weekly && outcome.won && games.beatWeekly(weekKey())) {
        toast({ title: "Weekly Boss defeated!", body: "The Inferno theme and Keeby's crown are yours.", tone: "level" }, 7000);
      }
      if (outcome.won && !reducedMotion) {
        const css = getComputedStyle(document.documentElement);
        void celebrate(["--main", "--caret", "--combo-3"].map((v) => css.getPropertyValue(v).trim()).filter(Boolean));
      }
      const save = beginSave({
        valid: outcome.wordsDone >= 3 && outcome.durationMs >= 1000,
        send: () => saveGame({ game: game.id, seed, log: [...log] }),
        // Games aren't queued for guests: the local best is kept instead.
        queue: () => {},
        update: (next) => setResult((r) => (r && r.outcome === outcome ? { ...r, save: next } : r)),
      });
      setResult({ outcome, isBest, previous, ghostSaved, save, shareCode, versus: vs });
    },
    [game.id, seed, reducedMotion, versus, weekly],
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Link href="/play" className="text-sm text-sub hover:text-main">
            ← all games
          </Link>
          <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">{game.name}</h1>
        </div>
        <p className="max-w-md text-sm text-sub">{game.howTo}</p>
      </div>
      {weekly && <WeeklyBanner seed={seed} />}
      {versus && (
        <div className="tq-banner mb-4">
          <span>
            Racing <strong className="text-text">{versus.name}</strong>&apos;s ghost — their time: <span className="font-mono text-text">{(versus.finishMs / 1000).toFixed(1)}s</span>
          </span>
          <button type="button" className="text-sm text-sub underline-offset-4 hover:text-main hover:underline" onClick={leaveVersus}>
            race normally
          </button>
        </div>
      )}

      {!ready ? (
        <div className="tq-game-stage" aria-hidden="true" />
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          {result ? (
            <motion.div
              key={`results-${runKey}`}
              initial={{ opacity: 0, y: reducedMotion ? 0 : 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reducedMotion ? 0.12 : 0.25 }}
            >
              <GameResults game={game} result={result} reducedMotion={reducedMotion} onRetry={restart} />
            </motion.div>
          ) : (
            <motion.div key={`play-${runKey}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <GameStage
                key={`${runKey}-${themeId}-${colorblind}-${reducedMotion}`}
                game={game}
                seed={seed}
                ghost={versus?.track}
                reducedMotion={reducedMotion}
                onDone={onDone}
              />
              <p className="tq-chrome mt-4 text-center text-xs text-sub">
                <kbd>Tab</kbd> or <kbd>Esc</kbd> — restart
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

function WeeklyBanner({ seed }: { seed: number }) {
  const twist = TWIST_INFO[twistFor(seed)];
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(msUntilWeeklyReset());
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);
  const d = left === null ? null : { days: Math.floor(left / 86_400_000), hours: Math.floor((left % 86_400_000) / 3_600_000) };
  return (
    <div className="tq-banner tq-banner-weekly mb-4">
      <span>
        <span className="font-display text-xs uppercase tracking-widest text-main">This week&apos;s twist</span>{" "}
        <strong className="text-text">{twist.name}</strong> — {twist.description}
      </span>
      <span className="font-mono text-xs text-sub">{d ? `new boss in ${d.days}d ${d.hours}h` : ""}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The live game: Pixi canvas + HUD + (for most games) the word strip.
// ---------------------------------------------------------------------------

function GameStage({
  game,
  seed,
  ghost: sharedGhost,
  reducedMotion,
  onDone,
}: {
  game: GameInfo;
  seed: number;
  ghost?: GhostTrack;
  reducedMotion: boolean;
  onDone: (o: GameOutcome, log: readonly Keystroke[], sim: LiveGame["sim"]) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const [hud, setHud] = useState<Hud | null>(null);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [focused, setFocused] = useState(true);
  const showStrip = game.id !== "falling-words";

  useEffect(() => {
    const host = hostRef.current;
    const input = inputRef.current;
    if (!host || !input) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;
    const ghost = game.id === "racing" ? (sharedGhost ?? useGames.getState().ghost ?? undefined) : undefined;
    const live = startLiveGame(game.id, seed, { ghost });
    const engine = live.sim.engine;

    let log: readonly Keystroke[] = [];
    const offs = [
      engine.on("start", () => setStarted(true)),
      engine.on("correct", () => sound.play("key")),
      engine.on("error", () => sound.play("error", false)),
      engine.on("wordComplete", (e) => e.correct && sound.play("space")),
      engine.on("combo", () => sound.play("combo", false)),
      engine.on("finish", (r) => {
        log = r.log;
      }),
    ];
    const detachInput = attachInput(input, live.input);
    const strip = showStrip && stripRef.current ? createWordsRenderer(stripRef.current, engine, "line") : null;

    let lastHud = "";
    const hudTimer = setInterval(() => {
      const h = readHud(live);
      const key = JSON.stringify(h);
      if (key !== lastHud) {
        lastHud = key;
        setHud(h);
      }
    }, 100);

    let endTimer: ReturnType<typeof setTimeout> | undefined;
    let ended = false;
    const checkEnd = () => {
      if (ended || !live.sim.over) return;
      ended = true;
      const outcome = live.sim.outcome();
      endTimer = setTimeout(() => onDoneRef.current(outcome, log, live.sim), reducedMotion ? 600 : (END_DELAY[game.id] ?? 1400));
    };

    void (async () => {
      try {
        const [PIXI, render] = await Promise.all([import("pixi.js"), import("@/games/render")]);
        if (cancelled) return;
        const app = new PIXI.Application();
        await app.init({
          resizeTo: host,
          backgroundAlpha: 0,
          antialias: true,
          autoDensity: true,
          resolution: Math.min(2, window.devicePixelRatio || 1),
          preference: "webgl",
        });
        if (cancelled) {
          app.destroy({ removeView: true }, { children: true });
          return;
        }
        app.canvas.setAttribute("aria-hidden", "true");
        host.appendChild(app.canvas);
        const renderer = render.createRenderer(game.id, { PIXI, app, colors: render.readColors(), reducedMotion }, live.sim);
        const frame = () => {
          live.tick();
          renderer.update(app.ticker.deltaMS);
          checkEnd();
        };
        app.ticker.add(frame);
        setLoading(false);
        cleanup = () => {
          app.ticker.remove(frame);
          renderer.destroy();
          app.destroy({ removeView: true }, { children: true });
        };
      } catch (err) {
        console.warn("[games] couldn't start the renderer", err);
        if (!cancelled) setFailed(true);
      }
    })();

    // Without a canvas (or while it loads) the sim still has to run.
    const fallback = setInterval(() => {
      if (cleanup) return;
      live.tick();
      checkEnd();
    }, 50);

    input.focus({ preventScroll: true });

    return () => {
      cancelled = true;
      clearInterval(hudTimer);
      clearInterval(fallback);
      clearTimeout(endTimer);
      offs.forEach((off) => off());
      detachInput();
      strip?.destroy();
      cleanup?.();
      live.sim.dispose();
      engine.destroy();
    };
  }, [game.id, seed, sharedGhost, reducedMotion, showStrip]);

  // Typing anywhere refocuses the hidden input.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const input = inputRef.current;
      if (!input || document.activeElement === input) return;
      if (ev.metaKey || ev.ctrlKey || ev.altKey || ev.key.length !== 1) return;
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      input.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const focus = () => inputRef.current?.focus({ preventScroll: true });

  return (
    <div className="tq-surface" data-focused={focused ? "true" : "false"}>
      <div className="relative">
        <div ref={hostRef} className="tq-game-stage" data-game={game.id} onClick={focus} />
        {hud && <HudOverlay hud={hud} />}
        {loading && !failed && <div className="tq-game-msg">Loading…</div>}
        {failed && <div className="tq-game-msg">This game needs WebGL, which isn&apos;t available in this browser.</div>}
        {!loading && !started && focused && game.id !== "stickman-duel" && (
          <div className="tq-game-msg tq-game-msg-soft">Start typing to begin</div>
        )}
        {!focused && (
          <button type="button" className="tq-focus-overlay" onClick={focus}>
            Click here or press any key to focus
          </button>
        )}
      </div>

      {showStrip && (
        <div className="tq-chaos" data-chaos={game.id === "weekly-boss" ? twistFor(seed) : undefined}>
          <div ref={stripRef} className="tq-words tq-game-strip mt-5" onClick={focus} />
        </div>
      )}

      <input
        ref={inputRef}
        className="tq-input"
        aria-label={`Type the words to play ${game.name}`}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </div>
  );
}

const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

function Bar({ value, max, label, tone, align = "left" }: { value: number; max: number; label: string; tone: "main" | "error" | "caret"; align?: "left" | "right" }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`w-full max-w-64 ${align === "right" ? "text-right" : ""}`}>
      <div className="mb-1 flex justify-between font-mono text-xs text-sub">
        <span>{label}</span>
        <span className="tabular-nums text-text">{Math.ceil(value)}</span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-bg-alt ring-1 ring-border"
        role="meter"
        aria-label={label}
        aria-valuenow={Math.ceil(value)}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className="tq-hp h-full rounded-full"
          data-tone={tone}
          style={{ width: `${pct}%`, marginLeft: align === "right" ? `${100 - pct}%` : undefined }}
        />
      </div>
    </div>
  );
}

function HudOverlay({ hud }: { hud: Hud }) {
  return (
    <div className="tq-game-hud pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-3 sm:p-4">
      {hud.kind === "falling" && (
        <>
          <div className="font-mono text-sm text-sub">
            <div>
              score <span className="text-xl tabular-nums text-text">{hud.s.score}</span>
            </div>
            <div>
              level <span className="tabular-nums text-main">{hud.s.level}</span>
              {hud.s.multiplier > 1 && <span className="ml-2 text-[var(--combo-3)]">×{hud.s.multiplier}</span>}
            </div>
          </div>
          <div className="flex gap-1 text-xl" aria-label={`${hud.s.lives} lives left`}>
            {[0, 1, 2].map((i) => (
              <span key={i} className={i < hud.s.lives ? "text-error" : "text-sub/40"} aria-hidden="true">
                ♥
              </span>
            ))}
          </div>
        </>
      )}
      {hud.kind === "boss" && (
        <>
          <Bar value={hud.s.playerHp} max={hud.s.playerMaxHp} label="you" tone="caret" />
          <div className="mt-1 hidden text-center font-display text-xs uppercase tracking-widest text-sub sm:block">phase {hud.s.phase}</div>
          <Bar value={hud.s.bossHp} max={hud.s.bossMaxHp} label="boss" tone="error" align="right" />
        </>
      )}
      {hud.kind === "race" && (
        <div className="mx-auto rounded-full bg-bg/70 px-3 py-0.5 font-mono text-sm text-sub backdrop-blur-sm">
          <span className="font-display text-base text-text">{ordinal(hud.s.place ?? hud.s.pos)}</span>
          <span>/{hud.s.total}</span>
          <span className="ml-3 tabular-nums">
            {hud.s.done}/{hud.s.words} words
          </span>
        </div>
      )}
      {hud.kind === "duel" && (
        <>
          <Bar value={hud.s.playerHp} max={hud.s.maxHp} label="you" tone="caret" />
          <div className="mt-1 hidden font-mono text-xs text-sub sm:block">{hud.s.chain >= 2 ? `${hud.s.chain} chain` : ""}</div>
          <Bar value={hud.s.rivalHp} max={hud.s.rivalMaxHp} label="rival" tone="error" align="right" />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function GameResults({ game, result, reducedMotion, onRetry }: { game: GameInfo; result: Result; reducedMotion: boolean; onRetry: () => void }) {
  const { outcome, isBest, previous, ghostSaved, save, shareCode, versus } = result;
  const share = async () => {
    if (!shareCode) return;
    const url = `${window.location.origin}/play/racing?race=${shareCode}`;
    try {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title: "Beat my TypeQuest race", text: `I finished in ${(outcome.durationMs / 1000).toFixed(1)}s. Race my ghost:`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast({ title: "Race link copied", body: "Send it to a friend — they'll race your ghost on the same words.", tone: "success" });
    } catch {
      toast({ title: "Couldn't copy the link", body: url, tone: "error" }, 9000);
    }
  };
  return (
    <div className="mx-auto max-w-2xl py-6 text-center">
      <div className="mb-3 flex justify-center">
        <Mascot engine={null} mood={outcome.won ? "cheer" : isBest ? "happy" : "sad"} size={72} />
      </div>
      <p className={`font-display text-sm uppercase tracking-[0.3em] ${outcome.won ? "text-main" : "text-sub"}`}>
        {outcome.won ? "Victory" : game.id === "racing" ? "Race over" : "Game over"}
      </p>
      <h2 className="mt-2 font-display text-3xl font-black text-text sm:text-4xl">{outcome.summary}</h2>

      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: "score", v: outcome.score.toLocaleString() },
          { k: "wpm", v: Math.round(outcome.wpm) },
          { k: "accuracy", v: `${Math.round(outcome.accuracy)}%` },
          { k: "words", v: outcome.wordsDone },
        ].map((s) => (
          <div key={s.k} className="tq-card">
            <dt className="text-xs uppercase tracking-widest text-sub">{s.k}</dt>
            <dd className="mt-1 font-mono text-2xl tabular-nums text-text">{s.v}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-5 text-sm text-sub">
        {isBest ? (
          <span className="text-[var(--combo-3)]">{previous === null ? "First score on the board!" : `New best — up from ${previous.toLocaleString()}.`}</span>
        ) : (
          <>Best: {previous?.toLocaleString()}</>
        )}
        {ghostSaved && <span className="ml-2">Your ghost car will race you next time.</span>}
      </p>
      {versus && (
        <p className={`mt-2 font-display text-lg ${versus.margin > 0 ? "text-main" : "text-sub"}`}>
          {versus.margin > 0
            ? `You beat ${versus.name}'s ghost by ${(versus.margin / 1000).toFixed(1)}s!`
            : `${versus.name}'s ghost was ${(-versus.margin / 1000).toFixed(1)}s faster.`}
        </p>
      )}

      <div className="mt-6">
        <ProgressStrip save={save} reducedMotion={reducedMotion} />
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" className="tq-btn tq-btn-primary" onClick={onRetry} autoFocus>
          Play again
        </button>
        {shareCode && (
          <button type="button" className="tq-btn" onClick={() => void share()}>
            Challenge a friend
          </button>
        )}
        <Link href="/play" className="tq-btn">
          Other games
        </Link>
        <Link href={`/play?board=${game.id}#board`} className="tq-btn">
          Leaderboard
        </Link>
      </div>
      <p className="tq-chrome mt-4 text-xs text-sub">
        <kbd>Enter</kbd> — play again
      </p>
    </div>
  );
}
