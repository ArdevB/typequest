import type { BossBattleSim, BossState } from "../bossBattle";
import { Floaters, Particles, Shake, easeOutCubic, lerp, type GameRenderer, type RenderCtx } from "./common";

/**
 * A procedural monster: a pulsing body with horns, eyes that track and blink,
 * a glow that builds before its slam, and three phases of color and rage.
 */
export function renderBossBattle(ctx: RenderCtx, sim: BossBattleSim): GameRenderer {
  const { PIXI, app, colors, reducedMotion } = ctx;
  const W = () => app.screen.width;
  const H = () => app.screen.height;

  const stage = new PIXI.Container();
  app.stage.addChild(stage);
  const shake = new Shake(stage, !reducedMotion);
  const bg = new PIXI.Graphics();
  const aura = new PIXI.Graphics();
  aura.blendMode = "add";
  const body = new PIXI.Graphics();
  const bolts = new PIXI.Graphics();
  bolts.blendMode = "add";
  stage.addChild(bg, aura, body, bolts);
  const particles = new Particles(PIXI, stage);
  const floaters = new Floaters(PIXI, stage);
  const vignette = new PIXI.Graphics();
  stage.addChild(vignette);

  let t = 0;
  let hitFlash = 0;
  let recoil = 0;
  let lunge = 0;
  let hurt = 0;
  let dead = 0;
  let blink = 0;
  let projectiles: { p: number; crit: boolean }[] = [];

  const phaseColor = (s: BossState) =>
    s.weekly ? (s.phase === 1 ? "#ff8a3d" : s.phase === 2 ? "#ff5a1f" : "#ff2e63") : s.phase === 1 ? colors.main : s.phase === 2 ? "#ff8a3d" : colors.error;

  return {
    update(dtMs) {
      const dt = Math.min(0.05, dtMs / 1000);
      t += dt;
      const s = sim.state;
      const cx = W() / 2;
      const cy = H() * 0.46;
      const r = Math.min(W(), H()) * 0.2;
      const pc = phaseColor(s);

      for (const fx of sim.drainFx()) {
        if (fx.type === "bossHit") {
          projectiles.push({ p: 0, crit: Boolean(fx.crit) });
        } else if (fx.type === "playerHit") {
          lunge = 1;
          hurt = 1;
          shake.kick(fx.kind === "slam" ? 16 : 7);
          floaters.add(`-${fx.damage as number}`, W() * 0.5, H() * 0.88, colors.error, 26);
        } else if (fx.type === "phase") {
          shake.kick(12);
          particles.burst(cx, cy, { count: 80, colors: [pc, colors.gold], speed: 420, life: 1.1, size: 4, gravity: 0 });
          floaters.add(fx.phase === 3 ? "ENRAGED!" : "IT'S ANGRY", cx, cy - r * 1.4, pc, 30);
        } else if (fx.type === "bossDefeated") {
          dead = 0.001;
          particles.burst(cx, cy, { count: 220, colors: [pc, colors.gold, colors.caret, "#ffffff"], speed: 620, life: 1.8, size: 5, gravity: 120 });
          shake.kick(24);
        }
      }

      // Projectiles from the player (bottom) to the boss.
      bolts.clear();
      projectiles = projectiles.filter((pr) => {
        pr.p += dt * 4.5;
        const sx = cx;
        const sy = H() - 20;
        const x = lerp(sx, cx + Math.sin(pr.p * 6) * 20, pr.p);
        const y = lerp(sy, cy, easeOutCubic(pr.p));
        const col = pr.crit ? colors.gold : colors.caret;
        bolts.circle(x, y, pr.crit ? 12 : 8).fill({ color: col, alpha: 0.9 });
        bolts.circle(x, y + 16, pr.crit ? 7 : 5).fill({ color: col, alpha: 0.4 });
        if (pr.p >= 1) {
          hitFlash = 1;
          recoil = pr.crit ? 1.4 : 1;
          shake.kick(pr.crit ? 9 : 4);
          particles.burst(cx + (Math.random() - 0.5) * r, cy + r * 0.3, {
            count: pr.crit ? 40 : 18,
            colors: [col, "#ffffff"],
            speed: pr.crit ? 420 : 260,
            life: 0.6,
            size: 3,
          });
          return false;
        }
        return true;
      });

      // Background: arena floor and lights.
      bg.clear();
      bg.rect(0, H() * 0.78, W(), H() * 0.22).fill({ color: colors.bgAlt, alpha: 0.85 });
      for (let i = 0; i < 9; i++) {
        const x = (i / 8) * W();
        bg.moveTo(cx, H() * 0.78).lineTo(x, H()).stroke({ width: 1, color: colors.border, alpha: 0.7 });
      }

      // Boss body.
      if (dead > 0) dead = Math.min(1, dead + dt * 0.8);
      const breathe = reducedMotion ? 0 : Math.sin(t * 2.2) * 0.04;
      recoil *= Math.pow(0.002, dt);
      lunge *= Math.pow(0.004, dt);
      hitFlash *= Math.pow(0.0005, dt);
      hurt *= Math.pow(0.01, dt);
      const scale = (1 + breathe + lunge * 0.18 - recoil * 0.06) * (1 - dead);
      const by = cy - recoil * 18 + lunge * 30;
      const shakeX = s.phase === 3 && !reducedMotion ? Math.sin(t * 40) * 1.5 : 0;

      aura.clear();
      const glow = 0.15 + s.charge * 0.6;
      aura.circle(cx, by, r * (1.25 + s.charge * 0.35) * scale).fill({ color: pc, alpha: glow * 0.35 * (1 - dead) });

      body.clear();
      if (scale > 0.01) {
        const R = r * scale;
        const fill = hitFlash > 0.3 ? "#ffffff" : colors.bgAlt;
        // Horns
        body.poly([cx - R * 0.55 + shakeX, by - R * 0.7, cx - R * 0.9 + shakeX, by - R * 1.45, cx - R * 0.25 + shakeX, by - R * 0.9]).fill(pc);
        body.poly([cx + R * 0.55 + shakeX, by - R * 0.7, cx + R * 0.9 + shakeX, by - R * 1.45, cx + R * 0.25 + shakeX, by - R * 0.9]).fill(pc);
        // The Weekly Boss wears a crown of extra horns.
        if (s.weekly) {
          for (const k of [-0.32, 0, 0.32]) {
            const hx = cx + shakeX + k * R * 1.4;
            body.poly([hx - R * 0.13, by - R * 0.82, hx, by - R * (k === 0 ? 1.6 : 1.3), hx + R * 0.13, by - R * 0.82]).fill(colors.gold);
          }
        }
        // Body
        body.ellipse(cx + shakeX, by, R, R * 0.92).fill(fill).stroke({ width: s.weekly ? 7 : 5, color: pc });
        // Eyes (blink now and then; track the incoming shot)
        blink = (blink + dt) % 4;
        const eyeH = blink > 3.85 ? 2 : R * 0.16;
        const look = projectiles.length ? 0.06 : 0;
        for (const side of s.weekly ? [-1, 0, 1] : [-1, 1]) {
          const ex = cx + shakeX + side * R * 0.36;
          const ey = by - R * (side === 0 ? 0.42 : 0.18);
          body.ellipse(ex, ey, R * 0.15, eyeH).fill(s.phase === 3 ? colors.error : colors.gold);
          body.circle(ex, ey + R * look, Math.min(eyeH, R * 0.06)).fill("#000000");
        }
        // Mouth: opens as the slam charges.
        const open = R * (0.05 + s.charge * 0.25);
        body.roundRect(cx + shakeX - R * 0.4, by + R * 0.28, R * 0.8, open, 6).fill("#000000");
        for (let i = 0; i < 5; i++) {
          const tx = cx + shakeX - R * 0.36 + i * R * 0.18;
          body.poly([tx, by + R * 0.28, tx + R * 0.07, by + R * 0.28, tx + R * 0.035, by + R * 0.28 + R * 0.08]).fill("#ffffff");
        }
      }

      // Red vignette when the player gets hit.
      vignette.clear();
      if (hurt > 0.02) {
        vignette.rect(0, 0, W(), H()).stroke({ width: 60 * hurt, color: colors.error, alpha: 0.5 * hurt });
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
