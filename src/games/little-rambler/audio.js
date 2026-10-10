const { Asset, GameNode } = require('squish-142');

// Original Little Rambler score. All instruments are rendered to small, portable
// PCM assets: the game needs neither browser audio APIs nor remote downloads.
const SAMPLE_RATE = 16000;
const TAU = Math.PI * 2;
const MUSIC_PERIODS = { home: 16, garden: 12, salvage: 12.8 };
const MAX_EFFECT_VOICES = 4;
const frequency = pitch => 440 * Math.pow(2, (pitch - 69) / 12);
const note = (at, pitch, duration, gain, instrument = 'mallet') =>
    ({ at, frequency: frequency(pitch), duration, gain, instrument });
const slide = (at, from, to, duration, gain, instrument = 'chirp') =>
    ({ at, frequency: from, endFrequency: to, duration, gain, instrument });
const chord = (at, pitches, duration, gain, instrument = 'pad') =>
    pitches.map(pitch => note(at, pitch, duration, gain, instrument));

function musicScore(scene) {
    const beat = MUSIC_PERIODS[scene] / 16;
    const score = [];
    // D6/9, Gmaj7, Em7, Aadd9. The D-F#-A-F#-E-D call belongs to
    // the companion and returns with different phrasing on both outings.
    const roots = [38, 43, 40, 45];
    const harmonies = [[62, 66, 69, 71], [62, 66, 67, 71], [62, 64, 67, 71], [61, 64, 69, 71]];
    const melodies = [[74, 78, 81, 78, 76, 74], [74, 78, 79, 83, 81, 78],
        [76, 79, 83, 81, 79, 76], [73, 76, 81, 78, 76, 73]];
    const rhythms = {
        home: [0, .75, 1.25, 2, 2.75, 3.25],
        garden: [0, .5, 1.25, 1.75, 2.5, 3.25],
        salvage: [.25, 1, 1.75, 2.5, 3, 3.5]
    };
    for (let bar = 0; bar < 4; bar++) {
        const at = bar * beat * 4;
        score.push(...chord(at, harmonies[bar], beat * 4 + .32, .012));
        // A soft thumb-piano bass answers the lead; no sharp drum loop.
        [0, 1.5, 2.5].forEach((b, i) => score.push(note(at + b * beat,
            roots[bar] + (i === 1 ? 7 : 12), beat * .85, .095, 'bass')));
        rhythms[scene].forEach((b, i) => {
            const instrument = scene === 'salvage' ? 'water' : scene === 'garden' ? 'pluck' : 'mallet';
            score.push(note(at + b * beat, melodies[bar][i], beat * 1.03, .075, instrument));
        });
        // Small answering figures keep the long home phrase from feeling static.
        [1, 3].forEach((b, i) => score.push(note(at + b * beat,
            harmonies[bar][i + 1], beat * .64, .027, 'pluck')));
        if (scene === 'garden') {
            for (let step = 0; step < 8; step++) {
                score.push(note(at + (step / 2 + (step % 2 ? .055 : 0)) * beat,
                    step % 2 ? 66 : 54, .08, step % 2 ? .019 : .024, 'wood'));
            }
            score.push(note(at + 2.85 * beat, melodies[bar][4] + 12, .28, .025, 'mallet'));
        } else if (scene === 'salvage') {
            [.6, 2.2, 3.7].forEach((b, i) => score.push(slide(at + b * beat,
                330 + i * 190, 190 + i * 140, .11, .014, 'bubble')));
            score.push(note(at + 1.45 * beat, harmonies[bar][2] + 12, beat * 1.65, .022, 'flute'));
        } else {
            score.push(note(at + 2.2 * beat, harmonies[bar][3] + 12, beat * 1.4, .018, 'flute'));
        }
    }
    return score;
}

