'use strict';

// Original, deterministic synthesis. No network, recordings or sample licenses.
// The same PCM samples power the live instrument and its downloadable WAV.
const { Asset, GameNode } = require('squish-150');
const { normalize, soundsAt } = require('./arrangement');
const RATE = 22050;
const DURATION = .72;
const INSTRUMENTS = ['kick', 'snare', 'hat', 'bass0', 'bass1', 'bass2', 'bass3', 'bass4'];
const FREQUENCIES = [65.406, 73.416, 82.407, 97.999, 110];
const keyFor = (name, tone, space) => `hb_${name}_${tone}_${space}`;

function pcm(name, tone, space) {
    const samples = new Float32Array(Math.ceil(RATE * DURATION));
    let seed = 5108, phase = 0, previous = 0;
    for (let i = 0; i < samples.length; i++) {
        const t = i / RATE;
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const noise = seed / 2147483648 - 1;
        let sample;
        if (name === 'kick') {
            phase += 2 * Math.PI * (46 + 100 * Math.exp(-t * 42)) / RATE;
            sample = (.48 * Math.sin(phase) * Math.exp(-t * 12) + .04 * noise * Math.exp(-t * 160));
        } else if (name === 'snare') {
            sample = .24 * noise * Math.exp(-t * 24) + .12 * Math.sin(t * 2 * Math.PI * 170) * Math.exp(-t * 30);
        } else if (name === 'hat') {
            sample = .105 * (noise - previous) * Math.exp(-t * 70);
            previous = noise;
        } else {
            phase = t * Math.PI * 2 * FREQUENCIES[Number(name.slice(-1))];
            const harmonics = [.08, .28, .55][tone];
            sample = .26 * (Math.sin(phase) + harmonics * Math.sin(phase * 2) + harmonics * .35 * Math.sin(phase * 3))
                * Math.min(1, t / .006) * Math.exp(-t * 10);
        }
        // A short attack/tail avoids discontinuities in the PCM.
        samples[i] = sample * Math.min(1, t / .001) * Math.min(1, (DURATION - t) / .02);
    }
    // Tone also opens the drum filter. Space adds two audible echo taps.
    let filtered = 0;
    const cutoff = [.17, .48, .95][tone];
    for (let i = 0; i < samples.length; i++) { filtered += cutoff * (samples[i] - filtered); samples[i] = filtered; }
    if (space) {
        const dry = samples.slice(), delay = Math.round(RATE * .135), gain = space === 1 ? .18 : .38;
        for (let i = delay; i < samples.length; i++) samples[i] += dry[i - delay] * gain + (i >= delay * 2 ? dry[i - delay * 2] * gain * .55 : 0);
    }
    return samples;
}
function wav(samples) {
    const bytes = new Uint8Array(44 + samples.length * 2), view = new DataView(bytes.buffer);
    const text = (offset, value) => [...value].forEach((char, i) => { bytes[offset + i] = char.charCodeAt(0); });
    text(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, RATE, true); view.setUint32(28, RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    text(36, 'data'); view.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), true);
    return bytes;
}
function renderLoop(value, bars = 4) {
    const arrangement = normalize(value), duration = 60 / arrangement.bpm * 4 * bars;
    const mixed = new Float32Array(Math.ceil(RATE * duration));
    const bank = Object.fromEntries(INSTRUMENTS.map(name => [name, pcm(name, arrangement.tone, arrangement.space)]));
    for (let s = 0; s < bars * 16; s++) {
        const start = Math.round(s * 60 / arrangement.bpm / 4 * RATE);
        for (const name of soundsAt(arrangement, s % 16)) {
            const sound = bank[name];
            // Wrap the final tail into the start so this WAV loops seamlessly.
            for (let i = 0; i < sound.length; i++) mixed[(start + i) % mixed.length] += sound[i] * .7;
        }
    }
    return wav(mixed);
}

class SoundBank {
    constructor(root) {
        this.root = root; this.assets = {}; this.voices = []; this.serial = 0;
        for (const name of INSTRUMENTS) for (let tone = 0; tone < 3; tone++) for (let space = 0; space < 3; space++) {
            const key = keyFor(name, tone, space);
            this.assets[key] = new Asset({ id: key, type: 'audio' }, wav(pcm(name, tone, space)));
        }
        // Fixed voice pool: scene/node count stays bounded during long jams.
        for (let i = 0; i < 48; i++) {
            const node = new GameNode.Asset({ assetInfo: {} });
            node.node.asset = undefined;
            this.voices.push({ node, until: 0 });
        }
    }
    play(name, arrangement, now, listeners) {
        if (!listeners.length) return;
        const voice = this.voices[this.serial++ % this.voices.length];
        const key = keyFor(name, arrangement.tone, arrangement.space);
        voice.node.node.playerIds = listeners.slice();
        voice.node.node.asset = { [key]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 } };
        voice.until = now + DURATION * 1000;
    }
    update(now) {
        const active = this.voices.filter(voice => voice.until > now).map(voice => voice.node);
        const before = this.root.node.children;
        if (active.length === before.length && active.every((node, i) => before[i] === node)) return false;
        this.root.node.children = active;
        return true;
    }
    stopFor(id) {
        for (const voice of this.voices) {
            voice.node.node.playerIds = (voice.node.node.playerIds || []).filter(player => player !== id);
            // Empty scopes are public in Squish: retire, never broadcast them.
            if (!voice.node.node.playerIds.length) voice.until = 0;
        }
        this.root.node.children = this.root.node.children.filter(node => node.node.playerIds.length);
    }
    stop() { this.voices.forEach(voice => { voice.until = 0; }); this.root.node.children = []; }
}
module.exports = { SoundBank, renderLoop, pcm, wav, RATE, DURATION };
