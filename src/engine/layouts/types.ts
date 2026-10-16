export type Hand = "left" | "right";
export type Finger = "pinky" | "ring" | "middle" | "index" | "thumb";

export interface KeyDef {
  /** Character produced without Shift (" " for space). */
  key: string;
  /** Character produced with Shift. */
  shift?: string;
  /** 0 = number row, 1 = top, 2 = home, 3 = bottom, 4 = space row. */
  row: 0 | 1 | 2 | 3 | 4;
  hand: Hand | "either";
  finger: Finger;
  /** Relative width in key units (1 = normal key). */
  width?: number;
  /** Home-row bump (F and J on QWERTY). */
  bump?: boolean;
}

export interface KeyboardLayout {
  id: string;
  name: string;
  rows: readonly (readonly KeyDef[])[];
  /** Fast lookup: produced char (either case) → key. */
  byChar: ReadonlyMap<string, KeyDef>;
}

export function buildLayout(id: string, name: string, rows: KeyDef[][]): KeyboardLayout {
  const byChar = new Map<string, KeyDef>();
  for (const row of rows) {
    for (const k of row) {
      byChar.set(k.key, k);
      if (k.shift) byChar.set(k.shift, k);
    }
  }
  return { id, name, rows, byChar };
}
