import type { Container, Graphics, Text } from "pixi.js";
import type { DuelMove, DuelSim } from "../duel";
import { DISPLAY, Particles, easeInOut, easeOutCubic, lerp, type GameRenderer, type Pixi, type RenderCtx } from "./common";

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

const IDLE: Pose = {
  lean: d(10),
  hipX: 0,
  hipY: 4,
  rot: 0,
  head: d(-4),
  armF: [d(60), d(85)],
  armB: [d(35), d(105)],
  legF: [d(22), d(-16)],
  legB: [d(-22), d(-10)],
};

const P = (p: Partial<Pose>): Pose => ({ ...IDLE, ...p });

const POSES = {
  idle: IDLE,
  windup: P({ lean: d(-4), hipX: -6, armF: [d(10), d(120)], armB: [d(-20), d(90)] }),
  jab: P({ lean: d(20), hipX: 12, armF: [d(92), d(0)], armB: [d(40), d(110)], legF: [d(30), d(-8)] }),
  cross: P({ lean: d(26), hipX: 16, armB: [d(94), d(0)], armF: [d(45), d(115)], legF: [d(32), d(-6)], legB: [d(-28), d(-4)] }),
  kickChamber: P({ lean: d(-10), hipY: -4, legF: [d(85), d(-115)], armF: [d(55), d(70)], armB: [d(-30), d(60)] }),
  kick: P({ lean: d(-24), hipX: 4, legF: [d(98), d(0)], legB: [d(-8), d(-4)], armF: [d(45), d(60)], armB: [d(-55), d(40)] }),
  highKick: P({ lean: d(-38), hipX: 2, hipY: -4, legF: [d(128), d(4)], legB: [d(-6), d(-4)], armF: [d(30), d(60)], armB: [d(-70), d(30)] }),
  sweepLoad: P({ lean: d(26), hipY: 20, legF: [d(50), d(-90)], legB: [d(-30), d(-80)], armF: [d(40), d(80)], armB: [d(-20), d(60)] }),
  sweep: P({ lean: d(34), hipY: 26, hipX: 8, legF: [d(86), d(4)], legB: [d(-42), d(-88)], armF: [d(60), d(60)], armB: [d(-35), d(40)] }),
  crouch: P({ lean: d(22), hipY: 16, legF: [d(42), d(-72)], legB: [d(-30), d(-62)], armF: [d(20), d(140)], armB: [d(10), d(110)] }),
  uppercut: P({ lean: d(4), hipY: -10, hipX: 12, armF: [d(168), d(10)], armB: [d(-20), d(70)], legF: [d(12), d(-4)], legB: [d(-28), d(-6)] }),
  spinKick: P({ lean: d(-30), hipY: -10, legF: [d(100), d(0)], legB: [d(-5), d(-10)], armF: [d(100), d(10)], armB: [d(-100), d(10)] }),
  jumpTuck: P({ lean: d(10), hipY: -70, legF: [d(70), d(-120)], legB: [d(20), d(-110)], armF: [d(-40), d(60)], armB: [d(-70), d(40)] }),
  flyKick: P({ rot: d(-12), lean: d(-24), hipY: -46, legF: [d(100), d(0)], legB: [d(30), d(-110)], armF: [d(-30), d(40)], armB: [d(-90), d(30)] }),
  guard: P({ lean: d(-2), hipX: -4, armF: [d(70), d(112)], armB: [d(78), d(118)], legF: [d(26), d(-18)], legB: [d(-26), d(-12)] }),
  rivalLoad: P({ lean: d(-16), hipX: -12, hipY: 2, armF: [d(-45), d(125)], armB: [d(45), d(85)], legF: [d(28), d(-22)], legB: [d(-24), d(-12)] }),
  hit: P({ lean: d(-28), hipX: -14, head: d(-25), armF: [d(15), d(40)], armB: [d(-25), d(30)], legF: [d(25), d(-20)], legB: [d(-12), d(-6)] }),
  stagger: P({ lean: d(-40), hipX: -26, head: d(-34), armF: [d(-15), d(30)], armB: [d(-55), d(20)], legF: [d(34), d(-16)], legB: [d(-8), d(-6)] }),
  bigHit: P({ lean: d(-45), hipX: -30, hipY: -6, head: d(-40), armF: [d(-30), d(20)], armB: [d(-60), d(10)], legF: [d(45), d(-10)], legB: [d(10), d(-5)] }),
  tumble: P({ lean: d(-20), head: d(-30), armF: [d(-120), d(20)], armB: [d(-160), d(30)], legF: [d(60), d(-40)], legB: [d(20), d(-60)] }),
  ko: P({ rot: d(-90), lean: d(-6), hipX: 0, hipY: 50, head: d(-14), armF: [d(150), d(10)], armB: [d(-160), d(10)], legF: [d(12), d(-5)], legB: [d(-8), d(-5)] }),
  victory: P({ lean: d(0), hipY: 0, armF: [d(165), d(15)], armB: [d(-165), d(-15)], legF: [d(14), d(-4)], legB: [d(-14), d(-4)] }),
  taunt: P({ lean: d(4), armF: [d(120), d(-60)], armB: [d(20), d(130)], legF: [d(16), d(-8)], legB: [d(-16), d(-6)] }),
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
  /** Forward travel (px, unscaled) reached by the end of this segment. */
  dash?: number;
  /** Fired when the segment ends (e.g. the moment of impact). */
  onEnd?: () => void;
  /** Fired when the segment starts (whoosh sounds). */
  onStart?: () => void;
}

type Pt = [number, number];

interface Bones {
  hip: Pt;
  chest: Pt;
  neck: Pt;
  head: Pt;
  elbowF: Pt;
  handF: Pt;
  elbowB: Pt;
  handB: Pt;
  kneeF: Pt;
  footF: Pt;
  kneeB: Pt;
  footB: Pt;
}

/** Mixes a #rrggbb color toward black (k < 0) or white (k > 0). */
function shade(hex: string, k: number): number {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  const ch = (v: number) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  return (ch((n >> 16) & 255) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255);
}

