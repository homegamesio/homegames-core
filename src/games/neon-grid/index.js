const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-142');
const COLORS = Colors.COLORS;

const TICK_RATE = 12;

const CELL = 2;
const COLS = 48;
const ROWS = 42;
const ARENA_X = 2;
const ARENA_Y = 12;
const ARENA_W = COLS * CELL;
const ARENA_H = ROWS * CELL;

const TRAIL_INSET = 0.3;
const DEREZ_TICKS = 16;
const MIN_RIDERS = 4;
const MAX_RIDERS = 6;

const DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
};

const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const LEFT_OF = { up: 'left', left: 'down', down: 'right', right: 'up' };
const RIGHT_OF = { up: 'right', right: 'down', down: 'left', left: 'up' };

const KEY_DIRS = {
    'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left', 'ArrowRight': 'right',
    'w': 'up', 's': 'down', 'a': 'left', 'd': 'right',
    'W': 'up', 'S': 'down', 'A': 'left', 'D': 'right'
};

const NEON = [
    { name: 'CYAN', color: [0, 255, 255, 255] },
    { name: 'MAGENTA', color: [255, 0, 255, 255] },
    { name: 'LIME', color: [57, 255, 20, 255] },
    { name: 'ORANGE', color: [255, 140, 0, 255] },
    { name: 'YELLOW', color: [255, 236, 0, 255] },
    { name: 'VIOLET', color: [176, 38, 255, 255] }
];

const SPAWNS = [
    { x: 4, y: 21, dir: 'right' },
    { x: 43, y: 21, dir: 'left' },
    { x: 24, y: 4, dir: 'down' },
    { x: 24, y: 37, dir: 'up' },
    { x: 6, y: 6, dir: 'down' },
    { x: 41, y: 35, dir: 'up' }
];

const dim = (color, f) => [Math.round(color[0] * f), Math.round(color[1] * f), Math.round(color[2] * f), 255];
const light = (color, f) => [
    Math.round(color[0] + (255 - color[0]) * f),
    Math.round(color[1] + (255 - color[1]) * f),
    Math.round(color[2] + (255 - color[2]) * f),
    255
];
const glow = (color, blur) => ({ shadow: { color: [color[0], color[1], color[2], 255], blur } });

