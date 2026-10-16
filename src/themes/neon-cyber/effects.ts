import { comboTier } from "@/engine";
import { attachCoreFeedback } from "../shared/feedback";
import type { CreateEffects } from "../types";

/** Neon Cyber: core feedback plus caret sparks and combo bursts. */
export const createNeonEffects: CreateEffects = (engine, ctx) => {
  const offCore = attachCoreFeedback(engine, ctx, {
    errorPulse: "glow",
    shake: true,
    pitchRise: true,
  });

  const { particles, config, reducedMotion } = ctx;
  if (!particles || reducedMotion || !config.particles) return offCore;
  const colors = config.particles.colors;

  const offs = [
    engine.on("correct", (e) => {
      const tier = comboTier(e.combo);
      if (tier === 0 || !config.particles?.trail) return;
      const p = ctx.getCaretPoint();
      if (!p) return;
      particles.burst(p.x, p.y, {
        count: tier + 1,
        colors: [colors[tier - 1] ?? "#fff"],
        speed: 70 + tier * 25,
        life: 0.45,
        size: 1.8,
        gravity: 120,
        spread: Math.PI * 0.9,
      });
    }),
    engine.on("combo", (e) => {
      const p = ctx.getCaretPoint();
      if (!p) return;
      particles.burst(p.x, p.y, {
        count: 18 + e.tier * 10,
        colors,
        speed: 220 + e.tier * 40,
        life: 0.8,
        size: 2.6,
        gravity: 300,
      });
    }),
    engine.on("error", () => {
      const p = ctx.getCaretPoint();
      if (!p) return;
      particles.burst(p.x, p.y, { count: 4, colors: [config.colors.error], speed: 60, life: 0.3, size: 1.6, gravity: 0 });
    }),
  ];

  return () => {
    offs.forEach((off) => off());
    offCore();
  };
};
