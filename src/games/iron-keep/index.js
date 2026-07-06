const { Asset, Game, GameNode, Shapes, ShapeUtils } = require('squish-142');

// IRON KEEP — a textured multiplayer first-person shooter.
//
// The raycaster core (DDA per column, per-player playerIds-scoped views,
// fair telegraphing bots) follows prism-3d. What's new here is assets:
// texture-mapped walls (each wall slice is an Asset node cropping a thin
// vertical strip of a texture sheet), animated billboard enemies from a
// spritesheet, a panning sky panorama, weapon hands, a Doom-style status
// face tied to a 3-hit HP system, and music/SFX via audio assets.

// ---------------------------------------------------------------------------
// ASSETS — replace each id with a real one. Layout specs are load-bearing:
// the crop math assumes exactly these grids. See README.md in this directory
// for generation prompts.
// ---------------------------------------------------------------------------
const ASSET_IDS = {
    // 4 square textures side by side in a 4x1 strip (e.g. 1024x256):
    // [0] stone block  [1] wood plank  [2] royal banner  [3] iron door
    'wall-sheet': 'REPLACE_WALL_SHEET_ID',
    // one knight enemy, 4 cols x 3 rows, transparent background:
    // row 0 walk cycle (4 frames), row 1 attack (4 frames), row 2 pain/flash (4 frames)
    'enemy-sheet': 'REPLACE_ENEMY_SHEET_ID',
    // 2x1 strip, transparent background: [0] crossbow hands idle [1] firing frame
    'hands': 'REPLACE_HANDS_ID',
    // 3x1 strip of status faces: [0] healthy [1] hurt [2] near death
    'face-sheet': 'REPLACE_FACE_SHEET_ID',
    // wide panorama for the sky/battlements backdrop (e.g. 2048x512)
    'sky': 'REPLACE_SKY_ID',
    // audio
    'music': 'REPLACE_MUSIC_ID',      // loop, MUSIC_LOOP_SECONDS long
    'shoot': 'REPLACE_SHOOT_SFX_ID',  // short crossbow twang
    'hit': 'REPLACE_HIT_SFX_ID',      // short impact grunt
    'fanfare': 'REPLACE_FANFARE_ID'   // victory horns, ~3s
};

const TICK_RATE = 10;

const COLS = 40;                      // textured wall slices per player view
const COL_W = 100 / COLS;
const FOV_PLANE = 0.66;
const HEIGHT_K = 52;
const MAX_DEPTH = 16;

const MAP = 16;
const HP_MAX = 3;                     // bolts to bring a knight down
const TARGET_SLAYS = 5;
const MATCH_SECONDS = 180;
const FIRE_COOLDOWN = Math.round(0.6 * TICK_RATE);
const INVULN_TICKS = Math.round(1.5 * TICK_RATE);

const BOT_AIM_TICKS = Math.round(0.8 * TICK_RATE);
const BOT_COOLDOWN = Math.round(2 * TICK_RATE);
const BOT_ENGAGE_RANGE = 6;

const MOVE_STEP = 0.11;
const TURN_STEP = 0.1;
const BODY_RADIUS = 0.22;

const MAX_HUMANS = 4;
const MAX_SPRITES = 6;                // billboard pool size per view

const SKY_WINDOW = 35;                // % of the panorama visible at once
const MUSIC_LOOP_SECONDS = 75;        // set to your generated track's length
const SFX_TICKS = Math.round(1.2 * TICK_RATE);

const TEXT_H = 16 / 9;

// wall map cell -> texture tile in wall-sheet (4 tiles, 25% each)
const WALL_TILES = 4;
const TILE_PCT = 100 / WALL_TILES;
const STRIP_PCT = TILE_PCT / 24;      // sampled strip width within the sheet

const PALETTE = [
    { name: 'CRIMSON', color: [220, 50, 50, 255] },
    { name: 'AZURE', color: [70, 130, 255, 255] },
    { name: 'EMERALD', color: [50, 200, 90, 255] },
    { name: 'GOLD', color: [255, 200, 60, 255] },
    { name: 'VIOLET', color: [180, 90, 255, 255] },
    { name: 'ROSE', color: [255, 120, 170, 255] },
    { name: 'CYAN', color: [80, 220, 220, 255] }
];

