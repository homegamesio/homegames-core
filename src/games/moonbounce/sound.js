const { Asset, GameNode } = require('squish-150');

// Original instruments, motifs and accompaniment, synthesized as portable PCM.
// Browser and hosted Homegames sessions play the same ordinary audio assets.
const RATE = 22050;
const TAU = Math.PI * 2;
const OUTPUT_GAIN = .82; // Leave headroom when a power, combo and final peg coincide.
const MUSIC_PERIOD = 9.6; // Four bars at 100 BPM; releases overlap the next phrase.
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
const note = (at, pitch, duration, volume, voice = 'bell') => ({ at, frequency: midi(pitch), duration, volume, voice });
const noise = (at, duration, volume, voice = 'hat') => ({ at, duration, volume, voice, frequency: 0 });
const drum = (at, volume = .12) => ({ at, duration: .22, frequency: 135, endFrequency: 43, volume, voice: 'kick' });
const phrase = (pitches, gap, duration = .34, volume = .16, voice = 'bell', at = 0) =>
    pitches.map((pitch, i) => note(at + i * gap, pitch, duration, volume, voice));
const chord = (at, pitches, duration, volume, voice = 'pad') => pitches.map(p => note(at, p, duration, volume, voice));

function music(world = 0) {
    const score = [], beat = .6;
    const palettes = [
        { transpose: 0, lead: 'bell', rhythm: [0, 1.5, 2.5, 3.25], motifs: [[76, 79, 74, 72], [74, 79, 83, 79], [76, 79, 83, 84], [81, 79, 76, 74]] },
        { transpose: 2, lead: 'pluck', rhythm: [0, .75, 2, 3.5], motifs: [[72, 76, 79, 84], [79, 83, 86, 79], [84, 79, 76, 79], [81, 84, 79, 77]] },
        { transpose: -2, lead: 'bell', rhythm: [0, 1.75, 2.75, 3.5], motifs: [[84, 79, 76, 74], [83, 86, 79, 74], [84, 83, 79, 76], [81, 79, 77, 72]] },
        { transpose: -3, lead: 'pluck', rhythm: [0, .5, 2, 2.75], motifs: [[76, 84, 79, 76], [74, 83, 79, 74], [76, 83, 84, 79], [77, 81, 79, 72]] },
        { transpose: 5, lead: 'bell', rhythm: [0, 1, 2.5, 3], motifs: [[72, 79, 84, 88], [74, 79, 83, 86], [76, 79, 84, 83], [81, 79, 76, 72]] },
    ];
    const palette = palettes[world] || palettes[0], shift = palette.transpose;
    const changes = [[36, [60, 64, 67, 74]], [40, [59, 62, 67, 71]], [33, [60, 64, 67, 71]], [41, [57, 60, 67, 69]]];
    changes.forEach(([root, harmony], bar) => {
        const at = bar * 4 * beat;
        score.push(...chord(at, harmony.map(n => n + shift), 4 * beat + .23, .012));
        [0, 1.75, 2.5, 3.5].forEach((b, i) => score.push(note(at + b * beat, root + shift + (i === 2 ? 7 : 0), .29, .046, 'bass')));
        [0, 2].forEach(b => score.push(drum(at + b * beat, .032)));
        [1, 3].forEach(b => score.push(noise(at + b * beat, .12, .013, 'snare')));
        for (let eighth = 0; eighth < 8; eighth++) score.push(noise(at + eighth * beat / 2, .042, eighth % 2 ? .009 : .005));
        palette.rhythm.forEach((b, i) => score.push(note(at + b * beat, palette.motifs[bar][i] + shift, .46, .031, palette.lead)));
    });
    return score;
}

