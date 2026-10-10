const { Asset, GameNode } = require('squish-145');

// Original PCM synthesis. Assets are registered through the same platform API in
// a hosted session and an offline download; no browser or network APIs are used.
const CUES = {
    shot: [.14, 140, 38, .18, .82], hit: [.12, 190, 61, .12, .65],
    hurt: [.24, 130, 42, .13, .4], reload: [.3, 950, 480, .06, .7],
    dodge: [.2, 270, 90, .06, .55], heal: [.5, 330, 660, .08, 0],
    buy: [.45, 523, 1046, .075, 0], quest: [1.5, 220, 880, .09, 0],
    focus: [.65, 165, 660, .075, .08], mount: [.2, 120, 80, .09, .3],
    death: [1.2, 220, 55, .09, .04], victory: [2.2, 220, 880, .11, 0],
};
function wave(seconds, sample) {
    const rate = 16000, count = Math.ceil(seconds * rate), bytes = new Uint8Array(44 + count * 2), v = new DataView(bytes.buffer);
    const text = (s, offset) => { for (let i = 0; i < s.length; i++) bytes[offset + i] = s.charCodeAt(i); };
    text('RIFF', 0); v.setUint32(4, bytes.length - 8, true); text('WAVEfmt ', 8); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); text('data', 36); v.setUint32(40, count * 2, true);
    for (let i = 0; i < count; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, sample(i / rate, i))) * 32767), true);
    return bytes;
}
function cue(spec) {
    const [duration, from, to, volume, noise] = spec; let phase = 0, seed = 491;
    return wave(duration, (t, i) => {
        const u = t / duration, pitch = duration > 1 ? Math.floor(u * 4) / 4 : u;
        phase += from * Math.pow(to / from, pitch) * Math.PI * 2 / 16000;
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const env = Math.min(1, i / 50) * Math.pow(1 - u, 2);
        return (Math.sin(phase) * (1 - noise) + (seed / 2147483648 - 1) * noise) * env * volume;
    });
}
function theme() {
    const bass = [110, 110, 87.31, 98], melody = [440, 523.25, 659.25, 587.33, 523.25, 440, 392, 329.63, 349.23, 440, 523.25, 440, 392, 493.88, 587.33, 493.88];
    return wave(16, t => {
        const beat = Math.floor(t * 2), u = t * 2 - beat, section = Math.min(3, Math.floor(t / 4));
        const f = melody[Math.floor(t) % melody.length], note = t % 1;
        const guitar = (Math.sin(t * Math.PI * 2 * bass[section] * (beat % 2 ? 3 : 2)) + .35 * Math.sin(t * Math.PI * 2 * bass[section] * 4)) * Math.exp(-u * 7) * .028;
        const whistle = Math.sin(t * Math.PI * 2 * f + Math.sin(t * 27) * .08) * Math.sin(Math.PI * note) * .025;
        const low = Math.sin(t * Math.PI * 2 * bass[section]) * Math.exp(-(t % 2) * 3) * .035;
        return (guitar + whistle + low) * Math.min(1, t * 2, (16 - t) * 2);
    });
}
class FrontierAudio {
    constructor(root, addAsset) {
        this.root = root; this.addAsset = addAsset; this.assets = {}; this.voices = []; this.time = 0; this.nextMusic = 0;
        for (const [name, spec] of Object.entries(CUES)) for (let n = 0; n < (name === 'shot' ? 3 : 1); n++) this.add(name, n, cue(spec), spec[0]);
        this.add('theme', 0, theme(), 16);
    }
    add(name, n, data, duration) {
        const key = 'copperline_' + name + n, node = new GameNode.Asset({ assetInfo: {} }); node.node.asset = undefined;
        this.assets[key] = new Asset({ id: key, type: 'audio' }, data);
        this.voices.push({ key, name, node, duration, until: -1 });
    }
    register() {
        if (this.registered || !this.addAsset) return; this.registered = true;
        for (const [key, asset] of Object.entries(this.assets)) {
            try { const result = this.addAsset(key, asset); result?.catch(() => {}); } catch (_) { /* Audio is optional. */ }
        }
    }
    tick(events, dt, enabled, music = true) {
        const previous = this.voices.filter(v => v.node.node.asset).map(v => v.key).join(',');
        this.time += dt;
        for (const v of this.voices) if (v.until <= this.time || !enabled) v.node.node.asset = undefined;
        const aliases = { kill: 'hit', mission: 'quest', complete: 'quest', purchase: 'buy', loot: 'buy', coin: 'buy', electric: 'focus', start: 'quest', horse: 'mount', level: 'quest', train: 'mount', dry: 'reload', respawn: 'death' };
        const names = events.map(n => aliases[n] || n);
        if (enabled && music && this.time >= this.nextMusic) { names.push('theme'); this.nextMusic = this.time + 21; }
        if (enabled) for (const name of new Set(names)) {
            const v = this.voices.find(v => v.name === name && v.until + .07 < this.time); if (!v) continue;
            v.until = this.time + v.duration;
            v.node.node.asset = { [v.key]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 } };
        }
        this.root.node.children = this.voices.filter(v => v.node.node.asset).map(v => v.node);
        events.length = 0;
        return previous !== this.voices.filter(v => v.node.node.asset).map(v => v.key).join(',');
    }
    silence() { for (const v of this.voices) { v.node.node.asset = undefined; v.until = this.time; } this.root.node.children = []; }
}
module.exports = { FrontierAudio };