const CEILING = [22, 18, 26, 255];
const FLOOR = [52, 42, 34, 255];
const INK = [244, 234, 210, 255];
const FAINT = [168, 152, 128, 255];
const TORCH = [255, 190, 80, 255];
const BLOOD = [190, 40, 30, 255];
const WHITE = [255, 255, 255, 255];

const glow = (color, blur) => ({ shadow: { color: [color[0], color[1], color[2], 255], blur } });
const light = (color, f) => [
    Math.round(color[0] + (255 - color[0]) * f),
    Math.round(color[1] + (255 - color[1]) * f),
    Math.round(color[2] + (255 - color[2]) * f),
    255
];

// crop spec for frame (col,row) of a cols x rows spritesheet
const frameCrop = (col, row, cols, rows) => ({
    cropLeft: (col / cols) * 100,
    cropRight: ((cols - 1 - col) / cols) * 100,
    cropTop: (row / rows) * 100,
    cropBottom: ((rows - 1 - row) / rows) * 100
});

class IronKeep extends Game {
    static metadata() {
        return {
            aspectRatio: { x: 16, y: 9 },
            squishVersion: '142',
            author: 'Homegames',
            name: 'Iron Keep',
            description: 'A texture-mapped multiplayer FPS in a haunted castle. Real-time raycasting, animated knights, and a crossbow with your name on it.',
            tickRate: TICK_RATE,
            assets: Object.keys(ASSET_IDS).reduce((assets, key) => {
                assets[key] = new Asset({
                    id: ASSET_IDS[key],
                    type: (key === 'music' || key === 'shoot' || key === 'hit' || key === 'fanfare') ? 'audio' : 'image'
                });
                return assets;
            }, {})
        };
    }

