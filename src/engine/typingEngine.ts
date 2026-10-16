import { Emitter } from "./emitter";
import { computeResults } from "./metrics";
import {
  KeyKind,
  type ComboTier,
  type EngineEvents,
  type EngineOptions,
  type EngineSnapshot,
  type EngineStatus,
  type CharState,
  type KeyHit,
  type Keystroke,
  type RunResult,
  type StopOnError,
  type TestMode,
  type WordSource,
} from "./types";

export interface TypingEngine {
  /** Type one or more characters. A " " is treated as space(). */
  input(chars: string): void;
  space(): void;
  backspace(ctrlWord?: boolean): void;
  /** Record input that was refused (paste, drop, autocorrect). Shows up in result.flags. */
  rejectInput(reason: "paste" | "drop" | "replace"): void;
  /**
   * Give up on the current word and move to the next (games: a falling word
   * hit the ground). Not logged: game simulations re-trigger it
   * deterministically when replaying.
   */
  skipWord(): void;

  reset(opts?: Partial<EngineOptions>): void;
  /** End now (quit, or the time ran out while the tab was hidden). */
  finish(): void;
  /** Advance timers. Called automatically unless autoTick is false. */
  tick(): void;
  destroy(): void;

  getSnapshot(): EngineSnapshot;
  getCharState(wordIndex: number, charIndex: number): CharState;
  getTyped(wordIndex: number): string;
  getWords(): readonly string[];
  getLog(): readonly Keystroke[];
  getHits(): readonly KeyHit[];
  getResult(): RunResult | null;

  on<E extends keyof EngineEvents>(event: E, fn: (payload: EngineEvents[E]) => void): () => void;
}

interface ResolvedOptions {
  mode: TestMode;
  source: WordSource;
  stopOnError: StopOnError;
  allowBackspaceToPrevWord: boolean;
  now: () => number;
  autoTick: boolean;
}

const INITIAL_TIME_WORDS = 80;
const TOP_UP_WHEN_LEFT = 40;
const TOP_UP_COUNT = 40;
/** Max extra characters allowed past the end of a word. */
const MAX_EXTRA = 12;

export function comboTier(count: number): ComboTier {
  if (count >= 50) return 3;
  if (count >= 25) return 2;
  if (count >= 10) return 1;
  return 0;
}

function isComboMilestone(count: number): boolean {
  return count === 10 || count === 25 || (count >= 50 && count % 25 === 0);
}

const defaultNow = (): number =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

function resolve(o: EngineOptions): ResolvedOptions {
  return {
    mode: o.mode,
    source: o.source,
    stopOnError: o.stopOnError ?? "off",
    allowBackspaceToPrevWord: o.allowBackspaceToPrevWord ?? true,
    now: o.now ?? defaultNow,
    autoTick: o.autoTick ?? true,
  };
}

