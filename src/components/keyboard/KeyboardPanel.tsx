"use client";

import { useEffect, useRef } from "react";
import { QWERTY, type TypingEngine } from "@/engine";
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
}

/** Keyboard + hands + "which finger" caption, driven imperatively by the engine. */
export function KeyboardPanel({ engine, activeKeys, highlight, reducedMotion, showHands = true }: Props) {
  const kbRef = useRef<HTMLDivElement>(null);
  const handsRef = useRef<SVGSVGElement>(null);
  const captionRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const keyboard = kbRef.current;
    if (!engine || !keyboard) return;
    return attachKeyboardGuide(
      engine,
      { keyboard, hands: handsRef.current, caption: captionRef.current },
      { layout: QWERTY, activeKeys, reducedMotion },
    );
  }, [engine, activeKeys, reducedMotion]);

  useEffect(() => {
    const keyboard = kbRef.current;
    if (engine || !keyboard || !highlight) return;
    return highlightKeys(keyboard, highlight, QWERTY);
  }, [engine, highlight]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <p ref={captionRef} className="mb-3 h-6 text-center font-mono text-sm text-text" aria-live="polite" />
      <div ref={kbRef}>
        <VirtualKeyboard />
      </div>
      {showHands && <Hands ref={handsRef} className="mt-1" />}
    </div>
  );
}
