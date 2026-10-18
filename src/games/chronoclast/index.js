'use strict';

// SPDX-License-Identifier: MIT

const { Game, GameNode, Shapes, ShapeUtils } = require('squish-150');

const TUNING = {
    TICK_RATE: 60, // tickRate - MUST match the literal in metadata()
    MAX_PLAYERS: 1, // maxPlayers - MUST match the literal in metadata()
    WORLD_SIZE: 400,
    VIEW_SIZE: 92,
    MAX_ENEMIES: 32,
    MAX_PLAYER_BULLETS: 128,
    MAX_ENEMY_BULLETS: 160,
    MAX_PARTICLES: 120,
    MAX_PICKUPS: 32,
    MAX_ECHOES: 6,
    MAX_CRYSTALS: 24,
    LOOP_SECONDS: 6,
    PLAYER_SPEED: 25,
    PLAYER_MAX_HEALTH: 100,
    PLAYER_FIRE_RATE: 8.5,
    PLAYER_BULLET_SPEED: 58,
    PLAYER_DAMAGE: 13,
    DASH_DISTANCE: 13,
    DASH_COOLDOWN_SECONDS: 1.25,
    ECHO_COOLDOWN_SECONDS: 7,
    TIME_BREAK_SECONDS: 3.5,
    TIME_BREAK_COOLDOWN_SECONDS: 17,
    TIME_BREAK_SCALE: 0.22,
    ENEMY_SPAWN_SECONDS: 0.9,
    BOSS_RADIAL_SECONDS: 1.3,
    BOSS_LASER_SECONDS: 2.9,
    STATUS_SECONDS: 2.2
};

const COLORS = {
    black: [5, 7, 12, 255],
    deep: [9, 13, 23, 255],
    panel: [14, 20, 33, 240],
    panelAlt: [24, 32, 49, 245],
    line: [54, 70, 95, 255],
    white: [244, 247, 255, 255],
    muted: [148, 161, 186, 255],
    player: [72, 232, 255, 255],
    playerDark: [16, 88, 116, 255],
    echo: [174, 111, 255, 255],
    echoDark: [72, 35, 130, 255],
    enemy: [255, 73, 101, 255],
    enemyDark: [115, 23, 46, 255],
    spitter: [255, 155, 70, 255],
    splitter: [255, 82, 210, 255],
    warden: [255, 222, 82, 255],
    boss: [255, 46, 133, 255],
    bossCore: [255, 219, 248, 255],
    xp: [102, 255, 140, 255],
    crystal: [80, 133, 255, 255],
    crystalCore: [164, 211, 255, 255],
    anchor: [255, 91, 229, 255],
    anchorDark: [104, 30, 116, 255],
    danger: [255, 67, 67, 255],
    gold: [255, 207, 77, 255],
    slow: [102, 142, 255, 255],
    transparent: [0, 0, 0, 0]
};

const SEEDS = [2039, 777, 14027, 31337, 8675309, 424242, 10101, 9001];

const UPGRADE_DEFS = {
    rapidCore: { name: 'RAPID CORE', description: '+24% fire rate' },
    heavyShards: { name: 'HEAVY SHARDS', description: '+35% damage and size' },
    trident: { name: 'TRIDENT ARRAY', description: 'Fire two angled side shots' },
    phaseAmmo: { name: 'PHASE AMMO', description: 'Shots pierce one more target' },
    echoForge: { name: 'ECHO FORGE', description: '+35% echo damage' },
    longMemory: { name: 'LONG MEMORY', description: '+1 active echo slot' },
    bloodLoop: { name: 'BLOOD LOOP', description: 'Kills restore health' },
    dashNova: { name: 'DASH NOVA', description: 'Dash erases bullets and hurts enemies' },
    timeDebt: { name: 'TIME DEBT', description: 'Longer Time Break' },
    magnet: { name: 'EVENT HORIZON', description: 'Collect flux from farther away' },
    overcharge: { name: 'OVERCHARGE', description: '+25 max health and heal' },
    seeker: { name: 'SEEKER SHARDS', description: 'Shots bend toward nearby enemies' }
};
const UPGRADE_KEYS = Object.keys(UPGRADE_DEFS);

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function distanceXY(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
}

function normalize(dx, dy) {
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < 0.0001) return { x: 0, y: 0 };
    return { x: dx / length, y: dy / length };
}

function rectangle(x, y, width, height) {
    return ShapeUtils.rectangle(x, y, width, height);
}

function polyCircle(cx, cy, radius, sides = 16) {
    const points = [];
    for (let index = 0; index <= sides; index += 1) {
        const angle = index / sides * Math.PI * 2;
        points.push([clamp(cx + Math.cos(angle) * radius, 0, 100), clamp(cy + Math.sin(angle) * radius, 0, 100)]);
    }
    return points;
}

function facingTriangle(cx, cy, angle, size) {
    return [
        [clamp(cx + Math.cos(angle) * size, 0, 100), clamp(cy + Math.sin(angle) * size, 0, 100)],
        [clamp(cx + Math.cos(angle + 2.45) * size, 0, 100), clamp(cy + Math.sin(angle + 2.45) * size, 0, 100)],
        [clamp(cx + Math.cos(angle - 2.45) * size, 0, 100), clamp(cy + Math.sin(angle - 2.45) * size, 0, 100)],
        [clamp(cx + Math.cos(angle) * size, 0, 100), clamp(cy + Math.sin(angle) * size, 0, 100)]
    ];
}

function thickLine(x1, y1, x2, y2, width) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const dx = Math.sin(angle) * width / 2;
    const dy = Math.cos(angle) * width / 2;
    return [
        [clamp(x1 - dx, 0, 100), clamp(y1 + dy, 0, 100)],
        [clamp(x2 - dx, 0, 100), clamp(y2 + dy, 0, 100)],
        [clamp(x2 + dx, 0, 100), clamp(y2 - dy, 0, 100)],
        [clamp(x1 + dx, 0, 100), clamp(y1 - dy, 0, 100)],
        [clamp(x1 - dx, 0, 100), clamp(y1 + dy, 0, 100)]
    ];
}

function colorAlpha(color, alpha) {
    return [color[0], color[1], color[2], clamp(Math.round(alpha), 0, 255)];
}

function glow(color, blur) {
    return { shadow: { color: [color[0], color[1], color[2], 255], blur } };
}

function mulberry32(seed) {
    let value = seed >>> 0;
    return function random() {
        value += 0x6D2B79F5;
        let result = value;
        result = Math.imul(result ^ result >>> 15, result | 1);
        result ^= result + Math.imul(result ^ result >>> 7, result | 61);
        return ((result ^ result >>> 14) >>> 0) / 4294967296;
    };
}

function shuffle(items, random) {
    const copy = items.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
        const other = Math.floor(random() * (index + 1));
        const temporary = copy[index];
        copy[index] = copy[other];
        copy[other] = temporary;
    }
    return copy;
}

function makeContainer(playerIds) {
    return new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: rectangle(0, 0, 0, 0),
        fill: COLORS.transparent,
        color: COLORS.transparent,
        playerIds
    });
}

function makeText(text, x, y, size, color, align = 'center', playerIds) {
    return new GameNode.Text({
        textInfo: { text, x, y, size, align, color, font: 'monospace' },
        playerIds
    });
}

function setText(node, text, x, y, size, color, align = 'center') {
    node.node.text = { text, x, y, size, align, color, font: 'monospace' };
}

function hideShape(node) {
    node.node.coordinates2d = rectangle(0, 0, 0, 0);
    node.node.fill = COLORS.transparent;
    node.node.color = COLORS.transparent;
    node.node.effects = null;
}

function makeButton(x, y, width, height, label, onClick, accent = COLORS.line) {
    const shape = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: rectangle(x, y, width, height),
        fill: COLORS.panelAlt,
        color: accent,
        border: 4,
        onClick
    });
    const text = makeText(label, x + width / 2, y + height / 2 - 0.8, 1.15, COLORS.white);
    shape.addChild(text);
    return { group: shape, shape, text, x, y, width, height };
}

class Chronoclast extends Game {
    static metadata() {
        return {
            isTest: true,
            thumbnail: './assets/thumbnail.png',
            name: 'Chronoclast',
            author: "Joseph Garcia",
            description: 'A time-clone action adventure. Record your combat, build an army from your own past, and break the Paradox Engine.',
            aspectRatio: { x: 1, y: 1 },
            tickRate: 60,
            maxPlayers: 1,
            gameId: "529bdbf9-b584-50ab-a938-6538b5e705e3"
        };
    }

