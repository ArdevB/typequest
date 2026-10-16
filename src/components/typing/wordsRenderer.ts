import type { TypingEngine } from "@/engine";

export interface WordsRenderer {
  /** Caret center relative to `container`, for particle effects. */
  getCaretPoint(): { x: number; y: number } | null;
  destroy(): void;
}

const VISIBLE_LINES = 3;

/**
 * Imperative renderer for the word list. React renders the container once;
 * everything after that (char states, extras, caret, line scrolling) is plain
 * DOM work batched into one animation frame, so typing never re-renders React.
 */
export function createWordsRenderer(
  container: HTMLElement,
  engine: TypingEngine,
  caretStyle: "line" | "block" | "underline" = "line",
): WordsRenderer {
  const inner = document.createElement("div");
  inner.className = "tq-words-inner";
  const caret = document.createElement("div");
  caret.className = "tq-caret";
  caret.dataset.style = caretStyle;
  caret.setAttribute("aria-hidden", "true");

  container.replaceChildren(inner);

  let wordEls: HTMLElement[] = [];
  let lineH = 0;
  let scrolledLines = 0;
  let activeIndex = -1;
  const dirty = new Set<number>();
  let raf = 0;
  let caretX = 0;
  let caretY = 0;

  function makeWord(word: string, index: number): HTMLElement {
    const el = document.createElement("div");
    el.className = "tq-word";
    el.dataset.i = String(index);
    for (const ch of word) {
      const span = document.createElement("span");
      span.className = "tq-char";
      span.dataset.s = "pending";
      span.textContent = ch;
      el.appendChild(span);
    }
    return el;
  }

  function build(): void {
    const words = engine.getWords();
    const frag = document.createDocumentFragment();
    wordEls = words.map((w, i) => {
      const el = makeWord(w, i);
      frag.appendChild(el);
      return el;
    });
    inner.replaceChildren(frag, caret);
    scrolledLines = 0;
    activeIndex = -1;
    inner.style.transform = "translateY(0)";
    measure();
    dirty.clear();
    dirty.add(0);
    flush();
  }

  function append(from: number, words: readonly string[]): void {
    const frag = document.createDocumentFragment();
    words.forEach((w, k) => {
      const el = makeWord(w, from + k);
      wordEls[from + k] = el;
      frag.appendChild(el);
    });
    inner.insertBefore(frag, caret);
  }

  function measure(): void {
    lineH = wordEls[0]?.offsetHeight ?? 0;
    container.style.height = lineH ? `${lineH * VISIBLE_LINES}px` : "";
  }

  function updateWord(w: number): void {
    const el = wordEls[w];
    if (!el) return;
    const target = engine.getWords()[w] ?? "";
    const typed = engine.getTyped(w);
    const total = Math.max(target.length, typed.length);

    // Add/remove spans for extra characters typed past the end of the word.
    while (el.children.length < total) {
      const span = document.createElement("span");
      span.className = "tq-char";
      el.appendChild(span);
    }
    while (el.children.length > total) el.lastElementChild?.remove();

    for (let c = 0; c < total; c++) {
      const span = el.children[c] as HTMLElement;
      const state = engine.getCharState(w, c);
      if (span.dataset.s !== state) span.dataset.s = state;
      if (c >= target.length) {
        const ch = typed[c] ?? "";
        if (span.textContent !== ch) span.textContent = ch;
      }
    }
    const snap = engine.getSnapshot();
    const wrong = w < snap.wordIndex && typed !== target;
    if (wrong) el.dataset.err = "true";
    else delete el.dataset.err;
  }

  function placeCaret(): void {
    const { wordIndex, charIndex, status } = engine.getSnapshot();
    if (activeIndex !== wordIndex) {
      wordEls[activeIndex]?.classList.remove("active");
      wordEls[wordIndex]?.classList.add("active");
      activeIndex = wordIndex;
    }
    const wordEl = wordEls[wordIndex];
    if (!wordEl) return;
    const spans = wordEl.children;
    let x = wordEl.offsetLeft;
    const at = spans[charIndex] as HTMLElement | undefined;
    if (at) {
      x += at.offsetLeft;
    } else {
      const last = spans[spans.length - 1] as HTMLElement | undefined;
      if (last) x += last.offsetLeft + last.offsetWidth;
    }
    const y = wordEl.offsetTop;
    caretX = x;
    caretY = y;
    caret.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    caret.dataset.status = status;

    if (lineH > 0) {
      const line = Math.round(y / lineH);
      let next = scrolledLines;
      if (line - scrolledLines >= VISIBLE_LINES - 1) next = line - 1;
      else if (line < scrolledLines) next = line;
      if (next !== scrolledLines) {
        scrolledLines = Math.max(0, next);
        inner.style.transform = `translateY(${-scrolledLines * lineH}px)`;
      }
    }
  }

  function flush(): void {
    raf = 0;
    for (const w of dirty) updateWord(w);
    dirty.clear();
    placeCaret();
  }

  function schedule(...words: number[]): void {
    for (const w of words) if (w >= 0) dirty.add(w);
    if (!raf) raf = requestAnimationFrame(flush);
  }

  const offs = [
    engine.on("correct", (e) => schedule(e.wordIndex)),
    engine.on("error", (e) => schedule(e.wordIndex)),
    engine.on("backspace", (e) => schedule(e.wordIndex, e.wordIndex + 1)),
    engine.on("wordComplete", (e) => schedule(e.wordIndex, e.wordIndex + 1)),
    engine.on("wordsAppended", (e) => append(e.from, e.words)),
    engine.on("start", () => schedule()),
    engine.on("finish", () => schedule()),
    engine.on("reset", () => build()),
  ];

  const ro = new ResizeObserver(() => {
    measure();
    // Re-evaluate scrolling from scratch at the new width.
    scrolledLines = 0;
    inner.style.transform = "translateY(0)";
    schedule();
  });
  ro.observe(container);

  build();

  return {
    getCaretPoint() {
      return {
        x: inner.offsetLeft + caretX,
        y: inner.offsetTop + caretY - scrolledLines * lineH + lineH / 2,
      };
    },
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      offs.forEach((off) => off());
      ro.disconnect();
      container.replaceChildren();
    },
  };
}
