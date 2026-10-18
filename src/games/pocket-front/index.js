const { Game, GameNode, Shapes } = require('squish-150');
const { Engine } = require('./engine');
const { render } = require('./scene');
const Feedback = require('./feedback');

const HIDDEN = [[0, 0], [0, 0], [0, 0]];
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const coords = points => points.map(([x, y]) => [clamp(x / 1.6, 0, 99.99), clamp(y / .9, 0, 99.99)]);
const rectangle = (x, y, w, h) => coords([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]);

// Reuse nodes, while preserving paint order so overlays cover the whole scene.
class Painter {
    constructor(root) { this.root = root; this.shapes = []; this.texts = []; this.begin(); }
    begin() { this.si = 0; this.ti = 0; this.order = []; this.buttons = []; this.overflow = 0; }
    poly(points, fill, stroke, width = .15) {
        if (this.si >= 950) { this.overflow++; return; }
        let node = this.shapes[this.si];
        if (!node) node = this.shapes[this.si] = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: HIDDEN });
        this.si++;
        Object.assign(node.node, { coordinates2d: coords(points), fill: fill || undefined,
            color: stroke || fill || [0, 0, 0, 0], border: stroke ? Math.max(1, Math.round(width * 10)) : undefined });
        this.order.push(node);
    }
    rect(x, y, w, h, color) { this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], color); }
    line(x, y, xx, yy, color, width = .2) {
        const angle = Math.atan2(yy - y, xx - x), dx = Math.sin(angle) * width / 2, dy = Math.cos(angle) * width / 2;
        this.poly([[x - dx, y + dy], [xx - dx, yy + dy], [xx + dx, yy - dy], [x + dx, y - dy]], color);
    }
    circle(x, y, radius, color, stroke, width) {
        this.poly(Array.from({ length: 17 }, (_, i) => [x + Math.cos(i * Math.PI / 8) * radius, y + Math.sin(i * Math.PI / 8) * radius]), color, stroke, width);
    }
    text(text, x, y, size, color = [255, 255, 255, 255], align = 'left') {
        if (this.ti >= 120) { this.overflow++; return; }
        let node = this.texts[this.ti];
        if (!node) node = this.texts[this.ti] = new GameNode.Text({ textInfo: { text: '', x: 0, y: 0, size: 1 } });
        this.ti++;
        node.node.text = { text: String(text), x: clamp(x / 1.6, 0, 99.99), y: clamp(y / .9, 0, 99.99),
            size: size / 1.6, color, align, font: 'sans-serif' };
        this.order.push(node);
    }
    hit(x, y, w, h, action) { this.buttons.push({ x, y, w, h, action }); }
    button(label, x, y, w, h, action, color = [98, 237, 214, 255]) {
        this.rect(x, y, w, h, color); this.text(label, x + w / 2, y + h / 2 - 1, 2, [22, 45, 61, 255], 'center');
        this.hit(x, y, w, h, action);
    }
    end() { this.root.node.children = this.order; }
}

