#!/usr/bin/env python3
"""
Generates TypeQuest's game sound effects and theme music loops from scratch
(pure synthesis with numpy/scipy — no samples, no licensing questions).

  python3 scripts/make-audio.py          # writes public/sounds/sfx/*.wav and public/music/*.mp3

Requires numpy, scipy and ffmpeg (for MP3 encoding). Output is deterministic.
"""
import os
import subprocess
import tempfile
import wave

import numpy as np
from scipy.signal import butter, fftconvolve, lfilter

SR = 32000
ROOT = os.path.join(os.path.dirname(__file__), "..", "public")
rng = np.random.default_rng(7)


# ---------------------------------------------------------------------------
# Building blocks
# ---------------------------------------------------------------------------

def t_(dur):
    return np.arange(int(dur * SR)) / SR


def note_hz(n):
    """MIDI note number → Hz."""
    return 440.0 * 2 ** ((n - 69) / 12)


def env(n, a=0.005, d=0.1, s=0.6, r=0.1, hold=None):
    """ADSR envelope of n samples. `hold` = seconds before release (default: fill)."""
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    total = n
    hold_n = int(hold * SR) if hold is not None else max(0, total - a_n - d_n - r_n)
    e = np.concatenate([
        np.linspace(0, 1, max(1, a_n), endpoint=False),
        np.linspace(1, s, max(1, d_n), endpoint=False),
        np.full(max(0, hold_n), s),
        np.linspace(s, 0, max(1, r_n)),
    ])
    if len(e) < total:
        e = np.concatenate([e, np.zeros(total - len(e))])
    return e[:total]


def perc(n, decay):
    return np.exp(-np.arange(n) / (decay * SR))


def osc(kind, freq, dur, phase=0.0):
    t = t_(dur)
    if np.isscalar(freq):
        ph = 2 * np.pi * freq * t + phase
    else:
        ph = 2 * np.pi * np.cumsum(freq) / SR + phase
    if kind == "sine":
        return np.sin(ph)
    if kind == "tri":
        return 2 / np.pi * np.arcsin(np.sin(ph))
    if kind == "square":
        # A few odd harmonics: square-ish without harsh aliasing.
        return sum(np.sin(ph * k) / k for k in (1, 3, 5, 7, 9)) * 4 / np.pi * 0.8
    if kind == "pulse":
        return np.sign(np.sin(ph) + 0.4) * 0.6
    if kind == "saw":
        return sum(((-1) ** (k + 1)) * np.sin(ph * k) / k for k in range(1, 14)) * 2 / np.pi * 0.7
    raise ValueError(kind)


def lowpass(x, hz, order=2):
    b, a = butter(order, min(0.99, hz / (SR / 2)), btype="low")
    return lfilter(b, a, x)


def highpass(x, hz, order=2):
    b, a = butter(order, min(0.99, hz / (SR / 2)), btype="high")
    return lfilter(b, a, x)


def bandpass(x, lo, hi, order=2):
    b, a = butter(order, [lo / (SR / 2), min(0.99, hi / (SR / 2))], btype="band")
    return lfilter(b, a, x)


def noise(dur):
    return rng.uniform(-1, 1, int(dur * SR))


def reverb(x, size=1.6, mix=0.25, damp=3500):
    n = int(size * SR)
    ir = rng.uniform(-1, 1, n) * np.exp(-np.arange(n) / (size * SR / 5))
    ir = lowpass(ir, damp)
    ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
    wet = np.zeros(len(x) + n)
    conv = fftconvolve(x, ir)[: len(x) + n]
    wet[: len(conv)] = conv
    out = np.concatenate([x, np.zeros(n)]) * (1 - mix) + wet * mix
    return out


def normalize(x, peak=0.9):
    m = np.max(np.abs(x)) + 1e-9
    return x / m * peak


def write_wav(path, x):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    data = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