    constructor() {
        super();

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: CEILING,
            color: WHITE
        });

        // shared floor — the per-player sky panorama covers the top half
        this.base.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 50, 100, 50),
            fill: FLOOR,
            color: WHITE
        }), false);

        this.viewLayer = this.makeContainer();     // per-player textured 3D views
        this.hudShared = this.makeContainer();     // score strip + minimap
        this.tapLayer = this.makeContainer();      // per-player tap catchers
        this.buttonLayer = this.makeContainer();   // FIRE button, face, HP pips
        this.overlay = this.makeContainer();       // lobby / countdown / results
        this.audioLayer = this.makeContainer();    // transient sound nodes
        this.base.addChildren(this.viewLayer, this.hudShared, this.tapLayer, this.buttonLayer, this.overlay, this.audioLayer);

        this.players = {};
        this.agents = [];
        this.views = {};
        this.pendingJoins = [];
        this.transients = [];
        this.sfx = [];
        this.musicNode = null;
        this.musicTicksLeft = 0;
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
            fill: [30, 22, 18, 255],
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

    // --- audio ---

    playSound(key, playerIds) {
        const node = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            assetInfo: { [key]: { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 } },
            playerIds
        });
        this.audioLayer.addChild(node, false);
        this.sfx.push({ node, ticks: SFX_TICKS });
    }

    startMusic() {
        if (this.musicNode) {
            this.audioLayer.removeChild(this.musicNode.id, false);
        }
        this.musicNode = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            assetInfo: { 'music': { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, startTime: 0 } }
        });
        this.audioLayer.addChild(this.musicNode, false);
        this.musicTicksLeft = MUSIC_LOOP_SECONDS * TICK_RATE;
    }

    updateAudio() {
        for (let i = this.sfx.length - 1; i >= 0; i--) {
            const s = this.sfx[i];
            s.ticks--;
            if (s.ticks <= 0) {
                this.audioLayer.removeChild(s.node.id, false);
                this.sfx.splice(i, 1);
            }
        }
        if (this.musicNode && --this.musicTicksLeft <= 0) {
            this.startMusic();
        }
    }

    // --- castle generation ---

    generateMap() {
        // Fully open interior with a stone border, then wall runs that never
        // disconnect the floor. Cell values pick the texture: 1 stone,
        // 2 wood, 3 banner, 4 iron door (decorative accents).
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

        // scatter a few iron doors on wall cells that face open floor
        let doors = 0;
        for (let i = 0; i < 60 && doors < 6; i++) {
            const x = 1 + Math.floor(Math.random() * (MAP - 2));
            const y = 1 + Math.floor(Math.random() * (MAP - 2));
            if (this.map[y][x] > 0 && this.map[y][x] !== 4 &&
                [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.map[y + dy] && this.map[y + dy][x + dx] === 0)) {
                this.map[y][x] = 4;
                doors++;
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

        const title = this.makeGlowText('IRON KEEP', 50, 12, 6.5, INK, TORCH);
        this.titleHalos = title.slice(0, 4);
        title.forEach(n => this.overlay.addChild(n, false));

        this.overlay.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 24, text: 'A TEXTURE-MAPPED CASTLE SHOOTOUT', size: 1.8, align: 'center', font: 'monospace', color: FAINT }
        }), false);

        this.lobbyRow = this.makeContainer();
        this.overlay.addChild(this.lobbyRow, false);

        this.joinButton = this.makeButton('JOIN', 30, 52, 18, 9, TORCH, (playerId) => {
            if (this.phase !== 'lobby' || this.agentFor(playerId)) return;
            if (this.humanCount() >= MAX_HUMANS) {
                this.addTransient(this.makeGlowText('KEEP FULL - ' + MAX_HUMANS + ' KNIGHTS MAX', 50, 44, 1.8, TORCH, null, [playerId]), 2 * TICK_RATE);
                return;
            }
            this.addAgent(playerId);
            this.updateLobbyUi();
        });
        this.startButton = this.makeButton('START', 52, 52, 18, 9, [80, 220, 120, 255], (playerId) => {
            if (this.phase !== 'lobby' || !this.agentFor(playerId)) return;
            this.startMatch();
        });
        this.overlay.addChildren(this.joinButton, this.startButton);

        const lines = [
            'MOVE: UP/W - TURN: LEFT+RIGHT/A+D - FIRE: SPACE',
            'ON A PHONE: TAP LEFT/RIGHT TO TURN, CENTER TO MOVE, FIRE BUTTON TO SHOOT',
            HP_MAX + ' HITS TO SLAY - FIRST TO ' + TARGET_SLAYS + ' WINS - BOTS JOIN IF YOU ARE ALONE'
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
                textInfo: { x: 50, y: 38, text: 'NO KNIGHTS YET - TAP JOIN', size: 1.6, align: 'center', font: 'monospace', color: FAINT }
            }), false);
        } else {
            const startX = 50 - this.agents.length * 7;
            this.agents.forEach((agent, i) => {
                const x = startX + i * 14;
                this.lobbyRow.addChild(new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(x + 4.6, 34, 3, 3 * TEXT_H),
                    fill: agent.color,
                    color: WHITE,
                    effects: glow(agent.color, 8)
                }), false);
                this.lobbyRow.addChild(new GameNode.Text({
                    textInfo: { x: x + 6, y: 41, text: agent.name, size: 1.2, align: 'center', font: 'monospace', color: INK }
                }), false);
                if (agent.playerId !== null) {
                    this.lobbyRow.addChild(new GameNode.Text({
                        textInfo: { x: x + 6, y: 43.8, text: 'YOU', size: 1, align: 'center', font: 'monospace', color: TORCH },
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
            hp: HP_MAX,
            score: 0,
            cooldown: 0,
            invuln: 0,
            fireFlash: 0,
            lastMoveTick: -100,
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
            agent.hp = HP_MAX;
            agent.cooldown = 0;
            agent.invuln = INVULN_TICKS;
            agent.fireFlash = 0;
            agent.aimTarget = null;
            if (resetScores) agent.score = 0;
            this.updateVitals(agent);
        });

        this.phase = 'countdown';
        this.countdownTicks = 3 * TICK_RATE;
        this.matchTicksLeft = MATCH_SECONDS * TICK_RATE;
        this.overlay.clearChildren();
        this.transients = [];
        this.buildSharedHud();
        this.startMusic();

        this.countdownNodes = this.makeGlowText('3', 50, 32, 10, INK, TORCH);
        this.countdownNodes.forEach(n => this.overlay.addChild(n, false));
        this.agents.filter(a => a.playerId !== null).forEach(agent => {
            this.makeGlowText('YOUR PLUME IS ' + PALETTE[agent.colorIndex].name, 50, 22, 2, agent.color, null, [agent.playerId])
                .forEach(n => this.overlay.addChild(n, false));
        });

        this.base.node.onStateChange();
    }

    endMatch() {
        this.phase = 'matchEnd';
        this.overlay.clearChildren();
        this.transients = [];
        this.playSound('fanfare');

        const standings = this.agents.slice().sort((a, b) => b.score - a.score);
        const winner = standings[0];

        this.makeGlowText(winner.name + ' HOLDS THE KEEP', 50, 20, 4, light(winner.color, 0.4), winner.color)
            .forEach(n => this.overlay.addChild(n, false));
        if (winner.playerId !== null) {
            this.makeGlowText('CHAMPION', 50, 29, 2.2, TORCH, null, [winner.playerId])
                .forEach(n => this.overlay.addChild(n, false));
        }
        standings.forEach((agent, i) => {
            this.overlay.addChild(new GameNode.Text({
                textInfo: { x: 50, y: 38 + i * 4.5, text: (i + 1) + '. ' + agent.name + ' - ' + agent.score + ' SLAIN', size: 1.8, align: 'center', font: 'monospace', color: agent.color }
            }), false);
        });

        this.overlay.addChild(this.makeButton('RUN IT BACK', 36, 74, 28, 9, TORCH, (playerId) => {
            if (this.phase === 'matchEnd' && this.agentFor(playerId)) {
                this.beginRound(true);
            }
        }), false);
        this.base.node.onStateChange();
    }

    // --- per-player textured views ---

    buildView(agent) {
        const pid = agent.playerId;
        const container = this.makeContainer();

        // panning sky panorama behind the walls
        const sky = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            assetInfo: {
                'sky': { pos: { x: 0, y: 0 }, size: { x: 100, y: 50 }, cropLeft: 0, cropRight: 100 - SKY_WINDOW, cropTop: 0, cropBottom: 0 }
            },
            playerIds: [pid]
        });
        container.addChild(sky, false);

        // textured wall slices: one cropped Asset per column, created once
        const slices = [];
        for (let i = 0; i < COLS; i++) {
            const slice = new GameNode.Asset({
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                assetInfo: {
                    'wall-sheet': { pos: { x: i * COL_W, y: 49 }, size: { x: COL_W + 0.05, y: 2 }, cropLeft: 0, cropRight: 100 - STRIP_PCT, cropTop: 0, cropBottom: 0 }
                },
                playerIds: [pid]
            });
            slices.push(slice);
            container.addChild(slice, false);
        }

        // distance fog: one black overlay per column, faded via `color` alpha
        const fog = [];
        for (let i = 0; i < COLS; i++) {
            const rect = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(i * COL_W, 49, COL_W + 0.05, 2),
                fill: [0, 0, 0, 255],
                color: [0, 0, 0, 0],
                playerIds: [pid]
            });
            fog.push(rect);
            container.addChild(rect, false);
        }

        // reset global alpha after the fog pass so sprites render at full strength
        container.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill: [0, 0, 0, 255],
            color: WHITE,
            playerIds: [pid]
        }), false);

        // billboard pool: spritesheet knight + colored plume for identity
        const sprites = [];
        for (let i = 0; i < MAX_SPRITES; i++) {
            const body = new GameNode.Asset({
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                assetInfo: {
                    'enemy-sheet': { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, ...frameCrop(0, 0, 4, 3) }
                },
                playerIds: [pid]
            });
            const plume = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                fill: [0, 0, 0, 0],
                color: WHITE,
                playerIds: [pid]
            });
            sprites.push({ body, plume });
            container.addChildren(body, plume);
        }

        // crossbow hands, bottom center (under the tap catcher, so taps pass over)
        const hands = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            assetInfo: {
                'hands': { pos: { x: 38, y: 62 }, size: { x: 24, y: 38 }, ...frameCrop(0, 0, 2, 1) }
            },
            playerIds: [pid]
        });
        container.addChild(hands, false);

        const crossV = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(49.85, 47.8, 0.3, 4.4),
            fill: WHITE,
            color: [255, 255, 255, 160],
            playerIds: [pid]
        });
        const crossH = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(48.75, 49.73, 2.5, 0.55),
            fill: WHITE,
            color: [255, 255, 255, 160],
            playerIds: [pid]
        });
        container.addChildren(crossV, crossH);

        // full-screen damage flash, alpha animated via `color`
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

        // Doom-style status face + HP pips
        const face = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            assetInfo: {
                'face-sheet': { pos: { x: 31.5, y: 86 }, size: { x: 5.6, y: 10 }, ...frameCrop(0, 0, 3, 1) }
            },
            playerIds: [pid]
        });
        this.buttonLayer.addChild(face, false);
        const pips = [];
        for (let i = 0; i < HP_MAX; i++) {
            const pip = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(28.6, 86.5 + i * 3.2, 1.6, 1.6 * TEXT_H),
                fill: BLOOD,
                color: WHITE,
                playerIds: [pid]
            });
            pips.push(pip);
            this.buttonLayer.addChild(pip, false);
        }

        this.views[pid] = {
            container, sky, slices, fog, sprites, hands, flash, catcher, fireButton, face, pips,
            flashTicks: 0, handsFlashTicks: 0,
            lastDists: new Array(COLS).fill(MAX_DEPTH)
        };
        this.viewLayer.addChild(container, false);
        this.updateVitals(agent);
    }

    removeView(playerId) {
        const view = this.views[playerId];
        if (!view) return;
        this.viewLayer.removeChild(view.container.id, false);
        this.tapLayer.removeChild(view.catcher.id, false);
        this.buttonLayer.removeChild(view.fireButton.id, false);
        this.buttonLayer.removeChild(view.face.id, false);
        view.pips.forEach(pip => this.buttonLayer.removeChild(pip.id, false));
        delete this.views[playerId];
    }

    updateVitals(agent) {
        const view = this.views[agent.playerId];
        if (!view) return;
        const state = Math.max(0, Math.min(2, HP_MAX - agent.hp));
        view.face.node.asset = {
            'face-sheet': { pos: { x: 31.5, y: 86 }, size: { x: 5.6, y: 10 }, ...frameCrop(state, 0, 3, 1) }
        };
        view.pips.forEach((pip, i) => {
            pip.node.fill = i < agent.hp ? BLOOD : [60, 45, 40, 255];
        });
    }

    // the core: one textured DDA raycast per column
    renderView(agent) {
        const view = this.views[agent.playerId];
        if (!view) return;

        const dirX = Math.cos(agent.angle);
        const dirY = Math.sin(agent.angle);
        const planeX = -dirY * FOV_PLANE;
        const planeY = dirX * FOV_PLANE;

        // sky pans as you turn (ping-pong across the panorama, so no wrap snap)
        const angleFrac = (((agent.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2);
        const pan = (angleFrac < 0.5 ? angleFrac * 2 : (1 - angleFrac) * 2) * (100 - SKY_WINDOW);
        view.sky.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
        view.sky.node.asset = {
            'sky': {
                pos: { x: 0, y: 0 }, size: { x: 100, y: 50 },
                cropLeft: Math.round(pan * 100) / 100,
                cropRight: Math.round((100 - pan - SKY_WINDOW) * 100) / 100,
                cropTop: 0, cropBottom: 0
            }
        };

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

            // texture x-coordinate: where along the wall cell the ray landed
            let wallX = side === 0 ? agent.y + dist * rayY : agent.x + dist * rayX;
            wallX -= Math.floor(wallX);
            if ((side === 0 && rayX > 0) || (side === 1 && rayY < 0)) {
                wallX = 1 - wallX;
            }

            const h = Math.min(100, HEIGHT_K / dist);
            const y = 50 - h / 2;
            const colX = Math.round(col * COL_W * 100) / 100;
            const drawY = Math.round(y * 100) / 100;
            const drawH = Math.round(h * 100) / 100;

            const tile = Math.max(0, Math.min(WALL_TILES - 1, wallType - 1));
            const stripLeft = tile * TILE_PCT + wallX * (TILE_PCT - STRIP_PCT);
            const slice = view.slices[col];
            slice.node.coordinates2d = ShapeUtils.rectangle(colX, drawY, COL_W + 0.05, drawH);
            slice.node.asset = {
                'wall-sheet': {
                    pos: { x: colX, y: drawY },
                    size: { x: COL_W + 0.05, y: drawH },
                    cropLeft: Math.round(stripLeft * 100) / 100,
                    cropRight: Math.round((100 - stripLeft - STRIP_PCT) * 100) / 100,
                    cropTop: 0,
                    cropBottom: 0
                }
            };

            // shade by distance and orientation via the fog overlay's color alpha
            const shade = Math.max(0.1, Math.min(1, 1.15 / (1 + dist * 0.24))) * (side === 1 ? 0.78 : 1);
            const fogRect = view.fog[col];
            fogRect.node.coordinates2d = ShapeUtils.rectangle(colX, drawY, COL_W + 0.05, drawH);
            fogRect.node.color = [0, 0, 0, Math.min(235, Math.round(255 * (1 - shade)))];
        }

        // billboard knights: nearest visible agents claim pool slots
        const invDet = 1 / (planeX * dirY - dirX * planeY);
        const visible = [];
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
            visible.push({ other, screenX, transY });
        });
        visible.sort((a, b) => a.transY - b.transY);

        view.sprites.forEach((sprite, i) => {
            const hit = visible[i];
            if (!hit || i >= MAX_SPRITES) {
                sprite.body.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                sprite.body.node.asset = {
                    'enemy-sheet': { pos: { x: 0, y: 0 }, size: { x: 0, y: 0 }, ...frameCrop(0, 0, 4, 3) }
                };
                sprite.plume.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                sprite.plume.node.fill = [0, 0, 0, 0];
                return;
            }
            const { other, screenX, transY } = hit;
            const h = Math.min(80, (HEIGHT_K * 0.85) / transY);
            const w = h * 0.42;
            const floorY = 50 + (HEIGHT_K / transY) / 2;
            const x = Math.round((screenX - w / 2) * 100) / 100;
            const y = Math.round((floorY - h) * 100) / 100;

            const row = other.invuln > 0 ? 2 : (other.fireFlash > 0 ? 1 : 0);
            const frame = row === 1
                ? Math.min(3, 4 - other.fireFlash)
                : Math.floor(this.tickCount / 2 + other.colorIndex) % 4;

            sprite.body.node.coordinates2d = ShapeUtils.rectangle(x, y, Math.round(w * 100) / 100, Math.round(h * 100) / 100);
            sprite.body.node.asset = {
                'enemy-sheet': {
                    pos: { x, y },
                    size: { x: Math.round(w * 100) / 100, y: Math.round(h * 100) / 100 },
                    ...frameCrop(frame, row, 4, 3)
                }
            };

            // identity: a glowing plume in the agent's color above the helmet
            const plumeW = Math.max(0.5, w * 0.2);
            const plumeH = Math.max(0.8, h * 0.1);
            sprite.plume.node.coordinates2d = ShapeUtils.rectangle(
                Math.round((screenX - plumeW / 2) * 100) / 100,
                Math.round((y - plumeH - 0.5) * 100) / 100,
                Math.round(plumeW * 100) / 100,
                Math.round(plumeH * 100) / 100);
            sprite.plume.node.fill = other.color;
            sprite.plume.node.effects = transY < 8 ? glow(other.color, 10) : null;
        });

        // crossbow kick + firing frame
        if (view.handsFlashTicks > 0) {
            view.handsFlashTicks--;
            view.hands.node.asset = {
                'hands': { pos: { x: 38, y: 64 }, size: { x: 24, y: 38 }, ...frameCrop(1, 0, 2, 1) }
            };
        } else {
            const moving = this.tickCount - agent.lastMoveTick < 3;
            const bob = moving ? Math.sin(this.tickCount * 0.9) * 1.2 : 0;
            view.hands.node.asset = {
                'hands': { pos: { x: 38, y: 62 + bob }, size: { x: 24, y: 38 }, ...frameCrop(0, 0, 2, 1) }
            };
        }

        // damage flash decay
        if (view.flashTicks > 0) {
            view.flashTicks--;
            view.flash.node.color = [255, 40, 40, Math.round(120 * view.flashTicks / 4)];
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
                color: WHITE
            }), false);
            this.hudShared.addChild(new GameNode.Text({
                textInfo: { x: x + 2.2, y: 1.8, text: agent.name, size: 1.1, font: 'monospace', color: INK }
            }), false);
            const score = new GameNode.Text({
                textInfo: { x: x + 2.2, y: 4.4, text: '0/' + TARGET_SLAYS, size: 1.1, font: 'monospace', color: TORCH }
            });
            this.scoreTexts[i] = score;
            this.hudShared.addChild(score, false);
            if (agent.playerId !== null) {
                this.hudShared.addChild(new GameNode.Text({
                    textInfo: { x: x + 10.2, y: 1.8, text: 'YOU', size: 1, font: 'monospace', color: TORCH },
                    playerIds: [agent.playerId]
                }), false);
            }
        });

        this.timerText = new GameNode.Text({
            textInfo: { x: 50, y: 1.8, text: String(MATCH_SECONDS), size: 1.6, align: 'center', font: 'monospace', color: TORCH }
        });
        this.hudShared.addChild(this.timerText, false);

        // minimap: merged wall strips keep the whole castle ~30 nodes
        const mapX = 82;
        const mapY = 68;
        const cell = 1;
        this.minimap = { x: mapX, y: mapY, cell };
        this.hudShared.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(mapX - 0.4, mapY - 0.4, MAP * cell + 0.8, MAP * cell * TEXT_H * 0.5625 + 0.8),
            fill: [20, 14, 10, 220],
            color: TORCH,
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
                        fill: [120, 96, 68, 255]
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
                color: WHITE
            });
            this.mapDots.push(dot);
            this.hudShared.addChild(dot, false);
        });
    }

    updateHud() {
        this.agents.forEach((agent, i) => {
            if (this.scoreTexts && this.scoreTexts[i]) {
                this.scoreTexts[i].node.text.text = agent.score + '/' + TARGET_SLAYS;
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
            this.timerText.node.text.color = secs <= 20 ? [255, 80, 80, 255] : TORCH;
        }
    }

    // --- movement / combat ---

    tryMove(agent, forward) {
        const nx = agent.x + Math.cos(agent.angle) * MOVE_STEP * forward;
        const ny = agent.y + Math.sin(agent.angle) * MOVE_STEP * forward;
        if (!this.isWall(nx + Math.sign(nx - agent.x) * BODY_RADIUS, agent.y) &&
            !this.isWall(nx, agent.y + BODY_RADIUS) && !this.isWall(nx, agent.y - BODY_RADIUS)) {
            agent.x = nx;
        }
        if (!this.isWall(agent.x, ny + Math.sign(ny - agent.y) * BODY_RADIUS) &&
            !this.isWall(agent.x + BODY_RADIUS, ny) && !this.isWall(agent.x - BODY_RADIUS, ny)) {
            agent.y = ny;
        }
        agent.lastMoveTick = this.tickCount;
    }

    tryFire(agent) {
        if (!agent || this.phase !== 'playing' || agent.cooldown > 0) return;
        agent.cooldown = FIRE_COOLDOWN;
        agent.fireFlash = 4;

        if (agent.playerId !== null) {
            const view = this.views[agent.playerId];
            if (view) view.handsFlashTicks = 3;
            this.playSound('shoot', [agent.playerId]);
        }

        // hitscan: march the facing ray; first knight hit before a wall takes a bolt
        const dirX = Math.cos(agent.angle);
        const dirY = Math.sin(agent.angle);
        for (let step = 0.3; step < 12; step += 0.12) {
            const px = agent.x + dirX * step;
            const py = agent.y + dirY * step;
            if (this.isWall(px, py)) return;
            const victim = this.agents.find(other => other !== agent && other.invuln <= 0 &&
                (other.x - px) ** 2 + (other.y - py) ** 2 < 0.14);
            if (victim) {
                this.strike(agent, victim);
                return;
            }
        }
    }

    strike(shooter, victim) {
        victim.hp--;
        this.updateVitals(victim);

        const victimView = this.views[victim.playerId];
        if (victimView) {
            victimView.flash.node.fill = [255, 40, 40, 255];
            victimView.flashTicks = 4;
        }
        if (victim.playerId !== null) {
            this.playSound('hit', [victim.playerId]);
        }

        if (victim.hp > 0) return;

        // slain: score, respawn, announce
        shooter.score++;
        const spawn = this.randomSpawn();
        victim.x = spawn.x;
        victim.y = spawn.y;
        victim.angle = Math.random() * Math.PI * 2;
        victim.hp = HP_MAX;
        victim.invuln = INVULN_TICKS;
        victim.aimTarget = null;
        this.updateVitals(victim);

        if (victim.playerId !== null) {
            this.addTransient(this.makeGlowText('SLAIN BY ' + shooter.name, 50, 62, 2, victim.color, [255, 60, 60, 255], [victim.playerId]), TICK_RATE);
        }
        if (shooter.playerId !== null) {
            this.addTransient(this.makeGlowText('YOU SLEW ' + victim.name + '!', 50, 62, 2, light(shooter.color, 0.3), shooter.color, [shooter.playerId]), TICK_RATE);
        }

        if (shooter.score >= TARGET_SLAYS) {
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
        // aiming: stand still and visibly turn toward the target — the
        // telegraph is the victim's window to dodge or shoot back
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
                bot.angle += Math.max(-0.26, Math.min(0.26, diff));

                if (--bot.aimTicks <= 0) {
                    bot.angle = want + (Math.random() - 0.5) * (0.1 + dist * 0.05);
                    this.tryFire(bot);
                    bot.cooldown = BOT_COOLDOWN;
                    bot.aimTarget = null;
                }
                return;
            }
        }

        // wander: keep walking, turn away from walls, jitter occasionally
        const aheadX = bot.x + Math.cos(bot.angle) * 0.7;
        const aheadY = bot.y + Math.sin(bot.angle) * 0.7;
        if (this.isWall(aheadX, aheadY)) {
            bot.angle += (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2 + (Math.random() - 0.5) * 0.8);
        } else if (Math.random() < 0.04) {
            bot.angle += (Math.random() - 0.5) * 1.2;
        }
        this.tryMove(bot, 0.75);

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
                    halo.node.text.color = [TORCH[0], TORCH[1], TORCH[2], alpha];
                });
            }
        } else if (this.phase === 'countdown') {
            this.countdownTicks--;
            if (this.countdownTicks <= 0) {
                this.phase = 'playing';
                this.overlay.clearChildren();
                this.transients = [];
                this.addTransient(this.makeGlowText('FIGHT', 50, 30, 8, INK, TORCH), 8);
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
                if (agent.fireFlash > 0) agent.fireFlash--;
                if (agent.isBot) this.botThink(agent);
            });
            this.agents.filter(a => a.playerId !== null).forEach(a => this.renderView(a));
            this.updateHud();
            if (this.matchTicksLeft <= 0 && this.phase === 'playing') {
                this.endMatch();
            }
        }

        this.updateTransients();
        this.updateAudio();
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
        if (!agent || this.phase !== 'playing') return;
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
                this.addTransient(this.makeGlowText(agent.name + ' STORMS THE KEEP', 50, 10, 1.8, [80, 220, 120, 255]), 2 * TICK_RATE);
            } else {
                this.pendingJoins.push(playerId);
                this.addTransient(this.makeGlowText('YOU FIGHT NEXT MATCH', 50, 62, 2, INK, TORCH, [playerId]), 3 * TICK_RATE);
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
                // the knight fights on: hand the body to a bot brain
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

module.exports = IronKeep;
