const { Asset, GameNode } = require('squish-142');

// Original crystal, harp, and soft choir arrangements. These ordinary PCM assets
// sound the same in hosted Homegames, browser-local play, and offline exports.
const RATE = 22050, TAU = Math.PI * 2, PERIOD = 9.6;
const midi = pitch => 440 * Math.pow(2, (pitch - 69) / 12);
const note = (at, pitch, duration, volume, voice = 'crystal') => ({ at, frequency: midi(pitch), duration, volume, voice });
const chord = (at, pitches, duration, volume, voice = 'choir') => pitches.map(p => note(at, p, duration, volume, voice));
const run = (pitches, gap = .055, duration = .5, volume = .09, voice = 'crystal', at = 0) =>
    pitches.map((p, i) => note(at + i * gap, p, duration, volume, voice));
const sweep = (start, end, duration, volume = .08) => ({ at: 0, frequency: start, endFrequency: end, duration, volume, voice: 'silk' });
const thump = (at = 0, volume = .11) => ({ at, frequency: 130, endFrequency: 42, duration: .22, volume, voice: 'thump' });

function accompaniment(realm, sparkle = false) {
    const score = [], beat = .4;
    const realms = [
        { chords: [[50, 57, 61, 66], [47, 54, 57, 62], [43, 50, 57, 59], [45, 52, 57, 62]],
            melody: [[78, 81, 76, 74], [78, 74, 73, 69], [74, 78, 81, 83], [81, 76, 73, 74]], voice: 'crystal' },
        { chords: [[43, 50, 54, 57], [40, 47, 50, 54], [47, 54, 57, 61], [45, 52, 57, 62]],
            melody: [[78, 85, 81, 76], [78, 74, 78, 81], [83, 78, 74, 76], [81, 76, 73, 78]], voice: 'harp' },
        { chords: [[47, 54, 57, 62], [43, 50, 57, 61], [40, 47, 54, 59], [42, 49, 57, 61]],
            melody: [[78, 83, 85, 81], [85, 81, 78, 73], [83, 78, 74, 78], [81, 85, 78, 73]], voice: 'glass' }
    ];
    // All three harmonies share the cascade's D-major pentatonic notes. The
    // changing roots and instruments create variety without fighting the SFX.
    const palette = realms[realm];
    palette.chords.forEach((harmony, bar) => {
        const at = bar * 6 * beat;
        if (sparkle) {
            [0, 1, 2, 3, 4, 5].forEach((step, i) => score.push(note(at + step * beat,
                harmony[[0, 2, 1, 3, 2, 1][i]] + 24, .68, .018, 'harp')));
            score.push(note(at + 3 * beat, palette.melody[bar][2] + 12, 1.1, .016, 'glass'));
        } else {
            score.push(...chord(at, harmony, 6 * beat + .45, .012));
            score.push(note(at, harmony[0] - 12, 1.3, .034, 'velvet'));
            [0, 1.5, 3.5, 5].forEach((step, i) => score.push(note(at + step * beat,
                palette.melody[bar][i], .92, .035, palette.voice)));
            [1, 2.5, 4].forEach((step, i) => score.push(note(at + step * beat,
                harmony[(i + 1) % harmony.length] + 12, .75, .024, 'harp')));
        }
    });
    return score;
}

function radianceSong() {
    const notes = [];
    const phrases = [[74, 78, 81, 85, 83, 81], [78, 81, 86, 88, 85, 86]];
    phrases.forEach((pitches, bar) => {
        const at = bar * 1.44;
        notes.push(...run(pitches, .24, .58, .071, 'crystal', at));
        notes.push(...chord(at, bar ? [43, 50, 57, 62] : [50, 57, 61, 66], 1.7, .021));
        notes.push(note(at, bar ? 43 : 38, .65, .08, 'velvet'));
    });
    notes.push(...run([81, 86, 90, 93], .065, .82, .075, 'glass', 2.88),
        ...chord(2.88, [50, 57, 62, 66, 69], 1.2, .032));
    return notes;
}

