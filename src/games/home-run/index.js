'use strict';

const { Game, GameNode, Asset, ShapeUtils } = require('squish-150');
const { Match, clamp } = require('./engine');
const { themeIds, readSave } = require('./themes');
const { Art, C, HIDDEN, shape, add, group } = require('./art');
const inBox = (x, y, left, top, width, height) => x >= left && x <= left + width && y >= top && y <= top + height;

class HomeRun extends Game {
    static metadata() {
        return {
            name: 'Home Run', author: 'Joseph Garcia',
            gameId: '4ea1a0cc-038d-49a3-9fa8-9ad05de0b8bf',
            description: 'One button. Big little hits. Swing at gentle pitches in sunny, Halloween and Christmas ballparks.',
            thumbnail: './assets/thumbnail.png', aspectRatio: { x: 1, y: 1 }, tickRate: 30, maxPlayers: 1,
            gamepadBindings: { ' ': ['FACE_1'], Escape: ['START'], ArrowLeft: ['DPAD_LEFT'], ArrowRight: ['DPAD_RIGHT'], m: ['FACE_2'] },
            assets: {
                hit: new Asset({ path: './assets/hit.wav', type: 'audio' }),
                homer: new Asset({ path: './assets/homer.wav', type: 'audio' }),
                swing: new Asset({ path: './assets/swing.wav', type: 'audio' }),
            },
        };
    }
    constructor(options = {}) {
        super();
        this.options = options; this.now = options.now || Date.now; this.lastTick = this.now();
        this.records = readSave(options.saveData); this.theme = this.records.theme;
        this.match = new Match(); this.owner = null; this.players = new Map(); this.paused = false;
        this.saveFailed = false; this.saveRevision = 0; this.saveTail = Promise.resolve();
        this.base = shape(ShapeUtils.rectangle(0, 0, 100, 100), C.cream);
        this.world = group(this.base); this.audio = group(this.base); this.soundUntil = 0;
        this.surface = add(this.base, ShapeUtils.rectangle(0, 0, 100, 100), [0, 0, 0, 0], {
            onClick: (id, x, y) => this.press(id, x, y), offClick: id => this.release(id),
        });
        this.rebuild();
    }
    getLayers() { return [{ root: this.base }]; }
    canAddPlayer() { return !this.closed && this.players.size < 1; }
    handleNewPlayer({ playerId }) {
        if (!Number.isSafeInteger(playerId) || playerId < 1 || !this.canAddPlayer()) return;
        this.players.set(playerId, { pointer: false, keys: new Set() }); this.owner = playerId;
        this.lastTick = this.now(); this.draw();
    }
    handlePlayerDisconnect(id) {
        if (!this.players.delete(id)) return;
        this.owner = null; this.toPark();
    }
    betweenRounds() { return ['setup', 'results'].includes(this.match.phase); }
    rebuild() {
        this.world.clearChildren(); this.art = new Art(this.world, this.theme);
        this.art.buildMenu(this); this.art.buildOverlay(this); this.draw();
    }
    choose(id, theme) {
        if (this.closed || id !== this.owner || !this.betweenRounds() || !themeIds.includes(theme) || this.theme === theme) return false;
        this.theme = theme; this.records.theme = theme;
        // Results belong to the old park. A new park begins on a clean scorecard.
        this.match = new Match(); this.persist(); this.rebuild(); return true;
    }
    start(id) {
        if (this.closed || id !== this.owner || !this.players.has(id) || !this.match.start()) return false;
        this.paused = false; this.lastTick = this.now(); this.art.buildMenu(this); this.art.buildOverlay(this); this.draw(); return true;
    }
    pause(id) {
        if (this.closed || id !== this.owner || this.betweenRounds()) return;
        this.paused = !this.paused; this.lastTick = this.now(); this.audio.clearChildren(); this.soundUntil = 0;
        this.art.buildOverlay(this); this.draw();
    }
    toPark() {
        this.match = new Match(); this.paused = false; this.audio.clearChildren(); this.soundUntil = 0;
        this.art.buildMenu(this); this.art.buildOverlay(this); this.draw();
    }
    mute() {
        this.records.sound = !this.records.sound; this.audio.clearChildren(); this.soundUntil = 0;
        this.persist(); this.draw();
    }
    press(id, x, y) {
        const player = this.players.get(id);
        if (this.closed || !player || player.pointer || !Number.isFinite(x) || !Number.isFinite(y)) return;
        player.pointer = true;
        if (inBox(x, y, 0, 0, 24, 10)) return this.mute();
        if (inBox(x, y, 78, 0, 22, 10)) return this.pause(id);
        if (this.paused) {
            if (inBox(x, y, 24, 49, 52, 10)) this.pause(id);
            else if (inBox(x, y, 24, 59, 52, 9)) this.toPark();
            return;
        }
        if (this.betweenRounds()) {
            for (let i = 0; i < themeIds.length; i++) if (inBox(x, y, 3 + i * 32, 83.5, 30, 8)) return this.choose(id, themeIds[i]);
            if (inBox(x, y, 23, 92, 54, 8)) this.start(id);
            else if (this.saveFailed && this.match.phase === 'results' && inBox(x, y, 15, 62, 70, 7)) this.persist();
        } else if (y >= 24) this.swing(id);
    }
    release(id) { const player = this.players.get(id); if (player) player.pointer = false; }
    handleMouseUp(id) { this.release(id); }
    handleKeyDown(id, key) {
        const player = this.players.get(id);
        if (this.closed || !player || player.keys.has(key)) return;
        player.keys.add(key);
        if (key === 'Escape' || key.toLowerCase() === 'p') return this.pause(id);
        if (key.toLowerCase() === 'm') return this.mute();
        if (this.paused) { if (key === ' ' || key === 'Enter') this.pause(id); return; }
        if (key === 'ArrowLeft' || key === 'ArrowRight') {
            const at = themeIds.indexOf(this.theme), direction = key === 'ArrowLeft' ? -1 : 1;
            this.choose(id, themeIds[(at + direction + themeIds.length) % themeIds.length]);
        } else if (key === ' ' || key === 'Enter') {
            if (this.betweenRounds()) this.start(id); else this.swing(id);
        }
    }
    handleKeyUp(id, key) { this.players.get(id)?.keys.delete(key); }
    swing(id) {
        if (this.closed || this.paused || id !== this.owner || !this.players.has(id)) return false;
        const hit = this.match.swing(); this.consumeEvents(); this.draw(); return hit;
    }
    playSound(name) {
        if (!this.records.sound) return;
        this.audio.clearChildren();
        this.audio.addChild(new GameNode.Asset({ coordinates2d: HIDDEN,
            assetInfo: { [name]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 } } }), false);
        this.soundUntil = this.match.time + (name === 'homer' ? 1.1 : .3);
    }
    consumeEvents() {
        for (const event of this.match.events.splice(0)) {
            if (['hit', 'homer', 'swing'].includes(event)) this.playSound(event);
            else if (event === 'finish') {
                this.records.best[this.theme] = Math.max(this.records.best[this.theme], this.match.score);
                this.persist(); this.art.buildMenu(this); this.art.buildOverlay(this);
            }
        }
    }
    persist() {
        const revision = ++this.saveRevision, snapshot = readSave(this.records);
        try {
            this.saveTail = Promise.resolve(this.options.saveGame?.(snapshot)).then(() => {
                if (revision === this.saveRevision) this.saveFailed = false;
            }, () => { if (revision === this.saveRevision) this.saveFailed = true; });
        } catch (_) { this.saveFailed = true; this.saveTail = Promise.resolve(); }
        this.saveTail.then(() => {
            if (!this.closed) { this.art.buildOverlay(this); this.draw(); }
        });
        return this.saveTail;
    }
    tick() {
        if (this.closed) return;
        const now = this.now(), elapsed = (now - this.lastTick) / 1000; this.lastTick = now;
        if (!this.owner || this.paused || this.betweenRounds()) return;
        // A suspended tab waits for the child instead of silently using pitches.
        const dt = elapsed > .5 ? 0 : clamp(elapsed, 0, .25);
        this.match.step(dt); this.consumeEvents();
        if (this.soundUntil && this.match.time >= this.soundUntil) { this.audio.clearChildren(); this.soundUntil = 0; }
        this.draw();
    }
    draw() { if (this.art && !this.closed) { this.art.draw(this); this.base.node.onStateChange(); } }
    close() { this.closed = true; this.players.clear(); this.audio.clearChildren(); super.close(); }
}

module.exports = HomeRun;