const shuffled = (list) => {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

class NeonGrid extends Game {
    static metadata() {
        return {
            aspectRatio: { x: 1, y: 1 },
            squishVersion: '142',
            author: 'Joseph Garcia',
            name: 'Neon Grid',
            description: 'Tron-style light cycle battle. Steer your cycle, wall in your rivals, and be the last rider on the grid. Bots fill empty slots.',
            tickRate: TICK_RATE
        };
    }

    constructor() {
        super();

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [3, 4, 12, 255]
        });

        this.buildArenaDecor();

        this.trailLayer = this.makeContainer();
        this.headLayer = this.makeContainer();
        this.particleLayer = this.makeContainer();
        // Taps must land on a clickable node ABOVE the playfield (the hit-test
        // stops at the topmost containing node), but below the UI buttons.
        this.tapCatcher = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            onClick: (playerId, x, y) => this.handleTap(playerId, x, y)
        });
        this.hud = this.makeContainer();
        this.overlay = this.makeContainer();

        this.base.addChildren(this.trailLayer, this.headLayer, this.particleLayer, this.tapCatcher, this.hud, this.overlay);

        this.players = {};
        this.riders = [];
        this.pendingJoins = [];
        this.particles = [];
        this.transients = [];
        this.grid = new Array(COLS * ROWS).fill(null);
        this.tickCount = 0;

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

    buildArenaDecor() {
        const floor = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(ARENA_X, ARENA_Y, ARENA_W, ARENA_H),
            fill: [8, 10, 26, 255]
        });
        this.base.addChild(floor, false);

        const lineFill = [16, 22, 48, 255];
        for (let gx = 4; gx < COLS; gx += 4) {
            this.base.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(ARENA_X + gx * CELL - 0.05, ARENA_Y, 0.1, ARENA_H),
                fill: lineFill
            }), false);
        }
        for (let gy = 4; gy < ROWS; gy += 4) {
            this.base.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(ARENA_X, ARENA_Y + gy * CELL - 0.05, ARENA_W, 0.1),
                fill: lineFill
            }), false);
        }

        const wallFill = [70, 110, 255, 255];
        const wallGlow = glow(wallFill, 12);
        const walls = [
            ShapeUtils.rectangle(ARENA_X - 0.8, ARENA_Y - 0.8, ARENA_W + 1.6, 0.8),
            ShapeUtils.rectangle(ARENA_X - 0.8, ARENA_Y + ARENA_H, ARENA_W + 1.6, 0.8),
            ShapeUtils.rectangle(ARENA_X - 0.8, ARENA_Y - 0.8, 0.8, ARENA_H + 1.6),
            ShapeUtils.rectangle(ARENA_X + ARENA_W, ARENA_Y - 0.8, 0.8, ARENA_H + 1.6)
        ];
        walls.forEach(coords => this.base.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: coords,
            fill: wallFill,
            effects: wallGlow
        }), false));
    }

    // Text nodes can't carry shadow effects, so glow is faked with dim offset copies under a bright core.
    makeGlowText(text, x, y, size, color, glowColor, playerIds) {
        const gc = glowColor || color;
        const offsets = [[-0.22, 0], [0.22, 0], [0, -0.22], [0, 0.22]];
        const nodes = offsets.map(o => new GameNode.Text({
            textInfo: { x: x + o[0], y: y + o[1], text, size, align: 'center', font: 'monospace', color: [gc[0], gc[1], gc[2], 150] },
            playerIds
        }));
        nodes.push(new GameNode.Text({
            textInfo: { x, y, text, size, align: 'center', font: 'monospace', color },
            playerIds
        }));
        return nodes;
    }

    addTransient(nodes, ticks) {
        nodes.forEach(n => this.overlay.addChild(n, false));
        this.transients.push({ nodes, ticks });
    }

    setNodePlayerIds(node, playerIds) {
        node.node.playerIds = playerIds;
        node.node.children.forEach(child => this.setNodePlayerIds(child, playerIds));
    }

    makeButton(label, x, y, w, h, color, onClick) {
        const button = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, w, h),
            fill: [10, 14, 32, 255],
            color,
            border: 8,
            effects: glow(color, 10),
            onClick
        });
        button.addChild(new GameNode.Text({
            textInfo: { x: x + w / 2, y: y + h / 2 - 1.5, text: label, size: 2.6, align: 'center', font: 'monospace', color }
        }), false);
        return button;
    }

    // --- phases ---

    showLobby() {
        this.phase = 'lobby';
        this.riders = [];
        this.pendingJoins = [];
        this.particles = [];
        this.transients = [];
        this.grid = new Array(COLS * ROWS).fill(null);

        this.trailLayer.clearChildren();
        this.headLayer.clearChildren();
        this.particleLayer.clearChildren();
        this.hud.clearChildren();
        this.overlay.clearChildren();

        const title = this.makeGlowText('NEON GRID', 50, 14, 8, [235, 245, 255, 255], [0, 255, 255, 255]);
        this.titleHalos = title.slice(0, 4);
        title.forEach(n => this.overlay.addChild(n, false));

        this.overlay.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 24.5, text: 'A LIGHT CYCLE ARENA', size: 2, align: 'center', font: 'monospace', color: [120, 140, 190, 255] }
        }), false);

        this.lobbyRow = this.makeContainer();
        this.overlay.addChild(this.lobbyRow, false);

        this.joinButton = this.makeButton('JOIN', 36, 52, 28, 8, [0, 255, 255, 255], (playerId) => {
            if (this.phase !== 'lobby' || this.riderFor(playerId)) {
                return;
            }
            this.addRider(playerId);
            this.updateLobbyUi();
        });
        this.startButton = this.makeButton('START', 36, 64, 28, 8, [57, 255, 20, 255], (playerId) => {
            if (this.phase !== 'lobby' || !this.riderFor(playerId)) {
                return;
            }
            this.startMatch();
        });
        this.overlay.addChildren(this.joinButton, this.startButton);

        const instructions = [
            ['STEER: ARROWS / WASD - OR TAP THE SIDE YOU WANT TO TURN', 80, 1.4, [140, 150, 180, 255]],
            ['DODGE THE LIGHT TRAILS - LAST CYCLE RIDING WINS', 84, 1.4, [140, 150, 180, 255]],
            ['BOTS FILL EMPTY GRID SLOTS', 88, 1.2, [90, 100, 130, 255]]
        ];
        instructions.forEach(([text, y, size, color]) => this.overlay.addChild(new GameNode.Text({
            textInfo: { x: 50, y, text, size, align: 'center', font: 'monospace', color }
        }), false));

        this.updateLobbyUi();
    }

    updateLobbyUi() {
        if (this.phase !== 'lobby') {
            return;
        }

        this.lobbyRow.clearChildren();
        if (this.riders.length === 0) {
            this.lobbyRow.addChild(new GameNode.Text({
                textInfo: { x: 50, y: 42, text: 'NO RIDERS YET - HIT JOIN', size: 1.6, align: 'center', font: 'monospace', color: [120, 140, 190, 255] }
            }), false);
        } else {
            const startX = 50 - this.riders.length * 5;
            this.riders.forEach((rider, i) => {
                const slotX = startX + i * 10;
                this.lobbyRow.addChild(new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(slotX + 3.5, 39, 3, 3),
                    fill: rider.color,
                    color: [255, 255, 255, 255],
                    effects: glow(rider.color, 10)
                }), false);
                this.lobbyRow.addChild(new GameNode.Text({
                    textInfo: { x: slotX + 5, y: 43.5, text: rider.name, size: 1.1, align: 'center', font: 'monospace', color: [220, 230, 255, 255] }
                }), false);
                if (rider.playerId !== null) {
                    // frameless sessions have no chrome showing your name, so
                    // each player gets a private marker on their own entry
                    this.lobbyRow.addChild(new GameNode.Text({
                        textInfo: { x: slotX + 5, y: 46, text: 'YOU', size: 1, align: 'center', font: 'monospace', color: [255, 215, 90, 255] },
                        playerIds: [rider.playerId]
                    }), false);
                }
            });
        }

        const connected = Object.keys(this.players).map(Number);
        const joined = this.riders.filter(r => r.playerId !== null).map(r => r.playerId);
        const unjoined = connected.filter(pid => joined.indexOf(pid) === -1);

        this.setNodePlayerIds(this.joinButton, unjoined.length ? unjoined : [0]);
        this.setNodePlayerIds(this.startButton, joined.length ? joined : [0]);
        this.base.node.onStateChange();
    }

    riderFor(playerId) {
        return this.riders.find(r => r.playerId === playerId) || null;
    }

    addRider(playerId) {
        if (this.riders.length >= MAX_RIDERS) {
            return null;
        }
        const used = new Set(this.riders.map(r => r.colorIndex));
        const colorIndex = NEON.findIndex((c, i) => !used.has(i));
        const isBot = playerId === null;
        const playerName = !isBot && this.players[playerId] && this.players[playerId].name;
        const rider = {
            riderId: 'rider-' + colorIndex,
            colorIndex,
            color: NEON[colorIndex].color,
            name: isBot ? NEON[colorIndex].name + ' BOT' : String(playerName || NEON[colorIndex].name).toUpperCase().slice(0, 8),
            playerId: isBot ? null : playerId,
            isBot,
            wins: 0,
            alive: false,
            derezTicks: null,
            segments: [],
            dir: 'up',
            pendingDir: null,
            x: 0,
            y: 0,
            headNode: null
        };
        this.riders.push(rider);
        return rider;
    }

    startMatch() {
        while (this.riders.length < MIN_RIDERS) {
            this.addRider(null);
        }
        this.resetRound();
    }

    resetRound() {
        this.pendingJoins.forEach(pid => {
            if (this.players[pid] && !this.riderFor(pid)) {
                this.addRider(pid);
            }
        });
        this.pendingJoins = [];

        this.phase = 'countdown';
        this.countdownTicks = 3 * TICK_RATE;
        this.particles = [];
        this.transients = [];
        this.grid = new Array(COLS * ROWS).fill(null);

        this.trailLayer.clearChildren();
        this.headLayer.clearChildren();
        this.particleLayer.clearChildren();
        this.overlay.clearChildren();

        const spawns = shuffled(SPAWNS.slice(0, this.riders.length));
        this.riders.forEach((rider, i) => {
            const spawn = spawns[i];
            rider.alive = true;
            rider.derezTicks = null;
            rider.pendingDir = null;
            rider.x = spawn.x;
            rider.y = spawn.y;
            rider.dir = spawn.dir;
            this.grid[this.cellIndex(rider.x, rider.y)] = rider.riderId;

            const seg = { x0: rider.x, y0: rider.y, x1: rider.x, y1: rider.y };
            seg.node = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: this.segmentRect(seg),
                fill: dim(rider.color, 0.55),
                color: [rider.color[0], rider.color[1], rider.color[2], 255],
                effects: glow(rider.color, 6)
            });
            rider.segments = [seg];
            this.trailLayer.addChild(seg.node, false);

            rider.headNode = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: this.headRect(rider),
                fill: light(rider.color, 0.7),
                color: [255, 255, 255, 255],
                effects: glow(rider.color, 18)
            });
            this.headLayer.addChild(rider.headNode, false);

            if (rider.playerId !== null) {
                this.makeGlowText('YOU ARE ' + NEON[rider.colorIndex].name, 50, 26, 2.4, rider.color, null, [rider.playerId])
                    .forEach(n => this.overlay.addChild(n, false));
                this.overlay.addChild(new GameNode.Text({
                    textInfo: {
                        x: ARENA_X + rider.x * CELL + CELL / 2,
                        y: ARENA_Y + rider.y * CELL - 3.2,
                        text: 'YOU',
                        size: 1.6,
                        align: 'center',
                        font: 'monospace',
                        color: rider.color
                    },
                    playerIds: [rider.playerId]
                }), false);
            }
        });

        this.countdownNodes = this.makeGlowText('3', 50, 34, 12, [255, 255, 255, 255], [0, 255, 255, 255]);
        this.countdownNodes.forEach(n => this.overlay.addChild(n, false));

        this.rebuildHud();
        this.base.node.onStateChange();
    }

    endRound(winner) {
        this.phase = 'roundEnd';
        this.roundEndTicks = 4 * TICK_RATE;
        this.overlay.clearChildren();
        this.transients = [];

        if (winner) {
            winner.wins++;
            this.makeGlowText(winner.name + ' WINS', 50, 34, 6, light(winner.color, 0.5), winner.color)
                .forEach(n => this.overlay.addChild(n, false));
            if (winner.playerId !== null) {
                this.makeGlowText('YOU OWN THE GRID', 50, 44, 3, [255, 236, 0, 255], null, [winner.playerId])
                    .forEach(n => this.overlay.addChild(n, false));
            }
        } else {
            this.makeGlowText('MUTUAL DEREZZ', 50, 34, 6, [220, 230, 255, 255], [176, 38, 255, 255])
                .forEach(n => this.overlay.addChild(n, false));
        }

        this.overlay.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 52, text: 'NEXT ROUND INCOMING...', size: 1.8, align: 'center', font: 'monospace', color: [120, 140, 190, 255] }
        }), false);

        this.rebuildHud();
    }

    rebuildHud() {
        this.hud.clearChildren();
        if (this.phase === 'lobby') {
            return;
        }
        this.riders.forEach((rider, i) => {
            const x = 2 + i * 16.3;
            const alpha = rider.alive ? 255 : 80;
            this.hud.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(x, 3, 2.4, 2.4),
                fill: rider.color,
                color: [255, 255, 255, alpha],
                effects: rider.alive ? glow(rider.color, 8) : null
            }), false);
            this.hud.addChild(new GameNode.Text({
                textInfo: { x: x + 3.2, y: 2.8, text: rider.name, size: 1.3, font: 'monospace', color: [230, 235, 255, alpha] }
            }), false);
            this.hud.addChild(new GameNode.Text({
                textInfo: { x: x + 3.2, y: 5.6, text: '★ ' + rider.wins, size: 1.2, font: 'monospace', color: [255, 215, 90, alpha] }
            }), false);
            if (rider.playerId !== null) {
                this.hud.addChild(new GameNode.Text({
                    textInfo: { x: x + 11.5, y: 2.9, text: 'YOU', size: 1.1, font: 'monospace', color: [255, 215, 90, 255] },
                    playerIds: [rider.playerId]
                }), false);
            }
        });
    }

    // --- grid helpers ---

    cellIndex(gx, gy) {
        return gy * COLS + gx;
    }

    inBounds(gx, gy) {
        return gx >= 0 && gx < COLS && gy >= 0 && gy < ROWS;
    }

    segmentRect(seg) {
        const minX = Math.min(seg.x0, seg.x1);
        const minY = Math.min(seg.y0, seg.y1);
        const maxX = Math.max(seg.x0, seg.x1);
        const maxY = Math.max(seg.y0, seg.y1);
        return ShapeUtils.rectangle(
            ARENA_X + minX * CELL + TRAIL_INSET,
            ARENA_Y + minY * CELL + TRAIL_INSET,
            (maxX - minX + 1) * CELL - 2 * TRAIL_INSET,
            (maxY - minY + 1) * CELL - 2 * TRAIL_INSET
        );
    }

    headRect(rider) {
        return ShapeUtils.rectangle(
            ARENA_X + rider.x * CELL - 0.2,
            ARENA_Y + rider.y * CELL - 0.2,
            CELL + 0.4,
            CELL + 0.4
        );
    }

    rayLength(gx, gy, dir, cap = 14) {
        const d = DIRS[dir];
        let steps = 0;
        let x = gx + d.x;
        let y = gy + d.y;
        while (steps < cap && this.inBounds(x, y) && this.grid[this.cellIndex(x, y)] === null) {
            steps++;
            x += d.x;
            y += d.y;
        }
        return steps;
    }

    // --- simulation ---

    tick() {
        this.tickCount++;

        if (this.phase === 'lobby') {
            this.pulseTitle();
        } else if (this.phase === 'countdown') {
            this.tickCountdown();
        } else if (this.phase === 'playing') {
            this.botsThink();
            this.moveRiders();
        } else if (this.phase === 'roundEnd') {
            this.roundEndTicks--;
            if (this.roundEndTicks <= 0) {
                if (this.riders.some(r => r.playerId !== null)) {
                    this.resetRound();
                } else {
                    this.showLobby();
                }
            }
        }

        this.updateDerez();
        this.updateParticles();
        this.updateTransients();
        this.base.node.onStateChange();
    }

    pulseTitle() {
        const alpha = 120 + Math.round(80 * Math.sin(this.tickCount / 3));
        this.titleHalos.forEach(halo => {
            halo.node.text.color = [0, 255, 255, alpha];
        });
    }

    tickCountdown() {
        this.countdownTicks--;
        if (this.countdownTicks <= 0) {
            this.phase = 'playing';
            this.overlay.clearChildren();
            this.transients = [];
            this.addTransient(this.makeGlowText('GO', 50, 36, 9, [255, 255, 255, 255], [57, 255, 20, 255]), 8);
            return;
        }
        const secs = Math.ceil(this.countdownTicks / TICK_RATE);
        const size = 7 + 5 * ((this.countdownTicks % TICK_RATE) / TICK_RATE);
        this.countdownNodes.forEach(n => {
            n.node.text.text = String(secs);
            n.node.text.size = size;
        });
    }

    botsThink() {
        this.riders.filter(r => r.alive && r.isBot).forEach(rider => {
            const forward = this.rayLength(rider.x, rider.y, rider.dir);
            const leftDir = LEFT_OF[rider.dir];
            const rightDir = RIGHT_OF[rider.dir];
            const left = this.rayLength(rider.x, rider.y, leftDir);
            const right = this.rayLength(rider.x, rider.y, rightDir);

            if (forward <= 2) {
                if (left > 0 || right > 0) {
                    rider.pendingDir = left === right
                        ? (Math.random() < 0.5 ? leftDir : rightDir)
                        : (left > right ? leftDir : rightDir);
                }
            } else if (Math.random() < 0.06 && Math.max(left, right) > forward + 2) {
                rider.pendingDir = left > right ? leftDir : rightDir;
            }
        });
    }

    turnRider(rider, newDir) {
        rider.dir = newDir;
        const seg = { x0: rider.x, y0: rider.y, x1: rider.x, y1: rider.y };
        seg.node = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: this.segmentRect(seg),
            fill: dim(rider.color, 0.55),
            color: [rider.color[0], rider.color[1], rider.color[2], 255],
            effects: glow(rider.color, 6)
        });
        rider.segments.push(seg);
        this.trailLayer.addChild(seg.node, false);
    }

    moveRiders() {
        const alive = this.riders.filter(r => r.alive);

        alive.forEach(rider => {
            if (rider.pendingDir && rider.pendingDir !== rider.dir && OPPOSITE[rider.dir] !== rider.pendingDir) {
                this.turnRider(rider, rider.pendingDir);
            }
            rider.pendingDir = null;
        });

        const targetCounts = {};
        alive.forEach(rider => {
            const d = DIRS[rider.dir];
            rider._targetX = rider.x + d.x;
            rider._targetY = rider.y + d.y;
            const key = rider._targetX + ',' + rider._targetY;
            targetCounts[key] = (targetCounts[key] || 0) + 1;
        });

        const dead = alive.filter(rider =>
            !this.inBounds(rider._targetX, rider._targetY) ||
            this.grid[this.cellIndex(rider._targetX, rider._targetY)] !== null ||
            targetCounts[rider._targetX + ',' + rider._targetY] > 1
        );

        alive.forEach(rider => {
            if (dead.indexOf(rider) >= 0) {
                return;
            }
            rider.x = rider._targetX;
            rider.y = rider._targetY;
            this.grid[this.cellIndex(rider.x, rider.y)] = rider.riderId;
            const seg = rider.segments[rider.segments.length - 1];
            seg.x1 = rider.x;
            seg.y1 = rider.y;
            seg.node.node.coordinates2d = this.segmentRect(seg);
            rider.headNode.node.coordinates2d = this.headRect(rider);
        });

        dead.forEach(rider => this.killRider(rider));

        if (dead.length > 0) {
            const survivors = this.riders.filter(r => r.alive);
            if (survivors.length <= 1) {
                this.endRound(survivors[0] || null);
            }
        }
    }

    killRider(rider) {
        rider.alive = false;
        rider.derezTicks = DEREZ_TICKS;
        rider.segments.forEach(seg => {
            seg.node.node.effects = null;
        });
        if (rider.headNode) {
            this.headLayer.removeChild(rider.headNode.id, false);
            rider.headNode = null;
        }
        this.spawnBurst(
            ARENA_X + rider.x * CELL + CELL / 2,
            ARENA_Y + rider.y * CELL + CELL / 2,
            rider.color
        );
        if (rider.playerId !== null) {
            this.addTransient(this.makeGlowText('DEREZZED', 50, 44, 5, light(rider.color, 0.4), rider.color, [rider.playerId]), 30);
        }
        this.rebuildHud();
    }

    updateDerez() {
        this.riders.forEach(rider => {
            if (rider.derezTicks === null) {
                return;
            }
            rider.derezTicks--;
            if (rider.derezTicks <= 0) {
                rider.segments.forEach(seg => {
                    this.trailLayer.removeChild(seg.node.id, false);
                    const dx = Math.sign(seg.x1 - seg.x0);
                    const dy = Math.sign(seg.y1 - seg.y0);
                    let x = seg.x0;
                    let y = seg.y0;
                    while (true) {
                        if (this.grid[this.cellIndex(x, y)] === rider.riderId) {
                            this.grid[this.cellIndex(x, y)] = null;
                        }
                        if (x === seg.x1 && y === seg.y1) {
                            break;
                        }
                        x += dx;
                        y += dy;
                    }
                });
                rider.segments = [];
                rider.derezTicks = null;
            } else {
                const alpha = Math.round(255 * rider.derezTicks / DEREZ_TICKS);
                rider.segments.forEach(seg => {
                    seg.node.node.color = [rider.color[0], rider.color[1], rider.color[2], alpha];
                });
            }
        });
    }

    spawnBurst(ux, uy, color) {
        for (let i = 0; i < 16; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const speed = 0.7 + Math.random() * 1.6;
            const maxLife = 8 + Math.floor(Math.random() * 8);
            const particle = {
                ux, uy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: maxLife,
                maxLife,
                color,
                node: new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(ux - 0.6, uy - 0.6, 1.2, 1.2),
                    fill: light(color, 0.4),
                    color: [color[0], color[1], color[2], 255],
                    effects: glow(color, 6)
                })
            };
            this.particles.push(particle);
            this.particleLayer.addChild(particle.node, false);
        }
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.ux += p.vx;
            p.uy += p.vy;
            p.life--;
            const gone = p.life <= 0 ||
                p.ux < ARENA_X + 1 || p.ux > ARENA_X + ARENA_W - 1 ||
                p.uy < ARENA_Y + 1 || p.uy > ARENA_Y + ARENA_H - 1;
            if (gone) {
                this.particleLayer.removeChild(p.node.id, false);
                this.particles.splice(i, 1);
            } else {
                const frac = p.life / p.maxLife;
                const size = 0.4 + 1.1 * frac;
                p.node.node.coordinates2d = ShapeUtils.rectangle(p.ux - size / 2, p.uy - size / 2, size, size);
                p.node.node.color = [p.color[0], p.color[1], p.color[2], Math.round(255 * frac)];
            }
        }
    }

    updateTransients() {
        for (let i = this.transients.length - 1; i >= 0; i--) {
            const t = this.transients[i];
            t.ticks--;
            if (t.ticks <= 0) {
                t.nodes.forEach(n => this.overlay.removeChild(n.id, false));
                this.transients.splice(i, 1);
            }
        }
    }

    // --- input ---

    requestTurn(rider, dir) {
        if (dir !== rider.dir && OPPOSITE[rider.dir] !== dir) {
            rider.pendingDir = dir;
        }
    }

    handleKeyDown(playerId, key) {
        const dir = KEY_DIRS[key];
        if (!dir || (this.phase !== 'playing' && this.phase !== 'countdown')) {
            return;
        }
        const rider = this.riderFor(playerId);
        if (rider && rider.alive) {
            this.requestTurn(rider, dir);
        }
    }

    handleTap(playerId, x, y) {
        if (this.phase !== 'playing' && this.phase !== 'countdown') {
            return;
        }
        const rider = this.riderFor(playerId);
        if (!rider || !rider.alive || y < ARENA_Y) {
            return;
        }
        const headX = ARENA_X + rider.x * CELL + CELL / 2;
        const headY = ARENA_Y + rider.y * CELL + CELL / 2;
        if (rider.dir === 'left' || rider.dir === 'right') {
            if (Math.abs(y - headY) > CELL) {
                this.requestTurn(rider, y < headY ? 'up' : 'down');
            }
        } else {
            if (Math.abs(x - headX) > CELL) {
                this.requestTurn(rider, x < headX ? 'left' : 'right');
            }
        }
    }

    // --- platform hooks ---

    handleNewPlayer({ playerId, info }) {
        this.players[playerId] = { name: (info && info.name) || ('PLAYER ' + playerId) };
        if (this.phase === 'lobby') {
            this.updateLobbyUi();
        } else if (!this.riderFor(playerId) && this.pendingJoins.indexOf(playerId) === -1 &&
            this.riders.length + this.pendingJoins.length < MAX_RIDERS) {
            this.pendingJoins.push(playerId);
            this.addTransient(this.makeGlowText('YOU RIDE NEXT ROUND', 50, 58, 2.4, [235, 245, 255, 255], [0, 255, 255, 255], [playerId]), 4 * TICK_RATE);
            this.base.node.onStateChange();
        }
    }

    handlePlayerDisconnect(playerId) {
        delete this.players[playerId];
        this.pendingJoins = this.pendingJoins.filter(pid => pid !== playerId);

        const rider = this.riderFor(playerId);
        if (rider) {
            if (this.phase === 'lobby') {
                this.riders.splice(this.riders.indexOf(rider), 1);
            } else {
                rider.playerId = null;
                rider.isBot = true;
                rider.name = NEON[rider.colorIndex].name + ' BOT';
                this.rebuildHud();
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

module.exports = NeonGrid;
