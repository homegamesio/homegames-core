const { Game, GameNode, Shapes, ShapeUtils } = require('squish-142');

// A real-time first-person raycaster. The server casts rays per player per
// tick and streams each player a private 3D view (playerIds-scoped wall
// slices) of one shared maze. Wolfenstein on a scene-graph streamer.

const TICK_RATE = 12;

const COLS = 56;                      // vertical wall slices per player view
const COL_W = 100 / COLS;
const FOV_PLANE = 0.66;               // camera plane half-length (~66 degree FOV)
const HEIGHT_K = 52;                  // wall height = HEIGHT_K / distance
const MAX_DEPTH = 16;

const MAP = 16;                       // maze is MAP x MAP cells
const TARGET_TAGS = 10;
const MATCH_SECONDS = 180;
const FIRE_COOLDOWN = Math.round(0.6 * TICK_RATE);
const INVULN_TICKS = Math.round(1.5 * TICK_RATE);

// Bot fairness: bots must be beatable. They telegraph (stop and turn toward
// you) before firing, miss more at range, and shoot far slower than humans.
const BOT_AIM_TICKS = Math.round(0.8 * TICK_RATE);
const BOT_COOLDOWN = Math.round(2 * TICK_RATE);
const BOT_ENGAGE_RANGE = 6;

const MOVE_STEP = 0.09;               // world units per key/tap event
const TURN_STEP = 0.085;              // radians per key/tap event
const BODY_RADIUS = 0.22;

const MAX_HUMANS = 4;                 // each human view costs COLS nodes/tick

const TEXT_H = 16 / 9;

const PALETTE = [
    { name: 'CYAN', color: [0, 255, 255, 255] },
    { name: 'MAGENTA', color: [255, 0, 255, 255] },
    { name: 'LIME', color: [57, 255, 20, 255] },
    { name: 'AMBER', color: [255, 191, 0, 255] },
    { name: 'PINK', color: [255, 105, 180, 255] },
    { name: 'SKY', color: [135, 206, 250, 255] },
    { name: 'VIOLET', color: [176, 38, 255, 255] }
];

// Synthwave maze: two wall tones plus glowing accent pillars.
const WALL_COLORS = {
    1: [126, 58, 158],
    2: [58, 74, 168],
    3: [255, 0, 200]
};

const CEILING = [10, 6, 24, 255];
const FLOOR = [24, 16, 40, 255];
const HORIZON = [255, 60, 180, 255];
const INK = [240, 236, 255, 255];
const FAINT = [150, 135, 185, 255];
const GOLD = [255, 210, 90, 255];

const glow = (color, blur) => ({ shadow: { color: [color[0], color[1], color[2], 255], blur } });
const light = (color, f) => [
    Math.round(color[0] + (255 - color[0]) * f),
    Math.round(color[1] + (255 - color[1]) * f),
    Math.round(color[2] + (255 - color[2]) * f),
    255
];

class Prism3D extends Game {
    static metadata() {
        return {
            aspectRatio: { x: 16, y: 9 },
            squishVersion: '142',
            author: 'Joseph Garcia',
            name: 'Prism 3D',
            description: 'First-person multiplayer laser tag in a real-time 3D maze - a raycaster running live on the Homegames engine. Every player gets their own eyes.',
            tickRate: TICK_RATE
        };
    }

