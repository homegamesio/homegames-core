// Original, quiet procedural effects. Standard PCM WAV bytes work in both
// Homegames runtimes; no network assets or browser APIs are used by the game.
const { Asset, GameNode } = require('squish-150');
const DEFINITIONS = {
    shot: [.07, 850, 170, .07, .12], kill: [.13, 190, 48, .16, .55],
    boom: [.35, 90, 24, .2, .7], dash: [.19, 130, 900, .12, .45],
    geom: [.11, 950, 1650, .045, 0], hurt: [.32, 190, 38, .19, .4],
    select: [.12, 480, 960, .08, 0], deploy: [.5, 120, 720, .1, .04],
    capture: [.65, 440, 880, .1, 0], victory: [1.2, 330, 990, .12, 0],
    defeat: [.8, 330, 55, .12, .1], ready: [.12, 700, 1000, .025, 0],
    alert: [.3, 440, 220, .07, 0], boss: [.24, 80, 180, .08, .1],
    scatter: [.16, 230, 42, .17, .55], lance: [.22, 1100, 90, .13, .12],
    overload: [.7, 80, 1400, .16, .18], charged: [.35, 660, 1320, .085, 0],
    arc: [.12, 1400, 380, .08, .3], slice: [.13, 980, 190, .12, .35],
    charge: [.22, 140, 780, .08, .2], laser: [.22, 1450, 160, .11, .12],
    mine: [.25, 130, 30, .12, .6], phase: [.65, 70, 420, .14, .14],
};
function wav([seconds, from, to, volume, noise]) {
    const rate = 22050, count = Math.ceil(seconds * rate), bytes = new Uint8Array(44 + count * 2), view = new DataView(bytes.buffer);
    const str = (s, at) => { for (let i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i); };
    str('RIFF', 0); view.setUint32(4, bytes.length - 8, true); str('WAVEfmt ', 8);
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true);
    view.setUint16(34, 16, true); str('data', 36); view.setUint32(40, count * 2, true);
    let phase = 0, seed = 71;
    for (let i = 0; i < count; i++) {
        const t = i / count, env = Math.min(1, i / (rate * .004)) * Math.pow(1 - t, 2.4);
        phase += (from * Math.pow(to / from, t)) / rate * Math.PI * 2;
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const sample = (Math.sin(phase) * (1 - noise) + (seed / 2147483648 - 1) * noise) * env * volume;
        view.setInt16(44 + i * 2, Math.round(sample * 32767), true);
    }
    return bytes;
}
class Sound {
    constructor(root, addAsset) {
        this.assets = {}; this.voices = []; this.time = 0; this.last = {}; this.addAsset = addAsset;
        for (const [name, def] of Object.entries(DEFINITIONS)) {
            const data = wav(def), copies = name === 'shot' || name === 'kill' || name === 'geom' ? 3 : 1;
            for (let i = 0; i < copies; i++) {
                const key = 'vs_'+name+i;
                // Audio decoding transfers its ArrayBuffer; each voice owns bytes.
                this.assets[key] = new Asset({ id: key, type: 'audio' }, data.slice());
                const node = new GameNode.Asset({ assetInfo: {} }); node.node.asset = undefined; root.addChild(node, false);
                this.voices.push({ key, name, node, duration: def[0], until: -1 });
            }
        }
    }
    register() {
        if (!this.addAsset || this.registered) return;
        this.registered = true;
        for (const [key, asset] of Object.entries(this.assets)) {
            try { const p = this.addAsset(key, asset); if (p && p.catch) p.catch(() => {}); } catch (_) { /* visuals remain playable */ }
        }
    }
    tick(events, dt, enabled) {
        this.time += dt;
        for (const v of this.voices) {
            if (v.until <= this.time || !enabled) v.node.node.asset = undefined;
        }
        if (enabled) for (const name of new Set(events)) {
            const gap = name === 'geom' ? .06 : name === 'kill' ? .045 : 0;
            if (this.time - (this.last[name] || -10) < gap) continue;
            // Leave a rendered frame without the asset key before reusing it.
            const v = this.voices.find(v => v.name === name && v.until + .04 < this.time);
            if (!v) continue;
            v.until = this.time + v.duration;
            v.node.node.asset = { [v.key]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 } };
            this.last[name] = this.time;
        }
        events.length = 0;
    }
}
module.exports = { Sound, wav };
