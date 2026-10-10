const { Asset, GameNode } = require('squish-145');

// All sound is original, synthesized PCM. It travels through ordinary Squish
// assets, so browser hosts, remote guests and Node sessions hear the same score.
const RATE = 22050;
const TAU = Math.PI * 2;
const EFFECTS = {
    shot:    { duration: .12, cooldown: .14, priority: 0, voices: 2 },
    harvest: { duration: .42, cooldown: .65, priority: 1, voices: 1 },
    consume: { duration: 1.45, cooldown: 1.5, priority: 4, voices: 1 },
    rescue:  { duration: .85, cooldown: .6, priority: 3, voices: 2 },
    build:   { duration: .65, cooldown: .4, priority: 3, voices: 2 },
    nova:    { duration: 1.3, cooldown: 1.35, priority: 5, voices: 1 },
    hurt:    { duration: .28, cooldown: .45, priority: 2, voices: 1 },
    boss:    { duration: 1.7, cooldown: 2, priority: 6, voices: 1 },
    jump:    { duration: 1.25, cooldown: 1.5, priority: 5, voices: 1 },
    victory: { duration: 2.9, cooldown: 3, priority: 9, voices: 1 },
    defeat:  { duration: 2.4, cooldown: 3, priority: 9, voices: 1 },
    select:  { duration: .12, cooldown: .12, priority: 1, voices: 1 },
};
const PHRASE_SECONDS = 6;
const CHORDS = [
    [55, 82.4069, 110, 130.8128, 164.8138],
    [43.6535, 65.4064, 87.3071, 110, 130.8128],
    [65.4064, 98, 130.8128, 164.8138, 196],
    [48.9994, 73.4162, 97.9989, 123.4708, 146.8324],
];

function pcm(duration, sample) {
    const count = Math.ceil(RATE * duration);
    const bytes = new Uint8Array(44 + count * 2);
    const view = new DataView(bytes.buffer);
    const word = (offset, value) => { for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i); };
    word(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true);
    word(8, 'WAVEfmt '); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, RATE, true); view.setUint32(28, RATE * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    word(36, 'data'); view.setUint32(40, count * 2, true);
    for (let i = 0; i < count; i++) {
        const s = Math.max(-.95, Math.min(.95, sample(i / RATE, i / count, i)));
        view.setInt16(44 + i * 2, Math.round(s * 32767), true);
    }
    return bytes;
}

function effect(name, duration) {
    let seed = 173, filtered = 0, phase = 0;
    const chime = (time, frequency, delay = 0) => {
        const age = time - delay;
        return age < 0 ? 0 : Math.sin(TAU * frequency * age) * Math.exp(-age * 7) * Math.min(1, age * 140);
    };
    return pcm(duration, (t, u) => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const noise = seed / 2147483648 - 1;
        filtered = filtered * .88 + noise * .12;
        const env = Math.min(1, t * 100) * Math.pow(1 - u, 1.3);
        let value = 0;
        switch (name) {
            case 'shot':
                phase += TAU * (170 + 670 * Math.exp(-t * 45)) / RATE;
                value = (Math.sin(phase) * .8 + noise * .2) * env * .095;
                break;
            case 'harvest':
                value = (chime(t, 523.25) + chime(t, 783.99, .06) + chime(t, 1046.5, .12)) * .07;
                break;
            case 'consume':
                phase += TAU * (28 + 170 * Math.pow(1 - u, 3)) / RATE;
                value = (Math.sin(phase) * .65 + filtered * 2 + Math.sin(t * 14) * Math.sin(phase * .5) * .35) * env * .17;
                break;
            case 'rescue':
                value = (chime(t, 659.25) + chime(t, 783.99, .12) + chime(t, 1046.5, .24) + chime(t, 1318.51, .36) * .5) * .075;
                break;
            case 'build':
                value = (chime(t, 220) + chime(t, 329.63, .06) + chime(t, 440, .14) + chime(t, 659.25, .22)) * .085;
                break;
            case 'nova':
                phase += TAU * (42 + 310 * Math.pow(1 - u, 5)) / RATE;
                value = (Math.sin(phase) * .9 + filtered * 2.8 + Math.sin(t * 1800) * Math.exp(-t * 9) * .2) * env * .2;
                break;
            case 'hurt':
                value = (Math.sin(TAU * 84 * t) * .5 + filtered * 2.4) * env * .17;
                break;
            case 'boss': {
                const warning = Math.sin(TAU * (82.4069 + Math.sin(t * 7) * 6) * t);
                value = (warning * .6 + Math.sin(TAU * 87.3071 * t) * .35 + filtered * .25) * Math.sin(Math.PI * u) * .16;
                break;
            }
            case 'jump':
                phase += TAU * (70 * Math.pow(20, u)) / RATE;
                value = (Math.sin(phase) * .6 + Math.sin(phase * 1.005) * .3 + filtered * .7) * Math.sin(Math.PI * u) * .11;
                break;
            case 'victory': {
                const notes = [261.63, 329.63, 392, 523.25, 659.25, 783.99];
                value = notes.reduce((sum, note, i) => sum + chime(t, note, i * .19), 0) * .115;
                value += (Math.sin(TAU * 130.8128 * t) + Math.sin(TAU * 196 * t)) * Math.sin(Math.PI * u) * .024;
                break;
            }
            case 'defeat':
                phase += TAU * (130.8128 * Math.pow(.35, u)) / RATE;
                value = (Math.sin(phase) + Math.sin(phase * 1.1892) * .45 + filtered * .3) * env * .095;
                break;
            default:
                value = (chime(t, 660) + chime(t, 990, .025)) * .05;
        }
        // Remove hard endings, including the short chime tails.
        return value * Math.min(1, (duration - t) * 100);
    });
}

