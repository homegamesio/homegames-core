'use strict';

const { Game, GameNode, Shapes } = require('squish-150');
const { FleetWorld, RULES, MAPS } = require('./engine');
const { Painter, draw, inside } = require('./view');

class Fleetfall extends Game {
    static metadata() {
        return {
            thumbnail: './assets/thumbnail.png',
            name: 'Fleetfall',
            author: "Joseph Garcia",
            description: 'Conquer the galaxy and guide your dudes',
            aspectRatio: { x: 16, y: 9 },
            tickRate: 30,
            maxPlayers: 6,
            gameId: "c52c11db-ce0b-487f-988a-51e536dfc0c6"
        };
    }
    constructor({ now = Date.now, saveData, saveGame } = {}) {
        super();
        const mapId = saveData?.schema === 1 && MAPS.some(m => m.id === saveData.mapId) ? saveData.mapId : 'orbit';
        this.cleared = {};
        for (const map of MAPS) {
            const time = saveData?.schema === 1 && Object.hasOwn(saveData.cleared || {}, map.id) ? saveData.cleared[map.id] : null;
            if (typeof time === 'number' && Number.isFinite(time) && time > 0 && time <= 86400) this.cleared[map.id] = time;
        }
        this.world = new FleetWorld(519, mapId); this.players = new Map(); this.hostId = null;
        this.soloRunOwner = null; this.resultRecorded = false;
        this.now = now; this.lastTick = now(); this.accumulator = 0; this.closed = false;
        this.saveGame = saveGame; this.saveKey = null; this.saveRevision = 0; this.saveFailed = false; this.saveTail = Promise.resolve();
        const group = () => new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: [[0, 0]] });
        this.base = group(); this.scenes = group();
        this.pointer = new GameNode.Shape({ shapeType: Shapes.POLYGON,
            coordinates2d: [[0, 0], [100, 0], [100, 100], [0, 100]],
            onClick: (id, x, y) => this.pointerDown(Number(id), x, y) });
        this.pointer.node.offClick = id => this.cancelPointer(Number(id));
        this.base.addChildren(this.scenes, this.pointer);
    }
    getLayers() { return [{ root: this.base }]; }
    canAddPlayer() { return !this.closed && this.players.size < RULES.maxPlayers; }
    handleNewPlayer({ playerId, info } = {}) {
        if (!['number', 'string'].includes(typeof playerId)) return;
        const id = Number(playerId);
        if (!Number.isSafeInteger(id) || id <= 0 || this.players.has(id) || !this.canAddPlayer()) return;
        const ui = { id, name: String(info?.name || `Pilot ${id}`).slice(0, 16), painter: new Painter(id),
            selected: null, percent: .5, focus: null, keys: new Set(), pointerDown: false,
            hits: [], notice: '', noticeUntil: 0, suppressRelease: false };
        this.players.set(id, ui); this.scenes.addChild(ui.painter.root, false);
        if (this.hostId === null) { this.hostId = id; this.lastTick = this.now(); }
        this.render();
    }
    handlePlayerDisconnect(playerId) {
        const ui = this.player(playerId); if (!ui) return;
        const id = ui.id;
        this.world.disconnect(id); this.scenes.removeChild(ui.painter.root.id, false); this.players.delete(id);
        if (this.hostId === id) this.hostId = this.players.keys().next().value ?? null;
        // An empty room is a fresh lobby, with no orphaned simulation ticking.
        if (!this.players.size) this.world = new FleetWorld(519, this.world.mapId);
        this.render();
    }
    start(id) {
        if (this.closed || id !== this.hostId || this.world.phase !== 'lobby') return;
        this.world.start([...this.players.values()].map(p => ({ id: p.id, name: p.name })));
        this.soloRunOwner = this.players.size === 1 ? id : null; this.resultRecorded = false;
        this.lastTick = this.now(); this.accumulator = 0;
        for (const ui of this.players.values()) this.clearControls(ui);
        this.render();
    }
    player(id) { return !this.closed && ['number', 'string'].includes(typeof id) ? this.players.get(Number(id)) : null; }
    persist() {
        if (this.closed || typeof this.saveGame !== 'function') return;
        const data = { schema: 1, mapId: this.world.mapId, ...(Object.keys(this.cleared).length ? { cleared: { ...this.cleared } } : {}) }, key = JSON.stringify(data);
        if (key === this.saveKey && !this.saveFailed) return this.saveTail;
        this.saveKey = key; const revision = ++this.saveRevision;
        const finish = success => { if (!this.closed && revision === this.saveRevision) { this.saveFailed = !success; this.render(); } };
        try { this.saveTail = Promise.resolve(this.saveGame(data)).then(() => finish(true), () => finish(false)); }
        catch (_) { finish(false); this.saveTail = Promise.resolve(); }
        return this.saveTail;
    }
    clearControls(ui) { this.cancelPointer(ui.id, true); ui.selected = null; ui.focus = null; ui.keys.clear(); ui.notice = ''; ui.noticeUntil = 0; }
    notice(ui, text) { ui.notice = text; ui.noticeUntil = this.world.time + 3; }
    get soloVictory() {
        return this.world.phase === 'gameover' && this.soloRunOwner !== null && this.world.soloPlayerId === this.soloRunOwner &&
            this.world.winner === this.soloRunOwner && this.players.has(this.soloRunOwner) && !this.world.faction(this.soloRunOwner)?.bot;
    }
    recordResult() {
        if (this.world.phase !== 'gameover' || this.resultRecorded) return;
        this.resultRecorded = true;
        if (!this.soloVictory) return;
        const seconds = Math.max(.1, Math.round(this.world.time * 10) / 10), previous = this.cleared[this.world.mapId];
        if (!previous || seconds < previous) { this.cleared[this.world.mapId] = seconds; this.persist(); }
    }
    action(id, action) {
        const ui = this.player(id); if (!ui || !action) return;
        id = ui.id;
        if (action.type === 'retrySave') { if (id === this.hostId) this.persist(); return; }
        if (action.type === 'start') return this.start(id);
        if (action.type === 'sectorSelect' && id === this.hostId && this.world.phase === 'lobby' && Number.isInteger(action.id)) {
            const maps = MAPS.filter(m => m.sector === action.id), next = maps.find(m => !this.cleared[m.id]) || maps[0];
            if (next && this.world.selectMap(next.id)) this.persist();
        }
        if (action.type === 'continue' && id === this.hostId && this.world.phase === 'lobby') {
            const next = MAPS.find(m => !this.cleared[m.id]) || MAPS[0];
            this.world.selectMap(next.id); this.persist(); return this.start(id);
        }
        if (action.type === 'nextMap' && id === this.hostId && this.players.size === 1 && this.soloVictory) {
            const next = MAPS[MAPS.findIndex(m => m.id === this.world.mapId) + 1];
            if (next) { this.world = new FleetWorld(519, next.id); this.persist(); return this.start(id); }
        }
        if (action.type === 'mapSelect' && id === this.hostId && this.world.selectMap(action.id)) this.persist();
        if (action.type === 'lobby' && this.world.phase === 'gameover' && id === this.hostId) {
            this.world = new FleetWorld(519, this.world.mapId);
            for (const p of this.players.values()) this.clearControls(p);
        }
        if (this.world.phase !== 'running') { this.render(); return; }
        if (action.type === 'percent' && [.25, .5, 1].includes(action.value)) ui.percent = action.value;
        if (action.type === 'move' || action.type === 'fire') {
            const flight = this.world.active(id).find(f => f.id === action.id);
            if (!flight) return;
            if (ui.focus !== flight.id) ui.keys.clear();
            ui.focus = flight.id;
            if (action.type === 'move') this.world.move(ui.id, flight.id, action.lane);
            if (action.type === 'fire') this.world.fire(ui.id, flight.id, action.targetId);
        }
        this.render();
    }
    tapMap(ui, x, y) {
        if (this.closed || this.world.phase !== 'running' || !this.world.faction(ui.id) || !this.world.alive(ui.id)) return;
        let index = -1, best = 3.8;
        ui.planetPoints.forEach((p, i) => { const d = Math.hypot(x - p.x, y - p.y); if (d < best) { best = d; index = i; } });
        if (index < 0) { ui.selected = null; return; }
        const planet = this.world.planets[index], source = this.world.planets[ui.selected];
        if (!source || source.owner !== ui.id) {
            if (planet.owner === ui.id) ui.selected = planet.id;
            else this.notice(ui, 'Select your planet.');
        } else if (planet.id === ui.selected) ui.selected = null;
        else {
            const result = this.world.launch(ui.id, ui.selected, planet.id, ui.percent);
            if (result.error) this.notice(ui, result.error);
            else {
                ui.selected = null; ui.focus = result.flight.id; ui.keys.clear();
                ui.noticeUntil = 0;
            }
        }
    }
    tap(id, x, y) {
        const ui = this.player(id);
        if (!ui || ![x, y].every(Number.isFinite) || x < 0 || x > 100 || y < 0 || y > 100) return;
        const vx = x * 1.6, vy = y * .9;
        const hit = ui.hits.slice().reverse().find(h => inside(h, vx, vy));
        if (!hit) return;
        if (hit.action.type === 'map') { this.tapMap(ui, vx, vy); this.render(); }
        else this.action(id, hit.action.type === 'move'
            ? { ...hit.action, lane: (vx - hit.field.x) / hit.field.w } : hit.action);
    }
    pointerDown(id, x, y) {
        const ui = this.player(id); if (!ui || ui.pointerDown || ![x, y].every(Number.isFinite) || x < 0 || x >= 100 || y < 0 || y >= 100) return;
        ui.pointerDown = true; ui.suppressRelease = false; this.tap(ui.id, x, y);
        ui.pointerDown = true;
    }
    cancelPointer(id, keepHeld = false) {
        const ui = this.player(id); if (!ui) return;
        if (ui.pointerDown) ui.suppressRelease = true;
        if (!keepHeld) ui.pointerDown = false;
    }
    releasePointer(id) { const ui = this.player(id); if (ui) ui.pointerDown = false; }
    handleMouseUp(id, position) {
        const ui = this.player(id); if (!ui) return;
        if (!ui.pointerDown && !ui.suppressRelease && position) this.tap(ui.id, position.x, position.y);
        ui.suppressRelease = false; this.releasePointer(ui.id);
    }
    handleKeyDown(id, key) {
        const ui = this.player(id); if (!ui || typeof key !== 'string') return;
        const k = key.toLowerCase();
        if (!['enter', ' ', 'escape', 'arrowleft', 'arrowright', 'a', 'd', '1', '2', '3', '4', '5', '6'].includes(k)) return;
        if (ui.keys.has(k)) return;
        ui.keys.add(k); this.cancelPointer(ui.id, true);
        if (k === 'enter') {
            if (this.world.phase === 'gameover') this.action(ui.id, { type: 'lobby' });
            else this.start(ui.id);
        }
        else if (k === ' ' && ui.focus !== null) this.world.fire(ui.id, ui.focus);
        else if (k === 'escape') ui.selected = null;
        else if (/^[1-6]$/.test(k)) {
            const f = this.world.active(ui.id)[Number(k) - 1];
            if (f) { ui.focus = f.id; ui.keys.clear(); }
        }
        this.render();
    }
    handleKeyUp(id, key) { if (typeof key === 'string') this.player(id)?.keys.delete(key.toLowerCase()); }
    tick() {
        if (this.closed || this.world.phase !== 'running' || !this.players.size) return;
        const now = this.now(), elapsed = (now - this.lastTick) / 1000; this.lastTick = now;
        if (!Number.isFinite(elapsed) || elapsed <= 0) return;
        this.accumulator += Math.min(.1, elapsed);
        const steering = new Map(), firing = new Set();
        for (const ui of this.players.values()) {
            const flights = this.world.active(ui.id);
            if (!flights.some(f => f.id === ui.focus)) { ui.focus = flights[0]?.id ?? null; ui.keys.clear(); }
            const left = ui.keys.has('arrowleft') || ui.keys.has('a'), right = ui.keys.has('arrowright') || ui.keys.has('d');
            if (ui.focus !== null) steering.set(ui.focus, Number(right) - Number(left));
            if (ui.focus !== null && ui.keys.has(' ')) firing.add(ui.focus);
            if (ui.selected !== null && this.world.planets[ui.selected]?.owner !== ui.id) ui.selected = null;
        }
        const step = 1 / RULES.hz; let changed = false;
        while (this.accumulator + 1e-9 >= step) {
            this.accumulator = Math.max(0, this.accumulator - step);
            this.world.tick(step, steering, firing); changed = true;
        }
        this.recordResult();
        if (changed) this.render();
    }
    render() {
        if (this.closed) return;
        for (const ui of this.players.values()) draw(this, ui);
        this.base.node.onStateChange();
    }
    close() {
        if (this.closed) return;
        this.persist(); this.closed = true; this.players.clear(); this.hostId = null;
        this.scenes.clearChildren(); super.close();
    }
}

module.exports = Fleetfall;
