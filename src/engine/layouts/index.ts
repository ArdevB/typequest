import { COLEMAK } from "./colemak";
import { DVORAK } from "./dvorak";
import { QWERTY } from "./qwerty";
import type { KeyboardLayout } from "./types";

export type LayoutId = "qwerty" | "dvorak" | "colemak";

export const LAYOUTS: Readonly<Record<LayoutId, KeyboardLayout>> = { qwerty: QWERTY, dvorak: DVORAK, colemak: COLEMAK };
export const LAYOUT_IDS: readonly LayoutId[] = ["qwerty", "dvorak", "colemak"];

export const getLayout = (id: string | undefined): KeyboardLayout => LAYOUTS[(id ?? "qwerty") as LayoutId] ?? QWERTY;

/**
 * Translates text written for QWERTY into the keys at the same physical
 * positions on another layout ("fj" → "uh" on Dvorak, "tn" on Colemak).
 * Characters QWERTY doesn't have (space…) pass through.
 */
export function translateKeys(text: string, to: KeyboardLayout): string {
  if (to.id === "qwerty") return text;
  let out = "";
  for (const ch of text) {
    const pos = POSITIONS.get(ch);
    const target = pos ? to.rows[pos.row]?.[pos.index] : undefined;
    out += target ? (pos!.shift ? (target.shift ?? target.key) : target.key) : ch;
  }
  return out;
}

const POSITIONS = new Map<string, { row: number; index: number; shift: boolean }>();
QWERTY.rows.forEach((row, r) =>
  row.forEach((k, i) => {
    if (k.key !== " ") POSITIONS.set(k.key, { row: r, index: i, shift: false });
    if (k.shift) POSITIONS.set(k.shift, { row: r, index: i, shift: true });
  }),
);
