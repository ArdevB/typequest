import type { ThemePlugin } from "../types";
import { infernoConfig } from "./config";
import { createInfernoEffects } from "./effects";

export const inferno: ThemePlugin = { config: infernoConfig, createEffects: createInfernoEffects };
