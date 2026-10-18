'use strict';

const { Game, GameNode, Shapes, ShapeUtils } = require('squish-150');

const TUNING = {
    TICK_RATE: 15, // tickRate - MUST match metadata() literal
    MAX_PLAYERS: 4, // maxPlayers - MUST match metadata() literal
    WORLD_SIZE: 300,
    SECTOR_SIZE: 100,
    VIEW_SIZE: 100,
    VIEW_SCREEN_SIZE: 84,
    MAX_ENEMIES: 12,
    MAX_PROJECTILES: 6,
    MAX_PARTICLES: 4,
    SQUAD_PER_COMMANDER: 3,
    PLAYER_SPEED: 13,
    PLAYER_MAX_HEALTH: 120,
    PLAYER_ATTACK_RANGE: 7.5,
    PLAYER_ATTACK_DAMAGE: 8,
    PLAYER_ATTACK_SECONDS: 0.55,
    STRIKE_DAMAGE: 28,
    STRIKE_RANGE: 10,
    STRIKE_SECONDS: 1.25,
    DASH_DISTANCE: 15,
    DASH_SECONDS: 3.2,
    CAPTURE_SECONDS: 3.5,
    RESPAWN_SECONDS: 4,
    UPGRADE_SECONDS: 12,
    STARTING_MORALE: 4,
    BOSS_REQUIRED_OUTPOSTS: 2,
    TAP_TARGET_RADIUS: 7,
    STATUS_SECONDS: 2.2
};

const COLORS = {
    black: [8, 10, 14, 255],
    panel: [18, 22, 29, 255],
    panelAlt: [29, 35, 44, 255],
    line: [66, 78, 91, 255],
    white: [242, 244, 238, 255],
    muted: [151, 159, 160, 255],
    player: [85, 220, 255, 255],
    playerDark: [20, 98, 126, 255],
    ally: [110, 239, 156, 255],
    guard: [120, 205, 255, 255],
    ranger: [252, 213, 92, 255],
    medic: [109, 245, 169, 255],
    enemy: [243, 78, 91, 255],
    enemyDark: [117, 31, 42, 255],
    archer: [255, 142, 80, 255],
    captain: [213, 82, 255, 255],
    boss: [255, 61, 140, 255],
    shrine: [166, 116, 255, 255],
    outpost: [255, 191, 71, 255],
    captured: [83, 234, 143, 255],
    danger: [255, 71, 83, 255],
    transparent: [0, 0, 0, 0],
    biomeMoss: [20, 43, 37, 255],
    biomeEmber: [48, 27, 25, 255],
    biomeDusk: [29, 31, 52, 255],
    obstacleMoss: [52, 84, 68, 255],
    obstacleEmber: [91, 51, 42, 255],
    obstacleDusk: [63, 64, 92, 255]
};

const PLAYER_COLORS = [
    [85, 220, 255, 255],
    [255, 202, 80, 255],
    [139, 239, 115, 255],
    [197, 111, 255, 255]
];

const SEEDS = [1337, 2600, 9001, 414, 2026, 7777, 31415, 8675309];
const BIOMES = ['MOSS', 'EMBER', 'DUSK'];

const UPGRADE_DEFS = {
    ironEdge: { name: 'IRON EDGE', description: '+45% strike damage' },
    warDrums: { name: 'WAR DRUMS', description: '+30% squad damage' },
    secondWind: { name: 'SECOND WIND', description: 'Regenerate health safely' },
    shockDash: { name: 'SHOCK DASH', description: 'Dash damages enemies' },
    bannerAura: { name: 'BANNER AURA', description: 'Nearby squad moves faster' },
    fieldMedic: { name: 'FIELD MEDIC', description: 'Medic healing doubled' },
    executioner: { name: 'EXECUTIONER', description: 'More damage to captains' },
    ironCompany: { name: 'IRON COMPANY', description: '+35% squad maximum health' },
    bloodRush: { name: 'BLOOD RUSH', description: 'Kills reduce cooldowns' }
};
const UPGRADE_KEYS = Object.keys(UPGRADE_DEFS);

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function distanceXY(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
}

function normalize(dx, dy) {
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length <= 0.0001) return { x: 0, y: 0 };
    return { x: dx / length, y: dy / length };
}

function rectangle(x, y, width, height) {
    return ShapeUtils.rectangle(x, y, width, height);
}

function screenPoint(x, y) {
    return [clamp(Math.abs(x) < 1e-9 ? 0 : x, 0, 100), clamp(Math.abs(y) < 1e-9 ? 0 : y, 0, 100)];
}

function polyCircle(cx, cy, radius, sides = 14) {
    const points = [];
    for (let index = 0; index <= sides; index += 1) {
        const angle = index / sides * Math.PI * 2;
        points.push(screenPoint(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius));
    }
    return points;
}

function diamond(cx, cy, radius) {
    return [screenPoint(cx, cy - radius), screenPoint(cx + radius, cy), screenPoint(cx, cy + radius), screenPoint(cx - radius, cy), screenPoint(cx, cy - radius)];
}

function triangleFacing(cx, cy, angle, size) {
    return [
        screenPoint(cx + Math.cos(angle) * size, cy + Math.sin(angle) * size),
        screenPoint(cx + Math.cos(angle + 2.45) * size, cy + Math.sin(angle + 2.45) * size),
        screenPoint(cx + Math.cos(angle - 2.45) * size, cy + Math.sin(angle - 2.45) * size),
        screenPoint(cx + Math.cos(angle) * size, cy + Math.sin(angle) * size)
    ];
}

function thickLine(x1, y1, x2, y2, width) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const dx = Math.sin(angle) * width / 2;
    const dy = Math.cos(angle) * width / 2;
    return [
        screenPoint(x1 - dx, y1 + dy), screenPoint(x2 - dx, y2 + dy),
        screenPoint(x2 + dx, y2 - dy), screenPoint(x1 + dx, y1 - dy), screenPoint(x1 - dx, y1 + dy)
    ];
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
        color: COLORS.white,
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
    node.node.color = [255, 255, 255, 0];
    node.node.effects = null;
}

function makeButton(x, y, width, height, label, playerIds, onClick) {
    const shape = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: rectangle(x, y, width, height),
        fill: COLORS.panelAlt,
        color: COLORS.line,
        border: 3,
        playerIds,
        onClick
    });
    const text = makeText(label, x + width / 2, y + height / 2 - 0.7, 1.15, COLORS.white, 'center', playerIds);
    shape.addChild(text);
    return { group: shape, shape, text, x, y, width, height };
}

class Bannerbound extends Game {
    static metadata() {
        return {
            isTest: true, // Showcase review: docs/game-curation.json.
            thumbnail: './assets/thumbnail.png',
            squishVersion: '150',
            name: 'Bannerbound',
            author: "Joseph Garcia",
            description: 'Fight personally, command a warband, capture a generated world, and break the enemy citadel.',
            aspectRatio: { x: 1, y: 1 },
            tickRate: 15, // keep in sync with TUNING.TICK_RATE; must remain literal
            maxPlayers: 4, // keep in sync with TUNING.MAX_PLAYERS; must remain literal
            services: ['multiplayer']
        };
    }

