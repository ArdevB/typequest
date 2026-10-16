import type { Graphics, Text } from "pixi.js";
import type { DuelMove, DuelSim } from "../duel";
import { DISPLAY, Particles, easeInOut, easeOutCubic, lerp, type GameRenderer, type RenderCtx } from "./common";

// ---------------------------------------------------------------------------
// Stick figure rig. Angles are radians measured from "straight down",
// positive = toward the way the fighter faces.
// ---------------------------------------------------------------------------

interface Pose {
  lean: number;
  hipX: number;
  hipY: number;
  rot: number;
  head: number;
  armF: [number, number];
  armB: [number, number];
  legF: [number, number];
  legB: [number, number];
}

const d = (deg: number) => (deg * Math.PI) / 180;
const P = (p: Partial<Pose>): Pose => ({ ...IDLE, ...p });

const IDLE: Pose = {
  lean: d(8),
  hipX: 0,
  hipY: 0,
  rot: 0,
  head: 0,
  armF: [d(55), d(75)],
  armB: [d(25), d(95)],
  legF: [d(18), d(-12)],
  legB: [d(-18), d(-8)],
};

const POSES = {
  idle: IDLE,
  windup: P({ lean: d(-4), hipX: -6, armF: [d(10), d(120)], armB: [d(-20), d(90)] }),
  jab: P({ lean: d(18), hipX: 10, armF: [d(92), d(0)], armB: [d(35), d(100)], legF: [d(28), d(-8)] }),
  kickChamber: P({ lean: d(-10), hipY: -4, legF: [d(80), d(-110)], armF: [d(50), d(60)], armB: [d(-30), d(60)] }),
  kick: P({ lean: d(-24), hipX: 4, legF: [d(98), d(0)], legB: [d(-8), d(-4)], armF: [d(40), d(50)], armB: [d(-55), d(40)] }),
  crouch: P({ lean: d(20), hipY: 14, legF: [d(40), d(-70)], legB: [d(-30), d(-60)], armF: [d(20), d(140)], armB: [d(10), d(110)] }),
  uppercut: P({ lean: d(4), hipY: -8, hipX: 10, armF: [d(168), d(10)], armB: [d(-20), d(70)], legF: [d(12), d(-4)], legB: [d(-28), d(-6)] }),
  spinKick: P({ lean: d(-30), hipY: -10, legF: [d(100), d(0)], legB: [d(-5), d(-10)], armF: [d(100), d(10)], armB: [d(-100), d(10)] }),
  hit: P({ lean: d(-28), hipX: -14, head: d(-25), armF: [d(15), d(40)], armB: [d(-25), d(30)], legF: [d(25), d(-20)], legB: [d(-12), d(-6)] }),
  bigHit: P({ lean: d(-45), hipX: -30, hipY: -6, head: d(-40), armF: [d(-30), d(20)], armB: [d(-60), d(10)], legF: [d(45), d(-10)], legB: [d(10), d(-5)] }),
  ko: P({ rot: d(-88), lean: d(-10), hipX: -60, hipY: 28, head: d(-20), armF: [d(150), d(10)], armB: [d(-160), d(10)], legF: [d(15), d(-5)], legB: [d(-10), d(-5)] }),
  victory: P({ lean: d(0), armF: [d(165), d(15)], armB: [d(-165), d(-15)], legF: [d(14), d(-4)], legB: [d(-14), d(-4)] }),
} satisfies Record<string, Pose>;

const lerpPose = (a: Pose, b: Pose, t: number): Pose => ({
  lean: lerp(a.lean, b.lean, t),
  hipX: lerp(a.hipX, b.hipX, t),
  hipY: lerp(a.hipY, b.hipY, t),
  rot: lerp(a.rot, b.rot, t),
  head: lerp(a.head, b.head, t),
  armF: [lerp(a.armF[0], b.armF[0], t), lerp(a.armF[1], b.armF[1], t)],
  armB: [lerp(a.armB[0], b.armB[0], t), lerp(a.armB[1], b.armB[1], t)],
  legF: [lerp(a.legF[0], b.legF[0], t), lerp(a.legF[1], b.legF[1], t)],
  legB: [lerp(a.legB[0], b.legB[0], t), lerp(a.legB[1], b.legB[1], t)],
});

interface Segment {
  pose: Pose;
  dur: number;
  ease?: (t: number) => number;
  /** Extra forward travel (px) reached by the end of this segment. */
  dash?: number;
  /** Fired when the segment ends (e.g. the moment of impact). */
  onEnd?: () => void;
}

