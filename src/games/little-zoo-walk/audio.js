const { Asset, GameNode } = require('squish-150');
const RATE = 22050, TAU = Math.PI * 2;
const CUES = { elephant: 1.2, giraffe: .9, lion: 1.25, penguin: .8, monkey: 1.1, zebra: 1.1, walk: .8 };
// Original, softly voiced animal impressions and footsteps; no downloaded recordings.
function makeSound(name, duration) {
    const samples = new Float32Array(Math.ceil(duration * RATE));
    let seed = 773, phase = 0, low = 0, peak = 0;
    for (let i = 0; i < samples.length; i++) {
        const t = i / RATE, p = t / duration;
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const white = seed / 2147483648 - 1; low += .12 * (white - low);
        const edge = Math.min(1, t / .06, (duration - t) / .12);
        let frequency = 100, signal = 0;
        if (name === 'elephant') {
            frequency = 235 + 170 * Math.sin(Math.PI * p) + 12 * Math.sin(t * 39);
            phase += TAU * frequency / RATE;
            signal = (Math.sin(phase) + .42 * Math.sin(phase * 2) + .18 * Math.sin(phase * 3)) * Math.pow(Math.sin(Math.PI * p), .7);
        } else if (name === 'lion') {
            frequency = 69 + 20 * Math.sin(Math.PI * p); phase += TAU * frequency / RATE;
            signal = (Math.sin(phase) * .6 + Math.sin(phase * 2) * .25 + low * 2.2) * (.65 + .35 * Math.pow(Math.sin(t * 32), 2));
        } else if (name === 'giraffe') {
            // Giraffes are quiet: a gentle low hum instead of an invented loud roar.
            frequency = 95 + 10 * Math.sin(p * Math.PI); phase += TAU * frequency / RATE;
            signal = (Math.sin(phase) + .26 * Math.sin(phase * 2)) * Math.sin(Math.PI * p);
        } else if (name === 'monkey') {
            const pulse = t % .32, env = Math.pow(Math.max(0, Math.sin(pulse / .25 * Math.PI)), 2);
            frequency = 390 + 210 * Math.sin(pulse * 11); phase += TAU * frequency / RATE;
            signal = (Math.sin(phase) + .3 * Math.sin(phase * 2)) * env;
        } else if (name === 'penguin') {
            const pulse = t % .32;
            frequency = 440 - 180 * pulse + 25 * Math.sin(t * 42); phase += TAU * frequency / RATE;
            signal = (Math.sin(phase) * .5 + Math.sin(phase * 2) * .35 + low * .7) * Math.max(0, Math.sin(pulse / .27 * Math.PI));
        } else {
            const at = name === 'walk' ? [0, .21, .42, .63] : [0, .13, .43, .56, .84];
            for (const hit of at) {
                const age = t - hit;
                if (age >= 0) signal += (Math.sin(TAU * (name === 'walk' ? 150 : 340) * age) * .7 + low * .7) * Math.exp(-age * (name === 'walk' ? 39 : 64)) * Math.min(1, age / .006);
            }
        }
        samples[i] = signal * Math.max(0, edge); peak = Math.max(peak, Math.abs(samples[i]));
    }
    const bytes = new Uint8Array(44 + samples.length * 2), view = new DataView(bytes.buffer);
    const str = (s, start) => [...s].forEach((c, i) => { bytes[start + i] = c.charCodeAt(0); });
    str('RIFF', 0); view.setUint32(4, bytes.length - 8, true); str('WAVEfmt ', 8);
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, RATE, true); view.setUint32(28, RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    str('data', 36); view.setUint32(40, samples.length * 2, true);
    const gain = (name === 'walk' ? .033 : .052) / (peak || 1);
    for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, Math.round(samples[i] * gain * 32767), true);
    return bytes;
}
class ZooAudio {
    constructor(root) {
        this.root = root; this.time = 0; this.assets = {}; this.voices = []; this.closed = false;
        for (const [name, duration] of Object.entries(CUES)) {
            const bytes = makeSound(name, duration);
            for (let copy = 0; copy < 2; copy++) {
                const key = `little_zoo_${name}_${copy}`, node = new GameNode.Asset({ assetInfo: {} });
                node.node.asset = undefined;
                this.assets[key] = new Asset({ id: key, type: 'audio' }, bytes);
                this.voices.push({ name, key, node, duration, active: false, until: 0, readyAt: 0 });
            }
        }
    }
    play(name) {
        if (this.closed || this.voices.filter(v => v.active).length >= 3) return false;
        const voice = this.voices.find(v => v.name === name && !v.active && v.readyAt <= this.time);
        if (!voice) return false;
        voice.active = true; voice.until = this.time + voice.duration;
        voice.node.node.asset = { [voice.key]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 } };
        this.sync(); return true;
    }
    sync() { this.root.node.children = this.voices.filter(v => v.active).map(v => v.node); this.root.node.onStateChange(); }
    tick(dt) {
        if (this.closed) return;
        this.time += dt; let changed = false;
        for (const v of this.voices) if (v.active && v.until <= this.time) {
            v.active = false; v.readyAt = this.time + .1; v.node.node.asset = undefined; changed = true;
        }
        if (changed) this.sync();
    }
    mute() {
        for (const v of this.voices) { v.active = false; v.readyAt = this.time + .1; v.node.node.asset = undefined; }
        this.sync();
    }
    close() { this.mute(); this.closed = true; }
}
module.exports = { ZooAudio, CUES, RATE };
