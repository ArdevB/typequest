import { comboTier, type ComboTier, type TypingEngine } from "@/engine";
import type { EffectsContext } from "../types";

export interface FeedbackOptions {
  /** Red pulse on errors. "soft" is a faint flash, "off" disables it. */
  errorPulse: "soft" | "glow" | "off";
  /** Gentle shake at combo tier 2+ (ignored with reduced motion). */
  shake: boolean;
  /** Raise sound pitch with the combo tier. */
  pitchRise: boolean;
}

const PITCH: Record<ComboTier, number> = { 0: 1, 1: 1.04, 2: 1.08, 3: 1.13 };

/**
 * Feedback every theme shares: key sounds, the combo meter, combo tier
 * attribute (CSS shifts colors), error pulse and screen shake.
 */
export function attachCoreFeedback(
  engine: TypingEngine,
  ctx: EffectsContext,
  opts: FeedbackOptions,
): () => void {
  const { root, stage, sound, comboEl, reducedMotion } = ctx;
  let tier: ComboTier = 0;

  const setTier = (next: ComboTier): void => {
    if (next === tier) return;
    tier = next;
    root.dataset.comboTier = String(next);
    if (opts.pitchRise) sound.setPitch(PITCH[next]);
  };

  const showCombo = (count: number): void => {
    if (!comboEl) return;
    comboEl.textContent = count >= 5 ? `${count}×` : "";
    comboEl.dataset.visible = count >= 5 ? "true" : "false";
  };

  root.dataset.comboTier = "0";
  sound.setPitch(1);
  showCombo(0);

  const offs = [
    engine.on("correct", (e) => {
      sound.play("key");
      setTier(comboTier(e.combo));
      showCombo(e.combo);
    }),
    engine.on("wordComplete", () => {
      // Space is scored inside the engine; play its sound here.
      sound.play("space");
      showCombo(engine.getSnapshot().combo);
      setTier(comboTier(engine.getSnapshot().combo));
    }),
    engine.on("error", () => {
      sound.play("error", false);
      if (opts.errorPulse !== "off") {
        root.animate(
          opts.errorPulse === "glow"
            ? [{ boxShadow: "inset 0 0 0 0 transparent" }, { boxShadow: "inset 0 0 60px -10px var(--error)" }, { boxShadow: "inset 0 0 0 0 transparent" }]
            : [{ backgroundColor: "transparent" }, { backgroundColor: "color-mix(in srgb, var(--error) 8%, transparent)" }, { backgroundColor: "transparent" }],
          { duration: 260, easing: "ease-out" },
        );
      }
    }),
    engine.on("comboBreak", () => {
      setTier(0);
      showCombo(0);
    }),
    engine.on("combo", (e) => {
      sound.play("combo", false);
      comboEl?.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.45)" }, { transform: "scale(1)" }],
        { duration: reducedMotion ? 1 : 380, easing: "cubic-bezier(.2,1.6,.4,1)" },
      );
      if (opts.shake && !reducedMotion && e.tier >= 2) {
        const px = e.tier === 3 ? 4 : 2.5;
        stage.animate(
          [
            { transform: "translate(0,0)" },
            { transform: `translate(${px}px,-${px / 2}px)` },
            { transform: `translate(-${px}px,${px / 2}px)` },
            { transform: `translate(${px / 2}px,${px / 2}px)` },
            { transform: "translate(0,0)" },
          ],
          { duration: 240, easing: "ease-out" },
        );
      }
    }),
    engine.on("reset", () => {
      setTier(0);
      showCombo(0);
    }),
  ];

  return () => {
    offs.forEach((off) => off());
    sound.setPitch(1);
    delete root.dataset.comboTier;
  };
}
