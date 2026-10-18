const { Asset, GameNode } = require('squish-150');
const NOTES = {
    shot: [.09, 680, 210, .045, .12], hit: [.1, 200, 70, .035, .35], burst: [.35, 100, 35, .1, .55],
    boost: [.4, 130, 700, .09, .2], repair: [.32, 390, 780, .05, 0], salvage: [.24, 740, 1100, .06, 0],
    scan: [.6, 220, 950, .055, .02], hurt: [.22, 170, 70, .07, .3], barrage: [.35, 290, 60, .08, .35],
    beacon: [1.8, 261.63, 523.25, .10, 0], depart: [1.2, 196, 392, .07, 0],
    victory: [2.8, 261.63, 1046.5, .1, 0], defeat: [1.2, 220, 55, .08, .05], boss: [1.4, 82, 41, .1, .1],
};
function synth([duration, from, to, volume, noise]) {
    const rate = 16000, count = Math.ceil(rate * duration), bytes = new Uint8Array(44 + count * 2), v = new DataView(bytes.buffer);
    const text = (s, p) => { for (let i = 0; i < s.length; i++) bytes[p + i] = s.charCodeAt(i); };
    text('RIFF', 0); v.setUint32(4, bytes.length - 8, true); text('WAVEfmt ', 8); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); text('data', 36); v.setUint32(40, count * 2, true);
    let phase = 0, seed = 19;
    for (let i = 0; i < count; i++) {
        const t = i / count, env = Math.min(1, t * 45) * Math.pow(1 - t, 1.7);
        phase += from * Math.pow(to / from, duration > 1 ? Math.floor(t * 4) / 4 : t) * Math.PI * 2 / rate;
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const tone = (Math.sin(phase) + .25 * Math.sin(phase * 1.5) + .15 * Math.sin(phase * 2)) / 1.4;
        v.setInt16(44 + i * 2, Math.round((tone * (1 - noise) + (seed / 2147483648 - 1) * noise) * env * volume * 32767), true);
    }
    return bytes;
}
class ShipAudio {
    constructor(root) {
        this.root = root; this.assets = {}; this.voices = []; this.time = 0;
        for (const [name, spec] of Object.entries(NOTES)) for (let i = 0; i < (name === 'shot' ? 2 : 1); i++) {
            const key = `sunwake_${name}_${i}`, node = new GameNode.Asset({ assetInfo: {} }); node.node.asset = undefined;
            this.assets[key] = new Asset({ id: key, type: 'audio' }, synth(spec));
            this.voices.push({ key, node, name, duration: spec[0], until: -10 });
        }
    }
    tick(events, dt, ids) {
        this.time += dt; this.root.node.playerIds = ids;
        for (const v of this.voices) if (v.until <= this.time || !ids.length) v.node.node.asset = undefined;
        if (ids.length) for (const name of new Set(events)) {
            const v = this.voices.find(v => v.name === name && v.until + .08 < this.time); if (!v) continue;
            v.until = this.time + v.duration;
            v.node.node.asset = { [v.key]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 } };
        }
        this.root.node.children = this.voices.filter(v => v.node.node.asset).map(v => v.node);
        events.length = 0;
    }
}
module.exports = { ShipAudio, synth };