def write_mp3(path, x):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        write_wav(tmp.name, x)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp.name, "-codec:a", "libmp3lame", "-b:a", "96k", path], check=True)
        # Ogg Vorbis loops seamlessly (MP3 adds encoder padding); browsers that can play it get it first.
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp.name, "-codec:a", "libvorbis", "-q:a", "3", path.replace(".mp3", ".ogg")], check=True)
        os.unlink(tmp.name)


def mix_at(buf, x, start):
    s = int(start * SR)
    if s >= len(buf):
        return
    e = min(len(buf), s + len(x))
    buf[s:e] += x[: e - s]


# ---------------------------------------------------------------------------
# Sound effects
# ---------------------------------------------------------------------------

def sfx_whoosh():
    d = 0.28
    n = noise(d)
    sweep = np.linspace(2600, 500, len(n))
    out = np.zeros_like(n)
    # Moving band-pass approximated by blocks.
    blocks = 14
    size = len(n) // blocks
    for i in range(blocks):
        f = sweep[i * size]
        seg = bandpass(n, f * 0.6, f * 1.4)[i * size:(i + 1) * size]
        out[i * size:(i + 1) * size] = seg
    shape = np.sin(np.linspace(0, np.pi, len(n))) ** 1.5
    return normalize(out * shape, 0.6)


def thump(d, f0, f1, decay):
    f = np.linspace(f0, f1, int(d * SR))
    return osc("sine", f, d) * perc(int(d * SR), decay)


def sfx_hit():
    d = 0.16
    body = thump(d, 160, 60, 0.05)
    crack = highpass(noise(d), 1500) * perc(int(d * SR), 0.012)
    return normalize(body * 0.9 + crack * 0.7, 0.85)


def sfx_heavy():
    d = 0.42
    body = thump(d, 120, 38, 0.11)
    crack = bandpass(noise(d), 900, 6000) * perc(int(d * SR), 0.025)
    tail = lowpass(noise(d), 700) * perc(int(d * SR), 0.12) * 0.4
    return normalize(reverb(body + crack * 0.8 + tail, 0.5, 0.15)[: int(0.6 * SR)], 0.95)


def sfx_parry():
    d = 0.9
    partials = [(820, 1.0), (1312, 0.7), (2100, 0.5), (2870, 0.35), (3990, 0.2)]
    x = sum(a * np.sin(2 * np.pi * f * t_(d)) * perc(int(d * SR), 0.22 / (1 + i * 0.4)) for i, (f, a) in enumerate(partials))
    click = highpass(noise(d), 3000) * perc(int(d * SR), 0.004)
    return normalize(reverb(x * 0.6 + click, 0.8, 0.2)[: int(1.1 * SR)], 0.8)


def sfx_ko():
    d = 1.6
    boom = thump(d, 90, 28, 0.35)
    crack = bandpass(noise(d), 600, 7000) * perc(int(d * SR), 0.04)
    rumble = lowpass(noise(d), 180) * perc(int(d * SR), 0.5) * 0.7
    return normalize(reverb(boom + crack * 0.9 + rumble, 1.4, 0.3)[: int(2.2 * SR)], 0.95)


def sfx_laser():
    d = 0.14
    f = np.geomspace(2400, 500, int(d * SR))
    x = osc("square", f, d) * perc(int(d * SR), 0.05)
    return normalize(lowpass(x, 5000), 0.45)


def sfx_explode():
    d = 0.9
    n = noise(d)
    x = lowpass(n, 1200) * perc(int(d * SR), 0.18) + lowpass(n, 160) * perc(int(d * SR), 0.35) * 1.4
    x += thump(d, 110, 35, 0.15)
    return normalize(reverb(x, 0.7, 0.2)[: int(1.2 * SR)], 0.85)


def sfx_crash():
    d = 0.6
    x = thump(d, 80, 30, 0.12) + bandpass(noise(d), 300, 3000) * perc(int(d * SR), 0.08) * 0.8
    return normalize(x, 0.85)


def sfx_slam():
    d = 0.35
    return normalize(thump(d, 100, 40, 0.07) + lowpass(noise(d), 600) * perc(int(d * SR), 0.05) * 0.6, 0.8)


