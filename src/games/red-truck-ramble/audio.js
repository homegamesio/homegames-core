const { Asset, GameNode } = require('squish-150');

const RATE = 22050;
const TAU = Math.PI * 2;
const ENGINE_SECONDS = .72;
const ENGINE_INTERVAL = .62;
const KEY_REST = .1;
const CUES = {
    engine_low: { duration: ENGINE_SECONDS, peak: .029, engine: true, rpm: 47, gravel: .22 },
    engine_cruise: { duration: ENGINE_SECONDS, peak: .029, engine: true, rpm: 62, gravel: .35 },
    engine_fast: { duration: ENGINE_SECONDS, peak: .029, engine: true, rpm: 78, gravel: .48 },
    engine_air: { duration: ENGINE_SECONDS, peak: .027, engine: true, rpm: 72, gravel: 0 },
    land: { duration: .39, peak: .024, gap: .13 },
    flip: { duration: .7, peak: .024, gap: .48 },
    horn: { duration: .7, peak: .024, gap: .55 },
};

function seeded(seed) {
    let state = seed >>> 0;
    return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2147483648 - 1; };
}
function envelope(t, start, end, attack, release) {
    if (t <= start || t >= end) return 0;
    return Math.min(1, (t - start) / attack, (end - t) / release);
}
function contact(t, at, frequency, decay) {
    const age = t - at;
    return age <= 0 ? 0 : Math.sin(TAU * frequency * age) * Math.exp(-age / decay) * Math.min(1, age / .004);
}

// Original synthetic diesel, tire gravel, suspension, air and horn sounds.
// All oscillators and seeded noise are generated locally; no files or downloads.
function makeWav(name) {
    const cue = CUES[name], count = Math.ceil(cue.duration * RATE), samples = new Float32Array(count);
    const noise = seeded(52139 + Object.keys(CUES).indexOf(name) * 991);
    let low = 0, medium = 0, upper = 0, peak = 0;
    for (let i = 0; i < count; i++) {
        const t = i / RATE, white = noise();
        low += .024 * (white - low); medium += .15 * (white - medium); upper += .48 * (white - upper);
        let sample = 0;
        if (cue.engine) {
            // Slightly uneven combustion plus casing modes remain audible on small speakers.
            const phase = TAU * (cue.rpm * t + .04 * Math.sin(TAU * 9.4 * t) + .012 * Math.sin(TAU * 23 * t));
            const combustion = Math.sin(phase) * .47 + Math.sin(phase * 2) * .26
                + Math.sin(phase * 3) * .15 + Math.sin(phase * 5) * .065;
            const pulse = .84 + .1 * Math.sin(TAU * 13.2 * t) + low * .3;
            const casing = Math.sin(TAU * 169 * t) * .055 + Math.sin(TAU * 277 * t) * .035;
            const grit = (medium - low) * (1.2 + 2.1 * Math.pow(Math.sin(TAU * 17.3 * t + .6), 10));
            const tire = cue.gravel * grit + (cue.gravel ? medium * .11 : (upper - medium) * .08);
            sample = ((combustion + casing + medium * .19) * pulse + tire)
                * envelope(t, 0, cue.duration, .095, .1);
        } else if (name === 'land') {
            const spring = contact(t, .015, 79, .062) * .78 + contact(t, .025, 153, .042) * .24;
            const body = contact(t, .024, 307, .017) * .075;
            const tires = medium * envelope(t, .004, .19, .008, .17) * 1.1;
            const rebound = contact(t, .15, 107, .047) * .17;
            sample = spring + body + tires + rebound;
        } else if (name === 'flip') {
            // A soft sweeping rush and low flutter mark a flip without a sharp arcade beep.
            const on = envelope(t, .015, .68, .16, .24);
            const flutter = .68 + .2 * Math.sin(TAU * (7 * t + 8 * t * t));
            sample = on * ((upper - medium) * .66 + medium * .35) * flutter
                + contact(t, .47, 194, .07) * .10 + contact(t, .50, 291, .06) * .065;
        } else if (name === 'horn') {
            // Two friendly low horn notes, each with warm rounded harmonics.
            for (const [start, end, f] of [[.015, .29, 220], [.32, .675, 277.18]]) {
                const on = envelope(t, start, end, .035, .065), age = Math.max(0, t - start);
                const phase = TAU * f * (age + .001 * Math.sin(TAU * 5 * age));
                sample += on * (Math.sin(phase) * .73 + Math.sin(phase * 2) * .19 + Math.sin(phase * 3) * .08);
            }
        }
        const edge = Math.min(1, i / (RATE * .008), (count - 1 - i) / (RATE * .018));
        samples[i] = sample * edge; peak = Math.max(peak, Math.abs(samples[i]));
    }
    const bytes = new Uint8Array(44 + count * 2), view = new DataView(bytes.buffer);
    const text = (value, at) => { for (let i = 0; i < value.length; i++) bytes[at + i] = value.charCodeAt(i); };
    text('RIFF', 0); view.setUint32(4, bytes.length - 8, true); text('WAVEfmt ', 8);
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, RATE, true); view.setUint32(28, RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    text('data', 36); view.setUint32(40, count * 2, true);
    const gain = cue.peak / (peak || 1);
    for (let i = 0; i < count; i++) view.setInt16(44 + i * 2, Math.round(samples[i] * gain * 32767), true);
    return bytes;
}

