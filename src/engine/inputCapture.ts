import type { TypingEngine } from "./typingEngine";

export interface InputCaptureOptions {
  onPasteBlocked?: () => void;
}

/**
 * Some mobile keyboards only report backspace when there is something to delete,
 * so the field always holds one sentinel char that we restore after each edit.
 */
const SENTINEL = " ";

/**
 * Connects a hidden <input> to the engine. This is the only engine file that
 * touches the DOM.
 *
 * - Desktop: `beforeinput` is cancelable, so each insert/delete is handled and
 *   the field never changes.
 * - Mobile/IME: composition is allowed to run, then the committed text from
 *   `compositionend` (or the diff in `input`) is fed to the engine.
 * - Paste, drop and autocorrect replacements are blocked and logged.
 */
export function attachInput(
  el: HTMLInputElement,
  engine: TypingEngine,
  opts: InputCaptureOptions = {},
): () => void {
  let composing = false;

  el.setAttribute("autocomplete", "off");
  el.setAttribute("autocorrect", "off");
  el.setAttribute("autocapitalize", "off");
  el.setAttribute("spellcheck", "false");
  el.setAttribute("inputmode", "text");
  el.setAttribute("enterkeyhint", "next");
  el.value = SENTINEL;

  const resetField = (): void => {
    el.value = SENTINEL;
    el.setSelectionRange(SENTINEL.length, SENTINEL.length);
  };

  const reject = (reason: "paste" | "drop" | "replace"): void => {
    engine.rejectInput(reason);
    opts.onPasteBlocked?.();
  };

  const onBeforeInput = (e: InputEvent): void => {
    switch (e.inputType) {
      case "insertFromPaste":
      case "insertFromPasteAsQuotation":
      case "insertFromDrop":
      case "insertFromYank":
        e.preventDefault();
        reject(e.inputType === "insertFromDrop" ? "drop" : "paste");
        return;
      case "insertReplacementText":
        e.preventDefault();
        reject("replace");
        return;
      case "insertText":
        if (composing || !e.cancelable || e.data === null) return;
        e.preventDefault();
        engine.input(e.data);
        return;
      case "deleteContentBackward":
        if (composing || !e.cancelable) return;
        e.preventDefault();
        engine.backspace(false);
        return;
      case "deleteWordBackward":
      case "deleteSoftLineBackward":
      case "deleteHardLineBackward":
        if (composing || !e.cancelable) return;
        e.preventDefault();
        engine.backspace(true);
        return;
      case "insertLineBreak":
      case "insertParagraph":
        e.preventDefault();
        return;
      default:
        // Let composition events through; everything else is a no-op.
        if (!e.inputType.startsWith("insertComposition") && e.cancelable) e.preventDefault();
    }
  };

  /** Fallback for keyboards whose beforeinput can't be cancelled (many Android IMEs). */
  const onInput = (): void => {
    if (composing) return;
    const v = el.value;
    if (v === SENTINEL) return;
    if (v.length < SENTINEL.length) {
      engine.backspace(false);
    } else {
      const added = v.startsWith(SENTINEL) ? v.slice(SENTINEL.length) : v;
      if (added) engine.input(added);
    }
    resetField();
  };

  const onCompositionStart = (): void => {
    composing = true;
  };

  const onCompositionEnd = (e: CompositionEvent): void => {
    composing = false;
    if (e.data) engine.input(e.data);
    resetField();
  };

  const onPaste = (e: ClipboardEvent): void => {
    e.preventDefault();
    reject("paste");
  };
  const onDrop = (e: DragEvent): void => {
    e.preventDefault();
    reject("drop");
  };

  /** Keep the caret at the end so arrow keys / clicks can't move it. */
  const onSelect = (): void => {
    if (el.selectionStart !== el.value.length) {
      el.setSelectionRange(el.value.length, el.value.length);
    }
  };

  el.addEventListener("beforeinput", onBeforeInput);
  el.addEventListener("input", onInput);
  el.addEventListener("compositionstart", onCompositionStart);
  el.addEventListener("compositionend", onCompositionEnd);
  el.addEventListener("paste", onPaste);
  el.addEventListener("drop", onDrop);
  el.addEventListener("select", onSelect);

  return () => {
    el.removeEventListener("beforeinput", onBeforeInput);
    el.removeEventListener("input", onInput);
    el.removeEventListener("compositionstart", onCompositionStart);
    el.removeEventListener("compositionend", onCompositionEnd);
    el.removeEventListener("paste", onPaste);
    el.removeEventListener("drop", onDrop);
    el.removeEventListener("select", onSelect);
  };
}
