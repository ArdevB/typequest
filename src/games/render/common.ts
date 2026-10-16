import type { Application, Container, Graphics, Text } from "pixi.js";

export type Pixi = typeof import("pixi.js");

export interface Colors {
  bg: string;
  bgAlt: string;
  text: string;
  sub: string;
  main: string;
  caret: string;
  error: string;
  gold: string;
  border: string;
}

/** Reads the active theme's colors from CSS variables. */
export function readColors(): Colors {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    bg: v("--bg", "#0a0614"),
    bgAlt: v("--bg-alt", "#120a24"),
    text: v("--text", "#ece8ff"),
    sub: v("--sub", "#5f5690"),
    main: v("--main", "#ff2fd1"),
    caret: v("--caret", "#2ef2ff"),
    error: v("--error", "#ff4d6d"),
    gold: v("--combo-3", "#ffd23f"),
    border: v("--border", "#2c1f52"),
  };
}

export const MONO = '"JetBrains Mono Variable", ui-monospace, monospace';
export const DISPLAY = '"Orbitron", "Inter Variable", sans-serif';

export interface RenderCtx {
  PIXI: Pixi;
  app: Application;
  colors: Colors;
  reducedMotion: boolean;
}

export interface GameRenderer {
  /** Called every frame after the sim has stepped. dt in ms (real time). */
  update(dtMs: number): void;
  destroy(): void;
}

// ---------------------------------------------------------------------------
// Particles: one Graphics redrawn per frame (cheap for a few hundred dots).
// ---------------------------------------------------------------------------

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  gravity: number;
}

export class Particles {
  readonly g: Graphics;
  private list: Particle[] = [];

  constructor(PIXI: Pixi, parent: Container) {
    this.g = new PIXI.Graphics();
    this.g.blendMode = "add";
    parent.addChild(this.g);
  }

  burst(x: number, y: number, o: { count?: number; colors: string[]; speed?: number; life?: number; size?: number; gravity?: number; spread?: number; angle?: number }) {
    const n = Math.min(o.count ?? 16, 400 - this.list.length);
    const spread = o.spread ?? Math.PI * 2;
    const base = (o.angle ?? -Math.PI / 2) - spread / 2;
    for (let i = 0; i < n; i++) {
      const a = base + Math.random() * spread;
      const s = (o.speed ?? 220) * (0.3 + Math.random() * 0.9);
      const life = (o.life ?? 0.7) * (0.5 + Math.random() * 0.7);
      this.list.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life,
        max: life,
        size: (o.size ?? 3) * (0.5 + Math.random()),
        color: o.colors[i % o.colors.length] ?? "#fff",
        gravity: o.gravity ?? 300,
      });
    }
  }

  update(dt: number): void {
    const g = this.g;
    g.clear();
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.vx *= 0.985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k = p.life / p.max;
      g.circle(p.x, p.y, p.size * (0.3 + 0.7 * k)).fill({ color: p.color, alpha: k });
    }
  }
}

// ---------------------------------------------------------------------------
// Screen shake / flash
// ---------------------------------------------------------------------------

export class Shake {
  private amount = 0;
  constructor(
    private readonly target: Container,
    private readonly enabled: boolean,
  ) {}
  kick(px: number): void {
    if (this.enabled) this.amount = Math.max(this.amount, px);
  }
  update(dt: number): void {
    if (this.amount <= 0.1) {
      this.target.position.set(0, 0);
      this.amount = 0;
      return;
    }
    this.target.position.set((Math.random() - 0.5) * 2 * this.amount, (Math.random() - 0.5) * 2 * this.amount);
    this.amount *= Math.pow(0.0015, dt);
  }
}

/** Floating text (damage numbers, "+40"). */
export class Floaters {
  private items: { t: Text; vy: number; life: number; max: number }[] = [];
  constructor(
    private readonly PIXI: Pixi,
    private readonly parent: Container,
  ) {}
  add(text: string, x: number, y: number, color: string, size = 22): void {
    const t = new this.PIXI.Text({
      text,
      style: { fontFamily: DISPLAY, fontSize: size, fontWeight: "700", fill: color, stroke: { color: "#000000", width: 3 } },
    });
    t.anchor.set(0.5);
    t.position.set(x, y);
    this.parent.addChild(t);
    this.items.push({ t, vy: -60, life: 0.9, max: 0.9 });
  }
  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]!;
      it.life -= dt;
      it.t.y += it.vy * dt;
      it.t.alpha = Math.max(0, it.life / it.max);
      it.t.scale.set(1 + (1 - it.life / it.max) * 0.3);
      if (it.life <= 0) {
        it.t.destroy();
        this.items.splice(i, 1);
      }
    }
  }
}

/** A word drawn in two parts: typed (colored) and remaining. */
export class WordLabel {
  readonly root: Container;
  private readonly done: Text;
  private readonly rest: Text;
  private lastTyped = -1;

  constructor(
    PIXI: Pixi,
    readonly word: string,
    style: { size: number; typed: string; rest: string },
  ) {
    this.root = new PIXI.Container();
    const base = { fontFamily: MONO, fontSize: style.size, fontWeight: "600" as const };
    this.done = new PIXI.Text({ text: "", style: { ...base, fill: style.typed } });
    this.rest = new PIXI.Text({ text: word, style: { ...base, fill: style.rest } });
    this.root.addChild(this.done, this.rest);
    this.setTyped(0);
  }

  setTyped(n: number): void {
    if (n === this.lastTyped) return;
    this.lastTyped = n;
    this.done.text = this.word.slice(0, n);
    this.rest.text = this.word.slice(n);
    this.rest.x = n > 0 ? this.done.width : 0;
    const w = this.done.width + this.rest.width;
    this.done.x = -w / 2;
    this.rest.x = -w / 2 + (n > 0 ? this.done.width : 0);
  }

  get width(): number {
    return this.done.width + this.rest.width;
  }
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