interface Bones {
  hip: [number, number];
  chest: [number, number];
  head: [number, number];
  elbowF: [number, number];
  handF: [number, number];
  elbowB: [number, number];
  handB: [number, number];
  kneeF: [number, number];
  footF: [number, number];
  kneeB: [number, number];
  footB: [number, number];
}

class Fighter {
  pose: Pose = IDLE;
  private from: Pose = IDLE;
  private queue: Segment[] = [];
  private seg: Segment | null = null;
  private segT = 0;
  dash = 0;
  private dashFrom = 0;
  trail: Bones[] = [];
  down = false;

  constructor(
    readonly facing: 1 | -1,
    readonly color: string,
  ) {}

  play(segs: Segment[], interrupt = true): void {
    if (this.down) return;
    if (interrupt) {
      this.queue = [];
      this.seg = null;
    }
    this.queue.push(...segs);
  }

  get busy(): boolean {
    return this.seg !== null || this.queue.length > 0;
  }

  update(dt: number, time: number): void {
    if (!this.seg && this.queue.length) {
      this.seg = this.queue.shift()!;
      this.from = this.pose;
      this.dashFrom = this.dash;
      this.segT = 0;
    }
    if (this.seg) {
      this.segT += dt;
      const k = Math.min(1, this.segT / this.seg.dur);
      const e = (this.seg.ease ?? easeInOut)(k);
      this.pose = lerpPose(this.from, this.seg.pose, e);
      this.dash = lerp(this.dashFrom, this.seg.dash ?? 0, e);
      if (k >= 1) {
        const done = this.seg;
        this.seg = null;
        done.onEnd?.();
        if (!this.queue.length && !this.down) this.queue.push({ pose: IDLE, dur: 0.28, dash: 0 });
      }
    } else if (!this.down) {
      // Idle bounce.
      const b = Math.sin(time * 5) * 2;
      this.pose = { ...IDLE, hipY: b };
    }
  }

  bones(baseX: number, floorY: number, s: number): Bones {
    const p = this.pose;
    const f = this.facing;
    const dir = (a: number, len: number): [number, number] => [Math.sin(a) * f * len * s, Math.cos(a) * len * s];
    const add = (a: [number, number], b: [number, number]): [number, number] => [a[0] + b[0], a[1] + b[1]];
    const legLen = 60;
    const hip: [number, number] = [baseX + (p.hipX + this.dash) * f * s, floorY - legLen * s + p.hipY * s];
    const chest = add(hip, [Math.sin(p.lean) * f * 46 * s, -Math.cos(p.lean) * 46 * s]);
    const head = add(chest, [Math.sin(p.lean + p.head) * f * 16 * s, -Math.cos(p.lean + p.head) * 16 * s]);
    const elbowF = add(chest, dir(p.armF[0], 25));
    const handF = add(elbowF, dir(p.armF[0] + p.armF[1], 24));
    const elbowB = add(chest, dir(p.armB[0], 25));
    const handB = add(elbowB, dir(p.armB[0] + p.armB[1], 24));
    const kneeF = add(hip, dir(p.legF[0], 31));
    const footF = add(kneeF, dir(p.legF[0] + p.legF[1], 31));
    const kneeB = add(hip, dir(p.legB[0], 31));
    const footB = add(kneeB, dir(p.legB[0] + p.legB[1], 31));
    const b: Bones = { hip, chest, head, elbowF, handF, elbowB, handB, kneeF, footF, kneeB, footB };
    if (p.rot !== 0) {
      // Rotate the whole figure about the hip (spins and falls).
      const [cx, cy] = hip;
      const r = p.rot * f;
      const cos = Math.cos(r);
      const sin = Math.sin(r);
      for (const k of Object.keys(b) as (keyof Bones)[]) {
        const [x, y] = b[k];
        b[k] = [cx + (x - cx) * cos - (y - cy) * sin, cy + (x - cx) * sin + (y - cy) * cos];
      }
    }
    return b;
  }
}

function drawFighter(g: Graphics, b: Bones, color: string, s: number, alpha = 1): void {
  const line = (a: [number, number], c: [number, number], w: number) =>
    g.moveTo(a[0], a[1]).lineTo(c[0], c[1]).stroke({ width: w * s, color, alpha, cap: "round", join: "round" });
  line(b.hip, b.kneeB, 7);
  line(b.kneeB, b.footB, 7);
  line(b.chest, b.elbowB, 6);
  line(b.elbowB, b.handB, 6);
  line(b.hip, b.chest, 8);
  line(b.hip, b.kneeF, 7);
  line(b.kneeF, b.footF, 7);
  line(b.chest, b.elbowF, 6);
  line(b.elbowF, b.handF, 6);
  g.circle(b.head[0], b.head[1], 11 * s).fill({ color, alpha });
}

