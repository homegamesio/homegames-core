const { Game, GameNode, Shapes, ShapeUtils } = require('squish-150');
const { Engine } = require('./engine');
const { Painter } = require('./painter');
const { renderWorld, screenToWorld } = require('./scene');
const { WorldAudio } = require('./audio');
const { ROLES } = require('./settings');
const { renderUI, renderPersonal } = require('./ui');

const HIDDEN = [[0, 0], [0, 0], [0, 0]];
const neutral = () => ({ x: 0, y: 0, fire: false, harvest: false, boost: false });
const clamp = (v, a, b) => Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : 0;

class WorldEater extends Game {
    static metadata() {
        return {
            isTest: true,
            thumbnail: './assets/thumbnail.png',
            name: 'World Eater',
            author: "Joseph Garcia",
            createdBy: "Joseph Garcia",
            description: 'Become the thing the stars are afraid of. Join a crew of up to six pilots: devour or rescue procedural worlds, grow orbital weapons, fight five celestial guardians, and carry the last of your kind beyond the final sun. A complete persistent cooperative campaign with touch, keyboard, gamepad, and original synthesized music.',
            aspectRatio: { x: 16, y: 9 },
            tickRate: 30,
            maxPlayers: 6,
            gameId: "07df00a9-f2b9-5b01-a950-5cf1cdf08aa9"
        };
    }