function compositions() {
    const bank = {
        select: { notes: [note(0, 86, .11, .067, 'harp'), note(.014, 93, .13, .021)], count: 2 },
        ui: { notes: [note(0, 81, .11, .061, 'harp'), note(.023, 86, .15, .023)], count: 2 },
        swap: { notes: [note(0, 74, .14, .086, 'harp'), note(.055, 81, .19, .081, 'harp'), sweep(500, 1100, .15, .021)], count: 2 },
        invalid: { notes: [note(0, 55, .18, .075, 'velvet'), note(.06, 54, .21, .064, 'harp')], count: 1 },
        land: { notes: [note(0, 62, .12, .066, 'harp'), thump(0, .027)], count: 2 },
        row: { notes: [...run([74, 78, 81, 86, 90, 93], .031, .37, .075, 'glass'), sweep(260, 1900, .29, .047), thump(0, .095)], count: 2, echo: .11 },
        col: { notes: [...run([81, 74, 86, 78, 90, 93], .037, .4, .075, 'crystal'), sweep(180, 2300, .31, .047), thump(0, .095)], count: 2, echo: .11 },
        burst: { notes: [thump(0, .14), sweep(1900, 180, .4, .048),
            ...chord(.02, [50, 57, 62], .62, .044, 'velvet'), ...run([86, 90, 93, 98], .035, .64, .062, 'glass')], count: 2, echo: .12 },
        prism: { notes: [...run([62, 69, 74, 78, 81, 86, 90, 93], .055, .63, .083),
            ...chord(.35, [50, 57, 62, 66], .95, .036), sweep(240, 1700, .6, .044)], count: 1, echo: .16 },
        combo: { notes: [...run([78, 81, 86, 90], .055, .48, .089, 'harp'),
            ...chord(.165, [74, 78, 81], .49, .032, 'crystal'), thump(0, .075)], count: 2, echo: .1 },
        radiance: { notes: radianceSong(), count: 1, echo: .16 },
        shuffle: { notes: [...run([86, 81, 78, 74, 69, 74, 78, 86], .047, .32, .057, 'harp'), sweep(650, 1400, .46, .039)], count: 1, echo: .09 },
        win: { notes: [...run([74, 78, 81, 86, 85, 90], .12, .67, .075),
            ...chord(.6, [50, 57, 62, 66, 69], 1.2, .037), ...run([86, 90, 93, 98], .06, .78, .058, 'glass', .64)], count: 1, echo: .16 },
        lose: { notes: [...run([81, 78, 74], .25, .66, .064, 'harp'), ...chord(.5, [47, 54, 57, 62], .9, .021)], count: 1, echo: .12 },
        star: { notes: [...run([86, 90, 93], .06, .57, .095), note(.08, 74, .42, .046, 'harp')], count: 3, echo: .12 },
    };
    [74, 76, 78, 81, 83, 86, 88, 90, 93].forEach((pitch, i) => {
        bank['match' + i] = { notes: [note(0, pitch, .5, .115), note(.014, pitch + 7, .33, .036, 'glass'),
            note(0, pitch - 12, .19, .062, 'harp'), thump(0, .022)], count: 2, echo: .085 };
    });
    for (let realm = 0; realm < 3; realm++) {
        bank['music' + realm] = { notes: accompaniment(realm), duration: PERIOD + .72, count: 2, echo: .18, echoMix: .2 };
        bank['shine' + realm] = { notes: accompaniment(realm, true), duration: PERIOD + .72, count: 2, echo: .13, echoMix: .22 };
    }
    return bank;
}