def sfx_roar():
    d = 1.1
    vib = 70 + 8 * np.sin(2 * np.pi * 7 * t_(d)) + np.linspace(20, -15, int(d * SR))
    x = osc("saw", vib, d)
    x = lowpass(x * (1 + 0.6 * np.tanh(3 * x)), 900) + bandpass(noise(d), 200, 900) * 0.5
    e = env(len(x), 0.08, 0.3, 0.7, 0.4)
    return normalize(np.tanh(2.2 * x * e), 0.8)


def sfx_levelup():
    d = 0.7
    out = np.zeros(int(d * SR))
    for i, n in enumerate([72, 76, 79, 84]):
        tone = osc("square", note_hz(n), 0.25) * env(int(0.25 * SR), 0.003, 0.05, 0.4, 0.15)
        mix_at(out, lowpass(tone, 6000) * 0.5, i * 0.08)
    return normalize(reverb(out, 0.6, 0.2)[: int(1.0 * SR)], 0.6)


def sfx_engine():
    d = 0.9
    f = np.concatenate([np.linspace(40, 95, int(0.5 * SR)), np.linspace(95, 70, int(0.4 * SR))])
    x = osc("saw", f, d) + 0.5 * osc("square", f * 0.5, d)
    x = lowpass(np.tanh(2 * x), 1100) * env(len(x), 0.02, 0.2, 0.8, 0.3)
    return normalize(x, 0.6)


def sfx_finish():
    # Boxing-style bell.
    d = 1.6
    partials = [(1046, 1.0), (1568, 0.5), (2093, 0.4), (2637, 0.25), (3520, 0.12)]
    x = sum(a * np.sin(2 * np.pi * f * t_(d)) * perc(int(d * SR), 0.6 / (1 + i * 0.3)) for i, (f, a) in enumerate(partials))
    x2 = np.zeros_like(x)
    mix_at(x2, x[: int(0.8 * SR)] * 0.8, 0.18)
    return normalize(reverb(x + x2, 1.0, 0.2)[: int(2.0 * SR)], 0.6)


SFX = {
    "whoosh": sfx_whoosh,
    "hit": sfx_hit,
    "heavy": sfx_heavy,
    "parry": sfx_parry,
    "ko": sfx_ko,
    "laser": sfx_laser,
    "explode": sfx_explode,
    "crash": sfx_crash,
    "slam": sfx_slam,
    "roar": sfx_roar,
    "levelup": sfx_levelup,
    "engine": sfx_engine,
    "finish": sfx_finish,
}


# ---------------------------------------------------------------------------
# Music
# ---------------------------------------------------------------------------

MINOR = [0, 2, 3, 5, 7, 8, 10]
MAJOR = [0, 2, 4, 5, 7, 9, 11]
PHRYGIAN = [0, 1, 3, 5, 7, 8, 10]


def chord_notes(root, scale, degree, size=3):
    """Triad/7th on a scale degree (0-based), as MIDI notes."""
    out = []
    for k in range(size):
        idx = degree + 2 * k
        octave, step = divmod(idx, len(scale))
        out.append(root + scale[step] + 12 * octave)
    return out


def kick(vol=1.0):
    d = 0.35
    return thump(d, 150, 45, 0.09) * vol


def snare(vol=1.0):
    d = 0.25
    tone = osc("tri", 190, d) * perc(int(d * SR), 0.05)
    nz = bandpass(noise(d), 1500, 9000) * perc(int(d * SR), 0.07)
    return (tone * 0.6 + nz) * vol


def clap(vol=1.0):
    d = 0.3
    nz = bandpass(noise(d), 900, 4000)
    e = np.zeros(int(d * SR))
    for off in (0, 0.01, 0.022):
        e[int(off * SR):] += perc(int(d * SR) - int(off * SR), 0.03 if off < 0.02 else 0.09)
    return nz * e * 0.6 * vol


def hat(vol=1.0, open_=False):
    d = 0.3 if open_ else 0.06
    return highpass(noise(d), 7000) * perc(int(d * SR), 0.12 if open_ else 0.015) * vol


