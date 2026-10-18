const { Game, GameNode, Shapes } = require('squish-150');
const { Engine, clamp } = require('./engine');
const { C, RULES, WEAPONS } = require('./settings');
const { render } = require('./scene');
const { Sound } = require('./sound');
const { War } = require('./war');
const { renderWar } = require('./war-scene');
const HIDDEN = [[0, 0], [0, 0], [0, 0]];

// A bounded, immediate-mode painter over persistent Homegames nodes.
// Screen changes rebuild a small pool; active frames only mutate that pool.
class Painter {
    constructor(root, phase) {
        this.root = root; this.shapes = []; this.texts = []; this.buttons = [];
        this.offsetX = 0; this.offsetY = 0; this.overflow = 0;
        const shapeCount = phase === 'combat' ? 720 : phase === 'sector' ? 400 : phase === 'title' ? 110 : phase === 'map' ? 170 : 150;
        const textCount = 90;
        for (let i = 0; i < shapeCount; i++) {
            const n = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: HIDDEN, fill: [0, 0, 0, 0] });
            root.addChild(n, false); this.shapes.push(n);
        }
        for (let i = 0; i < textCount; i++) {
            const n = new GameNode.Text({ textInfo: { text: '', x: 0, y: 0, size: 1, color: C.white } });
            root.addChild(n, false); this.texts.push(n);
        }
    }
    begin() { this.si = 0; this.ti = 0; this.buttons = []; this.offsetX = 0; this.offsetY = 0; this.overflow = 0; }
    poly(points, fill, stroke, width = .1, alpha = 1, glow = false) {
        const node = this.shapes[this.si++]; if (!node) { this.overflow++; return; }
        const n = node.node, color = stroke || fill || C.white;
        n.coordinates2d = points.map(([x, y]) => [clamp((x + this.offsetX) / 1.6, 0, 99.99), clamp((y + this.offsetY) / .9, 0, 99.99)]);
        n.fill = fill || undefined;
        n.color = [color[0], color[1], color[2], Math.round(clamp(alpha, 0, 1) * 255)];
        n.border = stroke ? Math.max(1, Math.round(width * 15.9375)) : undefined;
        n.effects = glow ? { shadow: { color: [color[0], color[1], color[2], 255], blur: 12 } } : undefined;
    }
    rect(x, y, w, h, color, alpha = 1) { this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], color, null, 0, alpha); }
    line(x, y, xx, yy, color, width = .1, alpha = 1) {
        // Polygons give subpixel strokes consistent across Squish versions.
        const a = Math.atan2(yy - y, xx - x), dx = Math.sin(a) * width / 2, dy = Math.cos(a) * width / 2;
        this.poly([[x - dx, y + dy], [xx - dx, yy + dy], [xx + dx, yy - dy], [x + dx, y - dy], [x - dx, y + dy]], color, null, 0, alpha);
    }
    path(points, color, width = .1, alpha = 1) { this.poly(points, null, color, width, alpha); }
    arc(x, y, r, angle, span, color, width) {
        this.path(Array.from({ length: 33 }, (_, i) => [x + Math.cos(angle + span * i / 32) * r, y + Math.sin(angle + span * i / 32) * r]), color, width);
    }
    text(text, x, y, size, color = C.white, align = 'left', alpha = 1) {
        const n = this.texts[this.ti++]; if (!n) { this.overflow++; return; }
        n.node.text = { text: String(text), x: clamp((x + this.offsetX) / 1.6, 0, 99.99),
            y: clamp((y + this.offsetY) / .9, 0, 99.99), size: size / 1.6 / Math.SQRT2,
            color: [color[0], color[1], color[2], Math.round(clamp(alpha, 0, 1) * 255)], font: 'sans-serif', align };
    }
    hit(x, y, w, h, action) { this.buttons.push({ x, y, w, h, action }); }
    button(label, x, y, w, h, action, color) {
        const primary = color !== C.line;
        this.rect(x, y, w, h, primary ? color : C.panel);
        if (!primary) this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], null, C.line, .12);
        this.text(label, x + w / 2, y + (h - 1.25) / 2, 1.25, primary ? C.bg : C.white, 'center');
        this.hit(x, y, w, h, action);
    }
    end() {
        for (let i = this.si; i < this.shapes.length; i++) { this.shapes[i].node.coordinates2d = HIDDEN; this.shapes[i].node.effects = undefined; }
        for (let i = this.ti; i < this.texts.length; i++) this.texts[i].node.text = { ...this.texts[i].node.text, text: '' };
    }
}

