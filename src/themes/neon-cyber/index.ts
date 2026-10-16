import type { ThemePlugin } from "../types";
import { neonCyberConfig } from "./config";
import { createNeonEffects } from "./effects";

export const neonCyber: ThemePlugin = { config: neonCyberConfig, createEffects: createNeonEffects };
