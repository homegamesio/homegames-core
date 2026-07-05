const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-142');

const TICK_RATE = 20;

// Landscape canvas: text size scales with canvas width, so a size-s line is
// roughly s * (16/9) tall in y units.
const TEXT_H = 16 / 9;

// Coordinate subframes cap out around 126 vertices on the wire, so the terrain
// silhouette must stay under that (96 columns -> 100-vertex polygon).
const COLS = 96;
const COL_W = 100 / COLS;
const TERRAIN_MIN = 45;
const TERRAIN_MAX = 88;
const TERRAIN_FLOOR = 94;

const SUBSTEPS = 3;
const GRAVITY = 0.0115;
const MAX_HP = 100;
const TURN_SECONDS = 45;
const CRATER_RADIUS = 5.5;

const MIN_TANKS = 2;
const MAX_TANKS = 4;

const PALETTE = [
    { name: 'CYAN', color: [0, 255, 255, 255] },
    { name: 'MAGENTA', color: [255, 0, 255, 255] },
    { name: 'LIME', color: [57, 255, 20, 255] },
    { name: 'ORANGE', color: [255, 140, 0, 255] }
];

// Sunset silhouette theme: purple dusk sky, black hills with an ember rim
const SKY = [43, 16, 58, 255];
const HORIZON = [96, 34, 66, 255];
const EARTH = [22, 13, 25, 255];
const GRASS = [255, 122, 48, 255];
const ACCENT = [255, 150, 60, 255];
const INK = [255, 240, 230, 255];
const FAINT = [175, 140, 170, 255];
const GOLD = [255, 210, 90, 255];

const glow = (color, blur) => ({ shadow: { color: [color[0], color[1], color[2], 255], blur } });
const light = (color, f) => [
    Math.round(color[0] + (255 - color[0]) * f),
    Math.round(color[1] + (255 - color[1]) * f),
    Math.round(color[2] + (255 - color[2]) * f),
    255
];