// Move choreography: segments for the attacker. `impact` fires at the hit.
function attackSegments(move: DuelMove, impact: () => void, finisher: boolean): Segment[] {
  switch (move) {
    case "jab":
      return [
        { pose: POSES.windup, dur: 0.06, dash: 8 },
        { pose: POSES.jab, dur: 0.08, dash: 40, ease: easeOutCubic, onEnd: impact },
        { pose: POSES.jab, dur: 0.07, dash: 40 },
      ];
    case "kick":
      return [
        { pose: POSES.kickChamber, dur: 0.1, dash: 18 },
        { pose: POSES.kick, dur: 0.09, dash: 36, ease: easeOutCubic, onEnd: impact },
        { pose: POSES.kick, dur: 0.1, dash: 36 },
      ];
    case "uppercut":
      return [
        { pose: POSES.crouch, dur: 0.12, dash: 30 },
        { pose: POSES.uppercut, dur: 0.1, dash: 46, ease: easeOutCubic, onEnd: impact },
        { pose: POSES.uppercut, dur: 0.12, dash: 46 },
      ];
    case "spin":
    case "finisher":
      return [
        { pose: P({ ...POSES.kickChamber, rot: d(-40) }), dur: finisher ? 0.16 : 0.1, dash: 20 },
        { pose: P({ ...POSES.spinKick, rot: d(-200) }), dur: 0.12, dash: 40 },
        { pose: P({ ...POSES.spinKick, rot: d(-360) }), dur: 0.1, dash: 50, ease: easeOutCubic, onEnd: impact },
        { pose: P({ ...POSES.spinKick, rot: d(-360) }), dur: finisher ? 0.3 : 0.12, dash: 50 },
      ];
  }
}

/**
 * Stickman Duel, filmed like a fight scene: letterbox bars, a camera that
 * pushes in on big hits, slow motion on specials and the finisher, motion
 * trails, impact flashes, sparks and dust.
 */
