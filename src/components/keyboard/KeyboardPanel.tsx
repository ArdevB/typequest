"use client";

import { useEffect, useRef } from "react";
import { getLayout, type KeyboardLayout, type TypingEngine } from "@/engine";
import { useSettings } from "@/stores/settingsStore";
import { Hands } from "@/components/hands/Hands";
import { attachKeyboardGuide, highlightKeys } from "./keyboardGuide";
import { VirtualKeyboard } from "./VirtualKeyboard";

interface Props {
  /** Live engine to follow. Without one, `highlight` keys are shown instead. */
  engine: TypingEngine | null;
  /** Keys taught so far; the rest are dimmed. */
  activeKeys?: string;
  /** Keys to highlight while no engine is attached (lesson intro). */
  highlight?: string;
  reducedMotion: boolean;
  showHands?: boolean;
  /** Defaults to the layout chosen in Settings. */
  layout?: KeyboardLayout;
}

/** Keyboard + hands + "which finger" caption, driven imperatively by the engine. */
export function KeyboardPanel({ engine, activeKeys, highlight, reducedMotion, showHands = true, layout: layoutProp }: Props) {
  const chosen = useSettings((s) => s.layout);
  const layout = layoutProp ?? getLayout(chosen);
  const kbRef = useRef<HTMLDivElement>(null);
  const handsRef = useRef<SVGSVGElement>(null);
  const captionRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const keyboard = kbRef.current;
    if (!engine || !keyboard) return;
    return attachKeyboardGuide(
      engine,
      { keyboard, hands: handsRef.current, caption: captionRef.current },
      { layout, activeKeys, reducedMotion },
    );
  }, [engine, activeKeys, reducedMotion, layout]);

  useEffect(() => {
    const keyboard = kbRef.current;
    if (engine || !keyboard || !highlight) return;
    return highlightKeys(keyboard, highlight, layout);
  }, [engine, highlight, layout]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <p ref={captionRef} className="mb-3 h-6 text-center font-mono text-sm text-text" aria-live="polite" />
      <div ref={kbRef}>
        <VirtualKeyboard layout={layout} key={layout.id} />
      </div>
      {showHands && <Hands ref={handsRef} className="mt-1" />}
    </div>
  );
}