const shuffled = (list) => {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

class KaboomValley extends Game {
    static metadata() {
        return {
            aspectRatio: { x: 16, y: 9 },
            squishVersion: '142',
            author: 'Joseph Garcia',
            name: 'Kaboom Valley',
            description: 'Turn-based artillery on procedurally generated, fully destructible terrain. Aim, mind the wind, and blast your friends off the hillside.',
            tickRate: TICK_RATE
        };
    }

    constructor() {
        super();

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: SKY
        });

        this.buildSky();

        this.terrainNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 70, 100, 30),
            fill: EARTH
        });
        this.grassNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 70, 100, 1.3),
            fill: GRASS,
            effects: glow(GRASS, 4)
        });
        this.base.addChildren(this.terrainNode, this.grassNode);

        this.world = this.makeContainer();
        this.particleLayer = this.makeContainer();
        this.hud = this.makeContainer();
        this.controls = this.makeContainer();
        this.overlay = this.makeContainer();
        this.base.addChildren(this.world, this.particleLayer, this.hud, this.controls, this.overlay);

        this.players = {};
        this.tanks = [];
        this.pendingJoins = [];
        this.particles = [];
        this.transients = [];
        this.heights = new Array(COLS + 1).fill(70);
        this.tickCount = 0;
        this.projectile = null;

        this.showLobby();
    }

    makeContainer() {
        // Zero-size rect: full-screen containers swallow clicks for everything
        // drawn beneath them (the server hit-test picks the topmost containing
        // node whether or not it is clickable).
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });
    }

    buildSky() {
        this.base.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 34, 100, 30),
            fill: HORIZON
        }), false);

        for (let i = 0; i < 40; i++) {
            const size = 0.15 + Math.random() * 0.25;
            this.base.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(Math.random() * 99, Math.random() * 34, size, size * TEXT_H),
                fill: [255, 225, 195, 255],
                color: [255, 255, 255, 90 + Math.floor(Math.random() * 140)]
            }), false);
        }

        const sunColor = [255, 170, 90, 255];
        const sun = [];
        for (let i = 0; i <= 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            sun.push([
                Math.round((76 + Math.cos(a) * 6) * 100) / 100,
                Math.round((22 + Math.sin(a) * 6 * TEXT_H) * 100) / 100
            ]);
        }
        this.base.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: sun,
            fill: sunColor,
            effects: glow(sunColor, 30)
        }), false);
    }

    makeGlowText(text, x, y, size, color, glowColor, playerIds) {
        const gc = glowColor || color;
        const offsets = [[-0.25, 0], [0.25, 0], [0, -0.15], [0, 0.15]];
        const nodes = offsets.map(o => new GameNode.Text({
            textInfo: { x: x + o[0], y: y + o[1], text, size, align: 'center', font: 'monospace', color: [gc[0], gc[1], gc[2], 140] },
            playerIds
        }));
        nodes.push(new GameNode.Text({
            textInfo: { x, y, text, size, align: 'center', font: 'monospace', color },
            playerIds
        }));
        return nodes;
    }

    centeredTextY(y, h, size) {
        return y + (h - size * TEXT_H) / 2;
    }

    makeButton(label, x, y, w, h, color, onClick, playerIds, size) {
        const textSize = size || 2;
        const button = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, w, h),
            fill: [32, 13, 38, 255],
            color,
            border: 8,
            effects: glow(color, 8),
            onClick,
            playerIds
        });
        button.addChild(new GameNode.Text({
            textInfo: { x: x + w / 2, y: this.centeredTextY(y, h, textSize), text: label, size: textSize, align: 'center', font: 'monospace', color },
            playerIds
        }), false);
        return button;
    }

    setNodePlayerIds(node, playerIds) {
        node.node.playerIds = playerIds;
        node.node.children.forEach(child => this.setNodePlayerIds(child, playerIds));
    }

    addTransient(nodes, ticks, parent) {
        const target = parent || this.overlay;
        nodes.forEach(n => target.addChild(n, false));
        this.transients.push({ nodes, ticks, parent: target });
    }

    playerName(playerId) {
        return String((this.players[playerId] && this.players[playerId].name) || ('PLAYER ' + playerId)).toUpperCase().slice(0, 8);
    }

    // --- terrain ---

    generateTerrain() {
        const a1 = 10 + Math.random() * 6;
        const a2 = 5 + Math.random() * 4;
        const a3 = 2 + Math.random() * 2;
        const f1 = 0.03 + Math.random() * 0.025;
        const f2 = 0.08 + Math.random() * 0.05;
        const f3 = 0.2 + Math.random() * 0.1;
        const p1 = Math.random() * Math.PI * 2;
        const p2 = Math.random() * Math.PI * 2;
        const p3 = Math.random() * Math.PI * 2;
        for (let i = 0; i <= COLS; i++) {
            const h = 66 + a1 * Math.sin(i * f1 + p1) + a2 * Math.sin(i * f2 + p2) + a3 * Math.sin(i * f3 + p3);
            this.heights[i] = Math.min(TERRAIN_MAX, Math.max(TERRAIN_MIN, Math.round(h * 100) / 100));
        }
    }

    surfaceYAt(x) {
        const col = Math.max(0, Math.min(COLS - 0.001, x / COL_W));
        const i = Math.floor(col);
        const frac = col - i;
        return this.heights[i] * (1 - frac) + this.heights[i + 1] * frac;
    }

    flattenPad(x, halfWidth) {
        const y = this.surfaceYAt(x);
        const from = Math.max(0, Math.floor((x - halfWidth) / COL_W));
        const to = Math.min(COLS, Math.ceil((x + halfWidth) / COL_W));
        for (let i = from; i <= to; i++) {
            this.heights[i] = y;
        }
        return y;
    }

    carveCrater(cx, cy, radius) {
        const from = Math.max(0, Math.floor((cx - radius) / COL_W));
        const to = Math.min(COLS, Math.ceil((cx + radius) / COL_W));
        for (let i = from; i <= to; i++) {
            const dx = i * COL_W - cx;
            if (Math.abs(dx) <= radius) {
                const dip = cy + Math.sqrt(radius * radius - dx * dx);
                if (dip > this.heights[i]) {
                    this.heights[i] = Math.min(TERRAIN_FLOOR, Math.round(dip * 100) / 100);
                }
            }
        }
        this.redrawTerrain();
    }

    redrawTerrain() {
        const surface = [];
        for (let i = 0; i <= COLS; i++) {
            surface.push([Math.round(i * COL_W * 100) / 100, this.heights[i]]);
        }

        const terrain = [[0, 100]].concat(surface, [[100, 100], [0, 100]]);
        this.terrainNode.node.coordinates2d = terrain;

        // The grass strip doubles the vertex count (top + bottom edge), so it
        // samples every other column to stay under the wire-format cap.
        const grassTop = surface.filter((point, i) => i % 2 === 0 || i === COLS);
        const grassBottom = grassTop.slice().reverse().map(([x, y]) => [x, Math.min(100, y + 1.3)]);
        this.grassNode.node.coordinates2d = grassTop.concat(grassBottom, [grassTop[0]]);
    }

    // --- lobby ---

    showLobby() {
        this.phase = 'lobby';
        this.tanks = [];
        this.pendingJoins = [];
        this.particles = [];
        this.transients = [];
        this.projectile = null;

        this.world.clearChildren();
        this.particleLayer.clearChildren();
        this.hud.clearChildren();
        this.controls.clearChildren();
        this.overlay.clearChildren();

        this.generateTerrain();
        this.redrawTerrain();

        const title = this.makeGlowText('KABOOM VALLEY', 50, 10, 5.5, INK, [255, 140, 0, 255]);
        this.titleHalos = title.slice(0, 4);
        title.forEach(n => this.overlay.addChild(n, false));

        this.overlay.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 22, text: 'ARTILLERY ON DESTRUCTIBLE HILLS', size: 1.7, align: 'center', font: 'monospace', color: FAINT }
        }), false);

        this.lobbyRow = this.makeContainer();
        this.overlay.addChild(this.lobbyRow, false);

        this.joinButton = this.makeButton('JOIN', 30, 48, 18, 8, ACCENT, (playerId) => {
            if (this.phase !== 'lobby' || this.tankFor(playerId) || this.tanks.length >= MAX_TANKS) {
                return;
            }
            this.addTank(playerId);
            this.updateLobbyUi();
        });
        this.startButton = this.makeButton('START', 52, 48, 18, 8, [57, 255, 20, 255], (playerId) => {
            if (this.phase !== 'lobby' || !this.tankFor(playerId)) {
                return;
            }
            this.startMatch();
        });
        this.overlay.addChildren(this.joinButton, this.startButton);

        const lines = [
            'AIM WITH THE BUTTONS OR ARROW KEYS - SPACE OR FIRE TO SHOOT',
            'SHOTS CARVE REAL CRATERS - WATCH THE WIND - LAST TANK WINS',
            'A BOT ROLLS IN IF YOU ARE ALONE'
        ];
        lines.forEach((text, i) => this.overlay.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 62 + i * 4, text, size: 1.3, align: 'center', font: 'monospace', color: FAINT }
        }), false));

        this.updateLobbyUi();
    }

    updateLobbyUi() {
        if (this.phase !== 'lobby') {
            return;
        }
        this.lobbyRow.clearChildren();
        if (this.tanks.length === 0) {
            this.lobbyRow.addChild(new GameNode.Text({
                textInfo: { x: 50, y: 34, text: 'NO TANKS DEPLOYED - TAP JOIN', size: 1.6, align: 'center', font: 'monospace', color: FAINT }
            }), false);
        } else {
            const startX = 50 - this.tanks.length * 7;
            this.tanks.forEach((tank, i) => {
                const x = startX + i * 14;
                this.lobbyRow.addChild(new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(x + 4.6, 31, 3, 3 * TEXT_H),
                    fill: tank.color,
                    color: [255, 255, 255, 255],
                    effects: glow(tank.color, 8)
                }), false);
                this.lobbyRow.addChild(new GameNode.Text({
                    textInfo: { x: x + 6, y: 36, text: tank.name, size: 1.3, align: 'center', font: 'monospace', color: INK }
                }), false);
                if (tank.playerId !== null) {
                    // frameless sessions have no chrome showing your name, so
                    // each player gets a private marker on their own entry
                    this.lobbyRow.addChild(new GameNode.Text({
                        textInfo: { x: x + 6, y: 38.8, text: 'YOU', size: 1, align: 'center', font: 'monospace', color: GOLD },
                        playerIds: [tank.playerId]
                    }), false);
                }
            });
        }

        const connected = Object.keys(this.players).map(Number);
        const joined = this.tanks.filter(t => t.playerId !== null).map(t => t.playerId);
        const unjoined = connected.filter(pid => joined.indexOf(pid) === -1);
        this.setNodePlayerIds(this.joinButton, unjoined.length ? unjoined : [0]);
        this.setNodePlayerIds(this.startButton, joined.length ? joined : [0]);
        this.base.node.onStateChange();
    }

    tankFor(playerId) {
        return this.tanks.find(t => t.playerId === playerId) || null;
    }

    addTank(playerId) {
        if (this.tanks.length >= MAX_TANKS) {
            return null;
        }
        const used = new Set(this.tanks.map(t => t.colorIndex));
        const colorIndex = PALETTE.findIndex((c, i) => !used.has(i));
        const isBot = playerId === null;
        const tank = {
            colorIndex,
            color: PALETTE[colorIndex].color,
            name: isBot ? PALETTE[colorIndex].name + ' BOT' : this.playerName(playerId),
            playerId: isBot ? null : playerId,
            isBot,
            wins: 0,
            hp: MAX_HP,
            alive: false,
            x: 50,
            y: 50,
            angle: 60,
            power: 55,
            nodes: null
        };
        this.tanks.push(tank);
        return tank;
    }

    startMatch() {
        while (this.tanks.length < MIN_TANKS) {
            this.addTank(null);
        }
        this.resetRound();
    }

    // --- round setup ---

    resetRound() {
        this.pendingJoins.forEach(pid => {
            if (this.players[pid] && !this.tankFor(pid)) {
                this.addTank(pid);
            }
        });
        this.pendingJoins = [];

        this.phase = 'playing';
        this.turnPhase = 'aim';
        this.particles = [];
        this.transients = [];
        this.projectile = null;

        this.world.clearChildren();
        this.particleLayer.clearChildren();
        this.controls.clearChildren();
        this.overlay.clearChildren();

        this.generateTerrain();

        const spread = 76 / Math.max(1, this.tanks.length - 1);
        const order = shuffled(this.tanks);
        order.forEach((tank, i) => {
            tank.alive = true;
            tank.hp = MAX_HP;
            tank.fallTarget = null;
            tank.fallStart = null;
            tank.x = Math.round((12 + i * spread + (Math.random() * 6 - 3)) * 100) / 100;
            tank.x = Math.max(6, Math.min(94, tank.x));
            tank.y = this.flattenPad(tank.x, 2.4);
            tank.angle = tank.x > 50 ? 120 : 60;
            tank.power = 55;
        });

        this.redrawTerrain();
        this.tanks.forEach(tank => this.buildTankNodes(tank));

        this.turnOrder = order;
        this.turnIndex = -1;
        this.rebuildHud();
        this.nextTurn();
    }

    buildTankNodes(tank) {
        const body = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: this.tankBodyRect(tank),
            fill: tank.color,
            color: [255, 255, 255, 255],
            effects: glow(tank.color, 10)
        });
        const barrel = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: this.barrelQuad(tank),
            fill: light(tank.color, 0.5),
            color: [255, 255, 255, 255]
        });
        const hpBack = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(tank.x - 2.2, tank.y - 5.2, 4.4, 0.8),
            fill: [30, 32, 60, 255]
        });
        const hpFill = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(tank.x - 2.2, tank.y - 5.2, 4.4, 0.8),
            fill: [90, 230, 120, 255]
        });
        tank.nodes = { body, barrel, hpBack, hpFill };
        this.world.addChildren(body, barrel, hpBack, hpFill);
    }

    tankBodyRect(tank) {
        return ShapeUtils.rectangle(tank.x - 1.7, tank.y - 2, 3.4, 2);
    }

    barrelQuad(tank) {
        const rad = tank.angle * Math.PI / 180;
        const dirX = Math.cos(rad);
        const dirY = -Math.sin(rad);
        const px = -dirY * 0.3;
        const py = dirX * 0.3;
        const baseX = tank.x;
        const baseY = tank.y - 2;
        const tipX = baseX + dirX * 3.2;
        const tipY = baseY + dirY * 3.2 * TEXT_H;
        return [
            [baseX + px, baseY + py],
            [tipX + px, tipY + py],
            [tipX - px, tipY - py],
            [baseX - px, baseY - py],
            [baseX + px, baseY + py]
        ];
    }

    refreshTankNodes(tank) {
        if (!tank.nodes) {
            return;
        }
        tank.nodes.body.node.coordinates2d = this.tankBodyRect(tank);
        tank.nodes.barrel.node.coordinates2d = this.barrelQuad(tank);
        tank.nodes.hpBack.node.coordinates2d = ShapeUtils.rectangle(tank.x - 2.2, tank.y - 5.2, 4.4, 0.8);
        const frac = Math.max(0, tank.hp / MAX_HP);
        tank.nodes.hpFill.node.coordinates2d = ShapeUtils.rectangle(tank.x - 2.2, tank.y - 5.2, 4.4 * frac, 0.8);
        tank.nodes.hpFill.node.fill = frac > 0.5 ? [90, 230, 120, 255] : (frac > 0.25 ? [255, 191, 0, 255] : [240, 80, 80, 255]);
    }

    removeTankNodes(tank) {
        if (!tank.nodes) {
            return;
        }
        Object.values(tank.nodes).forEach(n => this.world.removeChild(n.id, false));
        tank.nodes = null;
    }

    rebuildHud() {
        this.hud.clearChildren();
        if (this.phase === 'lobby') {
            return;
        }
        this.tanks.forEach((tank, i) => {
            const x = 2 + i * 17;
            const alpha = tank.alive ? 255 : 80;
            this.hud.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(x, 2, 1.6, 1.6 * TEXT_H),
                fill: tank.color,
                color: [255, 255, 255, alpha]
            }), false);
            this.hud.addChild(new GameNode.Text({
                textInfo: { x: x + 2.4, y: 1.8, text: tank.name, size: 1.2, font: 'monospace', color: [230, 235, 255, alpha] }
            }), false);
            this.hud.addChild(new GameNode.Text({
                textInfo: { x: x + 2.4, y: 4.6, text: 'HP ' + Math.max(0, Math.round(tank.hp)) + '  ★ ' + tank.wins, size: 1.1, font: 'monospace', color: [255, 215, 90, alpha] }
            }), false);
            if (tank.playerId !== null) {
                this.hud.addChild(new GameNode.Text({
                    textInfo: { x: x + 2.4, y: 6.9, text: 'YOU', size: 0.9, font: 'monospace', color: GOLD },
                    playerIds: [tank.playerId]
                }), false);
            }
        });
    }

    // --- turns ---

    nextTurn() {
        const alive = this.turnOrder.filter(t => t.alive);
        if (alive.length <= 1) {
            this.endRound(alive[0] || null);
            return;
        }

        for (let step = 1; step <= this.turnOrder.length; step++) {
            const candidate = this.turnOrder[(this.turnIndex + step) % this.turnOrder.length];
            if (candidate.alive) {
                this.turnIndex = this.turnOrder.indexOf(candidate);
                break;
            }
        }

        this.turnPhase = 'aim';
        this.turnTicksLeft = TURN_SECONDS * TICK_RATE;
        this.wind = Math.round((Math.random() * 8 - 4)) / 1000;
        this.activeTank = this.turnOrder[this.turnIndex];

        if (this.activeTank.isBot) {
            this.botThinkTicks = TICK_RATE;
        } else {
            this.botThinkTicks = null;
        }

        this.renderTurnUi();
    }

    renderTurnUi() {
        this.controls.clearChildren();
        const tank = this.activeTank;

        const windStrength = Math.round(Math.abs(this.wind) * 1000);
        const windText = windStrength === 0 ? 'WIND CALM'
            : 'WIND ' + (this.wind > 0 ? '→ ' : '← ') + windStrength;
        this.turnBanner = new GameNode.Text({
            textInfo: { x: 50, y: 2, text: tank.name + "'S TURN", size: 1.8, align: 'center', font: 'monospace', color: tank.color }
        });
        this.windText = new GameNode.Text({
            textInfo: { x: 50, y: 6, text: windText, size: 1.4, align: 'center', font: 'monospace', color: FAINT }
        });
        this.timerText = new GameNode.Text({
            textInfo: { x: 50, y: 9.5, text: String(TURN_SECONDS), size: 1.4, align: 'center', font: 'monospace', color: GOLD }
        });
        this.controls.addChildren(this.turnBanner, this.windText, this.timerText);

        if (tank.isBot) {
            return;
        }

        const pid = [tank.playerId];

        this.controls.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 12.5, text: 'YOUR TURN', size: 1.5, align: 'center', font: 'monospace', color: GOLD },
            playerIds: pid
        }), false);

        const y = 90;
        this.controls.addChild(this.makeButton('ANG-', 2, y, 8, 7, ACCENT, () => this.adjustAim(-2, 0), pid, 1.5), false);
        this.controls.addChild(this.makeButton('ANG+', 11, y, 8, 7, ACCENT, () => this.adjustAim(2, 0), pid, 1.5), false);
        this.controls.addChild(this.makeButton('PWR-', 20, y, 8, 7, [255, 0, 255, 255], () => this.adjustAim(0, -2), pid, 1.5), false);
        this.controls.addChild(this.makeButton('PWR+', 29, y, 8, 7, [255, 0, 255, 255], () => this.adjustAim(0, 2), pid, 1.5), false);

        this.aimReadout = new GameNode.Text({
            textInfo: { x: 52, y: this.centeredTextY(y, 7, 1.6), text: '', size: 1.6, align: 'center', font: 'monospace', color: INK },
            playerIds: pid
        });
        this.controls.addChild(this.aimReadout, false);

        this.controls.addChild(this.makeButton('FIRE', 78, y, 14, 7, [255, 80, 80, 255], (playerId) => {
            if (playerId === tank.playerId) {
                this.fire();
            }
        }, pid, 2.2), false);

        this.aimDots = [];
        for (let i = 0; i < 7; i++) {
            const dot = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, 0, 0.5, 0.5 * TEXT_H),
                fill: light(tank.color, 0.3),
                color: [255, 255, 255, 150],
                playerIds: pid
            });
            this.aimDots.push(dot);
            this.controls.addChild(dot, false);
        }
        this.updateAimUi();
    }

    adjustAim(angleDelta, powerDelta) {
        if (this.turnPhase !== 'aim' || this.activeTank.isBot) {
            return;
        }
        const tank = this.activeTank;
        tank.angle = Math.max(10, Math.min(170, tank.angle + angleDelta));
        tank.power = Math.max(20, Math.min(100, tank.power + powerDelta));
        this.updateAimUi();
        this.base.node.onStateChange();
    }

    updateAimUi() {
        const tank = this.activeTank;
        if (this.aimReadout) {
            this.aimReadout.node.text.text = Math.round(tank.angle) + '° PWR ' + Math.round(tank.power);
        }
        this.refreshTankNodes(tank);

        if (this.aimDots) {
            const preview = this.simulatePath(tank, tank.angle, tank.power, 36);
            this.aimDots.forEach((dot, i) => {
                const point = preview[Math.min(preview.length - 1, (i + 1) * 5)];
                if (point && point[1] > 0.5) {
                    dot.node.coordinates2d = ShapeUtils.rectangle(point[0], point[1], 0.5, 0.5 * TEXT_H);
                } else {
                    dot.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0.01, 0.01);
                }
            });
        }
    }

    // --- ballistics ---

    launchVelocity(tank, angle, power) {
        const rad = angle * Math.PI / 180;
        const speed = power * 0.016;
        return { vx: Math.cos(rad) * speed, vy: -Math.sin(rad) * speed };
    }

    simulatePath(tank, angle, power, maxSteps) {
        const { vx, vy } = this.launchVelocity(tank, angle, power);
        let x = tank.x;
        let y = tank.y - 3;
        let cvx = vx;
        let cvy = vy;
        const path = [];
        const cap = maxSteps || 900;
        for (let i = 0; i < cap; i++) {
            cvy += GRAVITY;
            cvx += this.wind;
            x += cvx;
            y += cvy;
            path.push([Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
            if (x < -2 || x > 102) {
                break;
            }
            if (y >= this.surfaceYAt(Math.max(0, Math.min(100, x)))) {
                break;
            }
        }
        return path;
    }

    fire() {
        if (this.turnPhase !== 'aim') {
            return;
        }
        const tank = this.activeTank;
        this.turnPhase = 'flight';
        this.controls.clearChildren();
        this.aimDots = null;
        this.aimReadout = null;

        const { vx, vy } = this.launchVelocity(tank, tank.angle, tank.power);
        const node = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(tank.x - 0.4, tank.y - 3.4, 0.8, 0.8 * TEXT_H),
            fill: [255, 240, 180, 255],
            color: [255, 255, 255, 255],
            effects: glow([255, 200, 90, 255], 14)
        });
        this.projectile = { x: tank.x, y: tank.y - 3, vx, vy, node, shooter: tank };
        this.world.addChild(node, false);
        this.base.node.onStateChange();
    }

    stepProjectile() {
        const p = this.projectile;
        for (let s = 0; s < SUBSTEPS; s++) {
            p.vy += GRAVITY;
            p.vx += this.wind;
            p.x += p.vx;
            p.y += p.vy;

            if (p.x < -2 || p.x > 102) {
                this.world.removeChild(p.node.id, false);
                this.projectile = null;
                this.addTransient(this.makeGlowText('GONE WITH THE WIND', 50, 20, 2, FAINT), TICK_RATE);
                this.beginResolve();
                return;
            }

            const hitTank = this.tanks.find(t => t.alive &&
                Math.abs(t.x - p.x) < 2.2 && Math.abs((t.y - 1.2) - p.y) < 2.4);
            const groundY = this.surfaceYAt(Math.max(0, Math.min(100, p.x)));
            if (hitTank || p.y >= groundY) {
                const impactY = hitTank ? p.y : groundY;
                this.world.removeChild(p.node.id, false);
                this.projectile = null;
                this.explode(p.x, impactY);
                return;
            }
        }

        if (p.y > 0 && this.tickCount % 2 === 0) {
            this.spawnParticle(p.x, p.y, 0, 0, 6, [255, 200, 120, 255], 0.4);
        }
        p.node.node.coordinates2d = ShapeUtils.rectangle(p.x - 0.4, Math.max(0.2, p.y), 0.8, 0.8 * TEXT_H);
    }

    explode(x, y) {
        this.carveCrater(x, y, CRATER_RADIUS);

        for (let i = 0; i < 22; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.3 + Math.random() * 0.9;
            const colors = [[255, 200, 90, 255], [255, 120, 60, 255], [255, 240, 180, 255]];
            this.spawnParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 0.4,
                10 + Math.floor(Math.random() * 12), colors[i % 3], 0.7 + Math.random() * 0.7);
        }

        const flash = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x - 2.5, Math.max(0, y - 2.5), 5, 5),
            fill: [255, 220, 150, 255],
            color: [255, 255, 255, 255],
            effects: glow([255, 180, 80, 255], 40)
        });
        this.addTransient([flash], 5, this.particleLayer);

        this.tanks.forEach(tank => {
            if (!tank.alive) {
                return;
            }
            const dist = Math.sqrt(Math.pow(tank.x - x, 2) + Math.pow(tank.y - 1 - y, 2));
            if (dist < CRATER_RADIUS + 3.5) {
                const damage = Math.round(Math.max(10, 55 - dist * 5.5));
                this.damageTank(tank, damage, x);
            }
        });

        this.settleTanks();
        this.beginResolve();
    }

    damageTank(tank, amount, fromX) {
        tank.hp -= amount;
        this.addTransient(this.makeGlowText('-' + amount, tank.x, Math.max(4, tank.y - 9), 2, [255, 120, 120, 255]), TICK_RATE);
        if (tank.hp <= 0) {
            tank.hp = 0;
            tank.alive = false;
            this.removeTankNodes(tank);
            for (let i = 0; i < 14; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 0.3 + Math.random() * 0.7;
                this.spawnParticle(tank.x, tank.y - 1, Math.cos(angle) * speed, Math.sin(angle) * speed - 0.3,
                    12 + Math.floor(Math.random() * 10), tank.color, 0.9);
            }
            if (tank.playerId !== null) {
                this.addTransient(this.makeGlowText('YOUR TANK IS SCRAP', 50, 26, 2.6, tank.color, null, [tank.playerId]), 2 * TICK_RATE);
            }
        } else {
            this.refreshTankNodes(tank);
        }
        this.rebuildHud();
    }

    settleTanks() {
        this.tanks.forEach(tank => {
            if (!tank.alive) {
                return;
            }
            const surface = this.surfaceYAt(tank.x);
            if (surface > tank.y + 0.2) {
                tank.fallTarget = surface;
                tank.fallStart = tank.y;
            }
        });
    }

    beginResolve() {
        this.turnPhase = 'resolve';
        this.resolveTicks = Math.round(TICK_RATE * 1.2);
    }

    // --- bot ---

    botAct() {
        const bot = this.activeTank;
        const targets = this.tanks.filter(t => t.alive && t !== bot);
        if (!targets.length) {
            this.fire();
            return;
        }
        const target = targets.reduce((closest, t) =>
            Math.abs(t.x - bot.x) < Math.abs(closest.x - bot.x) ? t : closest);

        let best = { angle: bot.x > target.x ? 120 : 60, power: 55, score: Infinity };
        for (let angle = 20; angle <= 160; angle += 5) {
            for (let power = 25; power <= 100; power += 8) {
                const path = this.simulatePath(bot, angle, power);
                const impact = path[path.length - 1];
                if (!impact) {
                    continue;
                }
                const score = Math.abs(impact[0] - target.x) + Math.abs(impact[1] - target.y) * 0.3;
                if (score < best.score) {
                    best = { angle, power, score };
                }
            }
        }

        bot.angle = Math.max(10, Math.min(170, best.angle + Math.round(Math.random() * 8 - 4)));
        bot.power = Math.max(20, Math.min(100, best.power + Math.round(Math.random() * 8 - 4)));
        this.refreshTankNodes(bot);
        this.botFireTicks = Math.round(TICK_RATE * 0.6);
    }

    // --- particles / transients ---

    spawnParticle(x, y, vx, vy, life, color, size) {
        const particle = {
            x, y, vx, vy, life, maxLife: life, size, color,
            node: new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(x, Math.max(0, y), size, size * TEXT_H),
                fill: color,
                color: [color[0], color[1], color[2], 255]
            })
        };
        this.particles.push(particle);
        this.particleLayer.addChild(particle.node, false);
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.05;
            p.life--;
            if (p.life <= 0 || p.x < 0 || p.x > 99 || p.y > 99) {
                this.particleLayer.removeChild(p.node.id, false);
                this.particles.splice(i, 1);
            } else {
                const frac = p.life / p.maxLife;
                p.node.node.coordinates2d = ShapeUtils.rectangle(p.x, Math.max(0, p.y), p.size * frac + 0.15, (p.size * frac + 0.15) * TEXT_H);
                p.node.node.color = [p.color[0], p.color[1], p.color[2], Math.round(255 * frac)];
            }
        }
    }

    updateTransients() {
        for (let i = this.transients.length - 1; i >= 0; i--) {
            const t = this.transients[i];
            t.ticks--;
            if (t.ticks <= 0) {
                t.nodes.forEach(n => t.parent.removeChild(n.id, false));
                this.transients.splice(i, 1);
            }
        }
    }

    // --- round end ---

    endRound(winner) {
        this.phase = 'roundEnd';
        this.roundEndTicks = 5 * TICK_RATE;
        this.controls.clearChildren();

        if (winner) {
            winner.wins++;
            this.makeGlowText(winner.name + ' TAKES THE VALLEY', 50, 24, 3.4, light(winner.color, 0.4), winner.color)
                .forEach(n => this.overlay.addChild(n, false));
            if (winner.playerId !== null) {
                this.makeGlowText('VICTORY', 50, 32, 2.4, GOLD, null, [winner.playerId])
                    .forEach(n => this.overlay.addChild(n, false));
            }
        } else {
            this.makeGlowText('EVERYBODY LOSES', 50, 24, 3.4, FAINT)
                .forEach(n => this.overlay.addChild(n, false));
        }
        this.rebuildHud();
    }

    // --- simulation ---

    tick() {
        this.tickCount++;

        if (this.phase === 'lobby') {
            if (this.titleHalos) {
                const alpha = 110 + Math.round(60 * Math.sin(this.tickCount / 6));
                this.titleHalos.forEach(halo => {
                    halo.node.text.color = [255, 140, 0, alpha];
                });
            }
        } else if (this.phase === 'playing') {
            if (this.turnPhase === 'aim') {
                this.turnTicksLeft--;
                if (this.timerText) {
                    const secs = Math.ceil(this.turnTicksLeft / TICK_RATE);
                    this.timerText.node.text.text = String(secs);
                    this.timerText.node.text.color = secs <= 10 ? [240, 80, 80, 255] : GOLD;
                }
                if (this.activeTank.isBot) {
                    if (this.botThinkTicks !== null && --this.botThinkTicks <= 0) {
                        this.botThinkTicks = null;
                        this.botAct();
                    } else if (this.botFireTicks !== undefined && this.botFireTicks !== null && --this.botFireTicks <= 0) {
                        this.botFireTicks = null;
                        this.fire();
                    }
                } else if (this.turnTicksLeft <= 0) {
                    this.addTransient(this.makeGlowText(this.activeTank.name + ' HESITATED', 50, 20, 2, FAINT), TICK_RATE);
                    this.turnPhase = 'resolve';
                    this.resolveTicks = 2;
                    this.controls.clearChildren();
                }
            } else if (this.turnPhase === 'flight' && this.projectile) {
                this.stepProjectile();
            } else if (this.turnPhase === 'resolve') {
                let falling = false;
                this.tanks.forEach(tank => {
                    if (tank.alive && tank.fallTarget !== null && tank.fallTarget !== undefined) {
                        tank.y = Math.min(tank.fallTarget, tank.y + 0.9);
                        this.refreshTankNodes(tank);
                        if (tank.y >= tank.fallTarget) {
                            const drop = tank.fallTarget - tank.fallStart;
                            tank.fallTarget = null;
                            if (drop > 7) {
                                this.damageTank(tank, Math.round(drop * 1.5), tank.x);
                            }
                        } else {
                            falling = true;
                        }
                    }
                });
                if (!falling && --this.resolveTicks <= 0) {
                    this.nextTurn();
                }
            }
        } else if (this.phase === 'roundEnd') {
            this.roundEndTicks--;
            if (this.roundEndTicks <= 0) {
                if (this.tanks.some(t => t.playerId !== null)) {
                    this.resetRound();
                } else {
                    this.showLobby();
                }
            }
        }

        this.updateParticles();
        this.updateTransients();
        this.base.node.onStateChange();
    }

    // --- input ---

    handleKeyDown(playerId, key) {
        if (this.phase !== 'playing' || this.turnPhase !== 'aim' ||
            this.activeTank.isBot || this.activeTank.playerId !== playerId) {
            return;
        }
        if (key === 'ArrowLeft') {
            this.adjustAim(2, 0);
        } else if (key === 'ArrowRight') {
            this.adjustAim(-2, 0);
        } else if (key === 'ArrowUp') {
            this.adjustAim(0, 2);
        } else if (key === 'ArrowDown') {
            this.adjustAim(0, -2);
        } else if (key === ' ' || key === 'Enter') {
            this.fire();
        }
    }

    // --- platform hooks ---

    handleNewPlayer({ playerId, info }) {
        this.players[playerId] = { name: (info && info.name) || ('PLAYER ' + playerId) };
        if (this.phase === 'lobby') {
            this.updateLobbyUi();
        } else if (!this.tankFor(playerId) && this.pendingJoins.indexOf(playerId) === -1 &&
            this.tanks.length + this.pendingJoins.length < MAX_TANKS) {
            this.pendingJoins.push(playerId);
            this.addTransient(this.makeGlowText('YOU DEPLOY NEXT ROUND', 50, 20, 2, ACCENT, null, [playerId]), 3 * TICK_RATE);
            this.base.node.onStateChange();
        }
    }

    handlePlayerDisconnect(playerId) {
        delete this.players[playerId];
        this.pendingJoins = this.pendingJoins.filter(pid => pid !== playerId);

        const tank = this.tankFor(playerId);
        if (tank) {
            if (this.phase === 'lobby') {
                this.tanks.splice(this.tanks.indexOf(tank), 1);
            } else {
                tank.playerId = null;
                tank.isBot = true;
                tank.name = PALETTE[tank.colorIndex].name + ' BOT';
                this.rebuildHud();
                if (this.phase === 'playing' && this.turnPhase === 'aim' && this.activeTank === tank) {
                    this.controls.clearChildren();
                    this.renderTurnUi();
                    this.botThinkTicks = TICK_RATE;
                }
            }
        }

        if (Object.keys(this.players).length === 0) {
            this.showLobby();
        } else if (this.phase === 'lobby') {
            this.updateLobbyUi();
        }
        this.base.node.onStateChange();
    }

    getLayers() {
        return [{ root: this.base }];
    }
}

module.exports = KaboomValley;