export function renderDuel(ctx: RenderCtx, sim: DuelSim): GameRenderer {
  const { PIXI, app, colors, reducedMotion } = ctx;
  const W = () => app.screen.width;
  const H = () => app.screen.height;

  const world = new PIXI.Container();
  app.stage.addChild(world);
  const backdrop = new PIXI.Graphics();
  const shadows = new PIXI.Graphics();
  const trails = new PIXI.Graphics();
  const figures = new PIXI.Graphics();
  world.addChild(backdrop, shadows, trails, figures);
  const particles = new Particles(PIXI, world);

  const overlay = new PIXI.Container();
  app.stage.addChild(overlay);
  const flash = new PIXI.Graphics();
  const bars = new PIXI.Graphics();
  overlay.addChild(flash, bars);
  const title = new PIXI.Text({
    text: "ROUND 1",
    style: { fontFamily: DISPLAY, fontSize: 64, fontWeight: "900", fill: colors.text, stroke: { color: "#000000", width: 6 }, letterSpacing: 6 },
  }) as Text;
  title.anchor.set(0.5);
  overlay.addChild(title);
  const subtitle = new PIXI.Text({
    text: "type to fight",
    style: { fontFamily: DISPLAY, fontSize: 18, fill: colors.sub, letterSpacing: 4 },
  }) as Text;
  subtitle.anchor.set(0.5);
  overlay.addChild(subtitle);

  const player = new Fighter(1, colors.caret);
  const rival = new Fighter(-1, "#ff8a3d");

  let time = 0;
  let slow = 1; // time scale for animation (slow motion)
  let slowFor = 0;
  let flashA = 0;
  let barH = 0.12; // letterbox, fraction of height
  let barTarget = 0.12;
  const cam = { zoom: 1, x: 0.5, y: 0.6, tz: 1, tx: 0.5, ty: 0.6, hold: 0 };
  let shakeAmt = 0;
  let titleT = 0;
  let titleText = "ROUND 1";
  let fought = false;
  let pendingKo: { in: number; win: boolean } | null = null;

  const floorY = () => H() * 0.78;
  const scale = () => Math.min(W(), H() * 1.6) / 520;
  const baseX = (f: Fighter) => W() * (f.facing === 1 ? 0.36 : 0.64);

  const showTitle = (text: string, sub = "") => {
    titleText = text;
    title.text = text;
    subtitle.text = sub;
    titleT = 0.0001;
  };

  const impactAt = (attacker: Fighter, big: boolean, finisher: boolean) => {
    const target = attacker === player ? rival : player;
    const s = scale();
    const tb = target.bones(baseX(target), floorY(), s);
    const hx = tb.chest[0];
    const hy = (tb.chest[1] + tb.head[1]) / 2;
    particles.burst(hx, hy, {
      count: finisher ? 120 : big ? 50 : 22,
      colors: [attacker.color, "#ffffff", colors.gold],
      speed: finisher ? 700 : big ? 480 : 300,
      life: finisher ? 1.2 : 0.5,
      size: finisher ? 5 : 3,
      gravity: 400,
    });
    particles.burst(tb.footF[0], floorY(), { count: 10, colors: [colors.sub], speed: 120, life: 0.6, size: 4, gravity: -40, spread: Math.PI, angle: -Math.PI / 2 });
    shakeAmt = Math.max(shakeAmt, finisher ? 26 : big ? 12 : 5);
    flashA = finisher ? 0.9 : big ? 0.35 : 0.12;
    if (finisher) {
      // The money shot: slow motion starts on contact and the KO title waits until they land.
      slowMo(0.25, 1.1);
      pendingKo = { in: reducedMotion ? 0.3 : 1.5, win: attacker === player };
      target.down = false;
      target.play([
        { pose: POSES.bigHit, dur: 0.25, dash: -40, ease: easeOutCubic },
        { pose: POSES.ko, dur: 0.7, dash: -90, ease: easeOutCubic },
      ]);
      target.down = true;
    } else {
      target.play([{ pose: big ? POSES.bigHit : POSES.hit, dur: big ? 0.14 : 0.09, dash: big ? -30 : -12, ease: easeOutCubic }, { pose: IDLE, dur: 0.25, dash: 0 }]);
    }
  };

  const slowMo = (factor: number, seconds: number) => {
    if (reducedMotion) return;
    slow = factor;
    slowFor = seconds;
  };

  const pushIn = (zoom: number, x: number, y: number, hold: number) => {
    if (reducedMotion) return;
    cam.tz = zoom;
    cam.tx = x / W();
    cam.ty = y / H();
    cam.hold = hold;
  };

  return {
    update(dtMs) {
      const realDt = Math.min(0.05, dtMs / 1000);
      if (slowFor > 0) {
        slowFor -= realDt;
        if (slowFor <= 0) slow = 1;
      }
      const dt = realDt * slow;
      time += dt;
      const s = scale();
      const st = sim.state;

      if (st.stage === "fight" && !fought) {
        fought = true;
        showTitle("FIGHT!");
        barTarget = 0.07;
      }

      for (const fx of sim.drainFx()) {
        if (fx.type === "playerAttack") {
          const move = fx.move as DuelMove;
          const finisher = move === "finisher";
          const big = move === "spin" || move === "uppercut" || finisher;
          if (move === "spin") {
            slowMo(0.35, 0.35);
            pushIn(1.25, (baseX(player) + baseX(rival)) / 2, floorY() - 90 * s, 0.5);
          }
          if (finisher) {
            pushIn(1.5, baseX(rival), floorY() - 100 * s, 3.2);
            barTarget = 0.16;
          }
          player.play(attackSegments(move, () => impactAt(player, big, finisher), finisher));
        } else if (fx.type === "rivalAttack") {
          const finisher = Boolean(fx.finisher);
          const move: DuelMove = finisher ? "finisher" : fx.kind === "attack" ? (Math.random() < 0.5 ? "kick" : "uppercut") : "jab";
          if (finisher) {
            pushIn(1.5, baseX(player), floorY() - 100 * s, 3.2);
            barTarget = 0.16;
          }
          rival.play(attackSegments(move, () => impactAt(rival, move !== "jab", finisher), finisher));
        } else if (fx.type === "ko") {
          // Normally the finisher's impact schedules the title; this is the fallback (e.g. out of words).
          pendingKo ??= { in: 2.2, win: fx.winner === "player" };
        }
      }

      if (pendingKo && (pendingKo.in -= realDt) <= 0) {
        const win = pendingKo.win;
        pendingKo = null;
        showTitle("K.O.", win ? "you win" : "you lose");
        (win ? player : rival).play([{ pose: POSES.victory, dur: 0.5 }, { pose: POSES.victory, dur: 60 }]);
      }

      player.update(dt, time);
      rival.update(dt, time + 1.3);

      // Camera.
      if (cam.hold > 0) cam.hold -= realDt;
      else {
        cam.tz = 1;
        cam.tx = 0.5;
        cam.ty = 0.6;
      }
      const k = 1 - Math.pow(0.0008, realDt);
      cam.zoom = lerp(cam.zoom, cam.tz, k);
      cam.x = lerp(cam.x, cam.tx, k);
      cam.y = lerp(cam.y, cam.ty, k);
      world.pivot.set(cam.x * W(), cam.y * H());
      const sx = shakeAmt > 0.1 && !reducedMotion ? (Math.random() - 0.5) * shakeAmt : 0;
      const sy = shakeAmt > 0.1 && !reducedMotion ? (Math.random() - 0.5) * shakeAmt : 0;
      shakeAmt *= Math.pow(0.002, realDt);
      world.position.set(W() / 2 + sx, H() * 0.6 + sy);
      world.scale.set(cam.zoom);

      // Backdrop: dusk sky, moon, skyline, floor.
      backdrop.clear();
      backdrop.rect(-W(), -H(), W() * 3, H() * 3).fill({ color: colors.bg });
      backdrop.circle(W() * 0.78, H() * 0.22, H() * 0.09).fill({ color: colors.gold, alpha: 0.22 });
      backdrop.circle(W() * 0.78, H() * 0.22, H() * 0.06).fill({ color: colors.gold, alpha: 0.35 });
      for (let i = 0; i < 14; i++) {
        const bw = W() / 12;
        const bh = H() * (0.12 + ((i * 53) % 17) / 60);
        backdrop.rect(i * bw - bw * 0.6, floorY() - bh, bw * 0.9, bh).fill({ color: colors.bgAlt, alpha: 0.9 });
      }
      backdrop.rect(-W(), floorY(), W() * 3, H()).fill({ color: colors.bgAlt });
      backdrop.moveTo(-W(), floorY()).lineTo(W() * 2, floorY()).stroke({ width: 2, color: colors.border });

      // Fighters, shadows, trails.
      const pb = player.bones(baseX(player), floorY(), s);
      const rb = rival.bones(baseX(rival), floorY(), s);
      shadows.clear();
      for (const b of [pb, rb]) shadows.ellipse(b.hip[0], floorY() + 4, 34 * s, 7 * s).fill({ color: "#000000", alpha: 0.35 });

      trails.clear();
      for (const [f, b] of [
        [player, pb],
        [rival, rb],
      ] as const) {
        if (!reducedMotion && f.busy) {
          f.trail.push(b);
          if (f.trail.length > 6) f.trail.shift();
        } else if (f.trail.length) f.trail.shift();
        f.trail.forEach((tb, i) => drawFighter(trails, tb, f.color, s, ((i + 1) / (f.trail.length + 1)) * 0.25));
      }
      figures.clear();
      drawFighter(figures, rb, rival.color, s);
      drawFighter(figures, pb, player.color, s);

      particles.update(dt);

      // Overlay: impact flash, letterbox, titles.
      flash.clear();
      if (flashA > 0.01) {
        flash.rect(0, 0, W(), H()).fill({ color: "#ffffff", alpha: flashA });
        flashA *= Math.pow(0.0001, realDt);
      }
      barH = lerp(barH, reducedMotion ? 0.06 : barTarget, 1 - Math.pow(0.01, realDt));
      bars.clear();
      bars.rect(0, 0, W(), H() * barH).fill("#000000");
      bars.rect(0, H() * (1 - barH), W(), H() * barH).fill("#000000");

      title.position.set(W() / 2, H() * 0.36);
      subtitle.position.set(W() / 2, H() * 0.36 + 52);
      if (st.stage === "intro") {
        title.alpha = 0.9 + Math.sin(time * 3) * 0.1;
        title.scale.set(1);
        subtitle.alpha = 0.8;
      } else if (titleT > 0) {
        titleT += realDt;
        const appear = Math.min(1, titleT / 0.25);
        const holdUntil = titleText === "K.O." ? 999 : 0.9;
        const fade = titleT > holdUntil ? Math.max(0, 1 - (titleT - holdUntil) / 0.3) : 1;
        title.alpha = appear * fade;
        title.scale.set(reducedMotion ? 1 : lerp(2.2, 1, easeOutCubic(appear)));
        subtitle.alpha = title.alpha * 0.9;
        if (fade <= 0) titleT = 0;
      } else {
        title.alpha = 0;
        subtitle.alpha = 0;
      }
    },
    destroy() {
      world.destroy({ children: true });
      overlay.destroy({ children: true });
    },
  };
}
