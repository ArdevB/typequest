import { attachCoreFeedback } from "../shared/feedback";
import type { CreateEffects } from "../types";

/** Minimal Calm: sound and color shifts only. No particles, no shake. */
export const createCalmEffects: CreateEffects = (engine, ctx) =>
  attachCoreFeedback(engine, ctx, { errorPulse: "soft", shake: false, pitchRise: false });