function fanfare() {
    const score = [], beat = .375;
    // A four-bar call, ascending answer, syncopated turn, and C-major landing.
    const melody = [[72, 79, 76, 74, 81, 79], [77, 84, 81, 79, 86, 84],
        [81, 79, 76, 84, 83, 79], [74, 79, 83, 86, 88, 84]];
    const roots = [36, 41, 45, 43];
    const harmonies = [[60, 64, 67], [60, 65, 69], [60, 64, 69], [59, 62, 67]];
    melody.forEach((pitches, bar) => {
        const at = bar * 4 * beat;
        score.push(...chord(at, harmonies[bar], 4 * beat, .046));
        [0, .5, 1.5, 2, 2.75, 3.5].forEach((b, i) => {
            score.push(note(at + b * beat, pitches[i], .3, .145, 'lead'));
            score.push(note(at + b * beat, pitches[i] + 12, .23, .043, 'bell'));
        });
        for (let b = 0; b < 4; b++) {
            score.push(note(at + b * beat, roots[bar] + (b % 2 ? 7 : 0), .3, .135, 'bass'));
            score.push(b % 2 ? noise(at + b * beat, .16, .067, 'snare') : drum(at + b * beat, .15));
            score.push(noise(at + (b + .5) * beat, .055, .024));
        }
    });
    score.push(...chord(6, [48, 60, 64, 67, 72], 1.05, .055), ...phrase([84, 88, 91, 96], .06, .68, .11, 'bell', 6), drum(6, .19));
    return score;
}

function compositions() {
    const scores = {
        shot: { notes: [note(0, 60, .14, .2, 'pluck'), drum(.005, .17),
            { at: .01, frequency: 1050, endFrequency: 180, duration: .17, volume: .095, voice: 'air' }], count: 2 },
        orange: { notes: [drum(0, .16), note(0, 60, .26, .09, 'pluck'), note(.006, 79, .32, .11), note(.025, 84, .32, .065)], count: 3, echo: .09 },
        power: { notes: [...phrase([60, 67, 72, 76, 79, 84], .045, .36, .13),
            ...chord(.19, [60, 64, 67, 74], .65, .055),
            { at: 0, frequency: 120, endFrequency: 1700, duration: .31, volume: .075, voice: 'air' }], count: 2, echo: .12 },
        catch: { notes: [note(0, 55, .21, .16, 'pluck'), ...phrase([76, 79, 84], .045, .28, .16), drum(0, .09)], count: 2, echo: .09 },
        free: { notes: [...phrase([79, 84, 88, 86, 91, 96], .0625, .38, .14),
            ...chord(.2, [60, 64, 67], .57, .06), note(0, 48, .38, .12, 'bass')], count: 2, echo: .12 },
        style: { notes: [...phrase([76, 79, 86], .058, .31, .12, 'pluck'), noise(0, .1, .04, 'snare')], count: 2, echo: .09 },
        combo: { notes: [...phrase([72, 76, 79, 84], .045, .28, .13, 'lead'),
            ...chord(.135, [76, 79, 86], .41, .07, 'bell'), drum(0, .13)], count: 2, echo: .1 },
        impact: { notes: [drum(0, .24), note(0, 36, .35, .15, 'bass'),
            noise(.006, .18, .12, 'snare'), note(.035, 67, .4, .07, 'bell')], count: 2, echo: .075 },
        wall: { notes: [note(0, 48, .08, .065, 'pluck')], count: 2 },
        jackpot: { notes: [drum(0, .21), ...chord(0, [48, 60, 64, 67], .85, .075),
            ...phrase([79, 84, 88, 91, 96], .067, .54, .16)], count: 2, echo: .14 },
        fever: { notes: fanfare(), count: 1, echo: .13 },
        win: { notes: [...phrase([76, 79, 86, 84, 88], .12, .55, .15, 'lead'),
            ...chord(.48, [48, 60, 64, 67, 72], 1.05, .065), ...phrase([84, 88, 91], .06, .72, .12, 'bell', .48), drum(.48, .15)], count: 1, echo: .14 },
        clear: { notes: [...phrase([72, 79, 84, 88], .095, .48, .15), ...chord(.285, [60, 64, 67], .85, .06)], count: 1, echo: .12 },
        lose: { notes: [note(0, 76, .47, .12), note(.23, 74, .55, .105), note(.5, 72, .66, .09),
            ...chord(.5, [48, 55, 60, 64], .8, .034)], count: 1, echo: .12 },
        click: { notes: [note(0, 84, .075, .08, 'pluck'), note(.012, 91, .07, .04)], count: 2 },
        bumper: { notes: [note(0, 48, .16, .13, 'pluck'), note(.025, 79, .2, .07), drum(0, .08)], count: 3 },
        portal: { notes: [...phrase([72, 79, 86, 91], .032, .3, .075), { at: 0, frequency: 200, endFrequency: 1500, duration: .3, volume: .04, voice: 'air' }], count: 2, echo: .11 },
        rescue: { notes: [...phrase([67, 72, 76, 79, 84], .05, .38, .1), ...chord(.2, [60, 64, 67], .6, .04)], count: 1, echo: .12 },
        unlock: { notes: [...phrase([72, 76, 79, 84, 91], .09, .5, .11), ...chord(.36, [48, 60, 64, 67], .9, .045)], count: 1, echo: .14 },
        music: { notes: music(), count: 2, duration: MUSIC_PERIOD + .45, echo: .12, echoMix: .14 },
    };
    for (let world = 1; world < 5; world++) scores['music' + world] = { notes: music(world), count: 2, duration: MUSIC_PERIOD + .45, echo: .12, echoMix: .14 };
    [72, 74, 76, 79, 81, 84, 86, 88].forEach((pitch, i) => {
        scores['hit' + i] = { notes: [note(0, pitch, .32, .185), note(0, pitch - 12, .16, .075, 'pluck'),
            noise(0, .018, .03, 'tap')], count: 3, echo: .07 };
    });
    return scores;
}

