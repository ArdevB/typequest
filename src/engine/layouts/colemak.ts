import { remapLayout } from "./remap";

/** Colemak. Home row: arst dhneio. */
export const COLEMAK = remapLayout("colemak", "Colemak", [
  ["`1234567890-=", "~!@#$%^&*()_+"],
  ["qwfpgjluy;[]\\", "QWFPGJLUY:{}|"],
  ["arstdhneio'", 'ARSTDHNEIO"'],
  ["zxcvbkm,./", "ZXCVBKM<>?"],
]);
