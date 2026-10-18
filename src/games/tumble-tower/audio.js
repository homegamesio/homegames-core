const { Asset, GameNode } = require('squish-150');
const RATE = 22050, TAU = Math.PI * 2;

function wav(duration, sample) {
    const count = Math.ceil(duration * RATE), bytes = new Uint8Array(44 + count * 2), view = new DataView(bytes.buffer);
    const text = (s, at) => { for (let i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i); };
    text('RIFF', 0); view.setUint32(4, bytes.length - 8, true); text('WAVEfmt ', 8);
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, RATE, true); view.setUint32(28, RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    text('data', 36); view.setUint32(40, count * 2, true);
    for (let i = 0; i < count; i++) {
        const edge = Math.max(0, Math.min(1, i / 24, (count - 1 - i) / 160));
        view.setInt16(44 + i * 2, Math.round(sample(i / RATE) * edge * 32767), true);
    }
    return bytes;
}

// Material recipes change excitation and damping as well as pitch. Wooden pieces
// clack, rubber flexes with a descending tone, and heavy pieces have a dull body.
const RECIPES = {
    soft: { kind: 'wood', frequency: 540, duration: .18, level: .026, strength: .48 },
    hard: { kind: 'wood', frequency: 360, duration: .25, level: .043, strength: 1 },
    thud: { kind: 'wood', frequency: 155, duration: .34, level: .043, strength: .8 },
    hit: { kind: 'heavy', frequency: 105, duration: .34, level: .044, strength: 1 },
    reset: { kind: 'reset', frequency: 390, duration: .32, level: .023 },
    rubberSoft: { kind: 'rubber', frequency: 180, duration: .22, level: .026 },
    bounce: { kind: 'rubber', frequency: 280, duration: .38, level: .041 },
    heavySoft: { kind: 'heavy', frequency: 205, duration: .2, level: .027, strength: .4 },
    heavyHard: { kind: 'heavy', frequency: 125, duration: .32, level: .045, strength: 1 },
    heavyThud: { kind: 'heavy', frequency: 78, duration: .43, level: .045, strength: 1.2 },
    roll: { kind: 'roll', frequency: 120, duration: .3, level: .014, roughness: 1 },
    rollRubber: { kind: 'roll', frequency: 85, duration: .3, level: .012, roughness: .3 },
    rollHeavy: { kind: 'roll', frequency: 64, duration: .32, level: .016, roughness: 1.6 },
    launch: { kind: 'launch', frequency: 125, duration: .27, level: .025 },
    boom: { kind: 'boom', frequency: 75, duration: .62, level: .047 },
};

function render(recipe, variant) {
    let seed = 6127 + variant * 101 + Math.floor(recipe.frequency), low = 0, warm = 0;
    const pitch = variant ? 1.075 : .965, f = recipe.frequency * pitch;
    return wav(recipe.duration, t => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const noise = seed / 2147483648 - 1;
        low += (noise - low) * .07; warm += (noise - warm) * .28;
        const bright = noise - warm, sin = (frequency, decay = 0) => Math.sin(t * frequency * TAU) * Math.exp(-t * decay);
        let value;
        if (recipe.kind === 'wood') {
            const body = .64 * sin(f, 18) + .23 * sin(f * 2.71, 36) + .12 * sin(f * 5.03, 72);
            const tap = (bright * .62 + warm * .45) * Math.exp(-t * 105) * recipe.strength;
            value = body + tap + low * .17 * Math.exp(-t * 25);
        } else if (recipe.kind === 'rubber') {
            // Integrated descending pitch models a squashed ball relaxing after impact.
            const phase = f * (.35 * t + .65 * (1 - Math.exp(-t * 19)) / 19);
            value = Math.sin(phase * TAU) * Math.exp(-t * 10) * .9
                + .16 * Math.sin(phase * TAU * 2) * Math.exp(-t * 18)
                + warm * .32 * Math.exp(-t * 90);
        } else if (recipe.kind === 'heavy') {
            value = .75 * sin(f, 13) + .2 * sin(f * 1.63, 28)
                + low * 2.2 * Math.exp(-t * 26) + bright * .28 * Math.exp(-t * 115) * recipe.strength;
        } else if (recipe.kind === 'roll') {
            const envelope = Math.sin(Math.PI * t / recipe.duration) ** 2;
            const bumps = (.35 + .65 * Math.max(0, Math.sin(t * TAU * 19))) * recipe.roughness;
            value = envelope * (low * 1.7 + warm * .45 * bumps + sin(f) * .12 * bumps);
        } else if (recipe.kind === 'launch') {
            const envelope = Math.sin(Math.PI * t / recipe.duration) ** 1.7;
            value = envelope * (warm * 1.3 + bright * .2) + .2 * sin(f, 27);
        } else if (recipe.kind === 'boom') {
            const phase = f * (.6 * t + .4 * (1 - Math.exp(-t * 12)) / 12);
            value = .68 * Math.sin(phase * TAU) * Math.exp(-t * 8)
                + low * 2.2 * Math.exp(-t * 11) + warm * .75 * Math.exp(-t * 45)
                + .16 * sin(f * 2.3, 20);
        } else {
            value = (.7 * sin(f, 12) + .35 * sin(f * 1.5, 15)) * Math.min(1, t * 160);
        }
        // Soft saturation and quiet gains leave room for four simultaneous contacts.
        return Math.tanh(value * 1.4) * recipe.level;
    });
}

