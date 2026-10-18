'use strict';

// Everything a band makes is plain data. Player names, connections and the
// playback clock deliberately stay out of the portable arrangement.
const STEPS = 16;
const NOTES = ['C', 'D', 'E', 'G', 'A'];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const empty = () => Array(STEPS).fill(0);
function initial() {
    const drums = [empty(), empty(), empty()];
    [0, 6, 8, 14].forEach(i => { drums[0][i] = 1; });
    [4, 12].forEach(i => { drums[1][i] = 1; });
    [0, 2, 4, 6, 8, 10, 12, 14].forEach(i => { drums[2][i] = 1; });
    return { schema: 1, bpm: 108, drums, bass: [0, -1, -1, 2, -1, -1, 3, -1, 4, -1, -1, 3, -1, -1, 2, -1], tone: 1, space: 0, muted: [false, false, false, false] };
}
function normalize(value) {
    const fallback = initial();
    if (!value || value.schema !== 1) return fallback;
    const integer = (n, lo, hi, otherwise) => Number.isFinite(n) ? clamp(Math.round(n), lo, hi) : otherwise;
    return {
        schema: 1, bpm: integer(value.bpm, 60, 160, fallback.bpm),
        drums: fallback.drums.map((row, r) => Array.from({ length: STEPS }, (_, s) => Array.isArray(value.drums?.[r]) ? Number(value.drums[r][s] === 1) : row[s])),
        bass: Array.from({ length: STEPS }, (_, s) => Array.isArray(value.bass) ? integer(value.bass[s], -1, 4, -1) : fallback.bass[s]),
        tone: integer(value.tone, 0, 2, 1), space: integer(value.space, 0, 2, 0),
        muted: Array.from({ length: 4 }, (_, i) => value.muted?.[i] === true),
    };
}
function readExport(files) {
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(files?.['house-band.json'])); }
    catch (_) { return null; }
}
function soundsAt(arrangement, step) {
    const sounds = [];
    for (let row = 0; row < 3; row++) if (arrangement.drums[row][step] && !arrangement.muted[row]) sounds.push(['kick', 'snare', 'hat'][row]);
    if (arrangement.bass[step] >= 0 && !arrangement.muted[3]) sounds.push('bass' + arrangement.bass[step]);
    return sounds;
}

class Transport {
    constructor() { this.playing = false; this.position = 0; this.last = 0; this.step = -1; }
    start(now) { this.playing = true; this.position = 0; this.last = now; this.step = 0; return 0; }
    stop() { this.playing = false; this.position = 0; this.step = -1; }
    advance(now, bpm) {
        if (!Number.isFinite(now) || !Number.isFinite(bpm) || bpm < 60 || bpm > 160) return null;
        if (!this.playing) { this.last = now; return null; }
        const elapsed = Math.max(0, now - this.last); this.last = Math.max(this.last, now);
        this.position += elapsed * bpm / 15000;
        const absolute = Math.floor(this.position + 1e-8);
        if (absolute === this.step) return null;
        // A stalled/backgrounded host resumes at the current beat. Never emit
        // an avalanche of missed notes, and never accumulate interval drift.
        this.step = absolute;
        this.position %= STEPS;
        this.step %= STEPS;
        return this.step;
    }
}
module.exports = { STEPS, NOTES, clamp, initial, normalize, readExport, soundsAt, Transport };
