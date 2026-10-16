import { comboTier } from "@/engine";
import { attachCoreFeedback } from "../shared/feedback";
import type { CreateEffects } from "../types";

/** Inferno: embers rise from every key while a combo burns; combos erupt. */
export const createInfernoEffects: CreateEffects = (engine, ctx) => {
  const offCore = attachCoreFeedback(engine, ctx, { errorPulse: "glow", shake: true, pitchRise: true });
  const { particles, config, reducedMotion } = ctx;
  if (!particles || reducedMotion || !config.particles) return offCore;
  const colors = config.particles.colors;

  const offs = [
    engine.on("correct", (e) => {
      const tier = comboTier(e.combo);
      if (tier === 0) return;
      const p = ctx.getCaretPoint();
      if (!p) return;
      particles.burst(p.x, p.y + 8, { count: tier, colors, speed: 50 + tier * 15, life: 0.8, size: 2, gravity: -160, angle: -Math.PI / 2, spread: 1.1 });
    }),
    engine.on("combo", (e) => {
      const p = ctx.getCaretPoint();
      if (!p) return;
      particles.burst(p.x, p.y, { count: 30 + e.tier * 14, colors, speed: 260 + e.tier * 40, life: 1.1, size: 2.8, gravity: -220, angle: -Math.PI / 2, spread: Math.PI * 1.2 });
    }),
  ];
  return () => {
    offs.forEach((off) => off());
    offCore();
  };
};