class Fighter {
  pose: Pose = IDLE;
  private from: Pose = IDLE;
  private queue: Segment[] = [];
  private seg: Segment | null = null;
  private segT = 0;
  dash = 0;
  private dashFrom = 0;
  /** Knockback offset (px, unscaled, positive = backwards). */
  push = 0;
  private pushV = 0;
  /** Airborne after a KO blow. */
  air: { y: number; vy: number; rot: number; vr: number; bounces: number } | null = null;
  trail: Bones[] = [];
  down = false;
  /** Headband ribbon tail points (world coords). */
  ribbon: Pt[] = [];
  onLand?: (x: number, y: number, hard: boolean) => void;

  constructor(
    readonly facing: 1 | -1,
    readonly color: string,
  ) {}

  play(segs: Segment[], interrupt = true): void {
    if (this.down || this.air) return;
    if (interrupt) {
      this.queue = [];
      this.seg = null;
    }
    this.queue.push(...segs);
  }

  knock(px: number): void {
    this.pushV += px * 9;
  }

  launch(power: number): void {
    this.queue = [];
    this.seg = null;
    this.pose = POSES.tumble;
    this.air = { y: 0, vy: -520 * power, rot: 0, vr: -9 * power, bounces: 0 };
    this.pushV += 320 * power;
  }

  get busy(): boolean {
    return this.seg !== null || this.queue.length > 0;
  }

  update(dt: number, time: number): void {
    // Knockback: velocity with friction, then a soft spring home.
    this.push += this.pushV * dt;
    this.pushV *= Math.pow(this.air ? 0.5 : 0.004, dt);
    if (!this.air && !this.down) this.push = lerp(this.push, 0, 1 - Math.pow(0.25, dt));

    if (this.air) {
      const a = this.air;
      a.vy += 1700 * dt;
      a.y += a.vy * dt;
      a.rot += a.vr * dt;
      if (a.y >= 0 && a.vy > 0) {
        a.y = 0;
        a.bounces += 1;
        this.onLand?.(0, 0, a.bounces === 1);
        if (a.bounces >= 2 || Math.abs(a.vy) < 200) {
          this.air = null;
          this.down = true;
          this.pose = POSES.ko;
          this.pushV *= 0.2;
        } else {
          a.vy = -a.vy * 0.32;
          a.vr *= 0.45;
        }
      }
      return;
    }

    if (!this.seg && this.queue.length) {
      this.seg = this.queue.shift()!;
      this.from = this.pose;
      this.dashFrom = this.dash;
      this.segT = 0;
      this.seg.onStart?.();
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
        if (!this.queue.length && !this.down && !this.air) this.queue.push({ pose: IDLE, dur: 0.3, dash: 0 });
      }
    } else if (!this.down) {
      // Fighting stance: bounce on the toes, guard breathing.
      const b = Math.sin(time * 7) * 2.5;
      const sway = Math.sin(time * 3.5) * d(2);
      this.pose = { ...IDLE, hipY: IDLE.hipY + b, lean: IDLE.lean + sway, armF: [IDLE.armF[0] + sway, IDLE.armF[1]] };
    }
  }

  bones(baseX: number, floorY: number, s: number): Bones {
    const p = this.pose;
    const f = this.facing;
    const dir = (a: number, len: number): Pt => [Math.sin(a) * f * len * s, Math.cos(a) * len * s];
    const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
    const legLen = 62;
    const airY = this.air ? this.air.y : 0;
    const hip: Pt = [baseX + (p.hipX + this.dash - this.push) * f * s, floorY - legLen * s + p.hipY * s + airY * s];
    const chest = add(hip, [Math.sin(p.lean) * f * 46 * s, -Math.cos(p.lean) * 46 * s]);
    const neck = add(chest, [Math.sin(p.lean + p.head) * f * 6 * s, -Math.cos(p.lean + p.head) * 6 * s]);
    const head = add(chest, [Math.sin(p.lean + p.head) * f * 19 * s, -Math.cos(p.lean + p.head) * 19 * s]);
    const shoulder = add(chest, [Math.sin(p.lean) * f * -2 * s, 4 * s]);
    const elbowF = add(shoulder, dir(p.armF[0], 25));
    const handF = add(elbowF, dir(p.armF[0] + p.armF[1], 24));
    const elbowB = add(shoulder, dir(p.armB[0], 25));
    const handB = add(elbowB, dir(p.armB[0] + p.armB[1], 24));
    const kneeF = add(hip, dir(p.legF[0], 32));
    const footF = add(kneeF, dir(p.legF[0] + p.legF[1], 32));
    const kneeB = add(hip, dir(p.legB[0], 32));
    const footB = add(kneeB, dir(p.legB[0] + p.legB[1], 32));
    const b: Bones = { hip, chest, neck, head, elbowF, handF, elbowB, handB, kneeF, footF, kneeB, footB };
    const rot = p.rot + (this.air ? this.air.rot : 0);
    if (rot !== 0) {
      // Rotate the whole figure about the hip (spins, flips and falls).
      const [cx, cy] = hip;
      const r = rot * f;
      const cos = Math.cos(r);
      const sin = Math.sin(r);
      for (const k of Object.keys(b) as (keyof Bones)[]) {
        const [x, y] = b[k];
        b[k] = [cx + (x - cx) * cos - (y - cy) * sin, cy + (x - cx) * sin + (y - cy) * cos];
      }
    }
    return b;
  }

  /** Ribbon tail follows the back of the head with lag (simple verlet-ish chase). */
  updateRibbon(b: Bones, s: number, dt: number, wind: number): void {
    const anchor: Pt = [b.head[0] - this.facing * 9 * s, b.head[1] - 4 * s];
    if (this.ribbon.length === 0) this.ribbon = [anchor, anchor, anchor, anchor];
    this.ribbon[0] = anchor;
    const seg = 9 * s;
    for (let i = 1; i < this.ribbon.length; i++) {
      const prev = this.ribbon[i - 1]!;
      const cur = this.ribbon[i]!;
      // Drift backwards and down, plus wind flutter.
      const tx = cur[0] - this.facing * 30 * s * dt + wind * s * dt;
      const ty = cur[1] + 40 * s * dt;
      const dx = tx - prev[0];
      const dy = ty - prev[1];
      const len = Math.hypot(dx, dy) || 1;
      this.ribbon[i] = [prev[0] + (dx / len) * seg, prev[1] + (dy / len) * seg];
    }
  }
}

