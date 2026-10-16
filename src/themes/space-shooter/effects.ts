import { attachCoreFeedback } from "../shared/feedback";
import type { CreateEffects } from "../types";

/** Space Shooter: every correct word fires a laser streak; combos are star bursts. */
export const createSpaceEffects: CreateEffects = (engine, ctx) => {
  const offCore = attachCoreFeedback(engine, ctx, { errorPulse: "glow", shake: true, pitchRise: true });
  const { particles, config, reducedMotion } = ctx;
  if (!particles || reducedMotion || !config.particles) return offCore;
  const colors = config.particles.colors;

  const offs = [
    engine.on("wordComplete", (e) => {
      if (!e.correct) return;
      const p = ctx.getCaretPoint();
      if (!p) return;
      // A tight forward streak, like a shot leaving the caret.
      particles.burst(p.x, p.y, { count: 6, colors: [colors[0] ?? "#fff"], speed: 420, life: 0.25, size: 1.6, gravity: 0, angle: 0, spread: 0.12 });
    }),
    engine.on("combo", (e) => {
      const p = ctx.getCaretPoint();
      if (!p) return;
      particles.burst(p.x, p.y, { count: 30 + e.tier * 12, colors, speed: 300 + e.tier * 40, life: 0.9, size: 2, gravity: 0 });
    }),
    engine.on("error", () => {
      const p = ctx.getCaretPoint();
      if (!p) return;
      particles.burst(p.x, p.y, { count: 5, colors: [config.colors.error], speed: 80, life: 0.3, size: 1.6, gravity: 0 });
    }),
  ];
  return () => {
    offs.forEach((off) => off());
    offCore();
  };
};