class TowerAudio {
    constructor(root) {
        this.root = root; this.assets = {}; this.voices = []; this.time = 0; this.nextImpact = 0; this.nextRoll = 0;
        this.enabled = true; this.closed = false; this.nextVariant = {}; this.nextCue = {};
        for (const [name, recipe] of Object.entries(RECIPES)) for (let copy = 0; copy < 2; copy++) {
            const key = `tumble_tower_${name}_${copy}`, data = render(recipe, copy);
            this.assets[key] = new Asset({ id: key, type: 'audio' }, data);
            const node = new GameNode.Asset({ assetInfo: {} }); node.node.asset = undefined;
            this.voices.push({ name, key, copy, node, duration: recipe.duration, active: false, ready: 0, until: 0, started: 0, priority: 0 });
        }
    }
    play(name) {
        if (this.closed || !this.enabled || !RECIPES[name] || (this.nextCue[name] || 0) > this.time) return false;
        const candidates = this.voices.filter(v => v.name === name && !v.active && v.ready <= this.time);
        const v = candidates.find(candidate => candidate.copy === (this.nextVariant[name] || 0)) || candidates[0];
        if (!v) return false;
        const active = this.voices.filter(voice => voice.active), priority = ['launch', 'boom', 'reset', 'hit'].includes(name) ? 2 : name.startsWith('roll') ? 0 : 1;
        if (active.length >= 4) {
            const oldest = active.filter(voice => voice.priority < priority).sort((a, b) => a.started - b.started)[0];
            if (!oldest) return false;
            this.retire(oldest);
        }
        v.active = true; v.started = this.time; v.until = this.time + v.duration; v.priority = priority;
        this.nextVariant[name] = 1 - v.copy;
        this.nextCue[name] = this.time + (name.startsWith('roll') ? .24 : name === 'boom' ? .25 : name === 'launch' ? .12 : .045);
        v.node.node.asset = { [v.key]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 } };
        this.sync(); return true;
    }
    impact(speed, floor, material = 'wood') {
        if (!Number.isFinite(speed) || this.time < this.nextImpact || speed < 2.8) return false;
        let cue = floor && speed > 12 ? 'thud' : speed > 8 ? 'hard' : 'soft';
        if (material === 'rubber' || material === 'bounce') cue = speed > 8 ? 'bounce' : 'rubberSoft';
        else if (material === 'heavy' || material === 'stone') cue = floor && speed > 12 ? 'heavyThud' : speed > 8 ? 'heavyHard' : 'heavySoft';
        const played = this.play(cue);
        if (played) this.nextImpact = this.time + .075;
        return played;
    }
    roll(speed, material = 'wood') {
        if (!Number.isFinite(speed) || Math.abs(speed) < 3.5 || this.time < this.nextRoll) return false;
        const played = this.play(material === 'rubber' ? 'rollRubber' : material === 'heavy' || material === 'stone' ? 'rollHeavy' : 'roll');
        if (played) this.nextRoll = this.time + .27;
        return played;
    }
    retire(voice) { voice.active = false; voice.node.node.asset = undefined; voice.ready = this.time + .1; }
    tick(dt) {
        if (this.closed || !Number.isFinite(dt) || dt <= 0) return;
        this.time += dt; let changed = false;
        for (const voice of this.voices) if (voice.active && voice.until <= this.time) { this.retire(voice); changed = true; }
        if (changed) this.sync();
    }
    sync() { this.root.node.children = this.voices.filter(v => v.active).map(v => v.node); this.root.node.onStateChange(); }
    setEnabled(enabled) {
        if (this.closed) return;
        this.enabled = !!enabled;
        if (!this.enabled) { for (const voice of this.voices) this.retire(voice); this.sync(); }
    }
    mute() { this.setEnabled(false); }
    close() { this.mute(); this.closed = true; }
}
module.exports = { TowerAudio };
