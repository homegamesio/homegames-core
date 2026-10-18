const { Asset, GameNode } = require('squish-150');

const SAMPLE_RATE = 16000;
const DURATIONS = { scoop: .7, pat: .5, plop: .65, shell: .3, flag: .4, wave: 2.4, crab: .3 };

// Original Foley, generated from seeded noise and resonances, with quiet
// attacks and fades. No network, recordings, or browser-only APIs are needed.
function sound(name) {
    const duration = DURATIONS[name], count = Math.ceil(duration * SAMPLE_RATE);
    const bytes = new Uint8Array(44 + count * 2), view = new DataView(bytes.buffer);
    const text = (value, offset) => [...value].forEach((ch, i) => { bytes[offset + i] = ch.charCodeAt(0); });
    text('RIFF', 0); view.setUint32(4, bytes.length - 8, true); text('WAVEfmt ', 8);
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, SAMPLE_RATE, true); view.setUint32(28, SAMPLE_RATE * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); text('data', 36);
    view.setUint32(40, count * 2, true);
    let seed = 713 + name.length * 57, smooth = 0;
    for (let i = 0; i < count; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const noise = seed / 2147483648 - 1, t = i / SAMPLE_RATE, p = t / duration;
        smooth += .09 * (noise - smooth);
        const edge = Math.min(1, t / .025, (duration - t) / .065);
        let value;
        if (name === 'wave') value = (smooth * .8 + noise * .045) * Math.pow(Math.sin(p * Math.PI), 1.4) * .095;
        else if (name === 'scoop') value = (noise * .38 + smooth * .8) * Math.pow(Math.sin(p * Math.PI), .7) * .045;
        else if (name === 'pat') {
            const local = t % .17, decay = Math.exp(-local * 32);
            value = (Math.sin(t * 2 * Math.PI * 155) * .42 + noise * .4) * decay * .05;
        } else if (name === 'plop') value = (Math.sin(2 * Math.PI * (150 * t - 52 * t * t)) * .68 + smooth) * Math.exp(-t * 8) * .06;
        else if (name === 'flag') value = (noise * .5 + Math.sin(t * 2 * Math.PI * 620) * .18) * Math.exp(-t * 11) * .04;
        else value = (Math.sin(t * 2 * Math.PI * (name === 'crab' ? 690 : 1200)) * .55 + noise * .15) * Math.exp(-t * 18) * .045;
        view.setInt16(44 + i * 2, Math.round(Math.max(-.065, Math.min(.065, value * Math.max(0, edge))) * 32767), true);
    }
    view.setInt16(bytes.length - 2, 0, true);
    return bytes;
}

class BeachAudio {
    constructor(root) {
        this.root = root; this.assets = {}; this.voices = []; this.time = 0; this.closed = false;
        for (const [name, duration] of Object.entries(DURATIONS)) {
            const bytes = sound(name);
            for (let copy = 0; copy < 2; copy++) {
                const key = `sandy_castle_${name}_${copy}`, node = new GameNode.Asset({ assetInfo: {} });
                node.node.asset = undefined;
                this.assets[key] = new Asset({ id: key, type: 'audio' }, bytes);
                this.voices.push({ name, key, duration, node, active: false, readyAt: 0 });
            }
        }
    }
    play(name) {
        if (this.closed || this.voices.filter(v => v.active).length >= 3) return false;
        const v = this.voices.find(v => v.name === name && !v.active && v.readyAt <= this.time);
        if (!v) return false;
        v.active = true; v.until = this.time + v.duration;
        v.node.node.asset = { [v.key]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 } };
        this.sync(); return true;
    }
    sync() { this.root.node.children = this.voices.filter(v => v.active).map(v => v.node); this.root.node.onStateChange(); }
    tick(dt) {
        this.time += dt; let changed = false;
        for (const v of this.voices) if (v.active && this.time >= v.until) {
            v.active = false; v.node.node.asset = undefined; v.readyAt = this.time + .1; changed = true;
        }
        if (changed) this.sync();
    }
    mute() {
        for (const v of this.voices) { v.active = false; v.node.node.asset = undefined; v.readyAt = this.time + .1; }
        this.sync();
    }
    close() { this.mute(); this.closed = true; }
}

module.exports = { BeachAudio, SAMPLE_RATE, DURATIONS };