function scores() {
    const bank = {
        pet: { duration: .44, copies: 2, notes: [slide(.01, 370, 590, .18, .12), slide(.21, 530, 440, .2, .095)] },
        eat: { duration: .52, copies: 2, notes: [note(.015, 41, .095, .16, 'crunch'), note(.145, 43, .09, .12, 'crunch'),
            slide(.285, 235, 115, .2, .11, 'bubble')] },
        happy: { duration: .7, copies: 1, notes: [slide(.02, 350, 470, .18, .12), slide(.22, 470, 590, .2, .12),
            slide(.44, 595, 660, .22, .105)] },
        jump: { duration: .26, copies: 2, notes: [slide(.005, 125, 325, .24, .13, 'spring')] },
        collect: { duration: .36, copies: 2, notes: [note(.005, 78, .27, .15), note(.09, 81, .26, .12)] },
        bounce: { duration: .22, copies: 2, notes: [slide(.005, 230, 82, .2, .16, 'spring')] },
        build: { duration: 1.06, copies: 1, notes: [note(.01, 47, .12, .15, 'wood'), note(.15, 54, .14, .12, 'wood'),
            ...[66, 69, 74].map((pitch, i) => note(.32 + i * .09, pitch, .5, .11, 'pluck')),
            ...chord(.56, [62, 66, 69], .48, .034)] },
        reward: { duration: 1.16, copies: 1, notes: [note(0, 38, .8, .13, 'bass'),
            ...[74, 78, 81, 86].map((pitch, i) => note(i * .13, pitch, .73, .13)),
            ...chord(.39, [62, 66, 69, 71], .75, .035)] },
        click: { duration: .12, copies: 2, notes: [note(.005, 78, .105, .09, 'wood')] },
        splash: { duration: .4, copies: 2, notes: [note(0, 45, .21, .08, 'crunch'),
            ...[0, 1, 2, 3].map(i => slide(.045 + i * .055, 430 + i * 170, 220 + i * 90, .16, .055, 'bubble'))] }
    };
    for (const scene of Object.keys(MUSIC_PERIODS)) {
        bank['music_' + scene] = { notes: musicScore(scene), copies: 2, duration: MUSIC_PERIODS[scene] + .36,
            room: true, peak: .13 };
    }
    return bank;
}

