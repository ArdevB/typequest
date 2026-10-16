import type { ThemePlugin } from "../types";
import { spaceShooterConfig } from "./config";
import { createSpaceEffects } from "./effects";

export const spaceShooter: ThemePlugin = { config: spaceShooterConfig, createEffects: createSpaceEffects };
