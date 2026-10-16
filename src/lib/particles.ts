/**
 * Tiny 2D-canvas particle layer for DOM themes (Pixi is reserved for game modes).
 * The animation loop only runs while particles are alive.
 */
export interface BurstOptions {
  count?: number;
  colors?: readonly string[];
  speed?: number;
  /** Seconds. */
  life?: number;
  size?: number;
  gravity?: number;
  /** Spread angle in radians, centered on `angle`. Default full circle. */
  spread?: number;
  angle?: number;
  /** Square "pixel" particles instead of dots (Retro Arcade). */
  square?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  square: boolean;
}

export interface ParticleLayer {
  burst(x: number, y: number, o?: BurstOptions): void;
  resize(): void;
  destroy(): void;
}

const MAX_PARTICLES = 400;

export function createParticleLayer(canvas: HTMLCanvasElement): ParticleLayer {
  const ctx = canvas.getContext("2d");
  const particles: Particle[] = [];
  let raf = 0;
  let last = 0;
  let dpr = 1;

  const resize = (): void => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
  };

  const frame = (now: number): void => {
    if (!ctx) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    ctx.globalCompositeOperation = "lighter";
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (!p) continue;
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.vx *= 0.98;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k = p.life / p.maxLife;
      ctx.globalAlpha = k;
      ctx.fillStyle = p.color;
      if (p.square) {
        const sz = Math.round(p.size * 2);
        ctx.fillRect(Math.round(p.x), Math.round(p.y), sz, sz);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * k), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    raf = particles.length > 0 ? requestAnimationFrame(frame) : 0;
  };

  resize();

  return {
    burst(x, y, o = {}) {
      const colors = o.colors ?? ["#ffffff"];
      const count = Math.min(o.count ?? 8, MAX_PARTICLES - particles.length);
      const spread = o.spread ?? Math.PI * 2;
      const base = (o.angle ?? -Math.PI / 2) - spread / 2;
      for (let i = 0; i < count; i++) {
        const a = base + Math.random() * spread;
        const s = (o.speed ?? 160) * (0.4 + Math.random() * 0.8);
        const life = (o.life ?? 0.6) * (0.6 + Math.random() * 0.6);
        particles.push({
          x,
          y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life,
          maxLife: life,
          size: (o.size ?? 2.5) * (0.6 + Math.random() * 0.8),
          color: colors[i % colors.length] ?? "#fff",
          gravity: o.gravity ?? 260,
          square: o.square ?? false,
        });
      }
      if (!raf && particles.length > 0) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    },
    resize,
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      particles.length = 0;
    },
  };
}
