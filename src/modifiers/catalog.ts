import type { ChallengeModifier } from "./types";

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
    renderEffect: (engine, ctx) => {
      let penalty = 0;
      const badge = document.createElement("div");
      badge.className = "tq-heat-badge";
      badge.setAttribute("aria-live", "polite");
      ctx.root.appendChild(badge);
      const offs = [
        engine.on("error", () => {
          if (engine.getSnapshot().status !== "running") return;
          penalty += 2000;
          badge.textContent = `−${penalty / 1000}s`;
          badge.dataset.pop = String(Date.now());
          check();
        }),
        engine.on("tick", () => check()),
      ];
      function check() {
        const s = engine.getSnapshot();
        if (s.status === "running" && s.remainingMs !== null && s.remainingMs - penalty <= 0) engine.finish();
      }
      return () => {
        offs.forEach((off) => off());
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
