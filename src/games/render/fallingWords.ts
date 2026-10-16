import type { Container, Graphics } from "pixi.js";
import type { FallingState, FallingWordsSim } from "../fallingWords";
import { Floaters, Particles, Shake, WordLabel, type GameRenderer, type RenderCtx } from "./common";

const GROUND = 70;

/** Space-shooter look: a starfield, a turret firing lasers at the word being typed, explosions. */
export function renderFallingWords(ctx: RenderCtx, sim: FallingWordsSim): GameRenderer {
  const { PIXI, app, colors, reducedMotion } = ctx;
  const W = () => app.screen.width;
  const H = () => app.screen.height;

  const stage = new PIXI.Container();
  app.stage.addChild(stage);
  const shake = new Shake(stage, !reducedMotion);

  // Starfield (three depths).
  const stars = new PIXI.Graphics();
  stage.addChild(stars);
  const starList = Array.from({ length: 120 }, () => ({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7 }));

  // Ground and turret.
  const ground = new PIXI.Graphics();
  stage.addChild(ground);
  const lasers = new PIXI.Graphics();
  lasers.blendMode = "add";
  stage.addChild(lasers);
  const wordsLayer = new PIXI.Container();
  stage.addChild(wordsLayer);
  const turret = new PIXI.Graphics();
  stage.addChild(turret);
  const particles = new Particles(PIXI, stage);
  const floaters = new Floaters(PIXI, stage);
  const flash = new PIXI.Graphics();
  stage.addChild(flash);
  let flashAlpha = 0;
  let lastLevel = 1;

  const labels = new Map<number, { label: WordLabel; box: Graphics; root: Container }>();
  let laserList: { x: number; y: number; life: number }[] = [];
  let turretAngle = -Math.PI / 2;

  const pos = (x: number, y: number) => ({ px: x * W(), py: 30 + y * (H() - GROUND - 30) });

  function labelFor(index: number, text: string) {
    let l = labels.get(index);
    if (!l) {
      const root = new PIXI.Container();
      const box = new PIXI.Graphics();
      const label = new WordLabel(PIXI, text, { size: 22, typed: colors.caret, rest: colors.text });
      root.addChild(box, label.root);
      wordsLayer.addChild(root);
      l = { label, box, root };
      labels.set(index, l);
    }
    return l;
  }

  function drawStatic(dt: number) {
    stars.clear();
    for (const s of starList) {
      if (!reducedMotion) s.y += dt * 0.02 * s.z;
      if (s.y > 1) s.y -= 1;
      stars.circle(s.x * W(), s.y * H(), s.z * 1.6).fill({ color: colors.text, alpha: 0.2 + s.z * 0.5 });
    }
    ground.clear();
    const gy = H() - GROUND;
    ground.rect(0, gy, W(), GROUND).fill({ color: colors.bgAlt, alpha: 0.9 });
    ground.moveTo(0, gy).lineTo(W(), gy).stroke({ width: 3, color: colors.main, alpha: 0.9 });
    for (let i = 0; i < 18; i++) {
      const bx = (i / 18) * W();
      const bh = 12 + ((i * 37) % 30);
      ground.rect(bx + 4, gy - bh, W() / 18 - 8, bh).fill({ color: colors.border, alpha: 0.8 });
    }
  }

  function drawTurret(target: { px: number; py: number } | null) {
    const cx = W() / 2;
    const cy = H() - GROUND + 6;
    if (target) {
      const want = Math.atan2(target.py - cy, target.px - cx);
      turretAngle += (want - turretAngle) * 0.25;
    }
    turret.clear();
    turret.circle(cx, cy, 26).fill({ color: colors.bgAlt }).stroke({ width: 3, color: colors.caret });
    const len = 38;
    turret
      .moveTo(cx, cy)
      .lineTo(cx + Math.cos(turretAngle) * len, cy + Math.sin(turretAngle) * len)
      .stroke({ width: 8, color: colors.caret, cap: "round" });
  }

  return {
    update(dtMs) {
      const dt = Math.min(0.05, dtMs / 1000);
      const s: FallingState = sim.state;
      const active = sim.engine.getSnapshot().wordIndex;
      drawStatic(dt);

      let activePos: { px: number; py: number } | null = null;
      for (const w of s.words) {
        const l = labels.get(w.index);
        if (w.state !== "falling") {
          if (l) {
            l.root.destroy({ children: true });
            labels.delete(w.index);
          }
          continue;
        }
        const { label, box, root } = labelFor(w.index, w.text);
        const { px, py } = pos(w.x, w.y);
        root.position.set(px, py);
        const isActive = w.index === active;
        label.setTyped(isActive ? sim.engine.getTyped(active).length : 0);
        box.clear();
        const bw = label.width + 18;
        box
          .roundRect(-bw / 2, -4, bw, 34, 8)
          .fill({ color: colors.bg, alpha: 0.75 })
          .stroke({ width: isActive ? 2.5 : 1, color: isActive ? colors.caret : colors.border });
        // Danger tint as words near the ground.
        root.alpha = 1;
        if (w.y > 0.75) box.stroke({ width: 2, color: colors.error, alpha: (w.y - 0.75) * 4 });
        if (isActive) activePos = { px, py: py + 14 };
      }
      drawTurret(activePos);

      for (const fx of sim.drainFx()) {
        if (fx.type === "shot" && activePos) {
          laserList.push({ x: activePos.px, y: activePos.py, life: 0.12 });
          ctx.sfx?.("laser", { volume: 0.35, rate: 0.9 + Math.random() * 0.25 });
          particles.burst(activePos.px, activePos.py, { count: 4, colors: [colors.caret], speed: 120, life: 0.25, size: 2, gravity: 0 });
        } else if (fx.type === "destroy") {
          const { px, py } = pos(fx.x as number, fx.y as number);
          particles.burst(px, py + 14, { count: reducedMotion ? 12 : 40, colors: [colors.main, colors.caret, colors.gold], speed: 320, life: 0.8, size: 3.5 });
          floaters.add(`+${fx.points as number}`, px, py, colors.gold);
          shake.kick(3);
          ctx.sfx?.("explode", { volume: 0.55, rate: 1.1 + Math.random() * 0.2 });
          const lvl = sim.state.level;
          if (lvl > lastLevel) {
            lastLevel = lvl;
            ctx.sfx?.("levelup", { volume: 0.7 });
            floaters.add(`LEVEL ${lvl}`, W() / 2, H() * 0.4, colors.main, 34);
          }
        } else if (fx.type === "crash") {
          const { px } = pos(fx.x as number, 1);
          particles.burst(px, H() - GROUND, { count: 50, colors: [colors.error, colors.gold], speed: 380, life: 0.9, size: 4, spread: Math.PI, angle: -Math.PI / 2 });
          shake.kick(10);
          flashAlpha = 0.35;
          ctx.sfx?.("crash");
        } else if (fx.type === "miss") {
          shake.kick(1.5);
        }
      }

      lasers.clear();
      const cx = W() / 2;
      const cy = H() - GROUND + 6;
      laserList = laserList.filter((l) => (l.life -= dt) > 0);
      for (const l of laserList) {
        lasers.moveTo(cx, cy).lineTo(l.x, l.y).stroke({ width: 3, color: colors.caret, alpha: l.life / 0.12 });
      }

      flash.clear();
      if (flashAlpha > 0.01) {
        flash.rect(0, 0, W(), H()).fill({ color: colors.error, alpha: flashAlpha });
        flashAlpha *= 0.85;
      }

      particles.update(dt);
      floaters.update(dt);
      shake.update(dt);
    },
    destroy() {
      stage.destroy({ children: true });
    },
  };
}