function renderWave(score) {
    const count = Math.ceil(score.duration * SAMPLE_RATE);
    const mix = new Float32Array(count);
    score.notes.forEach((n, index) => {
        const start = Math.round(n.at * SAMPLE_RATE);
        const samples = Math.ceil(n.duration * SAMPLE_RATE);
        let seed = Math.imul(index + 83, 2654435761) >>> 0;
        let softNoise = 0;
        for (let i = 0; i < samples && start + i < count; i++) {
            const age = i / SAMPLE_RATE, progress = age / n.duration;
            seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
            softNoise += .17 * ((seed >>> 0) / 2147483648 - 1 - softNoise);
            const f = n.frequency;
            const phase = TAU * (f * age + ((n.endFrequency || f) - f) * age * age / (2 * n.duration));
            const attack = n.instrument === 'pad' ? .15 : n.instrument === 'flute' ? .065 : .004;
            const release = n.instrument === 'pad' ? .2 : n.instrument === 'flute' ? .15 : .04;
            const envelope = Math.min(1, age / attack) * Math.min(1, (n.duration - age) / release);
            let tone, decay = Math.exp(-4.6 * progress);
            switch (n.instrument) {
                case 'pad':
                    tone = .62 * Math.sin(phase) + .25 * Math.sin(phase * 1.002) + .13 * Math.sin(phase * 2);
                    decay = .72 + .28 * Math.sin(Math.PI * progress); break;
                case 'bass':
                    tone = .88 * Math.sin(phase) + .1 * Math.sin(phase * 2) + .02 * Math.sin(phase * 3);
                    decay = Math.exp(-2.8 * progress); break;
                case 'pluck':
                    tone = .73 * Math.sin(phase) + .2 * Math.sin(phase * 2) * Math.exp(-3 * progress)
                        + .07 * Math.sin(phase * 3) * Math.exp(-6 * progress);
                    decay = Math.exp(-4.1 * progress); break;
                case 'water':
                    tone = .8 * Math.sin(phase + .055 * Math.sin(TAU * 5 * age))
                        + .15 * Math.sin(phase * 2.003) * Math.exp(-3 * progress)
                        + .05 * Math.sin(phase * 3.97) * Math.exp(-7 * progress);
                    decay = Math.exp(-3.8 * progress); break;
                case 'flute':
                    tone = .94 * Math.sin(phase + .065 * Math.sin(TAU * 4.7 * age))
                        + .04 * Math.sin(phase * 2) + .02 * softNoise;
                    decay = Math.sin(Math.PI * progress); break;
                case 'chirp':
                    tone = .76 * Math.sin(phase + .15 * Math.sin(TAU * 16 * age)) + .18 * Math.sin(phase * 2) + .06 * Math.sin(phase * 3);
                    decay = Math.pow(Math.sin(Math.PI * progress), .7); break;
                case 'spring':
                    tone = .86 * Math.sin(phase) + .14 * Math.sin(phase * 2);
                    decay = Math.exp(-3.4 * progress); break;
                case 'bubble':
                    tone = Math.sin(phase) + .08 * Math.sin(phase * 2);
                    decay = Math.exp(-5.5 * progress); break;
                case 'crunch':
                    tone = softNoise * 1.4 + .18 * Math.sin(phase);
                    decay = Math.exp(-6 * progress) * (.75 + .25 * Math.sin(TAU * 53 * age)); break;
                case 'wood':
                    tone = .7 * Math.sin(phase) + .22 * Math.sin(phase * 2.61) + .08 * softNoise;
                    decay = Math.exp(-8 * progress); break;
                default:
                    tone = .8 * Math.sin(phase) + .15 * Math.sin(phase * 2.003) * Math.exp(-5 * progress)
                        + .05 * Math.sin(phase * 3.99) * Math.exp(-10 * progress);
            }
            mix[start + i] += tone * envelope * decay * n.gain;
        }
    });
    if (score.room) {
        const delay = Math.round(SAMPLE_RATE * .117);
        // Two finite room reflections; reverse traversal prevents feedback.
        for (let i = count - 1; i >= delay; i--) {
            mix[i] += mix[i - delay] * .13 + (i >= 2 * delay ? mix[i - 2 * delay] * .055 : 0);
        }
    }
    let peak = 0;
    for (let i = 0; i < count; i++) {
        mix[i] *= Math.min(1, i / 48, (count - 1 - i) / 240);
        peak = Math.max(peak, Math.abs(mix[i]));
    }
    // Worst-case four effects plus two overlapping music tails remain < 1.0.
    const gain = peak ? (score.peak || .17) / peak : 0;
    const bytes = new Uint8Array(44 + count * 2), view = new DataView(bytes.buffer);
    const write = (text, offset) => { for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i); };
    write('RIFF', 0); view.setUint32(4, bytes.length - 8, true); write('WAVEfmt ', 8);
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, SAMPLE_RATE, true); view.setUint32(28, SAMPLE_RATE * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); write('data', 36);
    view.setUint32(40, count * 2, true);
    for (let i = 0; i < count; i++) view.setInt16(44 + i * 2, Math.round(mix[i] * gain * 32767), true);
    return bytes;
}

let compiled;
function soundBank() {
    if (!compiled) compiled = Object.fromEntries(Object.entries(scores()).map(([name, score]) =>
        [name, { data: renderWave(score), duration: score.duration, copies: score.copies }]));
    return compiled;
}

