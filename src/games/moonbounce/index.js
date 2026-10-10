const { Game, GameNode, Shapes } = require('squish-142');
const { Engine, POWERS, BOUNDS } = require('./engine');
const { Painter, HIDDEN } = require('./painter');
const { render } = require('./scene');
const { Sound } = require('./sound');
const { artAssets } = require('./art');
const { LEVELS, WORLDS, CHALLENGES } = require('./levels');
const { hydrate, refresh, saveProgress, isLevelUnlocked, isPowerUnlocked, isChallengeUnlocked } = require('./progression');

// The same adapter runs in hosted sessions and Homegames' browser-local loader.
// All geometry and input use a 160 × 90 world; only this boundary scales input.
class Moonbounce extends Game {
    static metadata() {
        return {
            name: 'Moonbounce', author: 'Joseph Garcia', createdBy: 'Joseph Garcia', squishVersion: '142',
            description: 'One shot. Five magical worlds. A 40-level celestial adventure with bouncing bumpers, portals, moving constellations, five character powers, 15 mastery challenges, persistent stars and trophies. Mouse, touch, keyboard and controller play.',
            aspectRatio: { x: 16, y: 9 }, tickRate: 30, maxPlayers: 1, assets: {},
        };
    }

    constructor(options = {}) {
        super();
        this.engine = new Engine();
        this.engine.hasArt = true;
        this.engine.hasWorldArt = true;
        this.engine.displayScore = 0;
        this.engine.displayShotScore = 0;
        this.engine.resultAge = 0;
        this.engine.music = true;
        const saved = options.saveData || {};
        if (saved.schema === 1 || saved.schema === 2) {
            this.engine.best = Number.isFinite(saved.best) ? Math.max(0, Math.floor(saved.best)) : 0;
            this.engine.sound = saved.sound !== false;
            this.engine.music = saved.music !== false;
            this.engine.reduced = saved.reduced === true;
        }
        this.engine.progress = hydrate(saved);
        this.engine.medals = this.engine.progress.medals;
        this.engine.selectedLevel = this.engine.progress.selectedLevel;
        this.engine.selectedWorld = this.engine.progress.selectedWorld;
        this.engine.selectedChallenge = CHALLENGES.find(c => c.worldIndex === this.engine.selectedWorld).id;
        this.engine.screen = 'home';
        this.engine.newUnlocks = [];
        if (POWERS.some(p => p.id === saved.powerId) && isPowerUnlocked(this.engine.progress, saved.powerId)) this.engine.setPower(saved.powerId);
        this.saveGame = options.saveGame;
        this.playerId = null;
        this.clock = 0;
        this.keys = {};
        this.keyDownAt = {};
        this.padIndex = null;
        this.padTime = -10;
        this.padAim = 0;
        this.padSpeed = false;
        this.padDownAt = null;
        this.pointerSpeed = false;
        this.menuAxis = 0;
        this.pointerHeld = false;
        this.pointerShot = false;
        this.engine.focusAction = '';
        this.base = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: HIDDEN });
        this.visual = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: HIDDEN });
        this.audioRoot = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: HIDDEN });
        this.base.addChildren(this.visual, this.audioRoot);
        this.painter = new Painter(this.visual);
        // A single transparent input surface keeps highlights and peg art from
        // intercepting clicks. The dispatcher sends pointer movement separately.
        this.surface = new GameNode.Shape({ shapeType: Shapes.POLYGON,
            coordinates2d: [[0, 0], [99.99, 0], [99.99, 99.99], [0, 99.99], [0, 0]],
            fill: [0, 0, 0, 0], color: [0, 0, 0, 0],
            onClick: (id, x, y) => this.click(id, x, y) });
        this.surface.node.offClick = (id, x, y) => this.release(id, x, y);
        this.base.addChild(this.surface, false);
        this.audio = new Sound(this.audioRoot, options.addAsset);
        this.art = artAssets();
        this.addAsset = options.addAsset;
        this.draw();
    }

    getLayers() { return [{ root: this.base }]; }
    getAssets() { return { ...this.art, ...this.audio.assets }; }
    owns(id) { return this.playerId !== null && Number(id) === this.playerId; }
    isPlaying() { return this.engine.phase === 'ready' || this.engine.phase === 'flight'; }

    handleNewPlayer({ playerId }) {
        if (this.playerId === null) this.playerId = Number(playerId);
        this.audio.register();
        if (this.addAsset && !this.artRegistered) {
            this.artRegistered = true;
            for (const [key, asset] of Object.entries(this.art)) {
                try {
                    const pending = this.addAsset(key, asset);
                    if (pending && pending.catch) pending.catch(() => {});
                } catch (_) { /* The vector fallback still permits play. */ }
            }
        }
        this.draw();
    }

    clearInput() {
        this.keys = {};
        this.keyDownAt = {};
        this.padAim = 0;
        this.padSpeed = false;
        this.padDownAt = null;
        this.pointerSpeed = false;
        this.engine.fastForward = false;
        this.menuAxis = 0;
        this.pointerHeld = false;
        this.pointerShot = false;
        this.engine.aiming = false;
    }

    handlePlayerDisconnect(id) {
        if (!this.owns(id)) return;
        this.clearInput();
        this.playerId = null;
        this.padIndex = null;
        if (this.isPlaying()) {
            this.engine.paused = true;
            this.engine.focusAction = 'resume';
        }
        this.persist();
        this.draw();
    }

    persist() {
        if (!this.saveGame) return;
        try {
            const e = this.engine;
            e.progress.selectedLevel = e.selectedLevel; e.progress.selectedWorld = e.selectedWorld;
            const result = this.saveGame({ schema: 2, best: e.best,
                sound: e.sound, music: e.music, reduced: e.reduced, powerId: e.powerId, ...saveProgress(e.progress) });
            if (result && result.catch) result.catch(() => {});
        } catch (_) { /* A storage failure must not interrupt the game. */ }
    }

    draw() {
        const e = this.engine;
        if (this.lastPhase !== e.phase) {
            if (this.lastPhase === 'flight' && ['ready', 'cleared', 'lost'].includes(e.phase)) this.recordShot();
            e.resultAge = 0;
            if (e.phase === 'flight') e.displayShotScore = 0;
            if (['cleared', 'lost', 'won'].includes(e.phase) ||
                (e.phase === 'ready' && this.lastPhase === 'flight')) this.persist();
            if (!e.paused) e.focusAction = '';
            this.lastPhase = e.phase;
        }
        render(this.painter, e);
        this.base.node.onStateChange();
    }

    recordShot() {
        const e = this.engine, p = e.progress, shot = e.lastShot;
        const oldWorlds = p.completedWorlds.slice(), oldPowers = p.unlockedPowers.slice();
        p.career.shots++; p.career.catches += shot.caught; p.career.pegHits += shot.hits;
        p.career.styles += shot.style.length; p.career.bestCombo = Math.max(p.career.bestCombo, shot.hits);
        if (e.phase === 'cleared') {
            if (e.mode === 'challenge') {
                const index = CHALLENGES.findIndex(c => c.id === e.challenge?.id);
                if (index >= 0) {
                    p.challengeMedals[index] = Math.max(p.challengeMedals[index], e.result.stars);
                    p.challengeBests[index] = Math.max(p.challengeBests[index], e.result.boardScore);
                }
            } else {
                p.bestScores[e.levelIndex] = Math.max(p.bestScores[e.levelIndex], e.result.boardScore);
                e.selectedLevel = Math.min(LEVELS.length - 1, e.levelIndex + 1);
                e.selectedWorld = LEVELS[e.selectedLevel].worldIndex;
            }
        }
        const trophies = refresh(p);
        e.newUnlocks = [
            ...p.unlockedPowers.filter(id => !oldPowers.includes(id)).map(id => ({ type: 'power', id, title: POWERS.find(power => power.id === id).name + ' joined your crew!', description: 'Choose your new character from the crew screen.' })),
            ...p.completedWorlds.filter(i => !oldWorlds.includes(i)).map(i => ({ type: 'world', id: String(i), title: WORLDS[i].name + ' complete!', description: 'Three new mastery challenges are now open.' })),
            ...trophies.map(a => ({ type: 'achievement', id: a.id, title: a.title, description: a.description })),
        ];
        if (e.newUnlocks.length) {
            e.emit('unlock');
            if (e.phase === 'ready') e.announce('TROPHY EARNED', e.newUnlocks[0].title, [255, 210, 103], 2.5, 4);
        }
    }

    action(action) {
        const e = this.engine;
        if (action === 'start') {
            if (e.phase === 'title' && e.screen === 'map' && LEVELS[e.selectedLevel].worldIndex !== e.selectedWorld) return;
            const level = this.unlockedLevel(e.selectedLevel) ? e.selectedLevel : 0;
            e.mode = 'adventure'; e.challenge = null; e.newUnlocks = [];
            e.start(e.powerId);
            if (level) { e.levelIndex = level; e.loadLevel(); }
            e.displayScore = e.score; this.clearInput();
        }
        else if (action.startsWith('level:') && e.phase === 'title') {
            const index = Number(action.slice(6));
            if (!this.unlockedLevel(index)) return;
            e.selectedLevel = index;
            e.selectedWorld = LEVELS[index].worldIndex; e.focusAction = 'start'; this.persist();
        }
        else if (action.startsWith('world:') && e.phase === 'title') {
            const index = Number(action.slice(6));
            if (!Number.isInteger(index) || !WORLDS[index]) return;
            e.selectedWorld = index;
            e.focusAction = '';
            if (e.screen !== 'challenges') e.screen = 'map';
            const challenge = CHALLENGES.find(c => c.worldIndex === index);
            if (challenge) e.selectedChallenge = challenge.id;
            const level = LEVELS.findIndex(l => l.worldIndex === index);
            if (this.unlockedLevel(level)) {
                const unfinished = LEVELS.findIndex((l, i) => l.worldIndex === index && !e.medals[i] && this.unlockedLevel(i));
                e.selectedLevel = unfinished >= 0 ? unfinished : level;
            }
            this.persist();
        }
        else if ((action === 'prevWorld' || action === 'nextWorld') && e.phase === 'title') {
            this.action('world:' + (e.selectedWorld + (action === 'nextWorld' ? 1 : -1) + WORLDS.length) % WORLDS.length); return;
        }
        else if (action.startsWith('screen:') && e.phase === 'title') {
            const screen = action.slice(7);
            if (!['home', 'map', 'characters', 'challenges', 'trophies'].includes(screen)) return;
            e.screen = screen; e.focusAction = ''; this.clearInput();
            if (screen === 'challenges' && CHALLENGES.find(c => c.id === e.selectedChallenge)?.worldIndex !== e.selectedWorld) {
                e.selectedChallenge = CHALLENGES.find(c => c.worldIndex === e.selectedWorld).id;
            }
        }
        else if (action === 'home') {
            this.action('title'); e.screen = 'home'; this.draw(); return;
        }
        else if (action.startsWith('challenge:') && e.phase === 'title') {
            const id = action.slice(10);
            if (!isChallengeUnlocked(e.progress, id)) return;
            e.selectedChallenge = id; e.selectedWorld = CHALLENGES.find(c => c.id === id).worldIndex;
            e.focusAction = 'startChallenge';
        }
        else if (action === 'startChallenge' && e.phase === 'title') {
            const challenge = CHALLENGES.find(c => c.id === e.selectedChallenge);
            if (!challenge || challenge.worldIndex !== e.selectedWorld || !isChallengeUnlocked(e.progress, challenge.id)) return;
            e.mode = 'challenge'; e.challenge = challenge; e.newUnlocks = [];
            const power = challenge.powerId && isPowerUnlocked(e.progress, challenge.powerId) ? challenge.powerId : e.powerId;
            e.start(power);
            e.displayScore = e.score; this.clearInput();
        }
        else if (action === 'retry' && (e.paused || ['lost', 'cleared'].includes(e.phase))) { e.newUnlocks = []; e.retry(); e.paused = false; this.clearInput(); }
        else if (action === 'next' && e.phase === 'cleared') {
            if (e.mode === 'challenge') { this.action('title'); return; }
            if (LEVELS[e.levelIndex].finale && e.levelIndex < LEVELS.length - 1) { this.action('title'); return; }
            e.newUnlocks = []; e.next(); this.clearInput();
        }
        else if (action === 'title') {
            const challenge = e.mode === 'challenge';
            if (!challenge) {
                if (e.phase === 'cleared' && this.unlockedLevel(e.levelIndex + 1)) e.selectedLevel = e.levelIndex + 1;
                else if (this.isPlaying() || e.phase === 'lost' || e.phase === 'won') e.selectedLevel = e.levelIndex;
                e.selectedWorld = LEVELS[e.selectedLevel].worldIndex;
            }
            e.screen = challenge ? 'challenges' : 'map';
            e.phase = 'title'; e.paused = false; e.fever = false;
            e.ballsInPlay = []; e.events.length = 0; this.clearInput(); this.persist();
        } else if (action === 'pause' && this.isPlaying()) {
            e.paused = !e.paused; e.focusAction = e.paused ? 'resume' : ''; this.clearInput();
        } else if (action === 'resume' && this.isPlaying()) {
            e.paused = false; e.focusAction = ''; this.clearInput();
        } else if (action === 'sound') { e.sound = !e.sound; this.persist(); }
        else if (action === 'music') { e.music = !e.music; this.persist(); }
        else if (action === 'effects') { e.reduced = !e.reduced; this.persist(); }
        else if (action.startsWith('power:') && e.phase === 'title') {
            const id = action.slice(6);
            if (POWERS.some(p => p.id === id) && isPowerUnlocked(e.progress, id)) { e.setPower(id); this.persist(); }
        } else return;
        e.emit('click');
        this.draw();
    }

    cyclePower(direction) {
        const powers = POWERS.filter(p => isPowerUnlocked(this.engine.progress, p.id));
        const index = powers.findIndex(p => p.id === this.engine.powerId);
        this.action('power:' + powers[(index + direction + powers.length) % powers.length].id);
    }

    unlockedLevel(index) {
        return isLevelUnlocked(this.engine.progress, index);
    }

    cycleLevel(direction) {
        const levels = this.engine.medals.map((_, i) => i).filter(i => this.unlockedLevel(i));
        const current = Math.max(0, levels.indexOf(this.engine.selectedLevel));
        this.action('level:' + levels[(current + direction + levels.length) % levels.length]);
    }

    menuMove(direction) {
        const e = this.engine;
        const allowed = e.paused ? ['resume', 'sound', 'music', 'effects', 'retry', 'title']
            : ['next', 'start', 'retry', 'title', 'home'];
        const buttons = this.painter.buttons.filter(b => b.enabled !== false && (e.phase === 'title' || allowed.includes(b.action)));
        if (!buttons.length) return;
        let i = buttons.findIndex(b => b.action === e.focusAction);
        i = i < 0 ? (direction > 0 ? -1 : 0) : i;
        e.focusAction = buttons[(i + direction + buttons.length) % buttons.length].action;
        e.emit('click');
        this.draw();
    }

    confirm() {
        const e = this.engine;
        if (e.paused) this.action(e.focusAction || 'resume');
        else if (e.phase === 'title') this.action(e.focusAction || ({ home: 'screen:map', map: 'start', characters: 'screen:map', challenges: 'startChallenge', trophies: 'screen:map' }[e.screen] || 'screen:map'));
        else if (e.phase === 'ready') { e.fire(); this.draw(); }
        else if (e.phase === 'cleared') this.action(e.focusAction || (e.mode === 'challenge' ? 'retry' : 'next'));
        else if (e.phase === 'lost') this.action(e.focusAction || 'retry');
        else if (e.phase === 'won') this.action(e.focusAction || 'title');
    }

    click(id, x, y) {
        if (!this.owns(id) || !Number.isFinite(x) || !Number.isFinite(y)) return;
        // Squish 142 repeats clicks while held. Movement still reaches the aim
        // handler, but one physical press must trigger at most one action.
        if (this.pointerHeld) return;
        this.pointerHeld = true;
        x *= 1.6; y *= .9;
        const button = [...this.painter.buttons].reverse().find(b =>
            x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
        if (button) { this.action(button.action); this.pointerHeld = true; return; }
        if (this.engine.phase === 'flight' && !this.engine.paused &&
            x >= BOUNDS.left && x <= BOUNDS.right && y > this.engine.launcher.y + 2 && y < BOUNDS.bottom) {
            this.pointerSpeed = true;
        }
        if (this.engine.phase === 'ready' && !this.engine.paused &&
            x >= BOUNDS.left && x <= BOUNDS.right && y > this.engine.launcher.y + 2 && y < BOUNDS.bottom) {
            this.engine.aimAt(x, y);
            this.pointerShot = true;
            this.engine.aiming = true;
            this.draw();
        }
    }

    release(id, x, y) {
        if (!this.owns(id)) return;
        const shoot = this.pointerShot;
        this.pointerHeld = false;
        this.pointerShot = false;
        this.pointerSpeed = false;
        this.engine.aiming = false;
        if (!shoot || this.engine.paused || this.engine.phase !== 'ready') return;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        x *= 1.6; y *= .9;
        if (x < BOUNDS.left || x > BOUNDS.right || y <= this.engine.launcher.y + 2 || y >= BOUNDS.bottom) return;
        this.engine.aimAt(x, y);
        this.engine.fire();
        this.draw();
    }

    handleMouseMove(id, position = {}) {
        if (!this.owns(id) || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return;
        const x = position.x * 1.6, y = position.y * .9, e = this.engine;
        const button = [...this.painter.buttons].reverse().find(b =>
            x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
        e.hoverAction = button ? button.action : '';
        if (e.phase === 'ready' && !e.paused && x >= BOUNDS.left && x <= BOUNDS.right && y > e.launcher.y + 2 && y < BOUNDS.bottom) {
            e.aimAt(x, y);
        }
    }

    handleKeyDown(id, key) {
        if (!this.owns(id) || typeof key !== 'string') return;
        key = key.toLowerCase();
        const held = this.keys[key] !== undefined;
        this.keys[key] = this.clock;
        if (held) return;
        this.keyDownAt[key] = this.clock;
        const e = this.engine;
        if (key === 'm') this.action('sound');
        else if (key === 'n') this.action('music');
        else if (key === 'v') this.action('effects');
        else if (key === 'escape' && e.phase === 'title') this.action('screen:' + (e.screen === 'map' ? 'home' : 'map'));
        else if (key === 'p' || key === 'escape') this.action('pause');
        else if (key === 'enter' || key === ' ') this.confirm();
        else if (key === 'r' && e.phase === 'lost') this.action('retry');
        else if (e.phase === 'title' && ['1', '2', '3', '4', '5'].includes(key)) this.action('power:' + POWERS[Number(key) - 1].id);
        else if (e.phase === 'title' && ['q', 'e'].includes(key)) this.action(key === 'q' ? 'prevWorld' : 'nextWorld');
        else if (!this.isPlaying() || e.paused) {
            if (['arrowleft', 'arrowup', 'a', 'w'].includes(key)) this.menuMove(-1);
            if (['arrowright', 'arrowdown', 'd', 's'].includes(key)) this.menuMove(1);
        }
        // Actions can clear held movement; retain this action's edge latch.
        this.keys[key] = this.clock;
        if (this.keyDownAt[key] === undefined) this.keyDownAt[key] = this.clock;
    }

    handleKeyUp(id, key) {
        if (this.owns(id) && typeof key === 'string') {
            delete this.keys[key.toLowerCase()]; delete this.keyDownAt[key.toLowerCase()];
        }
    }

    handleGamepadInput(id, message = {}) {
        if (!this.owns(id)) return;
        const { input = {}, pressed = [], connected = true, gamepadIndex = 0 } = message;
        const sticks = input.sticks || {}, buttons = input.buttons || {};
        const value = (collection, name) => Number.isFinite(collection[name]?.value)
            ? Math.max(-1, Math.min(1, collection[name].value)) : 0;
        const held = name => buttons[name]?.pressed || value(buttons, name) > .5;
        const engaged = pressed.length || Object.values(sticks).some(v => Math.abs(v.value || 0) > .15) ||
            Object.values(buttons).some(v => v.pressed || v.value > .5);
        if (this.padIndex !== null && this.padIndex !== gamepadIndex) return;
        if (this.padIndex === null && !engaged) return;
        if (!connected) {
            this.clearInput(); this.padIndex = null;
            if (this.isPlaying() && !this.engine.paused) this.action('pause');
            return;
        }
        this.padIndex = gamepadIndex; this.padTime = this.clock;
        const e = this.engine;
        this.padSpeed = held('RIGHT_TRIGGER') || held('FACE_1');
        if (!this.padSpeed) this.padDownAt = null;
        else if (this.padDownAt === null) this.padDownAt = this.clock;
        const axis = value(sticks, 'STICK_1_X');
        this.padAim = Math.abs(axis) > .12 ? axis : (held('DIRECTION_RIGHT') ? 1 : 0) - (held('DIRECTION_LEFT') ? 1 : 0);
        if (held('LEFT_TRIGGER')) this.padAim *= .25;
        if (pressed.includes('START') && this.isPlaying()) { this.action('pause'); return; }
        if (pressed.includes('FACE_2') && e.paused) { this.action('resume'); return; }
        if (pressed.includes('FACE_2') && e.phase === 'title') { this.action('screen:' + (e.screen === 'map' ? 'home' : 'map')); return; }
        if (!this.isPlaying() || e.paused) {
            if (e.phase === 'title' && pressed.some(n => ['LEFT_SHOULDER', 'RIGHT_SHOULDER'].includes(n))) {
                this.action(pressed.includes('LEFT_SHOULDER') ? 'prevWorld' : 'nextWorld');
                return;
            }
            const direction = Math.abs(axis) > .55 ? Math.sign(axis)
                : Math.abs(value(sticks, 'STICK_1_Y')) > .55 ? Math.sign(value(sticks, 'STICK_1_Y')) : 0;
            if (direction && !this.menuAxis) this.menuMove(direction);
            else if (pressed.some(n => ['DIRECTION_LEFT', 'DIRECTION_UP', 'LEFT_SHOULDER'].includes(n))) this.menuMove(-1);
            else if (pressed.some(n => ['DIRECTION_RIGHT', 'DIRECTION_DOWN', 'RIGHT_SHOULDER'].includes(n))) this.menuMove(1);
            this.menuAxis = direction;
        } else this.menuAxis = 0;
        if (pressed.includes('FACE_1') || pressed.includes('RIGHT_TRIGGER')) this.confirm();
    }

    tick() {
        this.clock += 1 / 30;
        for (const key of Object.keys(this.keys)) if (this.clock - this.keys[key] > .8) { delete this.keys[key]; delete this.keyDownAt[key]; }
        if (this.clock - this.padTime > .55) { this.padAim = 0; this.padSpeed = false; this.padDownAt = null; }
        const e = this.engine;
        if (e.phase === 'ready' && !e.paused) {
            const down = key => this.keys[key] !== undefined ? 1 : 0;
            const direction = this.padAim || down('arrowright') + down('d') - down('arrowleft') - down('a');
            const speed = down('shift') ? .23 : .82;
            e.aimAngle = Math.max(-1.22, Math.min(1.22, e.aimAngle + Math.max(-1, Math.min(1, direction)) * speed / 30));
        }
        e.fastForward = e.phase === 'flight' && !e.paused && (this.pointerSpeed ||
            (this.padSpeed && this.padDownAt !== null && this.clock - this.padDownAt > .28) ||
            (this.keys[' '] !== undefined && this.clock - this.keyDownAt[' '] > .28));
        e.step(1 / 30);
        if (!e.paused) {
            e.resultAge += 1 / 30;
            const smooth = (from, to) => Math.abs(to - from) < 1 ? to : from + (to - from) * .22;
            e.displayScore = smooth(e.displayScore, e.score);
            e.displayShotScore = smooth(e.displayShotScore, e.shotScore);
        }
        this.audio.tick(e.events, 1 / 30, e.sound && !e.paused, { phase: e.phase, fever: e.fever, music: e.music,
            world: e.phase === 'title' ? e.selectedWorld : LEVELS[e.levelIndex].worldIndex });
        this.draw();
    }

    close() {
        this.persist();
        this.clearInput();
        this.audio.tick([], 0, false);
        super.close();
    }
}

module.exports = Moonbounce;
