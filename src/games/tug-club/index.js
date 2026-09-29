const { Game, GameNode, Shapes, ShapeUtils } = require('squish-142');

// The workbench: change these to make your own kind of expedition.
const RULES = {
    tickRate: 30, seconds: 180, goal: 12, maxPlayers: 6,
    speed: 16, boostSpeed: 29, boostCooldown: 2.8,
    latchRadius: 5.4, ropeLength: 4.5, snapLength: 13,
    dockRadius: 9, particles: 40,
};
const C = {
    space: [14, 27, 37, 255], deep: [10, 20, 29, 255],
    panel: [22, 40, 49, 255], line: [43, 65, 72, 255],
    muted: [139, 162, 161, 255], cream: [244, 237, 210, 255],
    mint: [161, 226, 184, 255], mintDark: [65, 117, 102, 255],
    orange: [248, 139, 100, 255], orangeDark: [151, 73, 58, 255],
    gold: [242, 200, 112, 255], teal: [71, 150, 148, 255],
};
const CREW = [
    { name: 'MINT', color: C.mint }, { name: 'CORAL', color: C.orange },
    { name: 'GOLD', color: C.gold }, { name: 'SKY', color: [135, 202, 225, 255] },
    { name: 'LILAC', color: [191, 167, 218, 255] }, { name: 'ROSE', color: [232, 166, 184, 255] },
];
const HOME = { x: 50, y: 48 };
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const length = (x, y) => Math.sqrt(x * x + y * y);
const mix = (a, b, t) => a.map((v, i) => i === 3 ? 255 : Math.round(v + (b[i] - v) * clamp(t, 0, 1)));
const poly = (x, y, r, n = 6, angle = 0) => {
    const points = [];
    for (let i = 0; i <= n; i++) points.push([x + Math.cos(angle + i * TAU / n) * r, y + Math.sin(angle + i * TAU / n) * r]);
    return points;
};
const closed = (points) => points.concat([points[0]]);
const line = (x, y, xx, yy, width) => {
    const a = Math.atan2(yy - y, xx - x), dx = Math.sin(a) * width / 2, dy = Math.cos(a) * width / 2;
    return closed([[x - dx, y + dy], [xx - dx, yy + dy], [xx + dx, yy - dy], [x + dx, y - dy]]);
};
const localPoly = (x, y, angle, points, scale = 1) => closed(points.map(([px, py]) => [
    x + (px * Math.cos(angle) - py * Math.sin(angle)) * scale,
    y + (px * Math.sin(angle) + py * Math.cos(angle)) * scale,
]));
const HIDDEN = [[0, 0], [0, 0], [0, 0]];

class TugClub extends Game {
    static metadata() {
        return {
            squishVersion: '142', name: 'Tug Club', author: 'Joseph Garcia', createdBy: 'Joseph Garcia',
            description: 'Tiny ships. Big hauls. Fly close to latch on, pull together, and build a little home in space. A cozy, chaotic salvage expedition for 1–6 pilots.',
            aspectRatio: { x: 1, y: 1 }, tickRate: 30, maxPlayers: 6,
            services: ['multiplayer'],
        };
    }

    constructor(options = {}) {
        super();
        this.saveGame = typeof options.saveGame === 'function' ? options.saveGame : null;
        const old = options.saveData;
        this.record = old && old.schema === 1 && Number.isFinite(old.bestSeconds)
            ? { schema: 1, bestSeconds: clamp(old.bestSeconds, 1, RULES.seconds), homes: clamp(Number(old.homes) || 0, 0, 99999) }
            : { schema: 1, bestSeconds: RULES.seconds, homes: 0 };
        this.players = {};
        this.phase = 'title'; this.clock = 0; this.elapsed = 0; this.energy = 0;
        this.round = 0; this.rng = 741; this.deliveries = 0; this.assists = 0; this.finalHaul = false;
        this.bannerUntil = 0; this.endAt = 0; this.cargo = []; this.hazards = [];
        this.base = this.shape(ShapeUtils.rectangle(0, 0, 100, 100), C.space);
        this.scenery = this.group(); this.homeLayer = this.group(); this.world = this.group();
        this.effects = this.group(); this.shipLayer = this.group(); this.hud = this.group();
        this.identity = this.group(); this.overlay = this.group();
        this.tap = this.shape(ShapeUtils.rectangle(0, 11, 100, 73), null, { onClick: (id, x, y) => this.steer(id, x, y) });
        this.base.addChildren(this.scenery, this.homeLayer, this.world, this.effects, this.shipLayer, this.tap, this.hud, this.identity, this.overlay);
        this.buildScenery();
        this.particles = [];
        for (let i = 0; i < RULES.particles; i++) {
            const n = this.shape(HIDDEN, C.cream);
            this.effects.addChild(n, false); this.particles.push({ node: n, life: 0 });
        }
        this.drawHome(); this.buildTitle();
    }

