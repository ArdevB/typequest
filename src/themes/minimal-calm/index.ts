import type { ThemePlugin } from "../types";
import { minimalCalmConfig } from "./config";
import { createCalmEffects } from "./effects";

export const minimalCalm: ThemePlugin = { config: minimalCalmConfig, createEffects: createCalmEffects };