/** Draws a fighter: dark outline pass, back limbs in a darker shade, front limbs, head with headband and ribbon. */
function drawFighter(g: Graphics, f: Fighter, b: Bones, s: number, opts: { color?: string; alpha?: number; flat?: boolean } = {}): void {
  const alpha = opts.alpha ?? 1;
  const base = opts.color ?? f.color;
  const front = parseInt(base.slice(1, 7), 16);
  const back = opts.flat ? front : shade(base, -0.35);
  const outline = opts.flat ? front : 0x07040f;
  const line = (a: Pt, c: Pt, w: number, color: number) =>
    g.moveTo(a[0], a[1]).lineTo(c[0], c[1]).stroke({ width: w * s, color, alpha, cap: "round", join: "round" });
  const limb = (pts: Pt[], w: number, color: number) => {
    if (!opts.flat) for (let i = 1; i < pts.length; i++) line(pts[i - 1]!, pts[i]!, w + 3.5, outline);
    for (let i = 1; i < pts.length; i++) line(pts[i - 1]!, pts[i]!, w, color);
  };
  // Back side first.
  limb([b.hip, b.kneeB, b.footB], 7.5, back);
  limb([b.chest, b.elbowB, b.handB], 6, back);
  if (!opts.flat) g.circle(b.handB[0], b.handB[1], 5.2 * s).fill({ color: back, alpha });
  // Torso + front side.
  limb([b.hip, b.chest, b.neck], 9, front);
  limb([b.hip, b.kneeF, b.footF], 7.5, front);
  limb([b.chest, b.elbowF, b.handF], 6, front);
  if (!opts.flat) {
    g.circle(b.handF[0], b.handF[1], 5.6 * s).fill({ color: front, alpha }).stroke({ width: 1.5 * s, color: outline, alpha });
    // Ribbon.
    if (f.ribbon.length > 1) {
      g.moveTo(f.ribbon[0]![0], f.ribbon[0]![1]);
      for (let i = 1; i < f.ribbon.length; i++) g.lineTo(f.ribbon[i]![0], f.ribbon[i]![1]);
      g.stroke({ width: 3.2 * s, color: f.facing === 1 ? 0xff2fd1 : 0xffd23f, alpha: alpha * 0.95, cap: "round", join: "round" });
    }
  }
  // Head with outline and a headband.
  const hr = 12.5 * s;
  if (!opts.flat) g.circle(b.head[0], b.head[1], hr + 1.8 * s).fill({ color: outline, alpha });
  g.circle(b.head[0], b.head[1], hr).fill({ color: front, alpha });
  if (!opts.flat) {
    const dx = (b.head[0] - b.neck[0]) / (Math.hypot(b.head[0] - b.neck[0], b.head[1] - b.neck[1]) || 1);
    const dy = (b.head[1] - b.neck[1]) / (Math.hypot(b.head[0] - b.neck[0], b.head[1] - b.neck[1]) || 1);
    // Band across the forehead, perpendicular to the neck line.
    const cx = b.head[0] + dx * 3 * s;
    const cy = b.head[1] + dy * 3 * s;
    g.moveTo(cx - dy * hr, cy + dx * hr)
      .lineTo(cx + dy * hr, cy - dx * hr)
      .stroke({ width: 3.4 * s, color: f.facing === 1 ? 0xff2fd1 : 0xffd23f, alpha });
    // An eye glint on the facing side.
    g.circle(b.head[0] + f.facing * 5 * s + dx * 1 * s, b.head[1] + dy * 1 * s, 1.8 * s).fill({ color: 0xffffff, alpha: alpha * 0.9 });
  }
}

// ---------------------------------------------------------------------------
// Hit sparks, rings, speed lines
// ---------------------------------------------------------------------------

interface Spark {
  x: number;
  y: number;
  t: number;
  life: number;
  size: number;
  color: number;
  spikes: number[];
  rot: number;
}

class Sparks {
  readonly g: Graphics;
  private list: Spark[] = [];
  private rings: { x: number; y: number; t: number; life: number; r: number; color: number }[] = [];
  constructor(PIXI: Pixi, parent: Container) {
    this.g = new PIXI.Graphics();
    this.g.blendMode = "add";
    parent.addChild(this.g);
  }
  add(x: number, y: number, size: number, color: number): void {
    const n = 9 + Math.floor(Math.random() * 4);
    this.list.push({ x, y, t: 0, life: 0.2, size, color, spikes: Array.from({ length: n }, () => 0.45 + Math.random() * 0.75), rot: Math.random() * Math.PI });
    this.rings.push({ x, y, t: 0, life: 0.32, r: size * 1.6, color });
  }
  update(dt: number): void {
    const g = this.g;
    g.clear();
    this.list = this.list.filter((sp) => {
      sp.t += dt;
      const k = sp.t / sp.life;
      if (k >= 1) return false;
      const grow = easeOutCubic(Math.min(1, k * 2.2));
      const pts: number[] = [];
      const n = sp.spikes.length;
      for (let i = 0; i < n * 2; i++) {
        const a = sp.rot + (i / (n * 2)) * Math.PI * 2;
        const r = i % 2 === 0 ? sp.size * (sp.spikes[i / 2] ?? 1) * grow : sp.size * 0.18 * grow;
        pts.push(sp.x + Math.cos(a) * r, sp.y + Math.sin(a) * r);
      }
      g.poly(pts).fill({ color: sp.color, alpha: 1 - k });
      g.poly(pts.map((v, i) => (i % 2 === 0 ? sp.x + (v - sp.x) * 0.5 : sp.y + (v - sp.y) * 0.5))).fill({ color: 0xffffff, alpha: (1 - k) * 0.9 });
      return true;
    });
    this.rings = this.rings.filter((r) => {
      r.t += dt;
      const k = r.t / r.life;
      if (k >= 1) return false;
      g.circle(r.x, r.y, r.r * (0.3 + easeOutCubic(k) * 1.4)).stroke({ width: 4 * (1 - k) + 1, color: r.color, alpha: 1 - k });
      return true;
    });
  }
}