function wave(notes, options = {}) {
    const echo = options.echo || 0, echoMix = options.echoMix === undefined ? .18 : options.echoMix;
    const duration = options.duration || Math.max(...notes.map(n => n.at + n.duration)) + echo * 2;
    const length = Math.ceil(RATE * duration), mix = new Float32Array(length);
    notes.forEach((n, index) => {
        let seed = (index + 1) * 2654435761 >>> 0, previousNoise = 0;
        const start = Math.round(n.at * RATE), count = Math.ceil(n.duration * RATE);
        for (let i = 0; i < count && start + i < length; i++) {
            const age = i / RATE, progress = age / n.duration;
            const attack = n.voice === 'pad' ? .12 : n.voice === 'lead' ? .009 : .0015;
            const envelope = Math.min(1, age / attack) * Math.min(1, (1 - progress) * (n.voice === 'pad' ? 9 : 24));
            const phase = TAU * ((n.frequency || 0) * age + ((n.endFrequency || n.frequency || 0) - (n.frequency || 0)) * age * age / (2 * n.duration));
            seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
            const hiss = (seed >>> 0) / 2147483648 - 1;
            let tone, decay = Math.exp(-4.2 * progress);
            switch (n.voice) {
                case 'pad':
                    tone = Math.sin(phase) * .55 + Math.sin(phase * .9981) * .27 + Math.sin(phase * 2.002) * .18;
                    decay = 1; break;
                case 'bass':
                    tone = Math.sin(phase) * .8 + Math.sin(phase * 2) * .16 + Math.sin(phase * 3) * .04;
                    decay = Math.exp(-2.7 * progress); break;
                case 'lead':
                    tone = Math.sin(phase) * .65 + Math.sin(phase * 2) * .22 + Math.sin(phase * 3) * .1 + Math.sin(phase * 4) * .03;
                    decay = Math.exp(-2.1 * progress); break;
                case 'pluck':
                    tone = Math.sin(phase) * .69 + Math.sin(phase * 2) * .2 + Math.sin(phase * 3) * .11 + hiss * .045 * Math.exp(-30 * progress);
                    decay = Math.exp(-5.4 * progress); break;
                case 'kick': tone = Math.sin(phase) + hiss * .06 * Math.exp(-25 * progress); decay = Math.exp(-6 * progress); break;
                case 'snare': tone = hiss * .72 + Math.sin(TAU * 184 * age) * .28; decay = Math.exp(-5.8 * progress); break;
                case 'hat': tone = (hiss - previousNoise) * .55; decay = Math.exp(-7 * progress); break;
                case 'tap': tone = hiss; decay = Math.exp(-9 * progress); break;
                case 'air': tone = hiss * .48 + Math.sin(phase) * .52; decay = Math.sin(Math.PI * progress) * (1 - progress); break;
                default:
                    tone = Math.sin(phase) * .7 + Math.sin(phase * 2.002) * .2 * Math.exp(-4 * progress) + Math.sin(phase * 4.007) * .1 * Math.exp(-8 * progress);
            }
            previousNoise = hiss;
            mix[start + i] += tone * envelope * decay * n.volume;
        }
    });
    if (echo) {
        const delay = Math.round(echo * RATE);
        // Reverse traversal keeps this a finite two-tap room, never feedback.
        for (let i = length - 1; i >= delay; i--) mix[i] += mix[i - delay] * echoMix + (i >= delay * 2 ? mix[i - delay * 2] * echoMix * .45 : 0);
    }
    const data = new Uint8Array(44 + length * 2), view = new DataView(data.buffer);
    const write = (value, offset) => { for (let i = 0; i < value.length; i++) data[offset + i] = value.charCodeAt(i); };
    write('RIFF', 0); view.setUint32(4, data.length - 8, true); write('WAVEfmt ', 8);
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, RATE, true); view.setUint32(28, RATE * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); write('data', 36); view.setUint32(40, length * 2, true);
    for (let i = 0; i < length; i++) {
        const sample = OUTPUT_GAIN * mix[i] / (1 + Math.abs(mix[i]) * .28);
        const fade = Math.min(1, i / 24, (length - 1 - i) / 110);
        view.setInt16(44 + i * 2, Math.round(Math.max(-.96, Math.min(.96, sample)) * fade * 32767), true);
    }
    return data;
}