class PocketFront extends Game {
    static metadata() {
        return {
            thumbnail: './assets/thumbnail.png',
            name: 'Pocket Front',
            author: "Joseph Garcia",
            description: 'Tiny army. Big last stand. Build a colorful pocket battlefield, capture supply points, and survive six waves with a different upgrade combo every run.',
            aspectRatio: { x: 16, y: 9 },
            tickRate: 30,
            maxPlayers: 1,
            assets: {},
            gameId: "735a4238-91d4-57f3-ad24-faeaeb19f9b7"
        };
    }
    constructor(options = {}) {
        super();
        this.engine = new Engine(Math.floor(Math.random() * 1000000000));
        const saved = options.saveData || {};
        this.ui = { mode: null, drag: null, hover: null, paused: false, help: false, sound: saved.sound !== false,
            bestWave: Number.isFinite(saved.bestWave) ? Math.max(0, saved.bestWave) : 0,
            bestKills: Number.isFinite(saved.bestKills) ? Math.max(0, saved.bestKills) : 0 };
        this.saveGame = options.saveGame; this.playerId = null; this.keys = {}; this.hoveredEnemy = null;
        this.base = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: HIDDEN });
        this.visualRoot = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: HIDDEN });
        this.audioRoot = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: HIDDEN });
        this.inputRoot = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: HIDDEN });
        this.base.addChildren(this.visualRoot, this.audioRoot, this.inputRoot);
        this.painter = new Painter(this.visualRoot);
        this.feedback = new Feedback(this.audioRoot, options); this.feedback.setEnabled(this.ui.sound);
        this.surface = this.makeInput(rectangle(0, 0, 160, 90));
        this.inputRoot.addChild(this.surface, false); this.enemyInputs = new Map();
        this.draw();
    }
    getLayers() { return [{ root: this.base }]; }
    getAssets() { return this.feedback.getAssets(); }
    makeInput(points, enemyId = null) {
        return new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: points, fill: [0, 0, 0, 0],
            onClick: (id, x, y) => this.pointerDown(id, x, y, enemyId),
            onDrag: (id, x, y) => this.pointerMove(id, x, y),
            offClick: (id, x, y) => this.pointerUp(id, x, y),
            onHover: id => { if (Number(id) === this.playerId) { this.hoveredEnemy = enemyId; this.updateCursor(); } },
            offHover: id => { if (Number(id) === this.playerId && this.hoveredEnemy === enemyId) { this.hoveredEnemy = null; this.updateCursor(); } }
        });
    }
    handleNewPlayer({ playerId }) {
        if (this.playerId !== null) return;
        this.playerId = Number(playerId); this.feedback.register(); this.updateCursor(); this.draw();
    }
    handlePlayerDisconnect(id) {
        if (Number(id) !== this.playerId) return;
        this.feedback.leave(this.playerId); this.playerId = null; this.keys = {}; this.cancelPointer();
        if (this.engine.phase === 'battle') this.ui.paused = true;
        this.draw();
    }
    active() { return ['prep', 'battle'].includes(this.engine.phase) && !this.ui.paused && !this.ui.help; }
    inWorld(x, y) { return x >= 4 && x <= 119 && y >= 17 && y <= 75; }
    cancelPointer() { this.ui.drag = null; this.ui.hover = null; this.pointer = null; }
    pointerDown(id, rawX, rawY, enemyId = null) {
        if (Number(id) !== this.playerId || !Number.isFinite(rawX) || !Number.isFinite(rawY)) return;
        const x = rawX * 1.6, y = rawY * .9;
        this.cancelPointer();
        const button = this.painter.buttons.slice().reverse().find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
        if (button) { this.action(button.action); return; }
        if (!this.active() || !this.inWorld(x, y)) return;
        this.pointer = { x, y, enemyId }; this.ui.hover = { x, y }; this.draw();
    }
    pointerMove(id, rawX, rawY) {
        if (Number(id) !== this.playerId || !this.pointer || !Number.isFinite(rawX) || !Number.isFinite(rawY)) return;
        const x = clamp(rawX * 1.6, 4, 119), y = clamp(rawY * .9, 17, 75);
        this.ui.hover = { x, y };
        if (!this.ui.mode && Math.hypot(x - this.pointer.x, y - this.pointer.y) > 1.4)
            this.ui.drag = { x1: this.pointer.x, y1: this.pointer.y, x2: x, y2: y };
        this.draw();
    }
    pointerUp(id, rawX, rawY) {
        if (Number(id) !== this.playerId || !this.pointer) return;
        const start = this.pointer, x = rawX * 1.6, y = rawY * .9;
        if (this.active() && Number.isFinite(x) && Number.isFinite(y) && this.inWorld(x, y)) {
            const e = this.engine;
            if (this.ui.mode) {
                if (e.build(this.ui.mode, x, y)) { this.ui.mode = null; this.feedback.play('build'); }
            } else if (Math.hypot(x - start.x, y - start.y) > 1.4) {
                e.selectRect(start.x, start.y, x, y, !!this.keys.shift); this.feedback.play('select');
            } else if (e.units.some(unit => Math.hypot(x - unit.x, y - unit.y) < 3)) {
                e.selectAt(x, y, !!this.keys.shift); this.feedback.play('select');
            } else { e.command(x, y); this.feedback.play('command'); }
        }
        this.cancelPointer(); this.updateCursor(); this.draw();
    }
    handleKeyDown(id, key) {
        if (Number(id) !== this.playerId || typeof key !== 'string') return;
        key = key.toLowerCase(); if (this.keys[key]) return; this.keys[key] = true;
        if (key === 'escape') {
            this.cancelPointer();
            if (this.ui.help) this.ui.help = false;
            else if (this.ui.mode) this.ui.mode = null;
            else if (['prep', 'battle'].includes(this.engine.phase)) this.ui.paused = !this.ui.paused;
        } else if (key === 'm') this.action('mute');
        else if (key === 'h') this.action('help');
        else if (key === 'p') this.action('pause');
        else if (!this.ui.help && key === 'enter' && this.engine.phase === 'title') this.action('start');
        else if (!this.ui.help && this.engine.phase === 'upgrade' && /^[1-3]$/.test(key)) this.action('upgrade:' + (Number(key) - 1));
        else if (this.active()) {
            if (key === 'a') this.action('selectAll');
            else if (key === ' ') this.action('startWave');
            else if (/^[1-3]$/.test(key)) this.action('recruit:' + ['ranger', 'tank', 'medic'][Number(key) - 1]);
            else if (/^[4-6]$/.test(key)) this.action('build:' + ['turret', 'mortar', 'refinery'][Number(key) - 4]);
        }
        this.updateCursor(); this.draw();
    }
    handleKeyUp(id, key) { if (Number(id) === this.playerId && typeof key === 'string') delete this.keys[key.toLowerCase()]; }
    action(action) {
        const e = this.engine, ui = this.ui;
        if (action === 'noop') return;
        if (action === 'mute') { ui.sound = !ui.sound; this.feedback.setEnabled(ui.sound); this.persist(); }
        else if (action === 'help') { ui.help = !ui.help; this.cancelPointer(); }
        else if (action === 'pause' && ['prep', 'battle'].includes(e.phase)) { ui.paused = !ui.paused; this.cancelPointer(); }
        else if (action === 'start' && e.phase === 'title') e.start();
        else if (action === 'restart' && ['won', 'lost'].includes(e.phase)) { e.restart(Math.floor(Math.random() * 1000000000)); ui.paused = false; ui.help = false; ui.mode = null; }
        else if (action === 'endless' && e.phase === 'won') e.continueEndless();
        else if (action.startsWith('upgrade:') && e.phase === 'upgrade') e.chooseUpgrade(Number(action.split(':')[1]));
        else if (this.active()) {
            if (action.startsWith('recruit:')) { if (e.recruit(action.split(':')[1])) this.feedback.play('build'); }
            else if (action.startsWith('build:')) { const type = action.split(':')[1]; ui.mode = ui.mode === type ? null : type; this.cancelPointer(); }
            else if (action === 'selectAll') { e.selectAll(); ui.mode = null; this.feedback.play('select'); }
            else if (action === 'upgradeBase') { if (e.upgradeBase()) this.feedback.play('build'); }
            else if (action === 'repairBase') { if (e.repairBase()) this.feedback.play('build'); }
            else if (action === 'startWave') { if (e.startWave()) { ui.mode = null; this.feedback.play('wave'); } }
        }
        this.updateCursor(); this.draw();
    }
    updateCursor() {
        if (this.playerId === null) return;
        const selected = this.engine.units.some(unit => unit.selected);
        const attack = this.hoveredEnemy !== null && this.engine.enemies.some(enemy => enemy.id === this.hoveredEnemy);
        this.feedback.cursor(this.playerId, !this.active() ? 'select' : this.ui.mode ? 'build' : selected && attack ? 'attack' : selected ? 'command' : 'select');
    }
    persist() {
        this.ui.bestWave = Math.max(this.ui.bestWave, this.engine.stats.waves || 0);
        this.ui.bestKills = Math.max(this.ui.bestKills, this.engine.stats.kills || 0);
        if (this.saveGame) Promise.resolve(this.saveGame({ schema: 1, bestWave: this.ui.bestWave, bestKills: this.ui.bestKills, sound: this.ui.sound })).catch(() => {});
    }
    tick() {
        if (this.playerId === null) return;
        const e = this.engine, before = e.phase;
        if (!this.ui.paused && !this.ui.help) e.update(1 / 30);
        this.feedback.update(1 / 30);
        if (!this.ui.paused && !this.ui.help && e.effects.some(effect => effect.kind === 'shot' && effect.life === effect.maxLife))
            this.feedback.play('shot');
        if (e.phase !== before) {
            this.cancelPointer(); this.ui.mode = null; this.persist();
            if (e.phase === 'lost') this.feedback.play('lose');
            else if (e.phase === 'won' || e.phase === 'upgrade') this.feedback.play('win');
        }
        this.updateCursor(); this.draw();
    }
    draw() {
        this.painter.begin(); render(this.painter, this.engine, this.ui); this.painter.end();
        const live = new Set();
        if (this.active()) for (const enemy of this.engine.enemies) {
            live.add(enemy.id); let node = this.enemyInputs.get(enemy.id);
            if (!node) { node = this.makeInput(HIDDEN, enemy.id); this.enemyInputs.set(enemy.id, node); this.inputRoot.addChild(node, false); }
            node.node.coordinates2d = rectangle(enemy.x - 2, enemy.y - 2.5, 4, 5);
        }
        for (const [id, node] of this.enemyInputs) if (!live.has(id)) {
            // A pressed enemy may die mid-drag. Keep its input identity until
            // release so the dispatcher does not prematurely end selection.
            if (this.pointer?.enemyId === id) { node.node.coordinates2d = HIDDEN; continue; }
            this.inputRoot.removeChild(node.id, false); this.enemyInputs.delete(id);
            if (this.hoveredEnemy === id) this.hoveredEnemy = null;
        }
        this.base.node.onStateChange();
    }
    close() { this.feedback.destroy(); super.close(); }
}

module.exports = PocketFront;