/**
 * Give this a dedicated empty audio root and the game's options.addAsset.
 * Call register() once assets can be registered (or return .assets in getAssets).
 * Each game frame: tick(seconds, { scene: 'home'|'garden'|'salvage', enabled, music }).
 * Discrete events: play('pet'|'eat'|'happy'|'jump'|'collect'|'bounce'|'build'|'reward'|'click'|'splash').
 * enabled=false stops everything; music=false keeps interaction sounds enabled.
 */
class RamblerAudio {
    constructor(root, addAsset) {
        this.root = root;
        this.addAsset = addAsset;
        this.assets = {};
        this.voices = [];
        this.time = 0;
        this.enabled = true;
        this.scene = null;
        this.music = true;
        this.nextMusicAt = 0;
        this.closed = false;
        for (const [name, sound] of Object.entries(soundBank())) {
            for (let copy = 0; copy < sound.copies; copy++) {
                const key = `little_rambler_${name}_${copy}`;
                const node = new GameNode.Asset({ assetInfo: {} });
                node.node.asset = undefined;
                root.addChild(node, false);
                // Every Asset owns its bytes if Squish transfers the buffer.
                this.assets[key] = new Asset({ id: key, type: 'audio' }, sound.data.slice());
                this.voices.push({ key, name, node, duration: sound.duration,
                    isMusic: name.startsWith('music_'), active: false, until: 0, readyAt: 0 });
            }
        }
    }

    register() {
        if (this.registered || !this.addAsset) return;
        this.registered = true;
        for (const [key, asset] of Object.entries(this.assets)) {
            try {
                const pending = this.addAsset(key, asset);
                if (pending && pending.catch) pending.catch(() => {});
            } catch (_) { /* An unavailable sound must not interrupt the game. */ }
        }
    }

    changed() {
        if (this.root.node && this.root.node.onStateChange) this.root.node.onStateChange();
    }

    play(name) {
        if (this.closed || !this.enabled) return false;
        const isMusic = name.startsWith('music_');
        if (isMusic && !this.music) return false;
        if (!isMusic && this.voices.filter(voice => voice.active && !voice.isMusic).length >= MAX_EFFECT_VOICES) return false;
        const voice = this.voices.find(candidate => candidate.name === name && !candidate.active && candidate.readyAt <= this.time);
        if (!voice) return false;
        voice.active = true;
        voice.until = this.time + voice.duration;
        voice.node.node.asset = { [voice.key]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 } };
        this.changed();
        return true;
    }

    stopVoice(voice) {
        voice.active = false;
        voice.node.node.asset = undefined;
        // Keep at least one absent rendered frame before a key can recur.
        voice.readyAt = this.time + .1;
    }

    tick(dt, context = {}) {
        if (this.closed) return false;
        if (Number.isFinite(dt) && dt > 0) this.time += dt;
        const scene = Object.prototype.hasOwnProperty.call(MUSIC_PERIODS, context.scene) ? context.scene : 'home';
        const enabled = context.enabled !== false, music = context.music !== false;
        const changedScene = scene !== this.scene;
        const restarting = enabled && music && (!this.enabled || !this.music || changedScene);
        let changed = false;
        for (const voice of this.voices) {
            if (voice.active && (voice.until <= this.time || !enabled || (voice.isMusic && (!music || changedScene)))) {
                this.stopVoice(voice);
                changed = true;
            }
        }
        this.enabled = enabled;
        this.music = music;
        this.scene = scene;
        if (restarting) this.nextMusicAt = this.time;
        if (enabled && music && this.time >= this.nextMusicAt && this.play('music_' + scene)) {
            this.nextMusicAt = this.time + MUSIC_PERIODS[scene];
            changed = true;
        }
        if (changed) this.changed();
        return changed;
    }

    mute() {
        this.enabled = false;
        this.voices.filter(voice => voice.active).forEach(voice => this.stopVoice(voice));
        this.changed();
    }

    close() {
        this.mute();
        this.closed = true;
    }
}

module.exports = { RamblerAudio, SAMPLE_RATE, MUSIC_PERIODS, soundBank };
