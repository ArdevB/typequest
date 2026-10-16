// Generates the built-in key-sound packs as small WAV files (no external assets needed).
// Run: npm run gen:sounds   → public/sounds/<pack>/{key,space,error,combo}.wav
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RATE = 22050;
const OUT = join(process.cwd(), "public", "sounds");

let seed = 1234567;
const noise = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return (seed / 0x7fffffff) * 2 - 1;
};

const buffer = (ms) => new Float32Array(Math.round((RATE * ms) / 1000));
const env = (i, n, attack = 0.002, curve = 6) => {
  const t = i / RATE;
  const a = Math.min(1, t / attack);
  return a * Math.exp((-curve * i) / n);
};

function tone(ms, f0, f1 = f0, wave = "sine", curve = 6, gain = 1) {
  const b = buffer(ms);
  let phase = 0;
  for (let i = 0; i < b.length; i++) {
    const f = f0 + (f1 - f0) * (i / b.length);
    phase += (2 * Math.PI * f) / RATE;
    let v = Math.sin(phase);
    if (wave === "square") v = Math.sign(v) * 0.6;
    if (wave === "saw") v = ((phase / Math.PI) % 2) - 1;
    b[i] = v * env(i, b.length, 0.002, curve) * gain;
  }
  return b;
}

function noiseBurst(ms, curve = 10, gain = 1, lowpass = 0.5) {
  const b = buffer(ms);
  let prev = 0;
  for (let i = 0; i < b.length; i++) {
    prev = prev + lowpass * (noise() - prev);
    b[i] = prev * env(i, b.length, 0.0005, curve) * gain;
  }
  return b;
}

function mix(...parts) {
  const len = Math.max(...parts.map(([b, off = 0]) => b.length + Math.round((off * RATE) / 1000)));
  const out = new Float32Array(len);
  for (const [b, off = 0] of parts) {
    const o = Math.round((off * RATE) / 1000);
    for (let i = 0; i < b.length; i++) out[i + o] += b[i];
  }
  return out;
}

function normalize(b, peak = 0.7) {
  let m = 0;
  for (const v of b) m = Math.max(m, Math.abs(v));
  const k = m > 0 ? peak / m : 1;
  return b.map((v) => v * k);
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.max(-1, Math.min(1, v)) * 32767, i * 2));
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const chime = (notes, wave = "sine", step = 55) =>
  mix(...notes.map((f, i) => [tone(160, f, f, wave, 5, 0.6), i * step]));

const packs = {
  mechanical: {
    key: mix([noiseBurst(28, 9, 1, 0.55)], [tone(35, 180, 120, "sine", 7, 0.8)]),
    space: mix([noiseBurst(40, 8, 0.9, 0.35)], [tone(55, 120, 80, "sine", 6, 1)]),
    error: tone(90, 170, 140, "square", 7, 0.5),
    combo: chime([523, 659, 784]),
  },
  typewriter: {
    key: mix([noiseBurst(10, 14, 1, 0.9)], [tone(60, 2400, 2300, "sine", 12, 0.25), 2]),
    space: mix([noiseBurst(30, 9, 1, 0.4)], [tone(70, 110, 90, "sine", 6, 0.9)]),
    error: mix([tone(220, 1760, 1760, "sine", 4, 0.5)], [tone(220, 2637, 2637, "sine", 5, 0.25)]),
    combo: chime([880, 1109, 1319], "sine", 45),
  },
  bubble: {
    key: tone(60, 420, 900, "sine", 7, 1),
    space: tone(80, 260, 520, "sine", 6, 1),
    error: tone(120, 320, 150, "sine", 5, 1),
    combo: chime([600, 900, 1200]),
  },
  scifi: {
    key: tone(32, 1400, 900, "square", 7, 0.7),
    space: tone(45, 700, 500, "square", 6, 0.7),
    error: tone(140, 400, 120, "saw", 4, 0.6),
    combo: chime([659, 988, 1319], "square", 50),
  },
};

for (const [name, sounds] of Object.entries(packs)) {
  const dir = join(OUT, name);
  mkdirSync(dir, { recursive: true });
  for (const [kind, samples] of Object.entries(sounds)) {
    writeFileSync(join(dir, `${kind}.wav`), wav(normalize(samples)));
  }
}
console.log(`Wrote ${Object.keys(packs).length} sound packs to ${OUT}`);
