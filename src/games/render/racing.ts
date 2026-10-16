import type { Container, Graphics, Text } from "pixi.js";
import type { RacingSim } from "../racing";
import { DISPLAY, Particles, type GameRenderer, type RenderCtx } from "./common";

/** Side-on track with one lane per racer; the camera follows you. */
export function renderRacing(ctx: RenderCtx, sim: RacingSim): GameRenderer {
  const { PIXI, app, colors, reducedMotion } = ctx;
  const W = () => app.screen.width;
  const H = () => app.screen.height;

  const stage = new PIXI.Container();
  app.stage.addChild(stage);
  const road = new PIXI.Graphics();
  stage.addChild(road);
  const carsLayer = new PIXI.Container();
  stage.addChild(carsLayer);
  const particles = new Particles(PIXI, stage);

  const laneColors: Record<string, string> = { player: colors.main, bot: colors.sub, ghost: colors.caret };
  const cars = new Map<string, { root: Container; body: Graphics; name: Text }>();
  let scroll = 0;

  function carFor(id: string, kind: string, name: string) {
    let c = cars.get(id);
    if (!c) {
      const root = new PIXI.Container();
      const body = new PIXI.Graphics();
      const color = laneColors[kind] ?? colors.sub;
      // Body, cabin, wheels.
      body.roundRect(-34, -12, 68, 22, 8).fill({ color, alpha: kind === "ghost" ? 0.45 : 1 });
      body.roundRect(-12, -22, 30, 14, 6).fill({ color: colors.bg, alpha: kind === "ghost" ? 0.4 : 0.9 });
      body.circle(-20, 12, 8).fill("#111111").circle(20, 12, 8).fill("#111111");
      body.circle(-20, 12, 3).fill(colors.sub).circle(20, 12, 3).fill(colors.sub);
      const label = new PIXI.Text({
        text: name,
        style: { fontFamily: DISPLAY, fontSize: 12, fill: kind === "player" ? colors.text : colors.sub },
      });
      label.anchor.set(1, 0.5);
      label.position.set(-44, 0);
      root.addChild(body, label);
      carsLayer.addChild(root);
      c = { root, body, name: label };
      cars.set(id, c);
    }
    return c;
  }

  return {
    update(dtMs) {
      const dt = Math.min(0.05, dtMs / 1000);
      const s = sim.state;
      const racers = s.racers;
      const lanes = racers.length;
      const top = 44; // room for the HUD pill
      const laneH = (H() - top - 20) / lanes;
      const startX = 90;
      const trackLen = W() - startX - 70;
      const me = racers.find((r) => r.kind === "player");
      const speed = me ? me.wpm : 0;
      if (!reducedMotion) scroll = (scroll + dt * (40 + speed * 4)) % 60;

      road.clear();
      road.rect(0, top - 10, W(), H() - top).fill({ color: colors.bgAlt, alpha: 0.9 });
      for (let i = 0; i <= lanes; i++) {
        const y = top + i * laneH;
        for (let x = -scroll; x < W(); x += 60) road.rect(x, y - 1, 30, 2).fill({ color: colors.border });
      }
      // Start line and checkered finish.
      road.rect(startX - 2, top, 3, laneH * lanes).fill({ color: colors.sub, alpha: 0.6 });
      const fx = startX + trackLen + 36;
      for (let i = 0; i < Math.ceil((laneH * lanes) / 10); i++) {
        for (let j = 0; j < 2; j++) {
          road.rect(fx + j * 10, top + i * 10, 10, 10).fill((i + j) % 2 ? "#ffffff" : "#111111");
        }
      }

      racers.forEach((r, i) => {
        const c = carFor(r.id, r.kind, r.name);
        const y = top + laneH * (i + 0.5);
        const x = startX + r.progress * trackLen;
        c.root.position.set(x, y);
        // Speed wobble and exhaust for the player.
        if (r.kind === "player" && !reducedMotion && r.finishedAt === null && speed > 0) {
          c.body.y = Math.sin(performance.now() / 60) * 0.8;
          if (Math.random() < 0.5) particles.burst(x - 36, y + 4, { count: 1, colors: [colors.sub], speed: 60, life: 0.4, size: 3, gravity: -20, angle: Math.PI, spread: 0.6 });
        }
      });

      for (const f of sim.drainFx()) {
        const meIdx = racers.findIndex((r) => r.kind === "player");
        const r = me;
        if (!r) continue;
        const y = top + laneH * (meIdx + 0.5);
        const x = startX + r.progress * trackLen;
        if (f.type === "word") particles.burst(x - 30, y, { count: 6, colors: [colors.main, colors.caret], speed: 160, life: 0.35, size: 2.5, gravity: 0, angle: Math.PI, spread: 0.8 });
        else if (f.type === "skid") particles.burst(x - 20, y + 12, { count: 8, colors: [colors.error], speed: 120, life: 0.4, size: 2, gravity: 0 });
        else if (f.type === "finish" && f.racer === "you") particles.burst(fx, y, { count: 80, colors: [colors.gold, colors.main, colors.caret], speed: 380, life: 1.2, size: 4 });
      }
      particles.update(dt);
    },
    destroy() {
      stage.destroy({ children: true });
    },
  };
}
