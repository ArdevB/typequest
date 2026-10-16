import type { KeyboardLayout, KeyDef, TypingEngine } from "@/engine";
import { FINGER_NAMES, SPACE_FINGER, ansiRows, fingerOf, homeCenters, type FingerId, type Slot } from "./geometry";

export interface GuideElements {
  keyboard: HTMLElement;
  hands: SVGSVGElement | null;
  /** Receives text like "Left index finger · F". */
  caption: HTMLElement | null;
}

export interface GuideOptions {
  layout: KeyboardLayout;
  /** Keys taught so far; other character keys are dimmed. Omit to show all. */
  activeKeys?: string;
  reducedMotion?: boolean;
}

interface Target {
  els: HTMLElement[];
  fingers: FingerId[];
  dx: number;
  dy: number;
  label: string;
}

/**
 * Drives <VirtualKeyboard/> and <Hands/> from engine events: highlights the
 * next key (and Shift when needed), lights and leans the finger that should
 * press it, and animates presses and mistakes. Pure DOM work, no React.
 */
export function attachKeyboardGuide(engine: TypingEngine, el: GuideElements, opts: GuideOptions): () => void {
  const { layout, reducedMotion = false } = opts;
  const rows = ansiRows(layout);
  const homes = homeCenters(rows);

  const keyEls = new Map<string, HTMLElement>();
  el.keyboard.querySelectorAll<HTMLElement>("[data-key]").forEach((k) => keyEls.set(k.dataset.key ?? "", k));
  const modEls = new Map<string, HTMLElement>();
  el.keyboard.querySelectorAll<HTMLElement>("[data-mod]").forEach((k) => modEls.set(k.dataset.mod ?? "", k));
  const fingerEls = new Map<string, SVGGElement>();
  el.hands?.querySelectorAll<SVGGElement>(".hand-finger").forEach((g) => fingerEls.set(g.dataset.finger ?? "", g));

  const slotOf = new Map<string, { slot: Slot; row: number }>();
  rows.forEach((row, r) => row.forEach((slot) => slot.type === "char" && slotOf.set(slot.def.key, { slot, row: r })));

  // Dim keys that haven't been taught yet.
  if (opts.activeKeys !== undefined) {
    const active = new Set(opts.activeKeys.toLowerCase());
    for (const [key, k] of keyEls) {
      if (key !== " " && !active.has(key)) k.dataset.dim = "true";
      else delete k.dataset.dim;
    }
  }

  let current: Target | null = null;
  let raf = 0;

  function nextChar(): string | null {
    const s = engine.getSnapshot();
    if (s.status === "finished") return null;
    const word = s.words[s.wordIndex] ?? "";
    const typed = engine.getTyped(s.wordIndex);
    if (typed.length > word.length || !word.startsWith(typed)) return "\b";
    if (s.charIndex < word.length) return word[s.charIndex] ?? null;
    return s.wordIndex < s.words.length - 1 ? " " : null;
  }

  function targetFor(ch: string): Target | null {
    if (ch === "\b") {
      const bs = modEls.get("backspace");
      return bs ? { els: [bs], fingers: ["r-pinky"], dx: 2.5, dy: -2, label: `${FINGER_NAMES["r-pinky"]} · Backspace` } : null;
    }
    const def: KeyDef | undefined = layout.byChar.get(ch);
    if (!def) return null;
    const keyEl = keyEls.get(def.key);
    const info = slotOf.get(def.key);
    if (!keyEl || !info) return null;

    const finger = def.key === " " ? SPACE_FINGER : fingerOf(def);
    const center = info.slot.x + info.slot.width / 2;
    const dx = def.key === " " ? 0 : center - (homes[finger] ?? center);
    const dy = def.key === " " ? 0 : info.row - 2;
    const target: Target = {
      els: [keyEl],
      fingers: [finger],
      dx,
      dy,
      label: def.key === " " ? `${FINGER_NAMES[finger]} · Space` : `${FINGER_NAMES[finger]} · ${ch.toUpperCase()}`,
    };

    const needsShift = def.shift === ch && def.key !== ch;
    if (needsShift) {
      // Shift with the opposite hand's little finger.
      const left = def.hand === "left";
      const shift = modEls.get(left ? "shift-r" : "shift-l");
      const shiftFinger: FingerId = left ? "r-pinky" : "l-pinky";
      if (shift) {
        target.els.push(shift);
        target.fingers.push(shiftFinger);
        target.label += ` + ${left ? "right" : "left"} Shift`;
      }
    }
    return target;
  }

  function apply(): void {
    raf = 0;
    const ch = nextChar();
    const next = ch === null ? null : targetFor(ch);

    if (current) {
      for (const k of current.els) delete k.dataset.next;
      for (const f of current.fingers) {
        const g = fingerEls.get(f);
        if (g) {
          delete g.dataset.active;
          g.style.removeProperty("--dx");
          g.style.removeProperty("--dy");
        }
      }
    }
    current = next;
    if (!next) {
      if (el.caption) el.caption.textContent = "";
      return;
    }
    for (const k of next.els) k.dataset.next = "true";
    next.fingers.forEach((f, i) => {
      const g = fingerEls.get(f);
      if (!g) return;
      g.dataset.active = "true";
      // Only the main finger leans toward its key; Shift's pinky just lights up.
      if (i === 0) {
        g.style.setProperty("--dx", String(Math.max(-2.5, Math.min(2.5, next.dx))));
        g.style.setProperty("--dy", String(next.dy));
      }
    });
    if (el.caption) el.caption.textContent = next.label;
  }

  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(apply);
  };

  const press = (target: Element | undefined | null, wrong = false) => {
    if (!target || reducedMotion) return;
    target.animate(
      wrong
        ? [{ transform: "translateX(0)" }, { transform: "translateX(-3px)" }, { transform: "translateX(3px)" }, { transform: "translateX(0)" }]
        : [{ transform: "scale(1)" }, { transform: "scale(0.9)" }, { transform: "scale(1)" }],
      { duration: wrong ? 180 : 130, easing: "ease-out" },
    );
  };

  const pressFinger = (f: FingerId | undefined) => {
    if (!f || reducedMotion) return;
    fingerEls.get(f)?.querySelector(".finger-press")?.animate(
      [{ transform: "translateY(0)" }, { transform: "translateY(7px)" }, { transform: "translateY(0)" }],
      { duration: 140, easing: "ease-out" },
    );
  };

  const flashWrong = (typed: string) => {
    const def = layout.byChar.get(typed);
    const k = def ? keyEls.get(def.key) : undefined;
    if (!k) return;
    k.dataset.wrong = "true";
    press(k, true);
    setTimeout(() => delete k.dataset.wrong, 260);
  };

  const offs = [
    engine.on("correct", (e) => {
      const def = layout.byChar.get(e.char);
      press(def ? keyEls.get(def.key) : undefined);
      pressFinger(current?.fingers[0]);
      schedule();
    }),
    engine.on("wordComplete", () => {
      press(keyEls.get(" "));
      pressFinger(SPACE_FINGER);
      schedule();
    }),
    engine.on("error", (e) => {
      flashWrong(e.typed);
      schedule();
    }),
    engine.on("backspace", schedule),
    engine.on("reset", schedule),
    engine.on("finish", schedule),
  ];

  apply();

  return () => {
    if (raf) cancelAnimationFrame(raf);
    offs.forEach((off) => off());
    current = null;
    keyEls.forEach((k) => {
      delete k.dataset.next;
      delete k.dataset.wrong;
    });
    modEls.forEach((k) => delete k.dataset.next);
    fingerEls.forEach((g) => {
      delete g.dataset.active;
      g.style.removeProperty("--dx");
      g.style.removeProperty("--dy");
    });
    if (el.caption) el.caption.textContent = "";
  };
}

/** Highlights a set of keys (e.g. a lesson's new keys on the intro screen). */
export function highlightKeys(keyboard: HTMLElement, keys: string, layout: KeyboardLayout): () => void {
  const marked: HTMLElement[] = [];
  for (const ch of keys) {
    const def = layout.byChar.get(ch);
    const k = def && keyboard.querySelector<HTMLElement>(`[data-key="${CSS.escape(def.key)}"]`);
    if (k) {
      k.dataset.new = "true";
      marked.push(k);
    }
  }
  return () => marked.forEach((k) => delete k.dataset.new);
}