    constructor() {
        super();
        this.phase = 'title';
        this.playerId = null;
        this.tickCount = 0;
        this.runTicks = 0;
        this.seedIndex = 0;
        this.seed = SEEDS[0];
        this.random = mulberry32(this.seed);
        this.keys = {};
        this.pendingDash = false;
        this.pendingEcho = false;
        this.pendingTimeBreak = false;
        this.tapFireTicks = 0;
        this.tapAim = { x: 1, y: 0 };
        this.moveTarget = null;
        this.cameraX = TUNING.WORLD_SIZE / 2;
        this.cameraY = TUNING.WORLD_SIZE / 2;
        this.cameraShake = 0;
        this.statusText = '';
        this.statusUntil = 0;
        this.freezeTicks = 0;
        this.nextEnemySpawnAt = 0;
        this.anchorIndex = 0;
        this.anchorsDestroyed = 0;
        this.score = 0;
        this.bestCombo = 0;
        this.combo = 0;
        this.comboUntil = 0;
        this.upgradeChoices = [];
        this.world = null;
        this.player = null;
        this.enemies = [];
        this.playerBullets = [];
        this.enemyBullets = [];
        this.particles = [];
        this.pickups = [];
        this.echoes = [];
        this.crystals = [];
        this.anchors = [];
        this.boss = null;
        this.inputHistory = new Array(TUNING.LOOP_SECONDS * TUNING.TICK_RATE).fill(null);
        this.historyWrite = 0;
        this.historyFilled = 0;
        this.echoSerial = 0;

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 0, 100, 100),
            fill: COLORS.black,
            color: COLORS.black
        });
        this.titleLayer = makeContainer();
        this.worldLayer = makeContainer();
        this.entityLayer = makeContainer();
        this.effectLayer = makeContainer();
        this.hudLayer = makeContainer();
        this.overlayLayer = makeContainer();
        this.base.addChildren(this.titleLayer, this.worldLayer, this.entityLayer, this.effectLayer, this.hudLayer, this.overlayLayer);
        this.renderTitle();
    }

    getLayers() {
        return [{ root: this.base }];
    }

    handleNewPlayer({ playerId }) {
        if (this.playerId !== null) return;
        this.playerId = Number(playerId);
        this.renderTitle();
        this.base.node.onStateChange();
    }

    handlePlayerDisconnect(playerId) {
        if (Number(playerId) === this.playerId) this.playerId = null;
    }

    handleKeyDown(playerId, key) {
        if (this.playerId !== null && Number(playerId) !== this.playerId) return;
        this.keys[key] = true;
        if (this.phase === 'title') {
            if (key === 'Enter' || key === ' ') this.startRun();
            else if (key === 'ArrowLeft' || key === 'a' || key === 'A') this.cycleSeed(-1);
            else if (key === 'ArrowRight' || key === 'd' || key === 'D') this.cycleSeed(1);
            return;
        }
        if (this.phase === 'upgrade') {
            if (key === '1') this.chooseUpgrade(0);
            else if (key === '2') this.chooseUpgrade(1);
            else if (key === '3') this.chooseUpgrade(2);
            return;
        }
        if (this.phase === 'victory' || this.phase === 'defeat') {
            if (key === 'Enter' || key === 'r' || key === 'R' || key === ' ') this.startRun();
            return;
        }
        if (this.phase !== 'running') return;
        if (key === ' ') this.pendingDash = true;
        else if (key === 'e' || key === 'E') this.pendingEcho = true;
        else if (key === 'q' || key === 'Q') this.pendingTimeBreak = true;
    }

    handleKeyUp(playerId, key) {
        if (this.playerId !== null && Number(playerId) !== this.playerId) return;
        delete this.keys[key];
    }

    tick() {
        this.tickCount += 1;
        if (this.phase === 'running') {
            if (this.freezeTicks > 0) {
                this.freezeTicks -= 1;
                this.updateParticles(1 / TUNING.TICK_RATE);
                this.renderFrame();
                this.base.node.onStateChange();
                return;
            }
            this.runTicks += 1;
            this.updateRunning();
            this.renderFrame();
            this.base.node.onStateChange();
        } else if (this.phase === 'upgrade') {
            this.updateParticles(0.35 / TUNING.TICK_RATE);
            this.renderFrame();
            this.base.node.onStateChange();
        } else if ((this.phase === 'victory' || this.phase === 'defeat') && this.tickCount % 3 === 0) {
            this.updateParticles(0.5 / TUNING.TICK_RATE);
            this.renderFrame();
            this.base.node.onStateChange();
        }
    }

    renderTitle() {
        this.phase = 'title';
        this.titleLayer.clearChildren();
        this.worldLayer.clearChildren();
        this.entityLayer.clearChildren();
        this.effectLayer.clearChildren();
        this.hudLayer.clearChildren();
        this.overlayLayer.clearChildren();
        this.base.node.fill = COLORS.black;

        this.titleLayer.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: polyCircle(50, 35, 22, 32),
            fill: [10, 18, 34, 255],
            color: COLORS.echo,
            border: 4,
            effects: glow(COLORS.echo, 16)
        }));
        for (let index = 0; index < 6; index += 1) {
            const angle = index / 6 * Math.PI * 2;
            this.titleLayer.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: facingTriangle(50 + Math.cos(angle) * 17, 35 + Math.sin(angle) * 17, angle, 2.5),
                fill: colorAlpha(COLORS.echo, 170 - index * 15),
                color: COLORS.transparent
            }));
        }

        this.titleLayer.addChild(makeText('WASD move   /   Arrows fire   /   Space dash', 50, 65, 1.5, COLORS.muted));
        this.titleLayer.addChild(makeText('E summons your last six seconds as an ally.', 50, 70, 1.5, COLORS.muted));
        this.titleLayer.addChild(makeText(`RIFT SEED ${this.seedIndex + 1} / ${SEEDS.length}   [A/D TO CHANGE]`, 50, 76, 1.25, COLORS.gold));
        const start = makeButton(28, 82, 44, 10, 'PLAY', () => this.startRun(), COLORS.player);
        start.shape.node.fill = COLORS.playerDark;
        this.titleLayer.addChild(start.group);
        this.titleLayer.addChild(makeText(this.playerId === null ? 'JOIN AS A PLAYER TO BEGIN' : 'PRESS ENTER OR CLICK START', 50, 96, 1, this.playerId === null ? COLORS.danger : COLORS.xp));
    }

    cycleSeed(direction) {
        if (this.phase !== 'title') return;
        this.seedIndex = (this.seedIndex + direction + SEEDS.length) % SEEDS.length;
        this.seed = SEEDS[this.seedIndex];
        this.renderTitle();
        this.base.node.onStateChange();
    }

    startRun() {
        if (this.playerId === null) return;
        this.phase = 'running';
        this.runTicks = 0;
        this.tickCount = 0;
        this.seed = SEEDS[this.seedIndex];
        this.random = mulberry32(this.seed);
        this.keys = {};
        this.pendingDash = false;
        this.pendingEcho = false;
        this.pendingTimeBreak = false;
        this.tapFireTicks = 0;
        this.moveTarget = null;
        this.cameraShake = 0;
        this.statusText = 'Move and fire. Press E to summon a copy of your last six seconds.';
        this.statusUntil = TUNING.STATUS_SECONDS * TUNING.TICK_RATE * 2;
        this.freezeTicks = 0;
        this.nextEnemySpawnAt = Math.round(0.8 * TUNING.TICK_RATE);
        this.anchorIndex = 0;
        this.anchorsDestroyed = 0;
        this.score = 0;
        this.combo = 0;
        this.bestCombo = 0;
        this.comboUntil = 0;
        this.upgradeChoices = [];
        this.inputHistory.fill(null);
        this.historyWrite = 0;
        this.historyFilled = 0;
        this.echoSerial = 0;
        this.titleLayer.clearChildren();
        this.worldLayer.clearChildren();
        this.entityLayer.clearChildren();
        this.effectLayer.clearChildren();
        this.hudLayer.clearChildren();
        this.overlayLayer.clearChildren();
        this.generateWorld();
        this.createPlayer();
        this.createPools();
        this.createHUD();
        this.activateAnchor(0);
        this.cameraX = this.player.x;
        this.cameraY = this.player.y;
        this.renderFrame();
        this.base.node.onStateChange();
    }

    generateWorld() {
        const random = mulberry32(this.seed);
        this.world = {
            seed: this.seed,
            stars: [],
            gridOffset: random() * 18,
            centerX: TUNING.WORLD_SIZE / 2,
            centerY: TUNING.WORLD_SIZE / 2
        };
        for (let index = 0; index < 72; index += 1) {
            this.world.stars.push({
                x: random() * TUNING.WORLD_SIZE,
                y: random() * TUNING.WORLD_SIZE,
                size: 0.08 + random() * 0.25,
                alpha: 70 + Math.floor(random() * 130)
            });
        }

        this.crystals = [];
        let guard = 0;
        while (this.crystals.length < TUNING.MAX_CRYSTALS && guard < 1000) {
            guard += 1;
            const candidate = {
                id: this.crystals.length,
                x: 24 + random() * (TUNING.WORLD_SIZE - 48),
                y: 24 + random() * (TUNING.WORLD_SIZE - 48),
                radius: 2.2 + random() * 2.8,
                maxHealth: 30 + Math.floor(random() * 50),
                health: 0,
                active: true,
                pulse: random() * Math.PI * 2,
                bodyNode: null,
                coreNode: null
            };
            candidate.health = candidate.maxHealth;
            if (distanceXY(candidate.x, candidate.y, TUNING.WORLD_SIZE / 2, TUNING.WORLD_SIZE / 2) < 35) continue;
            if (this.crystals.some((crystal) => distanceXY(candidate.x, candidate.y, crystal.x, crystal.y) < candidate.radius + crystal.radius + 10)) continue;
            this.crystals.push(candidate);
        }

        const quadrants = [
            { minX: 35, maxX: 145, minY: 35, maxY: 145 },
            { minX: 255, maxX: 365, minY: 35, maxY: 145 },
            { minX: 255, maxX: 365, minY: 255, maxY: 365 },
            { minX: 35, maxX: 145, minY: 255, maxY: 365 }
        ];
        this.anchors = quadrants.map((area, index) => ({
            id: index,
            x: area.minX + random() * (area.maxX - area.minX),
            y: area.minY + random() * (area.maxY - area.minY),
            maxHealth: 230 + index * 70,
            health: 230 + index * 70,
            active: false,
            destroyed: false,
            bodyNode: null,
            coreNode: null,
            ringNode: null,
            rotation: random() * Math.PI * 2
        }));
    }

    createPlayer() {
        this.player = {
            x: TUNING.WORLD_SIZE / 2,
            y: TUNING.WORLD_SIZE / 2 + 30,
            radius: 1.9,
            facing: -Math.PI / 2,
            health: TUNING.PLAYER_MAX_HEALTH,
            maxHealth: TUNING.PLAYER_MAX_HEALTH,
            speed: TUNING.PLAYER_SPEED,
            damage: TUNING.PLAYER_DAMAGE,
            bulletSpeed: TUNING.PLAYER_BULLET_SPEED,
            bulletSize: 0.65,
            fireRate: TUNING.PLAYER_FIRE_RATE,
            fireReady: 0,
            dashReady: 0,
            echoReady: 0,
            timeBreakReady: 0,
            timeBreakUntil: 0,
            invulnerableUntil: 0,
            xp: 0,
            level: 1,
            nextXp: 18,
            kills: 0,
            rewinds: 0,
            upgrades: {},
            echoDamage: 0.58,
            echoSlots: 2,
            pierce: 0,
            split: 0,
            magnetRadius: 7,
            bodyNode: null,
            coreNode: null,
            ringNode: null
        };
    }

    createPools() {
        this.createBackgroundNodes();
        this.createWorldNodes();
        this.createEntityPools();
    }

    createBackgroundNodes() {
        this.backgroundGrid = [];
        for (let index = 0; index < 20; index += 1) {
            const node = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: colorAlpha(COLORS.line, 38),
                color: COLORS.transparent
            });
            this.backgroundGrid.push(node);
            this.worldLayer.addChild(node);
        }
        this.starNodes = [];
        for (let index = 0; index < 52; index += 1) {
            const node = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: COLORS.transparent,
                color: COLORS.transparent
            });
            this.starNodes.push(node);
            this.worldLayer.addChild(node);
        }
        this.riftFogNodes = [];
        for (let index = 0; index < 12; index += 1) {
            const node = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: COLORS.transparent,
                color: COLORS.transparent
            });
            this.riftFogNodes.push(node);
            this.worldLayer.addChild(node);
        }
    }

    createWorldNodes() {
        for (const crystal of this.crystals) {
            crystal.bodyNode = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: COLORS.transparent,
                color: COLORS.transparent,
                border: 3
            });
            crystal.coreNode = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: COLORS.transparent,
                color: COLORS.transparent
            });
            this.worldLayer.addChildren(crystal.bodyNode, crystal.coreNode);
        }
        for (const anchor of this.anchors) {
            anchor.bodyNode = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: COLORS.transparent,
                color: COLORS.transparent,
                border: 6,
                effects: glow(COLORS.anchor, 10)
            });
            anchor.coreNode = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: COLORS.transparent,
                color: COLORS.transparent
            });
            anchor.ringNode = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: COLORS.transparent,
                color: COLORS.transparent,
                border: 4
            });
            this.worldLayer.addChildren(anchor.ringNode, anchor.bodyNode, anchor.coreNode);
        }
    }

    createEntityPools() {
        this.player.bodyNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 0, 0, 0),
            fill: COLORS.player,
            color: COLORS.white,
            border: 4,
            effects: glow(COLORS.player, 10)
        });
        this.player.coreNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 0, 0, 0),
            fill: COLORS.white,
            color: COLORS.transparent
        });
        this.player.ringNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 0, 0, 0),
            fill: COLORS.transparent,
            color: COLORS.player,
            border: 4
        });
        this.entityLayer.addChildren(this.player.ringNode, this.player.bodyNode, this.player.coreNode);

        this.echoes = [];
        for (let index = 0; index < TUNING.MAX_ECHOES; index += 1) {
            const echo = {
                id: index,
                active: false,
                frames: null,
                frameIndex: 0,
                x: 0,
                y: 0,
                anchorX: 0,
                anchorY: 0,
                facing: 0,
                fireReady: 0,
                serial: 0,
                bodyNode: new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: rectangle(0, 0, 0, 0),
                    fill: COLORS.transparent,
                    color: COLORS.transparent,
                    border: 3,
                    effects: glow(COLORS.echo, 7)
                }),
                ringNode: new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: rectangle(0, 0, 0, 0),
                    fill: COLORS.transparent,
                    color: COLORS.transparent,
                    border: 3
                })
            };
            this.echoes.push(echo);
            this.entityLayer.addChildren(echo.ringNode, echo.bodyNode);
        }

        this.enemies = [];
        for (let index = 0; index < TUNING.MAX_ENEMIES; index += 1) {
            const enemy = {
                id: index,
                active: false,
                type: 'drone',
                x: 0,
                y: 0,
                radius: 1.6,
                health: 0,
                maxHealth: 0,
                speed: 0,
                attackReady: 0,
                shootReady: 0,
                orbitAngle: 0,
                parentSpawn: false,
                bodyNode: new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: rectangle(0, 0, 0, 0),
                    fill: COLORS.transparent,
                    color: COLORS.transparent,
                    border: 3
                }),
                coreNode: new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: rectangle(0, 0, 0, 0),
                    fill: COLORS.transparent,
                    color: COLORS.transparent
                })
            };
            this.enemies.push(enemy);
            this.entityLayer.addChildren(enemy.bodyNode, enemy.coreNode);
        }

        this.playerBullets = [];
        for (let index = 0; index < TUNING.MAX_PLAYER_BULLETS; index += 1) {
            const bullet = {
                id: index,
                active: false,
                x: 0,
                y: 0,
                vx: 0,
                vy: 0,
                radius: 0.6,
                damage: 0,
                ttl: 0,
                pierce: 0,
                echo: false,
                node: new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: rectangle(0, 0, 0, 0),
                    fill: COLORS.transparent,
                    color: COLORS.transparent,
                    border: 2
                })
            };
            this.playerBullets.push(bullet);
            this.entityLayer.addChild(bullet.node);
        }

        this.enemyBullets = [];
        for (let index = 0; index < TUNING.MAX_ENEMY_BULLETS; index += 1) {
            const bullet = {
                id: index,
                active: false,
                x: 0,
                y: 0,
                vx: 0,
                vy: 0,
                radius: 0.75,
                ttl: 0,
                damage: 0,
                color: COLORS.enemy,
                node: new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: rectangle(0, 0, 0, 0),
                    fill: COLORS.transparent,
                    color: COLORS.transparent,
                    border: 2
                })
            };
            this.enemyBullets.push(bullet);
            this.entityLayer.addChild(bullet.node);
        }

        this.pickups = [];
        for (let index = 0; index < TUNING.MAX_PICKUPS; index += 1) {
            const pickup = {
                id: index,
                active: false,
                x: 0,
                y: 0,
                value: 0,
                life: 0,
                phase: index * 0.7,
                node: new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: rectangle(0, 0, 0, 0),
                    fill: COLORS.transparent,
                    color: COLORS.transparent,
                    effects: index < 6 ? glow(COLORS.xp, 4) : null
                })
            };
            this.pickups.push(pickup);
            this.entityLayer.addChild(pickup.node);
        }

        this.particles = [];
        for (let index = 0; index < TUNING.MAX_PARTICLES; index += 1) {
            const particle = {
                id: index,
                active: false,
                x: 0,
                y: 0,
                vx: 0,
                vy: 0,
                life: 0,
                maxLife: 0,
                size: 0,
                growth: 0,
                color: COLORS.white,
                node: new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: rectangle(0, 0, 0, 0),
                    fill: COLORS.transparent,
                    color: COLORS.transparent
                })
            };
            this.particles.push(particle);
            this.effectLayer.addChild(particle.node);
        }

        this.boss = {
            active: false,
            x: TUNING.WORLD_SIZE / 2,
            y: TUNING.WORLD_SIZE / 2,
            radius: 7,
            health: 0,
            maxHealth: 0,
            phase: 1,
            angle: 0,
            attackReady: 0,
            teleportReady: 0,
            laserReady: 0,
            laserUntil: 0,
            summonReady: 0,
            bodyNode: new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: COLORS.transparent,
                color: COLORS.transparent,
                border: 7,
                effects: glow(COLORS.boss, 18)
            }),
            coreNode: new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: COLORS.transparent,
                color: COLORS.transparent,
                effects: glow(COLORS.bossCore, 8)
            }),
            ringNode: new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: COLORS.transparent,
                color: COLORS.transparent,
                border: 5
            }),
            laserNodes: []
        };
        this.entityLayer.addChildren(this.boss.ringNode, this.boss.bodyNode, this.boss.coreNode);
        for (let index = 0; index < 4; index += 1) {
            const node = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: COLORS.transparent,
                color: COLORS.transparent,
                effects: index === 0 ? glow(COLORS.boss, 8) : null
            });
            this.boss.laserNodes.push(node);
            this.effectLayer.addChild(node);
        }
    }

    createHUD() {
        this.worldCatcher = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 0, 100, 100),
            fill: COLORS.transparent,
            color: COLORS.transparent,
            onClick: (playerId, x, y) => this.handleWorldClick(Number(playerId), x, y)
        });
        this.hudLayer.addChild(this.worldCatcher);

        this.hudTop = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 0, 100, 8),
            fill: COLORS.panel,
            color: COLORS.line,
            border: 2
        });
        this.hudBottom = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 91, 100, 9),
            fill: COLORS.panel,
            color: COLORS.line,
            border: 2
        });
        this.hudLayer.addChildren(this.hudTop, this.hudBottom);

        this.healthBack = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: rectangle(3, 2, 25, 3), fill: COLORS.enemyDark, color: COLORS.transparent });
        this.healthFill = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: rectangle(3, 2, 25, 3), fill: COLORS.player, color: COLORS.transparent });
        this.xpBack = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: rectangle(31, 2, 22, 3), fill: [26, 56, 39, 255], color: COLORS.transparent });
        this.xpFill = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: rectangle(31, 2, 0, 3), fill: COLORS.xp, color: COLORS.transparent });
        this.echoBack = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: rectangle(56, 2, 17, 3), fill: COLORS.echoDark, color: COLORS.transparent });
        this.echoFill = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: rectangle(56, 2, 0, 3), fill: COLORS.echo, color: COLORS.transparent });
        this.breakBack = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: rectangle(76, 2, 17, 3), fill: [29, 43, 90, 255], color: COLORS.transparent });
        this.breakFill = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: rectangle(76, 2, 0, 3), fill: COLORS.slow, color: COLORS.transparent });
        this.hudLayer.addChildren(this.healthBack, this.healthFill, this.xpBack, this.xpFill, this.echoBack, this.echoFill, this.breakBack, this.breakFill);

        this.healthText = makeText('HP 100', 15.5, 2.1, 0.85, COLORS.white);
        this.xpText = makeText('LV 1', 42, 2.1, 0.85, COLORS.white);
        this.echoText = makeText('ECHO', 64.5, 2.1, 0.75, COLORS.white);
        this.breakText = makeText('BREAK', 84.5, 2.1, 0.75, COLORS.white);
        this.scoreText = makeText('0', 97, 2.2, 1.05, COLORS.gold, 'right');
        this.statusNode = makeText('', 50, 9.5, 1.05, COLORS.white);
        this.objectiveNode = makeText('', 50, 94.2, 1.05, COLORS.anchor);
        this.controlNode = makeText('WASD MOVE  ARROWS FIRE  SPACE DASH  E ECHO  Q BREAK', 50, 97.2, 0.75, COLORS.muted);
        this.hudLayer.addChildren(this.healthText, this.xpText, this.echoText, this.breakText, this.scoreText, this.statusNode, this.objectiveNode, this.controlNode);

        this.dashButton = makeButton(3, 82, 15, 7, 'DASH', () => { this.pendingDash = true; }, COLORS.player);
        this.echoButton = makeButton(21, 82, 15, 7, 'ECHO', () => { this.pendingEcho = true; }, COLORS.echo);
        this.breakButton = makeButton(39, 82, 15, 7, 'BREAK', () => { this.pendingTimeBreak = true; }, COLORS.slow);
        this.hudLayer.addChildren(this.dashButton.group, this.echoButton.group, this.breakButton.group);

        this.minimapBack = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(82, 67, 15, 15),
            fill: colorAlpha(COLORS.panel, 225),
            color: COLORS.line,
            border: 3
        });
        this.hudLayer.addChild(this.minimapBack);
        this.minimapAnchors = [];
        for (let index = 0; index < 4; index += 1) {
            const node = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: rectangle(0, 0, 0, 0), fill: COLORS.anchor, color: COLORS.transparent });
            this.minimapAnchors.push(node);
            this.hudLayer.addChild(node);
        }
        this.minimapBoss = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: rectangle(0, 0, 0, 0), fill: COLORS.boss, color: COLORS.transparent });
        this.minimapPlayer = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: rectangle(0, 0, 0, 0), fill: COLORS.player, color: COLORS.white, border: 2 });
        this.hudLayer.addChildren(this.minimapBoss, this.minimapPlayer);

        this.bossHealthBack = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: rectangle(20, 10.5, 60, 3), fill: COLORS.enemyDark, color: COLORS.transparent });
        this.bossHealthFill = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: rectangle(20, 10.5, 0, 3), fill: COLORS.boss, color: COLORS.transparent });
        this.bossHealthText = makeText('', 50, 10.7, 0.9, COLORS.white);
        this.hudLayer.addChildren(this.bossHealthBack, this.bossHealthFill, this.bossHealthText);
        hideShape(this.bossHealthBack);
        hideShape(this.bossHealthFill);
        setText(this.bossHealthText, '', 50, 10.7, 0.9, COLORS.white);
    }

    handleWorldClick(playerId, screenX, screenY) {
        if (playerId !== this.playerId || this.phase !== 'running') return;
        if (screenY > 80 || screenY < 8) return;
        const world = this.screenToWorld(screenX, screenY);
        const target = this.findTargetNear(world.x, world.y, 8);
        if (target) {
            this.tapAim = normalize(target.x - this.player.x, target.y - this.player.y);
            this.tapFireTicks = Math.round(0.7 * TUNING.TICK_RATE);
            this.moveTarget = null;
        } else {
            this.moveTarget = { x: world.x, y: world.y };
        }
    }

    updateRunning() {
        const dt = 1 / TUNING.TICK_RATE;
        const enemyScale = this.tickCount < this.player.timeBreakUntil ? TUNING.TIME_BREAK_SCALE : 1;
        this.updatePlayer(dt);
        this.updateEchoes(dt);
        this.updateAnchors(dt);
        this.updateCrystals(dt);
        this.spawnEnemies();
        this.updateEnemies(dt * enemyScale);
        this.updatePlayerBullets(dt);
        this.updateEnemyBullets(dt * enemyScale);
        this.updatePickups(dt);
        this.updateParticles(dt);
        this.updateBoss(dt * enemyScale);
        this.updateCamera(dt);
        this.updateCombo();
        this.checkLevelUp();
        this.checkPlayerDeath();
    }

    getMovementVector() {
        let dx = 0;
        let dy = 0;
        if (this.keys.w || this.keys.W) dy -= 1;
        if (this.keys.s || this.keys.S) dy += 1;
        if (this.keys.a || this.keys.A) dx -= 1;
        if (this.keys.d || this.keys.D) dx += 1;
        if (dx !== 0 || dy !== 0) {
            this.moveTarget = null;
            return normalize(dx, dy);
        }
        if (this.moveTarget) {
            const vector = normalize(this.moveTarget.x - this.player.x, this.moveTarget.y - this.player.y);
            if (distanceXY(this.player.x, this.player.y, this.moveTarget.x, this.moveTarget.y) < 1.4) {
                this.moveTarget = null;
                return { x: 0, y: 0 };
            }
            return vector;
        }
        return { x: 0, y: 0 };
    }

    getFireVector() {
        let dx = 0;
        let dy = 0;
        if (this.keys.ArrowUp) dy -= 1;
        if (this.keys.ArrowDown) dy += 1;
        if (this.keys.ArrowLeft) dx -= 1;
        if (this.keys.ArrowRight) dx += 1;
        if (dx !== 0 || dy !== 0) return normalize(dx, dy);
        if (this.tapFireTicks > 0) {
            this.tapFireTicks -= 1;
            return this.tapAim;
        }
        return { x: 0, y: 0 };
    }

    updatePlayer(dt) {
        const move = this.getMovementVector();
        const fire = this.getFireVector();
        if (move.x !== 0 || move.y !== 0) {
            this.player.x = clamp(this.player.x + move.x * this.player.speed * dt, 3, TUNING.WORLD_SIZE - 3);
            this.player.y = clamp(this.player.y + move.y * this.player.speed * dt, 3, TUNING.WORLD_SIZE - 3);
            this.player.facing = Math.atan2(move.y, move.x);
        }
        if (fire.x !== 0 || fire.y !== 0) {
            this.player.facing = Math.atan2(fire.y, fire.x);
            this.firePlayerWeapon(this.player.x, this.player.y, fire.x, fire.y, false, this.player.damage);
        }

        let dashFrame = false;
        if (this.pendingDash) {
            dashFrame = this.useDash(move, fire);
            this.pendingDash = false;
        }
        if (this.pendingEcho) {
            this.createEcho();
            this.pendingEcho = false;
        }
        if (this.pendingTimeBreak) {
            this.useTimeBreak();
            this.pendingTimeBreak = false;
        }

        this.recordInput({ moveX: move.x, moveY: move.y, fireX: fire.x, fireY: fire.y, dash: dashFrame });
    }

    useDash(move, fire) {
        if (this.tickCount < this.player.dashReady) return false;
        let direction = move;
        if (direction.x === 0 && direction.y === 0) direction = fire;
        if (direction.x === 0 && direction.y === 0) direction = { x: Math.cos(this.player.facing), y: Math.sin(this.player.facing) };
        this.player.dashReady = this.tickCount + Math.round(TUNING.DASH_COOLDOWN_SECONDS * TUNING.TICK_RATE);
        this.player.invulnerableUntil = this.tickCount + Math.round(0.28 * TUNING.TICK_RATE);
        this.player.x = clamp(this.player.x + direction.x * TUNING.DASH_DISTANCE, 3, TUNING.WORLD_SIZE - 3);
        this.player.y = clamp(this.player.y + direction.y * TUNING.DASH_DISTANCE, 3, TUNING.WORLD_SIZE - 3);
        this.emitBurst(this.player.x, this.player.y, COLORS.player, 12, 16, 0.75);
        this.cameraShake = Math.max(this.cameraShake, 1.4);
        if (this.player.upgrades.dashNova) {
            for (const bullet of this.enemyBullets) {
                if (bullet.active && distanceXY(this.player.x, this.player.y, bullet.x, bullet.y) < 12) {
                    bullet.active = false;
                    this.emitParticle(bullet.x, bullet.y, COLORS.slow, 0.35, 8, 1);
                }
            }
            for (const enemy of this.enemies) {
                if (enemy.active && distanceXY(this.player.x, this.player.y, enemy.x, enemy.y) < 10) this.damageEnemy(enemy, 34);
            }
        }
        return true;
    }

    useTimeBreak() {
        if (this.tickCount < this.player.timeBreakReady) return false;
        const duration = TUNING.TIME_BREAK_SECONDS + (this.player.upgrades.timeDebt || 0) * 1.5;
        this.player.timeBreakUntil = this.tickCount + Math.round(duration * TUNING.TICK_RATE);
        this.player.timeBreakReady = this.tickCount + Math.round(TUNING.TIME_BREAK_COOLDOWN_SECONDS * TUNING.TICK_RATE);
        this.statusText = 'TIME BREAK — EVERYTHING HOSTILE IS SLOW';
        this.statusUntil = this.tickCount + Math.round(1.8 * TUNING.TICK_RATE);
        this.emitBurst(this.player.x, this.player.y, COLORS.slow, 26, 25, 1.2);
        this.cameraShake = 2;
        return true;
    }

    recordInput(frame) {
        this.inputHistory[this.historyWrite] = frame;
        this.historyWrite = (this.historyWrite + 1) % this.inputHistory.length;
        this.historyFilled = Math.min(this.historyFilled + 1, this.inputHistory.length);
    }

    createEcho() {
        if (this.tickCount < this.player.echoReady) return false;
        if (this.historyFilled < Math.round(1.2 * TUNING.TICK_RATE)) {
            this.statusText = 'MOVE AND FIRE FIRST — THE PAST NEEDS SOMETHING TO REMEMBER';
            this.statusUntil = this.tickCount + Math.round(TUNING.STATUS_SECONDS * TUNING.TICK_RATE);
            return false;
        }
        const allowed = Math.min(this.player.echoSlots, TUNING.MAX_ECHOES);
        let echo = this.echoes.slice(0, allowed).find((candidate) => !candidate.active);
        if (!echo) echo = this.echoes.slice(0, allowed).sort((a, b) => a.serial - b.serial)[0];
        const frames = [];
        const count = Math.min(this.historyFilled, this.inputHistory.length);
        const start = (this.historyWrite - count + this.inputHistory.length) % this.inputHistory.length;
        for (let index = 0; index < count; index += 1) {
            const source = this.inputHistory[(start + index) % this.inputHistory.length];
            frames.push(source ? { ...source } : { moveX: 0, moveY: 0, fireX: 0, fireY: 0, dash: false });
        }
        echo.active = true;
        echo.frames = frames;
        echo.frameIndex = 0;
        echo.anchorX = this.player.x;
        echo.anchorY = this.player.y;
        echo.x = echo.anchorX;
        echo.y = echo.anchorY;
        echo.facing = this.player.facing;
        echo.fireReady = 0;
        echo.serial = ++this.echoSerial;
        this.player.echoReady = this.tickCount + Math.round(TUNING.ECHO_COOLDOWN_SECONDS * TUNING.TICK_RATE);
        this.emitBurst(echo.x, echo.y, COLORS.echo, 20, 18, 0.9);
        this.statusText = `ECHO ${echo.id + 1} IMPRINTED — SIX SECONDS NOW LOOP FOREVER`;
        this.statusUntil = this.tickCount + Math.round(TUNING.STATUS_SECONDS * TUNING.TICK_RATE);
        this.freezeTicks = 3;
        return true;
    }

    updateEchoes(dt) {
        for (const echo of this.echoes) {
            if (!echo.active || !echo.frames || !echo.frames.length) continue;
            if (echo.frameIndex === 0) {
                echo.x = echo.anchorX;
                echo.y = echo.anchorY;
                this.emitParticle(echo.x, echo.y, COLORS.echo, 0.75, 10, 0.8);
            }
            const frame = echo.frames[echo.frameIndex];
            if (frame.moveX !== 0 || frame.moveY !== 0) {
                echo.x = clamp(echo.x + frame.moveX * this.player.speed * 0.82 * dt, 2, TUNING.WORLD_SIZE - 2);
                echo.y = clamp(echo.y + frame.moveY * this.player.speed * 0.82 * dt, 2, TUNING.WORLD_SIZE - 2);
                echo.facing = Math.atan2(frame.moveY, frame.moveX);
            }
            if (frame.fireX !== 0 || frame.fireY !== 0) {
                echo.facing = Math.atan2(frame.fireY, frame.fireX);
                if (this.tickCount >= echo.fireReady) {
                    echo.fireReady = this.tickCount + Math.max(1, Math.round(TUNING.TICK_RATE / this.player.fireRate));
                    this.firePlayerWeapon(echo.x, echo.y, frame.fireX, frame.fireY, true, this.player.damage * this.player.echoDamage);
                }
            }
            if (frame.dash) {
                const direction = frame.moveX || frame.moveY ? normalize(frame.moveX, frame.moveY) : { x: Math.cos(echo.facing), y: Math.sin(echo.facing) };
                echo.x = clamp(echo.x + direction.x * TUNING.DASH_DISTANCE * 0.8, 2, TUNING.WORLD_SIZE - 2);
                echo.y = clamp(echo.y + direction.y * TUNING.DASH_DISTANCE * 0.8, 2, TUNING.WORLD_SIZE - 2);
                this.emitBurst(echo.x, echo.y, COLORS.echo, 5, 8, 0.45);
            }
            echo.frameIndex = (echo.frameIndex + 1) % echo.frames.length;
        }
    }

    firePlayerWeapon(x, y, dx, dy, echo, damage) {
        const owner = echo ? null : this.player;
        if (owner && this.tickCount < owner.fireReady) return false;
        if (owner) owner.fireReady = this.tickCount + Math.max(1, Math.round(TUNING.TICK_RATE / owner.fireRate));
        const angles = [0];
        if (this.player.split > 0) angles.push(-0.19, 0.19);
        for (const offset of angles) {
            const angle = Math.atan2(dy, dx) + offset;
            this.spawnPlayerBullet(x, y, Math.cos(angle), Math.sin(angle), damage, echo);
        }
        return true;
    }

    spawnPlayerBullet(x, y, dx, dy, damage, echo) {
        const bullet = this.playerBullets.find((candidate) => !candidate.active);
        if (!bullet) return null;
        bullet.active = true;
        bullet.x = x + dx * 2.2;
        bullet.y = y + dy * 2.2;
        bullet.vx = dx * this.player.bulletSpeed;
        bullet.vy = dy * this.player.bulletSpeed;
        bullet.radius = this.player.bulletSize;
        bullet.damage = damage;
        bullet.ttl = Math.round(1.7 * TUNING.TICK_RATE);
        bullet.pierce = this.player.pierce;
        bullet.echo = echo;
        return bullet;
    }

    updatePlayerBullets(dt) {
        for (const bullet of this.playerBullets) {
            if (!bullet.active) continue;
            if (this.player.upgrades.seeker) {
                const target = this.findNearestEnemy(bullet.x, bullet.y, 14);
                if (target) {
                    const desired = normalize(target.x - bullet.x, target.y - bullet.y);
                    const speed = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy);
                    bullet.vx = bullet.vx * 0.92 + desired.x * speed * 0.08;
                    bullet.vy = bullet.vy * 0.92 + desired.y * speed * 0.08;
                }
            }
            bullet.x += bullet.vx * dt;
            bullet.y += bullet.vy * dt;
            bullet.ttl -= 1;
            let hit = false;
            if (this.boss.active && distanceXY(bullet.x, bullet.y, this.boss.x, this.boss.y) < bullet.radius + this.boss.radius) {
                this.damageBoss(bullet.damage);
                hit = true;
            }
            const anchor = this.getActiveAnchor();
            if (!hit && anchor && distanceXY(bullet.x, bullet.y, anchor.x, anchor.y) < bullet.radius + 5) {
                this.damageAnchor(anchor, bullet.damage);
                hit = true;
            }
            if (!hit) {
                for (const enemy of this.enemies) {
                    if (!enemy.active || distanceXY(bullet.x, bullet.y, enemy.x, enemy.y) > bullet.radius + enemy.radius) continue;
                    this.damageEnemy(enemy, bullet.damage);
                    hit = true;
                    break;
                }
            }
            if (!hit) {
                for (const crystal of this.crystals) {
                    if (!crystal.active || distanceXY(bullet.x, bullet.y, crystal.x, crystal.y) > bullet.radius + crystal.radius) continue;
                    this.damageCrystal(crystal, bullet.damage);
                    hit = true;
                    break;
                }
            }
            if (hit) {
                if (bullet.pierce > 0) bullet.pierce -= 1;
                else bullet.active = false;
            }
            if (bullet.ttl <= 0 || bullet.x < 0 || bullet.y < 0 || bullet.x > TUNING.WORLD_SIZE || bullet.y > TUNING.WORLD_SIZE) bullet.active = false;
        }
    }

    spawnEnemies() {
        if (this.boss.active) return;
        if (this.tickCount < this.nextEnemySpawnAt) return;
        const seconds = this.runTicks / TUNING.TICK_RATE;
        const interval = clamp(TUNING.ENEMY_SPAWN_SECONDS - seconds * 0.004 - this.anchorsDestroyed * 0.08, 0.26, 0.9);
        this.nextEnemySpawnAt = this.tickCount + Math.round(interval * TUNING.TICK_RATE);
        const free = this.enemies.filter((enemy) => !enemy.active).length;
        if (!free) return;
        let count = seconds > 80 ? 2 : 1;
        if (this.random() < 0.12 + this.anchorsDestroyed * 0.05) count += 1;
        for (let index = 0; index < count; index += 1) this.spawnEnemy(this.chooseEnemyType(seconds));
    }

    chooseEnemyType(seconds) {
        const roll = this.random();
        if (seconds > 70 && roll < 0.16) return 'warden';
        if (seconds > 35 && roll < 0.34) return 'splitter';
        if (seconds > 15 && roll < 0.58) return 'spitter';
        return 'drone';
    }

    spawnEnemy(type, x, y, excludeId) {
        const enemy = this.enemies.find((candidate) => !candidate.active && candidate.id !== excludeId);
        if (!enemy) return null;
        const angle = this.random() * Math.PI * 2;
        const range = 42 + this.random() * 12;
        enemy.active = true;
        enemy.type = type;
        enemy.x = x === undefined ? clamp(this.player.x + Math.cos(angle) * range, 4, TUNING.WORLD_SIZE - 4) : x;
        enemy.y = y === undefined ? clamp(this.player.y + Math.sin(angle) * range, 4, TUNING.WORLD_SIZE - 4) : y;
        const scale = 1 + this.anchorsDestroyed * 0.22 + this.runTicks / TUNING.TICK_RATE * 0.003;
        if (type === 'drone') {
            enemy.radius = 1.5; enemy.maxHealth = 24 * scale; enemy.speed = 12.5;
        } else if (type === 'spitter') {
            enemy.radius = 1.8; enemy.maxHealth = 42 * scale; enemy.speed = 8.5;
        } else if (type === 'splitter') {
            enemy.radius = 2.3; enemy.maxHealth = 75 * scale; enemy.speed = 9.5;
        } else {
            enemy.radius = 2.7; enemy.maxHealth = 115 * scale; enemy.speed = 7;
        }
        enemy.health = enemy.maxHealth;
        enemy.attackReady = this.tickCount + Math.round(this.random() * TUNING.TICK_RATE);
        enemy.shootReady = this.tickCount + Math.round((0.4 + this.random()) * TUNING.TICK_RATE);
        enemy.orbitAngle = this.random() * Math.PI * 2;
        enemy.parentSpawn = false;
        return enemy;
    }

    updateEnemies(dt) {
        for (const enemy of this.enemies) {
            if (!enemy.active) continue;
            const toPlayer = normalize(this.player.x - enemy.x, this.player.y - enemy.y);
            const distanceToPlayer = distanceXY(enemy.x, enemy.y, this.player.x, this.player.y);
            if (enemy.type === 'drone' || enemy.type === 'splitter') {
                enemy.x += toPlayer.x * enemy.speed * dt;
                enemy.y += toPlayer.y * enemy.speed * dt;
            } else if (enemy.type === 'spitter') {
                const direction = distanceToPlayer < 18 ? -1 : distanceToPlayer > 27 ? 1 : 0;
                enemy.x += toPlayer.x * enemy.speed * dt * direction;
                enemy.y += toPlayer.y * enemy.speed * dt * direction;
                if (this.tickCount >= enemy.shootReady) {
                    enemy.shootReady = this.tickCount + Math.round(1.45 * TUNING.TICK_RATE);
                    this.spawnEnemyBullet(enemy.x, enemy.y, toPlayer.x, toPlayer.y, 20, 8, COLORS.spitter, 0.75);
                }
            } else if (enemy.type === 'warden') {
                enemy.orbitAngle += dt * 0.9;
                const desiredX = this.player.x + Math.cos(enemy.orbitAngle) * 23;
                const desiredY = this.player.y + Math.sin(enemy.orbitAngle) * 23;
                const direction = normalize(desiredX - enemy.x, desiredY - enemy.y);
                enemy.x += direction.x * enemy.speed * dt;
                enemy.y += direction.y * enemy.speed * dt;
                if (this.tickCount >= enemy.shootReady) {
                    enemy.shootReady = this.tickCount + Math.round(1.8 * TUNING.TICK_RATE);
                    for (let index = -1; index <= 1; index += 1) {
                        const angle = Math.atan2(toPlayer.y, toPlayer.x) + index * 0.19;
                        this.spawnEnemyBullet(enemy.x, enemy.y, Math.cos(angle), Math.sin(angle), 16, 10, COLORS.warden, 0.85);
                    }
                }
            }
            enemy.x = clamp(enemy.x, 2, TUNING.WORLD_SIZE - 2);
            enemy.y = clamp(enemy.y, 2, TUNING.WORLD_SIZE - 2);
            if (distanceToPlayer < enemy.radius + this.player.radius + 0.5 && this.tickCount >= enemy.attackReady) {
                enemy.attackReady = this.tickCount + Math.round(0.75 * TUNING.TICK_RATE);
                this.damagePlayer(enemy.type === 'splitter' ? 14 : enemy.type === 'warden' ? 18 : 10);
            }
        }
    }

    spawnEnemyBullet(x, y, dx, dy, speed, damage, color, radius) {
        const bullet = this.enemyBullets.find((candidate) => !candidate.active);
        if (!bullet) return null;
        bullet.active = true;
        bullet.x = x + dx * 2;
        bullet.y = y + dy * 2;
        bullet.vx = dx * speed;
        bullet.vy = dy * speed;
        bullet.radius = radius;
        bullet.ttl = Math.round(5 * TUNING.TICK_RATE);
        bullet.damage = damage;
        bullet.color = color;
        return bullet;
    }

    updateEnemyBullets(dt) {
        for (const bullet of this.enemyBullets) {
            if (!bullet.active) continue;
            bullet.x += bullet.vx * dt;
            bullet.y += bullet.vy * dt;
            bullet.ttl -= 1;
            if (distanceXY(bullet.x, bullet.y, this.player.x, this.player.y) < bullet.radius + this.player.radius) {
                this.damagePlayer(bullet.damage);
                bullet.active = false;
                continue;
            }
            if (bullet.ttl <= 0 || bullet.x < 0 || bullet.y < 0 || bullet.x > TUNING.WORLD_SIZE || bullet.y > TUNING.WORLD_SIZE) bullet.active = false;
        }
    }

    damagePlayer(amount) {
        if (this.tickCount < this.player.invulnerableUntil || this.phase !== 'running') return;
        this.player.health = Math.max(0, this.player.health - amount);
        this.player.invulnerableUntil = this.tickCount + Math.round(0.42 * TUNING.TICK_RATE);
        this.cameraShake = Math.max(this.cameraShake, 2.5);
        this.emitBurst(this.player.x, this.player.y, COLORS.danger, 14, 15, 0.75);
        this.freezeTicks = 2;
    }

    damageEnemy(enemy, amount) {
        if (!enemy.active) return;
        enemy.health -= amount;
        this.emitParticle(enemy.x, enemy.y, enemy.type === 'spitter' ? COLORS.spitter : enemy.type === 'warden' ? COLORS.warden : COLORS.enemy, 0.35, 8, 0.7);
        if (enemy.health <= 0) this.killEnemy(enemy);
    }

    killEnemy(enemy) {
        if (!enemy.active) return;
        const x = enemy.x;
        const y = enemy.y;
        const type = enemy.type;
        enemy.active = false;
        this.player.kills += 1;
        this.score += type === 'warden' ? 120 : type === 'splitter' ? 70 : type === 'spitter' ? 45 : 25;
        this.combo += 1;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        this.comboUntil = this.tickCount + Math.round(2.6 * TUNING.TICK_RATE);
        if (this.player.upgrades.bloodLoop) this.player.health = Math.min(this.player.maxHealth, this.player.health + 1.5 + this.player.upgrades.bloodLoop);
        this.spawnPickup(x, y, type === 'warden' ? 7 : type === 'splitter' ? 4 : type === 'spitter' ? 3 : 2);
        this.emitBurst(x, y, type === 'warden' ? COLORS.warden : type === 'splitter' ? COLORS.splitter : COLORS.enemy, type === 'warden' ? 15 : 8, 14, 0.75);
        if (type === 'splitter') {
            for (let index = 0; index < 2; index += 1) {
                const child = this.spawnEnemy('drone', x + (index ? 2 : -2), y + (index ? -2 : 2), enemy.id);
                if (child) {
                    child.maxHealth *= 0.55;
                    child.health = child.maxHealth;
                    child.radius = 1.1;
                    child.speed *= 1.25;
                    child.parentSpawn = true;
                }
            }
        }
    }

    spawnPickup(x, y, value) {
        const pickup = this.pickups.find((candidate) => !candidate.active);
        if (!pickup) {
            this.player.xp += value;
            return;
        }
        pickup.active = true;
        pickup.x = x;
        pickup.y = y;
        pickup.value = value;
        pickup.life = Math.round(16 * TUNING.TICK_RATE);
    }

    updatePickups(dt) {
        for (const pickup of this.pickups) {
            if (!pickup.active) continue;
            pickup.life -= 1;
            pickup.phase += dt * 4;
            const distanceToPlayer = distanceXY(pickup.x, pickup.y, this.player.x, this.player.y);
            if (distanceToPlayer < this.player.magnetRadius) {
                const direction = normalize(this.player.x - pickup.x, this.player.y - pickup.y);
                const speed = 18 + (this.player.magnetRadius - distanceToPlayer) * 3;
                pickup.x += direction.x * speed * dt;
                pickup.y += direction.y * speed * dt;
            }
            if (distanceToPlayer < 2.4) {
                this.player.xp += pickup.value;
                this.score += pickup.value * 4;
                pickup.active = false;
                this.emitParticle(this.player.x, this.player.y, COLORS.xp, 0.45, 7, 0.8);
            } else if (pickup.life <= 0) pickup.active = false;
        }
    }

    damageCrystal(crystal, amount) {
        if (!crystal.active) return;
        crystal.health -= amount;
        if (crystal.health <= 0) {
            crystal.active = false;
            this.score += 80;
            this.spawnPickup(crystal.x, crystal.y, 5);
            this.emitBurst(crystal.x, crystal.y, COLORS.crystal, 18, 18, 1.1);
            this.cameraShake = Math.max(this.cameraShake, 1.2);
        }
    }

    updateCrystals(dt) {
        for (const crystal of this.crystals) crystal.pulse += dt * 1.5;
    }

    activateAnchor(index) {
        if (index >= this.anchors.length) {
            this.beginBoss();
            return;
        }
        this.anchorIndex = index;
        const anchor = this.anchors[index];
        anchor.active = true;
        anchor.health = anchor.maxHealth;
        this.statusText = `RIFT ANCHOR ${index + 1} AWAKENED — FOLLOW THE MINIMAP`;
        this.statusUntil = this.tickCount + Math.round(3 * TUNING.TICK_RATE);
    }

    getActiveAnchor() {
        return this.anchors.find((anchor) => anchor.active && !anchor.destroyed) || null;
    }

    damageAnchor(anchor, amount) {
        if (!anchor.active || anchor.destroyed) return;
        anchor.health -= amount;
        this.emitParticle(anchor.x, anchor.y, COLORS.anchor, 0.5, 10, 0.9);
        if (anchor.health <= 0) this.destroyAnchor(anchor);
    }

    destroyAnchor(anchor) {
        anchor.health = 0;
        anchor.active = false;
        anchor.destroyed = true;
        this.anchorsDestroyed += 1;
        this.score += 1000 + this.anchorsDestroyed * 250;
        this.emitBurst(anchor.x, anchor.y, COLORS.anchor, 42, 30, 1.5);
        this.cameraShake = 4;
        this.freezeTicks = 8;
        this.clearHostileBulletsNear(anchor.x, anchor.y, 50);
        if (this.anchorsDestroyed < this.anchors.length) {
            this.statusText = `ANCHOR ${this.anchorsDestroyed} SHATTERED — THE RIFT MUTATES`;
            this.statusUntil = this.tickCount + Math.round(2.5 * TUNING.TICK_RATE);
            this.offerUpgrade();
        } else {
            this.beginBoss();
        }
    }

    updateAnchors(dt) {
        for (const anchor of this.anchors) anchor.rotation += dt * (anchor.active ? 1.2 : 0.25);
        const active = this.getActiveAnchor();
        if (active && this.tickCount % Math.round(4.5 * TUNING.TICK_RATE) === 0) {
            for (let index = 0; index < 2 + this.anchorsDestroyed; index += 1) {
                const angle = this.random() * Math.PI * 2;
                this.spawnEnemy(this.anchorsDestroyed >= 2 && index === 0 ? 'warden' : this.chooseEnemyType(this.runTicks / TUNING.TICK_RATE), active.x + Math.cos(angle) * 14, active.y + Math.sin(angle) * 14);
            }
        }
    }

    beginBoss() {
        this.phase = 'running';
        this.overlayLayer.clearChildren();
        this.clearAllEnemies();
        this.clearAllBullets();
        this.player.x = TUNING.WORLD_SIZE / 2;
        this.player.y = TUNING.WORLD_SIZE / 2 + 24;
        this.moveTarget = null;
        for (let index = 0; index < this.echoes.length; index += 1) {
            const echo = this.echoes[index];
            if (!echo.active) continue;
            const angle = index / Math.max(1, this.echoes.length) * Math.PI * 2;
            echo.anchorX = this.player.x + Math.cos(angle) * 8;
            echo.anchorY = this.player.y + Math.sin(angle) * 8;
            echo.x = echo.anchorX;
            echo.y = echo.anchorY;
            echo.frameIndex = 0;
        }
        this.boss.active = true;
        this.boss.x = TUNING.WORLD_SIZE / 2;
        this.boss.y = TUNING.WORLD_SIZE / 2 - 12;
        this.boss.maxHealth = 3200 + this.player.level * 260;
        this.boss.health = this.boss.maxHealth;
        this.boss.phase = 1;
        this.boss.angle = 0;
        this.boss.attackReady = this.tickCount + Math.round(1.5 * TUNING.TICK_RATE);
        this.boss.teleportReady = this.tickCount + Math.round(8 * TUNING.TICK_RATE);
        this.boss.laserReady = this.tickCount + Math.round(5 * TUNING.TICK_RATE);
        this.boss.laserUntil = 0;
        this.boss.summonReady = this.tickCount + Math.round(7 * TUNING.TICK_RATE);
        this.statusText = 'THE PARADOX ENGINE HAS ENTERED REALITY';
        this.statusUntil = this.tickCount + Math.round(4 * TUNING.TICK_RATE);
        this.emitBurst(this.boss.x, this.boss.y, COLORS.boss, 50, 35, 1.8);
        this.cameraShake = 5;
        this.freezeTicks = 12;
    }

    updateBoss(dt) {
        if (!this.boss.active) return;
        const healthRatio = this.boss.health / this.boss.maxHealth;
        this.boss.phase = healthRatio > 0.66 ? 1 : healthRatio > 0.32 ? 2 : 3;
        this.boss.angle += dt * (0.45 + this.boss.phase * 0.22);
        const targetX = TUNING.WORLD_SIZE / 2 + Math.cos(this.boss.angle * 0.32) * 24;
        const targetY = TUNING.WORLD_SIZE / 2 + Math.sin(this.boss.angle * 0.26) * 18;
        const direction = normalize(targetX - this.boss.x, targetY - this.boss.y);
        this.boss.x += direction.x * (4 + this.boss.phase) * dt;
        this.boss.y += direction.y * (4 + this.boss.phase) * dt;

        if (this.tickCount >= this.boss.attackReady) {
            this.boss.attackReady = this.tickCount + Math.round((TUNING.BOSS_RADIAL_SECONDS - this.boss.phase * 0.13) * TUNING.TICK_RATE);
            const count = 12 + this.boss.phase * 4;
            const offset = this.boss.angle;
            for (let index = 0; index < count; index += 1) {
                const angle = offset + index / count * Math.PI * 2;
                this.spawnEnemyBullet(this.boss.x, this.boss.y, Math.cos(angle), Math.sin(angle), 16 + this.boss.phase * 2, 9 + this.boss.phase * 2, COLORS.boss, 0.8);
            }
            this.emitBurst(this.boss.x, this.boss.y, COLORS.boss, 10, 14, 0.8);
        }

        if (this.boss.phase >= 2 && this.tickCount >= this.boss.laserReady) {
            this.boss.laserReady = this.tickCount + Math.round(8.5 * TUNING.TICK_RATE);
            this.boss.laserUntil = this.tickCount + Math.round(TUNING.BOSS_LASER_SECONDS * TUNING.TICK_RATE);
            this.statusText = 'PARADOX LASERS — MOVE BETWEEN THE ARMS';
            this.statusUntil = this.tickCount + Math.round(2 * TUNING.TICK_RATE);
        }
        if (this.tickCount < this.boss.laserUntil) this.updateBossLasers();

        if (this.boss.phase >= 3 && this.tickCount >= this.boss.summonReady) {
            this.boss.summonReady = this.tickCount + Math.round(6.5 * TUNING.TICK_RATE);
            for (let index = 0; index < 4; index += 1) {
                const angle = index / 4 * Math.PI * 2 + this.boss.angle;
                this.spawnEnemy(index === 0 ? 'warden' : 'spitter', this.boss.x + Math.cos(angle) * 13, this.boss.y + Math.sin(angle) * 13);
            }
        }
        if (distanceXY(this.player.x, this.player.y, this.boss.x, this.boss.y) < this.player.radius + this.boss.radius) this.damagePlayer(18);
    }

    updateBossLasers() {
        const armCount = this.boss.phase >= 3 ? 4 : 3;
        for (let index = 0; index < armCount; index += 1) {
            const angle = this.boss.angle * 1.8 + index / armCount * Math.PI * 2;
            const x2 = this.boss.x + Math.cos(angle) * 54;
            const y2 = this.boss.y + Math.sin(angle) * 54;
            if (this.distancePointToSegment(this.player.x, this.player.y, this.boss.x, this.boss.y, x2, y2) < 1.5) this.damagePlayer(10);
        }
    }

    distancePointToSegment(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lengthSquared = dx * dx + dy * dy;
        if (!lengthSquared) return distanceXY(px, py, x1, y1);
        const t = clamp(((px - x1) * dx + (py - y1) * dy) / lengthSquared, 0, 1);
        return distanceXY(px, py, x1 + t * dx, y1 + t * dy);
    }

    damageBoss(amount) {
        if (!this.boss.active) return;
        this.boss.health -= amount;
        this.score += Math.round(amount * 2);
        this.emitParticle(this.boss.x, this.boss.y, COLORS.bossCore, 0.55, 12, 1);
        if (this.boss.health <= 0) this.winRun();
    }

    clearHostileBulletsNear(x, y, radius) {
        for (const bullet of this.enemyBullets) {
            if (bullet.active && distanceXY(x, y, bullet.x, bullet.y) <= radius) bullet.active = false;
        }
    }

    clearAllBullets() {
        for (const bullet of this.playerBullets) bullet.active = false;
        for (const bullet of this.enemyBullets) bullet.active = false;
    }

    clearAllEnemies() {
        for (const enemy of this.enemies) enemy.active = false;
    }

    checkLevelUp() {
        if (this.phase !== 'running' || this.boss.active && this.player.xp < this.player.nextXp) return;
        if (this.player.xp < this.player.nextXp) return;
        this.player.xp -= this.player.nextXp;
        this.player.level += 1;
        this.player.nextXp = Math.round(this.player.nextXp * 1.42 + 6);
        this.offerUpgrade();
    }

    offerUpgrade() {
        if (this.phase !== 'running') return;
        this.phase = 'upgrade';
        const random = mulberry32(this.seed + this.player.level * 991 + this.anchorsDestroyed * 1777);
        const available = UPGRADE_KEYS.filter((key) => key !== 'longMemory' || this.player.echoSlots < TUNING.MAX_ECHOES);
        this.upgradeChoices = shuffle(available, random).slice(0, 3);
        this.renderUpgradeOverlay();
    }

    renderUpgradeOverlay() {
        this.overlayLayer.clearChildren();
        this.overlayLayer.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(8, 18, 84, 63),
            fill: [8, 12, 23, 248],
            color: COLORS.echo,
            border: 7,
            effects: glow(COLORS.echo, 12)
        }));
        this.overlayLayer.addChild(makeText('THE TIMELINE FRACTURES', 50, 23, 2.7, COLORS.white));
        this.overlayLayer.addChild(makeText('CHOOSE WHAT SURVIVES', 50, 28, 1.1, COLORS.echo));
        this.upgradeChoices.forEach((key, index) => {
            const definition = UPGRADE_DEFS[key];
            const y = 35 + index * 14;
            const button = makeButton(16, y, 68, 10, `${index + 1}  ${definition.name}`, () => this.chooseUpgrade(index), COLORS.echo);
            this.overlayLayer.addChild(button.group);
            this.overlayLayer.addChild(makeText(definition.description, 50, y + 7.2, 0.95, COLORS.muted));
        });
    }

    chooseUpgrade(index) {
        if (this.phase !== 'upgrade') return;
        const key = this.upgradeChoices[index];
        if (!key) return;
        this.applyUpgrade(key);
        this.upgradeChoices = [];
        this.overlayLayer.clearChildren();
        this.phase = 'running';
        this.statusText = `${UPGRADE_DEFS[key].name} INSTALLED`;
        this.statusUntil = this.tickCount + Math.round(TUNING.STATUS_SECONDS * TUNING.TICK_RATE);
        if (this.anchorsDestroyed > 0 && !this.getActiveAnchor() && !this.boss.active) this.activateAnchor(this.anchorsDestroyed);
    }

    applyUpgrade(key) {
        this.player.upgrades[key] = (this.player.upgrades[key] || 0) + 1;
        if (key === 'rapidCore') this.player.fireRate *= 1.24;
        else if (key === 'heavyShards') { this.player.damage *= 1.35; this.player.bulletSize *= 1.18; }
        else if (key === 'trident') this.player.split = 1;
        else if (key === 'phaseAmmo') this.player.pierce += 1;
        else if (key === 'echoForge') this.player.echoDamage *= 1.35;
        else if (key === 'longMemory') this.player.echoSlots = Math.min(TUNING.MAX_ECHOES, this.player.echoSlots + 1);
        else if (key === 'magnet') this.player.magnetRadius += 5;
        else if (key === 'overcharge') { this.player.maxHealth += 25; this.player.health = this.player.maxHealth; }
    }

    updateCombo() {
        if (this.combo > 0 && this.tickCount > this.comboUntil) this.combo = 0;
    }

    checkPlayerDeath() {
        if (this.player.health > 0 || this.phase !== 'running') return;
        const sacrifice = this.echoes.filter((echo) => echo.active).sort((a, b) => a.serial - b.serial)[0];
        if (sacrifice) {
            sacrifice.active = false;
            sacrifice.frames = null;
            this.player.x = sacrifice.anchorX;
            this.player.y = sacrifice.anchorY;
            this.player.health = Math.max(1, this.player.maxHealth * 0.38);
            this.player.invulnerableUntil = this.tickCount + Math.round(2.2 * TUNING.TICK_RATE);
            this.player.rewinds += 1;
            this.clearHostileBulletsNear(this.player.x, this.player.y, 48);
            this.emitBurst(this.player.x, this.player.y, COLORS.echo, 46, 34, 1.7);
            this.statusText = 'LETHAL TIMELINE REJECTED — AN ECHO DIED IN YOUR PLACE';
            this.statusUntil = this.tickCount + Math.round(3 * TUNING.TICK_RATE);
            this.cameraShake = 5;
            this.freezeTicks = 10;
            return;
        }
        this.phase = 'defeat';
        this.clearAllBullets();
        this.emitBurst(this.player.x, this.player.y, COLORS.danger, 50, 32, 1.8);
        this.renderEndOverlay(false);
    }

    winRun() {
        this.boss.active = false;
        this.phase = 'victory';
        this.score += 10000;
        this.clearAllBullets();
        this.clearAllEnemies();
        this.emitBurst(this.boss.x, this.boss.y, COLORS.bossCore, 80, 42, 2.2);
        this.renderEndOverlay(true);
    }

    renderEndOverlay(victory) {
        this.overlayLayer.clearChildren();
        this.overlayLayer.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(10, 15, 80, 70),
            fill: [7, 10, 18, 250],
            color: victory ? COLORS.player : COLORS.danger,
            border: 8,
            effects: glow(victory ? COLORS.player : COLORS.danger, 15)
        }));
        this.overlayLayer.addChild(makeText(victory ? 'PARADOX BROKEN' : 'TIMELINE TERMINATED', 50, 23, 3.5, victory ? COLORS.player : COLORS.danger));
        this.overlayLayer.addChild(makeText(victory ? 'YOUR PAST OUTNUMBERED THE FUTURE' : 'THE RIFT REMEMBERS THIS FAILURE', 50, 30, 1.1, COLORS.white));
        const time = this.formatTime(this.runTicks / TUNING.TICK_RATE);
        const activeEchoes = this.echoes.filter((echo) => echo.active).length;
        this.overlayLayer.addChild(makeText(`TIME ${time}`, 50, 42, 1.6, COLORS.muted));
        this.overlayLayer.addChild(makeText(`SCORE ${Math.round(this.score)}`, 50, 48, 1.6, COLORS.gold));
        this.overlayLayer.addChild(makeText(`KILLS ${this.player.kills}   BEST COMBO ${this.bestCombo}`, 50, 54, 1.35, COLORS.white));
        this.overlayLayer.addChild(makeText(`LEVEL ${this.player.level}   ECHOES ${activeEchoes}   REWINDS ${this.player.rewinds}`, 50, 60, 1.35, COLORS.echo));
        const restart = makeButton(28, 69, 44, 10, 'REWRITE THE TIMELINE', () => this.startRun(), victory ? COLORS.player : COLORS.danger);
        this.overlayLayer.addChild(restart.group);
        this.overlayLayer.addChild(makeText('PRESS ENTER OR R', 50, 82, 0.95, COLORS.muted));
    }

    updateCamera(dt) {
        const smoothing = 1 - Math.pow(0.001, dt);
        this.cameraX += (this.player.x - this.cameraX) * smoothing;
        this.cameraY += (this.player.y - this.cameraY) * smoothing;
        this.cameraX = clamp(this.cameraX, TUNING.VIEW_SIZE / 2, TUNING.WORLD_SIZE - TUNING.VIEW_SIZE / 2);
        this.cameraY = clamp(this.cameraY, TUNING.VIEW_SIZE / 2, TUNING.WORLD_SIZE - TUNING.VIEW_SIZE / 2);
        this.cameraShake *= 0.88;
    }

    worldToScreen(x, y) {
        const shakeX = Math.sin(this.tickCount * 1.9) * this.cameraShake * 0.16;
        const shakeY = Math.cos(this.tickCount * 2.3) * this.cameraShake * 0.16;
        return {
            x: 50 + (x - this.cameraX) / TUNING.VIEW_SIZE * 100 + shakeX,
            y: 50 + (y - this.cameraY) / TUNING.VIEW_SIZE * 100 + shakeY
        };
    }

    screenToWorld(x, y) {
        return {
            x: this.cameraX + (x - 50) / 100 * TUNING.VIEW_SIZE,
            y: this.cameraY + (y - 50) / 100 * TUNING.VIEW_SIZE
        };
    }

    visibleAt(x, y, margin = 8) {
        const point = this.worldToScreen(x, y);
        return point.x >= -margin && point.x <= 100 + margin && point.y >= -margin && point.y <= 100 + margin;
    }

    findTargetNear(x, y, radius) {
        let best = null;
        let bestDistance = radius;
        if (this.boss.active) {
            const d = distanceXY(x, y, this.boss.x, this.boss.y);
            if (d < bestDistance) { best = this.boss; bestDistance = d; }
        }
        const anchor = this.getActiveAnchor();
        if (anchor) {
            const d = distanceXY(x, y, anchor.x, anchor.y);
            if (d < bestDistance) { best = anchor; bestDistance = d; }
        }
        for (const enemy of this.enemies) {
            if (!enemy.active) continue;
            const d = distanceXY(x, y, enemy.x, enemy.y);
            if (d < bestDistance) { best = enemy; bestDistance = d; }
        }
        for (const crystal of this.crystals) {
            if (!crystal.active) continue;
            const d = distanceXY(x, y, crystal.x, crystal.y);
            if (d < bestDistance) { best = crystal; bestDistance = d; }
        }
        return best;
    }

    findNearestEnemy(x, y, radius) {
        let best = null;
        let bestDistance = radius;
        if (this.boss.active) {
            const d = distanceXY(x, y, this.boss.x, this.boss.y);
            if (d < bestDistance) { best = this.boss; bestDistance = d; }
        }
        for (const enemy of this.enemies) {
            if (!enemy.active) continue;
            const d = distanceXY(x, y, enemy.x, enemy.y);
            if (d < bestDistance) { best = enemy; bestDistance = d; }
        }
        return best;
    }

    emitParticle(x, y, color, size, lifeTicks, growth) {
        const particle = this.particles.find((candidate) => !candidate.active);
        if (!particle) return null;
        particle.active = true;
        particle.x = x;
        particle.y = y;
        const angle = this.random() * Math.PI * 2;
        const speed = 2 + this.random() * 10;
        particle.vx = Math.cos(angle) * speed;
        particle.vy = Math.sin(angle) * speed;
        particle.life = lifeTicks;
        particle.maxLife = lifeTicks;
        particle.size = size;
        particle.growth = growth || 0;
        particle.color = color;
        return particle;
    }

    emitBurst(x, y, color, count, speed, size) {
        for (let index = 0; index < count; index += 1) {
            const particle = this.particles.find((candidate) => !candidate.active);
            if (!particle) break;
            particle.active = true;
            particle.x = x;
            particle.y = y;
            const angle = this.random() * Math.PI * 2;
            const velocity = speed * (0.25 + this.random() * 0.75);
            particle.vx = Math.cos(angle) * velocity;
            particle.vy = Math.sin(angle) * velocity;
            particle.life = Math.round((0.25 + this.random() * 0.45) * TUNING.TICK_RATE);
            particle.maxLife = particle.life;
            particle.size = size * (0.4 + this.random() * 0.8);
            particle.growth = this.random() * 0.01;
            particle.color = color;
        }
    }

    updateParticles(dt) {
        for (const particle of this.particles) {
            if (!particle.active) continue;
            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;
            particle.vx *= 0.97;
            particle.vy *= 0.97;
            particle.size += particle.growth;
            particle.life -= 1;
            if (particle.life <= 0) particle.active = false;
        }
    }

    renderFrame() {
        if (!this.player) return;
        this.renderBackground();
        this.renderWorldObjects();
        this.renderPlayer();
        this.renderEchoes();
        this.renderEnemies();
        this.renderBullets();
        this.renderPickups();
        this.renderParticles();
        this.renderBoss();
        this.renderHUD();
    }

    renderBackground() {
        const spacingWorld = 18;
        const spacingScreen = spacingWorld / TUNING.VIEW_SIZE * 100;
        const offsetX = ((-this.cameraX % spacingWorld) + spacingWorld) % spacingWorld / TUNING.VIEW_SIZE * 100;
        const offsetY = ((-this.cameraY % spacingWorld) + spacingWorld) % spacingWorld / TUNING.VIEW_SIZE * 100;
        let gridIndex = 0;
        for (let index = -1; index < 10 && gridIndex < this.backgroundGrid.length; index += 1) {
            const x = offsetX + index * spacingScreen + 50;
            const node = this.backgroundGrid[gridIndex++];
            node.node.coordinates2d = rectangle(clamp(x, 0, 99.82), 0, 0.18, 100);
            node.node.fill = colorAlpha(COLORS.line, 28);
        }
        for (let index = -1; index < 10 && gridIndex < this.backgroundGrid.length; index += 1) {
            const y = offsetY + index * spacingScreen + 50;
            const node = this.backgroundGrid[gridIndex++];
            node.node.coordinates2d = rectangle(0, clamp(y, 0, 99.82), 100, 0.18);
            node.node.fill = colorAlpha(COLORS.line, 28);
        }
        while (gridIndex < this.backgroundGrid.length) hideShape(this.backgroundGrid[gridIndex++]);

        let starIndex = 0;
        for (const star of this.world.stars) {
            if (starIndex >= this.starNodes.length) break;
            if (!this.visibleAt(star.x, star.y, 2)) continue;
            const point = this.worldToScreen(star.x, star.y);
            const node = this.starNodes[starIndex++];
            node.node.coordinates2d = rectangle(clamp(point.x, 0, 100), clamp(point.y, 0, 100), star.size, star.size);
            node.node.fill = [198, 220, 255, star.alpha];
            node.node.color = COLORS.transparent;
        }
        while (starIndex < this.starNodes.length) hideShape(this.starNodes[starIndex++]);

        for (let index = 0; index < this.riftFogNodes.length; index += 1) {
            const angle = index / this.riftFogNodes.length * Math.PI * 2 + this.runTicks / TUNING.TICK_RATE * 0.04;
            const distance = 20 + (index % 3) * 11;
            const point = this.worldToScreen(this.player.x + Math.cos(angle) * distance, this.player.y + Math.sin(angle) * distance);
            const radius = 6 + (index % 4) * 2;
            const node = this.riftFogNodes[index];
            node.node.coordinates2d = polyCircle(clamp(point.x, radius, 100 - radius), clamp(point.y, radius, 100 - radius), radius, 12);
            node.node.fill = colorAlpha(this.tickCount < this.player.timeBreakUntil ? COLORS.slow : COLORS.echo, 6 + (index % 3) * 4);
            node.node.color = COLORS.transparent;
        }
    }

    renderWorldObjects() {
        for (const crystal of this.crystals) {
            if (!crystal.active || !this.visibleAt(crystal.x, crystal.y, 8)) {
                hideShape(crystal.bodyNode); hideShape(crystal.coreNode); continue;
            }
            const point = this.worldToScreen(crystal.x, crystal.y);
            const scale = 100 / TUNING.VIEW_SIZE;
            const radius = crystal.radius * scale;
            crystal.bodyNode.node.coordinates2d = [
                [clamp(point.x, 0, 100), clamp(point.y - radius, 0, 100)],
                [clamp(point.x + radius * 0.75, 0, 100), clamp(point.y + radius * 0.7, 0, 100)],
                [clamp(point.x, 0, 100), clamp(point.y + radius * 0.35, 0, 100)],
                [clamp(point.x - radius * 0.75, 0, 100), clamp(point.y + radius * 0.7, 0, 100)],
                [clamp(point.x, 0, 100), clamp(point.y - radius, 0, 100)]
            ];
            crystal.bodyNode.node.fill = colorAlpha(COLORS.crystal, 150);
            crystal.bodyNode.node.color = COLORS.crystalCore;
            crystal.coreNode.node.coordinates2d = polyCircle(point.x, point.y, Math.max(0.4, radius * 0.24 + Math.sin(crystal.pulse) * 0.08), 10);
            crystal.coreNode.node.fill = COLORS.crystalCore;
            crystal.coreNode.node.color = COLORS.transparent;
        }
        for (const anchor of this.anchors) {
            if (anchor.destroyed || !this.visibleAt(anchor.x, anchor.y, 10)) {
                hideShape(anchor.bodyNode); hideShape(anchor.coreNode); hideShape(anchor.ringNode); continue;
            }
            const point = this.worldToScreen(anchor.x, anchor.y);
            const scale = 100 / TUNING.VIEW_SIZE;
            const radius = 4.7 * scale;
            const alpha = anchor.active ? 255 : 70;
            anchor.bodyNode.node.coordinates2d = facingTriangle(point.x, point.y, anchor.rotation, radius);
            anchor.bodyNode.node.fill = colorAlpha(COLORS.anchorDark, alpha);
            anchor.bodyNode.node.color = colorAlpha(COLORS.anchor, alpha);
            anchor.bodyNode.node.effects = anchor.active ? glow(COLORS.anchor, 10) : null;
            anchor.coreNode.node.coordinates2d = polyCircle(point.x, point.y, radius * 0.35, 12);
            anchor.coreNode.node.fill = colorAlpha(COLORS.anchor, alpha);
            anchor.coreNode.node.color = COLORS.transparent;
            anchor.ringNode.node.coordinates2d = polyCircle(point.x, point.y, radius * (1.35 + Math.sin(this.tickCount / 18) * 0.08), 18);
            anchor.ringNode.node.fill = COLORS.transparent;
            anchor.ringNode.node.color = colorAlpha(COLORS.anchor, anchor.active ? 170 : 45);
        }
    }

    renderPlayer() {
        const point = this.worldToScreen(this.player.x, this.player.y);
        const blink = this.tickCount < this.player.invulnerableUntil && this.tickCount % 6 < 3;
        this.player.bodyNode.node.coordinates2d = facingTriangle(point.x, point.y, this.player.facing, 2.25);
        this.player.bodyNode.node.fill = blink ? colorAlpha(COLORS.player, 80) : COLORS.player;
        this.player.bodyNode.node.color = COLORS.white;
        this.player.coreNode.node.coordinates2d = polyCircle(point.x, point.y, 0.5, 10);
        this.player.coreNode.node.fill = COLORS.white;
        this.player.ringNode.node.coordinates2d = polyCircle(point.x, point.y, 3.2 + Math.sin(this.tickCount / 9) * 0.18, 18);
        this.player.ringNode.node.fill = COLORS.transparent;
        this.player.ringNode.node.color = this.tickCount < this.player.timeBreakUntil ? COLORS.slow : COLORS.player;
    }

    renderEchoes() {
        for (const echo of this.echoes) {
            if (!echo.active || !this.visibleAt(echo.x, echo.y, 5)) {
                hideShape(echo.bodyNode); hideShape(echo.ringNode); continue;
            }
            const point = this.worldToScreen(echo.x, echo.y);
            echo.bodyNode.node.coordinates2d = facingTriangle(point.x, point.y, echo.facing, 1.9);
            echo.bodyNode.node.fill = colorAlpha(COLORS.echo, 150);
            echo.bodyNode.node.color = colorAlpha(COLORS.white, 180);
            echo.ringNode.node.coordinates2d = polyCircle(point.x, point.y, 2.6 + Math.sin((this.tickCount + echo.id * 13) / 10) * 0.15, 14);
            echo.ringNode.node.fill = COLORS.transparent;
            echo.ringNode.node.color = colorAlpha(COLORS.echo, 130);
        }
    }

    renderEnemies() {
        for (const enemy of this.enemies) {
            if (!enemy.active || !this.visibleAt(enemy.x, enemy.y, 6)) {
                hideShape(enemy.bodyNode); hideShape(enemy.coreNode); continue;
            }
            const point = this.worldToScreen(enemy.x, enemy.y);
            const scale = 100 / TUNING.VIEW_SIZE;
            const radius = enemy.radius * scale;
            const angle = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
            let fill = COLORS.enemy;
            if (enemy.type === 'spitter') fill = COLORS.spitter;
            else if (enemy.type === 'splitter') fill = COLORS.splitter;
            else if (enemy.type === 'warden') fill = COLORS.warden;
            enemy.bodyNode.node.coordinates2d = enemy.type === 'warden'
                ? polyCircle(point.x, point.y, radius, 8)
                : facingTriangle(point.x, point.y, angle, radius * 1.15);
            enemy.bodyNode.node.fill = colorAlpha(fill, 210);
            enemy.bodyNode.node.color = fill;
            enemy.coreNode.node.coordinates2d = polyCircle(point.x, point.y, Math.max(0.25, radius * 0.28), 8);
            enemy.coreNode.node.fill = COLORS.white;
            enemy.coreNode.node.color = COLORS.transparent;
        }
    }

    renderBullets() {
        for (const bullet of this.playerBullets) {
            if (!bullet.active || !this.visibleAt(bullet.x, bullet.y, 4)) { hideShape(bullet.node); continue; }
            const point = this.worldToScreen(bullet.x, bullet.y);
            const direction = normalize(bullet.vx, bullet.vy);
            const radius = Math.max(0.72, bullet.radius * 100 / TUNING.VIEW_SIZE * 1.35);
            const trailLength = 1.75 + radius * 1.8;
            const tailX = point.x - direction.x * trailLength;
            const tailY = point.y - direction.y * trailLength;
            const headX = point.x + direction.x * radius * 0.55;
            const headY = point.y + direction.y * radius * 0.55;
            bullet.node.node.coordinates2d = thickLine(tailX, tailY, headX, headY, radius * 1.15);
            bullet.node.node.fill = bullet.echo ? [222, 174, 255, 255] : [126, 246, 255, 255];
            bullet.node.node.color = COLORS.white;
            bullet.node.node.border = 2;
        }
        for (const bullet of this.enemyBullets) {
            if (!bullet.active || !this.visibleAt(bullet.x, bullet.y, 4)) { hideShape(bullet.node); continue; }
            const point = this.worldToScreen(bullet.x, bullet.y);
            const radius = Math.max(0.72, bullet.radius * 100 / TUNING.VIEW_SIZE * 1.15);
            bullet.node.node.coordinates2d = polyCircle(point.x, point.y, radius, 10);
            bullet.node.node.fill = bullet.color;
            bullet.node.node.color = COLORS.white;
            bullet.node.node.border = 2;
        }
    }

    renderPickups() {
        for (const pickup of this.pickups) {
            if (!pickup.active || !this.visibleAt(pickup.x, pickup.y, 3)) { hideShape(pickup.node); continue; }
            const point = this.worldToScreen(pickup.x, pickup.y);
            const radius = 0.55 + Math.sin(pickup.phase) * 0.12;
            pickup.node.node.coordinates2d = [
                [clamp(point.x, 0, 100), clamp(point.y - radius, 0, 100)], [clamp(point.x + radius, 0, 100), clamp(point.y, 0, 100)], [clamp(point.x, 0, 100), clamp(point.y + radius, 0, 100)], [clamp(point.x - radius, 0, 100), clamp(point.y, 0, 100)], [clamp(point.x, 0, 100), clamp(point.y - radius, 0, 100)]
            ];
            pickup.node.node.fill = COLORS.xp;
            pickup.node.node.color = COLORS.transparent;
        }
    }

    renderParticles() {
        for (const particle of this.particles) {
            if (!particle.active || !this.visibleAt(particle.x, particle.y, 3)) { hideShape(particle.node); continue; }
            const point = this.worldToScreen(particle.x, particle.y);
            const alpha = particle.maxLife > 0 ? 255 * particle.life / particle.maxLife : 0;
            particle.node.node.coordinates2d = polyCircle(point.x, point.y, Math.max(0.08, particle.size * 100 / TUNING.VIEW_SIZE), 6);
            particle.node.node.fill = colorAlpha(particle.color, alpha);
            particle.node.node.color = COLORS.transparent;
        }
    }

    renderBoss() {
        if (!this.boss.active || !this.visibleAt(this.boss.x, this.boss.y, 18)) {
            hideShape(this.boss.bodyNode); hideShape(this.boss.coreNode); hideShape(this.boss.ringNode);
            for (const node of this.boss.laserNodes) hideShape(node);
            return;
        }
        const point = this.worldToScreen(this.boss.x, this.boss.y);
        const scale = 100 / TUNING.VIEW_SIZE;
        const radius = this.boss.radius * scale;
        this.boss.bodyNode.node.coordinates2d = polyCircle(point.x, point.y, radius, 24);
        this.boss.bodyNode.node.fill = colorAlpha(COLORS.enemyDark, 245);
        this.boss.bodyNode.node.color = COLORS.boss;
        this.boss.coreNode.node.coordinates2d = polyCircle(point.x, point.y, radius * (0.32 + Math.sin(this.tickCount / 7) * 0.04), 16);
        this.boss.coreNode.node.fill = COLORS.bossCore;
        this.boss.coreNode.node.color = COLORS.transparent;
        this.boss.ringNode.node.coordinates2d = polyCircle(point.x, point.y, radius * 1.35, 28);
        this.boss.ringNode.node.fill = COLORS.transparent;
        this.boss.ringNode.node.color = COLORS.boss;
        if (this.tickCount < this.boss.laserUntil) {
            const armCount = this.boss.phase >= 3 ? 4 : 3;
            for (let index = 0; index < this.boss.laserNodes.length; index += 1) {
                const node = this.boss.laserNodes[index];
                if (index >= armCount) { hideShape(node); continue; }
                const angle = this.boss.angle * 1.8 + index / armCount * Math.PI * 2;
                const x2 = this.boss.x + Math.cos(angle) * 54;
                const y2 = this.boss.y + Math.sin(angle) * 54;
                const end = this.worldToScreen(x2, y2);
                node.node.coordinates2d = thickLine(point.x, point.y, clamp(end.x, 0, 100), clamp(end.y, 0, 100), 0.85);
                node.node.fill = colorAlpha(COLORS.boss, 205);
                node.node.color = COLORS.transparent;
            }
        } else {
            for (const node of this.boss.laserNodes) hideShape(node);
        }
    }

    renderHUD() {
        const healthRatio = clamp(this.player.health / this.player.maxHealth, 0, 1);
        const xpRatio = clamp(this.player.xp / this.player.nextXp, 0, 1);
        const echoRatio = this.tickCount >= this.player.echoReady ? 1 : 1 - (this.player.echoReady - this.tickCount) / (TUNING.ECHO_COOLDOWN_SECONDS * TUNING.TICK_RATE);
        const breakRatio = this.tickCount >= this.player.timeBreakReady ? 1 : 1 - (this.player.timeBreakReady - this.tickCount) / (TUNING.TIME_BREAK_COOLDOWN_SECONDS * TUNING.TICK_RATE);
        this.healthFill.node.coordinates2d = rectangle(3, 2, 25 * healthRatio, 3);
        this.xpFill.node.coordinates2d = rectangle(31, 2, 22 * xpRatio, 3);
        this.echoFill.node.coordinates2d = rectangle(56, 2, 17 * clamp(echoRatio, 0, 1), 3);
        this.breakFill.node.coordinates2d = rectangle(76, 2, 17 * clamp(breakRatio, 0, 1), 3);
        setText(this.healthText, `HP ${Math.ceil(this.player.health)}`, 15.5, 2.1, 0.85, COLORS.white);
        setText(this.xpText, `LV ${this.player.level}`, 42, 2.1, 0.85, COLORS.white);
        setText(this.echoText, `ECHO ${this.echoes.filter((echo) => echo.active).length}/${this.player.echoSlots}`, 64.5, 2.1, 0.7, COLORS.white);
        setText(this.breakText, this.tickCount < this.player.timeBreakUntil ? 'BREAK ACTIVE' : 'BREAK', 84.5, 2.1, 0.7, COLORS.white);
        setText(this.scoreText, `${Math.round(this.score)}`, 97, 2.2, 1.05, COLORS.gold, 'right');
        const status = this.tickCount < this.statusUntil ? this.statusText : this.combo >= 3 ? `${this.combo}x TEMPORAL COMBO` : '';
        setText(this.statusNode, status, 50, 9.5, 1.05, this.combo >= 3 && this.tickCount >= this.statusUntil ? COLORS.gold : COLORS.white);
        const active = this.getActiveAnchor();
        const objective = this.boss.active
            ? `DESTROY THE PARADOX ENGINE — PHASE ${this.boss.phase}`
            : active
                ? `SHATTER RIFT ANCHOR ${this.anchorsDestroyed + 1}/4   ${Math.max(0, Math.ceil(active.health))} HP`
                : 'THE TIMELINE IS REWRITING';
        setText(this.objectiveNode, objective, 50, 94.2, 1.05, this.boss.active ? COLORS.boss : COLORS.anchor);

        const dashReady = this.tickCount >= this.player.dashReady;
        const echoReady = this.tickCount >= this.player.echoReady;
        const breakReady = this.tickCount >= this.player.timeBreakReady;
        this.dashButton.shape.node.fill = dashReady ? COLORS.playerDark : COLORS.panelAlt;
        this.echoButton.shape.node.fill = echoReady ? COLORS.echoDark : COLORS.panelAlt;
        this.breakButton.shape.node.fill = breakReady ? [29, 43, 90, 255] : COLORS.panelAlt;

        for (let index = 0; index < this.minimapAnchors.length; index += 1) {
            const anchor = this.anchors[index];
            const node = this.minimapAnchors[index];
            if (anchor.destroyed) { hideShape(node); continue; }
            const x = 82 + anchor.x / TUNING.WORLD_SIZE * 15;
            const y = 67 + anchor.y / TUNING.WORLD_SIZE * 15;
            node.node.coordinates2d = rectangle(x - 0.55, y - 0.55, 1.1, 1.1);
            node.node.fill = anchor.active ? COLORS.anchor : colorAlpha(COLORS.anchor, 70);
            node.node.color = COLORS.transparent;
        }
        const playerMapX = 82 + this.player.x / TUNING.WORLD_SIZE * 15;
        const playerMapY = 67 + this.player.y / TUNING.WORLD_SIZE * 15;
        this.minimapPlayer.node.coordinates2d = polyCircle(playerMapX, playerMapY, 0.75, 8);
        if (this.boss.active) {
            const bossMapX = 82 + this.boss.x / TUNING.WORLD_SIZE * 15;
            const bossMapY = 67 + this.boss.y / TUNING.WORLD_SIZE * 15;
            this.minimapBoss.node.coordinates2d = polyCircle(bossMapX, bossMapY, 0.85, 8);
            this.minimapBoss.node.fill = COLORS.boss;
        } else hideShape(this.minimapBoss);

        if (this.boss.active) {
            const ratio = clamp(this.boss.health / this.boss.maxHealth, 0, 1);
            this.bossHealthBack.node.coordinates2d = rectangle(20, 10.5, 60, 3);
            this.bossHealthBack.node.fill = COLORS.enemyDark;
            this.bossHealthFill.node.coordinates2d = rectangle(20, 10.5, 60 * ratio, 3);
            this.bossHealthFill.node.fill = COLORS.boss;
            setText(this.bossHealthText, `PARADOX ENGINE ${Math.ceil(this.boss.health)}`, 50, 10.7, 0.9, COLORS.white);
        } else {
            hideShape(this.bossHealthBack);
            hideShape(this.bossHealthFill);
            setText(this.bossHealthText, '', 50, 10.7, 0.9, COLORS.white);
        }
    }

    formatTime(seconds) {
        const total = Math.max(0, Math.floor(seconds));
        const minutes = Math.floor(total / 60);
        const remainder = total % 60;
        return `${minutes}:${String(remainder).padStart(2, '0')}`;
    }
}

module.exports = Chronoclast;
