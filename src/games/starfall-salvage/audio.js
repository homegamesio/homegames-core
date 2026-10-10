const { Asset, GameNode } = require('squish-145');

// Original synthesized soundtrack and effects. Both local and hosted sessions
// receive ordinary Squish audio assets; the game never touches a browser API.
const CUES = {
    shot: [.16, 920, 110, .1, .1], cutter: [.12, 1450, 420, .065, .08], rocket: [.42, 180, 75, .09, .5], hit: [.15, 200, 55, .095, .5],
    hurt: [.28, 140, 38, .1, .4], explosion: [.65, 100, 23, .13, .8],
    loot: [.28, 660, 990, .075, 0], buy: [.6, 440, 880, .075, 0],
    quest: [1.5, 220, 880, .08, 0], warp: [1.6, 80, 1280, .09, .15],
    dash: [.32, 420, 80, .07, .22], pulse: [.85, 880, 100, .11, .15],
    heal: [.7, 262, 524, .07, 0], board: [.7, 165, 330, .07, .05],
    death: [1.5, 180, 45, .08, .1], victory: [3.2, 220, 880, .09, 0],
};
function wave(seconds, sample) {
    const rate = 16000, count = Math.ceil(seconds * rate), bytes = new Uint8Array(44 + count * 2), view = new DataView(bytes.buffer);
    const write = (value, at) => { for (let i = 0; i < value.length; i++) bytes[at + i] = value.charCodeAt(i); };
    write('RIFF', 0); view.setUint32(4, bytes.length - 8, true); write('WAVEfmt ', 8); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); write('data', 36); view.setUint32(40, count * 2, true);
    for (let i = 0; i < count; i++) view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, sample(i / rate, i))) * 32767), true);
    return bytes;
}
function cue([seconds, from, to, volume, noise]) {
    let phase = 0, seed = 4219;
    return wave(seconds, (t, i) => {
        const u = t / seconds, pitch = seconds > 2 ? Math.floor(u * 5) / 5 : u;
        phase += from * Math.pow(to / from, pitch) * Math.PI * 2 / 16000;
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const envelope = Math.min(1, i / 80) * Math.pow(1 - u, 1.8);
        return (Math.sin(phase) * (1 - noise) + (seed / 2147483648 - 1) * noise) * envelope * volume;
    });
}
function score(combat) {
    const roots = [65.406, 55, 73.416, 49], chords = [[0, 7, 12, 16], [0, 7, 12, 15], [0, 7, 12, 17], [0, 7, 12, 14]];
    const sequence = [0, 2, 1, 3, 2, 1, 3, 2], tau = Math.PI * 2;
    return wave(20, t => {
        const section = Math.min(3, Math.floor(t / 5)), root = roots[section], beat = Math.floor(t * (combat ? 4 : 2)), u = t * (combat ? 4 : 2) % 1;
        const semitone = chords[section][sequence[beat % 8]], note = root * Math.pow(2, semitone / 12) * 4;
        const arpeggio = (Math.sin(t * tau * note) + .2 * Math.sin(t * tau * note * 2)) * Math.exp(-u * (combat ? 6 : 4)) * (combat ? .026 : .018);
        const pad = (Math.sin(t * tau * root * 2) + Math.sin(t * tau * root * 3.004) * .5) * .016 * Math.sin(Math.PI * (t % 5) / 5);
        const bass = Math.sin(t * tau * root) * (combat ? .035 : .018) * Math.exp(-(t * 2 % 1) * 3);
        const kick = combat ? Math.sin(tau * (48 * (t % .5) + 3 * (1 - Math.exp(-(t % .5) * 35)))) * Math.exp(-(t % .5) * 24) * .04 : 0;
        const glass = Math.sin(t * tau * root * 8.01) * Math.sin(t * 1.5) * .006;
        return (arpeggio + pad + bass + kick + glass) * Math.min(1, t * 2, (20 - t) * 2);
    });
}
class SalvageAudio {
    constructor(root, addAsset) {
        this.root = root; this.addAsset = addAsset; this.assets = {}; this.voices = []; this.time = 0; this.nextMusic = 0;
        for (const [name, spec] of Object.entries(CUES)) for (let i = 0; i < (name === 'shot' ? 4 : name === 'cutter' ? 2 : 1); i++) this.add(name, i, cue(spec), spec[0]);
        this.add('drift', 0, score(false), 20); this.add('danger', 0, score(true), 20);
    }
    add(name, index, data, duration) {
        const key = 'starfall_' + name + index, node = new GameNode.Asset({ assetInfo: {} }); node.node.asset = undefined;
        this.assets[key] = new Asset({ id: key, type: 'audio' }, data); this.voices.push({ name, key, node, duration, until: -1 });
    }
    register() {
        if (this.registered || !this.addAsset) return; this.registered = true;
        for (const [key, asset] of Object.entries(this.assets)) { try { this.addAsset(key, asset)?.catch(() => {}); } catch (_) { /* Sound is optional. */ } }
    }
    tick(events, dt, enabled, music = true, danger = false) {
        const old = this.voices.filter(v => v.node.node.asset).map(v => v.key).join(','); this.time += dt;
        for (const voice of this.voices) if (!enabled || voice.until <= this.time) voice.node.node.asset = undefined;
        const aliases = { kill: 'explosion', boss: 'victory', salvage: 'loot', pickup: 'loot', purchase: 'buy', equip: 'buy', module: 'buy', mission: 'quest', complete: 'quest', recruit: 'quest', crew: 'quest', start: 'quest', travel: 'warp', boost: 'dash', repair: 'heal', respawn: 'death', scan: 'pulse', exit: 'board', dock: 'board' };
        const names = (events || []).map(name => aliases[name] || name);
        if (music && enabled && this.time >= this.nextMusic) { names.push(danger ? 'danger' : 'drift'); this.nextMusic = this.time + 22; }
        if (enabled) for (const name of new Set(names)) {
            const voice = this.voices.find(v => v.name === name && v.until + .08 < this.time); if (!voice) continue;
            voice.until = this.time + voice.duration; voice.node.node.asset = { [voice.key]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 } };
        }
        this.root.node.children = this.voices.filter(v => v.node.node.asset).map(v => v.node);
        if (events) events.length = 0;
        return old !== this.voices.filter(v => v.node.node.asset).map(v => v.key).join(',');
    }
    silence() { for (const voice of this.voices) { voice.node.node.asset = undefined; voice.until = this.time; } this.root.node.children = []; this.nextMusic = this.time + .3; }
}
module.exports = { SalvageAudio };