def tom(n, vol=1.0):
    d = 0.4
    f = np.linspace(note_hz(n) * 1.5, note_hz(n), int(d * SR))
    return osc("sine", f, d) * perc(int(d * SR), 0.12) * vol


def voice(kind, n, dur, vol=1.0, cutoff=None, a=0.005, d=0.12, s=0.6, r=0.08, detune=0.0):
    f = note_hz(n)
    x = osc(kind, f, dur)
    if detune:
        x = 0.5 * x + 0.5 * osc(kind, f * (1 + detune), dur, 1.0)
    if cutoff:
        x = lowpass(x, cutoff)
    return x * env(len(x), a, d, s, r) * vol


def epiano(n, dur, vol=1.0):
    f = note_hz(n)
    t = t_(dur)
    x = np.sin(2 * np.pi * f * t + 0.8 * np.sin(2 * np.pi * f * 2 * t) * perc(len(t), 0.4))
    return x * perc(len(t), 0.9) * env(len(t), 0.002, 0.1, 1, 0.1) * vol


class Track:
    def __init__(self, bpm, bars, beats=4):
        self.bpm = bpm
        self.beat = 60 / bpm
        self.bars = bars
        self.beats = beats
        self.length = bars * beats * self.beat
        self.tail = 2.5
        self.buses = {}

    def bus(self, name):
        if name not in self.buses:
            self.buses[name] = np.zeros(int((self.length + self.tail) * SR))
        return self.buses[name]

    def at(self, bar, beat):
        return (bar * self.beats + beat) * self.beat

    def add(self, bus, x, bar, beat):
        mix_at(self.bus(bus), x, self.at(bar, beat))

    def render(self, fx):
        """fx: {bus: (gain, reverb_size, reverb_mix, duck)} → seamless loop."""
        n = int(self.length * SR)
        total = np.zeros(int((self.length + self.tail + 3) * SR))
        kick_env = None
        if "kick" in self.buses:
            # Sidechain-style pump from the kick bus.
            k = np.abs(self.buses["kick"])
            kick_env = 1 - 0.55 * np.clip(lowpass(k, 12) * 6, 0, 1)
        for name, x in self.buses.items():
            gain, rsize, rmix, duck = fx.get(name, (1.0, 0, 0, False))
            y = x * gain
            if duck and kick_env is not None:
                y = y * kick_env[: len(y)]
            if rsize:
                y = reverb(y, rsize, rmix)
            total[: len(y)] += y
        # Fold the tail back onto the start so the loop is seamless.
        loop = total[:n].copy()
        tail = total[n:]
        loop[: len(tail)] += tail[: len(loop)]
        # Gentle master: soft clip + normalize.
        loop = np.tanh(loop / (np.max(np.abs(loop)) + 1e-9) * 1.4)
        return normalize(loop, 0.85)


def melody(rng_, scale, root, steps, density=0.6, span=(0, 9)):
    """A simple motif-based melody: (step_index, degree, length_in_steps)."""
    notes = []
    deg = 4
    i = 0
    while i < steps:
        if rng_.random() < density:
            deg = int(np.clip(deg + rng_.choice([-2, -1, -1, 1, 1, 2, 0, 3, -3]), *span))
            length = int(rng_.choice([1, 1, 2, 2, 3, 4]))
            notes.append((i, deg, length))
            i += length
        else:
            i += 1
    return notes


def deg_note(root, scale, deg):
    octave, step = divmod(deg, len(scale))
    return root + scale[step] + 12 * octave


