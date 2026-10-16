import { buildLayout, type Finger, type Hand, type KeyDef } from "./types";

const k = (
  key: string,
  shift: string | undefined,
  row: KeyDef["row"],
  hand: Hand,
  finger: Finger,
  extra: Partial<KeyDef> = {},
): KeyDef => ({ key, shift, row, hand, finger, ...extra });

const L = "left" as const;
const R = "right" as const;

export const QWERTY = buildLayout("qwerty", "QWERTY", [
  [
    k("`", "~", 0, L, "pinky"),
    k("1", "!", 0, L, "pinky"),
    k("2", "@", 0, L, "ring"),
    k("3", "#", 0, L, "middle"),
    k("4", "$", 0, L, "index"),
    k("5", "%", 0, L, "index"),
    k("6", "^", 0, R, "index"),
    k("7", "&", 0, R, "index"),
    k("8", "*", 0, R, "middle"),
    k("9", "(", 0, R, "ring"),
    k("0", ")", 0, R, "pinky"),
    k("-", "_", 0, R, "pinky"),
    k("=", "+", 0, R, "pinky"),
  ],
  [
    k("q", "Q", 1, L, "pinky"),
    k("w", "W", 1, L, "ring"),
    k("e", "E", 1, L, "middle"),
    k("r", "R", 1, L, "index"),
    k("t", "T", 1, L, "index"),
    k("y", "Y", 1, R, "index"),
    k("u", "U", 1, R, "index"),
    k("i", "I", 1, R, "middle"),
    k("o", "O", 1, R, "ring"),
    k("p", "P", 1, R, "pinky"),
    k("[", "{", 1, R, "pinky"),
    k("]", "}", 1, R, "pinky"),
    k("\\", "|", 1, R, "pinky"),
  ],
  [
    k("a", "A", 2, L, "pinky"),
    k("s", "S", 2, L, "ring"),
    k("d", "D", 2, L, "middle"),
    k("f", "F", 2, L, "index", { bump: true }),
    k("g", "G", 2, L, "index"),
    k("h", "H", 2, R, "index"),
    k("j", "J", 2, R, "index", { bump: true }),
    k("k", "K", 2, R, "middle"),
    k("l", "L", 2, R, "ring"),
    k(";", ":", 2, R, "pinky"),
    k("'", '"', 2, R, "pinky"),
  ],
  [
    k("z", "Z", 3, L, "pinky"),
    k("x", "X", 3, L, "ring"),
    k("c", "C", 3, L, "middle"),
    k("v", "V", 3, L, "index"),
    k("b", "B", 3, L, "index"),
    k("n", "N", 3, R, "index"),
    k("m", "M", 3, R, "index"),
    k(",", "<", 3, R, "middle"),
    k(".", ">", 3, R, "ring"),
    k("/", "?", 3, R, "pinky"),
  ],
  [{ key: " ", row: 4, hand: "either", finger: "thumb", width: 6 }],
]);