function wave(notes, options = {}) {
    const echo = options.echo || 0, echoMix = options.echoMix === undefined ? .18 : options.echoMix;
    const duration = options.duration || Math.max(.01, ...notes.map(n => n.at + n.duration)) + echo * 2;
    const length = Math.ceil(RATE * Math.min(16, duration)), samples = new Float32Array(length);
    for (const [index, n] of notes.entries()) {
        let seed = Math.imul(index + 1, 2654435761) >>> 0;
        const start = Math.max(0, Math.round(n.at * RATE)), count = Math.ceil(n.duration * RATE);
        for (let i = 0; i < count && start + i < length; i++) {
            const age = i / RATE, progress = age / n.duration;
            const phase = TAU * (n.frequency * age + ((n.endFrequency || n.frequency) - n.frequency) * age * age / (2 * n.duration));
            seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
            const noise = (seed >>> 0) / 2147483648 - 1;
            const attack = n.voice === 'choir' ? .24 : n.voice === 'velvet' ? .012 : .0017;
            const envelope = Math.min(1, age / attack) * Math.min(1, (1 - progress) * (n.voice === 'choir' ? 5 : 18));
            let tone, decay = Math.exp(-4 * progress);
            switch (n.voice) {
                case 'choir':
                    tone = Math.sin(phase) * .62 + Math.sin(phase * 1.0017) * .23 + Math.sin(phase * 2.002) * .15;
                    decay = .83 + Math.sin(age * 3.5) * .04; break;
                case 'velvet':
                    tone = Math.sin(phase) * .88 + Math.sin(phase * 2) * .12; decay = Math.exp(-3 * progress); break;
                case 'harp':
                    tone = Math.sin(phase) * .69 + Math.sin(phase * 2) * .22 + Math.sin(phase * 3) * .09 + noise * .02 * Math.exp(-40 * progress);
                    decay = Math.exp(-5 * progress); break;
                case 'glass':
                    tone = Math.sin(phase) * .68 + Math.sin(phase * 2.756) * .18 * Math.exp(-6 * progress) + Math.sin(phase * 4.08) * .1 * Math.exp(-9 * progress) + Math.sin(phase * 6.62) * .04 * Math.exp(-13 * progress);
                    decay = Math.exp(-3 * progress); break;
                case 'silk':
                    tone = Math.sin(phase) * .38 + noise * .62; decay = Math.sin(Math.PI * progress) * (1 - progress); break;
                case 'thump': tone = Math.sin(phase); decay = Math.exp(-7 * progress); break;
                default:
                    tone = Math.sin(phase) * .75 + Math.sin(phase * 2.001) * .17 * Math.exp(-5 * progress) + Math.sin(phase * 4.004) * .08 * Math.exp(-8 * progress);
            }
            samples[start + i] += tone * envelope * decay * n.volume;
        }
    }
    if (echo) {
        const delay = Math.round(echo * RATE);
        for (let i = length - 1; i >= delay; i--) samples[i] += samples[i - delay] * echoMix + (i >= delay * 2 ? samples[i - delay * 2] * echoMix * .42 : 0);
    }
    const bytes = new Uint8Array(44 + length * 2), view = new DataView(bytes.buffer);
    const text = (value, offset) => { for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i); };
    text('RIFF', 0); view.setUint32(4, bytes.length - 8, true); text('WAVEfmt ', 8);
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, RATE, true); view.setUint32(28, RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    text('data', 36); view.setUint32(40, length * 2, true);
    for (let i = 0; i < length; i++) {
        const sample = .82 * samples[i] / (1 + Math.abs(samples[i]) * .3);
        const fade = Math.min(1, i / 30, (length - 1 - i) / 150);
        view.setInt16(44 + i * 2, Math.round(Math.max(-.94, Math.min(.94, sample)) * fade * 32767), true);
    }
    return bytes;
}

let compiled;
function bank() {
    if (!compiled) compiled = Object.fromEntries(Object.entries(compositions()).map(([name, score]) =>
        [name, { data: wave(score.notes, score), count: score.count }]));
    return compiled;
}
const musicVoice = name => name.startsWith('music') || name.startsWith('shine');
function eventName(event) {
    if (typeof event === 'string') {
        if (event === 'match') return 'match0';
        if (event.startsWith('match:')) return 'match' + Math.max(0, Math.min(8, Math.floor(Number(event.slice(6)) || 1) - 1));
        if (event.startsWith('special:')) return event.slice(8);
        return event === 'click' ? 'ui' : event;
    }
    if (!event || typeof event !== 'object') return '';
    const type = event.type || event.name;
    if (type === 'match') return 'match' + Math.max(0, Math.min(8, Math.floor(Number(event.cascade) || 1) - 1));
    if (type === 'special') return ['row', 'col', 'burst', 'prism'].includes(event.kind || event.special) ? event.kind || event.special : 'prism';
    return typeof type === 'string' ? eventName(type) : '';
}

