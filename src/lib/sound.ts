import type { Howl as HowlType } from "howler";

export type SoundPackId = "mechanical" | "typewriter" | "bubble" | "scifi";
export type SoundKind = "key" | "space" | "error" | "combo";

export const SOUND_PACKS: readonly { id: SoundPackId; name: string }[] = [
  { id: "mechanical", name: "Mechanical" },
  { id: "typewriter", name: "Typewriter" },
  { id: "bubble", name: "Bubble" },
  { id: "scifi", name: "Sci-fi" },
];

const KINDS: readonly SoundKind[] = ["key", "space", "error", "combo"];

/**
 * Thin Howler wrapper. Howler is loaded lazily on the client so it never runs
 * during server rendering. Calls made before it loads are dropped (silence is
 * better than late sound).
 */
export class SoundPlayer {
  private enabled = true;
  private volume = 0.5;
  private pack: SoundPackId = "mechanical";
  private pitch = 1;
  private howls = new Map<string, HowlType>();
  private HowlCtor: (new (o: ConstructorParameters<typeof HowlType>[0]) => HowlType) | null = null;
  private loading: Promise<void> | null = null;

  configure(o: { enabled?: boolean; volume?: number; pack?: SoundPackId }): void {
    if (o.enabled !== undefined) this.enabled = o.enabled;
    if (o.volume !== undefined) this.volume = Math.max(0, Math.min(1, o.volume));
    if (o.pack !== undefined) this.pack = o.pack;
    if (this.enabled) void this.ensurePack(this.pack);
  }

  /** Combo tiers raise the pitch a little. */
  setPitch(rate: number): void {
    this.pitch = rate;
  }

  play(kind: SoundKind, jitter = kind === "key"): void {
    if (!this.enabled || this.volume === 0) return;
    const howl = this.howls.get(`${this.pack}/${kind}`);
    if (!howl) {
      void this.ensurePack(this.pack);
      return;
    }
    const id = howl.play();
    const variance = jitter ? 0.95 + Math.random() * 0.1 : 1;
    howl.rate(this.pitch * variance, id);
    howl.volume(kind === "combo" ? this.volume * 0.8 : this.volume, id);
  }

  private async ensurePack(pack: SoundPackId): Promise<void> {
    if (typeof window === "undefined") return;
    if (!this.HowlCtor) {
      this.loading ??= import("howler").then((m) => {
        this.HowlCtor = m.Howl;
      });
      await this.loading;
    }
    const Howl = this.HowlCtor;
    if (!Howl) return;
    for (const kind of KINDS) {
      const key = `${pack}/${kind}`;
      if (this.howls.has(key)) continue;
      this.howls.set(key, new Howl({ src: [`/sounds/${pack}/${kind}.wav`], preload: true, pool: 12 }));
    }
  }
}

export const sound = new SoundPlayer();

// ---------------------------------------------------------------------------
// Game sound effects (punches, explosions, KO bell…). Separate volume.
// ---------------------------------------------------------------------------

export type SfxName =
  | "whoosh"
  | "hit"
  | "heavy"
  | "parry"
  | "ko"
  | "laser"
  | "explode"
  | "crash"
  | "slam"
  | "roar"
  | "levelup"
  | "engine"
  | "finish";

const SFX_NAMES: readonly SfxName[] = ["whoosh", "hit", "heavy", "parry", "ko", "laser", "explode", "crash", "slam", "roar", "levelup", "engine", "finish"];

export class SfxPlayer {
  private enabled = true;
  private volume = 0.7;
  private howls = new Map<SfxName, HowlType>();
  private loading: Promise<void> | null = null;
  /** Throttle: the same sound at most once per this many ms (rapid lasers). */
  private last = new Map<SfxName, number>();

  configure(o: { enabled?: boolean; volume?: number }): void {
    if (o.enabled !== undefined) this.enabled = o.enabled;
    if (o.volume !== undefined) this.volume = Math.max(0, Math.min(1, o.volume));
  }

  /** Starts loading the effects (call when a game screen opens). */
  preload(): Promise<void> {
    if (typeof window === "undefined") return Promise.resolve();
    this.loading ??= import("howler").then(({ Howl }) => {
      for (const name of SFX_NAMES) {
        this.howls.set(name, new Howl({ src: [`/sounds/sfx/${name}.wav`], preload: true, pool: name === "laser" || name === "hit" || name === "whoosh" ? 10 : 4 }));
      }
    });
    return this.loading;
  }

  play(name: SfxName, opts: { volume?: number; rate?: number } = {}): void {
    if (!this.enabled || this.volume === 0) return;
    const howl = this.howls.get(name);
    if (!howl) {
      void this.preload();
      return;
    }
    const now = performance.now();
    if (now - (this.last.get(name) ?? 0) < 28) return;
    this.last.set(name, now);
    const id = howl.play();
    howl.volume(this.volume * (opts.volume ?? 1), id);
    if (opts.rate) howl.rate(opts.rate, id);
  }
}

export const sfx = new SfxPlayer();

// ---------------------------------------------------------------------------
// Music: one looping track per theme, plus a battle track for game modes.
// ---------------------------------------------------------------------------

export type MusicTrack = "neon-cyber" | "minimal-calm" | "retro-arcade" | "space-shooter" | "inferno" | "battle";

export class MusicPlayer {
  private enabled = false;
  private volume = 0.35;
  private track: MusicTrack | null = null;
  private howls = new Map<MusicTrack, HowlType>();
  private playing: MusicTrack | null = null;
  private HowlCtor: (new (o: ConstructorParameters<typeof HowlType>[0]) => HowlType) | null = null;

  configure(o: { enabled?: boolean; volume?: number; track?: MusicTrack }): void {
    if (o.enabled !== undefined) this.enabled = o.enabled;
    if (o.volume !== undefined) this.volume = Math.max(0, Math.min(1, o.volume));
    if (o.track !== undefined) this.track = o.track;
    void this.sync();
  }

  private async sync(): Promise<void> {
    if (typeof window === "undefined") return;
    const want = this.enabled && this.volume > 0 ? this.track : null;
    if (want === this.playing) {
      if (want) this.howls.get(want)?.volume(this.volume);
      return;
    }
    // Fade out whatever is playing.
    if (this.playing) {
      const old = this.howls.get(this.playing);
      if (old) {
        old.fade(old.volume(), 0, 600);
        setTimeout(() => old.pause(), 650);
      }
      this.playing = null;
    }
    if (!want) return;
    if (!this.HowlCtor) {
      const m = await import("howler");
      this.HowlCtor = m.Howl;
    }
    // Settings may have changed while Howler loaded.
    if ((this.enabled && this.volume > 0 ? this.track : null) !== want) return;
    let howl = this.howls.get(want);
    if (!howl) {
      howl = new this.HowlCtor({ src: [`/music/${want}.ogg`, `/music/${want}.mp3`], loop: true, volume: 0, html5: false, preload: true });
      this.howls.set(want, howl);
    }
    this.playing = want;
    if (!howl.playing()) howl.play();
    howl.fade(0, this.volume, 1200);
  }
}

export const music = new MusicPlayer();