// Move choreography: segments for the attacker. `impact` fires at the hit.
function attackSegments(move: DuelMove | "cross" | "highKick" | "sweep" | "flyKick", impact: () => void, whoosh: () => void, slow = false): Segment[] {
  switch (move) {
    case "jab":
      return [
        { pose: POSES.windup, dur: 0.05, dash: 10 },
        { pose: POSES.jab, dur: 0.07, dash: 44, ease: easeOutCubic, onStart: whoosh, onEnd: impact },
        { pose: POSES.jab, dur: 0.08, dash: 44 },
      ];
    case "cross":
      return [
        { pose: POSES.windup, dur: 0.05, dash: 12 },
        { pose: POSES.cross, dur: 0.07, dash: 50, ease: easeOutCubic, onStart: whoosh, onEnd: impact },
        { pose: POSES.cross, dur: 0.08, dash: 50 },
      ];
    case "kick":
      return [
        { pose: POSES.kickChamber, dur: 0.09, dash: 18 },
        { pose: POSES.kick, dur: 0.08, dash: 38, ease: easeOutCubic, onStart: whoosh, onEnd: impact },
        { pose: POSES.kick, dur: 0.11, dash: 38 },
      ];
    case "highKick":
      return [
        { pose: POSES.kickChamber, dur: 0.1, dash: 16 },
        { pose: POSES.highKick, dur: 0.09, dash: 34, ease: easeOutCubic, onStart: whoosh, onEnd: impact },
        { pose: POSES.highKick, dur: 0.12, dash: 34 },
      ];
    case "sweep":
      return [
        { pose: POSES.sweepLoad, dur: 0.09, dash: 30 },
        { pose: POSES.sweep, dur: 0.09, dash: 48, ease: easeOutCubic, onStart: whoosh, onEnd: impact },
        { pose: POSES.sweep, dur: 0.12, dash: 48 },
      ];
    case "uppercut":
      return [
        { pose: POSES.crouch, dur: 0.11, dash: 32 },
        { pose: POSES.uppercut, dur: 0.09, dash: 48, ease: easeOutCubic, onStart: whoosh, onEnd: impact },
        { pose: POSES.uppercut, dur: 0.14, dash: 48 },
      ];
    case "spin":
      return [
        { pose: P({ ...POSES.kickChamber, rot: d(-40) }), dur: 0.09, dash: 22 },
        { pose: P({ ...POSES.spinKick, rot: d(-200) }), dur: 0.1, dash: 40, onStart: whoosh },
        { pose: P({ ...POSES.spinKick, rot: d(-360) }), dur: 0.09, dash: 52, ease: easeOutCubic, onEnd: impact },
        { pose: P({ ...POSES.spinKick, rot: d(-360) }), dur: 0.14, dash: 52 },
      ];
    case "flyKick":
    case "finisher":
      // Leap, hang in the air, then drive a flying kick through them.
      return [
        { pose: POSES.crouch, dur: slow ? 0.14 : 0.1, dash: 20 },
        { pose: POSES.jumpTuck, dur: 0.18, dash: 40, ease: easeOutCubic, onStart: whoosh },
        { pose: POSES.flyKick, dur: 0.12, dash: 78, ease: easeOutCubic, onEnd: impact },
        { pose: POSES.flyKick, dur: 0.14, dash: 84 },
        { pose: POSES.crouch, dur: 0.16, dash: 70 },
      ];
  }
}

/**
 * Stickman Duel, filmed like a fight scene on a rooftop at night: a camera
 * that tracks the fighters and punches in on big hits, hit-stop and manga
 * impact frames on the heaviest blows, spark stars, motion trails, a rival who
 * telegraphs its strikes (parry window!), and a ragdoll KO with bounces.
 */
