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
