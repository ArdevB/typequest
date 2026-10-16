import { createRng, wordSource, type TypingEngine, type WordSource } from "@/engine";
import { applyTransforms, type ChallengeModifier } from "./types";

const HEAT_PENALTY_MS = 2000;

const flip = (c: string, rng: () => number) => (rng() < 0.5 ? c.toUpperCase() : c.toLowerCase());

/** Every chaos modifier. Order here is the order text transforms run in. */
export const MODIFIERS: readonly ChallengeModifier[] = [
  {
    id: "reverse",
    name: "Backwords",
    icon: "⇄",
    description: "Every word is spelled backwards.",
    scoreMultiplier: 1.35,
    transformText: (words) => words.map((w) => [...w].reverse().join("")),
  },
  {
    id: "random-case",
    name: "rAnDoM cAsE",
    icon: "Aa",
    description: "Letters flip between upper and lower case. Shift is your friend.",
    scoreMultiplier: 1.3,
    transformText: (words, rng) => words.map((w) => [...w].map((c) => flip(c, rng)).join("")),
  },
  {
    id: "mirror",
    name: "Mirror",
    icon: "◫",
    description: "The text is flipped like it's in a mirror.",
    scoreMultiplier: 1.4,
    renderEffect: (_e, ctx) => toggleAttr(ctx.root, "mirror"),
  },
  {
    id: "fog",
    name: "Fog",
    icon: "☁",
    description: "You can only see the next two words.",
    scoreMultiplier: 1.25,
    renderEffect: (_e, ctx) => toggleAttr(ctx.root, "fog"),
  },
  {
    id: "shaky",
    name: "Earthquake",
    icon: "≋",
    description: "The words won't sit still.",
    scoreMultiplier: 1.2,
    motion: true,
    renderEffect: (_e, ctx) => toggleAttr(ctx.root, "shaky"),
  },
  {
    id: "tiny",
    name: "Tiny Text",
    icon: "ᵃ",
    description: "Squint. The words are half size.",
    scoreMultiplier: 1.15,
    renderEffect: (_e, ctx) => toggleAttr(ctx.root, "tiny"),
  },
  {
    id: "heat",
    name: "Heat Timer",
    icon: "♨",
    description: "Every mistake burns 2 seconds off the clock.",
    scoreMultiplier: 1.3,
    // The rule lives in the engine (so server replays match); the effect only shows the damage.
    onError: (_e, engine) => engine.penalize(HEAT_PENALTY_MS),
    renderEffect: (engine, ctx) => {
      let penalty = 0;
      const badge = document.createElement("div");
      badge.className = "tq-heat-badge";
      badge.setAttribute("aria-live", "polite");
      ctx.root.appendChild(badge);
      const off = engine.on("error", () => {
        if (engine.getSnapshot().status !== "running") return;
        penalty += HEAT_PENALTY_MS;
        badge.textContent = `−${penalty / 1000}s`;
      });
      return () => {
        off();
        badge.remove();
      };
    },
  },
  {
    id: "sudden-death",
    name: "Sudden Death",
    icon: "☠",
    description: "One mistake and it's over.",
    scoreMultiplier: 1.6,
    onError: (_e, engine) => {
      if (engine.getSnapshot().status === "running") engine.finish();
    },
  },
];

export const getModifier = (id: string) => MODIFIERS.find((m) => m.id === id);

function toggleAttr(root: HTMLElement, name: string): () => void {
  const list = new Set((root.dataset.chaos ?? "").split(" ").filter(Boolean));
  list.add(name);
  root.dataset.chaos = [...list].join(" ");
  return () => {
    const cur = new Set((root.dataset.chaos ?? "").split(" ").filter(Boolean));
    cur.delete(name);
    root.dataset.chaos = [...cur].join(" ");
  };
}

/** Chaos score: clean speed, scaled by how much chaos you stacked. */
export function chaosScore(wpm: number, accuracy: number, multiplier: number): number {
  return Math.round(wpm * (accuracy / 100) ** 2 * multiplier * 10);
}

/** Normalized modifier list: known ids, no duplicates, catalog order (which is the transform order). */
export function resolveModifiers(ids: readonly string[]): ChallengeModifier[] {
  const set = new Set(ids);
  return MODIFIERS.filter((m) => set.has(m.id));
}

/** Words for a chaos run: the same seeded generator and transforms on the client and the server. */
export function chaosSource(seed: number, mods: readonly ChallengeModifier[]): WordSource {
  const src = wordSource({ seed });
  if (!mods.some((m) => m.transformText)) return src;
  const rng = createRng(`chaos:${seed}`);
  return { take: (n) => applyTransforms(src.take(n), mods, rng) };
}

/** Hooks the modifiers' rules (onError) onto an engine — live or in a server replay. */
export function attachModifierRules(engine: TypingEngine, mods: readonly ChallengeModifier[]): () => void {
  if (!mods.some((m) => m.onError)) return () => {};
  return engine.on("error", (e) => mods.forEach((m) => m.onError?.(e, engine)));
}

export const CHAOS_SECONDS = 30;
