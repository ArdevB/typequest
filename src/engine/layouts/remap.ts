import { QWERTY } from "./qwerty";
import { buildLayout, type KeyboardLayout, type KeyDef } from "./types";

/**
 * Builds a layout that puts different characters on QWERTY's physical keys.
 * Fingers, hands, rows and widths come from the physical position, so the
 * finger guide and hands work the same for every layout. Each row is given as
 * [unshifted, shifted] strings, one character per key (space row is kept).
 */
export function remapLayout(id: string, name: string, rows: readonly (readonly [string, string])[]): KeyboardLayout {
  const out: KeyDef[][] = QWERTY.rows.map((row, r) => {
    const spec = rows[r];
    if (!spec) return row.map((k) => ({ ...k }));
    const [plain, shifted] = spec;
    if ([...plain].length !== row.length || [...shifted].length !== row.length) {
      throw new Error(`${id}: row ${r} needs ${row.length} keys`);
    }
    const p = [...plain];
    const s = [...shifted];
    return row.map((k, i) => ({ ...k, key: p[i]!, shift: s[i] }));
  });
  return buildLayout(id, name, out);
}