class Sound {
    constructor(root, addAsset) {
        this.assets = {}; this.voices = []; this.clock = 0; this.addAsset = addAsset;
        this.musicWanted = false; this.nextMusicAt = 0; this.realm = 0;
        for (const [name, sound] of Object.entries(bank())) for (let i = 0; i < sound.count; i++) {
            const key = 'facet_' + name + '_' + i;
            this.assets[key] = new Asset({ id: key, type: 'audio' }, sound.data.slice());
            const node = new GameNode.Asset({ assetInfo: {} }); node.node.asset = undefined; root.addChild(node, false);
            this.voices.push({ name, key, node, duration: (sound.data.length - 44) / (RATE * 2), active: false, until: -1, started: -1, availableAt: -1 });
        }
    }
    register() {
        if (this.registered || !this.addAsset) return;
        this.registered = true;
        for (const [key, asset] of Object.entries(this.assets)) {
            try { const pending = this.addAsset(key, asset); if (pending && pending.catch) pending.catch(() => {}); }
            catch (_) { /* Optional sound can never prevent play. */ }
        }
    }
    play(name) {
        if (!musicVoice(name) && this.voices.filter(v => v.active && !musicVoice(v.name)).length >= 10) return false;
        const voice = this.voices.find(v => v.name === name && !v.active && v.availableAt <= this.clock);
        if (!voice) return false;
        voice.active = true; voice.started = this.clock; voice.until = this.clock + voice.duration;
        voice.node.node.asset = { [voice.key]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 } };
        return true;
    }
    tick(events, dt, enabled, context) {
        if (Number.isFinite(dt) && dt > 0) this.clock += Math.min(dt, 30);
        const inputs = Array.isArray(events) ? events : [];
        for (const voice of this.voices) if (voice.active && (!enabled || voice.until <= this.clock || musicVoice(voice.name) && context && context.music === false)) {
            voice.node.node.asset = undefined; voice.active = false; voice.availableAt = this.clock + .04;
        }
        if (enabled) {
            const names = [...new Set(inputs.map(eventName))].filter(name => name && !musicVoice(name));
            // A single resolution can report several matched groups. Let the
            // highest cascade sing, with its lower neighbors left out of the mix.
            const matches = names.filter(name => /^match[0-8]$/.test(name));
            const topMatch = matches.sort().at(-1);
            for (const name of names) if (!/^match/.test(name) || name === topMatch) this.play(name);
            const wanted = !!context && context.music !== false && !['won', 'win', 'cleared', 'lost', 'lose'].includes(context.phase);
            if (wanted && !this.musicWanted) {
                const phrases = this.voices.filter(v => v.active && v.name.startsWith('music')).map(v => v.started + PERIOD);
                this.nextMusicAt = Math.max(this.clock, ...phrases);
            }
            this.realm = Number.isInteger(context?.realm) ? Math.max(0, Math.min(2, context.realm)) : 0;
            if (wanted && this.clock + 1e-8 >= this.nextMusicAt && this.play('music' + this.realm)) {
                if (context.radiance || context.intensity >= .6) this.play('shine' + this.realm);
                this.nextMusicAt = this.clock + PERIOD;
            }
            this.musicWanted = wanted;
        } else { this.musicWanted = false; this.nextMusicAt = this.clock; }
        inputs.length = 0;
    }
    close() { this.tick([], 0, false); }
}

module.exports = { Sound, SoundBank: Sound, wave, MUSIC_PERIOD: PERIOD };
