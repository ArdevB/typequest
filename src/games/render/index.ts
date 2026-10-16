import type { BossBattleSim } from "../bossBattle";
import type { DuelSim } from "../duel";
import type { FallingWordsSim } from "../fallingWords";
import type { RacingSim } from "../racing";
import type { AnySim } from "../registry";
import type { GameId } from "../types";
import { renderBossBattle } from "./bossBattle";
import type { GameRenderer, RenderCtx } from "./common";
import { renderDuel } from "./duel";
import { renderFallingWords } from "./fallingWords";
import { renderRacing } from "./racing";

export { readColors } from "./common";
export type { GameRenderer, RenderCtx } from "./common";

/** Picks the Pixi renderer for a game. Loaded lazily together with pixi.js. */
export function createRenderer(id: GameId, ctx: RenderCtx, sim: AnySim): GameRenderer {
  switch (id) {
    case "falling-words":
      return renderFallingWords(ctx, sim as unknown as FallingWordsSim);
    case "boss-battle":
    case "weekly-boss":
      return renderBossBattle(ctx, sim as unknown as BossBattleSim);
    case "racing":
      return renderRacing(ctx, sim as unknown as RacingSim);
    case "stickman-duel":
      return renderDuel(ctx, sim as unknown as DuelSim);
  }
}
