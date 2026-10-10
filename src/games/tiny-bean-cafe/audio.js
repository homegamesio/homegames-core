const { Asset, GameNode } = require('squish-142');

const SAMPLE_RATE = 22050;
const TAU = Math.PI * 2;
const CAFE_CUES = {
    grind: { duration: .95, peak: .058 },
    tamp: { duration: .95, peak: .053 },
    espresso: { duration: .95, peak: .061 },
    water: { duration: .9, peak: .052 },
    milk: { duration: .9, peak: .052 },
    foam: { duration: .95, peak: .046 },
    chocolate: { duration: .75, peak: .045 },
    cup: { duration: .3, peak: .041 },
    whip: { duration: .95, peak: .048 },
    select: { duration: .22, peak: .037 },
    serve: { duration: .4, peak: .045 }
};

// Original Foley, synthesized here so local and hosted games need no downloads.
// A seeded generator makes the PCM identical in a browser or a game server.
function random(seed) {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

function noiseSource(seed) {
    const next = random(seed);
    let bass = 0, body = 0, soft = 0;
    return () => {
        const white = next() * 2 - 1;
        bass += .034 * (white - bass);
        body += .15 * (white - body);
        soft += .43 * (white - soft);
        return { bass, body, soft, air: soft - body, grain: body - bass };
    };
}

function envelope(time, start, end, attack = .04, release = .1) {
    if (time <= start || time >= end) return 0;
    return Math.min(1, (time - start) / attack) * Math.min(1, (end - time) / release);
}

// Damped, inharmonic modes give a little tool or cup contact, not a musical note.
function contact(time, at, modes, decay) {
    const age = time - at;
    if (age <= 0 || age > decay * 8) return 0;
    const attack = Math.min(1, age / .0025);
    return modes.reduce((sum, [frequency, weight]) =>
        sum + Math.sin(TAU * frequency * age) * weight * Math.exp(-age / decay), 0) * attack;
}

function bubbles(seed, start, end, count, thick) {
    const next = random(seed);
    const events = Array.from({ length: count }, (_, index) => ({
        at: start + (index + next() * .7) * (end - start) / count,
        frequency: (thick ? 340 : 750) + next() * (thick ? 700 : 1450),
        decay: .009 + next() * (thick ? .013 : .008),
        strength: .15 + next() * .25
    }));
    return time => {
        let value = 0;
        for (const event of events) {
            const age = time - event.at;
            if (age <= 0 || age > event.decay * 7) continue;
            // A falling bubble resonance gives the liquid an irregular gurgle.
            const phase = TAU * event.frequency * (.62 * age + .38 * event.decay * (1 - Math.exp(-age / event.decay)));
            value += Math.sin(phase) * Math.exp(-age / event.decay) * Math.min(1, age / .0015) * event.strength;
        }
        return value;
    };
}

function foley(name) {
    const seed = Array.from(name).reduce((value, character) => value * 31 + character.charCodeAt(0), 73);
    const noise = noiseSource(seed);
    const liquid = bubbles(seed + 91, name === 'espresso' ? .43 : .14, .82,
        name === 'milk' ? 16 : 25, name === 'milk');
    return time => {
        const n = noise();
        if (name === 'grind') {
            const on = envelope(time, .035, .925, .08, .14);
            const turning = Math.sin(TAU * (104 * time - 13 * time * time));
            const motor = turning * .12 + Math.sin(TAU * 213 * time) * .045;
            const beans = (.45 + .55 * Math.pow(Math.sin(TAU * 31.7 * time), 2)) * n.grain * 1.9;
            return on * (motor + n.body * .85 + beans + n.air * .12);
        }
        if (name === 'tamp') {
            const travel = envelope(time, .35, .57, .05, .06) * n.body * .09;
            const press = contact(time, .58, [[133, .5], [221, .27], [437, .08]], .018);
            const felt = envelope(time, .578, .65, .004, .055) * n.body * .7;
            const lift = contact(time, .845, [[573, .13], [1371, .055]], .014);
            return travel + press + felt + lift;
        }
        if (name === 'espresso') {
            const dock = contact(time, .23, [[197, .18], [719, .065], [1681, .03]], .016);
            const pump = envelope(time, .25, .95, .045, .12);
            // Uneven motor pulses and casing harmonics make a coarse "grrrr".
            // The upper harmonics remain audible on small laptop/phone speakers.
            const phase = TAU * (74 * time + .08 * Math.sin(TAU * 11 * time) + .014 * Math.sin(TAU * 31 * time));
            const vibration = Math.sin(phase) * .22 + Math.sin(phase * 2) * .13
                + Math.sin(phase * 3) * .08 + Math.sin(phase * 5) * .035;
            const casing = Math.sin(TAU * 157 * time) * .025 + Math.sin(TAU * 281 * time) * .022;
            const pressure = .9 + .08 * Math.sin(TAU * 14.3 * time) + n.bass * .12;
            const pour = envelope(time, .39, .94, .15, .12);
            return dock + pump * (vibration + casing + n.grain * .22 + n.body * .16) * pressure
                + pour * (n.air * .075 + liquid(time) * .22);
        }
        if (name === 'water' || name === 'milk') {
            const on = envelope(time, .08, .89, .16, .17);
            const flow = .76 + .16 * Math.sin(TAU * 3.1 * time) + n.bass * .45;
            const stream = name === 'milk' ? n.body * 1.4 + n.air * .11 : n.body * .38 + n.air * .53;
            return on * (stream * flow + liquid(time) * (name === 'milk' ? .8 : 1));
        }
        if (name === 'foam') {
            const on = envelope(time, .07, .94, .11, .16);
            const pressure = .74 + .13 * Math.sin(TAU * 4.7 * time) + n.bass * .5;
            return on * (n.air * .94 + n.body * .25) * pressure;
        }
        if (name === 'chocolate') {
            const shakes = envelope(time, .09, .29, .04, .06) + envelope(time, .35, .57, .04, .09);
            const rattle = contact(time, .115, [[593, .07], [1183, .035]], .011)
                + contact(time, .38, [[593, .06], [1183, .03]], .011);
            return shakes * (n.grain * .58 + n.air * .27) + rattle;
        }
        if (name === 'cup') {
            const rustle = envelope(time, .015, .115, .02, .045)
                + envelope(time, .125, .235, .025, .06) * .65;
            const paper = (n.grain * .72 + n.air * .25) * (.7 + .3 * Math.sin(TAU * 37 * time) ** 2);
            const tap = contact(time, .218, [[173, .18], [367, .075], [743, .018]], .009);
            return rustle * paper + tap;
        }
        if (name === 'whip') {
            const on = envelope(time, .06, .935, .075, .105);
            const pressure = .82 + .065 * Math.sin(TAU * 8.3 * time) + n.bass * .4;
            const hiss = n.air * .61 + n.body * .64;
            const nozzle = contact(time, .055, [[327, .075], [937, .025]], .008);
            // A soft, fuller dispenser spray, distinct from the finer steam hiss.
            return nozzle + on * (hiss * pressure + liquid(time) * .09);
        }
        if (name === 'select') {
            return contact(time, .015, [[841, .25], [1823, .17], [3149, .055]], .024)
                + envelope(time, .012, .04, .003, .02) * n.soft * .12;
        }
        if (name === 'serve') {
            return contact(time, .04, [[677, .24], [1499, .15], [2537, .065]], .046)
                + contact(time, .175, [[677, .065], [1499, .035]], .035)
                + envelope(time, .033, .085, .008, .04) * n.body * .3;
        }
        return 0;
    };
}

function makeCue(name) {
    const { duration, peak } = CAFE_CUES[name];
    const count = Math.ceil(duration * SAMPLE_RATE);
    const samples = new Float32Array(count);
    const sample = foley(name);
    let loudest = 0;
    for (let i = 0; i < count; i++) {
        const edge = Math.min(1, i / (SAMPLE_RATE * .006), (count - 1 - i) / (SAMPLE_RATE * .015));
        samples[i] = sample(i / SAMPLE_RATE) * edge;
        loudest = Math.max(loudest, Math.abs(samples[i]));
    }
    const bytes = new Uint8Array(44 + count * 2);
    const view = new DataView(bytes.buffer);
    const text = (value, offset) => {
        for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i);
    };
    text('RIFF', 0); view.setUint32(4, bytes.length - 8, true);
    text('WAVEfmt ', 8); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, SAMPLE_RATE, true); view.setUint32(28, SAMPLE_RATE * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    text('data', 36); view.setUint32(40, count * 2, true);
    // Normalize once while creating each asset. Even the loudest transient is quiet.
    const gain = loudest ? peak / loudest : 0;
    for (let i = 0; i < count; i++) view.setInt16(44 + i * 2, Math.round(samples[i] * gain * 32767), true);
    return bytes;
}

