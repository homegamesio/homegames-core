const { Game, GameNode, Asset } = require('squish-150');
const { Heist, LEVELS, VAN, dist, clamp } = require('./engine');
const A = require('./art');
const { C, CREW } = A;
const DT = 1 / 30;

class MidnightMovers extends Game {
    static metadata() {
        return {
            thumbnail: './assets/thumbnail.png',
            name: 'Midnight Movers',
            author: "Joseph Garcia",
            description: 'Steal a golden goose, an enormous cactus, and a dinosaur skeleton. Sneak past guards, lure them away, and haul ridiculous loot to the van. Three handcrafted heists for 1–4 movers, solo dragging, shared carrying, and saved medals.',
            aspectRatio: { x: 1, y: 1 },
            tickRate: 30,
            maxPlayers: 4,
            assets: {
                grab: new Asset({ path: './assets/grab.wav', type: 'audio' }),
                deliver: new Asset({ path: './assets/deliver.wav', type: 'audio' }),
                alert: new Asset({ path: './assets/alert.wav', type: 'audio' }),
                caught: new Asset({ path: './assets/caught.wav', type: 'audio' }),
                whistle: new Asset({ path: './assets/whistle.wav', type: 'audio' }),
                bell: new Asset({ path: './assets/bell.wav', type: 'audio' }),
                win: new Asset({ path: './assets/win.wav', type: 'audio' }),
            },
            gameId: "ccea1106-1e99-551d-a0db-bf0bdb7ccbe3"
        };
    }
    constructor(options = {}) {
        super(); this.engine = new Heist(); this.players = {}; this.clock = 0; this.frame = 0; this.selected = 0; this.host = null;
        this.saveGame = typeof options.saveGame === 'function' ? options.saveGame : null;
        const saved = options.saveData;
        this.record = { schema: 1, unlocked: 0, jobs: LEVELS.map(() => ({ medals: [false, false, false], best: null })) };
        if (saved?.schema === 1) {
            this.record.unlocked = Number.isFinite(saved.unlocked) ? clamp(Math.floor(saved.unlocked), 0, 2) : 0;
            this.record.jobs = this.record.jobs.map((r, i) => ({ medals: r.medals.map((_, j) => saved.jobs?.[i]?.medals?.[j] === true),
                best: Number.isFinite(saved.jobs?.[i]?.best) && saved.jobs[i].best > 0 ? saved.jobs[i].best : null }));
        }
        this.base = A.group(); this.scene = A.group(); this.world = A.group(); this.hud = A.group(); this.personal = A.group(); this.overlay = A.group(); this.soundRoot = A.group();
        this.tap = A.rect(this.base, 0, 12, 100, 71, [0, 0, 0, 0], { onClick: (id, x, y) => this.pointer(id, x, y) });
        this.base.node.children = [];
        this.base.addChildren(this.scene, this.world, this.tap, this.hud, this.personal, this.overlay, this.soundRoot);
        this.assets = MidnightMovers.metadata().assets;
        this.voices = []; this.effects = []; this.lastPhase = ''; this.closed = false;
        this.rebuildScene(); this.draw();
    }
    getLayers() { return [{ root: this.base }]; }
    getAssets() { return this.assets; }
    canAddPlayer() { return this.engine.players.size < 4; }
    handleNewPlayer({ playerId, info = {}, settings = {} }) {
        if (!this.engine.addPlayer(playerId, info.name)) return;
        const id = String(playerId); this.players[id] = { id, keys: {}, pad: { x: 0, y: 0 }, padIndex: null, sound: settings.SOUND !== false, lastPointer: -1, lastAction: -1 };
        if (this.host === null) this.host = id;
        this.draw();
    }
    handlePlayerDisconnect(id) {
        id = String(id); this.engine.removePlayer(id); delete this.players[id];
        if (id === this.host) this.host = Object.keys(this.players)[0] || null;
        if (!this.host && this.engine.phase === 'paused') this.engine.phase = 'playing'; this.draw();
    }
    handlePlayerUpdate(id, { info = {}, settings = {} } = {}) {
        const p = this.engine.players.get(String(id)); if (p && info.name) p.name = String(info.name).slice(0, 16);
        if (this.players[id] && typeof settings.SOUND === 'boolean') this.players[id].sound = settings.SOUND;
    }
    rebuildScene() { this.scene.clearChildren(); A.scenery(this.scene, this.engine); }
    clearInput() { for (const p of Object.values(this.players)) { p.keys = {}; p.pad = { x: 0, y: 0 }; this.engine.steer(p.id, 0, 0); } for (const p of this.engine.players.values()) { p.path = []; p.auto = null; p.target = null; } }
    start(id, index = this.selected) {
        if (String(id) !== this.host || !Number.isInteger(index) || index < 0 || index > this.record.unlocked) return;
        if (!['title', 'won', 'lost'].includes(this.engine.phase)) return;
        this.selected = index; this.engine.start(index); this.clearInput(); this.effects = []; this.rebuildScene(); this.draw();
    }
    action(id, name) {
        const p = this.players[id]; if (!p) return; id = String(id);
        if (name === 'sound') {
            p.sound = !p.sound;
            for (const v of this.voices) v.node.node.playerIds = Object.values(this.players).filter(p => p.sound).map(p => p.id);
            // An empty privacy list means public, so remove voices when everybody mutes.
            if (!Object.values(this.players).some(p => p.sound)) { this.soundRoot.clearChildren(); this.voices = []; }
            this.draw(); return;
        }
        if (name === 'start') return this.start(id);
        if (name.startsWith('job:')) { const i = Number(name.slice(4)); if (id === this.host && this.engine.phase === 'title' && i >= 0 && i <= this.record.unlocked && Number.isInteger(i)) { this.selected = i; this.engine.load(i); this.engine.phase = 'title'; this.rebuildScene(); this.draw(); } return; }
        if (name === 'next') return this.start(id, Math.min(2, this.engine.levelIndex + 1));
        if (name === 'again') return this.start(id, this.engine.levelIndex);
        if (name === 'menu' && id === this.host && ['paused', 'won', 'lost'].includes(this.engine.phase)) { this.engine.phase = 'title'; this.clearInput(); this.draw(); return; }
        if (name === 'pause' && id === this.host && ['playing', 'paused'].includes(this.engine.phase)) { this.engine.phase = this.engine.phase === 'paused' ? 'playing' : 'paused'; this.clearInput(); this.draw(); return; }
        if (name === 'whistle') this.engine.whistle(id);
        if (name === 'interact' && this.clock - p.lastAction > .2) { p.lastAction = this.clock; this.engine.interact(id); }
        this.draw();
    }
    pointer(id, x, y) {
        const p = this.players[id]; if (!p || !Number.isFinite(x) || !Number.isFinite(y) || this.clock - p.lastPointer < .18) return;
        p.lastPointer = this.clock;
        if (this.engine.phase === 'playing' && y >= 12 && y < 83) { p.keys = {}; p.pad = { x: 0, y: 0 }; this.engine.tap(id, x, y - 12); }
    }
    handleMouseUp(id, pos) {
        if (!pos || !this.players[id]) return;
        // Very short phone taps can arrive only as releases. These share the same debounced actions.
        const { x, y } = pos;
        if (this.engine.phase === 'playing') {
            if (y >= 86 && y <= 96 && x >= 70 && x <= 96) this.action(id, 'interact');
            else if (y >= 86 && y <= 96 && x >= 46 && x <= 67) this.action(id, 'whistle');
            else this.pointer(id, x, y);
        }
    }
    handleKeyDown(id, key) {
        const p = this.players[id]; if (!p || typeof key !== 'string') return;
        key = key.toLowerCase(); if (p.keys[key]) return; p.keys[key] = true;
        if (key === 'enter') {
            if (this.engine.phase === 'title') this.start(id);
            else if (this.engine.phase === 'won') this.action(id, this.engine.levelIndex < 2 ? 'next' : 'menu');
            else if (this.engine.phase === 'lost') this.action(id, 'again');
        }
        if (this.engine.phase === 'title' && ['arrowleft', 'arrowright'].includes(key)) this.action(id, 'job:' + clamp(this.selected + (key === 'arrowleft' ? -1 : 1), 0, this.record.unlocked));
        if (key === 'escape' || key === 'p') this.action(id, 'pause');
        if (key === 'e') this.action(id, 'interact');
        if (key === ' ') this.action(id, 'whistle');
        if (key === 'm') this.action(id, 'sound');
    }
    handleKeyUp(id, key) { if (this.players[id] && typeof key === 'string') delete this.players[id].keys[key.toLowerCase()]; }
    handleGamepadInput(id, message = {}) {
        const p = this.players[id]; if (!p) return;
        const { input = {}, pressed = [], connected = true, gamepadIndex = 0 } = message, sticks = input.sticks || {};
        const value = name => Number.isFinite(sticks[name]?.value) ? clamp(sticks[name].value, -1, 1) : 0;
        if (p.padIndex !== null && p.padIndex !== gamepadIndex) return;
        if (!connected) { p.padIndex = null; p.pad = { x: 0, y: 0 }; return; }
        const x = value('STICK_1_X'), y = value('STICK_1_Y');
        if (p.padIndex === null && !pressed.length && Math.hypot(x, y) < .2) return;
        p.padIndex = gamepadIndex; p.pad = { x: Math.abs(x) > .18 ? x : 0, y: Math.abs(y) > .18 ? y : 0 };
        if (pressed.includes('START')) this.action(id, this.engine.phase === 'title' ? 'start' : 'pause');
        if (pressed.includes('FACE_1') || pressed.includes('A')) this.action(id, this.engine.phase === 'title' ? 'start' : this.engine.phase === 'won' ? (this.engine.levelIndex < 2 ? 'next' : 'menu') : this.engine.phase === 'lost' ? 'again' : 'interact');
        if (this.engine.phase === 'title' && pressed.includes('DIRECTION_LEFT')) this.action(id, 'job:' + Math.max(0, this.selected - 1));
        if (this.engine.phase === 'title' && pressed.includes('DIRECTION_RIGHT')) this.action(id, 'job:' + Math.min(this.record.unlocked, this.selected + 1));
        if (pressed.includes('FACE_3') || pressed.includes('X')) this.action(id, 'whistle');
    }
    button(parent, label, x, y, w, h, color, id, action, size = 2.8) {
        const options = id === null ? {} : { playerIds: [id] };
        A.rect(parent, x, y + .5, w, h, C.night, options);
        const button = A.rect(parent, x, y, w, h, color, { ...options, onClick: pid => this.action(pid, action) });
        A.text(button, label, x + w / 2, y + h / 2 - size * .55, size, C.ink, 'center', options); return button;
    }
    drawWorld() {
        const e = this.engine, w = this.world; w.clearChildren();
        for (const g of e.guards) {
            const cone = [[g.x, g.y + 12]];
            const range = g.mode === 'chase' ? 22 : 19, spread = g.mode === 'chase' ? 1 : .57;
            for (let i = 0; i <= 22; i++) { const a = g.face - spread + i / 22 * spread * 2, d = e.ray(g.x, g.y, a, range); cone.push([g.x + Math.cos(a) * d, g.y + 12 + Math.sin(a) * d]); }
            cone.push(cone[0]); A.shape(w, cone, g.mode === 'chase' ? [250, 115, 97, 62] : [250, 216, 130, 37]);
        }
        for (const d of e.doors) {
            if (!d.open) { A.rect(w, d.x, d.y + 12, d.w, d.h, C.blue); A.rect(w, d.x + .6, d.y + 18, .6, 3, C.cream); }
            else A.rect(w, d.x, d.y + 12, 7, 1, C.blue);
        }
        for (const l of e.level.lasers) {
            const on = e.laserActive(l); A.rect(w, l.x - .4, l.y + 12, 1.5, l.h, on ? [250, 104, 96, 40] : [114, 201, 173, 30]);
            A.rect(w, l.x, l.y + 12, .35, l.h, on ? C.red : [114, 201, 173, 80]);
            A.circle(w, l.x + .2, l.y + 12, .7, on ? C.red : C.mint); A.circle(w, l.x + .2, l.y + 12 + l.h, .7, on ? C.red : C.mint);
        }
        A.van(w, VAN.x, VAN.y + 12 - (e.phase === 'escaping' ? e.escape * e.escape * 13 : 0), e.loot[0].delivered);
        const objects = [...e.loot.filter(l => !l.delivered).map(l => ({ y: l.y, loot: l })), ...e.guards.map(g => ({ y: g.y, guard: g })), ...[...e.players.values()].map(p => ({ y: p.y, player: p }))].sort((a, b) => a.y - b.y);
        for (const o of objects) {
            if (o.loot) {
                const l = o.loot;
                if (l.big) { A.circle(w, l.x, l.y + 12.5, l.radius + 1.1, [246, 192, 81, 22], 2.3); if (!l.owners.size) A.text(w, '◆', l.x, l.y + 5 + Math.sin(this.clock * 2) * .3, 2.5, C.gold, 'center'); }
                A.treasure(w, l.kind, l.x, l.y + 12, l.big ? 1 : .8, true);
                for (const id of l.owners) { const p = e.players.get(id); if (p) A.line(w, p.x, p.y + 11.7, l.x, l.y + 12, .35, CREW[p.color]); }
            } else if (o.guard) {
                const g = o.guard; A.person(w, { ...g, y: g.y + 12 }, this.clock, true);
                if (g.mode !== 'patrol') A.text(w, g.mode === 'chase' ? '!' : '?', g.x, g.y + 6, 2.5, g.mode === 'chase' ? C.red : C.gold, 'center');
            } else {
                const p = o.player; if (e.phase === 'escaping' || p.stun > 0 || p.immunity > 0 && Math.floor(this.clock * 6) % 2) continue;
                A.person(w, { ...p, y: p.y + 12 }, this.clock);
                if (p.hidden) A.circle(w, p.x, p.y + 8, .45, C.mint);
                if (p.suspicion > .05) { A.rect(w, p.x - 2, p.y + 7, 4, .6, C.ink); A.rect(w, p.x - 2, p.y + 7, 4 * Math.min(1, p.suspicion), .6, C.red); }
            }
        }
        for (const fx of this.effects) {
            const age = this.clock - fx.at;
            if (fx.type === 'whistle' || fx.type === 'bell') A.shape(w, A.poly(fx.x, fx.y + 12, age * 8 + 2, 28), [0, 0, 0, 0], { border: 1, color: [246, 192, 81, Math.round(180 * (1 - age / 1.8))] });
            if (fx.text) A.text(w, fx.text, clamp(fx.x, 21, 79), clamp(fx.y + 9 - age, 16, 78), 1.4, fx.type === 'caught' ? C.rose : C.cream, 'center');
        }
    }
    drawHud() {
        const e = this.engine; this.hud.clearChildren(); this.personal.clearChildren();
        A.rect(this.hud, 0, 0, 100, 12, C.night); A.rect(this.hud, 0, 83, 100, 17, C.night);
        A.text(this.hud, `${e.level.place}  /  ${e.levelIndex + 1} OF 3`, 4, 1.9, 1.15, C.muted);
        A.text(this.hud, e.loot[0].delivered ? 'Everyone back to the van.' : e.loot[0].owners.size ? 'Bring the big one to the van.' : `Take the ${e.level.hero.name.toLowerCase()}.`, 4, 4.9, 3);
        A.text(this.hud, `CAUGHT ${e.catches}/3`, 81, 2, 1.1, e.catches ? C.rose : C.muted);
        for (let i = 0; i < 3; i++) A.circle(this.hud, 83 + i * 3.4, 6.9, .9, i < e.catches ? C.rose : C.wall);
        A.text(this.hud, `EXTRAS  ${e.loot.filter(l => !l.big && l.delivered).length}/3`, 4, 80.2, 1.05, C.gold);
        for (const p of e.players.values()) {
            const id = p.id, root = A.group({ playerIds: [id] }); this.personal.addChild(root, false);
            const priv = { playerIds: [id] };
            if (e.phase === 'playing') {
                A.text(root, p.hidden ? 'HIDDEN' : 'YOU', p.x, p.y + 7.5, 1.5, CREW[p.color], 'center', priv);
                if (p.target && p.path.length) { A.circle(root, p.target.x, p.target.y + 12, .5, CREW[p.color], .5, priv); }
            }
            let hint = 'Tap the floor to walk.';
            const near = e.nearest(p);
            if (p.stun) hint = 'Caught! You will be back in a moment.';
            else if (p.cargo) hint = e.loot.find(l => l.id === p.cargo).big ? (e.loot[0].owners.size > 1 ? 'Move together to lift the load.' : 'Haul it home. Friends can help carry.') : 'Bring your treasure to the van.';
            else if (p.hidden) hint = 'Hidden. Wait for a clear route.';
            else if (p.suspicion > .2) hint = 'Break sight! Get behind a wall.';
            else if (e.loot[0].delivered) hint = 'Grab extras, or get the whole crew out.';
            else if (near.type === 'door') hint = 'The blue door opens a route through.';
            else if (near.type === 'panel') hint = 'Cut the lasers for ten seconds.';
            else if (near.type === 'bell') hint = 'A bell brings curious guards.';
            else if (near.type === 'loot') hint = 'Grab it. Walk it back to the van.';
            A.text(root, p.name.toUpperCase(), 4, 85.5, 1.5, CREW[p.color], 'left', priv);
            const split = hint.lastIndexOf(' ', 24); const lines = hint.length > 26 ? [hint.slice(0, split), hint.slice(split + 1)] : [hint];
            lines.forEach((s, i) => A.text(root, s, 4, 89 + i * 2.5, 1.9, C.cream, 'left', priv));
            this.button(root, p.whistle > 0 ? `PSST · ${Math.ceil(p.whistle)}` : 'PSST', 46, 86, 21, 10, p.whistle > 0 ? C.wallTop : C.blue, id, 'whistle', 3);
            this.button(root, near.label, 70, 86, 26, 10, CREW[p.color], id, 'interact', 3);
            A.text(root, 'WASD / arrows · E grab/drop · Space whistle', 4, 97, 1, C.muted, 'left', priv);
            this.button(root, this.players[id].sound ? '♪ ON' : '♪ OFF', 74, 97, 10, 2.5, C.muted, id, 'sound', 1);
            if (id === this.host) this.button(root, 'PAUSE', 87, 97, 9, 2.5, C.muted, id, 'pause', 1);
        }
    }
    drawOverlay() {
        const e = this.engine, o = this.overlay; o.clearChildren(); if (e.phase === 'playing' || e.phase === 'escaping') return;
        A.rect(o, 0, 0, 100, 100, [9, 18, 34, 195]);
        A.rect(o, 7, 7, 86, 85, C.night); A.rect(o, 7, 7, 86, .5, C.gold);
        if (e.phase === 'title') {

            A.treasure(o, e.level.hero.kind, 78, 34, 1.8, true);
            A.text(o, 'Take the big one. Get everyone out.', 13, 41, 2.7);
            A.text(o, 'Stay out of the light. Carry more with friends.', 13, 46, 2, C.muted);
            for (let i = 0; i < 3; i++) {
                const x = 13 + i * 25, unlocked = i <= this.record.unlocked;
                const card = A.rect(o, x, 52, 23, 17, i === this.selected ? [65, 84, 91, 255] : C.wall, { onClick: id => this.action(id, 'job:' + i) });
                A.text(card, unlocked ? `JOB ${i + 1}` : 'LOCKED', x + 2, 54, 1.5, unlocked ? C.mint : C.muted);
                ['Golden Goose', 'Prickly Business', 'Bone Voyage'][i].split(' ').forEach((word, j) => A.text(card, word, x + 2, 57 + j * 3.1, 2.7));
                A.text(card, this.record.jobs[i].medals.map(v => v ? '★' : '·').join('  '), x + 2, 64, 2, C.gold);
            }
            A.text(o, `${this.engine.players.size || 1} / 4 MOVERS  ·  SOLO OR TOGETHER`, 13, 72, 2, C.mint);
            A.text(o, 'Move: WASD / arrows / tap     Grab: E / button', 13, 76, 1.65, C.muted);
            for (const id of Object.keys(this.players)) this.button(o, id === this.host ? 'PLAY' : 'WAITING FOR HOST', 13, 81, 74, 7, id === this.host ? C.gold : C.wallTop, id, 'start', 3);
        } else if (e.phase === 'paused') {
            A.text(o, 'ON A BREAK', 50, 24, 5, C.cream, 'center');
            A.text(o, 'The guards can wait.', 50, 35, 2, C.muted, 'center');
            this.button(o, 'BACK TO THE JOB', 20, 48, 60, 9, C.mint, this.host, 'pause');
            this.button(o, 'LEAVE THIS JOB', 20, 63, 60, 8, C.wallTop, this.host, 'menu');
        } else if (e.phase === 'lost') {
            A.text(o, 'BUSTED.', 50, 22, 7, C.rose, 'center');
            A.text(o, 'The loot is fine. Your disguises need work.', 50, 35, 1.8, C.cream, 'center');
            A.text(o, 'Break sight behind walls. Whistle to move a guard.', 50, 43, 1.55, C.muted, 'center');
            this.button(o, 'ONE MORE TRY', 20, 58, 60, 10, C.gold, this.host, 'again');
            this.button(o, 'JOB BOARD', 20, 73, 60, 8, C.wallTop, this.host, 'menu');
        } else {
            const r = e.result;
            A.text(o, e.levelIndex === 2 ? 'WHAT DINOSAUR?' : 'ABSOLUTELY GONE.', 50, 18, e.levelIndex === 2 ? 4.7 : 4.5, C.gold, 'center');
            A.treasure(o, e.level.hero.kind, 50, 37, 1.8, true);
            A.text(o, e.level.name, 50, 47, 2.5, C.cream, 'center');
            A.text(o, `${Math.floor(r.seconds / 60)}:${String(r.seconds % 60).padStart(2, '0')}   ·   ${r.extras}/3 extras   ·   ${r.catches} caught`, 50, 52, 1.5, C.muted, 'center');
            ['THE BIG ONE', 'FULL HAUL', 'NEVER SEEN'].forEach((label, i) => { const x = 24 + i * 26; A.text(o, r.medals[i] ? '★' : '·', x, 59, 3, r.medals[i] ? C.gold : C.wallTop, 'center'); A.text(o, label, x, 64, 1.1, C.muted, 'center'); });
            this.button(o, e.levelIndex < 2 ? 'THE NEXT JOB' : 'BACK TO THE JOB BOARD', 16, 72, 68, 8, C.mint, this.host, e.levelIndex < 2 ? 'next' : 'menu');
            this.button(o, 'RUN IT AGAIN', 16, 83, 68, 5, C.wallTop, this.host, 'again', 1.4);
        }
    }
    draw() { this.drawWorld(); this.drawHud(); this.drawOverlay(); this.base.node.onStateChange(); }
    tick() {
        if (this.closed) return; this.clock += DT; this.frame++;
        for (const p of Object.values(this.players)) {
            const k = p.keys, dx = (k.d || k.arrowright ? 1 : 0) - (k.a || k.arrowleft ? 1 : 0) + p.pad.x, dy = (k.s || k.arrowdown ? 1 : 0) - (k.w || k.arrowup ? 1 : 0) + p.pad.y;
            this.engine.steer(p.id, dx, dy);
        }
        const before = this.engine.phase; this.engine.tick(DT);
        if (this.engine.phase === 'won' && before !== 'won') {
            const r = this.engine.result, record = this.record.jobs[r.level];
            record.medals = record.medals.map((v, i) => v || r.medals[i]); record.best = record.best === null ? r.seconds : Math.min(record.best, r.seconds);
            this.record.unlocked = Math.max(this.record.unlocked, Math.min(2, r.level + 1));
            if (this.saveGame) { try { Promise.resolve(this.saveGame(JSON.parse(JSON.stringify(this.record)))).catch(() => {}); } catch (_) {} }
        }
        for (const event of this.engine.events.splice(0)) {
            this.effects.push({ ...event, at: this.clock });
            const type = this.assets[event.type] ? event.type : event.type === 'door' || event.type === 'switch' ? 'grab' : null;
            const playerIds = Object.values(this.players).filter(p => p.sound).map(p => p.id);
            if (type && playerIds.length && this.voices.length < 5) {
                const node = new GameNode.Asset({ assetInfo: { [type]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 } }, playerIds });
                this.soundRoot.addChild(node, false); this.voices.push({ node, until: this.clock + 2 });
            }
        }
        this.effects = this.effects.filter(f => this.clock - f.at < 1.8).slice(-8);
        for (const v of this.voices.filter(v => v.until <= this.clock)) this.soundRoot.removeChild(v.node.id);
        this.voices = this.voices.filter(v => v.until > this.clock);
        // Static scenery stays allocated; dynamic state is redrawn at 15 fps.
        if (this.frame % 2 === 0 || before !== this.engine.phase) this.draw();
    }
    close() { this.closed = true; this.voices = []; this.soundRoot.clearChildren(); this.clearInput(); }
}
module.exports = MidnightMovers;