    constructor() {
        super();

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: CEILING
        });

        // Sky/floor are identical for everyone: shared nodes, huge bandwidth win.
        this.base.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 48.5, 100, 3),
            fill: [70, 20, 60, 255],
            effects: glow(HORIZON, 14)
        }), false);
        this.base.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 50, 100, 50),
            fill: FLOOR
        }), false);

        this.viewLayer = this.makeContainer();     // per-player 3D views
        this.hudShared = this.makeContainer();     // minimap + score strip
        this.tapLayer = this.makeContainer();      // per-player tap catchers
        this.buttonLayer = this.makeContainer();   // FIRE buttons (above catchers)
        this.overlay = this.makeContainer();       // lobby / countdown / results
        this.base.addChildren(this.viewLayer, this.hudShared, this.tapLayer, this.buttonLayer, this.overlay);

        this.players = {};
        this.agents = [];
        this.views = {};
        this.pendingJoins = [];
        this.transients = [];
        this.tickCount = 0;

        this.generateMap();
        this.showLobby();
    }

    makeContainer() {
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });
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

    makeButton(label, x, y, w, h, color, onClick, playerIds, size) {
        const textSize = size || 2;
        const button = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, w, h),
            fill: [18, 10, 34, 255],
            color,
            border: 8,
            effects: glow(color, 8),
            onClick,
            playerIds
        });
        button.addChild(new GameNode.Text({
            textInfo: { x: x + w / 2, y: y + (h - textSize * TEXT_H) / 2, text: label, size: textSize, align: 'center', font: 'monospace', color },
            playerIds
        }), false);
        return button;
    }

    setNodePlayerIds(node, playerIds) {
        node.node.playerIds = playerIds;
        node.node.children.forEach(child => this.setNodePlayerIds(child, playerIds));
    }

    addTransient(nodes, ticks) {
        nodes.forEach(n => this.overlay.addChild(n, false));
        this.transients.push({ nodes, ticks });
    }

    playerName(playerId) {
        return String((this.players[playerId] && this.players[playerId].name) || ('PLAYER ' + playerId)).toUpperCase().slice(0, 8);
    }

    // --- maze generation ---

    generateMap() {
        // Start fully open (border walled), then add wall runs, keeping the
        // floor connected so no cell is ever sealed off.
        this.map = [];
        for (let y = 0; y < MAP; y++) {
            this.map.push(new Array(MAP).fill(0));
            for (let x = 0; x < MAP; x++) {
                if (x === 0 || y === 0 || x === MAP - 1 || y === MAP - 1) {
                    this.map[y][x] = 1;
                }
            }
        }

        const openCount = () => {
            let n = 0;
            for (let y = 0; y < MAP; y++) {
                for (let x = 0; x < MAP; x++) {
                    if (this.map[y][x] === 0) n++;
                }
            }
            return n;
        };

        const connectedCount = () => {
            let start = null;
            for (let y = 1; y < MAP - 1 && !start; y++) {
                for (let x = 1; x < MAP - 1 && !start; x++) {
                    if (this.map[y][x] === 0) start = [x, y];
                }
            }
            if (!start) return 0;
            const seen = new Set([start[0] + ',' + start[1]]);
            const queue = [start];
            while (queue.length) {
                const [cx, cy] = queue.pop();
                [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
                    const nx = cx + dx;
                    const ny = cy + dy;
                    const key = nx + ',' + ny;
                    if (this.map[ny] && this.map[ny][nx] === 0 && !seen.has(key)) {
                        seen.add(key);
                        queue.push([nx, ny]);
                    }
                });
            }
            return seen.size;
        };

        let attempts = 0;
        while (attempts < 120 && openCount() > MAP * MAP * 0.62) {
            attempts++;
            const horizontal = Math.random() < 0.5;
            const length = 2 + Math.floor(Math.random() * 4);
            const x0 = 2 + Math.floor(Math.random() * (MAP - 4 - (horizontal ? length : 0)));
            const y0 = 2 + Math.floor(Math.random() * (MAP - 4 - (horizontal ? 0 : length)));
            const type = Math.random() < 0.18 ? 3 : (Math.random() < 0.5 ? 1 : 2);

            const cells = [];
            for (let i = 0; i < length; i++) {
                cells.push(horizontal ? [x0 + i, y0] : [x0, y0 + i]);
            }
            cells.forEach(([x, y]) => { this.map[y][x] = type; });
            if (connectedCount() !== openCount()) {
                cells.forEach(([x, y]) => { this.map[y][x] = 0; });
            }
        }
    }

    isWall(x, y) {
        const cx = Math.floor(x);
        const cy = Math.floor(y);
        if (cx < 0 || cy < 0 || cx >= MAP || cy >= MAP) return 1;
        return this.map[cy][cx];
    }

    randomSpawn() {
        let best = null;
        for (let i = 0; i < 30; i++) {
            const x = 1 + Math.random() * (MAP - 2);
            const y = 1 + Math.random() * (MAP - 2);
            if (this.isWall(x, y)) continue;
            const minDist = this.agents.reduce((min, a) =>
                Math.min(min, Math.sqrt((a.x - x) ** 2 + (a.y - y) ** 2)), Infinity);
            if (!best || minDist > best.minDist) {
                best = { x, y, minDist };
            }
        }
        return best || { x: MAP / 2, y: MAP / 2 };
    }

    // --- lobby / match flow ---

    showLobby() {
        this.phase = 'lobby';
        this.agents = [];
        this.pendingJoins = [];
        this.transients = [];
        Object.keys(this.views).map(Number).forEach(pid => this.removeView(pid));
        this.hudShared.clearChildren();
        this.overlay.clearChildren();
        this.buttonLayer.clearChildren();

        const title = this.makeGlowText('PRISM 3D', 50, 12, 6.5, INK, HORIZON);
        this.titleHalos = title.slice(0, 4);
        title.forEach(n => this.overlay.addChild(n, false));

        this.overlay.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 24, text: 'FIRST-PERSON LASER TAG - YES, REALLY', size: 1.8, align: 'center', font: 'monospace', color: FAINT }
        }), false);

        this.lobbyRow = this.makeContainer();
        this.overlay.addChild(this.lobbyRow, false);

        this.joinButton = this.makeButton('JOIN', 30, 52, 18, 9, [0, 255, 255, 255], (playerId) => {
            if (this.phase !== 'lobby' || this.agentFor(playerId)) return;
            if (this.humanCount() >= MAX_HUMANS) {
                this.addTransient(this.makeGlowText('MAZE FULL - ' + MAX_HUMANS + ' RAIDERS MAX', 50, 44, 1.8, GOLD, null, [playerId]), 2 * TICK_RATE);
                return;
            }
            this.addAgent(playerId);
            this.updateLobbyUi();
        });
        this.startButton = this.makeButton('START', 52, 52, 18, 9, [57, 255, 20, 255], (playerId) => {
            if (this.phase !== 'lobby' || !this.agentFor(playerId)) return;
            this.startMatch();
        });
        this.overlay.addChildren(this.joinButton, this.startButton);

        const lines = [
            'MOVE: UP/W - TURN: LEFT+RIGHT/A+D - FIRE: SPACE',
            'ON A PHONE: TAP LEFT/RIGHT TO TURN, CENTER TO MOVE, FIRE BUTTON TO SHOOT',
            'FIRST TO ' + TARGET_TAGS + ' TAGS WINS - BOTS JOIN IF YOU ARE ALONE'
        ];
        lines.forEach((text, i) => this.overlay.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 70 + i * 4, text, size: 1.3, align: 'center', font: 'monospace', color: FAINT }
        }), false));

        this.updateLobbyUi();
    }

    updateLobbyUi() {
        if (this.phase !== 'lobby') return;
        this.lobbyRow.clearChildren();
        if (this.agents.length === 0) {
            this.lobbyRow.addChild(new GameNode.Text({
                textInfo: { x: 50, y: 38, text: 'NO RAIDERS YET - TAP JOIN', size: 1.6, align: 'center', font: 'monospace', color: FAINT }
            }), false);
        } else {
            const startX = 50 - this.agents.length * 7;
            this.agents.forEach((agent, i) => {
                const x = startX + i * 14;
                this.lobbyRow.addChild(new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(x + 4.6, 34, 3, 3 * TEXT_H),
                    fill: agent.color,
                    color: [255, 255, 255, 255],
                    effects: glow(agent.color, 8)
                }), false);
                this.lobbyRow.addChild(new GameNode.Text({
                    textInfo: { x: x + 6, y: 41, text: agent.name, size: 1.2, align: 'center', font: 'monospace', color: INK }
                }), false);
                if (agent.playerId !== null) {
                    this.lobbyRow.addChild(new GameNode.Text({
                        textInfo: { x: x + 6, y: 43.8, text: 'YOU', size: 1, align: 'center', font: 'monospace', color: GOLD },
                        playerIds: [agent.playerId]
                    }), false);
                }
            });
        }

        const connected = Object.keys(this.players).map(Number);
        const joined = this.agents.filter(a => a.playerId !== null).map(a => a.playerId);
        const unjoined = connected.filter(pid => joined.indexOf(pid) === -1);
        this.setNodePlayerIds(this.joinButton, unjoined.length ? unjoined : [0]);
        this.setNodePlayerIds(this.startButton, joined.length ? joined : [0]);
        this.base.node.onStateChange();
    }

    humanCount() {
        return this.agents.filter(a => a.playerId !== null).length;
    }

    agentFor(playerId) {
        return this.agents.find(a => a.playerId === playerId) || null;
    }

    addAgent(playerId) {
        const used = new Set(this.agents.map(a => a.colorIndex));
        const colorIndex = PALETTE.findIndex((c, i) => !used.has(i));
        const isBot = playerId === null;
        const spawn = this.randomSpawn();
        const agent = {
            colorIndex,
            color: PALETTE[colorIndex].color,
            name: isBot ? PALETTE[colorIndex].name + ' BOT' : this.playerName(playerId),
            playerId: isBot ? null : playerId,
            isBot,
            x: spawn.x,
            y: spawn.y,
            angle: Math.random() * Math.PI * 2,
            score: 0,
            cooldown: 0,
            invuln: 0,
            botSight: 0,
            aimTarget: null,
            aimTicks: 0
        };
        this.agents.push(agent);
        if (!isBot) this.buildView(agent);
        return agent;
    }

    startMatch() {
        while (this.agents.length < 3) {
            this.addAgent(null);
        }
        this.beginRound(true);
    }

    beginRound(resetScores) {
        this.pendingJoins.forEach(pid => {
            if (this.players[pid] && !this.agentFor(pid) && this.humanCount() < MAX_HUMANS) {
                this.addAgent(pid);
            }
        });
        this.pendingJoins = [];

        this.generateMap();
        this.agents.forEach(agent => {
            const spawn = this.randomSpawn();
            agent.x = spawn.x;
            agent.y = spawn.y;
            agent.angle = Math.random() * Math.PI * 2;
            agent.cooldown = 0;
            agent.invuln = INVULN_TICKS;
            if (resetScores) agent.score = 0;
        });

        this.phase = 'countdown';
        this.countdownTicks = 3 * TICK_RATE;
        this.matchTicksLeft = MATCH_SECONDS * TICK_RATE;
        this.overlay.clearChildren();
        this.transients = [];
        this.buildSharedHud();

        this.countdownNodes = this.makeGlowText('3', 50, 32, 10, INK, HORIZON);
        this.countdownNodes.forEach(n => this.overlay.addChild(n, false));
        this.agents.filter(a => a.playerId !== null).forEach(agent => {
            this.makeGlowText('YOU ARE ' + PALETTE[agent.colorIndex].name, 50, 22, 2, agent.color, null, [agent.playerId])
                .forEach(n => this.overlay.addChild(n, false));
        });

        this.base.node.onStateChange();
    }

    endMatch() {
        this.phase = 'matchEnd';
        this.overlay.clearChildren();
        this.transients = [];

        const standings = this.agents.slice().sort((a, b) => b.score - a.score);
        const winner = standings[0];

        this.makeGlowText(winner.name + ' RULES THE MAZE', 50, 20, 4, light(winner.color, 0.4), winner.color)
            .forEach(n => this.overlay.addChild(n, false));
        if (winner.playerId !== null) {
            this.makeGlowText('CHAMPION', 50, 29, 2.2, GOLD, null, [winner.playerId])
                .forEach(n => this.overlay.addChild(n, false));
        }
        standings.forEach((agent, i) => {
            this.overlay.addChild(new GameNode.Text({
                textInfo: { x: 50, y: 38 + i * 4.5, text: (i + 1) + '. ' + agent.name + ' - ' + agent.score + ' TAGS', size: 1.8, align: 'center', font: 'monospace', color: agent.color }
            }), false);
        });

        this.overlay.addChild(this.makeButton('RUN IT BACK', 36, 74, 28, 9, [0, 255, 255, 255], (playerId) => {
            if (this.phase === 'matchEnd' && this.agentFor(playerId)) {
                this.beginRound(true);
            }
        }), false);
        this.base.node.onStateChange();
    }

    // --- per-player views ---

    buildView(agent) {
        const pid = agent.playerId;
        const container = this.makeContainer();

        const slices = [];
        for (let i = 0; i < COLS; i++) {
            const slice = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(i * COL_W, 49, COL_W + 0.05, 2),
                fill: [0, 0, 0, 255],
                playerIds: [pid]
            });
            slices.push(slice);
            container.addChild(slice, false);
        }

        const spriteBox = this.makeContainer();
        container.addChild(spriteBox, false);

        // Crosshair (visual only, sits under the tap catcher).
        const crossV = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(49.85, 47.8, 0.3, 4.4),
            fill: [255, 255, 255, 255],
            color: [255, 255, 255, 160],
            playerIds: [pid]
        });
        const crossH = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(48.75, 49.73, 2.5, 0.55),
            fill: [255, 255, 255, 255],
            color: [255, 255, 255, 160],
            playerIds: [pid]
        });
        container.addChildren(crossV, crossH);

        // Full-screen hit flash: alpha animated via `color`.
        const flash = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [255, 40, 40, 255],
            color: [255, 40, 40, 0],
            playerIds: [pid]
        });
        container.addChild(flash, false);

        const catcher = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            playerIds: [pid],
            onClick: (clickPid, x, y) => this.handleTap(clickPid, x, y)
        });
        this.tapLayer.addChild(catcher, false);

        const fireButton = this.makeButton('FIRE', 42, 86, 16, 10, [255, 60, 90, 255], (clickPid) => {
            if (clickPid === pid) this.tryFire(this.agentFor(pid));
        }, [pid], 2.2);
        this.buttonLayer.addChild(fireButton, false);

        this.views[pid] = { container, slices, spriteBox, flash, catcher, fireButton, flashTicks: 0, lastDists: new Array(COLS).fill(MAX_DEPTH) };
        this.viewLayer.addChild(container, false);
    }

    removeView(playerId) {
        const view = this.views[playerId];
        if (!view) return;
        this.viewLayer.removeChild(view.container.id, false);
        this.tapLayer.removeChild(view.catcher.id, false);
        this.buttonLayer.removeChild(view.fireButton.id, false);
        delete this.views[playerId];
    }

    // The core: one DDA raycast per column, Lodev camera-plane style.
    renderView(agent) {
        const view = this.views[agent.playerId];
        if (!view) return;

        const dirX = Math.cos(agent.angle);
        const dirY = Math.sin(agent.angle);
        const planeX = -dirY * FOV_PLANE;
        const planeY = dirX * FOV_PLANE;

        for (let col = 0; col < COLS; col++) {
            const cameraX = (2 * col) / (COLS - 1) - 1;
            const rayX = dirX + planeX * cameraX;
            const rayY = dirY + planeY * cameraX;

            let mapX = Math.floor(agent.x);
            let mapY = Math.floor(agent.y);
            const deltaX = rayX === 0 ? 1e30 : Math.abs(1 / rayX);
            const deltaY = rayY === 0 ? 1e30 : Math.abs(1 / rayY);
            const stepX = rayX < 0 ? -1 : 1;
            const stepY = rayY < 0 ? -1 : 1;
            let sideX = rayX < 0 ? (agent.x - mapX) * deltaX : (mapX + 1 - agent.x) * deltaX;
            let sideY = rayY < 0 ? (agent.y - mapY) * deltaY : (mapY + 1 - agent.y) * deltaY;

            let side = 0;
            let wallType = 1;
            let dist = MAX_DEPTH;
            for (let depth = 0; depth < 40; depth++) {
                if (sideX < sideY) {
                    sideX += deltaX;
                    mapX += stepX;
                    side = 0;
                } else {
                    sideY += deltaY;
                    mapY += stepY;
                    side = 1;
                }
                if (mapX < 0 || mapY < 0 || mapX >= MAP || mapY >= MAP) {
                    dist = MAX_DEPTH;
                    break;
                }
                if (this.map[mapY][mapX] > 0) {
                    wallType = this.map[mapY][mapX];
                    dist = side === 0 ? sideX - deltaX : sideY - deltaY;
                    break;
                }
            }

            dist = Math.max(0.15, Math.min(MAX_DEPTH, dist));
            view.lastDists[col] = dist;

            const h = Math.min(100, HEIGHT_K / dist);
            const y = 50 - h / 2;
            const shade = Math.max(0.1, Math.min(1, 1.15 / (1 + dist * 0.24))) * (side === 1 ? 0.72 : 1);
            const baseColor = WALL_COLORS[wallType] || WALL_COLORS[1];
            const slice = view.slices[col];
            slice.node.coordinates2d = ShapeUtils.rectangle(
                Math.round(col * COL_W * 100) / 100,
                Math.round(y * 100) / 100,
                COL_W + 0.05,
                Math.round(h * 100) / 100);
            slice.node.fill = [
                Math.round(baseColor[0] * shade),
                Math.round(baseColor[1] * shade),
                Math.round(baseColor[2] * shade),
                255
            ];
        }

        // Billboard sprites for the other raiders.
        view.spriteBox.clearChildren();
        const invDet = 1 / (planeX * dirY - dirX * planeY);
        this.agents.forEach(other => {
            if (other === agent) return;
            const relX = other.x - agent.x;
            const relY = other.y - agent.y;
            const transX = invDet * (dirY * relX - dirX * relY);
            const transY = invDet * (-planeY * relX + planeX * relY);
            if (transY < 0.25 || transY > MAX_DEPTH) return;

            const screenX = 50 * (1 + transX / transY);
            if (screenX < -8 || screenX > 108) return;

            const col = Math.max(0, Math.min(COLS - 1, Math.floor(screenX / COL_W)));
            if (view.lastDists[col] < transY - 0.15) return;   // behind a wall

            const h = Math.min(80, (HEIGHT_K * 0.62) / transY);
            const w = h * 0.32;
            const shade = Math.max(0.25, Math.min(1, 1.2 / (1 + transY * 0.2)));
            const blink = other.invuln > 0 && this.tickCount % 4 < 2;
            const bodyColor = [
                Math.round(other.color[0] * shade),
                Math.round(other.color[1] * shade),
                Math.round(other.color[2] * shade),
                255
            ];
            const body = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(
                    Math.round((screenX - w / 2) * 100) / 100,
                    Math.round((50 + (HEIGHT_K / transY) / 2 - h) * 100) / 100,
                    Math.round(w * 100) / 100,
                    Math.round(h * 100) / 100),
                fill: bodyColor,
                color: [255, 255, 255, blink ? 70 : 255],
                effects: transY < 6 ? glow(other.color, 10) : null,
                playerIds: [agent.playerId]
            });
            // A dark visor band so the sprite reads as "facing you".
            const visor = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(
                    Math.round((screenX - w * 0.35) * 100) / 100,
                    Math.round((50 + (HEIGHT_K / transY) / 2 - h * 0.82) * 100) / 100,
                    Math.round(w * 0.7 * 100) / 100,
                    Math.round(h * 0.14 * 100) / 100),
                fill: [12, 8, 20, 255],
                color: [255, 255, 255, blink ? 70 : 255],
                playerIds: [agent.playerId]
            });
            view.spriteBox.addChildren(body, visor);
        });

        // Muzzle / hit flash decay.
        if (view.flashTicks > 0) {
            view.flashTicks--;
            view.flash.node.color = [view.flash.node.fill[0], view.flash.node.fill[1], view.flash.node.fill[2],
                Math.round(120 * view.flashTicks / 4)];
        } else if (view.flash.node.color[3] !== 0) {
            view.flash.node.color = [255, 40, 40, 0];
        }
    }

    // --- shared HUD (score strip + minimap) ---

    buildSharedHud() {
        this.hudShared.clearChildren();

        this.scoreTexts = {};
        this.agents.forEach((agent, i) => {
            const x = 2 + i * 15;
            this.hudShared.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(x, 2, 1.4, 1.4 * TEXT_H),
                fill: agent.color,
                color: [255, 255, 255, 255]
            }), false);
            this.hudShared.addChild(new GameNode.Text({
                textInfo: { x: x + 2.2, y: 1.8, text: agent.name, size: 1.1, font: 'monospace', color: INK }
            }), false);
            const score = new GameNode.Text({
                textInfo: { x: x + 2.2, y: 4.4, text: '0/' + TARGET_TAGS, size: 1.1, font: 'monospace', color: GOLD }
            });
            this.scoreTexts[i] = score;
            this.hudShared.addChild(score, false);
            if (agent.playerId !== null) {
                this.hudShared.addChild(new GameNode.Text({
                    textInfo: { x: x + 10.2, y: 1.8, text: 'YOU', size: 1, font: 'monospace', color: GOLD },
                    playerIds: [agent.playerId]
                }), false);
            }
        });

        this.timerText = new GameNode.Text({
            textInfo: { x: 50, y: 1.8, text: String(MATCH_SECONDS), size: 1.6, align: 'center', font: 'monospace', color: GOLD }
        });
        this.hudShared.addChild(this.timerText, false);

        // Minimap: merged wall strips so the whole maze is ~30 nodes.
        const mapX = 82;
        const mapY = 68;
        const cell = 1;
        this.minimap = { x: mapX, y: mapY, cell };
        this.hudShared.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(mapX - 0.4, mapY - 0.4, MAP * cell + 0.8, MAP * cell * TEXT_H * 0.5625 + 0.8),
            fill: [8, 5, 18, 220],
            color: [255, 60, 180, 255],
            border: 4
        }), false);
        const cellH = cell * TEXT_H * 0.5625;
        for (let y = 0; y < MAP; y++) {
            let runStart = -1;
            for (let x = 0; x <= MAP; x++) {
                const wall = x < MAP && this.map[y][x] > 0;
                if (wall && runStart < 0) runStart = x;
                if (!wall && runStart >= 0) {
                    this.hudShared.addChild(new GameNode.Shape({
                        shapeType: Shapes.POLYGON,
                        coordinates2d: ShapeUtils.rectangle(
                            mapX + runStart * cell, mapY + y * cellH, (x - runStart) * cell, cellH),
                        fill: [110, 50, 140, 255]
                    }), false);
                    runStart = -1;
                }
            }
        }

        this.mapDots = [];
        this.agents.forEach(agent => {
            const dot = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(mapX, mapY, 0.7, 0.7 * TEXT_H),
                fill: agent.color,
                color: [255, 255, 255, 255]
            });
            this.mapDots.push(dot);
            this.hudShared.addChild(dot, false);
        });
    }

    updateHud() {
        this.agents.forEach((agent, i) => {
            if (this.scoreTexts && this.scoreTexts[i]) {
                this.scoreTexts[i].node.text.text = agent.score + '/' + TARGET_TAGS;
            }
            const dot = this.mapDots && this.mapDots[i];
            if (dot) {
                const cellH = this.minimap.cell * TEXT_H * 0.5625;
                dot.node.coordinates2d = ShapeUtils.rectangle(
                    Math.round((this.minimap.x + agent.x * this.minimap.cell - 0.35) * 100) / 100,
                    Math.round((this.minimap.y + agent.y * cellH - 0.35) * 100) / 100,
                    0.7, 0.7 * TEXT_H);
            }
        });
        if (this.timerText && this.matchTicksLeft % TICK_RATE === 0) {
            const secs = Math.ceil(this.matchTicksLeft / TICK_RATE);
            this.timerText.node.text.text = String(secs);
            this.timerText.node.text.color = secs <= 20 ? [255, 80, 80, 255] : GOLD;
        }
    }

    // --- movement / combat ---

    tryMove(agent, forward) {
        const nx = agent.x + Math.cos(agent.angle) * MOVE_STEP * forward;
        const ny = agent.y + Math.sin(agent.angle) * MOVE_STEP * forward;
        // Slide along walls: apply each axis independently.
        if (!this.isWall(nx + Math.sign(nx - agent.x) * BODY_RADIUS, agent.y) &&
            !this.isWall(nx, agent.y + BODY_RADIUS) && !this.isWall(nx, agent.y - BODY_RADIUS)) {
            agent.x = nx;
        }
        if (!this.isWall(agent.x, ny + Math.sign(ny - agent.y) * BODY_RADIUS) &&
            !this.isWall(agent.x + BODY_RADIUS, ny) && !this.isWall(agent.x - BODY_RADIUS, ny)) {
            agent.y = ny;
        }
    }

    tryFire(agent) {
        if (!agent || this.phase !== 'playing' || agent.cooldown > 0) return;
        agent.cooldown = FIRE_COOLDOWN;

        const view = this.views[agent.playerId];
        if (view) {
            view.flash.node.fill = [255, 255, 210, 255];
            view.flashTicks = 3;
        }

        // Hitscan: march the facing ray; first raider hit before a wall is tagged.
        const dirX = Math.cos(agent.angle);
        const dirY = Math.sin(agent.angle);
        for (let step = 0.3; step < 12; step += 0.12) {
            const px = agent.x + dirX * step;
            const py = agent.y + dirY * step;
            if (this.isWall(px, py)) return;
            const victim = this.agents.find(other => other !== agent && other.invuln <= 0 &&
                (other.x - px) ** 2 + (other.y - py) ** 2 < 0.14);
            if (victim) {
                this.tag(agent, victim);
                return;
            }
        }
    }

    tag(shooter, victim) {
        shooter.score++;
        const spawn = this.randomSpawn();
        victim.x = spawn.x;
        victim.y = spawn.y;
        victim.angle = Math.random() * Math.PI * 2;
        victim.invuln = INVULN_TICKS;

        const victimView = this.views[victim.playerId];
        if (victimView) {
            victimView.flash.node.fill = [255, 40, 40, 255];
            victimView.flashTicks = 4;
        }
        if (victim.playerId !== null) {
            this.addTransient(this.makeGlowText('TAGGED BY ' + shooter.name, 50, 62, 2, victim.color, [255, 60, 60, 255], [victim.playerId]), TICK_RATE);
        }
        if (shooter.playerId !== null) {
            this.addTransient(this.makeGlowText('TAGGED ' + victim.name + '!', 50, 62, 2, light(shooter.color, 0.3), shooter.color, [shooter.playerId]), TICK_RATE);
        }

        if (shooter.score >= TARGET_TAGS) {
            this.endMatch();
        }
    }

    hasLineOfSight(from, to) {
        const dist = Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
        for (let step = 0.3; step < dist - 0.2; step += 0.3) {
            const t = step / dist;
            if (this.isWall(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t)) return false;
        }
        return true;
    }

    botThink(bot) {
        // Aiming: stand still and visibly turn toward the target (the
        // telegraph is the victim's window to dodge or shoot back).
        if (bot.aimTarget) {
            const target = bot.aimTarget;
            const dist = Math.sqrt((target.x - bot.x) ** 2 + (target.y - bot.y) ** 2);
            const lost = this.agents.indexOf(target) < 0 || target.invuln > 0 ||
                dist > BOT_ENGAGE_RANGE + 1 || !this.hasLineOfSight(bot, target);
            if (lost) {
                bot.aimTarget = null;
            } else {
                const want = Math.atan2(target.y - bot.y, target.x - bot.x);
                let diff = (want - bot.angle) % (Math.PI * 2);
                if (diff > Math.PI) diff -= Math.PI * 2;
                if (diff < -Math.PI) diff += Math.PI * 2;
                bot.angle += Math.max(-0.22, Math.min(0.22, diff));

                if (--bot.aimTicks <= 0) {
                    // Aim error grows with distance: point blank is dangerous,
                    // across the room is a coin flip.
                    bot.angle = want + (Math.random() - 0.5) * (0.1 + dist * 0.05);
                    this.tryFire(bot);
                    bot.cooldown = BOT_COOLDOWN;
                    bot.aimTarget = null;
                }
                return;
            }
        }

        // Wander: keep walking, turn away from walls, jitter occasionally.
        const aheadX = bot.x + Math.cos(bot.angle) * 0.7;
        const aheadY = bot.y + Math.sin(bot.angle) * 0.7;
        if (this.isWall(aheadX, aheadY)) {
            bot.angle += (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2 + (Math.random() - 0.5) * 0.8);
        } else if (Math.random() < 0.04) {
            bot.angle += (Math.random() - 0.5) * 1.2;
        }
        this.tryMove(bot, 0.75);

        // Scan for a target a few times a second, only when ready to fire.
        if (--bot.botSight > 0 || bot.cooldown > 0) return;
        bot.botSight = Math.round(0.4 * TICK_RATE);

        const target = this.agents
            .filter(a => a !== bot && a.invuln <= 0)
            .map(a => ({ a, d2: (a.x - bot.x) ** 2 + (a.y - bot.y) ** 2 }))
            .sort((p, q) => p.d2 - q.d2)[0];
        if (!target || target.d2 > BOT_ENGAGE_RANGE * BOT_ENGAGE_RANGE) return;
        if (!this.hasLineOfSight(bot, target.a)) return;

        bot.aimTarget = target.a;
        bot.aimTicks = BOT_AIM_TICKS;
    }

    // --- simulation ---

    tick() {
        this.tickCount++;

        if (this.phase === 'lobby') {
            if (this.titleHalos) {
                const alpha = 110 + Math.round(60 * Math.sin(this.tickCount / 5));
                this.titleHalos.forEach(halo => {
                    halo.node.text.color = [HORIZON[0], HORIZON[1], HORIZON[2], alpha];
                });
            }
        } else if (this.phase === 'countdown') {
            this.countdownTicks--;
            if (this.countdownTicks <= 0) {
                this.phase = 'playing';
                this.overlay.clearChildren();
                this.transients = [];
                this.addTransient(this.makeGlowText('GO', 50, 30, 8, INK, [57, 255, 20, 255]), 8);
            } else {
                const secs = Math.ceil(this.countdownTicks / TICK_RATE);
                this.countdownNodes.forEach(n => {
                    n.node.text.text = String(secs);
                });
            }
            this.agents.filter(a => a.playerId !== null).forEach(a => this.renderView(a));
        } else if (this.phase === 'playing') {
            this.matchTicksLeft--;
            this.agents.forEach(agent => {
                if (agent.cooldown > 0) agent.cooldown--;
                if (agent.invuln > 0) agent.invuln--;
                if (agent.isBot) this.botThink(agent);
            });
            this.agents.filter(a => a.playerId !== null).forEach(a => this.renderView(a));
            this.updateHud();
            if (this.matchTicksLeft <= 0 && this.phase === 'playing') {
                this.endMatch();
            }
        }

        this.updateTransients();
        this.base.node.onStateChange();
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

    handleKeyDown(playerId, key) {
        const agent = this.agentFor(playerId);
        if (!agent || (this.phase !== 'playing' && this.phase !== 'countdown')) return;
        if (this.phase === 'countdown') return;
        if (key === 'ArrowUp' || key === 'w' || key === 'W') this.tryMove(agent, 1);
        else if (key === 'ArrowDown' || key === 's' || key === 'S') this.tryMove(agent, -0.7);
        else if (key === 'ArrowLeft' || key === 'a' || key === 'A') agent.angle -= TURN_STEP;
        else if (key === 'ArrowRight' || key === 'd' || key === 'D') agent.angle += TURN_STEP;
        else if (key === ' ' || key === 'Enter') this.tryFire(agent);
    }

    handleTap(playerId, x, y) {
        const agent = this.agentFor(playerId);
        if (!agent || this.phase !== 'playing') return;
        if (x < 33) agent.angle -= TURN_STEP * 1.4;
        else if (x > 67) agent.angle += TURN_STEP * 1.4;
        else if (y > 60) this.tryMove(agent, -0.7);
        else this.tryMove(agent, 1.3);
    }

    // --- platform hooks ---

    handleNewPlayer({ playerId, info }) {
        this.players[playerId] = { name: (info && info.name) || ('PLAYER ' + playerId) };
        if (this.phase === 'lobby') {
            this.updateLobbyUi();
            return;
        }
        if (!this.agentFor(playerId) && this.pendingJoins.indexOf(playerId) === -1) {
            if (this.humanCount() < MAX_HUMANS && this.phase === 'playing') {
                const agent = this.addAgent(playerId);
                agent.invuln = INVULN_TICKS;
                this.buildSharedHud();
                this.addTransient(this.makeGlowText(agent.name + ' ENTERED THE MAZE', 50, 10, 1.8, [57, 255, 20, 255]), 2 * TICK_RATE);
            } else {
                this.pendingJoins.push(playerId);
                this.addTransient(this.makeGlowText('YOU RAID NEXT MATCH', 50, 62, 2, INK, [0, 255, 255, 255], [playerId]), 3 * TICK_RATE);
            }
        }
        this.base.node.onStateChange();
    }

    handlePlayerDisconnect(playerId) {
        delete this.players[playerId];
        this.pendingJoins = this.pendingJoins.filter(pid => pid !== playerId);
        this.removeView(playerId);

        const agent = this.agentFor(playerId);
        if (agent) {
            if (this.phase === 'lobby') {
                this.agents.splice(this.agents.indexOf(agent), 1);
            } else {
                // The raider keeps fighting: hand the body to a bot brain.
                agent.playerId = null;
                agent.isBot = true;
                agent.name = PALETTE[agent.colorIndex].name + ' BOT';
                agent.botSight = 0;
                agent.aimTarget = null;
                this.buildSharedHud();
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

module.exports = Prism3D;