function atmosphere(index) {
    const chord = CHORDS[index];
    return pcm(PHRASE_SECONDS, (t, u) => {
        const swell = Math.min(1, t * 2, (PHRASE_SECONDS - t) * 2);
        let value = Math.sin(TAU * chord[0] * t) * .022;
        for (let i = 1; i < chord.length; i++) {
            value += Math.sin(TAU * chord[i] * t + Math.sin(t * .6 + i) * .15) * .008;
        }
        // Quiet six-beat, shifting arpeggio over a low engine-like drone.
        const beat = Math.floor(t / .75), age = t % .75;
        const note = chord[2 + (beat + index) % 3] * (beat % 3 === 0 ? 4 : 2);
        const pulse = Math.sin(TAU * note * age) * Math.exp(-age * 7) * Math.min(1, age * 60);
        value += pulse * .011;
        return value * swell * (.78 + .22 * Math.sin(Math.PI * u));
    });
}

class WorldAudio {
    constructor(root) {
        this.assets = {};
        this.voices = [];
        this.music = [];
        this.clock = 0;
        this.last = {};
        this.phrase = 0;
        this.nextMusic = .4;
        this.closed = false;
        const register = (key, data, info) => {
            const asset = new Asset({ id: key, type: 'audio' }, data);
            // Some clients transfer buffers during decoding. Keep master PCM
            // intact for later guests, replay and session asset registration.
            asset.getData = () => Promise.resolve(data.slice());
            this.assets[key] = asset;
            const node = new GameNode.Asset({ assetInfo: {} });
            node.node.asset = undefined;
            root.addChild(node, false);
            return { key, node, until: -1, ...info };
        };
        for (const [name, config] of Object.entries(EFFECTS)) {
            const bytes = effect(name, config.duration);
            for (let i = 0; i < config.voices; i++) {
                this.voices.push(register('we_' + name + '_' + i, bytes.slice(), { name, ...config }));
            }
        }
        for (let i = 0; i < CHORDS.length; i++) {
            this.music.push(register('we_atmosphere_' + i, atmosphere(i), { duration: PHRASE_SECONDS }));
        }
    }

    play(voice) {
        voice.until = this.clock + voice.duration;
        voice.node.node.asset = { [voice.key]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 } };
    }

    register(addAsset) {
        if (typeof addAsset !== 'function' || this.registered) return;
        this.registered = true;
        for (const [key, asset] of Object.entries(this.assets)) {
            // LocalSession retains these bytes for future RTC guests. A plain
            // byte array makes AssetManager copy before decodeAudioData, which
            // transfers its input buffer on some browsers.
            const registration = new Asset(asset.info, Array.from(asset.data));
            try {
                const result = addAsset(key, registration);
                if (result && result.catch) result.catch(() => {});
            } catch (_) { /* Sound is optional; the game remains playable. */ }
        }
    }

    update(events = [], dt = 1 / 30, enabled = true, phase = 'play') {
        this.clock += Math.max(0, Math.min(.25, Number(dt) || 0));
        const all = this.voices.concat(this.music);
        for (const voice of all) {
            if (voice.until <= this.clock || !enabled || this.closed) voice.node.node.asset = undefined;
        }
        if (!enabled || this.closed) {
            this.nextMusic = this.clock + .4;
            if (Array.isArray(events)) events.length = 0;
            return;
        }
        const names = [...new Set(events)].filter(name => EFFECTS[name]);
        names.sort((a, b) => EFFECTS[b].priority - EFFECTS[a].priority);
        let active = this.voices.filter(voice => voice.until > this.clock).length;
        let started = 0;
        for (const name of names) {
            if (started >= 3) break;
            if (this.clock - (this.last[name] ?? -100) < EFFECTS[name].cooldown) continue;
            const voice = this.voices.find(item => item.name === name && item.until + .075 < this.clock);
            if (!voice) continue;
            if (active >= 6) {
                const victim = this.voices.filter(item => item.until > this.clock && item.priority < voice.priority)
                    .sort((a, b) => a.priority - b.priority)[0];
                if (!victim) continue;
                victim.node.node.asset = undefined; victim.until = this.clock; active--;
            }
            this.play(voice); this.last[name] = this.clock; active++; started++;
        }
        if (Array.isArray(events)) events.length = 0;
        if (['won', 'lost', 'victory', 'defeat', 'ended'].includes(phase)) {
            for (const voice of this.music) voice.node.node.asset = undefined;
            this.nextMusic = this.clock + 1;
        } else if (this.clock >= this.nextMusic) {
            this.play(this.music[this.phrase++ % this.music.length]);
            this.nextMusic = this.clock + PHRASE_SECONDS - .22;
        }
    }

    close() {
        this.closed = true;
        for (const voice of this.voices.concat(this.music)) voice.node.node.asset = undefined;
    }
}

module.exports = { WorldAudio };
