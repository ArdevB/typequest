import { comboTier } from "@/engine";
import { attachCoreFeedback } from "../shared/feedback";
import type { CreateEffects } from "../types";

/** Retro Arcade: chunky square "pixel" pops on words and big 8-bit bursts on combos. */
export const createRetroEffects: CreateEffects = (engine, ctx) => {
  const offCore = attachCoreFeedback(engine, ctx, { errorPulse: "glow", shake: true, pitchRise: true });
  const { particles, config, reducedMotion } = ctx;
  if (!particles || reducedMotion || !config.particles) return offCore;
  const colors = config.particles.colors;

  const offs = [
    engine.on("wordComplete", (e) => {
      if (!e.correct) return;
      const p = ctx.getCaretPoint();
      if (!p) return;
      const tier = comboTier(engine.getSnapshot().combo);
      particles.burst(p.x - 8, p.y, { count: 4 + tier * 2, colors, speed: 140, life: 0.35, size: 3.5, gravity: 500, square: true });
    }),
    engine.on("combo", (e) => {
      const p = ctx.getCaretPoint();
      if (!p) return;
      particles.burst(p.x, p.y, { count: 24 + e.tier * 12, colors, speed: 260 + e.tier * 50, life: 0.7, size: 4, gravity: 600, square: true });
    }),
  ];
  return () => {
    offs.forEach((off) => off());
    offCore();
  };
};
