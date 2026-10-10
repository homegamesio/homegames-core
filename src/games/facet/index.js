const { Game, GameNode, Shapes } = require('squish-142');
const { Engine } = require('./engine');
const { Painter, HIDDEN } = require('./painter');
const { render, BOARD } = require('./scene');
const { Sound } = require('./sound');
const { artAssets } = require('./art');
const { LEVELS, REALMS } = require('./content');
const { hydrate, refresh, saveProgress, record, isLevelUnlocked, isRealmUnlocked } = require('./progression');
const terminal = e => ['won', 'lost'].includes(e.phase);
const clamp = n => Math.max(0, Math.min(7, n));

class Facet extends Game {
    static metadata() {
        return { name: 'Facet', author: 'Homegames', squishVersion: '142',
            description: 'Make something brilliant. A luminous match-three adventure through 30 stages and three crystal realms. Combine special gems, build radiant cascades, relax in endless Zen, or chase a record in two-minute Rush. Saved journeys, 90 stars, and treasured keepsakes.',
            aspectRatio: { x: 16, y: 9 }, tickRate: 30, maxPlayers: 1, assets: {} };
    }
    constructor(options = {}) {
        super();
        const saved = options.saveData && typeof options.saveData === 'object' ? options.saveData : {};
        this.engine = new Engine();
        const progress = hydrate(saved);
        this.state = { engine: this.engine, progress, settings: { sound: saved.sound !== false, music: saved.music !== false, reduced: saved.reduced === true },
            screen: 'home', selectedLevel: progress.selectedLevel, selectedRealm: LEVELS[progress.selectedLevel].realmIndex,
            clock: 0, resultAge: 0, displayScore: 0, newAwards: [], cursor: { row: 3, col: 3 }, cursorVisible: false,
            tutorial: false, hasArt: true, focusAction: '', hoverAction: '', hasResume: false, resumeLabel: '' };
        this.accounted = {}; this.savedRun = null; this.resultRecorded = false; this.activeLevel = progress.selectedLevel;
        this.saveGame = options.saveGame; this.addAsset = options.addAsset; this.playerId = null; this.padIndex = null;
        this.clearInput();
        this.base = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: HIDDEN });
        this.visual = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: HIDDEN });
        this.audioRoot = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: HIDDEN });
        this.base.addChildren(this.visual, this.audioRoot);
        this.painter = new Painter(this.visual);
        this.surface = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: [[0, 0], [99.99, 0], [99.99, 99.99], [0, 99.99]],
            fill: [0, 0, 0, 0], color: [0, 0, 0, 0], onClick: (id, x, y) => this.click(id, x, y) });
        this.surface.node.offClick = (id, x, y) => this.release(id, x, y);
        this.base.addChild(this.surface, false);
        this.art = artAssets(); this.audio = new Sound(this.audioRoot, options.addAsset);
        this.acceptSavedRun(saved.run); this.draw();
    }
    getLayers() { return [{ root: this.base }]; }
    getAssets() { return { ...this.art, ...this.audio.assets }; }
    owns(id) { return this.playerId !== null && Number(id) === this.playerId; }
    playing() { return this.state.screen === 'play' && !terminal(this.engine); }
    canSelect() { return this.playing() && this.engine.phase === 'ready' && !this.engine.paused && !this.state.tutorial; }
    refreshProgress() { return refresh(this.state.progress); }
    handleNewPlayer({ playerId }) {
        if (this.playerId === null) this.playerId = Number(playerId);
        this.audio.register();
        if (this.addAsset && !this.artRegistered) {
            this.artRegistered = true;
            for (const [key, asset] of Object.entries(this.art)) {
                try { const pending = this.addAsset(key, asset); if (pending?.catch) pending.catch(() => {}); } catch (_) { /* Keep play available if asset registration fails. */ }
            }
        }
        this.draw();
    }
    clearInput() { this.keyHeld = {}; this.axisLatch = ''; this.pointerHeld = false; this.pointerBlocked = false; this.pointerStart = null; }
    handlePlayerDisconnect(id) {
        if (!this.owns(id)) return;
        this.clearInput(); this.playerId = null; this.padIndex = null;
        if (this.playing()) { this.engine.paused = true; this.state.focusAction = 'resume'; }
        this.persist(); this.draw();
    }
    acceptSavedRun(run) {
        if (!run?.engine || !Number.isInteger(run.levelIndex) || run.levelIndex < 0 || run.levelIndex >= LEVELS.length) return false;
        if (run.engine.mode === 'journey' && (!isLevelUnlocked(this.state.progress, run.levelIndex) || run.engine.level?.id !== LEVELS[run.levelIndex].id)) return false;
        if (!this.engine.restoreState || !this.engine.restoreState(run.engine)) return false;
        if (this.engine.phase !== 'ready') return false;
        this.activeLevel = run.levelIndex; this.savedRun = { levelIndex: run.levelIndex, engine: this.engine.exportState() };
        this.accounted = { ...this.engine.stats }; this.engine.paused = true; this.setResumeLabel(); return true;
    }
    setResumeLabel() {
        const s = this.state; s.hasResume = !!this.savedRun;
        s.resumeLabel = !this.savedRun ? '' : this.savedRun.engine.mode === 'journey'
            ? 'Stage ' + (this.savedRun.levelIndex + 1) + ' · ' + LEVELS[this.savedRun.levelIndex].name
            : this.savedRun.engine.mode === 'zen' ? 'Your Zen garden' : 'Your Rush run';
    }
    snapshot() {
        if (this.engine.phase !== 'ready' || !this.engine.exportState) return;
        const snapshot = this.engine.exportState();
        if (snapshot) this.savedRun = { levelIndex: this.activeLevel, engine: snapshot };
        this.setResumeLabel();
    }
    persist() {
        this.state.progress.selectedLevel = this.state.selectedLevel;
        if (!this.saveGame) return;
        try {
            const pending = this.saveGame({ schema: 1, ...saveProgress(this.state.progress), ...this.state.settings, run: this.savedRun });
            if (pending?.catch) pending.catch(() => {});
        } catch (_) { /* Saving cannot interrupt a cascade. */ }
    }
    start(mode = 'journey', replay = false) {
        const s = this.state;
        if (mode === 'journey' && (!isLevelUnlocked(s.progress, s.selectedLevel) || LEVELS[s.selectedLevel].realmIndex !== s.selectedRealm)) return;
        this.clearInput(); this.accounted = {}; this.resultRecorded = false; this.activeLevel = s.selectedLevel;
        const level = mode === 'journey' ? LEVELS[this.activeLevel] : { ...LEVELS[this.activeLevel], goals: [], frost: [],
            seed: replay ? this.engine.level.seed : (Date.now() ^ Math.imul((this.runNumber = (this.runNumber || 0) + 1), 2654435761)) >>> 0 };
        this.engine.start({ mode, level }); this.engine.paused = false; this.engine.reduced = s.settings.reduced;
        Object.assign(s, { screen: 'play', focusAction: '', hoverAction: '', newAwards: [], resultAge: 0, displayScore: 0,
            cursor: { row: 3, col: 3 }, cursorVisible: false, tutorial: !replay && !s.progress.tutorialSeen, tutorialWasPaused: false });
        if (s.tutorial) this.engine.paused = true;
        this.snapshot(); this.persist();
    }
    action(action) {
        if (typeof action !== 'string') return;
        const s = this.state, e = this.engine;
        if (action === 'start') this.start();
        else if (action === 'zen' || action === 'rush') this.start(action);
        else if (action === 'continue' && this.savedRun) {
            if (!this.acceptSavedRun(this.savedRun)) { this.savedRun = null; this.setResumeLabel(); }
            else {
                s.selectedLevel = this.activeLevel; s.selectedRealm = LEVELS[this.activeLevel].realmIndex;
                s.screen = 'play'; e.paused = false; s.tutorial = false; s.focusAction = ''; s.displayScore = e.score;
                this.resultRecorded = false; this.clearInput();
            }
        } else if (action === 'retry' && s.screen === 'play') {
            s.selectedLevel = this.activeLevel; s.selectedRealm = LEVELS[this.activeLevel].realmIndex; this.start(e.mode, true);
        } else if (action === 'next' && s.screen === 'play' && e.phase === 'won') {
            if (e.mode === 'journey' && this.activeLevel < LEVELS.length - 1) {
                s.selectedLevel = this.activeLevel + 1; s.selectedRealm = LEVELS[s.selectedLevel].realmIndex;
                if (LEVELS[this.activeLevel].finale) { s.screen = 'journey'; s.focusAction = 'start'; }
                else this.start('journey', true);
            } else { s.screen = e.mode === 'journey' ? 'collection' : 'home'; s.focusAction = ''; }
        } else if (action === 'home' || action.startsWith('screen:')) {
            const screen = action === 'home' ? 'home' : action.slice(7);
            if (!['home', 'journey', 'collection'].includes(screen)) return;
            if (this.playing()) { this.snapshot(); e.paused = true; }
            s.screen = screen; s.tutorial = false; s.focusAction = ''; s.hoverAction = '';
            this.clearInput(); refresh(s.progress); this.persist();
        } else if (action.startsWith('realm:') && s.screen !== 'play') {
            const realm = Number(action.slice(6));
            if (!Number.isInteger(realm) || realm < 0 || realm >= REALMS.length) return;
            s.selectedRealm = realm; s.focusAction = '';
            if (isRealmUnlocked(s.progress, realm)) {
                const pending = LEVELS.find(l => l.realmIndex === realm && !s.progress.medals[l.index] && isLevelUnlocked(s.progress, l.index));
                s.selectedLevel = pending ? pending.index : realm * 10;
            }
            this.persist();
        } else if (action.startsWith('level:') && s.screen !== 'play') {
            const index = Number(action.slice(6)); if (!isLevelUnlocked(s.progress, index)) return;
            s.selectedLevel = index; s.selectedRealm = LEVELS[index].realmIndex; s.focusAction = 'start'; this.persist();
        } else if (action === 'pause' && this.playing() && !s.tutorial) {
            e.paused = !e.paused; s.focusAction = e.paused ? 'resume' : ''; this.clearInput(); this.snapshot(); this.persist();
        } else if (action === 'resume' && this.playing()) { e.paused = false; s.focusAction = ''; this.clearInput(); }
        else if (action === 'hint' && this.canSelect()) { e.hint(); s.cursorVisible = false; }
        else if (action === 'sound' || action === 'music') { s.settings[action] = !s.settings[action]; this.persist(); }
        else if (action === 'effects') { s.settings.reduced = !s.settings.reduced; e.reduced = s.settings.reduced; this.persist(); }
        else if (action === 'tutorial') { s.tutorialWasPaused = e.paused; s.tutorial = true; if (this.playing()) e.paused = true; s.focusAction = 'dismissTutorial'; }
        else if (action === 'dismissTutorial') {
            s.tutorial = false; s.progress.tutorialSeen = true; if (this.playing()) e.paused = !!s.tutorialWasPaused;
            s.focusAction = e.paused ? 'resume' : ''; this.clearInput(); this.persist();
        } else return;
        e.events.push({ type: 'ui' }); this.draw();
    }
    draw() { render(this.painter, this.state); this.base.node.onStateChange(); }
    cellAt(x, y) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        const col = Math.floor((x - BOARD.x) / BOARD.cell), row = Math.floor((y - BOARD.y) / BOARD.cell);
        return col >= 0 && col < 8 && row >= 0 && row < 8 ? { row, col } : null;
    }
    click(id, x, y) {
        if (!this.owns(id) || this.pointerHeld || !Number.isFinite(x) || !Number.isFinite(y)) return;
        this.pointerHeld = true; this.pointerStart = null; this.pointerBlocked = false; x *= 1.6; y *= .9;
        const button = [...this.painter.buttons].reverse().find(b => b.enabled !== false && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
        if (button) { this.action(button.action); this.pointerHeld = true; this.pointerBlocked = true; return; }
        if (this.canSelect()) { this.pointerStart = this.cellAt(x, y); this.state.cursorVisible = false; }
    }
    release(id, x, y) {
        if (!this.owns(id)) return;
        const from = this.pointerStart, blocked = this.pointerBlocked;
        this.pointerHeld = false; this.pointerStart = null; this.pointerBlocked = false;
        if (blocked || !from || !this.canSelect()) return;
        const to = this.cellAt(x * 1.6, y * .9); if (!to) return;
        this.state.cursor = to;
        if (to.row === from.row && to.col === from.col) this.engine.select(to.row, to.col);
        else {
            const dr = to.row - from.row, dc = to.col - from.col;
            const next = Math.abs(dc) > Math.abs(dr) ? { row: from.row, col: from.col + Math.sign(dc) } : { row: from.row + Math.sign(dr), col: from.col };
            this.engine.trySwap(from.row, from.col, next.row, next.col);
        }
        this.draw();
    }
    handleMouseMove(id, data = {}) {
        if (!this.owns(id)) return;
        const x = Number(data.x) * 1.6, y = Number(data.y) * .9;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        const b = [...this.painter.buttons].reverse().find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
        this.state.hoverAction = b ? b.action : ''; this.engine.hovered = this.canSelect() ? this.cellAt(x, y) : null;
    }
    menuMove(direction) {
        const buttons = this.painter.buttons.filter(b => b.enabled !== false); if (!buttons.length) return;
        let i = buttons.findIndex(b => b.action === this.state.focusAction);
        if (i < 0) i = direction > 0 ? -1 : 0;
        this.state.focusAction = buttons[(i + direction + buttons.length) % buttons.length].action; this.draw();
    }
    navigate(dr, dc) {
        if (this.canSelect()) {
            const cursor = this.state.cursor; this.state.cursor = { row: clamp(cursor.row + dr), col: clamp(cursor.col + dc) };
            this.state.cursorVisible = true; this.draw();
        } else if (!this.playing() || this.engine.paused || this.state.tutorial) this.menuMove(dr + dc > 0 ? 1 : -1);
    }
    confirm() {
        const s = this.state, e = this.engine;
        if (s.tutorial) this.action(s.focusAction || 'dismissTutorial');
        else if (s.screen !== 'play') this.action(s.focusAction || (s.screen === 'home' ? s.hasResume ? 'continue' : 'screen:journey' : s.screen === 'journey' ? 'start' : 'screen:journey'));
        else if (e.paused) this.action(s.focusAction || 'resume');
        else if (terminal(e)) this.action(s.focusAction || (e.phase === 'lost' || e.mode !== 'journey' ? 'retry' : 'next'));
        else if (this.canSelect()) { s.cursorVisible = true; e.select(s.cursor.row, s.cursor.col); this.draw(); }
    }
    back() {
        if (this.state.tutorial) this.action('dismissTutorial');
        else if (this.state.screen === 'play') {
            if (terminal(this.engine)) this.action('screen:journey');
            else if (this.engine.selected && !this.engine.paused) { this.engine.selected = null; this.draw(); }
            else this.action(this.engine.paused ? 'resume' : 'pause');
        } else this.action('home');
    }
    handleKeyDown(id, key) {
        if (!this.owns(id) || typeof key !== 'string') return; key = key.toLowerCase();
        if (this.keyHeld[key]) return;
        this.keyHeld[key] = true;
        if (['arrowleft', 'a'].includes(key)) this.navigate(0, -1);
        else if (['arrowright', 'd'].includes(key)) this.navigate(0, 1);
        else if (['arrowup', 'w'].includes(key)) this.navigate(-1, 0);
        else if (['arrowdown', 's'].includes(key)) this.navigate(1, 0);
        else if (key === ' ' || key === 'enter') this.confirm();
        else if (key === 'escape') this.back();
        else if (key === 'p') this.action('pause');
        else if (key === 'h') this.action('hint');
        else if (key === 'm') this.action('sound');
        else if (key === 'n') this.action('music');
        else if (key === 'v') this.action('effects');
        else if (key === '?' || key === '/') this.action('tutorial');
        else if (['q', 'e'].includes(key) && this.state.screen !== 'play') this.action('realm:' + (this.state.selectedRealm + (key === 'q' ? 2 : 1)) % 3);
        // Menu transitions clear pointer state; the physical key remains held.
        this.keyHeld[key] = true;
    }
    handleKeyUp(id, key) { if (this.owns(id) && typeof key === 'string') delete this.keyHeld[key.toLowerCase()]; }
    handleGamepadInput(id, message = {}) {
        if (!this.owns(id)) return;
        const { input = {}, pressed = [], connected = true, gamepadIndex = 0 } = message;
        if (this.padIndex !== null && this.padIndex !== gamepadIndex) return;
        const sticks = input.sticks || {}, axisX = sticks.STICK_1_X?.value || 0, axisY = sticks.STICK_1_Y?.value || 0;
        if (!connected) { this.padIndex = null; this.clearInput(); if (this.playing() && !this.engine.paused) this.action('pause'); return; }
        if (!pressed.length && Math.abs(axisX) < .55 && Math.abs(axisY) < .55) { this.axisLatch = ''; return; }
        this.padIndex = gamepadIndex;
        if (pressed.includes('START')) { this.action('pause'); return; }
        if (pressed.includes('FACE_2')) { this.back(); return; }
        if (pressed.includes('FACE_3')) this.action('hint');
        if (pressed.includes('LEFT_SHOULDER') && this.state.screen !== 'play') this.action('realm:' + (this.state.selectedRealm + 2) % 3);
        if (pressed.includes('RIGHT_SHOULDER') && this.state.screen !== 'play') this.action('realm:' + (this.state.selectedRealm + 1) % 3);
        const direction = pressed.includes('DIRECTION_LEFT') ? 'left' : pressed.includes('DIRECTION_RIGHT') ? 'right' : pressed.includes('DIRECTION_UP') ? 'up' : pressed.includes('DIRECTION_DOWN') ? 'down' : Math.abs(axisX) > .55 ? axisX > 0 ? 'right' : 'left' : Math.abs(axisY) > .55 ? axisY > 0 ? 'down' : 'up' : '';
        if (direction && direction !== this.axisLatch) {
            const [dr, dc] = { left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] }[direction]; this.navigate(dr, dc);
        }
        this.axisLatch = direction;
        if (pressed.includes('FACE_1')) this.confirm();
    }
    tick() {
        const s = this.state, e = this.engine, dt = 1 / 30; s.clock += dt; e.reduced = s.settings.reduced;
        if (s.screen === 'play' && !s.tutorial) e.step(dt);
        const settled = e.events.some(v => v.type === 'settled');
        if (s.screen === 'play' && (settled || terminal(e) && !this.resultRecorded)) {
            s.newAwards.push(...record(s.progress, e, this.accounted, this.activeLevel));
            if (terminal(e)) { this.resultRecorded = true; this.savedRun = null; this.setResumeLabel(); s.resultAge = 0; s.focusAction = ''; }
            else this.snapshot();
            this.persist();
        }
        if (s.screen === 'play' && terminal(e) && !e.paused) s.resultAge += dt;
        s.displayScore += (e.score - s.displayScore) * .25; if (Math.abs(e.score - s.displayScore) < 1) s.displayScore = e.score;
        this.audio.tick(e.events, dt, s.settings.sound && (!e.paused || s.screen !== 'play'), {
            phase: s.screen === 'play' ? e.phase : 'title', realm: s.selectedRealm, music: s.settings.music,
            intensity: Math.min(1, (e.cascade || 0) / 6), radiance: !!(e.radiantMoves || e.radiantActive) });
        this.draw();
    }
    close() { this.snapshot(); this.persist(); this.clearInput(); this.audio.close(); super.close(); }
}
module.exports = Facet;