    constructor() {
        super();
        this.phase = 'lobby';
        this.tickCount = 0;
        this.seedIndex = 0;
        this.players = {};
        this.playerOrder = [];
        this.commanders = [];
        this.squadUnits = [];
        this.enemies = [];
        this.projectiles = [];
        this.particles = [];
        this.world = null;
        this.teamMorale = TUNING.STARTING_MORALE;
        this.outpostsCaptured = 0;
        this.statusText = '';
        this.statusUntil = 0;
        this.upgradeTimer = 0;
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 0, 100, 100),
            fill: COLORS.black,
            color: COLORS.white
        });
        this.lobbyLayer = makeContainer();
        this.gameLayer = makeContainer();
        this.anchorLayer = makeContainer();
        this.base.addChildren(this.lobbyLayer, this.gameLayer, this.anchorLayer);
        this.renderLobby();
    }

    getLayers() {
        return [{ root: this.base }];
    }

    handleNewPlayer({ playerId, info }) {
        const id = Number(playerId);
        if (this.players[id]) return;
        const player = {
            id,
            name: info && info.name ? String(info.name).slice(0, 18) : `PLAYER ${id}`,
            anchor: new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: COLORS.transparent,
                color: COLORS.white,
                playerIds: [id]
            }),
            view: null,
            commanderId: null,
            spectator: false,
            pendingUpgradeChoices: [],
            upgradeChosen: false
        };
        this.players[id] = player;
        this.playerOrder.push(id);
        this.anchorLayer.addChild(player.anchor);

        if (this.phase === 'lobby') {
            this.renderLobby();
        } else if (this.phase === 'running' || this.phase === 'upgrade') {
            this.spawnLatePlayer(player);
        } else {
            player.spectator = true;
            this.buildSpectatorView(player);
        }
        this.base.node.onStateChange();
    }

    handlePlayerDisconnect(playerId) {
        const id = Number(playerId);
        const player = this.players[id];
        if (!player) return;
        const commander = this.getCommander(player.commanderId);
        if (commander && commander.alive) {
            commander.playerId = null;
            commander.isBot = true;
            commander.botThinkAt = this.tickCount;
            this.setStatus(`${commander.name} is now AI-controlled`);
        }
        if (player.view) this.gameLayer.removeChild(player.view.root.id);
        this.anchorLayer.removeChild(player.anchor.id);
        delete this.players[id];
        this.playerOrder = this.playerOrder.filter((existing) => existing !== id);
        if (this.phase === 'lobby') this.renderLobby();
        this.base.node.onStateChange();
    }

    handleKeyDown(playerId, key) {
        const commander = this.getCommanderForPlayer(Number(playerId));
        if (!commander) {
            if (this.phase === 'lobby' && (key === 'Enter' || key === ' ')) this.startGame(Number(playerId));
            return;
        }
        commander.keys[key] = true;
        if (key === ' ') this.useStrike(commander);
        else if (key === 'e' || key === 'E') this.useDash(commander);
        else if (key === '1') this.setSquadMode(commander, 'follow');
        else if (key === '2') this.beginCommand(commander, 'hold');
        else if (key === '3') this.beginCommand(commander, 'assault');
        else if (key === '4') this.setSquadMode(commander, 'rally');
        else if (key === 'Enter' && (this.phase === 'victory' || this.phase === 'defeat')) this.returnToLobby();
    }

    handleKeyUp(playerId, key) {
        const commander = this.getCommanderForPlayer(Number(playerId));
        if (!commander) return;
        delete commander.keys[key];
    }

    tick() {
        this.tickCount += 1;
        if (this.phase === 'running') {
            this.updateRunningGame();
            this.renderAllViews();
            this.base.node.onStateChange();
        } else if (this.phase === 'upgrade') {
            this.upgradeTimer -= 1;
            if (this.upgradeTimer <= 0 || this.allHumansChoseUpgrade()) this.finishUpgradePhase();
            this.renderAllViews();
            this.base.node.onStateChange();
        } else if (this.phase === 'victory' || this.phase === 'defeat') {
            if (this.tickCount % TUNING.TICK_RATE === 0) {
                this.renderAllViews();
                this.base.node.onStateChange();
            }
        }
    }

    renderLobby() {
        this.phase = 'lobby';
        this.lobbyLayer.clearChildren();
        this.gameLayer.clearChildren();
        const seed = SEEDS[this.seedIndex];

        const preview = this.generateWorld(seed);
        this.renderLobbyMapPreview(preview);

        const previous = makeButton(10, 68, 14, 9, '‹ MAP', [], () => this.cycleSeed(-1));
        const next = makeButton(76, 68, 14, 9, 'MAP ›', [], () => this.cycleSeed(1));
        const start = makeButton(28, 79, 44, 10, 'BEGIN CAMPAIGN', [], (playerId) => this.startGame(Number(playerId)));
        start.shape.node.fill = COLORS.playerDark;
        start.shape.node.color = COLORS.player;
        this.lobbyLayer.addChildren(previous.group, next.group, start.group);
        this.lobbyLayer.addChild(makeText(`MAP ${this.seedIndex + 1}`, 50, 70.5, 1.45, COLORS.outpost));
        this.lobbyLayer.addChild(makeText(
            `${this.playerOrder.length} COMMANDER${this.playerOrder.length === 1 ? '' : 'S'} READY`,
            50,
            93,
            1.4,
            this.playerOrder.length ? COLORS.ally : COLORS.muted
        ));

    }

    renderLobbyMapPreview(world) {
        const originX = 27;
        const originY = 29;
        const cell = 14;
        for (const sector of world.sectors) {
            const x = originX + sector.gx * cell;
            const y = originY + sector.gy * cell;
            let fill = this.biomeFill(sector.biome);
            let border = COLORS.line;
            if (sector.type === 'START') border = COLORS.player;
            else if (sector.type === 'OUTPOST') border = COLORS.outpost;
            else if (sector.type === 'SHRINE') border = COLORS.shrine;
            else if (sector.type === 'BOSS') border = COLORS.boss;
            this.lobbyLayer.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(x, y, 12, 12),
                fill,
                color: border,
                border: 5
            }));
            if (sector.type !== 'WILD') {
                this.lobbyLayer.addChild(makeText(
                    sector.type === 'START' ? 'S' : sector.type === 'OUTPOST' ? 'O' : sector.type === 'SHRINE' ? '+' : 'X',
                    x + 6,
                    y + 4.4,
                    2,
                    border
                ));
            }
        }
        this.lobbyLayer.addChild(makeText(world.name, 50, 61, 1.65, COLORS.white));
        this.lobbyLayer.addChild(makeText('9 GENERATED SECTORS • 2 OUTPOSTS • 1 CITADEL', 50, 64.5, 0.9, COLORS.muted));
    }

    cycleSeed(direction) {
        if (this.phase !== 'lobby') return;
        this.seedIndex = (this.seedIndex + direction + SEEDS.length) % SEEDS.length;
        this.renderLobby();
        this.base.node.onStateChange();
    }

    startGame(requestingPlayerId) {
        if (this.phase !== 'lobby' || !this.players[requestingPlayerId]) return;
        this.phase = 'running';
        this.tickCount = 0;
        this.statusText = '';
        this.statusUntil = 0;
        this.teamMorale = TUNING.STARTING_MORALE + Math.max(0, this.playerOrder.length - 1);
        this.outpostsCaptured = 0;
        this.world = this.generateWorld(SEEDS[this.seedIndex]);
        this.commanders = [];
        this.squadUnits = [];
        this.enemies = [];
        this.projectiles = [];
        this.particles = [];
        this.lobbyLayer.clearChildren();
        this.gameLayer.clearChildren();
        this.buildLogicalPools();

        for (let index = 0; index < this.playerOrder.length; index += 1) {
            const player = this.players[this.playerOrder[index]];
            this.spawnCommanderForPlayer(player, index);
            this.buildPlayerView(player);
        }
        this.spawnSectorEncounter(this.world.startSectorId);
        this.setStatus('Capture two outposts. Break the citadel.');
        this.renderAllViews();
        this.base.node.onStateChange();
    }

    returnToLobby() {
        for (const id of this.playerOrder) {
            const player = this.players[id];
            player.commanderId = null;
            player.view = null;
            player.spectator = false;
        }
        this.world = null;
        this.commanders = [];
        this.squadUnits = [];
        this.enemies = [];
        this.projectiles = [];
        this.particles = [];
        this.renderLobby();
        this.base.node.onStateChange();
    }

    buildLogicalPools() {
        for (let index = 0; index < TUNING.MAX_ENEMIES; index += 1) {
            this.enemies.push({ id: `e${index}`, active: false });
        }
        for (let index = 0; index < TUNING.MAX_PROJECTILES; index += 1) {
            this.projectiles.push({ id: `p${index}`, active: false });
        }
        for (let index = 0; index < TUNING.MAX_PARTICLES; index += 1) {
            this.particles.push({ id: `fx${index}`, active: false });
        }
    }

    spawnCommanderForPlayer(player, colorIndex) {
        const start = this.world.sectors[this.world.startSectorId];
        const offset = this.commanders.length * 4;
        const commander = {
            id: `c${this.commanders.length + 1}`,
            playerId: player.id,
            name: player.name,
            color: PLAYER_COLORS[colorIndex % PLAYER_COLORS.length],
            x: start.cx - 5 + offset,
            y: start.cy + 10,
            health: TUNING.PLAYER_MAX_HEALTH,
            maxHealth: TUNING.PLAYER_MAX_HEALTH,
            alive: true,
            respawnAt: 0,
            invulnerableUntil: 0,
            facing: -Math.PI / 2,
            keys: {},
            moveTarget: null,
            focusTargetId: null,
            attackReady: 0,
            strikeReady: 0,
            dashReady: 0,
            squadMode: 'follow',
            pendingCommand: null,
            commandX: start.cx,
            commandY: start.cy,
            status: '',
            statusUntil: 0,
            upgrades: {},
            kills: 0,
            isBot: false,
            botThinkAt: 0,
            squadIds: []
        };
        this.commanders.push(commander);
        player.commanderId = commander.id;
        player.spectator = false;
        for (let unitIndex = 0; unitIndex < TUNING.SQUAD_PER_COMMANDER; unitIndex += 1) {
            const type = ['guard', 'ranger', 'medic'][unitIndex];
            const unit = this.makeSquadUnit(commander, type, unitIndex);
            this.squadUnits.push(unit);
            commander.squadIds.push(unit.id);
        }
    }

    spawnLatePlayer(player) {
        if (!this.world) {
            player.spectator = true;
            this.buildSpectatorView(player);
            return;
        }
        const abandoned = this.commanders.find((commander) => commander.playerId === null);
        if (abandoned) {
            abandoned.playerId = player.id;
            abandoned.isBot = false;
            abandoned.name = player.name;
            abandoned.keys = {};
            player.commanderId = abandoned.id;
            player.spectator = false;
        } else if (this.commanders.length < TUNING.MAX_PLAYERS) {
            this.spawnCommanderForPlayer(player, this.commanders.length);
        } else {
            player.spectator = true;
            this.buildSpectatorView(player);
            return;
        }
        this.buildPlayerView(player);
        if (this.phase === 'upgrade') {
            player.upgradeChosen = false;
            player.pendingUpgradeChoices = this.chooseUpgradeOptions(player.id);
            this.renderUpgradeOverlay(player);
        }
        this.setStatus(`${player.name} joined the campaign`);
    }

    makeSquadUnit(commander, type, index) {
        const stats = {
            guard: { health: 70, speed: 9, range: 3.5, damage: 9, cooldown: 0.8 },
            ranger: { health: 48, speed: 9.5, range: 17, damage: 7, cooldown: 1.05 },
            medic: { health: 52, speed: 9, range: 12, damage: 3, cooldown: 1.25 }
        }[type];
        return {
            id: `s${commander.id}-${index}`,
            ownerCommanderId: commander.id,
            type,
            x: commander.x + (index - 1) * 3,
            y: commander.y + 4,
            health: stats.health,
            maxHealth: stats.health,
            speed: stats.speed,
            range: stats.range,
            damage: stats.damage,
            cooldownTicks: Math.round(stats.cooldown * TUNING.TICK_RATE),
            attackReady: 0,
            alive: true,
            respawnAt: 0,
            facing: -Math.PI / 2
        };
    }

    getCommander(id) {
        return this.commanders.find((commander) => commander.id === id) || null;
    }

    getCommanderForPlayer(playerId) {
        const player = this.players[playerId];
        return player ? this.getCommander(player.commanderId) : null;
    }

    buildPlayerView(player) {
        const ids = [player.id];
        const root = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 0, 100, 100),
            fill: COLORS.black,
            color: COLORS.white,
            playerIds: ids
        });
        const worldBackdrop = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 0, TUNING.VIEW_SCREEN_SIZE, TUNING.VIEW_SCREEN_SIZE),
            fill: COLORS.biomeMoss,
            color: COLORS.line,
            border: 2,
            playerIds: ids
        });
        root.addChild(worldBackdrop);

        const boundaryNodes = [];
        for (let index = 0; index < 4; index += 1) {
            const node = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: COLORS.line,
                color: COLORS.white,
                playerIds: ids
            });
            boundaryNodes.push(node);
            root.addChild(node);
        }

        const obstacleNodes = [];
        for (let index = 0; index < 6; index += 1) {
            const node = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: COLORS.transparent,
                color: COLORS.white,
                playerIds: ids
            });
            obstacleNodes.push(node);
            root.addChild(node);
        }

        const objectiveNodes = [];
        for (let index = 0; index < 3; index += 1) {
            const node = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: COLORS.transparent,
                color: COLORS.white,
                playerIds: ids
            });
            objectiveNodes.push(node);
            root.addChild(node);
        }

        const commanderNodes = [];
        for (let index = 0; index < TUNING.MAX_PLAYERS; index += 1) {
            const node = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: COLORS.transparent,
                color: COLORS.white,
                playerIds: ids
            });
            commanderNodes.push(node);
            root.addChild(node);
        }

        const squadNodes = [];
        for (let index = 0; index < TUNING.MAX_PLAYERS * TUNING.SQUAD_PER_COMMANDER; index += 1) {
            const node = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: COLORS.transparent,
                color: COLORS.white,
                playerIds: ids
            });
            squadNodes.push(node);
            root.addChild(node);
        }

        const enemyNodes = [];
        for (let index = 0; index < TUNING.MAX_ENEMIES; index += 1) {
            const node = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: COLORS.transparent,
                color: COLORS.white,
                playerIds: ids
            });
            enemyNodes.push(node);
            root.addChild(node);
        }

        const projectileNodes = [];
        for (let index = 0; index < TUNING.MAX_PROJECTILES; index += 1) {
            const node = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: COLORS.transparent,
                color: COLORS.white,
                playerIds: ids
            });
            projectileNodes.push(node);
            root.addChild(node);
        }

        const particleNodes = [];
        for (let index = 0; index < TUNING.MAX_PARTICLES; index += 1) {
            const node = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: COLORS.transparent,
                color: COLORS.white,
                playerIds: ids
            });
            particleNodes.push(node);
            root.addChild(node);
        }

        const tapCatcher = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 0, TUNING.VIEW_SCREEN_SIZE, TUNING.VIEW_SCREEN_SIZE),
            fill: COLORS.transparent,
            color: [255, 255, 255, 0],
            playerIds: ids,
            onClick: (clickingPlayerId, x, y) => this.handleWorldTap(Number(clickingPlayerId), x, y)
        });
        root.addChild(tapCatcher);

        const bottomPanel = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 84, 84, 16),
            fill: COLORS.panel,
            color: COLORS.line,
            border: 2,
            playerIds: ids
        });
        const rightPanel = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(84, 0, 16, 100),
            fill: COLORS.panel,
            color: COLORS.line,
            border: 2,
            playerIds: ids
        });
        root.addChildren(bottomPanel, rightPanel);

        const hpBack = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(2, 88, 30, 4),
            fill: COLORS.enemyDark,
            color: COLORS.line,
            border: 2,
            playerIds: ids
        });
        const hpFill = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(2, 88, 30, 4),
            fill: PLAYER_COLORS[this.playerOrder.indexOf(player.id) % PLAYER_COLORS.length],
            color: COLORS.white,
            playerIds: ids
        });
        const hpText = makeText('HP 120/120', 17, 88.9, 1.15, COLORS.white, 'center', ids);
        const objectiveText = makeText('', 2, 94, 1.05, COLORS.white, 'left', ids);
        const status = makeText('', 2, 97, 0.9, COLORS.muted, 'left', ids);
        root.addChildren(hpBack, hpFill, hpText, objectiveText, status);

        const minimapCells = [];
        for (let index = 0; index < 9; index += 1) {
            const gx = index % 3;
            const gy = Math.floor(index / 3);
            const cell = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(86 + gx * 4, 2 + gy * 4, 3.2, 3.2),
                fill: COLORS.panelAlt,
                color: COLORS.line,
                border: 2,
                playerIds: ids
            });
            minimapCells.push(cell);
            root.addChild(cell);
        }
        const minimapMarker = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: polyCircle(87.6, 3.6, 0.7, 8),
            fill: COLORS.player,
            color: COLORS.white,
            effects: glow(COLORS.player, 4),
            playerIds: ids
        });
        root.addChild(minimapMarker);

        const strikeButton = makeButton(85.5, 17, 13, 9, 'STRIKE', ids, (clickingPlayerId) => {
            const commander = this.getCommanderForPlayer(Number(clickingPlayerId));
            if (commander) this.useStrike(commander);
        });
        const dashButton = makeButton(85.5, 28, 13, 9, 'DASH', ids, (clickingPlayerId) => {
            const commander = this.getCommanderForPlayer(Number(clickingPlayerId));
            if (commander) this.useDash(commander);
        });
        const followButton = makeButton(85.5, 45, 13, 8, 'FOLLOW', ids, (clickingPlayerId) => {
            const commander = this.getCommanderForPlayer(Number(clickingPlayerId));
            if (commander) this.setSquadMode(commander, 'follow');
        });
        const holdButton = makeButton(85.5, 55, 13, 8, 'HOLD', ids, (clickingPlayerId) => {
            const commander = this.getCommanderForPlayer(Number(clickingPlayerId));
            if (commander) this.beginCommand(commander, 'hold');
        });
        const assaultButton = makeButton(85.5, 65, 13, 8, 'ASSAULT', ids, (clickingPlayerId) => {
            const commander = this.getCommanderForPlayer(Number(clickingPlayerId));
            if (commander) this.beginCommand(commander, 'assault');
        });
        const rallyButton = makeButton(85.5, 75, 13, 8, 'RALLY', ids, (clickingPlayerId) => {
            const commander = this.getCommanderForPlayer(Number(clickingPlayerId));
            if (commander) this.setSquadMode(commander, 'rally');
        });
        root.addChildren(strikeButton.group, dashButton.group, followButton.group, holdButton.group, assaultButton.group, rallyButton.group);

        const squadText = makeText('SQUAD FOLLOW', 92, 87, 0.92, COLORS.ally, 'center', ids);
        const cooldownText = makeText('', 92, 91, 0.88, COLORS.muted, 'center', ids);
        const bossText = makeText('', 92, 95, 0.88, COLORS.boss, 'center', ids);
        root.addChildren(squadText, cooldownText, bossText);

        const overlay = makeContainer(ids);
        root.addChild(overlay);

        player.view = {
            root,
            worldBackdrop,
            boundaryNodes,
            obstacleNodes,
            objectiveNodes,
            commanderNodes,
            squadNodes,
            enemyNodes,
            projectileNodes,
            particleNodes,
            tapCatcher,
            hpFill,
            hpText,
            objectiveText,
            status,
            minimapCells,
            minimapMarker,
            strikeButton,
            dashButton,
            followButton,
            holdButton,
            assaultButton,
            rallyButton,
            squadText,
            cooldownText,
            bossText,
            overlay,
            cameraX: 0,
            cameraY: 0
        };
        this.gameLayer.addChild(root);
    }

    buildSpectatorView(player) {
        const root = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 0, 100, 100),
            fill: COLORS.black,
            color: COLORS.white,
            playerIds: [player.id]
        });
        root.addChild(makeText('CAMPAIGN IN PROGRESS', 50, 40, 3, COLORS.outpost, 'center', [player.id]));
        root.addChild(makeText('You joined as a spectator.', 50, 48, 1.4, COLORS.white, 'center', [player.id]));
        player.view = { root, spectator: true };
        this.gameLayer.addChild(root);
    }

    updateRunningGame() {
        for (const commander of this.commanders) this.updateCommander(commander);
        for (const unit of this.squadUnits) this.updateSquadUnit(unit);
        for (const enemy of this.enemies) this.updateEnemy(enemy);
        for (const projectile of this.projectiles) this.updateProjectile(projectile);
        for (const particle of this.particles) this.updateParticle(particle);
        this.updateSectors();
        this.updateEnemyWar();
        this.updateRespawns();
        this.checkDefeat();
    }

    updateCommander(commander) {
        if (!commander.alive) return;
        if (commander.isBot) this.updateBotCommander(commander);

        let dx = 0;
        let dy = 0;
        if (commander.keys.ArrowLeft || commander.keys.a || commander.keys.A) dx -= 1;
        if (commander.keys.ArrowRight || commander.keys.d || commander.keys.D) dx += 1;
        if (commander.keys.ArrowUp || commander.keys.w || commander.keys.W) dy -= 1;
        if (commander.keys.ArrowDown || commander.keys.s || commander.keys.S) dy += 1;

        if (dx !== 0 || dy !== 0) {
            commander.moveTarget = null;
            const direction = normalize(dx, dy);
            this.moveEntity(commander, direction.x * TUNING.PLAYER_SPEED / TUNING.TICK_RATE, direction.y * TUNING.PLAYER_SPEED / TUNING.TICK_RATE, 2.2);
            commander.facing = Math.atan2(direction.y, direction.x);
        } else if (commander.moveTarget) {
            const direction = normalize(commander.moveTarget.x - commander.x, commander.moveTarget.y - commander.y);
            const remaining = distanceXY(commander.x, commander.y, commander.moveTarget.x, commander.moveTarget.y);
            if (remaining < 1.4) commander.moveTarget = null;
            else {
                this.moveEntity(commander, direction.x * TUNING.PLAYER_SPEED / TUNING.TICK_RATE, direction.y * TUNING.PLAYER_SPEED / TUNING.TICK_RATE, 2.2);
                commander.facing = Math.atan2(direction.y, direction.x);
            }
        }

        const target = this.findEnemyTarget(commander, TUNING.PLAYER_ATTACK_RANGE, commander.focusTargetId);
        if (target && this.tickCount >= commander.attackReady) {
            commander.attackReady = this.tickCount + Math.round(TUNING.PLAYER_ATTACK_SECONDS * TUNING.TICK_RATE);
            commander.facing = Math.atan2(target.y - commander.y, target.x - commander.x);
            this.damageEnemy(target, TUNING.PLAYER_ATTACK_DAMAGE, commander);
            this.emitParticle(target.x, target.y, commander.color, 0.7, 7);
        }

        if (commander.upgrades.secondWind && this.tickCount % TUNING.TICK_RATE === 0 && !this.enemyNear(commander.x, commander.y, 18)) {
            commander.health = Math.min(commander.maxHealth, commander.health + 3);
        }
    }

    updateBotCommander(commander) {
        if (this.tickCount < commander.botThinkAt) return;
        commander.botThinkAt = this.tickCount + Math.round(0.6 * TUNING.TICK_RATE);
        const enemy = this.findEnemyTarget(commander, 45, commander.focusTargetId);
        if (enemy) {
            commander.focusTargetId = enemy.id;
            commander.moveTarget = { x: enemy.x, y: enemy.y };
            if (distance(commander, enemy) < TUNING.STRIKE_RANGE && this.tickCount >= commander.strikeReady) this.useStrike(commander);
        } else {
            const objective = this.getBotObjective(commander);
            if (objective) commander.moveTarget = { x: objective.x, y: objective.y };
        }
        if (this.tickCount >= commander.dashReady && enemy && distance(commander, enemy) > 13) this.useDash(commander);
    }

    getBotObjective(commander) {
        const uncaptured = this.world.sectors.filter((sector) => sector.type === 'OUTPOST' && !sector.captured);
        if (uncaptured.length) {
            const sector = uncaptured.sort((a, b) => distanceXY(commander.x, commander.y, a.cx, a.cy) - distanceXY(commander.x, commander.y, b.cx, b.cy))[0];
            return { x: sector.cx, y: sector.cy };
        }
        const boss = this.world.sectors[this.world.bossSectorId];
        return { x: boss.cx, y: boss.cy };
    }

    updateSquadUnit(unit) {
        if (!unit.alive) return;
        const commander = this.getCommander(unit.ownerCommanderId);
        if (!commander) return;
        if (!commander.alive) {
            this.moveToward(unit, this.getRespawnPoint(commander), unit.speed);
            return;
        }

        if (unit.type === 'medic') {
            const healingTarget = this.findFriendlyToHeal(commander, unit);
            if (healingTarget && this.tickCount >= unit.attackReady && distance(unit, healingTarget) <= unit.range) {
                unit.attackReady = this.tickCount + unit.cooldownTicks;
                const multiplier = commander.upgrades.fieldMedic ? 2 : 1;
                healingTarget.health = Math.min(healingTarget.maxHealth, healingTarget.health + 8 * multiplier);
                this.emitParticle(healingTarget.x, healingTarget.y, COLORS.medic, 0.9, 9);
                return;
            }
        }

        const target = this.findEnemyTarget(unit, unit.range + 8, null);
        if (target && distance(unit, target) <= unit.range) {
            if (this.tickCount >= unit.attackReady) {
                unit.attackReady = this.tickCount + unit.cooldownTicks;
                const squadMultiplier = commander.upgrades.warDrums ? 1.3 : 1;
                if (unit.type === 'ranger') this.launchProjectile('friendly', unit, target, unit.damage * squadMultiplier, COLORS.ranger);
                else this.damageEnemy(target, unit.damage * squadMultiplier, commander);
            }
            return;
        }

        let destination;
        if (commander.squadMode === 'hold' || commander.squadMode === 'assault') {
            destination = { x: commander.commandX, y: commander.commandY };
        } else {
            const index = commander.squadIds.indexOf(unit.id);
            const angle = commander.facing + Math.PI + (index - 1) * 0.7;
            const radius = commander.squadMode === 'rally' ? 3 : 6;
            destination = { x: commander.x + Math.cos(angle) * radius, y: commander.y + Math.sin(angle) * radius };
            if (commander.squadMode === 'rally' && distance(unit, commander) < 4) commander.squadMode = 'follow';
        }
        const aura = commander.upgrades.bannerAura && distance(unit, commander) < 14 ? 1.25 : 1;
        this.moveToward(unit, destination, unit.speed * aura);
    }

    findFriendlyToHeal(commander, medic) {
        const candidates = [commander, ...this.squadUnits.filter((unit) => unit.ownerCommanderId === commander.id && unit.alive && unit.id !== medic.id)];
        return candidates
            .filter((friendly) => friendly.health < friendly.maxHealth && distance(friendly, medic) <= medic.range)
            .sort((a, b) => a.health / a.maxHealth - b.health / b.maxHealth)[0] || null;
    }

    updateEnemy(enemy) {
        if (!enemy.active || enemy.health <= 0) return;
        if (enemy.stunUntil && this.tickCount < enemy.stunUntil) return;
        const target = this.findFriendlyTarget(enemy, enemy.type === 'boss' ? 60 : 40);
        if (!target) {
            if (enemy.raidTargetId !== undefined && enemy.raidTargetId !== null) {
                const outpost = this.world.sectors[enemy.raidTargetId];
                if (outpost && outpost.captured) {
                    if (distanceXY(enemy.x, enemy.y, outpost.cx, outpost.cy) <= 7) {
                        outpost.integrity = Math.max(0, outpost.integrity - 0.32);
                        outpost.underAttackUntil = this.tickCount + 2 * TUNING.TICK_RATE;
                        if (outpost.integrity <= 0) this.loseOutpost(outpost);
                    } else {
                        this.moveToward(enemy, { x: outpost.cx, y: outpost.cy }, enemy.type === 'archer' ? 7.5 : 8.5);
                    }
                }
            }
            return;
        }
        const range = enemy.type === 'archer' ? 16 : enemy.type === 'boss' ? 20 : enemy.type === 'captain' ? 4.5 : 3.5;
        if (distance(enemy, target) <= range) {
            if (this.tickCount >= enemy.attackReady) {
                const cooldown = enemy.type === 'boss' ? 0.75 : enemy.type === 'archer' ? 1.2 : 0.95;
                enemy.attackReady = this.tickCount + Math.round(cooldown * TUNING.TICK_RATE);
                const damage = enemy.type === 'boss' ? 15 : enemy.type === 'captain' ? 12 : enemy.type === 'archer' ? 9 : 7;
                if (enemy.type === 'archer' || enemy.type === 'boss') this.launchProjectile('enemy', enemy, target, damage, enemy.type === 'boss' ? COLORS.boss : COLORS.archer);
                else this.damageFriendly(target, damage);
            }
        } else {
            const speed = enemy.type === 'boss' ? 6 : enemy.type === 'captain' ? 8 : 8.5;
            this.moveToward(enemy, target, speed);
        }
    }

    updateProjectile(projectile) {
        if (!projectile.active) return;
        projectile.x += projectile.vx;
        projectile.y += projectile.vy;
        projectile.ttl -= 1;
        const target = projectile.targetKind === 'enemy'
            ? this.enemies.find((enemy) => enemy.id === projectile.targetId && enemy.active)
            : this.findFriendlyById(projectile.targetId);
        if (target && distance(projectile, target) <= 2.5) {
            if (projectile.targetKind === 'enemy') this.damageEnemy(target, projectile.damage, projectile.sourceCommander || null);
            else this.damageFriendly(target, projectile.damage);
            this.emitParticle(projectile.x, projectile.y, projectile.color, 0.8, 7);
            projectile.active = false;
        } else if (projectile.ttl <= 0 || projectile.x < 0 || projectile.y < 0 || projectile.x > TUNING.WORLD_SIZE || projectile.y > TUNING.WORLD_SIZE) {
            projectile.active = false;
        }
    }

    updateParticle(particle) {
        if (!particle.active) return;
        particle.ttl -= 1;
        particle.radius += particle.growth;
        if (particle.ttl <= 0) particle.active = false;
    }

    updateSectors() {
        for (const commander of this.commanders) {
            if (!commander.alive) continue;
            const sector = this.getSectorAt(commander.x, commander.y);
            if (!sector) continue;
            if (!sector.spawned && sector.type !== 'START') this.spawnSectorEncounter(sector.id);
            if (sector.type === 'SHRINE' && !sector.used && sector.cleared && distanceXY(commander.x, commander.y, sector.cx, sector.cy) < 8) {
                sector.used = true;
                commander.health = commander.maxHealth;
                this.beginUpgradePhase('The shrine answers your banner.');
            }
        }

        for (const sector of this.world.sectors) {
            if (!sector.spawned || sector.cleared) continue;
            const remaining = this.enemies.some((enemy) => enemy.active && enemy.sectorId === sector.id && enemy.health > 0);
            if (!remaining) {
                sector.cleared = true;
                if (sector.type === 'WILD') this.setStatus(`${sector.name} cleared`);
            }
        }

        for (const sector of this.world.sectors) {
            if (sector.type !== 'OUTPOST' || sector.captured || !sector.cleared) continue;
            const occupiers = this.commanders.filter((commander) => commander.alive && distanceXY(commander.x, commander.y, sector.cx, sector.cy) <= 11);
            if (occupiers.length) {
                sector.captureProgress += occupiers.length / TUNING.TICK_RATE;
                if (sector.captureProgress >= TUNING.CAPTURE_SECONDS) this.captureOutpost(sector);
            } else {
                sector.captureProgress = Math.max(0, sector.captureProgress - 0.5 / TUNING.TICK_RATE);
            }
        }
    }

    captureOutpost(sector) {
        sector.captured = true;
        sector.captureProgress = TUNING.CAPTURE_SECONDS;
        sector.integrity = 100;
        sector.underAttackUntil = 0;
        this.outpostsCaptured += 1;
        this.teamMorale += 1;
        this.reviveOneSquadPerCommander();
        this.setStatus(`${sector.name} captured. Morale restored.`);
        if (this.outpostsCaptured >= TUNING.BOSS_REQUIRED_OUTPOSTS) {
            this.world.bossUnlocked = true;
            this.setStatus('The citadel barrier has fallen.');
        }
        this.beginUpgradePhase('Choose how the warband evolves.');
    }

    reviveOneSquadPerCommander() {
        for (const commander of this.commanders) {
            const dead = this.squadUnits.find((unit) => unit.ownerCommanderId === commander.id && !unit.alive);
            if (dead) {
                dead.alive = true;
                dead.health = dead.maxHealth;
                dead.x = commander.x + 3;
                dead.y = commander.y + 3;
            }
        }
    }

    updateEnemyWar() {
        if (!this.world || this.outpostsCaptured <= 0 || this.phase !== 'running') return;
        if (this.world.nextRaidAt === undefined) this.world.nextRaidAt = this.tickCount + 18 * TUNING.TICK_RATE;
        if (this.tickCount < this.world.nextRaidAt) return;
        const targets = this.world.sectors.filter((sector) => sector.type === 'OUTPOST' && sector.captured);
        if (!targets.length) return;
        const target = targets[(this.world.raidSerial || 0) % targets.length];
        const freeSlots = this.enemies.filter((enemy) => !enemy.active).length;
        if (freeSlots <= 0) {
            this.world.nextRaidAt = this.tickCount + 5 * TUNING.TICK_RATE;
            return;
        }
        const raidSize = Math.min(freeSlots, 2 + Math.min(2, this.commanders.length));
        const direction = (this.world.seed + (this.world.raidSerial || 0) * 17) % 4;
        const offsets = [[-34, 0], [34, 0], [0, -34], [0, 34]][direction];
        for (let index = 0; index < raidSize; index += 1) {
            const enemy = this.activateEnemy(index === raidSize - 1 && raidSize >= 4 ? 'captain' : index % 3 === 1 ? 'archer' : 'grunt', target, target.cx + offsets[0] + (index - 1) * 4, target.cy + offsets[1] + (index % 2) * 4);
            if (enemy) enemy.raidTargetId = target.id;
        }
        target.underAttackUntil = this.tickCount + 4 * TUNING.TICK_RATE;
        this.world.raidSerial = (this.world.raidSerial || 0) + 1;
        this.world.nextRaidAt = this.tickCount + (20 + (this.world.raidSerial % 3) * 4) * TUNING.TICK_RATE;
        this.setStatus(`${target.name} is under attack`);
    }

    loseOutpost(sector) {
        if (!sector.captured) return;
        sector.captured = false;
        sector.captureProgress = 0;
        sector.integrity = 100;
        sector.underAttackUntil = 0;
        this.outpostsCaptured = Math.max(0, this.outpostsCaptured - 1);
        this.teamMorale = Math.max(0, this.teamMorale - 1);
        for (const enemy of this.enemies) {
            if (enemy.active && enemy.raidTargetId === sector.id) enemy.raidTargetId = null;
        }
        this.setStatus(`${sector.name} was lost`);
    }

    beginUpgradePhase(message) {
        if (this.phase !== 'running') return;
        this.phase = 'upgrade';
        this.upgradeTimer = TUNING.UPGRADE_SECONDS * TUNING.TICK_RATE;
        this.setStatus(message);
        for (const playerId of this.playerOrder) {
            const player = this.players[playerId];
            if (!player || player.spectator) continue;
            player.upgradeChosen = false;
            player.pendingUpgradeChoices = this.chooseUpgradeOptions(player.id);
            this.renderUpgradeOverlay(player);
        }
        for (const commander of this.commanders.filter((candidate) => candidate.isBot)) {
            const options = this.chooseUpgradeOptions(commander.id.length * 17);
            this.applyUpgrade(commander, options[0]);
        }
    }

    chooseUpgradeOptions(salt) {
        const random = mulberry32(this.world.seed + this.outpostsCaptured * 991 + Number(String(salt).replace(/\D/g, '') || 1));
        return shuffle(UPGRADE_KEYS, random).slice(0, 3);
    }

    renderUpgradeOverlay(player) {
        if (!player.view || player.view.spectator) return;
        const overlay = player.view.overlay;
        overlay.clearChildren();
        overlay.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(8, 18, 68, 52),
            fill: COLORS.panel,
            color: COLORS.shrine,
            border: 6,
            playerIds: [player.id]
        }));
        overlay.addChild(makeText('CHOOSE AN UPGRADE', 42, 23, 2.2, COLORS.shrine, 'center', [player.id]));
        player.pendingUpgradeChoices.forEach((upgradeKey, index) => {
            const definition = UPGRADE_DEFS[upgradeKey];
            const y = 31 + index * 12;
            const button = makeButton(14, y, 56, 9, definition.name, [player.id], (clickingPlayerId) => {
                this.selectUpgrade(Number(clickingPlayerId), upgradeKey);
            });
            button.shape.node.fill = COLORS.panelAlt;
            button.shape.node.color = COLORS.shrine;
            overlay.addChild(button.group);
            overlay.addChild(makeText(definition.description, 42, y + 6.3, 0.9, COLORS.muted, 'center', [player.id]));
        });
    }

    selectUpgrade(playerId, upgradeKey) {
        if (this.phase !== 'upgrade') return;
        const player = this.players[playerId];
        if (!player || player.upgradeChosen || !player.pendingUpgradeChoices.includes(upgradeKey)) return;
        const commander = this.getCommander(player.commanderId);
        if (!commander) return;
        player.upgradeChosen = true;
        this.applyUpgrade(commander, upgradeKey);
        player.view.overlay.clearChildren();
        player.view.overlay.addChild(makeText('UPGRADE LOCKED', 42, 42, 2.2, COLORS.ally, 'center', [player.id]));
    }

    applyUpgrade(commander, upgradeKey) {
        commander.upgrades[upgradeKey] = (commander.upgrades[upgradeKey] || 0) + 1;
        if (upgradeKey === 'ironCompany') {
            for (const unit of this.squadUnits.filter((candidate) => candidate.ownerCommanderId === commander.id)) {
                unit.maxHealth = Math.round(unit.maxHealth * 1.35);
                unit.health = unit.maxHealth;
            }
        }
    }

    allHumansChoseUpgrade() {
        return this.playerOrder.every((playerId) => {
            const player = this.players[playerId];
            return !player || player.spectator || player.upgradeChosen;
        });
    }

    finishUpgradePhase() {
        for (const playerId of this.playerOrder) {
            const player = this.players[playerId];
            if (!player || player.spectator) continue;
            if (!player.upgradeChosen) {
                const commander = this.getCommander(player.commanderId);
                if (commander && player.pendingUpgradeChoices.length) this.applyUpgrade(commander, player.pendingUpgradeChoices[0]);
            }
            player.upgradeChosen = true;
            player.pendingUpgradeChoices = [];
            if (player.view && player.view.overlay) player.view.overlay.clearChildren();
        }
        this.phase = 'running';
        this.setStatus('The campaign continues.');
    }

    useStrike(commander) {
        if (this.phase !== 'running' || !commander.alive || this.tickCount < commander.strikeReady) return false;
        commander.strikeReady = this.tickCount + Math.round(TUNING.STRIKE_SECONDS * TUNING.TICK_RATE);
        const multiplier = commander.upgrades.ironEdge ? 1.45 : 1;
        const damage = TUNING.STRIKE_DAMAGE * multiplier;
        let hits = 0;
        for (const enemy of this.enemies) {
            if (!enemy.active || distance(commander, enemy) > TUNING.STRIKE_RANGE) continue;
            this.damageEnemy(enemy, damage, commander);
            hits += 1;
        }
        this.emitParticle(commander.x, commander.y, commander.color, 2.5, 10);
        commander.status = hits ? `STRIKE HIT ${hits}` : 'STRIKE';
        commander.statusUntil = this.tickCount + TUNING.STATUS_SECONDS * TUNING.TICK_RATE;
        return true;
    }

    useDash(commander) {
        if (this.phase !== 'running' || !commander.alive || this.tickCount < commander.dashReady) return false;
        commander.dashReady = this.tickCount + Math.round(TUNING.DASH_SECONDS * TUNING.TICK_RATE);
        let direction = { x: Math.cos(commander.facing), y: Math.sin(commander.facing) };
        if (commander.moveTarget) direction = normalize(commander.moveTarget.x - commander.x, commander.moveTarget.y - commander.y);
        const steps = 6;
        for (let index = 0; index < steps; index += 1) {
            this.moveEntity(commander, direction.x * TUNING.DASH_DISTANCE / steps, direction.y * TUNING.DASH_DISTANCE / steps, 2.2);
        }
        commander.invulnerableUntil = this.tickCount + Math.round(0.35 * TUNING.TICK_RATE);
        if (commander.upgrades.shockDash) {
            for (const enemy of this.enemies) {
                if (enemy.active && distance(commander, enemy) <= 8) {
                    this.damageEnemy(enemy, 18, commander);
                    enemy.stunUntil = this.tickCount + Math.round(0.6 * TUNING.TICK_RATE);
                }
            }
        }
        this.emitParticle(commander.x, commander.y, commander.color, 1.4, 8);
        return true;
    }

    beginCommand(commander, mode) {
        commander.pendingCommand = mode;
        commander.status = `TAP TO ${mode.toUpperCase()}`;
        commander.statusUntil = this.tickCount + 10 * TUNING.TICK_RATE;
    }

    setSquadMode(commander, mode) {
        commander.pendingCommand = null;
        commander.squadMode = mode;
        if (mode === 'rally') {
            commander.commandX = commander.x;
            commander.commandY = commander.y;
        }
        commander.status = `SQUAD ${mode.toUpperCase()}`;
        commander.statusUntil = this.tickCount + TUNING.STATUS_SECONDS * TUNING.TICK_RATE;
    }

    handleWorldTap(playerId, screenX, screenY) {
        if (this.phase !== 'running') return;
        const player = this.players[playerId];
        const commander = this.getCommanderForPlayer(playerId);
        if (!player || !player.view || !commander || !commander.alive) return;
        const worldPoint = this.screenToWorld(player.view, screenX, screenY);
        if (commander.pendingCommand) {
            commander.squadMode = commander.pendingCommand;
            commander.commandX = worldPoint.x;
            commander.commandY = worldPoint.y;
            commander.status = `SQUAD ${commander.pendingCommand.toUpperCase()}`;
            commander.statusUntil = this.tickCount + TUNING.STATUS_SECONDS * TUNING.TICK_RATE;
            commander.pendingCommand = null;
            return;
        }
        const enemy = this.enemies
            .filter((candidate) => candidate.active && distanceXY(candidate.x, candidate.y, worldPoint.x, worldPoint.y) <= TUNING.TAP_TARGET_RADIUS)
            .sort((a, b) => distanceXY(a.x, a.y, worldPoint.x, worldPoint.y) - distanceXY(b.x, b.y, worldPoint.x, worldPoint.y))[0];
        if (enemy) {
            commander.focusTargetId = enemy.id;
            commander.moveTarget = { x: enemy.x, y: enemy.y };
            commander.status = `TARGET ${enemy.type.toUpperCase()}`;
        } else {
            commander.focusTargetId = null;
            commander.moveTarget = { x: clamp(worldPoint.x, 2, TUNING.WORLD_SIZE - 2), y: clamp(worldPoint.y, 2, TUNING.WORLD_SIZE - 2) };
            commander.status = 'MOVE';
        }
        commander.statusUntil = this.tickCount + TUNING.STATUS_SECONDS * TUNING.TICK_RATE;
    }

    screenToWorld(view, screenX, screenY) {
        return {
            x: view.cameraX + screenX / TUNING.VIEW_SCREEN_SIZE * TUNING.VIEW_SIZE,
            y: view.cameraY + screenY / TUNING.VIEW_SCREEN_SIZE * TUNING.VIEW_SIZE
        };
    }

    worldToScreen(view, worldX, worldY) {
        return {
            x: (worldX - view.cameraX) / TUNING.VIEW_SIZE * TUNING.VIEW_SCREEN_SIZE,
            y: (worldY - view.cameraY) / TUNING.VIEW_SIZE * TUNING.VIEW_SCREEN_SIZE
        };
    }

    moveToward(entity, destination, speedPerSecond) {
        const direction = normalize(destination.x - entity.x, destination.y - entity.y);
        if (direction.x === 0 && direction.y === 0) return;
        this.moveEntity(entity, direction.x * speedPerSecond / TUNING.TICK_RATE, direction.y * speedPerSecond / TUNING.TICK_RATE, entity.type === 'boss' ? 4 : 1.6);
        entity.facing = Math.atan2(direction.y, direction.x);
    }

    moveEntity(entity, dx, dy, radius) {
        const nextX = clamp(entity.x + dx, radius, TUNING.WORLD_SIZE - radius);
        const nextY = clamp(entity.y + dy, radius, TUNING.WORLD_SIZE - radius);
        let resolvedX = nextX;
        let resolvedY = nextY;
        for (const obstacle of this.world.obstacles) {
            const push = this.resolveObstacleCollision(resolvedX, resolvedY, radius, obstacle);
            resolvedX = push.x;
            resolvedY = push.y;
        }
        entity.x = clamp(resolvedX, radius, TUNING.WORLD_SIZE - radius);
        entity.y = clamp(resolvedY, radius, TUNING.WORLD_SIZE - radius);
    }

    resolveObstacleCollision(x, y, radius, obstacle) {
        if (obstacle.shape === 'circle') {
            const dx = x - obstacle.x;
            const dy = y - obstacle.y;
            const minDistance = radius + obstacle.radius;
            const current = Math.sqrt(dx * dx + dy * dy);
            if (current >= minDistance || current <= 0.0001) return { x, y };
            return { x: obstacle.x + dx / current * minDistance, y: obstacle.y + dy / current * minDistance };
        }
        const nearestX = clamp(x, obstacle.x - obstacle.width / 2, obstacle.x + obstacle.width / 2);
        const nearestY = clamp(y, obstacle.y - obstacle.height / 2, obstacle.y + obstacle.height / 2);
        const dx = x - nearestX;
        const dy = y - nearestY;
        const squared = dx * dx + dy * dy;
        if (squared >= radius * radius) return { x, y };
        if (Math.abs(dx) > Math.abs(dy)) return { x: nearestX + (dx >= 0 ? radius : -radius), y };
        return { x, y: nearestY + (dy >= 0 ? radius : -radius) };
    }

    findEnemyTarget(origin, range, preferredId) {
        const preferred = preferredId ? this.enemies.find((enemy) => enemy.id === preferredId && enemy.active && enemy.health > 0) : null;
        if (preferred && distance(origin, preferred) <= range) return preferred;
        return this.enemies
            .filter((enemy) => enemy.active && enemy.health > 0 && distance(origin, enemy) <= range)
            .sort((a, b) => distance(origin, a) - distance(origin, b))[0] || null;
    }

    findFriendlyTarget(origin, range) {
        const candidates = [
            ...this.commanders.filter((commander) => commander.alive),
            ...this.squadUnits.filter((unit) => unit.alive)
        ];
        return candidates
            .filter((friendly) => distance(origin, friendly) <= range)
            .sort((a, b) => distance(origin, a) - distance(origin, b))[0] || null;
    }

    findFriendlyById(id) {
        return this.commanders.find((commander) => commander.id === id && commander.alive)
            || this.squadUnits.find((unit) => unit.id === id && unit.alive)
            || null;
    }

    enemyNear(x, y, range) {
        return this.enemies.some((enemy) => enemy.active && distanceXY(x, y, enemy.x, enemy.y) <= range);
    }

    damageEnemy(enemy, amount, sourceCommander) {
        if (!enemy.active || enemy.health <= 0) return;
        let finalAmount = amount;
        if (sourceCommander && sourceCommander.upgrades.executioner && (enemy.type === 'captain' || enemy.type === 'boss')) finalAmount *= 1.35;
        enemy.health -= finalAmount;
        if (enemy.health <= 0) {
            enemy.health = 0;
            enemy.active = false;
            this.emitParticle(enemy.x, enemy.y, enemy.type === 'boss' ? COLORS.boss : COLORS.enemy, enemy.type === 'boss' ? 4 : 1.6, 12);
            if (sourceCommander) {
                sourceCommander.kills += 1;
                if (sourceCommander.upgrades.bloodRush) {
                    sourceCommander.strikeReady = Math.max(this.tickCount, sourceCommander.strikeReady - 4);
                    sourceCommander.dashReady = Math.max(this.tickCount, sourceCommander.dashReady - 4);
                }
            }
            if (enemy.type === 'boss') this.winGame();
        }
    }

    damageFriendly(target, amount) {
        if (!target.alive) return;
        if (target.invulnerableUntil && this.tickCount < target.invulnerableUntil) return;
        target.health -= amount;
        if (target.health > 0) return;
        target.health = 0;
        target.alive = false;
        target.respawnAt = this.tickCount + Math.round((target.id.startsWith('c') ? TUNING.RESPAWN_SECONDS : TUNING.RESPAWN_SECONDS * 1.5) * TUNING.TICK_RATE);
        this.emitParticle(target.x, target.y, COLORS.danger, 1.8, 10);
        if (target.id.startsWith('c')) {
            this.teamMorale -= 1;
            this.setStatus(`${target.name} fell. ${Math.max(0, this.teamMorale)} morale remains.`);
        }
    }

    launchProjectile(side, source, target, damage, color) {
        const projectile = this.projectiles.find((candidate) => !candidate.active);
        if (!projectile) {
            if (side === 'friendly') this.damageEnemy(target, damage, this.getCommander(source.ownerCommanderId));
            else this.damageFriendly(target, damage);
            return null;
        }
        const direction = normalize(target.x - source.x, target.y - source.y);
        projectile.active = true;
        projectile.side = side;
        projectile.x = source.x;
        projectile.y = source.y;
        projectile.vx = direction.x * 2.3;
        projectile.vy = direction.y * 2.3;
        projectile.damage = damage;
        projectile.color = color;
        projectile.ttl = Math.round(2.5 * TUNING.TICK_RATE);
        projectile.targetKind = side === 'friendly' ? 'enemy' : 'friendly';
        projectile.targetId = target.id;
        projectile.sourceCommander = side === 'friendly' ? this.getCommander(source.ownerCommanderId) : null;
        return projectile;
    }

    emitParticle(x, y, color, radius, lifeTicks) {
        const particle = this.particles.find((candidate) => !candidate.active);
        if (!particle) return null;
        particle.active = true;
        particle.x = x;
        particle.y = y;
        particle.color = color;
        particle.radius = radius;
        particle.ttl = lifeTicks;
        particle.maxTtl = lifeTicks;
        particle.growth = radius / Math.max(1, lifeTicks) * 0.8;
        return particle;
    }

    updateRespawns() {
        for (const commander of this.commanders) {
            if (commander.alive || this.tickCount < commander.respawnAt || this.teamMorale < 0) continue;
            const point = this.getRespawnPoint(commander);
            commander.alive = true;
            commander.health = commander.maxHealth;
            commander.x = point.x;
            commander.y = point.y;
            commander.invulnerableUntil = this.tickCount + 2 * TUNING.TICK_RATE;
            commander.moveTarget = null;
            this.setStatus(`${commander.name} returned to the field`);
        }
        for (const unit of this.squadUnits) {
            if (unit.alive || this.tickCount < unit.respawnAt) continue;
            const commander = this.getCommander(unit.ownerCommanderId);
            if (!commander || !commander.alive) continue;
            unit.alive = true;
            unit.health = unit.maxHealth;
            unit.x = commander.x + 3;
            unit.y = commander.y + 3;
        }
    }

    getRespawnPoint() {
        const captured = this.world.sectors.filter((sector) => sector.type === 'OUTPOST' && sector.captured);
        const sector = captured.length ? captured[captured.length - 1] : this.world.sectors[this.world.startSectorId];
        return { x: sector.cx, y: sector.cy + 10 };
    }

    checkDefeat() {
        if (this.phase !== 'running') return;
        const anyAlive = this.commanders.some((commander) => commander.alive);
        if (!anyAlive && this.teamMorale <= 0) {
            this.phase = 'defeat';
            this.setStatus('The banner has fallen.');
            this.buildEndOverlays(false);
        }
    }

    winGame() {
        if (this.phase === 'victory') return;
        this.phase = 'victory';
        this.setStatus('The citadel is broken.');
        this.buildEndOverlays(true);
    }

    buildEndOverlays(victory) {
        for (const playerId of this.playerOrder) {
            const player = this.players[playerId];
            if (!player || !player.view || player.view.spectator) continue;
            const overlay = player.view.overlay;
            overlay.clearChildren();
            overlay.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(12, 24, 60, 36),
                fill: COLORS.panel,
                color: victory ? COLORS.ally : COLORS.danger,
                border: 7,
                playerIds: [player.id]
            }));
            overlay.addChild(makeText(victory ? 'CITADEL BROKEN' : 'BANNER FALLEN', 42, 31, 3, victory ? COLORS.ally : COLORS.danger, 'center', [player.id]));
            overlay.addChild(makeText(
                `${this.outpostsCaptured} OUTPOSTS • ${this.commanders.reduce((sum, commander) => sum + commander.kills, 0)} KILLS`,
                42,
                40,
                1.15,
                COLORS.white,
                'center',
                [player.id]
            ));
            const returnButton = makeButton(24, 47, 36, 9, 'RETURN TO MAP', [player.id], () => this.returnToLobby());
            returnButton.shape.node.color = victory ? COLORS.ally : COLORS.danger;
            overlay.addChild(returnButton.group);
        }
    }

    spawnSectorEncounter(sectorId) {
        const sector = this.world.sectors[sectorId];
        if (!sector || sector.spawned) return;
        if (sector.type === 'BOSS' && !this.world.bossUnlocked) return;
        if (sector.type === 'START') {
            sector.spawned = true;
            sector.cleared = true;
            return;
        }
        const activePlayers = Math.max(1, this.commanders.filter((commander) => commander.playerId !== null).length);
        let plan;
        if (sector.type === 'BOSS') plan = [{ type: 'boss', count: 1 }, { type: 'grunt', count: Math.min(3, activePlayers + 1) }];
        else if (sector.type === 'OUTPOST') plan = [{ type: 'captain', count: 1 }, { type: 'grunt', count: Math.min(4, activePlayers + 2) }];
        else if (sector.type === 'SHRINE') plan = [{ type: 'archer', count: 2 }, { type: 'grunt', count: Math.min(3, activePlayers + 1) }];
        else plan = [{ type: sector.enemyStyle, count: Math.min(4, activePlayers + 2) }];

        let spawnIndex = 0;
        let spawnedCount = 0;
        for (const item of plan) {
            for (let count = 0; count < item.count; count += 1) {
                const angle = (spawnIndex / 7) * Math.PI * 2 + sector.seedOffset;
                const radius = 12 + (spawnIndex % 3) * 5;
                if (this.activateEnemy(item.type, sector, sector.cx + Math.cos(angle) * radius, sector.cy + Math.sin(angle) * radius)) spawnedCount += 1;
                spawnIndex += 1;
            }
        }
        sector.spawned = spawnedCount > 0;
    }

    activateEnemy(type, sector, x, y) {
        const enemy = this.enemies.find((candidate) => !candidate.active);
        if (!enemy) return null;
        const activePlayers = Math.max(1, this.commanders.filter((commander) => commander.playerId !== null).length);
        const stats = {
            grunt: { health: 42, maxHealth: 42 },
            archer: { health: 32, maxHealth: 32 },
            captain: { health: 115 + activePlayers * 20, maxHealth: 115 + activePlayers * 20 },
            boss: { health: 420 + activePlayers * 120, maxHealth: 420 + activePlayers * 120 }
        }[type];
        enemy.active = true;
        enemy.type = type;
        enemy.sectorId = sector.id;
        enemy.x = x;
        enemy.y = y;
        enemy.health = stats.health;
        enemy.maxHealth = stats.maxHealth;
        enemy.attackReady = this.tickCount + Math.round(0.5 * TUNING.TICK_RATE);
        enemy.stunUntil = 0;
        enemy.facing = 0;
        enemy.raidTargetId = null;
        return enemy;
    }

    generateWorld(seed) {
        const random = mulberry32(seed);
        const slots = [0, 1, 3, 4, 5, 7, 8];
        const shuffled = shuffle(slots, random);
        const outpostIds = shuffled.slice(0, 2);
        const shrineId = shuffled[2];
        const startSectorId = 6;
        const bossSectorId = 2;
        const sectors = [];
        const obstacles = [];
        const namesA = ['Ash', 'Moon', 'Iron', 'Moss', 'Glass', 'Wolf', 'Storm', 'Thorn', 'Dawn'];
        const namesB = ['Reach', 'March', 'Vale', 'Crossing', 'Hollow', 'Watch', 'Fields', 'Gate', 'Scar'];

        for (let id = 0; id < 9; id += 1) {
            const gx = id % 3;
            const gy = Math.floor(id / 3);
            let type = 'WILD';
            if (id === startSectorId) type = 'START';
            else if (id === bossSectorId) type = 'BOSS';
            else if (outpostIds.includes(id)) type = 'OUTPOST';
            else if (id === shrineId) type = 'SHRINE';
            const sector = {
                id,
                gx,
                gy,
                x: gx * TUNING.SECTOR_SIZE,
                y: gy * TUNING.SECTOR_SIZE,
                cx: gx * TUNING.SECTOR_SIZE + TUNING.SECTOR_SIZE / 2,
                cy: gy * TUNING.SECTOR_SIZE + TUNING.SECTOR_SIZE / 2,
                biome: BIOMES[Math.floor(random() * BIOMES.length)],
                type,
                name: `${namesA[Math.floor(random() * namesA.length)]} ${namesB[Math.floor(random() * namesB.length)]}`,
                enemyStyle: random() < 0.45 ? 'grunt' : 'archer',
                spawned: type === 'START',
                cleared: type === 'START',
                captured: false,
                used: false,
                captureProgress: 0,
                integrity: 100,
                underAttackUntil: 0,
                seedOffset: random() * Math.PI * 2
            };
            sectors.push(sector);

            const obstacleCount = type === 'BOSS' ? 2 : 2 + Math.floor(random() * 3);
            for (let index = 0; index < obstacleCount; index += 1) {
                const shape = random() < 0.58 ? 'circle' : 'rect';
                let ox;
                let oy;
                let attempts = 0;
                do {
                    ox = sector.x + 16 + random() * 68;
                    oy = sector.y + 16 + random() * 68;
                    attempts += 1;
                } while (distanceXY(ox, oy, sector.cx, sector.cy) < 18 && attempts < 20);
                if (shape === 'circle') {
                    obstacles.push({ id: `o${id}-${index}`, sectorId: id, shape, x: ox, y: oy, radius: 4 + random() * 4, biome: sector.biome });
                } else {
                    obstacles.push({ id: `o${id}-${index}`, sectorId: id, shape, x: ox, y: oy, width: 8 + random() * 10, height: 6 + random() * 10, biome: sector.biome });
                }
            }
        }

        const adjectives = ['FRACTURED', 'BURNING', 'HOLLOW', 'SILENT', 'IRON', 'WILD', 'LAST', 'FALLEN'];
        const nouns = ['MARCH', 'CROWN', 'FRONTIER', 'KINGDOM', 'REACH', 'DOMAIN', 'WARLAND', 'BORDER'];
        return {
            seed,
            name: `${adjectives[Math.floor(random() * adjectives.length)]} ${nouns[Math.floor(random() * nouns.length)]}`,
            sectors,
            obstacles,
            startSectorId,
            bossSectorId,
            bossUnlocked: false,
            raidSerial: 0,
            nextRaidAt: 18 * TUNING.TICK_RATE
        };
    }

    getSectorAt(x, y) {
        if (!this.world) return null;
        const gx = clamp(Math.floor(x / TUNING.SECTOR_SIZE), 0, 2);
        const gy = clamp(Math.floor(y / TUNING.SECTOR_SIZE), 0, 2);
        return this.world.sectors[gy * 3 + gx];
    }

    renderAllViews() {
        for (const playerId of this.playerOrder) {
            const player = this.players[playerId];
            if (!player || !player.view || player.view.spectator) continue;
            this.renderPlayerView(player);
        }
    }

    renderPlayerView(player) {
        const commander = this.getCommander(player.commanderId);
        const view = player.view;
        if (!commander || !view) return;
        view.cameraX = clamp(commander.x - TUNING.VIEW_SIZE / 2, 0, TUNING.WORLD_SIZE - TUNING.VIEW_SIZE);
        view.cameraY = clamp(commander.y - TUNING.VIEW_SIZE / 2, 0, TUNING.WORLD_SIZE - TUNING.VIEW_SIZE);
        const sector = this.getSectorAt(commander.x, commander.y);
        view.worldBackdrop.node.fill = this.biomeFill(sector ? sector.biome : 'DUSK');

        this.renderBoundaries(view);
        this.renderObstacles(view);
        this.renderObjectives(view);
        this.renderCommanders(view, commander);
        this.renderSquad(view);
        this.renderEnemies(view);
        this.renderProjectiles(view);
        this.renderParticles(view);
        this.renderHud(player, commander);
    }

    isVisibleInView(view, x, y, margin = 0) {
        return x >= view.cameraX + margin && x <= view.cameraX + TUNING.VIEW_SIZE - margin
            && y >= view.cameraY + margin && y <= view.cameraY + TUNING.VIEW_SIZE - margin;
    }

    renderBoundaries(view) {
        const lines = [];
        for (const value of [100, 200]) {
            if (value >= view.cameraX && value <= view.cameraX + TUNING.VIEW_SIZE) {
                const point = this.worldToScreen(view, value, view.cameraY);
                const safeX = clamp(point.x, 0.2, 83.8);
                lines.push({ x1: safeX, y1: 0, x2: safeX, y2: 84 });
            }
            if (value >= view.cameraY && value <= view.cameraY + TUNING.VIEW_SIZE) {
                const point = this.worldToScreen(view, view.cameraX, value);
                const safeY = clamp(point.y, 0.2, 83.8);
                lines.push({ x1: 0, y1: safeY, x2: 84, y2: safeY });
            }
        }
        for (let index = 0; index < view.boundaryNodes.length; index += 1) {
            const node = view.boundaryNodes[index];
            const line = lines[index];
            if (!line) hideShape(node);
            else {
                node.node.coordinates2d = thickLine(line.x1, line.y1, line.x2, line.y2, 0.3);
                node.node.fill = COLORS.line;
                node.node.color = COLORS.white;
            }
        }
    }

    renderObstacles(view) {
        const visible = this.world.obstacles.filter((obstacle) => this.isVisibleInView(view, obstacle.x, obstacle.y, 12)).slice(0, view.obstacleNodes.length);
        for (let index = 0; index < view.obstacleNodes.length; index += 1) {
            const node = view.obstacleNodes[index];
            const obstacle = visible[index];
            if (!obstacle) {
                hideShape(node);
                continue;
            }
            const point = this.worldToScreen(view, obstacle.x, obstacle.y);
            const fill = this.obstacleFill(obstacle.biome);
            if (obstacle.shape === 'circle') {
                node.node.coordinates2d = polyCircle(point.x, point.y, obstacle.radius * 0.84, 12);
            } else {
                node.node.coordinates2d = rectangle(
                    point.x - obstacle.width * 0.42,
                    point.y - obstacle.height * 0.42,
                    obstacle.width * 0.84,
                    obstacle.height * 0.84
                );
            }
            node.node.fill = fill;
            node.node.color = COLORS.line;
            node.node.border = 3;
        }
    }

    renderObjectives(view) {
        const visible = this.world.sectors
            .filter((sector) => sector.type !== 'WILD' && this.isVisibleInView(view, sector.cx, sector.cy, 12))
            .slice(0, view.objectiveNodes.length);
        for (let index = 0; index < view.objectiveNodes.length; index += 1) {
            const node = view.objectiveNodes[index];
            const objective = visible[index];
            if (!objective) {
                hideShape(node);
                continue;
            }
            const point = this.worldToScreen(view, objective.cx, objective.cy);
            let color = objective.type === 'START' ? COLORS.player
                : objective.type === 'OUTPOST' ? (objective.underAttackUntil > this.tickCount ? COLORS.danger : objective.captured ? COLORS.captured : COLORS.outpost)
                    : objective.type === 'SHRINE' ? COLORS.shrine : COLORS.boss;
            if (objective.type === 'BOSS' && !this.world.bossUnlocked) color = COLORS.line;
            const radius = objective.type === 'BOSS' ? 6 : 4.5;
            node.node.coordinates2d = objective.type === 'OUTPOST'
                ? diamond(point.x, point.y, radius)
                : polyCircle(point.x, point.y, radius, objective.type === 'BOSS' ? 8 : 14);
            node.node.fill = [color[0], color[1], color[2], 255];
            node.node.color = COLORS.white;
            node.node.border = 4;
            node.node.effects = objective.type === 'SHRINE' || objective.type === 'BOSS' ? glow(color, 8) : null;
        }
    }

    renderCommanders(view, ownCommander) {
        const visible = this.commanders.filter((commander) => commander.alive && (commander.id === ownCommander.id || this.isVisibleInView(view, commander.x, commander.y, 5)));
        for (let index = 0; index < view.commanderNodes.length; index += 1) {
            const node = view.commanderNodes[index];
            const commander = visible[index];
            if (!commander) {
                hideShape(node);
                continue;
            }
            const rawPoint = this.worldToScreen(view, commander.x, commander.y);
            const size = commander.id === ownCommander.id ? 3.2 : 2.7;
            const point = commander.id === ownCommander.id
                ? { x: clamp(rawPoint.x, size, 84 - size), y: clamp(rawPoint.y, size, 84 - size) }
                : rawPoint;
            node.node.coordinates2d = triangleFacing(point.x, point.y, commander.facing, size);
            node.node.fill = commander.color;
            node.node.color = COLORS.white;
            node.node.border = commander.id === ownCommander.id ? 6 : 3;
            node.node.effects = commander.id === ownCommander.id ? glow(commander.color, 10) : null;
        }
    }

    renderSquad(view) {
        const visible = this.squadUnits.filter((unit) => unit.alive && this.isVisibleInView(view, unit.x, unit.y, 4));
        for (let index = 0; index < view.squadNodes.length; index += 1) {
            const node = view.squadNodes[index];
            const unit = visible[index];
            if (!unit) {
                hideShape(node);
                continue;
            }
            const point = this.worldToScreen(view, unit.x, unit.y);
            const color = unit.type === 'guard' ? COLORS.guard : unit.type === 'ranger' ? COLORS.ranger : COLORS.medic;
            node.node.coordinates2d = unit.type === 'guard'
                ? rectangle(point.x - 1.5, point.y - 1.5, 3, 3)
                : unit.type === 'ranger'
                    ? triangleFacing(point.x, point.y, unit.facing, 2.1)
                    : polyCircle(point.x, point.y, 1.7, 10);
            node.node.fill = color;
            node.node.color = COLORS.white;
            node.node.border = 2;
            node.node.effects = null;
        }
    }

    renderEnemies(view) {
        const visible = this.enemies.filter((enemy) => enemy.active && this.isVisibleInView(view, enemy.x, enemy.y, 6));
        for (let index = 0; index < view.enemyNodes.length; index += 1) {
            const node = view.enemyNodes[index];
            const enemy = visible[index];
            if (!enemy) {
                hideShape(node);
                continue;
            }
            const point = this.worldToScreen(view, enemy.x, enemy.y);
            let color = COLORS.enemy;
            let coordinates;
            if (enemy.type === 'archer') {
                color = COLORS.archer;
                coordinates = triangleFacing(point.x, point.y, enemy.facing || 0, 2.3);
            } else if (enemy.type === 'captain') {
                color = COLORS.captain;
                coordinates = polyCircle(point.x, point.y, 3.2, 6);
            } else if (enemy.type === 'boss') {
                color = COLORS.boss;
                coordinates = polyCircle(point.x, point.y, 5.4, 10);
            } else {
                coordinates = diamond(point.x, point.y, 2.2);
            }
            node.node.coordinates2d = coordinates;
            node.node.fill = color;
            node.node.color = COLORS.white;
            node.node.border = enemy.type === 'boss' ? 7 : enemy.type === 'captain' ? 4 : 2;
            node.node.effects = enemy.type === 'boss' ? glow(COLORS.boss, 14) : null;
        }
    }

    renderProjectiles(view) {
        const visible = this.projectiles.filter((projectile) => projectile.active && this.isVisibleInView(view, projectile.x, projectile.y, 3));
        for (let index = 0; index < view.projectileNodes.length; index += 1) {
            const node = view.projectileNodes[index];
            const projectile = visible[index];
            if (!projectile) {
                hideShape(node);
                continue;
            }
            const point = this.worldToScreen(view, projectile.x, projectile.y);
            node.node.coordinates2d = polyCircle(point.x, point.y, 0.8, 8);
            node.node.fill = projectile.color;
            node.node.color = COLORS.white;
            node.node.effects = null;
        }
    }

    renderParticles(view) {
        const visible = this.particles.filter((particle) => particle.active && this.isVisibleInView(view, particle.x, particle.y, 8));
        for (let index = 0; index < view.particleNodes.length; index += 1) {
            const node = view.particleNodes[index];
            const particle = visible[index];
            if (!particle) {
                hideShape(node);
                continue;
            }
            const point = this.worldToScreen(view, particle.x, particle.y);
            node.node.coordinates2d = polyCircle(point.x, point.y, particle.radius * 0.84, 12);
            node.node.fill = particle.color;
            node.node.color = [255, 255, 255, clamp(Math.round(220 * particle.ttl / particle.maxTtl), 0, 255)];
            node.node.effects = null;
        }
    }

    renderHud(player, commander) {
        const view = player.view;
        const healthRatio = commander.maxHealth > 0 ? commander.health / commander.maxHealth : 0;
        view.hpFill.node.coordinates2d = rectangle(2, 88, 30 * clamp(healthRatio, 0, 1), 4);
        view.hpFill.node.fill = commander.color;
        setText(view.hpText, `HP ${Math.ceil(commander.health)}/${commander.maxHealth}`, 17, 88.9, 1.15, COLORS.white);
        const attackedOutpost = this.world.sectors.find((candidate) => candidate.type === 'OUTPOST' && candidate.captured && candidate.underAttackUntil > this.tickCount);
        const objective = attackedOutpost
            ? `DEFEND ${attackedOutpost.name.toUpperCase()} ${Math.ceil(attackedOutpost.integrity)}%`
            : this.outpostsCaptured < TUNING.BOSS_REQUIRED_OUTPOSTS
                ? `OUTPOSTS ${this.outpostsCaptured}/${TUNING.BOSS_REQUIRED_OUTPOSTS}   MORALE ${Math.max(0, this.teamMorale)}`
                : `CITADEL OPEN   MORALE ${Math.max(0, this.teamMorale)}`;
        setText(view.objectiveText, objective, 2, 94, 1.05, COLORS.white, 'left');
        const activeStatus = commander.statusUntil > this.tickCount ? commander.status : this.statusUntil > this.tickCount ? this.statusText : this.getSectorAt(commander.x, commander.y).name;
        setText(view.status, activeStatus, 2, 97, 0.9, COLORS.muted, 'left');

        setText(view.squadText, `SQUAD ${commander.pendingCommand ? `${commander.pendingCommand.toUpperCase()}?` : commander.squadMode.toUpperCase()}`, 92, 87, 0.88, COLORS.ally);
        const strikeRemaining = Math.max(0, commander.strikeReady - this.tickCount) / TUNING.TICK_RATE;
        const dashRemaining = Math.max(0, commander.dashReady - this.tickCount) / TUNING.TICK_RATE;
        setText(view.cooldownText, `S ${strikeRemaining.toFixed(1)}  D ${dashRemaining.toFixed(1)}`, 92, 91, 0.82, COLORS.muted);
        const boss = this.enemies.find((enemy) => enemy.active && enemy.type === 'boss');
        setText(view.bossText, boss ? `BOSS ${Math.ceil(boss.health)}` : this.world.bossUnlocked ? 'CITADEL OPEN' : 'CITADEL LOCKED', 92, 95, 0.82, boss || this.world.bossUnlocked ? COLORS.boss : COLORS.muted);

        view.strikeButton.shape.node.fill = strikeRemaining <= 0 ? COLORS.playerDark : COLORS.panelAlt;
        view.dashButton.shape.node.fill = dashRemaining <= 0 ? COLORS.playerDark : COLORS.panelAlt;
        const modeButtons = [
            ['follow', view.followButton], ['hold', view.holdButton], ['assault', view.assaultButton], ['rally', view.rallyButton]
        ];
        for (const [mode, button] of modeButtons) {
            button.shape.node.color = commander.squadMode === mode || commander.pendingCommand === mode ? COLORS.ally : COLORS.line;
        }

        for (const sector of this.world.sectors) {
            const node = view.minimapCells[sector.id];
            let fill = this.biomeFill(sector.biome);
            let color = COLORS.line;
            if (sector.type === 'START') color = COLORS.player;
            else if (sector.type === 'OUTPOST') color = sector.underAttackUntil > this.tickCount ? COLORS.danger : sector.captured ? COLORS.captured : COLORS.outpost;
            else if (sector.type === 'SHRINE') color = sector.used ? COLORS.line : COLORS.shrine;
            else if (sector.type === 'BOSS') color = this.world.bossUnlocked ? COLORS.boss : COLORS.line;
            node.node.fill = fill;
            node.node.color = color;
        }
        const sector = this.getSectorAt(commander.x, commander.y);
        const markerX = 87.6 + sector.gx * 4;
        const markerY = 3.6 + sector.gy * 4;
        view.minimapMarker.node.coordinates2d = polyCircle(markerX, markerY, 0.7, 8);
        view.minimapMarker.node.fill = commander.color;
    }

    biomeFill(biome) {
        return biome === 'MOSS' ? COLORS.biomeMoss : biome === 'EMBER' ? COLORS.biomeEmber : COLORS.biomeDusk;
    }

    obstacleFill(biome) {
        return biome === 'MOSS' ? COLORS.obstacleMoss : biome === 'EMBER' ? COLORS.obstacleEmber : COLORS.obstacleDusk;
    }

    setStatus(text) {
        this.statusText = text;
        this.statusUntil = this.tickCount + Math.round(TUNING.STATUS_SECONDS * TUNING.TICK_RATE);
    }
}

module.exports = Bannerbound;
