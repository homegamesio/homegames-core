// Dependency-free audio synthesizer for generating WAV files with Node.
// Everything renders to Float32Array sample buffers at 44.1kHz, then gets
// written out as 16-bit PCM WAV.

const fs = require('fs');

const SR = 44100;
const TAU = Math.PI * 2;

// --- deterministic RNG so regenerating the catalog produces identical files ---
const makeRng = (seed) => {
    let a = seed >>> 0;
    return () => {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

// --- core rendering ---

// render(dur, fn) -> Float32Array. fn(t, i) returns a sample.
const render = (dur, fn) => {
    const n = Math.round(dur * SR);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        out[i] = fn(i / SR, i);
    }
    return out;
};

// Phase-accumulating oscillator; freq can be a number or fn(t) for sweeps.
const osc = (type, freq) => {
    let phase = 0;
    const freqFn = typeof freq === 'function' ? freq : () => freq;
    return (t) => {
        phase += freqFn(t) / SR;
        const p = phase - Math.floor(phase);
        switch (type) {
            case 'sine': return Math.sin(TAU * p);
            case 'square': return p < 0.5 ? 1 : -1;
            case 'saw': return 2 * p - 1;
            case 'triangle': return 4 * Math.abs(p - 0.5) - 1;
            default: throw new Error(`unknown osc type ${type}`);
        }
    };
};

// --- noise sources (each returns a fn() -> sample) ---

const whiteNoise = (rng) => () => rng() * 2 - 1;

// Paul Kellet pink noise approximation
const pinkNoise = (rng) => {
    let b0 = 0, b1 = 0, b2 = 0;
    return () => {
        const w = rng() * 2 - 1;
        b0 = 0.99765 * b0 + w * 0.0990460;
        b1 = 0.96300 * b1 + w * 0.2965164;
        b2 = 0.57000 * b2 + w * 1.0526913;
        return (b0 + b1 + b2 + w * 0.1848) * 0.2;
    };
};

const brownNoise = (rng) => {
    let acc = 0;
    return () => {
        acc = (acc + (rng() * 2 - 1) * 0.02) * 0.997;
        return acc * 8;
    };
};

// --- filters (stateful, sample-by-sample) ---

const onePoleLP = (cutoff) => {
    let y = 0;
    const cutoffFn = typeof cutoff === 'function' ? cutoff : () => cutoff;
    return (x, t) => {
        const a = 1 - Math.exp(-TAU * Math.min(cutoffFn(t), SR / 2.5) / SR);
        y += a * (x - y);
        return y;
    };
};

const onePoleHP = (cutoff) => {
    const lp = onePoleLP(cutoff);
    return (x, t) => x - lp(x, t);
};

// State-variable filter; returns band-pass output. Good for wind/whooshes.
const svfBandPass = (cutoff, q) => {
    let low = 0, band = 0;
    const cutoffFn = typeof cutoff === 'function' ? cutoff : () => cutoff;
    return (x, t) => {
        const f = 2 * Math.sin(Math.PI * Math.min(cutoffFn(t), SR / 6) / SR);
        low += f * band;
        const high = x - low - band / q;
        band += f * high;
        return band;
    };
};

// --- envelopes ---

const expDecay = (rate) => (t) => Math.exp(-t * rate);

const adsr = (a, d, s, r, dur) => (t) => {
    if (t < a) return t / a;
    if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
    if (t < dur - r) return s;
    if (t < dur) return s * (1 - (t - (dur - r)) / r);
    return 0;
};

// Smooth attack/release window over a whole buffer duration.
const fadeWindow = (attack, release, dur) => (t) => {
    let g = 1;
    if (t < attack) g = t / attack;
    if (t > dur - release) g = Math.min(g, Math.max(0, (dur - t) / release));
    return g;
};

// --- buffer operations ---

const mixAt = (dest, src, offsetSec = 0, gain = 1) => {
    const off = Math.round(offsetSec * SR);
    for (let i = 0; i < src.length && off + i < dest.length; i++) {
        dest[off + i] += src[i] * gain;
    }
    return dest;
};

const gainBuf = (buf, g) => {
    for (let i = 0; i < buf.length; i++) buf[i] *= g;
    return buf;
};

const normalize = (buf, peak = 0.85) => {
    let max = 0;
    for (let i = 0; i < buf.length; i++) max = Math.max(max, Math.abs(buf[i]));
    if (max === 0) return buf;
    return gainBuf(buf, peak / max);
};

const softClip = (buf, drive = 1) => {
    for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(buf[i] * drive);
    return buf;
};

// Feedback delay, mixed back into the buffer. Cheap echo/space.
const echo = (buf, timeSec, feedback = 0.35, mix = 0.3) => {
    const d = Math.round(timeSec * SR);
    const out = new Float32Array(buf.length);
    for (let i = 0; i < buf.length; i++) {
        const delayed = i >= d ? out[i - d] : 0;
        out[i] = buf[i] + delayed * feedback;
        buf[i] = buf[i] + delayed * mix;
    }
    return buf;
};

// Mix src into dest starting at offsetSec, wrapping past the end back to the
// start — keeps scheduled events/echo tails seamless in looping buffers.
const mixWrap = (dest, src, offsetSec = 0, gain = 1) => {
    const off = Math.round(offsetSec * SR);
    for (let i = 0; i < src.length; i++) {
        dest[(off + i) % dest.length] += src[i] * gain;
    }
    return dest;
};

// Echo whose taps wrap around the loop boundary.
const echoWrap = (buf, timeSec, gainPer = 0.4, taps = 3) => {
    const src = Float32Array.from(buf);
    const d = Math.round(timeSec * SR);
    for (let tap = 1; tap <= taps; tap++) {
        const g = Math.pow(gainPer, tap);
        const off = (d * tap) % buf.length;
        for (let i = 0; i < buf.length; i++) {
            buf[(i + off) % buf.length] += src[i] * g;
        }
    }
    return buf;
};

// Render (dur + wrap) seconds, then crossfade the tail onto the head so the
// buffer loops seamlessly.
const makeLoop = (dur, wrapSec, fn) => {
    const full = render(dur + wrapSec, fn);
    const n = Math.round(dur * SR);
    const w = Math.round(wrapSec * SR);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = full[i];
    for (let i = 0; i < w; i++) {
        const fade = i / w;
        out[i] = out[i] * fade + full[n + i] * (1 - fade);
    }
    return out;
};

// --- musical helpers ---

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Render a note sequence: [{ note (midi), at (sec), dur, gain }]
// voiceFn(freq, dur) must return a Float32Array.
const sequence = (totalDur, notes, voiceFn) => {
    const out = new Float32Array(Math.round(totalDur * SR));
    for (const { note, at, dur, gain = 1 } of notes) {
        mixAt(out, voiceFn(mtof(note), dur), at, gain);
    }
    return out;
};

// --- WAV output ---

const writeWav = (filePath, channels) => {
    const numCh = channels.length;
    const n = channels[0].length;
    const dataSize = n * numCh * 2;
    const buf = Buffer.alloc(44 + dataSize);
    buf.write('RIFF', 0);
    buf.writeUInt32LE(36 + dataSize, 4);
    buf.write('WAVE', 8);
    buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(numCh, 22);
    buf.writeUInt32LE(SR, 24);
    buf.writeUInt32LE(SR * numCh * 2, 28);
    buf.writeUInt16LE(numCh * 2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write('data', 36);
    buf.writeUInt32LE(dataSize, 40);
    let o = 44;
    for (let i = 0; i < n; i++) {
        for (let c = 0; c < numCh; c++) {
            const s = Math.max(-1, Math.min(1, channels[c][i]));
            buf.writeInt16LE(Math.round(s * 32767), o);
            o += 2;
        }
    }
    fs.writeFileSync(filePath, buf);
};

module.exports = {
    SR, TAU, makeRng, render, osc,
    whiteNoise, pinkNoise, brownNoise,
    onePoleLP, onePoleHP, svfBandPass,
    expDecay, adsr, fadeWindow,
    mixAt, mixWrap, gainBuf, normalize, softClip, echo, echoWrap, makeLoop,
    mtof, sequence, writeWav
};
