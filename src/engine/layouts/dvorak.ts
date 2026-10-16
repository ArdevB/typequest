import { remapLayout } from "./remap";

/** Dvorak Simplified Keyboard (US). Home row: aoeu idhtns. */
export const DVORAK = remapLayout("dvorak", "Dvorak", [
  ["`1234567890[]", "~!@#$%^&*(){}"],
  ["',.pyfgcrl/=\\", '"<>PYFGCRL?+|'],
  ["aoeuidhtns-", "AOEUIDHTNS_"],
  [";qjkxbmwvz", ":QJKXBMWVZ"],
]);
