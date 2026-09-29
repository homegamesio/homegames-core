const { Game, GameNode, Shapes } = require('squish-142');
const { Engine, neutral } = require('./engine');
const { Painter, HIDDEN } = require('./painter');
const { render } = require('./scene');
const { Sound } = require('./sound');

class OrbitBreaker extends Game {
    static metadata() {
        return { name: 'Orbit Breaker', author: 'Joseph Garcia', squishVersion: '142',
            description: 'Their fire. Your ammunition. A controller-first twin-stick counterattack: catch enemy fire in a magnetic orbit, return perfect shots, dash through lasers, and dismantle the Heliophage. Three sectors, ship upgrades, flight school, procedural sound, and full keyboard controls.',
            aspectRatio: { x: 16, y: 9 }, tickRate: 30, maxPlayers: 1, assets: {} };
    }
    constructor(options = {}) {
        super(); this.engine = new Engine(Math.floor(Math.random() * 0xffffffff));
        const saved = options.saveData || {};
        if (saved.schema === 1) {
            this.engine.best = Number.isFinite(saved.best) ? Math.max(0, saved.best) : 0;
            this.engine.sound = saved.sound !== false; this.engine.reduced = saved.reduced === true;
        }
        this.saveGame = options.saveGame; this.playerId = null; this.clock = 0; this.keys = {};
        this.pad = neutral(); this.padIndex = null; this.padTime = -10; this.menuAxis = 0;
        this.base = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: HIDDEN });
        this.visual = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: HIDDEN });
        this.audioRoot = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: HIDDEN });
        this.base.addChildren(this.visual, this.audioRoot);
        this.audio = new Sound(this.audioRoot, options.addAsset); this.draw();
    }
    getLayers() { return [{ root: this.base }]; }
    getAssets() { return this.audio.assets; }
    draw() {
        if (this.drawPhase !== this.engine.phase) {
            this.visual.clearChildren(); this.painter = new Painter(this.visual, this.engine.phase);
            this.visual.addChild(new GameNode.Shape({ shapeType: Shapes.POLYGON,
                coordinates2d: [[0, 0], [99.99, 0], [99.99, 99.99], [0, 99.99], [0, 0]],
                fill: [0, 0, 0, 0], color: [0, 0, 0, 0], onClick: (id, x, y) => this.click(id, x, y) }), false);
            this.drawPhase = this.engine.phase;
            if (this.engine.phase === 'dead' || this.engine.phase === 'won') this.persist();
        }
        render(this.painter, this.engine); this.base.node.onStateChange();
    }
    handleNewPlayer({ playerId }) {
        if (this.playerId === null) this.playerId = Number(playerId);
        this.audio.register(); this.draw();
    }
    clearInput() { this.keys = {}; this.pad = neutral(); this.engine.input = neutral(); this.engine.player.catching = false; }
    handlePlayerDisconnect(id) {
        if (Number(id) !== this.playerId) return;
        this.clearInput(); this.playerId = null; this.padIndex = null;
        if (this.engine.phase === 'play') this.engine.paused = true;
        this.draw();
    }
    persist() {
        if (!this.saveGame) return;
        try {
            const result = this.saveGame({ schema: 1, best: this.engine.best, sound: this.engine.sound, reduced: this.engine.reduced });
            if (result && result.catch) result.catch(() => {});
        } catch (_) { /* A failed save must never interrupt a flight. */ }
    }
    menuMove(direction) {
        const e = this.engine, count = e.paused ? 4 : e.phase === 'upgrade' ? e.choices.length : 2;
        if (e.phase === 'play' && !e.paused) return;
        e.selected = (e.selected + direction + count) % count; e.emit('select');
    }
    confirm() {
        const e = this.engine;
        if (e.paused) this.action(['resume', 'sound', 'effects', 'title'][e.selected]);
        else if (e.phase === 'title') this.action(e.selected === 0 ? 'start' : 'practice');
        else if (e.phase === 'upgrade') this.action('choose:' + e.selected);
        else if (e.phase === 'won' || e.phase === 'dead') this.action(e.selected === 0 ? 'start' : 'title');
        else if (e.practice && e.training === 3) this.action('start');
    }
    action(action) {
        const e = this.engine;
        if (action === 'start' || action === 'practice') { e.start(action === 'practice'); this.clearInput(); }
        else if (action === 'title') { e.phase = 'title'; e.paused = false; e.selected = 0; this.clearInput(); }
        else if (action === 'pause' || action === 'resume') {
            if (e.phase === 'play') { e.paused = action === 'pause' ? !e.paused : false; e.selected = 0; this.clearInput(); }
        } else if (action === 'sound') { e.sound = !e.sound; this.persist(); }
        else if (action === 'effects') { e.reduced = !e.reduced; this.persist(); }
        else if (action.startsWith('choose:')) { e.choose(Number(action.slice(7))); this.clearInput(); }
        this.draw();
    }
    click(id, x, y) {
        if (Number(id) !== this.playerId) return;
        const button = this.painter.buttons.find(b => x * 1.6 >= b.x && x * 1.6 <= b.x + b.w && y * .9 >= b.y && y * .9 <= b.y + b.h);
        if (button) this.action(button.action);
    }
    handleKeyDown(id, key) {
        if (Number(id) !== this.playerId || typeof key !== 'string') return;
        key = key.toLowerCase(); const was = this.keys[key] !== undefined; this.keys[key] = this.clock;
        if (was) return;
        const e = this.engine;
        if (key === 'm') this.action('sound');
        else if (key === 'v') this.action('effects');
        else if (key === 'p') this.action('pause');
        else if (key === 'enter') this.confirm();
        else if (e.phase !== 'play' || e.paused) {
            if (['arrowleft', 'arrowup', 'a', 'w'].includes(key)) this.menuMove(-1);
            if (['arrowright', 'arrowdown', 'd', 's'].includes(key)) this.menuMove(1);
        } else if (key === 'e') e.input.dash = true;
        else if (key === 'q') e.input.nova = true;
        // Actions clear movement, but their own held key must retain its latch.
        this.keys[key] = this.clock;
        this.draw();
    }
    handleKeyUp(id, key) { if (Number(id) === this.playerId && typeof key === 'string') delete this.keys[key.toLowerCase()]; }
    handleGamepadInput(id, message = {}) {
        if (Number(id) !== this.playerId) return;
        const { input = {}, pressed = [], connected = true, gamepadIndex = 0 } = message;
        const sticks = input.sticks || {}, buttons = input.buttons || {};
        const value = (data, name) => Number.isFinite(data[name]?.value) ? Math.max(-1, Math.min(1, data[name].value)) : 0;
        const button = name => !!buttons[name]?.pressed || value(buttons, name) > .22;
        // A neutral second controller must not cancel the pilot's held sticks.
        const engaged = pressed.length || Object.values(sticks).some(v => Math.abs(v.value || 0) > .2) || Object.values(buttons).some(v => v.pressed || v.value > .22);
        if (this.padIndex !== null && gamepadIndex !== this.padIndex) return;
        if (this.padIndex === null && !engaged) return;
        if (!connected) {
            this.padIndex = null; this.pad = neutral(); this.engine.device = '';
            if (this.engine.phase === 'play') { this.engine.paused = true; this.engine.selected = 0; this.clearInput(); }
            this.draw(); return;
        }
        this.padIndex = gamepadIndex; this.padTime = this.clock; this.engine.device = 'CONTROLLER ' + (gamepadIndex + 1) + ' ONLINE';
        this.pad = { x: value(sticks, 'STICK_1_X'), y: value(sticks, 'STICK_1_Y'),
            ax: value(sticks, 'STICK_2_X'), ay: value(sticks, 'STICK_2_Y'),
            catch: button('LEFT_TRIGGER'), fire: button('RIGHT_TRIGGER') };
        const e = this.engine;
        if (pressed.includes('START')) { if (e.phase === 'play') this.action('pause'); else this.confirm(); return; }
        if (e.phase !== 'play' || e.paused || (e.practice && e.training === 3)) {
            const axis = Math.abs(this.pad.x) > .55 ? Math.sign(this.pad.x) : Math.abs(this.pad.y) > .55 ? Math.sign(this.pad.y) : 0;
            if ((axis && !this.menuAxis) || pressed.some(b => ['DIRECTION_LEFT', 'DIRECTION_UP', 'DIRECTION_RIGHT', 'DIRECTION_DOWN'].includes(b))) {
                this.menuMove(axis || (pressed.includes('DIRECTION_LEFT') || pressed.includes('DIRECTION_UP') ? -1 : 1));
            }
            this.menuAxis = axis;
            if (pressed.includes('FACE_1')) this.confirm();
        } else {
            this.menuAxis = 0;
            if (pressed.includes('RIGHT_SHOULDER') || pressed.includes('FACE_1')) e.input.dash = true;
            if (pressed.includes('LEFT_SHOULDER') || pressed.includes('FACE_3')) e.input.nova = true;
        }
    }
    tick() {
        this.clock += 1 / 30;
        for (const key of Object.keys(this.keys)) if (this.clock - this.keys[key] > .8) delete this.keys[key];
        if (this.padIndex !== null && this.clock - this.padTime > .55) {
            this.padIndex = null; this.pad = neutral(); this.engine.device = '';
            if (this.engine.phase === 'play') { this.engine.paused = true; this.engine.selected = 0; this.clearInput(); }
        }
        const down = key => this.keys[key] !== undefined ? 1 : 0, i = this.engine.input;
        i.x = this.pad.x || down('d') - down('a'); i.y = this.pad.y || down('s') - down('w');
        i.ax = this.pad.ax || down('arrowright') - down('arrowleft'); i.ay = this.pad.ay || down('arrowdown') - down('arrowup');
        i.catch = this.pad.catch || !!down('c'); i.fire = this.pad.fire || !!down(' ');
        this.engine.step(); this.audio.tick(this.engine.events, 1 / 30, this.engine.sound && !this.engine.paused); this.draw();
    }
}
module.exports = OrbitBreaker;