def music_neon():
    tr = Track(100, 16)
    root, scale = 57, MINOR  # A minor
    prog = [0, 5, 2, 6]  # i VI III VII
    r = np.random.default_rng(1)
    mel = melody(r, scale, root + 12, 64, 0.55)
    for bar in range(tr.bars):
        deg = prog[(bar // 1) % 4]
        ch = chord_notes(root, scale, deg, 3)
        # Pad.
        tr.add("pad", sum(voice("saw", n, tr.beat * 4.2, 0.18, 1400, a=0.4, d=0.5, s=0.8, r=0.5, detune=0.006) for n in ch), bar, 0)
        for b8 in range(8):
            # Pumping octave bass.
            n = ch[0] - 12 + (12 if b8 % 2 else 0)
            tr.add("bass", voice("saw", n, tr.beat * 0.45, 0.5, 700, d=0.08, s=0.5, r=0.05), bar, b8 / 2)
            tr.add("hat", hat(0.35 if b8 % 2 else 0.2), bar, b8 / 2 + 0.5 if False else b8 / 2)
        for b16 in range(16):
            if bar >= 2:
                n = ch[b16 % 3] + 12 + (12 if b16 % 8 >= 6 else 0)
                tr.add("arp", voice("square", n, tr.beat * 0.22, 0.22, 3000, d=0.05, s=0.3, r=0.04), bar, b16 / 4)
        for b in range(4):
            tr.add("kick", kick(0.95), bar, b)
            if b in (1, 3) and bar >= 1:
                tr.add("snare", snare(0.7), bar, b)
    if True:
        for step, deg, length in mel:
            bar = 8 + step // 16
            if bar >= tr.bars:
                continue
            beat = (step % 16) / 4
            n = deg_note(root + 12, scale, deg)
            tr.add("lead", voice("saw", n, tr.beat * length / 4 * 0.95, 0.3, 2600, a=0.01, d=0.15, s=0.7, r=0.12, detune=0.004), bar, beat)
    return tr.render({
        "pad": (0.9, 2.2, 0.35, True), "bass": (1.0, 0, 0, True), "arp": (0.8, 1.2, 0.3, True),
        "kick": (1.0, 0, 0, False), "snare": (0.42, 1.3, 0.2, False), "hat": (0.35, 0, 0, False), "lead": (0.9, 1.6, 0.35, True),
    })


def music_calm():
    tr = Track(76, 8)
    root, scale = 53, MAJOR  # F major
    prog = [0, 2, 1, 3]  # I iii ii IV, as 7ths
    r = np.random.default_rng(2)
    mel = melody(r, scale, root + 12, 64, 0.35, (2, 10))
    for bar in range(tr.bars):
        ch = chord_notes(root, scale, prog[bar % 4], 4)
        for beat in (0, 1.5, 2.5):
            tr.add("keys", sum(epiano(n, tr.beat * 2.5, 0.22) for n in ch), bar, beat + (0.02 if beat else 0))
        tr.add("bass", voice("sine", ch[0] - 12, tr.beat * 1.8, 0.5, None, a=0.01, d=0.3, s=0.5, r=0.2), bar, 0)
        tr.add("bass", voice("sine", ch[2] - 12, tr.beat * 1.4, 0.4, None, a=0.01, d=0.3, s=0.5, r=0.2), bar, 2.5)
        for b8 in range(8):
            tr.add("hat", hat(0.12 + (0.05 if b8 % 2 else 0)), bar, b8 / 2 + (0.08 if b8 % 2 else 0))
        tr.add("kick", kick(0.45), bar, 0)
        tr.add("kick", kick(0.3), bar, 2.5)
        tr.add("snare", clap(0.35), bar, 1)
        tr.add("snare", clap(0.35), bar, 3)
    for step, deg, length in mel:
        bar = step // 16
        if bar >= tr.bars or bar < 2:
            continue
        n = deg_note(root + 12, scale, deg)
        tr.add("lead", epiano(n, tr.beat * length / 4 + 0.4, 0.28), bar, (step % 16) / 4)
    crackle = np.zeros(int((tr.length + tr.tail) * SR))
    idx = rng.integers(0, len(crackle), 900)
    crackle[idx] = rng.uniform(-0.25, 0.25, 900)
    tr.buses["vinyl"] = highpass(crackle, 2000)
    return tr.render({
        "keys": (0.9, 1.8, 0.3, False), "bass": (0.8, 0, 0, False), "hat": (0.5, 0, 0, False), "kick": (0.7, 0, 0, False),
        "snare": (0.5, 1.2, 0.25, False), "lead": (0.8, 2.0, 0.35, False), "vinyl": (0.35, 0, 0, False),
    })


def music_retro():
    tr = Track(140, 16)
    root, scale = 60, MINOR  # C minor
    prog = [0, 5, 3, 4]
    r = np.random.default_rng(3)
    mel = melody(r, scale, root + 12, 128, 0.7, (0, 11))
    for bar in range(tr.bars):
        ch = chord_notes(root, scale, prog[(bar // 2) % 4], 3)
        for b8 in range(8):
            n = ch[0] - 12 if b8 % 4 != 3 else ch[1] - 12
            tr.add("bass", voice("pulse", n, tr.beat * 0.4, 0.35, 2500, d=0.04, s=0.7, r=0.02), bar, b8 / 2)
        for b16 in range(16):
            n = ch[b16 % 3] + 12
            tr.add("arp", voice("tri", n, tr.beat * 0.2, 0.25, None, d=0.03, s=0.5, r=0.02), bar, b16 / 4)
        for b in range(4):
            tr.add("kick", kick(0.8), bar, b if b % 2 == 0 else b)
            if b % 2:
                tr.add("snare", lowpass(noise(0.12), 6000) * perc(int(0.12 * SR), 0.04) * 0.6, bar, b)
            tr.add("hat", highpass(noise(0.03), 8000) * perc(int(0.03 * SR), 0.01) * 0.35, bar, b + 0.5)
    for step, deg, length in mel:
        bar = 4 + step // 16
        if bar >= tr.bars:
            continue
        n = deg_note(root + 12, scale, deg)
        tr.add("lead", voice("square", n, tr.beat * length / 4 * 0.9, 0.3, 5000, a=0.002, d=0.05, s=0.8, r=0.03), bar, (step % 16) / 4)
    return tr.render({
        "bass": (1.0, 0, 0, False), "arp": (0.6, 0, 0, False), "kick": (0.9, 0, 0, False), "snare": (0.8, 0, 0, False),
        "hat": (0.6, 0, 0, False), "lead": (0.8, 0.5, 0.15, False),
    })


def music_space():
    tr = Track(110, 16)
    root, scale = 50, MINOR  # D minor
    prog = [0, 6, 5, 3]
    for bar in range(tr.bars):
        ch = chord_notes(root, scale, prog[(bar // 2) % 4], 4)
        if bar % 2 == 0:
            tr.add("pad", sum(voice("saw", n + 12, tr.beat * 8.4, 0.12, 900, a=1.2, d=1.0, s=0.8, r=1.2, detune=0.008) for n in ch), bar, 0)
        for b16 in range(16):
            tr.add("bass", voice("saw", ch[0] - 12, tr.beat * 0.2, 0.4, 500 + 300 * (b16 % 4 == 0), d=0.04, s=0.4, r=0.03), bar, b16 / 4)
        if bar >= 4:
            for b8 in range(8):
                n = ch[(b8 * 2) % 4] + 24
                tr.add("arp", voice("sine", n, tr.beat * 0.4, 0.2, None, d=0.1, s=0.3, r=0.2), bar, b8 / 2)
        for b in range(4):
            tr.add("kick", kick(0.7), bar, b)
            if b in (1, 3) and bar >= 2:
                tr.add("snare", clap(0.6), bar, b)
            tr.add("hat", hat(0.25), bar, b + 0.5)
    return tr.render({
        "pad": (1.0, 3.0, 0.5, True), "bass": (0.9, 0, 0, True), "arp": (0.8, 2.4, 0.5, False),
        "kick": (0.9, 0, 0, False), "snare": (0.4, 1.6, 0.3, False), "hat": (0.35, 0, 0, False),
    })


def music_inferno():
    tr = Track(128, 16)
    root, scale = 40, PHRYGIAN  # E phrygian
    riff = [0, 0, 1, 0, 0, 3, 0, 1, 0, 0, 5, 4, 3, 1, 0, 1]
    for bar in range(tr.bars):
        for b16 in range(16):
            deg = riff[b16]
            n = deg_note(root, scale, deg)
            x = voice("saw", n, tr.beat * 0.24, 0.5, 1800, d=0.05, s=0.6, r=0.03, detune=0.01)
            tr.add("riff", np.tanh(3 * x), bar, b16 / 4)
        if bar % 4 == 0:
            ch = chord_notes(root + 12, scale, 0, 3)
            tr.add("choir", sum(lowpass(voice("saw", n + 12, tr.beat * 16, 0.1, 800, a=1.5, d=1, s=0.8, r=1.5, detune=0.012), 900) for n in ch), bar, 0)
        for b in range(4):
            tr.add("kick", kick(1.0), bar, b)
            tr.add("kick", kick(0.6), bar, b + 0.75) if b % 2 else None
            if b in (1, 3):
                tr.add("snare", snare(0.9), bar, b)
            tr.add("hat", hat(0.25), bar, b + 0.5)
        if bar % 4 == 3:
            for i, n in enumerate([50, 47, 45, 43]):
                tr.add("toms", tom(n, 0.8), bar, 3 + i * 0.25)
    return tr.render({
        "riff": (0.8, 0.6, 0.15, True), "choir": (0.9, 2.5, 0.45, False), "kick": (1.0, 0, 0, False),
        "snare": (0.45, 1.0, 0.18, False), "hat": (0.35, 0, 0, False), "toms": (0.7, 1.0, 0.2, False),
    })


def music_battle():
    tr = Track(150, 16)
    root, scale = 45, MINOR  # A minor
    prog = [0, 0, 5, 6]
    r = np.random.default_rng(6)
    mel = melody(r, scale, root + 24, 96, 0.65, (0, 9))
    for bar in range(tr.bars):
        ch = chord_notes(root, scale, prog[(bar // 2) % 4], 3)
        for b8 in range(8):
            n = ch[0] - 12 + (7 if b8 in (3, 6) else 0)
            x = voice("saw", n, tr.beat * 0.45, 0.5, 900, d=0.05, s=0.6, r=0.04)
            tr.add("bass", np.tanh(2.5 * x), bar, b8 / 2)
        for b in (0, 1.5, 3):
            tr.add("stab", sum(voice("saw", n + 12, tr.beat * 0.3, 0.2, 2500, d=0.08, s=0.3, r=0.05, detune=0.006) for n in ch), bar, b)
        for b in range(4):
            tr.add("kick", kick(1.0), bar, b)
            if b in (1, 3):
                tr.add("snare", snare(0.85), bar, b)
            tr.add("hat", hat(0.3), bar, b + 0.5)
            tr.add("hat", hat(0.15), bar, b + 0.25)
        if bar % 4 == 3:
            for i, n in enumerate([57, 52, 50, 45]):
                tr.add("toms", tom(n, 0.8), bar, 3 + i * 0.25)
    for step, deg, length in mel:
        bar = 8 + step // 16
        if bar >= tr.bars:
            continue
        n = deg_note(root + 24, scale, deg)
        tr.add("lead", voice("square", n, tr.beat * length / 4 * 0.9, 0.25, 4000, a=0.003, d=0.08, s=0.7, r=0.05, detune=0.005), bar, (step % 16) / 4)
    return tr.render({
        "bass": (1.0, 0, 0, True), "stab": (0.9, 1.0, 0.25, True), "kick": (1.0, 0, 0, False), "snare": (0.45, 1.0, 0.2, False),
        "hat": (0.35, 0, 0, False), "toms": (0.8, 1.0, 0.25, False), "lead": (0.7, 1.2, 0.3, True),
    })


MUSIC = {
    "neon-cyber": music_neon,
    "minimal-calm": music_calm,
    "retro-arcade": music_retro,
    "space-shooter": music_space,
    "inferno": music_inferno,
    "battle": music_battle,
}


if __name__ == "__main__":
    for name, fn in SFX.items():
        write_wav(os.path.join(ROOT, "sounds", "sfx", f"{name}.wav"), fn())
        print("sfx", name)
    for name, fn in MUSIC.items():
        write_mp3(os.path.join(ROOT, "music", f"{name}.mp3"), fn())
        print("music", name)