let compiled;
function soundBank() {
    if (!compiled) compiled = Object.fromEntries(Object.entries(compositions()).map(([name, score]) =>
        [name, { data: wave(score.notes, score), count: score.count }]));
    return compiled;
}

class Sound {
    constructor(root, addAsset) {
        this.assets = {}; this.voices = []; this.clock = 0; this.addAsset = addAsset;
        this.musicWanted = false; this.nextMusicAt = 0; this.musicName = 'music';
        for (const [name, sound] of Object.entries(soundBank())) {
            for (let i = 0; i < sound.count; i++) {
                const key = 'moonbounce_' + name + '_' + i;
                // Squish may transfer buffers: each registered asset owns its bytes.
                this.assets[key] = new Asset({ id: key, type: 'audio' }, sound.data.slice());
                const node = new GameNode.Asset({ assetInfo: {} }); node.node.asset = undefined; root.addChild(node, false);
                this.voices.push({ name, key, node, duration: (sound.data.length - 44) / (RATE * 2), until: -1, started: -1, availableAt: -1, active: false });
            }
        }
    }

    register() {
        if (this.registered || !this.addAsset) return;
        this.registered = true;
        for (const [key, asset] of Object.entries(this.assets)) {
            try { const pending = this.addAsset(key, asset); if (pending && pending.catch) pending.catch(() => {}); }
            catch (_) { /* Audio failure must never interrupt a playable board. */ }
        }
    }

    play(name) {
        const voice = this.voices.find(v => v.name === name && !v.active && v.availableAt <= this.clock);
        if (!voice) return false;
        voice.active = true; voice.started = this.clock; voice.until = this.clock + voice.duration;
        voice.node.node.asset = { [voice.key]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 } };
        voice.node.node.onStateChange();
        return true;
    }

    tick(events, dt, enabled, context) {
        if (Number.isFinite(dt) && dt > 0) this.clock += dt;
        for (const voice of this.voices) {
            if (voice.active && (!enabled || voice.until <= this.clock || (voice.name.startsWith('music') && context && context.music === false))) {
                voice.node.node.asset = undefined; voice.active = false;
                voice.node.node.onStateChange();
                // The renderer needs a genuinely absent frame before a key repeats.
                voice.availableAt = this.clock + .04;
            }
        }
        if (enabled) {
            for (const name of new Set(events)) if (!name.startsWith('music')) this.play(name);
            const wanted = !!context && context.music !== false && !context.fever && ['title', 'ready', 'flight'].includes(context.phase);
            const world = context && Number.isInteger(context.world) ? Math.max(0, Math.min(4, context.world)) : 0;
            const musicName = world ? 'music' + world : 'music';
            if (wanted && !this.musicWanted) {
                const priorBar = this.voices.filter(v => v.name.startsWith('music') && v.active).map(v => v.started + MUSIC_PERIOD);
                this.nextMusicAt = Math.max(this.clock, ...priorBar);
            }
            this.musicName = musicName;
            if (wanted && this.clock + 1e-8 >= this.nextMusicAt && this.play(musicName)) this.nextMusicAt = this.clock + MUSIC_PERIOD;
            // On a finale, finish the current phrase instead of chopping a pad.
            // No more phrases are scheduled until ordinary play resumes.
            this.musicWanted = wanted;
        } else { this.musicWanted = false; this.nextMusicAt = this.clock; }
        events.length = 0;
    }
}

module.exports = { Sound, wave };