class CafeAudio {
    constructor(root) {
        this.root = root;
        this.assets = {};
        this.voices = [];
        this.time = 0;
        this.closed = false;
        for (const [name, cue] of Object.entries(CAFE_CUES)) {
            const bytes = makeCue(name);
            // Alternating keys permit another contact while the previous one fades.
            for (let copy = 0; copy < 2; copy++) this.add(name, copy, bytes, cue.duration);
        }
    }

    add(name, copy, bytes, duration) {
        const key = `tiny_bean_cafe_${name}_${copy}`;
        const node = new GameNode.Asset({ assetInfo: {} });
        node.node.asset = undefined;
        this.assets[key] = new Asset({ id: key, type: 'audio' }, bytes);
        this.voices.push({ key, name, node, duration, until: 0, readyAt: 0, active: false });
    }

    play(name) {
        if (this.closed || this.voices.filter(voice => voice.active).length >= 4) return false;
        const voice = this.voices.find(candidate => candidate.name === name && !candidate.active && candidate.readyAt <= this.time);
        if (!voice) return false;
        voice.active = true;
        voice.until = this.time + voice.duration;
        voice.node.node.asset = { [voice.key]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 } };
        this.sync();
        return true;
    }

    tick(dt) {
        if (this.closed) return false;
        this.time += Number.isFinite(dt) && dt > 0 ? dt : 0;
        let changed = false;
        for (const voice of this.voices) {
            if (!voice.active || voice.until > this.time) continue;
            voice.active = false;
            voice.node.node.asset = undefined;
            // Leave the key absent for rendered frames before reusing it.
            voice.readyAt = this.time + .1;
            changed = true;
        }
        if (changed) this.sync();
        return changed;
    }

    sync() {
        this.root.node.children = this.voices.filter(voice => voice.active).map(voice => voice.node);
        this.root.node.onStateChange();
    }

    mute() {
        const changed = this.voices.some(voice => voice.active);
        for (const voice of this.voices) {
            if (voice.active) voice.readyAt = this.time + .1;
            voice.active = false;
            voice.node.node.asset = undefined;
        }
        if (changed) this.sync();
        return changed;
    }

    close() {
        this.mute();
        this.closed = true;
    }
}

module.exports = { CafeAudio, CAFE_CUES, SAMPLE_RATE };