export function renderDuel(ctx: RenderCtx, sim: DuelSim): GameRenderer {
  const { PIXI, app, colors, reducedMotion } = ctx;
  const sfx = ctx.sfx ?? (() => {});
  const W = () => app.screen.width;
  const H = () => app.screen.height;

  // Screen-space backdrop (parallax), then the world (camera), then overlays.
  const sky = new PIXI.Graphics();
  const farCity = new PIXI.Graphics();
  const nearCity = new PIXI.Graphics();
  app.stage.addChild(sky, farCity, nearCity);

  const world = new PIXI.Container();
  app.stage.addChild(world);
  const roof = new PIXI.Graphics();
  const lamp = new PIXI.Graphics();
  lamp.blendMode = "add";
  const shadows = new PIXI.Graphics();
  const trails = new PIXI.Graphics();
  const figures = new PIXI.Graphics();
  world.addChild(roof, lamp, shadows, trails, figures);
  const sparks = new Sparks(PIXI, world);
  const particles = new Particles(PIXI, world);
  const floatLayer = new PIXI.Container();
  world.addChild(floatLayer);

  const overlay = new PIXI.Container();
  app.stage.addChild(overlay);
  const rain = new PIXI.Graphics();
  const speed = new PIXI.Graphics();
  const impact = new PIXI.Graphics();
  const flash = new PIXI.Graphics();
  const bars = new PIXI.Graphics();
  overlay.addChild(rain, speed, impact, flash, bars);

  const mkText = (size: number, fill: string, spacing = 4) =>
    new PIXI.Text({
      text: "",
      style: { fontFamily: DISPLAY, fontSize: size, fontWeight: "900", fill, stroke: { color: "#000000", width: Math.max(3, size / 10) }, letterSpacing: spacing },
    }) as Text;
  const title = mkText(64, colors.text, 6);
  title.anchor.set(0.5);
  const subtitle = mkText(18, colors.sub, 4);
  subtitle.anchor.set(0.5);
  const comboText = mkText(30, colors.gold, 2);
  comboText.anchor.set(0, 0.5);
  const comboSub = mkText(13, colors.text, 3);
  comboSub.anchor.set(0, 0.5);
  const warn = mkText(44, "#ff2e63", 0);
  warn.anchor.set(0.5, 1);
  warn.text = "!";
  overlay.addChild(title, subtitle, comboText, comboSub);
  world.addChild(warn);

  const player = new Fighter(1, colors.caret);
  const rival = new Fighter(-1, "#ff8a3d");

  // Background detail, generated once.
  const rng = (() => {
    let x = 1234567;
    return () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
  })();
  const farBuildings = Array.from({ length: 22 }, () => ({ w: 0.04 + rng() * 0.06, h: 0.18 + rng() * 0.3 }));
  const nearBuildings = Array.from({ length: 14 }, () => ({ w: 0.06 + rng() * 0.08, h: 0.12 + rng() * 0.22, lit: rng() }));
  const stars = Array.from({ length: 60 }, () => ({ x: rng(), y: rng() * 0.5, r: 0.5 + rng() * 1.2, tw: rng() * 6 }));
  const drops = Array.from({ length: 70 }, () => ({ x: rng(), y: rng(), v: 0.9 + rng() * 0.6 }));

  let time = 0;
  let slow = 1;
  let slowFor = 0;
  let hitStop = 0;
  let impactFrame = 0;
  let impactAt: Pt = [0, 0];
  let flashA = 0;
  let speedLines = 0;
  let barH = 0.13;
  let barTarget = 0.13;
  const cam = { x: 0, y: 0, zoom: 1, tz: 1, focus: null as Pt | null, hold: 0 };
  let shakeAmt = 0;
  let titleT = 0;
  let titleText = "ROUND 1";
  let fought = false;
  let pendingKo: { in: number; win: boolean } | null = null;
  /** Real seconds since the K.O. title appeared (-1 = not yet). */
  let koShown = -1;
  let attackCount = 0;
  let telegraph = false;
  let comboShown = 0;
  let comboPop = 0;

  const floorY = () => H() * 0.8;
  const scale = () => Math.min(W(), H() * 1.6) / 540;
  const homeX = (f: Fighter) => W() * (f.facing === 1 ? 0.39 : 0.61);

  showTitle("ROUND 1", "type to fight");

  function showTitle(text: string, sub = "") {
    titleText = text;
    title.text = text;
    subtitle.text = sub;
    titleT = 0.0001;
  }

  const floaters: { t: Text; born: number; vx: number }[] = [];
  function floater(text: string, x: number, y: number, color: string, size: number) {
    const t = mkText(size, color, 1);
    t.text = text;
    t.anchor.set(0.5);
    t.position.set(x, y);
    floatLayer.addChild(t);
    floaters.push({ t, born: time, vx: (Math.random() - 0.5) * 40 });
  }
  function updateFloaters(realDt: number) {
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i]!;
      const age = time - f.born;
      f.t.y -= 70 * realDt;
      f.t.x += f.vx * realDt;
      f.t.alpha = Math.max(0, 1 - age / 0.9);
      f.t.scale.set(age < 0.08 ? 1.6 - age * 7 : 1);
      if (age > 0.9) {
        f.t.destroy();
        floaters.splice(i, 1);
      }
    }
  }

  const slowMo = (factor: number, seconds: number) => {
    if (reducedMotion) return;
    slow = factor;
    slowFor = seconds;
  };
  const focus = (x: number | null, y: number, zoom: number, hold: number) => {
    if (reducedMotion) return;
    cam.focus = x === null ? null : [x, y];
    cam.tz = zoom;
    cam.hold = hold;
  };

  /** The moment a blow connects: sparks, hit-stop, shake, numbers, reaction. */
  function land(attacker: Fighter, kind: "light" | "big" | "special" | "finisher" | "parry", dmg: number) {
    const target = attacker === player ? rival : player;
    const s = scale();
    const tb = target.bones(homeX(target), floorY(), s);
    const ab = attacker.bones(homeX(attacker), floorY(), s);
    // Contact point: the attacker's furthest limb toward the target.
    const reach = [ab.handF, ab.handB, ab.footF].reduce((best, p) => (Math.abs(p[0] - tb.chest[0]) < Math.abs(best[0] - tb.chest[0]) ? p : best));
    const hx = lerp(reach[0], tb.chest[0], 0.35);
    const hy = Math.min(Math.max(reach[1], tb.head[1]), tb.hip[1]);
    const heavy = kind !== "light";
    const sparkColor = kind === "parry" ? 0x9fe8ff : attacker === player ? parseInt(colors.caret.slice(1, 7), 16) : 0xff8a3d;
    sparks.add(hx, hy, (kind === "finisher" ? 70 : heavy ? 46 : 28) * s, sparkColor);
    particles.burst(hx, hy, {
      count: kind === "finisher" ? 120 : heavy ? 44 : 18,
      colors: [attacker.color, "#ffffff", colors.gold],
      speed: kind === "finisher" ? 760 : heavy ? 480 : 300,
      life: kind === "finisher" ? 1.1 : 0.5,
      size: kind === "finisher" ? 4.5 : 3,
      gravity: 500,
      angle: attacker.facing === 1 ? -0.4 : Math.PI + 0.4,
      spread: Math.PI * 0.9,
    });
    if (!reducedMotion) {
      hitStop = kind === "finisher" ? 0.2 : kind === "special" || kind === "parry" ? 0.13 : heavy ? 0.08 : 0.045;
      shakeAmt = Math.max(shakeAmt, kind === "finisher" ? 30 : heavy ? 13 : 5);
      if (kind === "finisher" || kind === "special" || kind === "parry") {
        impactFrame = kind === "finisher" ? 0.09 : 0.055;
        impactAt = [hx, hy];
      }
    }
    flashA = Math.max(flashA, kind === "finisher" ? 0.5 : kind === "special" ? 0.18 : 0.05);
    if (dmg > 0) floater(String(dmg), tb.head[0], tb.head[1] - 26 * s, heavy ? colors.gold : colors.text, heavy ? 30 : 22);
    sfx(kind === "parry" ? "parry" : heavy ? "heavy" : "hit", { rate: 0.9 + Math.random() * 0.2 });

    if (kind === "finisher") {
      target.launch(1.15);
      sfx("ko");
    } else if (kind === "parry") {
      // The blow bounces off the guard: the attacker is the one thrown off balance.
      attacker.play([{ pose: POSES.stagger, dur: 0.12, ease: easeOutCubic }, { pose: POSES.stagger, dur: 0.22 }, { pose: IDLE, dur: 0.3 }]);
      attacker.knock(26);
    } else {
      target.play([
        { pose: heavy ? POSES.bigHit : POSES.hit, dur: heavy ? 0.12 : 0.08, ease: easeOutCubic },
        { pose: heavy ? POSES.stagger : POSES.hit, dur: heavy ? 0.16 : 0.06 },
        { pose: IDLE, dur: 0.28 },
      ]);
      target.knock(kind === "special" ? 34 : heavy ? 20 : 8);
    }
  }

  for (const f of [player, rival]) {
    f.onLand = (_x, _y, hard) => {
      const s = scale();
      const b = f.bones(homeX(f), floorY(), s);
      particles.burst(b.hip[0], floorY(), { count: hard ? 30 : 14, colors: [colors.sub, "#9a8fbf"], speed: hard ? 260 : 140, life: 0.7, size: 4, gravity: 200, angle: -Math.PI / 2, spread: Math.PI * 0.9 });
      shakeAmt = Math.max(shakeAmt, hard ? 16 : 7);
      sfx("slam", { volume: hard ? 0.9 : 0.5 });
    };
  }

  function doPlayerAttack(move: DuelMove, dmg: number) {
    attackCount += 1;
    const n = attackCount;
    const whoosh = () => sfx("whoosh", { rate: 0.9 + Math.random() * 0.3, volume: 0.55 });
    const s = scale();
    if (move === "finisher") {
      slowMo(0.3, 0.6);
      barTarget = 0.17;
      player.play(attackSegments("finisher", () => {
        slowMo(0.22, 1.1);
        speedLines = 0.5;
        // Track both fighters (the rival is about to fly) instead of a fixed point.
        focus(null, 0, 1.4, 3.4);
        // The KO title waits until the rival lands.
        pendingKo = { in: reducedMotion ? 0.3 : 1.7, win: true };
        land(player, "finisher", dmg);
      }, whoosh, true));
      return;
    }
    if (move === "spin") {
      slowMo(0.4, 0.3);
      speedLines = 0.3;
      focus((homeX(player) + homeX(rival)) / 2, floorY() - 90 * s, 1.25, 0.6);
      player.play(attackSegments("spin", () => land(player, "special", dmg), whoosh));
      return;
    }
    // Vary the light moves so a string of short words looks like a combo, not a loop.
    const variant: Parameters<typeof attackSegments>[0] =
      move === "jab" ? (n % 2 ? "jab" : "cross") : move === "kick" ? (n % 3 === 0 ? "sweep" : n % 2 ? "kick" : "highKick") : "uppercut";
    const kind = move === "uppercut" || variant === "highKick" || variant === "sweep" ? "big" : "light";
    player.play(attackSegments(variant, () => land(player, kind, dmg), whoosh));
  }

  function doRivalAttack(kindOf: "attack" | "counter", dmg: number, finisher: boolean) {
    telegraph = false;
    const whoosh = () => sfx("whoosh", { rate: 0.75 + Math.random() * 0.2, volume: 0.5 });
    if (finisher) {
      barTarget = 0.17;
      rival.play(attackSegments("finisher", () => {
        slowMo(0.22, 1.1);
        speedLines = 0.5;
        focus(null, 0, 1.4, 3.4);
        pendingKo = { in: reducedMotion ? 0.3 : 1.7, win: false };
        land(rival, "finisher", dmg);
      }, whoosh, true));
      return;
    }
    const move = kindOf === "attack" ? (Math.random() < 0.5 ? "highKick" : "uppercut") : Math.random() < 0.5 ? "jab" : "cross";
    rival.play(attackSegments(move, () => land(rival, kindOf === "attack" ? "big" : "light", dmg), whoosh));
  }

  function doParry(dmg: number, finisher: boolean) {
    telegraph = false;
    const s = scale();
    const whoosh = () => sfx("whoosh", { rate: 0.8, volume: 0.5 });
    // Rival commits to its strike; the player is already in guard when it arrives.
    player.play([{ pose: POSES.guard, dur: 0.06, dash: -4 }, { pose: POSES.guard, dur: 0.16, dash: -4 }]);
    rival.play(
      attackSegments("highKick", () => {
        land(rival, "parry", 0);
        floater("PARRY!", (homeX(player) + homeX(rival)) / 2, floorY() - 150 * s, "#9fe8ff", 34);
        focus((homeX(player) + homeX(rival)) / 2, floorY() - 80 * s, 1.2, 0.5);
        // Riposte.
        if (finisher) {
          doPlayerAttack("finisher", dmg);
        } else {
          player.play(attackSegments("cross", () => land(player, "big", dmg), () => sfx("whoosh", { volume: 0.55 })), false);
        }
      }, whoosh),
    );
  }

  return {
    update(dtMs) {
      const realDt = Math.min(0.05, dtMs / 1000);
      if (slowFor > 0) {
        slowFor -= realDt;
        if (slowFor <= 0) slow = 1;
      }
      let dt = realDt * slow;
      if (hitStop > 0) {
        hitStop -= realDt;
        dt = 0;
      }
      time += dt;
      if (koShown >= 0) koShown += realDt;
      const s = scale();
      const st = sim.state;

      if (st.stage === "fight" && !fought) {
        fought = true;
        showTitle("FIGHT!");
        barTarget = 0.08;
        sfx("finish", { volume: 0.7 });
      }

      const batch = sim.drainFx();
      // If the fight ends in this batch, the finishing blow owns the screen: earlier exchanges just flash by.
      const endsNow = batch.some((f) => f.type === "ko");
      for (const fx of batch) {
        if (fx.type === "playerAttack") doPlayerAttack(fx.move as DuelMove, fx.damage as number);
        else if (fx.type === "rivalAttack") doRivalAttack(fx.kind as "attack" | "counter", fx.damage as number, Boolean(fx.finisher));
        else if (fx.type === "parry" && endsNow && !fx.finisher) floater("PARRY!", (homeX(player) + homeX(rival)) / 2, floorY() - 150 * s, "#9fe8ff", 30);
        else if (fx.type === "parry") doParry(fx.damage as number, Boolean(fx.finisher));
        else if (fx.type === "ko") pendingKo ??= { in: 2.4, win: fx.winner === "player" };
      }

      // The rival telegraphs its timed strike: wind-up pose and a "!" (finish a word now to parry).
      const charging = st.stage === "fight" && st.rivalCharge > 0.8 && !rival.down && !rival.air;
      if (charging && !telegraph && !rival.busy) {
        telegraph = true;
        rival.play([{ pose: POSES.rivalLoad, dur: 0.22, dash: -6 }, { pose: POSES.rivalLoad, dur: 3, dash: -6 }]);
      }
      if (!charging) telegraph = false;

      if (pendingKo && (pendingKo.in -= realDt) <= 0) {
        const win = pendingKo.win;
        pendingKo = null;
        showTitle("K.O.", win ? (st.playerHp >= st.maxHp ? "perfect" : "you win") : "you lose");
        koShown = 0;
        sfx("finish");
        const w = win ? player : rival;
        w.play([{ pose: POSES.victory, dur: 0.5 }, { pose: POSES.victory, dur: 0.6 }, { pose: POSES.taunt, dur: 0.4 }, { pose: POSES.taunt, dur: 60 }]);
        focus(homeX(w), floorY() - 80 * s, 1.35, 99);
      }

      player.update(dt, time);
      rival.update(dt, time + 1.3);

      // Camera: track the fighters' midpoint; punch in on focus events.
      const pb = player.bones(homeX(player), floorY(), s);
      const rb = rival.bones(homeX(rival), floorY(), s);
      if (cam.hold > 0) cam.hold -= realDt;
      else {
        cam.focus = null;
        cam.tz = 1;
      }
      const mid: Pt = cam.focus ?? [(pb.hip[0] + rb.hip[0]) / 2, floorY() - 70 * s];
      const k = 1 - Math.pow(0.002, realDt);
      if (cam.x === 0) {
        cam.x = mid[0];
        cam.y = mid[1];
      }
      cam.x = lerp(cam.x, mid[0], k);
      cam.y = lerp(cam.y, mid[1], k);
      cam.zoom = lerp(cam.zoom, cam.tz, k);
      const sx = shakeAmt > 0.2 && !reducedMotion ? (Math.random() - 0.5) * shakeAmt : 0;
      const sy = shakeAmt > 0.2 && !reducedMotion ? (Math.random() - 0.5) * shakeAmt : 0;
      shakeAmt *= Math.pow(0.003, realDt);
      world.pivot.set(cam.x, cam.y);
      world.position.set(W() / 2 + sx, H() * 0.58 + sy);
      world.scale.set(cam.zoom);
      const pan = cam.x - W() / 2;

      // --- Backdrop (screen space, parallax) ---
      sky.clear();
      sky.rect(0, 0, W(), H()).fill({ color: colors.bg });
      sky.circle(W() * 0.8 - pan * 0.05, H() * 0.2, H() * 0.1).fill({ color: colors.gold, alpha: 0.12 });
      sky.circle(W() * 0.8 - pan * 0.05, H() * 0.2, H() * 0.068).fill({ color: "#fff4cc", alpha: 0.85 });
      sky.circle(W() * 0.8 - pan * 0.05 + H() * 0.02, H() * 0.19, H() * 0.012).fill({ color: "#e0d3a8", alpha: 0.6 });
      for (const st2 of stars) {
        const tw = reducedMotion ? 0.6 : 0.45 + 0.4 * Math.sin(time * 2 + st2.tw);
        sky.circle(st2.x * W() - pan * 0.03, st2.y * H(), st2.r).fill({ color: "#ffffff", alpha: tw * 0.7 });
      }
      farCity.clear();
      let x = -W() * 0.1 - pan * 0.15;
      for (const b of farBuildings) {
        const bw = b.w * W();
        farCity.rect(x, floorY() - b.h * H() - H() * 0.06, bw - 3, b.h * H() + H() * 0.1).fill({ color: colors.bgAlt, alpha: 0.75 });
        x += bw;
      }
      nearCity.clear();
      x = -W() * 0.15 - pan * 0.35;
      for (const b of nearBuildings) {
        const bw = b.w * W();
        const top = floorY() - b.h * H() + H() * 0.03;
        nearCity.rect(x, top, bw - 6, H()).fill({ color: shade(colors.bgAlt.length === 7 ? colors.bgAlt : "#120a24", -0.35) });
        // Lit windows.
        for (let wy = top + 10; wy < floorY() + 10; wy += 16) {
          for (let wx = x + 8; wx < x + bw - 14; wx += 14) {
            if (((wx * 7 + wy * 3) | 0) % 5 < (b.lit > 0.5 ? 2 : 1)) nearCity.rect(wx, wy, 6, 8).fill({ color: colors.gold, alpha: 0.35 });
          }
        }
        x += bw;
      }

      // --- World: rooftop, railing, lamp ---
      roof.clear();
      const fy = floorY();
      roof.rect(-W(), fy, W() * 3, H()).fill({ color: shade(colors.bgAlt.length === 7 ? colors.bgAlt : "#120a24", -0.15) });
      roof.rect(-W(), fy, W() * 3, 3).fill({ color: colors.border });
      for (let i = -20; i < 40; i++) roof.rect(i * 60 * s, fy + 14 * s, 30 * s, 2).fill({ color: colors.border, alpha: 0.4 });
      // Railing behind the fighters.
      const ry = fy - 34 * s;
      roof.rect(-W(), ry, W() * 3, 3 * s).fill({ color: colors.border, alpha: 0.9 });
      for (let i = -10; i < 30; i++) roof.rect(i * 48 * s, ry, 3 * s, 34 * s).fill({ color: colors.border, alpha: 0.7 });
      // Lamp post + light cone.
      const lx = W() * 0.5;
      roof.rect(lx - 3 * s, fy - 210 * s, 6 * s, 210 * s).fill({ color: colors.border });
      roof.rect(lx - 3 * s, fy - 210 * s, 34 * s, 5 * s).fill({ color: colors.border });
      lamp.clear();
      const flicker = reducedMotion ? 1 : 0.9 + Math.sin(time * 23) * 0.04 + (Math.random() < 0.01 ? -0.3 : 0);
      lamp.poly([lx + 22 * s, fy - 200 * s, lx - 110 * s, fy, lx + 160 * s, fy]).fill({ color: colors.gold, alpha: 0.07 * flicker });
      lamp.circle(lx + 26 * s, fy - 202 * s, 7 * s).fill({ color: "#fff4cc", alpha: 0.9 * flicker });
      lamp.ellipse(lx + 25 * s, fy + 2, 120 * s, 10 * s).fill({ color: colors.gold, alpha: 0.08 * flicker });

      // --- Fighters ---
      player.updateRibbon(pb, s, dt, 60);
      rival.updateRibbon(rb, s, dt, 60);
      shadows.clear();
      for (const [f, b] of [
        [player, pb],
        [rival, rb],
      ] as const) {
        const lift = f.air ? Math.min(1, -f.air.y / 200) : 0;
        shadows.ellipse(b.hip[0], fy + 4, 36 * s * (1 - lift * 0.5), 7 * s).fill({ color: "#000000", alpha: 0.4 * (1 - lift * 0.6) });
      }
      trails.clear();
      for (const [f, b] of [
        [player, pb],
        [rival, rb],
      ] as const) {
        if (!reducedMotion && (f.busy || f.air) && dt > 0) {
          f.trail.push(b);
          if (f.trail.length > 7) f.trail.shift();
        } else if (f.trail.length && dt > 0) f.trail.shift();
        f.trail.forEach((tb, i) => drawFighter(trails, f, tb, s, { alpha: ((i + 1) / (f.trail.length + 1)) * 0.28, flat: true }));
      }
      figures.clear();
      drawFighter(figures, rival, rb, s);
      drawFighter(figures, player, pb, s);

      // Telegraph "!" over the rival.
      warn.visible = charging && !reducedMotion ? Math.floor(time * 10) % 2 === 0 || st.rivalCharge > 0.93 : charging;
      warn.position.set(rb.head[0], rb.head[1] - 22 * s);
      warn.scale.set(s * (0.8 + st.rivalCharge * 0.4));

      sparks.update(dt === 0 ? 0 : realDt);
      particles.update(dt);
      if (dt > 0) updateFloaters(realDt);

      // --- Overlay: rain, speed lines, impact frame, flash, letterbox, titles, combo ---
      rain.clear();
      if (!reducedMotion) {
        for (const r of drops) {
          r.y = (r.y + realDt * r.v * 1.4) % 1.1;
          const rx = ((r.x * W() - pan * 0.6) % W() + W()) % W();
          rain.moveTo(rx, r.y * H()).lineTo(rx - 4, r.y * H() + 16).stroke({ width: 1, color: "#9fb7ff", alpha: 0.18 });
        }
      }
      speed.clear();
      if (speedLines > 0 && !reducedMotion) {
        speedLines -= realDt;
        const cx = W() / 2;
        const cy = H() * 0.52;
        for (let i = 0; i < 46; i++) {
          const a = (i / 46) * Math.PI * 2 + Math.random() * 0.05;
          const r0 = Math.min(W(), H()) * (0.32 + Math.random() * 0.12);
          const r1 = Math.max(W(), H());
          speed.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0).lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1).stroke({ width: 1 + Math.random() * 3, color: "#ffffff", alpha: 0.35 * Math.min(1, speedLines * 3) });
        }
      }
      impact.clear();
      if (impactFrame > 0) {
        impactFrame -= realDt;
        // Manga "impact frame": the world goes black, the fighters turn to white silhouettes.
        impact.rect(0, 0, W(), H()).fill({ color: "#000000" });
        const toScreen = (p: Pt): Pt => [(p[0] - cam.x) * cam.zoom + W() / 2, (p[1] - cam.y) * cam.zoom + H() * 0.58];
        const mapB = (b: typeof pb) => Object.fromEntries(Object.entries(b).map(([kk, v]) => [kk, toScreen(v as Pt)])) as unknown as typeof pb;
        drawFighter(impact, rival, mapB(rb), s * cam.zoom, { color: "#ffffff", flat: true });
        drawFighter(impact, player, mapB(pb), s * cam.zoom, { color: "#ffffff", flat: true });
        const [ix, iy] = toScreen(impactAt);
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          impact.moveTo(ix, iy).lineTo(ix + Math.cos(a) * W(), iy + Math.sin(a) * W()).stroke({ width: 2, color: "#ffffff", alpha: 0.8 });
        }
      }
      flash.clear();
      if (flashA > 0.01) {
        flash.rect(0, 0, W(), H()).fill({ color: "#ffffff", alpha: flashA });
        flashA *= Math.pow(0.0002, realDt);
      }
      barH = lerp(barH, reducedMotion ? 0.06 : barTarget, 1 - Math.pow(0.01, realDt));
      bars.clear();
      bars.rect(0, 0, W(), H() * barH).fill("#000000");
      bars.rect(0, H() * (1 - barH), W(), H() * barH).fill("#000000");

      // Combo counter (chain of clean words).
      if (st.chain !== comboShown) {
        if (st.chain > comboShown) comboPop = 1;
        comboShown = st.chain;
      }
      comboPop = Math.max(0, comboPop - realDt * 4);
      const showCombo = comboShown >= 3 && st.stage === "fight";
      comboText.visible = comboSub.visible = showCombo;
      if (showCombo) {
        comboText.text = `${comboShown} HITS`;
        comboSub.text = comboShown % 5 === 4 ? "SPECIAL READY" : "COMBO";
        const cx = 18;
        const cy = H() * (barH + 0.13);
        comboText.position.set(cx, cy);
        comboText.scale.set(1 + comboPop * 0.35);
        comboSub.position.set(cx + 2, cy + 26);
      }

      title.position.set(W() / 2, H() * 0.34);
      subtitle.position.set(W() / 2, H() * 0.34 + 54);
      if (st.stage === "intro") {
        title.alpha = 0.9 + Math.sin(time * 3) * 0.1;
        title.scale.set(1);
        subtitle.alpha = 0.8;
      } else if (titleT > 0) {
        titleT += realDt;
        const appear = Math.min(1, titleT / 0.22);
        const holdUntil = titleText === "K.O." ? 999 : 0.8;
        const fade = titleT > holdUntil ? Math.max(0, 1 - (titleT - holdUntil) / 0.3) : 1;
        title.alpha = appear * fade;
        title.scale.set(reducedMotion ? 1 : lerp(2.4, 1, easeOutCubic(appear)));
        subtitle.alpha = title.alpha * 0.9;
        if (fade <= 0) titleT = 0;
      } else {
        title.alpha = 0;
        subtitle.alpha = 0;
      }
    },
    finished: () => koShown >= 1.5,
    destroy() {
      for (const c of [sky, farCity, nearCity, world, overlay]) c.destroy({ children: true });
    },
  };
}