    getLayers() { return [{ root: this.base }]; }
    shape(points, fill, opts = {}) { return new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: points, ...(fill ? { fill } : {}), ...opts }); }
    rect(x, y, w, h, fill, opts) { return this.shape(ShapeUtils.rectangle(x, y, w, h), fill, opts); }
    group(opts = {}) { return this.shape(HIDDEN, null, opts); }
    text(str, x, y, size, color = C.cream, align = 'left', opts = {}) {
        return new GameNode.Text({ textInfo: { text: str, x, y, size, color, align, font: 'monospace' }, ...opts });
    }
    setText(node, str, color) {
        node.node.text = { ...node.node.text, text: str, ...(color ? { color } : {}) };
    }
    put(parent, node) { parent.addChild(node, false); return node; }
    dirty() { this.base.node.onStateChange(); }
    rand() { this.rng = (Math.imul(this.rng, 1664525) + 1013904223) >>> 0; return this.rng / 4294967296; }
    button(parent, str, x, y, w, h, fill, onClick, opts = {}) {
        const node = this.rect(x, y, w, h, fill, { onClick, ...opts });
        node.addChild(this.text(str, x + w / 2, y + h / 2 - 1.2, 2.4, C.deep, 'center', opts.playerIds ? { playerIds: opts.playerIds } : {}), false);
        parent.addChild(node, false); return node;
    }

    buildScenery() {
        for (let i = 0; i < 58; i++) {
            const x = 2 + this.rand() * 96, y = 12 + this.rand() * 73, r = 0.07 + this.rand() * 0.18;
            this.put(this.scenery, this.shape(poly(x, y, r, 4), i % 5 ? C.line : C.muted));
        }
        for (const r of [18, 30, 41]) {
            for (let i = 0; i < 24; i++) {
                const a = i * TAU / 24, b = a + 0.10;
                const y1 = HOME.y + Math.sin(a) * r, y2 = HOME.y + Math.sin(b) * r;
                if (y1 < 13 || y1 > 83 || y2 < 13 || y2 > 83) continue;
                this.put(this.scenery, this.shape(line(50 + Math.cos(a) * r, y1, 50 + Math.cos(b) * r, y2, 0.09), C.line));
            }
        }
        this.put(this.scenery, this.text('SALVAGE SECTOR  /  07', 4, 13, 1.1, C.muted));
    }

    drawHome() {
        this.homeLayer.clearChildren();
        const h = this.homeLayer, e = this.energy;
        this.put(h, this.shape(poly(50, 49.2, 9.2, 8, Math.PI / 8), C.deep));
        this.put(h, this.shape(poly(50, 48, 9.2, 8, Math.PI / 8), C.line));
        this.put(h, this.shape(poly(50, 48, 7.9, 8, Math.PI / 8), e >= 9 ? C.mintDark : C.panel));
        for (let i = 0; i < RULES.goal; i++) {
            const a = -Math.PI / 2 + i * TAU / RULES.goal;
            this.put(h, this.shape(localPoly(50 + Math.cos(a) * 8.6, 48 + Math.sin(a) * 8.6, a,
                [[-.4, -1.05], [.4, -1.05], [.4, 1.05], [-.4, 1.05]]), i < e ? C.mint : C.muted));
        }
        // Everything, including the home, is a handful of flat polygons.
        this.put(h, this.rect(46.4, 45.7, 7.2, 5.5, e >= 3 ? C.cream : C.line));
        this.put(h, this.shape(closed([[45.1, 46], [50, 41.8], [54.9, 46]]), e >= 3 ? C.orange : C.muted));
        this.put(h, this.rect(49, 48, 2, 3.2, C.deep));
        this.put(h, this.rect(47.2, 46.8, 1.2, 1.3, e >= 1 ? C.gold : C.deep));
        this.put(h, this.rect(51.6, 46.8, 1.2, 1.3, e >= 1 ? C.gold : C.deep));
        if (e >= 6) {
            this.put(h, this.shape(line(43.8, 46.4, 43.8, 50.8, .3), C.cream));
            this.put(h, this.shape(poly(43.8, 45.4, 1.8, 5, -.8), C.mint));
            this.put(h, this.shape(poly(55.9, 48.5, 1.5, 5), C.mint));
        }
        if (e >= 9) {
            this.put(h, this.shape(line(53.6, 44.5, 53.6, 40.6, .2), C.cream));
            this.put(h, this.shape(closed([[53.7, 40.6], [56.2, 41.3], [53.7, 42.2]]), C.gold));
            this.put(h, this.rect(45.8, 52.2, 8.4, .4, C.mint));
        }
        this.put(h, this.text(this.phase === 'won' ? 'WELCOME HOME' : 'BRING IT HOME', 50, 58.3, 1.3, C.mint, 'center'));
    }

    makeShip(parent, color, scale = 1) {
        const group = this.group(); parent.addChild(group, false);
        const rope = this.put(group, this.shape(HIDDEN, color));
        const flame = this.put(group, this.shape(HIDDEN, C.gold));
        const body = this.put(group, this.shape(HIDDEN, color));
        const cabin = this.put(group, this.shape(HIDDEN, C.deep));
        const fin = this.put(group, this.shape(HIDDEN, C.cream));
        return { group, rope, flame, body, cabin, fin, scale };
    }
    renderShip(nodes, x, y, a, thrust, boost, color) {
        const s = nodes.scale;
        nodes.body.node.coordinates2d = localPoly(x, y, a, [[2.1, 0], [.6, -1.35], [-1.35, -1.35], [-1.65, -.7], [-1.65, .7], [-1.35, 1.35], [.6, 1.35]], s);
        nodes.body.node.fill = color;
        nodes.cabin.node.coordinates2d = localPoly(x, y, a, [[1.3, 0], [.2, -.65], [-.25, -.65], [-.25, .65], [.2, .65]], s);
        nodes.fin.node.coordinates2d = localPoly(x, y, a, [[-1.1, -.6], [-.7, -.6], [-.7, .6], [-1.1, .6]], s);
        nodes.flame.node.coordinates2d = thrust > .2 ? localPoly(x, y, a, [[-1.6, -.65], [-2.1 - (boost ? 2.4 : 1) * (0.7 + Math.sin(this.clock * 41) * .3), 0], [-1.6, .65]], s) : HIDDEN;
        nodes.flame.node.fill = boost ? C.cream : C.gold;
    }

    buildTitle() {
        this.overlay.clearChildren(); this.hud.clearChildren();
        const o = this.overlay;
        this.put(o, this.rect(0, 0, 100, 100, C.space));
        for (let i = 0; i < 35; i++) this.put(o, this.shape(poly(2 + this.rand() * 96, 8 + this.rand() * 54, .12, 4), C.muted));
        this.put(o, this.text('HOMEGAMES  /  ORBITAL SALVAGE CO.', 6, 5, 1.4, C.mint));
        this.put(o, this.text('01—06 PILOTS', 94, 5, 1.3, C.muted, 'right'));
        this.put(o, this.shape(poly(77, 32, 20, 10, .2), C.mintDark));
        this.put(o, this.shape(closed([[61, 21], [70, 12.8], [88, 15.4], [96, 27], [79, 30], [70, 24]]), C.teal));
        this.put(o, this.shape(closed([[79, 30], [96, 27], [94, 43], [84, 51], [69, 48], [73, 39]]), C.panel));
        this.put(o, this.shape(closed([[70, 24], [79, 30], [73, 39], [60, 34], [57.5, 26]]), C.mint));
        this.put(o, this.shape(line(56, 42, 95, 19, .3), C.gold));
        this.put(o, this.text('TUG', 5.2, 14, 11.7, C.cream));
        this.put(o, this.text('CLUB', 5.2, 29, 11.7, C.cream));
        this.put(o, this.text('BRING IT HOME.', 6, 44, 2.9, C.orange));
        this.put(o, this.text('Tiny ships. Big hauls.', 6, 50, 1.75));
        this.put(o, this.text('Better when we pull together.', 6, 53.2, 1.65, C.muted));
        this.heroCargo = this.put(o, this.shape(poly(77, 55, 3, 6), C.gold));
        this.hero = this.makeShip(o, C.orange, 1.75);
        this.hero2 = this.makeShip(o, C.mint, 1.15);
        this.put(o, this.rect(6, 62, 88, .16, C.line));
        const instructions = [
            ['01 / FLY', 'Tap to fly.', 'WASD works too.'],
            ['02 / TOW', 'Fly close to latch.', 'Pull with friends.'],
            ['03 / BUILD', 'Light all 12.', 'Then tow the heart.'],
        ];
        instructions.forEach((rows, i) => {
            const x = 6 + i * 30;
            this.put(o, this.text(rows[0], x, 66, 1.8, C.mint));
            this.put(o, this.text(rows[1], x, 71, 1.55));
            this.put(o, this.text(rows[2], x, 74, 1.55, C.muted));
        });
        this.button(o, 'LET’S MAKE A HOME  >', 6, 81, 63, 11, C.mint, id => this.start(id));
        this.put(o, this.text('3 MINUTES', 74, 84, 1.65));
        this.put(o, this.text('NO ONE LEFT BEHIND', 74, 87, 1.05, C.muted));
        this.titleCrew = this.put(o, this.text('', 6, 95, 1.3, C.muted));
        this.updateCrewLabel();
    }
    updateCrewLabel() {
        if (this.titleCrew) this.setText(this.titleCrew, Object.keys(this.players).length + ' PILOT(S) ABOARD  /  SOLO IS GOOD. COMPANY IS BETTER.');
    }

    handleNewPlayer({ playerId, info = {} }) {
        const id = Number(playerId);
        if (!Number.isInteger(id) || id < 1 || id > 254 || this.players[id] || Object.keys(this.players).length >= RULES.maxPlayers) return;
        const used = Object.values(this.players).map(p => p.slot);
        const slot = CREW.findIndex((c, i) => !used.includes(i));
        const p = { id, slot, color: CREW[slot].color, name: String(info.name || CREW[slot].name).slice(0, 18),
            x: 50, y: 62, vx: 0, vy: 0, a: -Math.PI / 2, keys: {}, target: null,
            cargo: null, cooldown: 0, boost: 0, stun: 0, grace: 2, latchDelay: 0, hauled: 0, controlsAt: this.clock,
            dropLock: false, pad: { x: 0, y: 0 }, nodes: this.makeShip(this.shipLayer, CREW[slot].color),
        };
        this.players[id] = p;
        this.placePlayer(p);
        this.buildPersonalHud(p);
        this.updateCrewLabel();
        if (this.phase === 'playing') this.announce(CREW[slot].name + ' JOINED THE CREW', 2.2);
        this.drawPlayers(); this.dirty();
    }
    placePlayer(p) {
        const a = Math.PI / 2 + p.slot * TAU / 6;
        p.x = 50 + Math.cos(a) * 12; p.y = 48 + Math.sin(a) * 12;
        p.vx = 0; p.vy = 0; p.target = null; p.cargo = null; p.a = a;
        p.grace = 2; p.keys = {}; p.pad = { x: 0, y: 0 }; p.cooldown = 0; p.boost = 0;
    }
    buildPersonalHud(p) {
        const root = this.group({ playerIds: [p.id] });
        p.ui = root;
        p.marker = this.put(root, this.text('YOU', p.x, p.y - 3.4, 1.15, p.color, 'center', { playerIds: [p.id] }));
        p.status = this.put(root, this.text('', 4, 87.8, 2, p.color, 'left', { playerIds: [p.id] }));
        p.hint = this.put(root, this.text('', 4, 92, 1.5, C.muted, 'left', { playerIds: [p.id] }));
        p.boostButton = this.button(root, 'BOOST', 76, 87, 20, 10, p.color, () => this.doBoost(p), { playerIds: [p.id] });
        p.boostBar = this.put(root, this.rect(76, 97.8, 20, .6, p.color, { playerIds: [p.id] }));
        this.button(root, 'DROP', 60, 87, 13, 10, C.muted, () => this.drop(p), { playerIds: [p.id] });
        this.identity.addChild(root, false);
    }
    handlePlayerDisconnect(id) {
        const p = this.players[id]; if (!p) return;
        this.detach(p); this.shipLayer.removeChild(p.nodes.group.id); this.identity.removeChild(p.ui.id);
        delete this.players[id]; this.updateCrewLabel(); this.dirty();
    }
    handlePlayerUpdate(id, { info = {} } = {}) { if (this.players[id] && info.name) this.players[id].name = String(info.name).slice(0, 18); }

    start(id) {
        if (!this.players[id] || (this.phase !== 'title' && this.phase !== 'won' && this.phase !== 'lost') || this.clock < this.endAt + 0.8 && this.phase !== 'title') return;
        this.phase = 'playing'; this.startedAt = this.clock; this.round++; this.rng = 741 + this.round * 391;
        this.elapsed = 0; this.energy = 0; this.deliveries = 0; this.assists = 0; this.finalHaul = false;
        this.world.clearChildren(); this.overlay.clearChildren(); this.cargo = []; this.hazards = [];
        this.titleCrew = null;
        this.particles.forEach(p => { p.life = 0; p.node.node.coordinates2d = HIDDEN; });
        Object.values(this.players).forEach(p => { this.placePlayer(p); p.hauled = 0; });
        // The first pod is deliberately beside the starting ship: learn by doing.
        const spots = [[35, 65, 1], [69, 32, 2], [22, 31, 2], [77, 67, 3], [50, 18, 2], [49, 78, 1], [16, 53, 1], [85, 45, 2]];
        spots.forEach(([x, y, value], i) => {
            const jitter = i === 0 ? 0 : (this.rand() - .5) * 3;
            this.addCargo(x + jitter, y, value, i);
        });
        for (let i = 0; i < 3; i++) {
            const h = { a: i * TAU / 3 + .4, r: 26 + i * 3, speed: (.17 + i * .025) * (i % 2 ? -1 : 1), x: 0, y: 0, size: 1.8 + i * .2 };
            h.trail = this.put(this.world, this.shape(HIDDEN, C.orangeDark));
            h.node = this.put(this.world, this.shape(HIDDEN, C.orange));
            h.core = this.put(this.world, this.shape(HIDDEN, C.deep));
            this.hazards.push(h);
        }
        this.buildHud(); this.drawHome();
        this.announce('FIRST HAUL: TOW THE GOLD POD HOME', 7);
        this.drawPlayers(); this.dirty();
    }
    addCargo(x, y, value, id, heart = false) {
        const c = { id, x, y, vx: 0, vy: 0, value, r: 1.4 + value * .48, mass: .8 + value * .65,
            angle: this.rand() * TAU, spin: (this.rand() - .5) * .25, active: true, owners: new Set(), touched: new Set(), heart };
        if (heart) { c.r = 5.2; c.mass = 12; }
        c.group = this.group(); this.world.addChild(c.group, false);
        c.shadow = this.put(c.group, this.shape(HIDDEN, C.deep));
        c.node = this.put(c.group, this.shape(HIDDEN, C.gold));
        c.facet = this.put(c.group, this.shape(HIDDEN, C.orangeDark));
        c.face = this.put(c.group, this.shape(HIDDEN, C.cream));
        c.label = this.put(c.group, this.text(heart ? 'HEART' : String(value), x, y - .8, heart ? 1.1 : 1.6, C.deep, 'center'));
        this.cargo.push(c); this.drawCargo(c);
    }
    buildHud() {
        this.hud.clearChildren();
        this.put(this.hud, this.rect(0, 0, 100, 11, C.deep));
        this.put(this.hud, this.rect(0, 84, 100, 16, C.deep));
        this.put(this.hud, this.text('TUG CLUB', 4, 2.4, 2.4));
        this.homeScore = this.put(this.hud, this.text('0 / 12', 50, 2, 2.6, C.mint, 'center'));
        this.timeLabel = this.put(this.hud, this.text('03:00', 96, 2, 2.6, C.cream, 'right'));
        this.put(this.hud, this.text('HOME POWER', 50, 6.1, 1, C.muted, 'center'));
        this.crewLabel = this.put(this.hud, this.text('', 4, 6.3, 1.05, C.muted));
        this.put(this.hud, this.text('UNTIL THE STORM', 96, 6.1, 1, C.muted, 'right'));
        this.meter = this.put(this.hud, this.rect(0, 10.5, .01, .5, C.mint));
        this.banner = this.put(this.hud, this.text('', 50, 80.6, 1.6, C.cream, 'center'));
    }
    announce(str, seconds = 3) {
        if (this.banner) this.setText(this.banner, str);
        this.bannerUntil = this.clock + seconds;
    }

    steer(id, x, y) {
        const p = this.players[id];
        if (!p || this.phase !== 'playing' || !Number.isFinite(x) || !Number.isFinite(y) || y < 11 || y > 84) return;
        p.target = { x: clamp(x, 5, 95), y: clamp(y, 17, 80) }; p.keys = {}; p.pad = { x: 0, y: 0 }; p.controlsAt = this.clock;
    }
    handleMouseMove(id, pos) { if (pos) this.steer(id, pos.x, pos.y); }
    handleMouseUp(id, pos) {
        const p = this.players[id]; if (!p) return;
        // A very short tap can begin and end between the player's input frames.
        // Releases still arrive, so they complete the same actions reliably.
        if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
            const { x, y } = pos;
            if (this.phase === 'title' && x >= 6 && x <= 69 && y >= 81 && y <= 92) this.start(id);
            else if ((this.phase === 'won' || this.phase === 'lost') && x >= 12 && x <= 88 && y >= 80 && y <= 89) this.start(id);
            else if (this.phase === 'playing' && this.clock - this.startedAt > .2) {
                if (y >= 87 && y <= 97 && x >= 76 && x <= 96) this.doBoost(p);
                else if (y >= 87 && y <= 97 && x >= 60 && x <= 73) this.drop(p);
                else this.steer(id, x, y);
            }
        }
        p.dropLock = false;
    }
    handleKeyDown(id, key) {
        const p = this.players[id]; if (!p || typeof key !== 'string') return;
        key = key.toLowerCase();
        if (key === 'enter') { this.start(id); return; }
        if (this.phase !== 'playing') return;
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
            p.keys[key] = this.clock; p.target = null; p.controlsAt = this.clock;
        }
        if (key === ' ') this.doBoost(p);
        if (key === 'e') this.drop(p);
    }
    handleKeyUp(id, key) {
        const p = this.players[id]; if (!p || typeof key !== 'string') return;
        delete p.keys[key.toLowerCase()]; if (key.toLowerCase() === 'e') p.dropLock = false;
    }
    doBoost(p) {
        if (this.phase !== 'playing' || p.cooldown > 0 || p.stun > 0) return;
        p.boost = .32; p.cooldown = RULES.boostCooldown;
        this.burst(p.x, p.y, p.color, 5, 7);
    }
    detach(p) {
        if (p.cargo) p.cargo.owners.delete(p.id);
        p.cargo = null; p.nodes.rope.node.coordinates2d = HIDDEN;
    }
    drop(p) {
        if (this.phase !== 'playing' || p.dropLock) return;
        p.dropLock = true; this.detach(p); p.latchDelay = 1.3;
    }

    physics(dt) {
        const pilots = Object.values(this.players);
        for (const p of pilots) {
            for (const k of Object.keys(p.keys)) if (this.clock - p.keys[k] > .35) delete p.keys[k];
            p.cooldown = Math.max(0, p.cooldown - dt); p.boost = Math.max(0, p.boost - dt);
            p.grace = Math.max(0, p.grace - dt); p.stun = Math.max(0, p.stun - dt); p.latchDelay = Math.max(0, p.latchDelay - dt);
            let dx = 0, dy = 0;
            if (p.target) { dx = p.target.x - p.x; dy = p.target.y - p.y; }
            else {
                dx = (p.keys.d !== undefined || p.keys.arrowright !== undefined ? 1 : 0) - (p.keys.a !== undefined || p.keys.arrowleft !== undefined ? 1 : 0);
                dy = (p.keys.s !== undefined || p.keys.arrowdown !== undefined ? 1 : 0) - (p.keys.w !== undefined || p.keys.arrowup !== undefined ? 1 : 0);
            }
            const distance = length(dx, dy), active = distance > .2;
            const speed = p.boost > 0 ? RULES.boostSpeed : RULES.speed;
            const desired = active ? (p.target ? Math.min(speed, distance * 3.2) : speed) : 0;
            const ux = active ? dx / distance : Math.cos(p.a), uy = active ? dy / distance : Math.sin(p.a);
            if (active) p.a = Math.atan2(dy, dx);
            if (p.stun <= 0) {
                const targetSpeed = p.boost > 0 ? speed : desired;
                p.vx += clamp((ux * targetSpeed - p.vx) * 5.5, -95, 95) * dt;
                p.vy += clamp((uy * targetSpeed - p.vy) * 5.5, -95, 95) * dt;
            } else { p.vx *= Math.exp(-2 * dt); p.vy *= Math.exp(-2 * dt); }
            p.thrust = desired;
            if (!p.cargo && p.latchDelay <= 0 && p.stun <= 0) {
                let nearest = null, best = RULES.latchRadius;
                for (const c of this.cargo) {
                    const d = length(p.x - c.x, p.y - c.y);
                    const latchRange = c.heart ? 8 : RULES.latchRadius;
                    if (c.active && d < latchRange && d < best + (c.heart ? 3 : 0) && c.owners.size < (c.heart ? 6 : 3)) { nearest = c; best = d; }
                }
                if (nearest) {
                    p.cargo = nearest; nearest.owners.add(p.id); nearest.touched.add(p.id);
                    this.burst(p.x, p.y, p.color, 4, 4);
                    if (nearest.owners.size === 2) this.announce('TEAM TOW!  BIG HAUL, LITTLE SHIPS', 2.8);
                }
            }
        }
        // Spring tethers: force acts on BOTH bodies. Multiple pilots add their forces.
        for (const p of pilots) {
            const c = p.cargo; if (!c || !c.active) continue;
            const dx = p.x - c.x, dy = p.y - c.y, d = length(dx, dy);
            if (d > RULES.snapLength + (c.heart ? 3 : 0)) {
                this.detach(p); p.latchDelay = .8; this.burst(p.x, p.y, C.cream, 5, 5); continue;
            }
            const rest = c.heart ? 6.5 : RULES.ropeLength;
            if (d > rest) {
                const ux = dx / d, uy = dy / d;
                const radialVelocity = (p.vx - c.vx) * ux + (p.vy - c.vy) * uy;
                const force = clamp((d - rest) * 30 + radialVelocity * 3.2, 0, 130);
                c.vx += ux * force / c.mass * dt; c.vy += uy * force / c.mass * dt;
                p.vx -= ux * force * .32 * dt; p.vy -= uy * force * .32 * dt;
            }
        }
        for (const p of pilots) {
            p.x += p.vx * dt; p.y += p.vy * dt;
            if (p.x < 5 || p.x > 95) { p.x = clamp(p.x, 5, 95); p.vx *= -.4; }
            if (p.y < 17 || p.y > 80) { p.y = clamp(p.y, 17, 80); p.vy *= -.4; }
        }
        for (const c of this.cargo) {
            if (!c.active) continue;
            c.vx *= Math.exp(-1.1 * dt); c.vy *= Math.exp(-1.1 * dt);
            c.x += c.vx * dt; c.y += c.vy * dt; c.angle += c.spin * dt;
            if (c.x < 5 || c.x > 95) { c.x = clamp(c.x, 5, 95); c.vx *= -.6; }
            if (c.y < 16 || c.y > 81) { c.y = clamp(c.y, 16, 81); c.vy *= -.6; }
            if (length(c.x - HOME.x, c.y - HOME.y) < RULES.dockRadius && c.touched.size) this.deliver(c);
            this.drawCargo(c);
        }
        // Passing debris bumps you; it never removes a player from the round.
        for (const h of this.hazards) {
            h.a += h.speed * dt * (1 + this.energy * .035);
            h.x = 50 + Math.cos(h.a) * h.r; h.y = 48 + Math.sin(h.a) * h.r * .85;
            const a = h.a + (h.speed > 0 ? Math.PI / 2 : -Math.PI / 2);
            h.node.node.coordinates2d = localPoly(h.x, h.y, a, [[2.2, 0], [-1.5, -1.4], [-.8, 0], [-1.5, 1.4]]);
            h.core.node.coordinates2d = poly(h.x, h.y, .4, 3, a);
            h.trail.node.coordinates2d = line(h.x, h.y, h.x - Math.cos(a) * 4.8, h.y - Math.sin(a) * 4.8, .25);
            for (const p of pilots) {
                if (p.grace > 0 || length(p.x - h.x, p.y - h.y) > h.size + 1.3) continue;
                const a2 = Math.atan2(p.y - h.y, p.x - h.x);
                p.vx = Math.cos(a2) * 14; p.vy = Math.sin(a2) * 14;
                p.grace = 1.8; p.stun = .4; p.latchDelay = .8; this.detach(p);
                this.burst(p.x, p.y, C.orange, 9, 10);
            }
        }
    }

    deliver(c) {
        if (!c.active || this.phase !== 'playing') return;
        c.active = false; this.deliveries++;
        const attached = Array.from(c.owners);
        if (c.touched.size > 1) this.assists++;
        for (const id of c.touched) if (this.players[id]) this.players[id].hauled++;
        attached.forEach(id => { const p = this.players[id]; if (p) { this.detach(p); p.latchDelay = .5; } });
        this.world.removeChild(c.group.id);
        this.energy = Math.min(RULES.goal, this.energy + c.value);
        this.burst(c.x, c.y, C.gold, 12, 13); this.burst(50, 48, C.mint, 8, 10);
        this.drawHome();
        const milestones = this.energy >= 9 ? 'A LITTLE GARDEN. A BIG REASON TO STAY.' : this.energy >= 6 ? 'THE GARDEN IS GROWING' : this.energy >= 3 ? 'NOW THAT’S A HOME' : 'THE LIGHTS ARE ON';
        this.announce('+' + c.value + ' HOME POWER  /  ' + milestones, 3.5);
        if (c.heart) this.finish(true);
        else if (this.energy >= RULES.goal && !this.finalHaul) this.launchHeart();
    }
    launchHeart() {
        this.finalHaul = true;
        for (const p of Object.values(this.players)) this.detach(p);
        for (const c of this.cargo) if (c.active) { c.active = false; this.world.removeChild(c.group.id); }
        this.addCargo(50, 20, 0, 100, true);
        this.burst(50, 20, C.gold, 16, 16);
        this.announce('ONE LAST HAUL!  BRING THE BIG HEART HOME', 8);
    }
    drawCargo(c) {
        if (!c.active) return;
        c.shadow.node.coordinates2d = poly(c.x, c.y + .55, c.r, 6, c.angle);
        c.node.node.coordinates2d = poly(c.x, c.y, c.r, 6, c.angle);
        c.facet.node.coordinates2d = closed([[c.x, c.y], ...poly(c.x, c.y, c.r, 6, c.angle).slice(2, 5)]);
        c.face.node.coordinates2d = poly(c.x, c.y, c.r * .56, 6, c.angle);
        c.label.node.text = { ...c.label.node.text, x: c.x, y: c.y - .75 };
    }
    drawPlayers() {
        for (const p of Object.values(this.players)) {
            this.renderShip(p.nodes, p.x, p.y, p.a, p.thrust || 0, p.boost > 0, p.stun > 0 ? C.cream : p.color);
            p.nodes.rope.node.coordinates2d = p.cargo ? line(p.x, p.y, p.cargo.x, p.cargo.y, .24 + (p.boost > 0 ? .10 : 0)) : HIDDEN;
            p.marker.node.text = { ...p.marker.node.text, x: p.x, y: p.y - 3.4 };
            this.setText(p.status, CREW[p.slot].name + (p.cargo ? (p.cargo.heart ? '  /  HEART CREW' : '  /  TOWING +' + p.cargo.value) : '  /  READY TO TOW'));
            this.setText(p.hint, p.cargo ? 'TAKE IT HOME / SPACE = BOOST' : 'TAP TO FLY / GET CLOSE TO LATCH');
            p.boostButton.node.fill = p.cooldown > 0 ? C.line : p.color;
            p.boostBar.node.coordinates2d = ShapeUtils.rectangle(76, 97.8, 20 * (1 - p.cooldown / RULES.boostCooldown), .6);
        }
    }
    burst(x, y, color, count, speed) {
        for (const p of this.particles) {
            if (count <= 0) break; if (p.life > 0) continue;
            count--; const a = this.rand() * TAU;
            p.x = x; p.y = y; p.vx = Math.cos(a) * speed * (.3 + this.rand()); p.vy = Math.sin(a) * speed * (.3 + this.rand());
            p.life = p.max = .45 + this.rand() * .55; p.size = .17 + this.rand() * .35; p.angle = a;
            p.node.node.fill = color;
        }
    }
    updateParticles(dt) {
        for (const p of this.particles) {
            if (p.life <= 0) continue;
            p.life -= dt;
            p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .96; p.vy *= .96;
            p.node.node.coordinates2d = p.life > 0 && p.x > 1 && p.x < 99 && p.y > 12 && p.y < 85 ? poly(p.x, p.y, p.size * Math.min(1, p.life * 3), 3, p.angle + this.clock) : HIDDEN;
            p.node.node.color = [255, 255, 255, Math.round(255 * clamp(p.life / p.max, 0, 1))];
        }
    }

    finish(won) {
        if (this.phase !== 'playing') return;
        this.phase = won ? 'won' : 'lost'; this.endAt = this.clock;
        if (won) this.drawHome();
        Object.values(this.players).forEach(p => { this.detach(p); p.keys = {}; p.target = null; });
        if (won) {
            this.record.homes++; this.record.bestSeconds = Math.min(this.record.bestSeconds, Math.ceil(this.elapsed));
            if (this.saveGame) {
                try { const result = this.saveGame({ ...this.record }); if (result && typeof result.catch === 'function') result.catch(() => {}); } catch (_) { /* A full browser store must not end the celebration. */ }
            }
        }
        this.overlay.clearChildren(); const o = this.overlay;
        this.put(o, this.rect(4, 15, 92, 22, C.deep));
        this.put(o, this.text(won ? 'LOOK WHAT WE MADE.' : 'WE’LL GET THERE.', 50, 18, 4.4, won ? C.mint : C.orange, 'center'));
        this.put(o, this.text(won ? 'A LITTLE HOME. A VERY GOOD CREW.' : 'THE STORM CAUGHT UP. EVERY HAUL COUNTED.', 50, 25, 1.7, C.cream, 'center'));
        this.put(o, this.text(won ? 'POWERED UP IN ' + this.formatTime(this.elapsed) : this.finalHaul ? 'THE LIGHTS ARE ON. THE HEART IS STILL OUT THERE.' : this.energy + ' OF 12 LIGHTS ARE ON', 50, 30, this.finalHaul && !won ? 1.45 : 2, C.gold, 'center'));
        this.put(o, this.rect(4, 65, 92, 33, C.deep));
        const stats = this.deliveries + ' HAULS  /  ' + this.assists + ' SHARED TOWS  /  ' + Object.keys(this.players).length + ' PILOT(S)';
        this.put(o, this.text(stats, 50, 69, 1.6, C.muted, 'center'));
        if (won) this.put(o, this.text('HOMES BUILT: ' + this.record.homes + '   BEST: ' + this.formatTime(this.record.bestSeconds), 50, 73, 1.5, C.cream, 'center'));
        else this.put(o, this.text('TIP: BIG PODS LIGHT MORE WINDOWS. PULL WITH FRIENDS.', 50, 73, 1.35, C.cream, 'center'));
        this.button(o, won ? 'ONE MORE EXPEDITION  >' : 'GIVE IT ANOTHER TUG  >', 12, 80, 76, 9, C.mint, id => this.start(id));
        this.put(o, this.text('SAME CREW. NEW POSSIBILITIES.', 50, 93, 1.2, C.muted, 'center'));
        this.dirty();
    }
    formatTime(seconds) {
        const n = Math.max(0, Math.ceil(seconds)); return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
    }
    tick() {
        const dt = 1 / RULES.tickRate; this.clock += dt;
        if (this.phase === 'title') {
            const a = this.clock * .55, x = 76 + Math.cos(a) * 8, y = 50 + Math.sin(a) * 6;
            this.renderShip(this.hero, x, y, a + Math.PI / 2, 1, false, C.orange);
            this.heroCargo.node.coordinates2d = poly(77, 55, 3, 6, this.clock * .17);
            this.hero.rope.node.coordinates2d = line(x, y, 77, 55, .25);
            this.renderShip(this.hero2, 91 + Math.cos(a + 1) * 3, 46 + Math.sin(a + 1) * 4, a + 2.6, 1, false, C.mint);
        } else if (this.phase === 'playing') {
            if (Object.keys(this.players).length > 0) {
                this.elapsed += dt; this.physics(dt);
                if (this.elapsed >= RULES.seconds && this.phase === 'playing') this.finish(false);
            }
            this.setText(this.homeScore, this.finalHaul ? 'THE HEART' : this.energy + ' / ' + RULES.goal);
            this.setText(this.timeLabel, this.formatTime(RULES.seconds - this.elapsed), this.elapsed > RULES.seconds - 30 ? C.orange : C.cream);
            this.setText(this.crewLabel, Object.keys(this.players).length + ' PILOT(S)  /  JOIN ANYTIME');
            this.meter.node.coordinates2d = ShapeUtils.rectangle(0, 10.5, 100 * this.energy / RULES.goal, .5);
            if (this.clock > this.bannerUntil) {
                const hint = this.finalHaul ? 'EVERYONE CAN LATCH ON. BRING THE HEART HOME.' : this.elapsed < 20 ? 'GOLD IS CARGO. CORAL IS TROUBLE. HOME IS THE MIDDLE.' : this.elapsed < 70 ? 'TOW TOGETHER. BOOST TOGETHER. BUILD SOMETHING.' : 'HEAVY PODS ARE EASIER WITH A FRIEND';
                this.setText(this.banner, hint, C.muted);
            }
            this.drawPlayers();
        } else if (this.phase === 'won') {
            if (Math.floor(this.clock * 3) !== Math.floor((this.clock - dt) * 3)) this.burst(50 + (this.rand() - .5) * 45, 40 + this.rand() * 18, this.rand() > .5 ? C.mint : C.gold, 6, 7);
        }
        this.updateParticles(dt); this.dirty();
    }
}

module.exports = TugClub;
