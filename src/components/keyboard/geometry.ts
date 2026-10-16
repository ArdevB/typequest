import type { Finger, KeyboardLayout, KeyDef } from "@/engine";

export type FingerId = `${"l" | "r"}-${Finger}`;

export const FINGER_NAMES: Record<FingerId, string> = {
  "l-pinky": "Left little finger",
  "l-ring": "Left ring finger",
  "l-middle": "Left middle finger",
  "l-index": "Left index finger",
  "l-thumb": "Left thumb",
  "r-thumb": "Right thumb",
  "r-index": "Right index finger",
  "r-middle": "Right middle finger",
  "r-ring": "Right ring finger",
  "r-pinky": "Right little finger",
};

export const fingerOf = (k: Pick<KeyDef, "hand" | "finger">): FingerId =>
  `${k.hand === "left" ? "l" : "r"}-${k.finger}` as FingerId;

export type ModId = "backspace" | "tab" | "caps" | "enter" | "shift-l" | "shift-r" | "ctrl-l" | "win-l" | "alt-l" | "alt-r" | "fn" | "ctrl-r";

export interface CharSlot {
  type: "char";
  def: KeyDef;
  width: number;
  /** Left edge, in key units from the keyboard's left edge. */
  x: number;
  finger: FingerId;
}
export interface ModSlot {
  type: "mod";
  id: ModId;
  label: string;
  width: number;
  x: number;
  finger: FingerId | null;
}
export type Slot = CharSlot | ModSlot;

/** Total width of a standard ANSI board, in key units. */
export const BOARD_UNITS = 15;

const mod = (id: ModId, label: string, width: number, finger: FingerId | null): Omit<ModSlot, "x"> => ({
  type: "mod",
  id,
  label,
  width,
  finger,
});

/**
 * Lays a layout's character keys onto ANSI physical geometry (modifier keys
 * added around them). Any layout with the same rows (Dvorak, Colemak) works.
 */
export function ansiRows(layout: KeyboardLayout): Slot[][] {
  const chars = (row: number, wide?: Record<string, number>) =>
    (layout.rows[row] ?? []).map(
      (def): Omit<CharSlot, "x"> => ({ type: "char", def, width: wide?.[def.key] ?? def.width ?? 1, finger: fingerOf(def) }),
    );

  const rows: Omit<Slot, "x">[][] = [
    [...chars(0), mod("backspace", "⌫", 2, "r-pinky")],
    [mod("tab", "tab", 1.5, "l-pinky"), ...chars(1, { "\\": 1.5 })],
    [mod("caps", "caps", 1.75, "l-pinky"), ...chars(2), mod("enter", "enter", 2.25, "r-pinky")],
    [mod("shift-l", "shift", 2.25, "l-pinky"), ...chars(3), mod("shift-r", "shift", 2.75, "r-pinky")],
    [
      mod("ctrl-l", "ctrl", 1.25, null),
      mod("win-l", "", 1.25, null),
      mod("alt-l", "alt", 1.25, null),
      ...chars(4, { " ": 6.25 }),
      mod("alt-r", "alt", 1.25, null),
      mod("fn", "fn", 1.25, null),
      mod("ctrl-r", "ctrl", 2.5, null),
    ],
  ];

  return rows.map((row) => {
    let x = 0;
    return row.map((slot) => {
      const placed = { ...slot, x } as Slot;
      x += slot.width;
      return placed;
    });
  });
}

/** Thumb on space: right thumb by convention. */
export const SPACE_FINGER: FingerId = "r-thumb";

/** Center x (key units) of each finger's home key on ANSI QWERTY geometry. */
export function homeCenters(rows: Slot[][]): Partial<Record<FingerId, number>> {
  const out: Partial<Record<FingerId, number>> = {};
  for (const slot of rows[2] ?? []) {
    if (slot.type === "char" && out[slot.finger] === undefined) {
      // First key for each finger on the home row, except index fingers rest on F/J (the bumps).
      if (slot.finger.endsWith("index") && !slot.def.bump) continue;
      out[slot.finger] = slot.x + slot.width / 2;
    }
  }
  out["l-thumb"] = 6.2;
  out["r-thumb"] = 8.8;
  return out;
}
