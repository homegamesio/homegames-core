const { Asset, GameNode } = require('squish-150');
const RATE = 22050;
const CUES = { scoop: .52, plop: .25, sprinkle: .55, cherry: .27, choose: .22, serve: .85 };
const TAU = Math.PI * 2;
// Original quiet PCM effects; deterministic bytes, with no network or audio dependencies.
function makeWav(name, duration) {
    const count = Math.ceil(RATE * duration), samples = new Float32Array(count);
    let seed = 8435 + Object.keys(CUES).indexOf(name) * 998, low = 0, peak = 0;
    for (let i = 0; i < count; i++) {
        const t = i / RATE;
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const noise = seed / 2147483648 - 1; low += .14 * (noise - low);
        const tone = (f, at, decay) => t < at ? 0 : Math.sin(TAU * f * (t - at)) * Math.exp(-(t - at) / decay) * Math.min(1, (t - at) / .005);
        let value;
        if (name === 'scoop') value = low * .8 * Math.sin(Math.PI * t / duration) ** 2 + tone(155, .30, .05) * .1;
        else if (name === 'plop') value = Math.sin(TAU * (160 * t - 180 * t * t)) * Math.exp(-t / .055) + low * .15 * Math.exp(-t / .04);
        else if (name === 'sprinkle') value = (noise - low) * .45 * Math.sin(Math.PI * t / duration) * Math.pow(Math.sin(t * 73), 8);
        else if (name === 'serve') value = tone(523.25, .02, .14) + tone(659.25, .16, .15) + tone(783.99, .32, .19);
        else if (name === 'cherry') value = tone(540, .02, .042) + tone(1170, .02, .025) * .4;
        else value = tone(490, .01, .037) + tone(980, .01, .025) * .2;
        value *= Math.min(1, i / (RATE * .006), (count - i - 1) / (RATE * .02));
        samples[i] = value; peak = Math.max(peak, Math.abs(value));
    }
    const data = new Uint8Array(44 + count * 2), view = new DataView(data.buffer);
    const write = (text, at) => { for (let i = 0; i < text.length; i++) data[at + i] = text.charCodeAt(i); };
    write('RIFF', 0); view.setUint32(4, data.length - 8, true); write('WAVEfmt ', 8);
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, RATE, true); view.setUint32(28, RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    write('data', 36); view.setUint32(40, count * 2, true);
    const gain = .047 / (peak || 1);
    for (let i = 0; i < count; i++) view.setInt16(44 + i * 2, Math.round(samples[i] * gain * 32767), true);
    return data;
}
class ScoopAudio {
    constructor(root) {
        this.root = root; this.assets = {}; this.voices = []; this.time = 0; this.closed = false;
        for (const [name, duration] of Object.entries(CUES)) {
            const bytes = makeWav(name, duration);
            for (let copy = 0; copy < 2; copy++) {
                const key = `little_scoop_${name}_${copy}`, node = new GameNode.Asset({ assetInfo: {} });
                node.node.asset = undefined;
                this.assets[key] = new Asset({ id: key, type: 'audio' }, bytes);
                this.voices.push({ key, name, node, duration, until: 0, readyAt: 0, active: false });
            }
        }
    }
    play(name) {
        if (this.closed || this.voices.filter(v => v.active).length >= 4) return false;
        const voice = this.voices.find(v => v.name === name && !v.active && v.readyAt <= this.time);
        if (!voice) return false;
        voice.active = true; voice.until = this.time + voice.duration;
        voice.node.node.asset = { [voice.key]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 } }; this.sync(); return true;
    }
    tick(dt) {
        this.time += dt; let changed = false;
        for (const voice of this.voices) if (voice.active && voice.until <= this.time) {
            voice.active = false; voice.readyAt = this.time + .1; voice.node.node.asset = undefined; changed = true;
        }
        if (changed) this.sync();
    }
    sync() { this.root.node.children = this.voices.filter(v => v.active).map(v => v.node); this.root.node.onStateChange(); }
    mute() { for (const v of this.voices) { v.active = false; v.readyAt = this.time + .1; v.node.node.asset = undefined; } this.sync(); }
    close() { this.mute(); this.closed = true; }
}
module.exports = { ScoopAudio, CUES, RATE };