class VectorSiege extends Game {
    static metadata() {
        return {
            isTest: true,
            thumbnail: './assets/thumbnail.png',
            name: 'Vector Siege',
            author: "Joseph Garcia",
            description: 'A living single-player RTS with optional twin-stick intervention. Build fleets, conquer a generated sector, or dive into persistent battles and change the odds yourself.',
            aspectRatio: { x: 16, y: 9 },
            tickRate: 60,
            maxPlayers: 1,
            assets: {},
            gameId: "e1f5e7f0-408d-57bd-a2d6-cc7ed2eb2b4e"
        };
    }
    constructor(options = {}) {
        super(); this.engine = new Engine(Math.floor(Math.random() * 1000000000));
        const saved = options.saveData || {};
        if (saved.schema === 1) {
            this.engine.best = Number.isFinite(saved.best) ? Math.max(0, saved.best) : 0;
            this.engine.sound = saved.sound !== false; this.engine.reduced = saved.reduced === true;
        }
        this.saveGame = options.saveGame; this.playerId = null; this.keys = {}; this.keyTimes = {};
        this.clock = 0; this.pointerDown = false; this.clickHandled = false; this.lastAction = -1;
        this.base = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: HIDDEN });
        this.visualRoot = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: HIDDEN });
        this.audioRoot = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: HIDDEN });
        this.base.addChildren(this.visualRoot, this.audioRoot);
        this.audio = new Sound(this.audioRoot, options.addAsset);
        this.rebuild(); this.draw();
    }
    getAssets() { return this.audio.assets; }
    getLayers() { return [{ root: this.base }]; }
    rebuild() {
        this.visualRoot.clearChildren();
        const phase = this.war ? this.war.activeBattle ? 'combat' : 'sector' : this.engine.phase;
        this.painter = new Painter(this.visualRoot, phase); this.drawPhase = this.war ? 'war:'+phase : phase;
        const click = new GameNode.Shape({ shapeType: Shapes.POLYGON,
            coordinates2d: [[0, 0], [99.99, 0], [99.99, 99.99], [0, 99.99], [0, 0]],
            fill: [0, 0, 0, 0], color: [0, 0, 0, 0],
            onClick: (id, x, y) => this.pointer(id, { x, y }, true) });
        this.visualRoot.addChild(click, false);
    }
    draw() {
        const phase = this.war ? 'war:'+(this.war.activeBattle ? 'combat' : 'sector') : this.engine.phase;
        if (this.drawPhase !== phase) { this.rebuild(); this.persist(); }
        if (this.war) renderWar(this.painter, this.war); else render(this.painter, this.engine);
        this.base.node.onStateChange();
    }
    handleNewPlayer({ playerId }) {
        if (this.playerId === null) this.playerId = Number(playerId);
        this.audio.register(); this.draw();
    }
    handlePlayerDisconnect(id) {
        if (Number(id) !== this.playerId) return;
        this.playerId = null; this.keys = {}; this.keyTimes = {}; this.pointerDown = false;
        this.engine.input.fire = false; this.engine.input.x = this.engine.input.y = 0;
        if (this.engine.phase === 'combat') this.engine.paused = true;
        if (this.war) this.war.paused = true;
        this.draw();
    }
    handleKeyDown(id, key) {
        if (Number(id) !== this.playerId || typeof key !== 'string') return;
        key = key.toLowerCase(); const was = !!this.keys[key]; this.keys[key] = true; this.keyTimes[key] = this.clock;
        if (was) return;
        if (this.war && key !== 'm' && key !== 'v') { this.warKey(key); this.draw(); return; }
        const e = this.engine;
        if (key === 'm') { e.sound = !e.sound; this.persist(); }
        else if (key === 'v') { e.reduced = !e.reduced; this.persist(); }
        else if (key === 'h') this.action('guide');
        else if (e.guide) { if (key === 'enter' || key === 'escape') this.action('guide'); }
        else if ((key === 'p' || key === 'escape') && e.phase === 'combat') this.action('pause');
        else if (key === 'q' && e.phase === 'combat') e.activateOverload();
        else if (key === 'r' && e.phase === 'map') e.repairHull();
        else if (key === 'b' && e.phase === 'map') e.buyModule();
        else if (key === 'r' && e.phase === 'upgrade') e.reroll();
        else if (key === 'f' && e.phase === 'map') e.enter(e.selected, false, 'raid');
        else if (key === ' ' && e.phase === 'combat' && !e.paused) e.input.dash = true;
        else if (key === 'enter') {
            if (e.phase === 'title') this.action('war');
            else if (e.phase === 'map') this.action('deploy');
            else if (e.phase === 'loadout') e.chooseWeapon('needle');
            else if (e.phase === 'report') e.phase = 'map';
            else if (e.phase === 'won' || e.phase === 'dead') this.action('new');
            else if (e.paused) this.action('pause');
        } else if (key === 'r' && (e.phase === 'won' || e.phase === 'dead')) this.action('retry');
        else if (/^[1-4]$/.test(key)) {
            if (e.phase === 'map') this.action('select'+(Number(key) - 1));
            else if (e.phase === 'upgrade') this.action('mod'+(Number(key) - 1));
            else if ((e.phase === 'loadout' || e.practice) && WEAPONS[Number(key) - 1]) e.chooseWeapon(WEAPONS[Number(key) - 1].id);
        }
        this.draw();
    }
    handleKeyUp(id, key) {
        if (Number(id) === this.playerId && typeof key === 'string') { delete this.keys[key.toLowerCase()]; delete this.keyTimes[key.toLowerCase()]; }
    }
    pointer(id, pos, press) {
        if (Number(id) !== this.playerId || !pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return;
        const x = pos.x * 1.6, y = pos.y * .9, e = this.engine;
        if (press) {
            this.clickHandled = true;
            const button = this.painter.buttons.slice().reverse().find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
            if (button) { this.action(button.action); this.draw(); return; }
        }
        if (this.war) {
            const b = this.war.activeBattle;
            if (b && !this.war.paused && !this.war.help && !this.war.result) {
                this.pointerDown = true; b.input.aimX = x; b.input.aimY = y;
                if (press) { b.input.fire = true; b.updatePlayer(0); }
            }
            return;
        }
        if (e.phase === 'combat' && !e.paused && !e.guide && !e.mission.finishTimer) {
            this.pointerDown = true; this.pointerAt = this.clock; e.input.aimX = x; e.input.aimY = y;
            if (press) { e.input.fire = true; e.updatePlayer(0); }
        }
    }
    handleMouseMove(id, pos) { this.pointer(id, pos, false); }
    handleMouseUp(id, pos) {
        if (Number(id) !== this.playerId) return;
        // Short taps can land entirely between the platform's input frames.
        if (!this.clickHandled && pos) this.pointer(id, pos, true);
        this.pointerDown = false; this.clickHandled = false; this.engine.input.fire = false;
        if (this.war?.activeBattle) this.war.activeBattle.input.fire = false;
    }
    action(action) {
        // UI transitions debounce independently of continuous movement/fire.
        if (this.clock - this.lastAction < .16) return;
        this.lastAction = this.clock;
        if (action === 'war') { this.war = new War(this.engine.seed); this.pointerDown = false; return; }
        if (action.startsWith('w:')) { this.warAction(action.slice(2)); return; }
        const e = this.engine;
        if (action === 'start' || action === 'retry') { e.start(e.seed); e.phase = 'loadout'; }
        else if (action === 'new') { e.start(Math.floor(Math.random() * 1000000000)); e.phase = 'loadout'; }
        else if (action === 'practice') { e.initialize(e.seed); e.enter(0, true); }
        else if (action === 'deploy') e.enter(e.selected);
        else if (action === 'raid') e.enter(e.selected, false, 'raid');
        else if (action === 'repair') e.repairHull();
        else if (action === 'buy') e.buyModule();
        else if (action === 'reroll') e.reroll();
        else if (action === 'map') e.phase = 'map';
        else if (action.startsWith('weapon')) e.chooseWeapon(action.slice(6));
        else if (action === 'guide') {
            if (!e.guide) { this.wasPaused = e.paused; e.paused = true; e.guide = true; }
            else { e.guide = false; e.paused = !!this.wasPaused; }
            this.pointerDown = false;
        }
        else if (action.startsWith('select')) { e.selected = clamp(Number(action.slice(6)), 0, 3); e.emitSound('select'); }
        else if (action.startsWith('mod')) e.choose(Number(action.slice(3)));
        else if (action === 'pause') { e.paused = !e.paused; this.pointerDown = false; e.input.fire = false; }
        else if (action === 'leave') { e.phase = 'title'; e.paused = false; this.pointerDown = false; }
    }
    tick() {
        this.clock += 1 / RULES.hz;
        if (this.playerId === null) return;
        // The stock client repeats held keys every 33ms. Expiring stale keys
        // prevents a lost key-up or tab switch from leaving the ship thrusting.
        for (const key of Object.keys(this.keys)) if (this.clock - this.keyTimes[key] > .4) delete this.keys[key];
        if (this.war) { this.tickWar(); return; }
        const k = this.keys, e = this.engine, input = e.input;
        input.x = (k.d ? 1 : 0) - (k.a ? 1 : 0); input.y = (k.s ? 1 : 0) - (k.w ? 1 : 0);
        const ax = (k.arrowright ? 1 : 0) - (k.arrowleft ? 1 : 0), ay = (k.arrowdown ? 1 : 0) - (k.arrowup ? 1 : 0);
        if (ax || ay) { input.aimX = e.player.x + ax * 25; input.aimY = e.player.y + ay * 25; }
        input.fire = this.pointerDown || !!(ax || ay);
        e.step(RULES.step); e.step(RULES.step);
        this.audio.tick(e.events, 1 / RULES.hz, e.sound && !e.paused);
        // Menus animate at 20Hz; combat uses every 60Hz tick.
        if (e.phase === 'combat' || Math.floor(this.clock * 60) % 3 === 0 || e.phase !== this.drawPhase) this.draw();
    }
    persist() {
        if (typeof this.saveGame !== 'function') return;
        try {
            const p = this.saveGame({ schema: 1, best: this.engine.best, sound: this.engine.sound, reduced: this.engine.reduced });
            if (p && p.catch) p.catch(() => {});
        } catch (_) { /* saving must not interrupt a run */ }
    }
    warKey(key) {
        const w = this.war;
        if (w.choices) { if (/^[1-3]$/.test(key)) w.chooseModule(Number(key) - 1); return; }
        if (w.help) {
            if (['h', 'enter', 'escape'].includes(key)) this.warAction('help');
            return;
        }
        if (w.result) { if (key === 'enter') this.warAction('new'); if (key === 'r') this.warAction('retry'); return; }
        if (key === 'g' || key === 'tab') this.warAction('back');
        else if (key === 'p' || (key === ' ' && !w.activeBattle)) this.warAction('pause');
        else if (key === 'h') this.warAction('help');
        else if (key === 'x' && !w.activeBattle) this.warAction('speed');
        else if (key === 'c' || key === 'escape') { if (w.order || w.panel) this.warAction('cancel'); else if (w.activeBattle) this.warAction('back'); }
        else if (key === 'b') this.warAction('panel:build');
        else if (key === 'e' || key === 'enter') this.warAction('dive');
        else if (key === 'q' && w.activeBattle && !w.paused) w.activeBattle.activateOverload();
        else if (key === ' ' && w.activeBattle && !w.paused) w.activeBattle.input.dash = true;
        else if (/^[1-5]$/.test(key)) this.warAction('buy:'+['seeker', 'bastion', 'warden', 'pulse', 'rail'][Number(key) - 1]);
    }
    warAction(action) {
        const w = this.war; if (!w) return;
        const [name, value] = action.split(':');
        const selectFreeSocket = () => {
            const n = w.nodes[w.selected];
            const free = n.sockets.findIndex((id, i) => !id && !n.queue.some(q => q.socket === i));
            if (free !== -1) w.socket = free;
        };
        if (name === 'leave') { this.war = null; this.engine.phase = 'title'; this.engine.paused = false; this.pointerDown = false; return; }
        if (name === 'new' || name === 'retry') { this.war = new War(name === 'retry' ? w.seed : Math.floor(Math.random() * 1000000000)); this.pointerDown = false; return; }
        if (name === 'help') {
            if (w.help) { w.help = false; w.paused = !!w.pauseBeforeHelp; }
            else { w.pauseBeforeHelp = w.paused; w.help = true; w.paused = true; }
            this.pointerDown = false;
        } else if (name === 'weapon') {
            if (WEAPONS.some(v => v.id === value) && !w.hero.travel && !w.hero.rebuild && w.nodes[w.hero.node].owner === 1) {
                w.pilot.weapon = value; if (w.activeBattle) w.activeBattle.weapon = value;
            }
        } else if (name === 'pause') { w.paused = !w.paused; this.pointerDown = false; }
        else if (name === 'speed') w.speed = w.speed === 4 ? 1 : w.speed * 2;
        else if (name === 'panel') {
            if (value === 'build' && w.nodes[w.selected].owner !== 1) return;
            w.panel = !value || w.panel === value ? null : value; w.order = null;
            if (w.panel === 'build') { w.buildTab = w.activeBattle ? 'defenses' : 'ships'; selectFreeSocket(); }
            this.pointerDown = false;
        } else if (name === 'tab' && ['ships', 'defenses'].includes(value)) {
            w.buildTab = value; if (value === 'defenses') selectFreeSocket();
        } else if (name === 'cancel') { w.order = null; w.panel = null; this.pointerDown = false; }
        else if (name === 'node') {
            const id = Number(value);
            if (!w.nodes[id]) return;
            if (w.order) {
                const order = w.order; let success;
                if (id === order.from) { w.order = null; return; }
                if (order.kind === 'rally') { success = id !== order.from && w.path(order.from, id, 1); if (success) w.nodes[order.from].rally = id; }
                else success = w.sendFleet(order.from, id, 1, order.fraction);
                if (!success) w.notify('No route or ready ships.', order.from);
                else { w.order = null; w.panel = null; }
            } else { w.selected = id; w.panel = null; selectFreeSocket(); }
        } else if (name === 'socket') {
            const socket = Number(value); if (!Number.isInteger(socket) || socket < 0 || socket > 2) return;
            w.socket = socket; w.panel = 'build'; w.buildTab = 'defenses'; this.pointerDown = false;
        } else if (name === 'buy') {
            if (!w.queueUnit(w.selected, value)) w.notify('Cannot build here yet.', w.selected);
            else if (value === 'pulse' || value === 'rail') selectFreeSocket();
        }
        else if (name === 'auto' && w.nodes[w.selected].owner === 1) w.nodes[w.selected].auto = !w.nodes[w.selected].auto;
        else if (name === 'rally') {
            const n = w.nodes[w.selected]; if (n.owner !== 1) return;
            if (n.rally !== null) n.rally = null; else { w.order = { kind: 'rally', from: n.id }; w.panel = null; }
        } else if (name === 'send') {
            if (!w.nodes[w.selected].battle.force(1, true).some(u => u.spawn <= 0)) return;
            w.order = { kind: 'fleet', from: w.selected, fraction: value === 'all' ? 1 : .5 }; w.panel = null;
        } else if (name === 'dive') {
            if (!w.activeBattle && w.travelHero(w.selected)) { w.paused = false; w.panel = null; w.order = null; }
            this.pointerDown = false;
        } else if (name === 'back') { w.leaveBattle(); w.panel = null; w.order = null; this.pointerDown = false; }
        else if (name === 'repair') w.repairPilot();
        else if (name === 'module') w.buyModule();
        else if (name === 'mod') w.chooseModule(Number(value));
    }
    tickWar() {
        const w = this.war, b = w.activeBattle, k = this.keys;
        w.pilot.reduced = this.engine.reduced;
        if (b) {
            b.reduced = this.engine.reduced;
            b.input.x = (k.d ? 1 : 0) - (k.a ? 1 : 0); b.input.y = (k.s ? 1 : 0) - (k.w ? 1 : 0);
            const ax = (k.arrowright ? 1 : 0) - (k.arrowleft ? 1 : 0), ay = (k.arrowdown ? 1 : 0) - (k.arrowup ? 1 : 0);
            if (ax || ay) { b.input.aimX = b.player.x + ax * 25; b.input.aimY = b.player.y + ay * 25; }
            b.input.fire = this.pointerDown || !!(ax || ay);
        }
        const events = [];
        for (let i = 0; i < 2 * (w.activeBattle ? 1 : w.speed); i++) { w.step(RULES.step); events.push(...w.events); }
        this.audio.tick(events, 1 / RULES.hz, this.engine.sound && !w.paused);
        this.draw();
    }
    close() { this.playerId = null; this.keys = {}; super.close(); }
}
module.exports = VectorSiege;
