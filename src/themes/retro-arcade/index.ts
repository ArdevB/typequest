import type { ThemePlugin } from "../types";
import { retroArcadeConfig } from "./config";
import { createRetroEffects } from "./effects";

export const retroArcade: ThemePlugin = { config: retroArcadeConfig, createEffects: createRetroEffects };
