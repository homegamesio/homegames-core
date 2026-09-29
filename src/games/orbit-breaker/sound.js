const { Asset, GameNode } = require('squish-142');
const TONES = {
    pulse: [.065, 500, 220, .035], return: [.12, 1100, 140, .085], catch: [.09, 540, 1150, .06],
    perfect: [.22, 880, 1760, .08], kill: [.22, 160, 38, .1], hurt: [.3, 200, 42, .12],
    dash: [.16, 180, 820, .045], nova: [.7, 70, 920, .14], laser: [.2, 1600, 180, .055],
    select: [.09, 420, 840, .045], launch: [.6, 110, 660, .09], upgrade: [.55, 330, 1320, .09],
    win: [1.5, 330, 1320, .1], lose: [.9, 440, 55, .09],
};
function wave([duration, from, to, volume]) {
    const rate = 22050, n = Math.ceil(rate * duration), data = new Uint8Array(44 + n * 2), v = new DataView(data.buffer);
    const str = (s, offset) => { for (let i = 0; i < s.length; i++) data[offset + i] = s.charCodeAt(i); };
    str('RIFF', 0); v.setUint32(4, data.length - 8, true); str('WAVEfmt ', 8); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); str('data', 36); v.setUint32(40, n * 2, true);
    let phase = 0;
    for (let i = 0; i < n; i++) {
        const t = i / n; phase += from * Math.pow(to / from, t) / rate * Math.PI * 2;
        const sample = (Math.sin(phase) * .8 + Math.sin(phase * 2) * .2) * Math.min(1, i / 90) * (1 - t) ** 2 * volume;
        v.setInt16(44 + i * 2, Math.round(sample * 32767), true);
    }
    return data;
}
class Sound {
    constructor(root, addAsset) {
        this.assets = {}; this.voices = []; this.clock = 0; this.addAsset = addAsset;
        for (const [name, tone] of Object.entries(TONES)) {
            const data = wave(tone);
            for (let i = 0; i < (['pulse', 'return', 'catch', 'kill'].includes(name) ? 3 : 1); i++) {
                const key = 'ob_' + name + i;
                this.assets[key] = new Asset({ id: key, type: 'audio' }, data.slice());
                const node = new GameNode.Asset({ assetInfo: {} }); node.node.asset = undefined; root.addChild(node, false);
                this.voices.push({ name, key, node, duration: tone[0], until: -1 });
            }
        }
    }
    register() {
        if (!this.addAsset || this.registered) return; this.registered = true;
        for (const [key, asset] of Object.entries(this.assets)) {
            try { const result = this.addAsset(key, asset); if (result && result.catch) result.catch(() => {}); } catch (_) { /* Audio is optional. */ }
        }
    }
    tick(events, dt, enabled) {
        this.clock += dt;
        for (const v of this.voices) if (v.until <= this.clock || !enabled) v.node.node.asset = undefined;
        if (enabled) for (const name of new Set(events)) {
            const v = this.voices.find(v => v.name === name && v.until + .05 < this.clock);
            if (!v) continue;
            v.until = this.clock + v.duration;
            v.node.node.asset = { [v.key]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 } };
        }
        events.length = 0;
    }
}
module.exports = { Sound, wave };