    constructor({ saveGame, saveData, addAsset } = {}) {
        super();
        const saved = saveData && saveData.schema === 1 ? saveData : {};
        this.engine = new Engine(Math.floor(Math.random() * 0xffffffff), saved.campaign);
        this.saveGame = saveGame;
        this.sound = saved.preferences?.sound !== false;
        this.reduced = saved.preferences?.reduced === true;
        this.people = new Map(); this.clock = 0; this.savedAt = 0; this.map = false; this.guide = false;
        this.menuSelection = this.engine.hasCheckpoint ? 'resume' : 'start'; this.buttons = [];
        this.base = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: HIDDEN });
        this.visual = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: HIDDEN });
        this.audioRoot = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: HIDDEN });
        this.personal = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: HIDDEN });
        this.inputLayer = new GameNode.Shape({ shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 99.99, 99.99),
            color: [0, 0, 0, 0], fill: [0, 0, 0, 0],
            onClick: (id, x, y) => this.pointer(id, x, y),
            onDrag: (id, x, y) => this.pointerMove(id, x, y),
            offClick: id => this.release(id),
        });
        this.base.addChildren(this.visual, this.audioRoot, this.personal, this.inputLayer);
        this.painter = new Painter(this.visual, { shapes: 1000, texts: 180 });
        this.audio = new WorldAudio(this.audioRoot);
        this.addAsset = addAsset;
        this.draw();
    }

    getLayers() { return [{ root: this.base }]; }
    getAssets() { return this.audio.assets; }

    handleNewPlayer({ playerId, info }) {
        const id = Number(playerId);
        if (this.people.has(id)) return;
        const name = String(info?.name || `Pilot ${id}`).slice(0, 24);
        if (!this.engine.addPlayer(id, name)) return;
        const root = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: HIDDEN, playerIds: [id] });
        this.personal.addChild(root);
        this.people.set(id, { id, name, root, painter: new Painter(root, { shapes: 8, texts: 8 }), keys: new Set(), keyEdges: new Set(),
            pad: neutral(), padAt: -100, padIndex: null, axis: 0, pointer: false, pointerMode: null, target: null,
            pressSeen: false, lastAction: -1, notice: '', noticeUntil: 0 });
        this.audio.register(this.addAsset);
        if (this.autoPaused) { this.autoPaused = false; this.engine.paused = false; }
        this.draw();
    }

    handlePlayerDisconnect(playerId) {
        const id = Number(playerId), person = this.people.get(id);
        if (!person) return;
        this.personal.removeChild(person.root.id); this.people.delete(id); this.engine.removePlayer(id);
        if (!this.people.size && this.engine.phase === 'play') { this.engine.paused = true; this.autoPaused = true; }
        this.persist(); this.draw();
    }

    clearInput() {
        for (const person of this.people.values()) {
            person.keys.clear(); person.pad = neutral(); person.pointer = false; person.target = null;
            person.pointerMode = null; this.engine.setInput(person.id, neutral());
        }
    }

    notice(id, text) {
        const p = this.people.get(Number(id));
        if (p) { p.notice = text; p.noticeUntil = this.clock + 4; }
    }

    action(id, action) {
        const person = this.people.get(Number(id)); if (!person) return;
        if (this.clock - person.lastAction < .12) return;
        person.lastAction = this.clock;
        const e = this.engine;
        if (action === 'start') {
            e.start(); this.map = false; this.guide = false; this.clearInput(); this.menuSelection = null; this.persist();
        } else if (action === 'resume') {
            if (e.resume()) { this.guide = false; this.map = false; this.clearInput(); this.menuSelection = null; }
        } else if (action === 'title') {
            this.persist(); e.phase = 'title'; e.paused = false; this.guide = false; this.map = false; this.clearInput();
            this.menuSelection = e.hasCheckpoint ? 'resume' : 'start';
        } else if (action === 'sound') { this.sound = !this.sound; this.persist(); }
        else if (action === 'effects') { this.reduced = !this.reduced; this.persist(); }
        else if (action === 'help') { this.guide = !this.guide; this.clearInput(); }
        else if (action === 'pause' && e.phase === 'play') {
            e.paused = !e.paused; this.guide = false; this.clearInput(); this.persist(); this.menuSelection = 'pause';
        } else if (action === 'map' && e.phase === 'play' && !e.paused && !this.guide) {
            this.map = !this.map; this.clearInput();
        } else if (action === 'role' && e.phase === 'play' && !e.paused && !this.guide) {
            const pilot = e.players.get(person.id), index = ROLES.findIndex(r => r.id === pilot.role);
            const next = ROLES[(index + 1) % ROLES.length]; e.setRole(person.id, next.id); this.notice(id, next.description);
        } else if (action === 'nova' && e.phase === 'play' && !e.paused && !this.guide) {
            if (!e.nova(person.id)) this.notice(id, 'Nova needs a full heart. Harvest worlds to charge it.');
        } else if (action === 'rescue' && e.phase === 'play' && !e.paused && !this.guide) {
            if (!e.rescue(person.id)) this.notice(id, 'Fly close to a living green world to rescue its people.');
        } else if (action === 'forge' && e.phase === 'play' && !e.paused && !this.guide) {
            if (e.enterForge()) { this.map = false; this.clearInput(); this.menuSelection = 'jump'; this.persist(); }
        } else if (action.startsWith('buy:') && e.phase === 'forge') {
            if (e.buyUpgrade(action.slice(4))) this.persist();
        } else if (action === 'jump' && e.phase === 'forge') {
            if (e.nextSector()) { this.clearInput(); this.menuSelection = null; this.persist(); }
        }
        this.draw();
    }

    moveMenu(direction) {
        const available = this.buttons.map(b => b.action);
        if (!available.length) return;
        const index = available.indexOf(this.menuSelection);
        this.menuSelection = available[(index + direction + available.length) % available.length]; this.draw();
    }

    confirm(id) {
        const e = this.engine;
        if (this.guide) this.action(id, 'help');
        else if (e.paused) this.action(id, this.menuSelection || 'pause');
        else if (e.phase === 'title') this.action(id, this.menuSelection || (e.hasCheckpoint ? 'resume' : 'start'));
        else if (e.phase === 'forge') this.action(id, this.menuSelection || 'jump');
        else if (e.phase === 'won' || e.phase === 'lost') this.action(id, this.menuSelection === 'title' ? 'title' : 'start');
    }

    isMenu() { return this.guide || this.engine.paused || this.engine.phase !== 'play'; }

    handleKeyDown(playerId, key) {
        const id = Number(playerId), p = this.people.get(id);
        if (!p || typeof key !== 'string') return;
        key = key.toLowerCase(); const held = p.keyEdges.has(key); p.keys.add(key); p.keyEdges.add(key);
        if (held) return;
        if (key === 'enter') this.confirm(id);
        else if (key === 'h') this.action(id, 'help');
        else if (key === 'p' || key === 'escape') this.action(id, this.guide ? 'help' : 'pause');
        else if (key === 'v') this.action(id, 'effects');
        else if (key === 'n') this.action(id, 'sound');
        else if (this.isMenu() && ['arrowright', 'arrowdown', 'd', 's'].includes(key)) this.moveMenu(1);
        else if (this.isMenu() && ['arrowleft', 'arrowup', 'a', 'w'].includes(key)) this.moveMenu(-1);
        else if (key === 'q') this.action(id, 'nova');
        else if (key === 'r') this.action(id, 'rescue');
        else if (key === 'tab') this.action(id, 'role');
        else if (key === 'm') this.action(id, 'map');
        else if (key === 'f') this.action(id, 'forge');
        else if (key === 'j') this.action(id, 'jump');
    }
    handleKeyUp(id, key) {
        if (typeof key !== 'string') return;
        const p = this.people.get(Number(id));
        p?.keys.delete(key.toLowerCase()); p?.keyEdges.delete(key.toLowerCase());
    }

    handleGamepadInput(playerId, message) {
        const id = Number(playerId), p = this.people.get(id); if (!p) return;
        if (message.connected === false) {
            if (p.padIndex === null || (message.gamepadIndex ?? 0) === p.padIndex) { p.pad = neutral(); p.padIndex = null; }
            return;
        }
        if (p.padIndex !== null && p.padIndex !== message.gamepadIndex && this.clock - p.padAt < .6) return;
        p.padIndex = message.gamepadIndex ?? 0; p.padAt = this.clock;
        const sticks = message.input?.sticks || {}, buttons = message.input?.buttons || {};
        const axis = key => { const n = clamp(sticks[key]?.value, -1, 1); return Math.abs(n) > .16 ? n : 0; };
        const down = key => buttons[key]?.pressed || buttons[key]?.value > .35;
        p.pad = { x: axis('STICK_1_X'), y: axis('STICK_1_Y'), aimX: axis('STICK_2_X'), aimY: axis('STICK_2_Y'),
            fire: !!down('RIGHT_TRIGGER'), harvest: !!down('LEFT_TRIGGER'), boost: !!down('FACE_1') };
        const pressed = message.pressed || [];
        if (this.isMenu()) {
            const direction = Math.sign(p.pad.x || p.pad.y);
            if (direction && direction !== p.axis) this.moveMenu(direction);
            if (pressed.includes('DIRECTION_RIGHT') || pressed.includes('DIRECTION_DOWN')) this.moveMenu(1);
            if (pressed.includes('DIRECTION_LEFT') || pressed.includes('DIRECTION_UP')) this.moveMenu(-1);
            if (pressed.includes('FACE_1')) this.confirm(id);
        } else {
            if (pressed.includes('FACE_3')) this.action(id, 'nova');
            if (pressed.includes('FACE_4')) this.action(id, 'rescue');
            if (pressed.includes('LEFT_SHOULDER')) this.action(id, 'role');
            if (pressed.includes('RIGHT_SHOULDER')) this.action(id, this.engine.gateReady ? 'forge' : 'map');
        }
        p.axis = Math.sign(p.pad.x || p.pad.y);
        if (pressed.includes('START')) this.action(id, 'pause');
        if (pressed.includes('SELECT')) this.action(id, 'help');
    }

    pointer(playerId, x, y) {
        const id = Number(playerId), p = this.people.get(id);
        if (!p || !Number.isFinite(x) || !Number.isFinite(y)) return;
        p.pressSeen = true;
        const sx = x * 1.6, sy = y * .9;
        if (!p.pointer) {
            p.pointer = true;
            const button = this.buttons.slice().reverse().find(b => sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h);
            if (button) { p.pointerMode = 'button'; this.action(id, button.action); p.pointer = true; return; }
            p.pointerMode = !this.isMenu() && sy > 14 && sy < 74 ? 'world' : 'none';
        }
        if (p.pointerMode === 'world') p.target = screenToWorld(this.engine, sx, sy, { map: this.map });
    }
    pointerMove(id, x, y) {
        const p = this.people.get(Number(id));
        if (p?.pointerMode === 'world') this.pointer(id, x, y);
    }
    handleMouseMove(id, point) { if (point) this.pointerMove(id, point.x, point.y); }
    release(id) {
        const p = this.people.get(Number(id));
        if (p) { p.pointer = false; p.pointerMode = null; p.target = null; }
    }
    handleMouseUp(id, point) {
        const p = this.people.get(Number(id)); if (!p) return;
        if (!p.pressSeen && point) this.pointer(id, point.x, point.y);
        p.pressSeen = false; this.release(id);
    }

    tick() {
        if (this.closed) return;
        const dt = 1 / 30; this.clock += dt;
        const e = this.engine, before = e.phase;
        for (const p of this.people.values()) {
            const pilot = e.players.get(p.id); if (!pilot) continue;
            if (this.isMenu()) { e.setInput(p.id, neutral()); continue; }
            if (this.clock - p.padAt > .65) p.pad = neutral();
            const k = p.keys, pad = p.pad;
            let x = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0) + pad.x;
            let y = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0) + pad.y;
            const pointer = p.pointer && p.pointerMode === 'world' && p.target;
            if (pointer && !x && !y) {
                const dx = p.target.x - pilot.x, dy = p.target.y - pilot.y, length = Math.hypot(dx, dy);
                // Stop just inside harvest reach instead of flying through a world.
                const planet = e.planets.find(v => !v.consumed && Math.hypot(v.x - p.target.x, v.y - p.target.y) <= v.radius + 15);
                const stop = planet ? planet.radius + 28 : 8;
                const velocity = clamp((length - stop) / 22, 0, 1);
                if (length > stop) { x = dx / length * velocity; y = dy / length * velocity; }
            }
            e.setInput(p.id, { x, y, fire: !!pointer || k.has(' ') || pad.fire,
                harvest: !!pointer || k.has('e') || pad.harvest, boost: k.has('shift') || pad.boost,
                aimX: pad.aimX, aimY: pad.aimY });
        }
        if (!this.guide && this.people.size) e.step(dt);
        this.audio.update(e.events, dt, this.sound && this.people.size > 0, e.paused || this.guide ? 'pause' : e.phase);
        if (e.phase !== before) { this.clearInput(); this.persist(); }
        if (e.phase === 'play' && this.clock - this.savedAt >= 15) this.persist();
        this.draw();
    }

    draw() {
        const p = this.painter;
        p.begin();
        renderWorld(p, this.engine, { map: this.map, reduced: this.reduced, title: this.engine.phase === 'title', time: this.clock });
        renderUI(this); p.end();
        for (const person of this.people.values()) renderPersonal(this, person);
        this.base.node.onStateChange();
    }

    persist() {
        this.savedAt = this.clock;
        if (typeof this.saveGame !== 'function') return;
        try {
            const campaign = this.engine.phase === 'title' && this.engine.saved ? this.engine.saved : this.engine.checkpoint();
            const result = this.saveGame({ schema: 1, campaign, preferences: { sound: this.sound, reduced: this.reduced } });
            result?.catch?.(() => {});
        } catch (_) { /* A storage failure never interrupts the expedition. */ }
    }
    close() {
        if (this.closed) return;
        this.persist(); this.closed = true; this.clearInput(); this.audio.close?.(); super.close();
    }
}

module.exports = WorldEater;
