const { Asset, GameNode } = require('squish-150');

const CURSORS = {
    select: { hotspot: { x: 4, y: 3 }, drawing: '<path d="M4 3v23l6-6 5 9 5-3-5-8 9-1Z" fill="#fff6d9" stroke="#162d3d" stroke-width="2.5" stroke-linejoin="round"/>' },
    command: { hotspot: { x: 16, y: 16 }, drawing: '<g fill="none" stroke="#162d3d" stroke-width="5"><circle cx="16" cy="16" r="8"/><path d="M16 2v7m0 14v7M2 16h7m14 0h7"/></g><g fill="none" stroke="#62edd6" stroke-width="2.5"><circle cx="16" cy="16" r="8"/><path d="M16 2v7m0 14v7M2 16h7m14 0h7"/></g><circle cx="16" cy="16" r="2" fill="#fff6d9"/>' },
    build: { hotspot: { x: 7, y: 25 }, drawing: '<rect x="2" y="2" width="28" height="28" rx="4" fill="#173b50" stroke="#ffe58a" stroke-width="1.5"/><path d="M10 4v24M20 4v24M4 11h24M4 21h24" stroke="#376b78" stroke-width="1"/><path d="m6 25 13-13 3 3L9 28Zm6-17 6-6 12 12-6 6-3-3 2-2-6-6-2 2Z" fill="#ffd65b" stroke="#172d3d" stroke-width="1.5" stroke-linejoin="round"/>' },
    attack: { hotspot: { x: 16, y: 16 }, drawing: '<g fill="none" stroke="#172d3d" stroke-width="5"><path d="M4 11V4h7m10 0h7v7m0 10v7h-7m-10 0H4v-7M10 10l12 12m0-12L10 22"/></g><g fill="none" stroke="#ff776d" stroke-width="2.5"><path d="M4 11V4h7m10 0h7v7m0 10v7h-7m-10 0H4v-7M10 10l12 12m0-12L10 22"/></g>' }
};
const SOUNDS = {
    select: [.07, 760, 1100, .035, 0], command: [.14, 430, 780, .045, 0],
    build: [.32, 240, 900, .06, .1], shot: [.055, 680, 150, .025, .35],
    wave: [.45, 300, 190, .06, .05], win: [.8, 440, 880, .06, 0],
    lose: [.6, 330, 110, .055, .08]
};
const ascii = text => Uint8Array.from(text, character => character.charCodeAt(0));

function makeSound(name, [duration, from, to, volume, noise]) {
    const rate = 22050, count = Math.ceil(duration * rate);
    const bytes = new Uint8Array(44 + count * 2), view = new DataView(bytes.buffer);
    const write = (at, text) => bytes.set(ascii(text), at);
    write(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); write(8, 'WAVEfmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    write(36, 'data'); view.setUint32(40, count * 2, true);
    let phase = 0, seed = 109;
    for (let i = 0; i < count; i++) {
        const t = i / count;
        const melody = name === 'win' ? [1, 1.25, 1.5, 2][Math.min(3, Math.floor(t * 4))] : null;
        const frequency = melody ? from * melody : from * Math.pow(to / from, t);
        phase += Math.PI * 2 * frequency / rate;
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const envelope = Math.min(1, i / (rate * .005)) * Math.pow(1 - t, 2);
        const tone = Math.sin(phase) * .85 + Math.sin(phase * 2) * .15;
        const sample = (tone * (1 - noise) + (seed / 2147483648 - 1) * noise) * envelope * volume;
        view.setInt16(44 + i * 2, Math.round(sample * 32767), true);
    }
    return bytes;
}

class Feedback {
    constructor(root, { addAsset, setCursor } = {}) {
        this.root = root; this.addAsset = addAsset; this.setCursor = setCursor;
        this.assets = {}; this.registered = new Set(); this.cursorModes = new Map();
        this.voices = []; this.playTimes = []; this.lastPlayed = {}; this.time = 0; this.enabled = true;
        for (const [name, cursor] of Object.entries(CURSORS)) {
            const key = 'pocket-front-cursor-' + name;
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${cursor.drawing}</svg>`;
            this.assets[key] = new Asset({ id: key, type: 'image' }, ascii(svg));
        }
        for (const [name, definition] of Object.entries(SOUNDS)) {
            const key = 'pocket-front-sound-' + name;
            this.assets[key] = new Asset({ id: key, type: 'audio' }, makeSound(name, definition));
        }
    }

    getAssets() { return this.assets; }

    // Call after the first player joins: local mode receives these bytes via
    // addAsset, while a hosted Squisher also discovers them through getAssets.
    register() {
        if (this.destroyed || !this.addAsset) return Promise.resolve(false);
        if (this.registration) return this.registration;
        const missing = Object.keys(this.assets).filter(key => !this.registered.has(key));
        this.registration = Promise.all(missing.map(key => Promise.resolve().then(() => {
            if (this.destroyed) return false;
            return this.addAsset(key, this.assets[key]);
        }).then(result => {
            if (result === false || this.destroyed) return false;
            this.registered.add(key); return true;
        }).catch(() => false))).then(results => {
            this.registration = null;
            return results.every(Boolean);
        });
        return this.registration;
    }

    cursor(playerId, mode) {
        if (this.destroyed || !this.setCursor || (mode !== null && !CURSORS[mode])) return false;
        const id = Number(playerId);
        if (!Number.isInteger(id) || id < 1 || id > 255) return false;
        if (this.cursorModes.has(id) && this.cursorModes.get(id) === mode) return true;
        const cursor = mode === null ? null : {
            assetKey: 'pocket-front-cursor-' + mode,
            hotspot: { ...CURSORS[mode].hotspot }, size: { width: 32, height: 32 }
        };
        if (this.setCursor(id, cursor) === false) return false;
        this.cursorModes.set(id, mode);
        return true;
    }

    leave(playerId) {
        const id = Number(playerId);
        if (this.cursorModes.has(id)) this.setCursor?.(id, null);
        this.cursorModes.delete(id);
    }

    play(name) {
        const definition = SOUNDS[name];
        if (this.destroyed || !this.enabled || !definition) return false;
        this.playTimes = this.playTimes.filter(time => this.time - time < 1);
        const gap = name === 'shot' ? .16 : .08;
        if (this.playTimes.length >= 8 || this.voices.length >= 8
            || this.time - (this.lastPlayed[name] ?? -10) < gap) return false;
        const key = 'pocket-front-sound-' + name;
        const node = new GameNode.Asset({ assetInfo: {
            [key]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 }
        } });
        this.root.addChild(node);
        this.voices.push({ node, until: this.time + definition[0] + .04 });
        this.playTimes.push(this.time); this.lastPlayed[name] = this.time;
        return true;
    }

    update(dt) {
        if (this.destroyed || !Number.isFinite(dt) || dt < 0) return;
        this.time += dt;
        const keep = [];
        for (const voice of this.voices) {
            if (voice.until <= this.time) this.root.removeChild(voice.node.id);
            else keep.push(voice);
        }
        this.voices = keep;
    }

    setEnabled(enabled) {
        this.enabled = !!enabled;
        if (!this.enabled) {
            for (const voice of this.voices) this.root.removeChild(voice.node.id);
            this.voices = []; this.playTimes = []; this.lastPlayed = {};
        }
    }

    destroy() {
        if (this.destroyed) return;
        this.setEnabled(false);
        for (const id of this.cursorModes.keys()) this.leave(id);
        this.destroyed = true;
    }
}

module.exports = Feedback;