class TruckAudio {
    constructor(root) {
        this.root = root; this.assets = {}; this.voices = []; this.time = 0; this.enabled = true; this.closed = false;
        this.driving = false; this.nextEngine = 0; this.nextEffect = {};
        for (const [name, cue] of Object.entries(CUES)) {
            const data = makeWav(name);
            for (let copy = 0; copy < 2; copy++) {
                const key = `red_truck_ramble_${name}_${copy}`, node = new GameNode.Asset({ assetInfo: {} });
                node.node.asset = undefined; this.assets[key] = new Asset({ id: key, type: 'audio' }, data);
                this.voices.push({ key, name, node, duration: cue.duration, engine: !!cue.engine, active: false, until: 0, ready: 0, started: 0 });
            }
        }
    }
    _end(voice) {
        voice.active = false; voice.node.node.asset = undefined; voice.ready = this.time + KEY_REST;
    }
    _start(name) {
        if (!this.enabled || this.closed || this.voices.filter(v => v.active).length >= 4) return false;
        const voice = this.voices.find(v => v.name === name && !v.active && v.ready <= this.time);
        if (!voice) return false;
        voice.active = true; voice.started = this.time; voice.until = this.time + voice.duration;
        voice.node.node.asset = { [voice.key]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 } };
        this.sync(); return true;
    }
    play(name) {
        const cue = CUES[name];
        if (!cue || cue.engine || !this.enabled || this.closed || (this.nextEffect[name] || 0) > this.time) return false;
        if (!this._start(name)) return false;
        this.nextEffect[name] = this.time + cue.gap; return true;
    }
    tick(dt, state = {}) {
        if (this.closed) return;
        this.time += Number.isFinite(dt) && dt > 0 ? dt : 0;
        let changed = false;
        for (const voice of this.voices) if (voice.active && voice.until <= this.time) { this._end(voice); changed = true; }
        const driving = this.enabled && !!state.driving;
        if (!driving) {
            for (const voice of this.voices) if (voice.active && voice.engine) { this._end(voice); changed = true; }
            this.nextEngine = this.time;
        }
        if (changed) this.sync();
        if (driving && this.time >= this.nextEngine) {
            const speed = Number.isFinite(state.speed) ? Math.abs(state.speed) : 0;
            const name = state.grounded === false ? 'engine_air' : speed < 6 ? 'engine_low' : speed < 18 ? 'engine_cruise' : 'engine_fast';
            const engines = this.voices.filter(v => v.active && v.engine);
            // At most two loop segments overlap. Never catch up a backlog after a paused frame.
            if (engines.length < 2 && this._start(name)) this.nextEngine = this.time + ENGINE_INTERVAL;
        }
        this.driving = driving;
    }
    sync() { this.root.node.children = this.voices.filter(v => v.active).map(v => v.node); this.root.node.onStateChange(); }
    setEnabled(enabled) {
        if (this.closed) return;
        this.enabled = !!enabled;
        if (!this.enabled) {
            for (const voice of this.voices) if (voice.active) this._end(voice);
            this.driving = false; this.nextEngine = this.time; this.sync();
        }
    }
    mute() { this.setEnabled(false); }
    close() {
        if (this.closed) return;
        this.mute(); this.closed = true;
    }
}
module.exports = { TruckAudio, CUES, RATE, makeWav };