export function createTypingEngine(initial: EngineOptions): TypingEngine {
  let opts = resolve(initial);
  const emitter = new Emitter<EngineEvents>();

  let words: string[] = [];
  let typed: string[] = [];
  let wordIndex = 0;
  /** Number of words fully submitted (used for scoring at the end). */
  let committed = 0;
  let status: EngineStatus = "idle";
  let startAt = 0;
  let endAt = 0;
  let log: Keystroke[] = [];
  let hits: KeyHit[] = [];
  let combo = 0;
  let maxCombo = 0;
  let correctHits = 0;
  let lastTickSecond = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let result: RunResult | null = null;

  const limitMs = (): number | null =>
    opts.mode.kind === "time" ? opts.mode.seconds * 1000 : null;

  const elapsed = (): number => {
    if (status === "idle") return 0;
    if (status === "finished") return endAt - startAt;
    return opts.now() - startAt;
  };

  const stamp = (): number => Math.round(opts.now() - startAt);

  function loadWords(): void {
    const mode = opts.mode;
    if (mode.kind === "text") {
      words = mode.text.trim().split(/\s+/).filter(Boolean);
    } else if (mode.kind === "words") {
      words = opts.source.take(mode.count);
    } else {
      words = opts.source.take(INITIAL_TIME_WORDS);
    }
    typed = words.map(() => "");
  }

  function stopTimer(): void {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function init(): void {
    stopTimer();
    loadWords();
    wordIndex = 0;
    committed = 0;
    status = "idle";
    startAt = 0;
    endAt = 0;
    log = [];
    hits = [];
    combo = 0;
    maxCombo = 0;
    correctHits = 0;
    lastTickSecond = 0;
    result = null;
  }

  function begin(): void {
    status = "running";
    startAt = opts.now();
    emitter.emit("start", { at: startAt });
    if (opts.autoTick && typeof setInterval !== "undefined") {
      timer = setInterval(tick, 100);
    }
  }

  function timeUp(): boolean {
    const lim = limitMs();
    return status === "running" && lim !== null && elapsed() >= lim;
  }

  function bumpCombo(): void {
    combo += 1;
    if (combo > maxCombo) maxCombo = combo;
    if (isComboMilestone(combo)) {
      emitter.emit("combo", { count: combo, tier: comboTier(combo) });
    }
  }

  function breakCombo(): void {
    if (combo > 0) {
      const lost = combo;
      combo = 0;
      emitter.emit("comboBreak", { lost });
    }
  }

  function topUp(): void {
    if (opts.mode.kind !== "time") return;
    if (words.length - wordIndex > TOP_UP_WHEN_LEFT) return;
    const more = opts.source.take(TOP_UP_COUNT);
    if (more.length === 0) return;
    const from = words.length;
    words.push(...more);
    typed.push(...more.map(() => ""));
    emitter.emit("wordsAppended", { from, words: more });
  }

  function finishAt(atStamp: number | null): void {
    if (status !== "running") return;
    const lim = limitMs();
    let duration = atStamp ?? opts.now() - startAt;
    if (lim !== null) {
      duration = Math.min(duration, lim);
      committed = wordIndex;
    }
    endAt = startAt + duration;
    status = "finished";
    stopTimer();
    result = computeResults({
      mode: opts.mode,
      words,
      typed,
      committed,
      hits,
      log,
      durationMs: Math.round(duration),
      maxCombo,
    });
    emitter.emit("finish", result);
  }

  function inputChar(char: string): void {
    if (status === "finished") return;
    if (timeUp()) {
      finishAt(null);
      return;
    }
    if (status === "idle") begin();

    const ts = stamp();
    log.push([ts, char, KeyKind.Char]);

    const target = words[wordIndex] ?? "";
    const cur = typed[wordIndex] ?? "";
    const pos = cur.length;
    const expected = pos < target.length ? (target[pos] ?? null) : null;
    const ok = expected === char;

    hits.push({ t: ts, expected, typed: char, correct: ok });

    if (ok) {
      correctHits += 1;
      typed[wordIndex] = cur + char;
      bumpCombo();
      emitter.emit("correct", { char, wordIndex, charIndex: pos, combo });
    } else {
      breakCombo();
      const blocked = opts.stopOnError === "letter" || cur.length - target.length >= MAX_EXTRA;
      if (!blocked) typed[wordIndex] = cur + char;
      emitter.emit("error", { expected, typed: char, wordIndex, charIndex: pos });
    }

    // Words/text modes end as soon as the last word is fully typed.
    const isLast = opts.mode.kind !== "time" && wordIndex === words.length - 1;
    const now = typed[wordIndex] ?? "";
    if (isLast && now.length >= target.length && (opts.stopOnError === "off" || now === target)) {
      emitter.emit("wordComplete", { word: target, typed: now, correct: now === target, wordIndex });
      committed = words.length;
      finishAt(ts);
    }
  }

  const engine: TypingEngine = {
    input(chars) {
      for (const ch of chars) {
        if (ch === " ") engine.space();
        else inputChar(ch);
      }
    },

    space() {
      if (status !== "running") return;
      if (timeUp()) {
        finishAt(null);
        return;
      }
      const cur = typed[wordIndex] ?? "";
      if (cur.length === 0) return; // don't skip words by accident
      const target = words[wordIndex] ?? "";
      const ts = stamp();
      log.push([ts, " ", KeyKind.Space]);

      const complete = cur.length >= target.length;
      const wordOk = cur === target;
      const expected = complete ? " " : (target[cur.length] ?? null);

      if (opts.stopOnError === "word" && !wordOk) {
        hits.push({ t: ts, expected, typed: " ", correct: false });
        breakCombo();
        emitter.emit("error", { expected, typed: " ", wordIndex, charIndex: cur.length });
        return;
      }

      hits.push({ t: ts, expected, typed: " ", correct: complete });
      if (complete) {
        correctHits += 1;
        bumpCombo();
      } else {
        breakCombo();
      }

      emitter.emit("wordComplete", { word: target, typed: cur, correct: wordOk, wordIndex });
      committed = wordIndex + 1;

      if (opts.mode.kind !== "time" && wordIndex >= words.length - 1) {
        finishAt(ts);
        return;
      }
      wordIndex += 1;
      topUp();
    },

    backspace(ctrlWord = false) {
      if (status !== "running") return;
      if (timeUp()) {
        finishAt(null);
        return;
      }
      log.push([stamp(), ctrlWord ? "w" : "", KeyKind.Backspace]);

      const cur = typed[wordIndex] ?? "";
      if (cur.length === 0) {
        const prev = wordIndex - 1;
        const canGoBack =
          prev >= 0 &&
          opts.allowBackspaceToPrevWord &&
          opts.stopOnError === "off" &&
          typed[prev] !== words[prev];
        if (!canGoBack) return;
        wordIndex = prev;
        committed = Math.min(committed, wordIndex);
        emitter.emit("backspace", {
          wordIndex,
          charIndex: (typed[wordIndex] ?? "").length,
          wordChanged: true,
        });
        return;
      }

      typed[wordIndex] = ctrlWord ? "" : cur.slice(0, -1);
      emitter.emit("backspace", {
        wordIndex,
        charIndex: (typed[wordIndex] ?? "").length,
        wordChanged: false,
      });
    },

    rejectInput(reason) {
      log.push([status === "running" ? stamp() : 0, reason, KeyKind.Rejected]);
    },

    skipWord() {
      if (status !== "running") return;
      const target = words[wordIndex] ?? "";
      const cur = typed[wordIndex] ?? "";
      breakCombo();
      emitter.emit("wordComplete", { word: target, typed: cur, correct: false, wordIndex });
      committed = wordIndex + 1;
      if (wordIndex >= words.length - 1) {
        finishAt(null);
        return;
      }
      wordIndex += 1;
      topUp();
    },

    reset(next) {
      opts = resolve({ ...opts, ...next });
      init();
      emitter.emit("reset", { words });
    },

    finish() {
      finishAt(null);
    },

    tick,

    destroy() {
      stopTimer();
      emitter.clear();
      status = "finished";
    },

    getSnapshot() {
      const el = elapsed();
      const lim = limitMs();
      let chars = 0;
      for (let i = 0; i < wordIndex; i++) {
        const w = words[i] ?? "";
        if (typed[i] === w) chars += w.length + 1;
      }
      const cur = typed[wordIndex] ?? "";
      const target = words[wordIndex] ?? "";
      if (target.startsWith(cur)) chars += cur.length;
      const minutes = el / 60000;
      return {
        status,
        words,
        wordIndex,
        charIndex: cur.length,
        elapsedMs: el,
        remainingMs: lim === null ? null : Math.max(0, lim - el),
        liveWpm: el < 500 ? 0 : chars / 5 / minutes,
        liveAccuracy: hits.length === 0 ? 100 : (correctHits / hits.length) * 100,
        combo,
        maxCombo,
      };
    },

    getCharState(w, c) {
      const target = words[w] ?? "";
      const s = typed[w] ?? "";
      if (c < s.length) {
        if (c >= target.length) return "extra";
        return s[c] === target[c] ? "correct" : "incorrect";
      }
      if (c < target.length && w < committed) return "missed";
      return "pending";
    },

    getTyped: (w) => typed[w] ?? "",
    getWords: () => words,
    getLog: () => log,
    getHits: () => hits,
    getResult: () => result,
    on: (event, fn) => emitter.on(event, fn),
  };

  function tick(): void {
    if (status !== "running") return;
    const el = elapsed();
    const lim = limitMs();
    if (lim !== null && el >= lim) {
      finishAt(lim);
      return;
    }
    const sec = Math.floor(el / 1000);
    if (sec !== lastTickSecond) {
      lastTickSecond = sec;
      emitter.emit("tick", { elapsedMs: el, remainingMs: lim === null ? null : lim - el });
    }
  }

  init();
  return engine;
}
