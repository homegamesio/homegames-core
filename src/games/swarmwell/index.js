'use strict';

// SPDX-License-Identifier: MIT

const { Game, GameNode, Shapes, ShapeUtils } = require('squish-150');

const TUNING = {
    TICK_RATE: 60,
    MAX_PLAYERS: 6,
    MAX_SWARMS: 48,
    STARTING_BUGS: 34,
    STARTING_NECTAR: 7,
    MAX_NEST_BUGS: 140,
    MAX_NEST_NECTAR: 60,
    HATCH_SECONDS: 2.4,
    HATCH_BATCH: 4,
    SWARM_SPEED_PER_SECOND: 13,
    FORAGE_SECONDS: 0.9,
    CARRY_PER_BUG: 0.72,
    PATCH_REGEN_PER_SECOND: 0.12,
    AI_DECISION_SECONDS: 1.1,
    AI_MIN_SEND: 9,
    WIN_CHECK_TICKS: 60,
    STATUS_SECONDS: 1.8,
    TAP_RADIUS: 6.8,
    FRENZY_DURATION_SECONDS: 4.5,
    FRENZY_COOLDOWN_SECONDS: 24,
    FRENZY_SPEED_MULTIPLIER: 1.8,
    TUTORIAL_FINAL_SECONDS: 7
};

const PALETTE = {
    background: [8, 12, 13, 255],
    backgroundAlt: [14, 22, 20, 255],
    soil: [32, 37, 27, 255],
    soilLight: [52, 59, 39, 255],
    line: [63, 75, 54, 255],
    lineBright: [105, 126, 81, 255],
    neutral: [151, 145, 117, 255],
    neutralDark: [67, 62, 49, 255],
    white: [245, 248, 232, 255],
    muted: [171, 181, 151, 255],
    panel: [17, 25, 22, 255],
    panelAlt: [27, 39, 32, 255],
    nectar: [255, 207, 72, 255],
    nectarDark: [128, 91, 18, 255],
    danger: [255, 88, 80, 255],
    transparent: [0, 0, 0, 0]
};

const FACTIONS = [
    { name: 'AZURE', color: [62, 220, 255, 255], dark: [20, 98, 118, 255] },
    { name: 'ROSE', color: [255, 92, 164, 255], dark: [122, 34, 76, 255] },
    { name: 'AMBER', color: [255, 190, 55, 255], dark: [132, 78, 12, 255] },
    { name: 'MOSS', color: [124, 232, 90, 255], dark: [46, 112, 34, 255] },
    { name: 'VIOLET', color: [176, 119, 255, 255], dark: [78, 45, 124, 255] },
    { name: 'EMBER', color: [255, 124, 58, 255], dark: [130, 52, 18, 255] }
];

const WORLDS = [
    {
        id: 'sunmeadow',
        name: 'SUNMEADOW',
        tagline: 'Open blooms. Fast raids.',
        description: 'A balanced field with rich food near the center and clear routes between nests.',
        seed: 191,
        innerRadius: 21,
        outerRadius: 37,
        extraRing: false,
        centerDefense: 32,
        foodClusters: 3,
        stretchX: 1,
        stretchY: 0.92
    },
    {
        id: 'fungal-hollow',
        name: 'FUNGAL HOLLOW',
        tagline: 'Dense growth. Constant pressure.',
        description: 'An extra ring of brood chambers creates rapid expansion and dangerous chain captures.',
        seed: 733,
        innerRadius: 18,
        outerRadius: 38,
        extraRing: true,
        centerDefense: 40,
        foodClusters: 4,
        stretchX: 0.95,
        stretchY: 0.95
    },
    {
        id: 'floodplain',
        name: 'FLOODPLAIN',
        tagline: 'Long lanes. Exposed supply lines.',
        description: 'A stretched field where distant forage runs can feed enormous colonies—or be punished.',
        seed: 1409,
        innerRadius: 23,
        outerRadius: 39,
        extraRing: false,
        centerDefense: 36,
        foodClusters: 4,
        stretchX: 1,
        stretchY: 0.72
    },
    {
        id: 'rootmaze',
        name: 'ROOTMAZE',
        tagline: 'Many nests. No quiet corner.',
        description: 'A crowded underground network built for six-player chaos and relentless counterattacks.',
        seed: 2603,
        innerRadius: 20,
        outerRadius: 38,
        extraRing: true,
        centerDefense: 48,
        foodClusters: 5,
        stretchX: 1,
        stretchY: 0.86
    }
];

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function rectangle(x, y, width, height) {
    return ShapeUtils.rectangle(x, y, width, height);
}

function polyCircle(cx, cy, radius, sides = 18) {
    const points = [];
    for (let index = 0; index <= sides; index += 1) {
        const angle = index * Math.PI * 2 / sides;
        points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
    }
    return points;
}

function thickLine(x1, y1, x2, y2, width) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const dx = Math.sin(angle) * width / 2;
    const dy = Math.cos(angle) * width / 2;
    return [
        [x1 - dx, y1 + dy],
        [x2 - dx, y2 + dy],
        [x2 + dx, y2 - dy],
        [x1 + dx, y1 - dy],
        [x1 - dx, y1 + dy]
    ];
}

function colorAlpha(color, alpha) {
    return [color[0], color[1], color[2], alpha];
}

function glow(color, blur) {
    return { shadow: { color: [color[0], color[1], color[2], 255], blur } };
}

function hashSeed(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

function ringPoints(count, radius, rotation, stretchX, stretchY) {
    const points = [];
    for (let index = 0; index < count; index += 1) {
        const angle = (rotation + index * 360 / count) * Math.PI / 180;
        points.push({
            x: 50 + Math.cos(angle) * radius * stretchX,
            y: 47 + Math.sin(angle) * radius * stretchY
        });
    }
    return points;
}

function generateWorld(config) {
    const random = hashSeed(config.seed);
    const nests = [];
    const food = [];
    const spawns = ringPoints(6, config.outerRadius, -90, config.stretchX, config.stretchY);
    const inner = ringPoints(6, config.innerRadius, -60, config.stretchX, config.stretchY);

    spawns.forEach((point, index) => nests.push({
        id: `spawn-${index}`,
        x: point.x,
        y: point.y,
        radius: 4.3,
        neutralBugs: 20,
        spawn: true,
        queen: true
    }));

    inner.forEach((point, index) => nests.push({
        id: `inner-${index}`,
        x: point.x,
        y: point.y,
        radius: 3.8,
        neutralBugs: 13 + Math.floor(random() * 8),
        spawn: false,
        queen: false
    }));

    if (config.extraRing) {
        const middle = ringPoints(6, (config.innerRadius + config.outerRadius) / 2, -30, config.stretchX, config.stretchY);
        middle.forEach((point, index) => nests.push({
            id: `middle-${index}`,
            x: point.x,
            y: point.y,
            radius: 3.45,
            neutralBugs: 11 + Math.floor(random() * 8),
            spawn: false,
            queen: false
        }));
    }

    nests.push({
        id: 'heart',
        x: 50,
        y: 47,
        radius: 5,
        neutralBugs: config.centerDefense,
        spawn: false,
        queen: false,
        heart: true
    });

    const sectorAngle = 360 / 6;
    for (let cluster = 0; cluster < config.foodClusters; cluster += 1) {
        let accepted = null;
        for (let attempt = 0; attempt < 500 && !accepted; attempt += 1) {
            const radius = 8 + random() * 36;
            const rotation = -90 + random() * 60;
            const candidates = [];
            let valid = true;
            for (let sector = 0; sector < 6; sector += 1) {
                const angle = (rotation + sector * sectorAngle) * Math.PI / 180;
                const candidate = {
                    x: 50 + Math.cos(angle) * radius * config.stretchX,
                    y: 47 + Math.sin(angle) * radius * config.stretchY
                };
                if (candidate.x < 6 || candidate.x > 94 || candidate.y < 10 || candidate.y > 82) valid = false;
                if (nests.some((nest) => distance(candidate, nest) < 6.1)) valid = false;
                if (food.some((patch) => distance(candidate, patch) < 4.1)) valid = false;
                candidates.push(candidate);
            }
            if (valid) accepted = candidates;
        }
        if (!accepted) {
            const radius = 10 + cluster * 7;
            accepted = ringPoints(6, radius, -75 + cluster * 11, config.stretchX, config.stretchY);
        }
        accepted.forEach((point, sector) => food.push({
            id: `food-${cluster}-${sector}`,
            x: point.x,
            y: point.y,
            maxNectar: 18 + cluster * 5 + Math.floor(random() * 6)
        }));
    }

    return {
        ...config,
        nests,
        food,
        spawnIds: spawns.map((_, index) => `spawn-${index}`)
    };
}

const GENERATED_WORLDS = WORLDS.map(generateWorld);

function chooseSpawns(spawnIds, count) {
    if (count <= 1) return [spawnIds[0]];
    const indexes = [];
    for (let index = 0; index < count; index += 1) {
        indexes.push(Math.floor(index * spawnIds.length / count));
    }
    return indexes.map((index) => spawnIds[index]);
}

class Swarmwell extends Game {
    static metadata() {
        return {
            isTest: true,
            thumbnail: './assets/thumbnail.png',
            name: 'Swarmwell',
            author: "Joseph Garcia",
            description: 'Grow living colonies, forage for nectar, and overwhelm rival nests with flowing swarms.',
            aspectRatio: { x: 1, y: 1 },
            tickRate: 60,
            maxPlayers: 6,
            gameId: "325b20c2-e42f-5a97-ad64-9f9a209f637a"
        };
    }

    constructor() {
        super();
        this.phase = 'lobby';
        this.players = {};
        this.playerOrder = [];
        this.factions = {};
        this.factionOrder = [];
        this.nests = [];
        this.foodPatches = [];
        this.swarms = [];
        this.nextSwarmId = 1;
        this.selectedWorldIndex = 0;
        this.currentWorld = null;
        this.elapsedTicks = 0;
        this.aiClock = 0;
        this.winClock = 0;
        this.winnerKey = null;

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 0, 100, 100),
            fill: PALETTE.background,
            color: PALETTE.white
        });
        this.backgroundLayer = this.makeContainer();
        this.routeLayer = this.makeContainer();
        this.foodLayer = this.makeContainer();
        this.nestLayer = this.makeContainer();
        this.swarmLayer = this.makeContainer();
        this.privateLayer = this.makeContainer();
        // Tutorial visuals deliberately live below the input catcher. In the
        // production renderer, a visible shape can become the top hit target
        // even when it has no onClick handler. Keeping this layer below the
        // transparent catcher makes help purely visual and never blocks play.
        this.tutorialLayer = this.makeContainer();
        this.tapCatcher = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 7, 100, 78),
            fill: PALETTE.transparent,
            color: PALETTE.white,
            onClick: (playerId, x, y) => this.handleMapTap(Number(playerId), x, y)
        });
        this.hudLayer = this.makeContainer();
        this.overlayLayer = this.makeContainer();
        this.base.addChildren(
            this.backgroundLayer,
            this.routeLayer,
            this.foodLayer,
            this.nestLayer,
            this.swarmLayer,
            this.privateLayer,
            this.tutorialLayer,
            this.tapCatcher,
            this.hudLayer,
            this.overlayLayer
        );

        this.buildBackground();
        this.buildSwarmPool();
        this.renderLobby();
    }

    getLayers() {
        return [{ root: this.base }];
    }

    canAddPlayer() {
        return this.playerOrder.length < TUNING.MAX_PLAYERS;
    }

    makeContainer(playerIds) {
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 0, 0, 0),
            fill: PALETTE.transparent,
            color: PALETTE.white,
            playerIds
        });
    }

    makeText(text, x, y, size, color, align = 'center', playerIds) {
        return new GameNode.Text({
            textInfo: { text, x, y, size, align, color, font: 'monospace' },
            playerIds
        });
    }

    setText(textNode, updates) {
        if (!textNode || !textNode.node) return;
        const current = textNode.node.text || {};
        textNode.node.text = Object.assign({
            text: '',
            x: 0,
            y: 0,
            size: 1,
            align: 'center',
            color: PALETTE.white,
            font: 'monospace'
        }, current, updates || {});
    }

    makeButton({ x, y, width, height, label, subtitle, fill, color, playerIds, onClick, size = 1.8 }) {
        const button = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(x, y, width, height),
            fill,
            color,
            border: 3,
            playerIds,
            onClick
        });
        const labelNode = this.makeText(label, x + width / 2, y + height / 2 - (subtitle ? 1.1 : size * 0.5), size, PALETTE.white, 'center', playerIds);
        button.addChild(labelNode);
        button.labelNode = labelNode;
        if (subtitle) {
            const subtitleNode = this.makeText(subtitle, x + width / 2, y + height / 2 + 1.6, 0.78, PALETTE.muted, 'center', playerIds);
            button.addChild(subtitleNode);
            button.subtitleNode = subtitleNode;
        }
        return button;
    }

    buildBackground() {
        this.backgroundLayer.clearChildren();
        this.backgroundLayer.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(3, 7, 94, 78),
            fill: PALETTE.backgroundAlt,
            color: PALETTE.soilLight,
            border: 2
        }));
        const spores = [
            [8, 15, 0.22], [17, 31, 0.13], [27, 12, 0.16], [36, 78, 0.19],
            [44, 19, 0.12], [53, 73, 0.16], [61, 14, 0.2], [69, 81, 0.14],
            [78, 23, 0.16], [89, 15, 0.12], [91, 65, 0.2], [13, 70, 0.14],
            [23, 86, 0.11], [49, 43, 0.13], [73, 49, 0.1], [7, 46, 0.17]
        ];
        for (const [x, y, radius] of spores) {
            this.backgroundLayer.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: polyCircle(x, y, radius, 8),
                fill: [129, 166, 91, 160],
                color: [180, 210, 130, 120]
            }));
        }
    }

    buildSwarmPool() {
        this.swarmLayer.clearChildren();
        this.swarms = [];
        for (let index = 0; index < TUNING.MAX_SWARMS; index += 1) {
            const group = this.makeContainer([0]);
            const trail = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: PALETTE.white,
                color: PALETTE.white
            });
            const dots = [];
            for (let dot = 0; dot < 4; dot += 1) {
                const node = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: rectangle(0, 0, 0, 0),
                    fill: PALETTE.white,
                    color: PALETTE.white,
                    effects: glow(PALETTE.white, 5)
                });
                dots.push(node);
                group.addChild(node);
            }
            const cargo = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: PALETTE.nectar,
                color: PALETTE.nectar,
                effects: glow(PALETTE.nectar, 6)
            });
            const label = this.makeText('', 0, 0, 1.05, PALETTE.white);
            group.addChildren(trail, cargo, label);
            this.swarmLayer.addChild(group);
            this.swarms.push({
                active: false,
                slot: index,
                id: null,
                ownerKey: null,
                bugs: 0,
                carrying: 0,
                sourceNestId: null,
                targetId: null,
                targetType: null,
                mode: null,
                progress: 0,
                durationTicks: 1,
                harvestTicks: 0,
                group,
                trail,
                dots,
                cargo,
                label
            });
        }
    }

    handleNewPlayer({ playerId, info }) {
        const id = Number(playerId);
        if (this.players[id]) return;
        const player = {
            id,
            name: info && info.name ? String(info.name).slice(0, 16) : `PLAYER ${id}`,
            factionKey: null,
            selectedNestId: null,
            sendPercent: 0.5,
            statusText: '',
            statusTicks: 0,
            spectator: this.phase === 'running',
            selectionRing: null,
            hudContainer: null,
            hud: null,
            tutorialSeen: false,
            tutorialEnabled: false,
            tutorialStep: 0,
            tutorialTicks: 0,
            tutorialContainer: null,
            tutorial: null
        };
        this.players[id] = player;
        this.playerOrder.push(id);
        this.createSelectionRing(player);
        if (this.phase === 'lobby') this.renderLobby();
        else if (this.phase === 'running') this.buildSpectatorHud(player);
        else this.buildGameOverHud(player);
    }

    handlePlayerDisconnect(playerId) {
        const id = Number(playerId);
        const player = this.players[id];
        if (!player) return;
        if (this.phase === 'running' && player.factionKey && this.factions[player.factionKey]) {
            const faction = this.factions[player.factionKey];
            faction.isHuman = false;
            faction.controllerId = null;
            faction.name = `${player.name} AI`;
        }
        if (player.selectionRing) this.privateLayer.removeChild(player.selectionRing.id);
        if (player.hudContainer) this.hudLayer.removeChild(player.hudContainer.id);
        delete this.players[id];
        this.playerOrder = this.playerOrder.filter((value) => value !== id);
        if (this.phase === 'lobby') this.renderLobby();
        else if (this.phase === 'running') this.refreshHud(true);
        else this.renderGameOver();
    }

    handleKeyDown(playerId, key) {
        const id = Number(playerId);
        const lower = String(key).toLowerCase();
        if ((lower === 'enter' || lower === ' ') && (this.phase === 'lobby' || this.phase === 'gameover')) {
            this.startGame(id);
            return;
        }
        if (this.phase !== 'running') return;
        if (lower === '1') this.setSendPercent(id, 0.25);
        if (lower === '2') this.setSendPercent(id, 0.5);
        if (lower === '3') this.setSendPercent(id, 1);
        if (lower === 'f') this.triggerFrenzy(id);
        if (lower === 'escape') this.clearSelection(id);
    }

    tick() {
        if (this.phase !== 'running') return;
        let changed = false;
        this.elapsedTicks += 1;
        changed = this.tickNests() || changed;
        changed = this.tickFood() || changed;
        changed = this.tickSwarms() || changed;
        changed = this.tickFrenzy() || changed;
        changed = this.tickStatuses() || changed;
        changed = this.tickTutorials() || changed;

        this.aiClock += 1;
        if (this.aiClock >= Math.round(TUNING.AI_DECISION_SECONDS * TUNING.TICK_RATE)) {
            this.aiClock = 0;
            changed = this.runAi() || changed;
        }

        this.winClock += 1;
        if (this.winClock >= TUNING.WIN_CHECK_TICKS) {
            this.winClock = 0;
            if (this.checkWinner()) return;
        }

        if (changed) {
            this.refreshNestVisuals(false);
            this.refreshFoodVisuals(false);
            this.refreshHud(false);
            this.base.node.onStateChange();
        }
    }

    createSelectionRing(player) {
        const ring = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 0, 0, 0),
            fill: PALETTE.transparent,
            color: PALETTE.white,
            border: 3,
            playerIds: [player.id]
        });
        player.selectionRing = ring;
        this.privateLayer.addChild(ring);
    }

    renderLobby() {
        this.phase = 'lobby';
        this.currentWorld = null;
        this.routeLayer.clearChildren();
        this.foodLayer.clearChildren();
        this.nestLayer.clearChildren();
        this.clearSwarms();
        this.hudLayer.clearChildren();
        this.overlayLayer.clearChildren();
        for (const id of this.playerOrder) {
            const player = this.players[id];
            player.factionKey = null;
            player.selectedNestId = null;
            player.spectator = false;
            player.hudContainer = null;
            player.hud = null;
            player.tutorialEnabled = false;
            player.tutorialStep = 0;
            player.tutorialTicks = 0;
            player.tutorialContainer = null;
            player.tutorial = null;
            this.updateSelectionRing(player);
        }

        const world = GENERATED_WORLDS[this.selectedWorldIndex];

        this.overlayLayer.addChild(this.makeText('SELECT A WORLD', 50, 22, 1, PALETTE.muted));
        this.overlayLayer.addChild(this.makeButton({
            x: 7, y: 38, width: 10, height: 10, label: '<', fill: PALETTE.panelAlt, color: PALETTE.lineBright,
            onClick: () => this.cycleWorld(-1), size: 2.5
        }));
        this.overlayLayer.addChild(this.makeButton({
            x: 83, y: 38, width: 10, height: 10, label: '>', fill: PALETTE.panelAlt, color: PALETTE.lineBright,
            onClick: () => this.cycleWorld(1), size: 2.5
        }));
        this.renderWorldPreview(world);
        this.overlayLayer.addChild(this.makeText(world.name, 50, 27, 2.4, [130, 236, 102, 255]));
        this.overlayLayer.addChild(this.makeText(world.tagline.toUpperCase(), 50, 31, 1, PALETTE.muted));
        this.overlayLayer.addChild(this.makeText(`${world.nests.length} NESTS  •  ${world.food.length} BLOOMS`, 50, 35, 0.9, PALETTE.muted));
        const count = this.playerOrder.length;
        this.overlayLayer.addChild(this.makeText(`${count} PLAYER${count === 1 ? '' : 'S'} CONNECTED`, 50, 73, 1.3, count ? FACTIONS[0].color : PALETTE.muted));
        this.overlayLayer.addChild(this.makeButton({
            x: 29, y: 77, width: 42, height: 9,
            label: count ? 'PLAY' : 'WAITING FOR PLAYER',
            fill: count ? FACTIONS[0].dark : PALETTE.panelAlt,
            color: count ? FACTIONS[0].color : PALETTE.muted,
            onClick: (playerId) => this.startGame(Number(playerId)),
            size: 1.6
        }));
        this.overlayLayer.addChild(this.makeText(count === 1 ? 'SOLO ADDS TWO RIVAL COLONIES' : 'LAST COLONY STANDING', 50, 89, 0.95, PALETTE.muted));
        this.overlayLayer.addChild(this.makeText('TAP YOUR NEST, THEN A FLOWER OR RIVAL.  ? FOR HELP', 50, 92.5, 0.78, PALETTE.muted));
        this.base.node.onStateChange();
    }

    renderWorldPreview(world) {
        const scale = 0.47;
        const offsetX = 26.5;
        const offsetY = 37;
        const width = 47;
        const height = 29;
        this.overlayLayer.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(offsetX, offsetY, width, height),
            fill: PALETTE.soil,
            color: PALETTE.soilLight,
            border: 2
        }));
        for (const patch of world.food) {
            const x = offsetX + patch.x * scale;
            const y = offsetY + (patch.y - 7) * 0.37;
            this.overlayLayer.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: polyCircle(x, y, 0.42, 8),
                fill: PALETTE.nectarDark,
                color: PALETTE.nectar
            }));
        }
        for (const nest of world.nests) {
            const x = offsetX + nest.x * scale;
            const y = offsetY + (nest.y - 7) * 0.37;
            const color = nest.spawn ? FACTIONS[0].color : PALETTE.neutral;
            this.overlayLayer.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: polyCircle(x, y, nest.heart ? 0.9 : 0.62, 12),
                fill: colorAlpha(color, 80),
                color
            }));
        }
    }

    cycleWorld(direction) {
        if (this.phase !== 'lobby') return;
        this.selectedWorldIndex = (this.selectedWorldIndex + direction + GENERATED_WORLDS.length) % GENERATED_WORLDS.length;
        this.renderLobby();
    }

    startGame() {
        if (this.phase === 'running' || this.playerOrder.length === 0) return;
        this.phase = 'running';
        this.elapsedTicks = 0;
        this.aiClock = 0;
        this.winClock = 0;
        this.winnerKey = null;
        this.currentWorld = GENERATED_WORLDS[this.selectedWorldIndex];
        this.overlayLayer.clearChildren();
        this.hudLayer.clearChildren();
        this.routeLayer.clearChildren();
        this.foodLayer.clearChildren();
        this.nestLayer.clearChildren();
        this.clearSwarms();
        this.factions = {};
        this.factionOrder = [];

        let factionCount = this.playerOrder.length;
        if (factionCount === 1) factionCount = 3;
        const spawnIds = chooseSpawns(this.currentWorld.spawnIds, factionCount);

        for (let index = 0; index < factionCount; index += 1) {
            const humanId = index < this.playerOrder.length ? this.playerOrder[index] : null;
            const key = `f${index}`;
            const color = FACTIONS[index];
            const faction = {
                key,
                name: humanId !== null ? this.players[humanId].name : `${color.name} AI`,
                color: color.color,
                dark: color.dark,
                controllerId: humanId,
                isHuman: humanId !== null,
                frenzyTicks: 0,
                frenzyCooldownTicks: 0,
                aiBias: index % 3
            };
            this.factions[key] = faction;
            this.factionOrder.push(key);
            if (humanId !== null) {
                const player = this.players[humanId];
                player.factionKey = key;
                player.spectator = false;
                player.selectedNestId = null;
            }
        }

        this.nests = this.currentWorld.nests.map((spec) => ({
            ...spec,
            ownerKey: null,
            bugs: spec.neutralBugs,
            nectar: 0,
            hatchProgress: 0,
            group: null,
            shell: null,
            inner: null,
            bugText: null,
            nectarText: null,
            queenMark: null
        }));
        this.foodPatches = this.currentWorld.food.map((spec) => ({
            ...spec,
            nectar: spec.maxNectar,
            group: null,
            petals: [],
            label: null
        }));

        spawnIds.forEach((nestId, index) => {
            const nest = this.getNest(nestId);
            const faction = this.factions[`f${index}`];
            nest.ownerKey = faction.key;
            nest.bugs = TUNING.STARTING_BUGS;
            nest.nectar = TUNING.STARTING_NECTAR;
            nest.queen = true;
        });

        this.buildWorldRoutes();
        this.buildFoodVisuals();
        this.buildNestVisuals();
        for (const id of this.playerOrder) {
            const player = this.players[id];
            this.buildPlayerHud(player);
            player.tutorialEnabled = false; // Detailed help is available on demand with ?.
            player.tutorialStep = 0;
            player.tutorialTicks = 0;
            this.updateTutorial(player);
        }
        this.refreshNestVisuals(true);
        this.refreshFoodVisuals(true);
        this.refreshHud(true);
        this.base.node.onStateChange();
    }

    buildWorldRoutes() {
        this.routeLayer.clearChildren();
        const nests = this.nests;
        for (let left = 0; left < nests.length; left += 1) {
            const distances = [];
            for (let right = 0; right < nests.length; right += 1) {
                if (left === right) continue;
                distances.push({ index: right, value: distance(nests[left], nests[right]) });
            }
            distances.sort((a, b) => a.value - b.value);
            for (const nearby of distances.slice(0, 2)) {
                if (left > nearby.index) continue;
                const a = nests[left];
                const b = nests[nearby.index];
                this.routeLayer.addChild(new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: thickLine(a.x, a.y, b.x, b.y, 0.23),
                    fill: colorAlpha(PALETTE.line, 130),
                    color: colorAlpha(PALETTE.lineBright, 90)
                }));
            }
        }
    }

    buildFoodVisuals() {
        this.foodLayer.clearChildren();
        for (const patch of this.foodPatches) {
            const group = this.makeContainer();
            patch.group = group;
            patch.petals = [];
            for (let index = 0; index < 5; index += 1) {
                const angle = index * Math.PI * 2 / 5;
                const petal = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: polyCircle(patch.x + Math.cos(angle) * 1.15, patch.y + Math.sin(angle) * 1.15, 0.72, 10),
                    fill: PALETTE.nectarDark,
                    color: PALETTE.nectar,
                    effects: glow(PALETTE.nectar, 5)
                });
                patch.petals.push(petal);
                group.addChild(petal);
            }
            const center = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: polyCircle(patch.x, patch.y, 0.65, 10),
                fill: PALETTE.nectar,
                color: PALETTE.white
            });
            patch.label = this.makeText('', patch.x, patch.y + 2.25, 0.86, PALETTE.nectar);
            group.addChildren(center, patch.label);
            this.foodLayer.addChild(group);
        }
    }

    buildNestVisuals() {
        this.nestLayer.clearChildren();
        for (const nest of this.nests) {
            const group = this.makeContainer();
            const shell = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: polyCircle(nest.x, nest.y, nest.radius, 20),
                fill: PALETTE.neutralDark,
                color: PALETTE.neutral,
                border: 3,
                effects: glow(PALETTE.neutral, nest.heart ? 11 : 7)
            });
            const inner = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: polyCircle(nest.x, nest.y, nest.radius * 0.56, 16),
                fill: colorAlpha(PALETTE.neutral, 70),
                color: PALETTE.neutral
            });
            const bugText = this.makeText('', nest.x, nest.y - 0.75, nest.heart ? 1.35 : 1.15, PALETTE.white);
            const nectarText = this.makeText('', nest.x, nest.y + 1.15, 0.75, PALETTE.nectar);
            const queenMark = this.makeText('', nest.x, nest.y - nest.radius - 1.25, 0.9, PALETTE.white);
            group.addChildren(shell, inner, bugText, nectarText, queenMark);
            nest.group = group;
            nest.shell = shell;
            nest.inner = inner;
            nest.bugText = bugText;
            nest.nectarText = nectarText;
            nest.queenMark = queenMark;
            this.nestLayer.addChild(group);
        }
    }

    buildPlayerHud(player) {
        const ids = [player.id];
        const group = this.makeContainer(ids);
        player.hudContainer = group;
        const panel = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 85, 100, 15),
            fill: PALETTE.panel,
            color: PALETTE.lineBright,
            border: 2,
            playerIds: ids
        });
        const title = this.makeText('', 2, 87, 1.1, PALETTE.white, 'left', ids);
        const economy = this.makeText('', 2, 90.2, 1.15, PALETTE.muted, 'left', ids);
        const status = this.makeText('', 50, 82.7, 1.25, PALETTE.white, 'center', ids);
        group.addChildren(panel, title, economy, status);
        const helpButton = this.makeButton({
            x: 29.5,
            y: 88,
            width: 5.5,
            height: 7.5,
            label: '?',
            fill: PALETTE.panelAlt,
            color: PALETTE.lineBright,
            playerIds: ids,
            onClick: (playerId) => this.toggleTutorial(Number(playerId)),
            size: 1.55
        });
        group.addChild(helpButton);
        const percentButtons = [];
        const percentages = [0.25, 0.5, 1];
        percentages.forEach((percent, index) => {
            const button = this.makeButton({
                x: 36 + index * 12,
                y: 88,
                width: 10.5,
                height: 7.5,
                label: `${Math.round(percent * 100)}%`,
                fill: PALETTE.panelAlt,
                color: PALETTE.lineBright,
                playerIds: ids,
                onClick: (playerId) => this.setSendPercent(Number(playerId), percent),
                size: 1.25
            });
            percentButtons.push(button);
            group.addChild(button);
        });
        const frenzyButton = this.makeButton({
            x: 74,
            y: 88,
            width: 23,
            height: 7.5,
            label: 'FRENZY',
            subtitle: 'SPEED BURST',
            fill: PALETTE.panelAlt,
            color: PALETTE.nectar,
            playerIds: ids,
            onClick: (playerId) => this.triggerFrenzy(Number(playerId)),
            size: 1.15
        });
        group.addChild(frenzyButton);
        player.hud = { panel, title, economy, status, helpButton, percentButtons, frenzyButton };
        this.hudLayer.addChild(group);
        this.buildTutorialOverlay(player);
    }

    buildTutorialOverlay(player) {
        const ids = [player.id];
        const highlight = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 0, 0, 0),
            fill: PALETTE.transparent,
            color: PALETTE.nectar,
            border: 4,
            effects: glow(PALETTE.nectar, 12),
            playerIds: [0]
        });
        const panel = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(5, 7.7, 90, 9.2),
            fill: colorAlpha(PALETTE.panel, 245),
            color: PALETTE.nectar,
            border: 2,
            playerIds: [0]
        });
        const title = this.makeText('', 8, 10.2, 1.12, PALETTE.nectar, 'left', [0]);
        const body = this.makeText('', 8, 13.6, 0.85, PALETTE.white, 'left', [0]);
        this.tutorialLayer.addChildren(highlight, panel, title, body);
        player.tutorialContainer = { nodes: [highlight, panel, title, body] };
        player.tutorial = { highlight, panel, title, body };
    }

    toggleTutorial(playerId) {
        const player = this.players[playerId];
        if (!player || player.spectator || this.phase !== 'running') return;
        if (player.tutorialEnabled) {
            this.skipTutorial(playerId);
            return;
        }
        player.tutorialEnabled = true;
        player.tutorialSeen = false;
        player.tutorialStep = 0;
        player.tutorialTicks = 0;
        this.updateTutorial(player);
        this.base.node.onStateChange();
    }

    skipTutorial(playerId) {
        const player = this.players[playerId];
        if (!player) return;
        player.tutorialEnabled = false;
        player.tutorialSeen = true;
        player.tutorialTicks = 0;
        this.updateTutorial(player);
        this.setStatus(player, 'HELP HIDDEN — TAP ? TO REOPEN');
        this.base.node.onStateChange();
    }

    advanceTutorial(player, event) {
        if (!player || !player.tutorialEnabled) return;
        let advanced = false;
        if (player.tutorialStep === 0 && event === 'selected_nest') {
            player.tutorialStep = 1;
            advanced = true;
        } else if (player.tutorialStep <= 1 && event === 'forage_launched') {
            player.tutorialStep = 2;
            advanced = true;
        } else if (player.tutorialStep <= 2 && event === 'forage_returned') {
            player.tutorialStep = 3;
            advanced = true;
        } else if (player.tutorialStep <= 3 && event === 'raid_launched') {
            player.tutorialStep = 4;
            advanced = true;
        } else if (player.tutorialStep <= 4 && event === 'captured_nest') {
            player.tutorialStep = 5;
            player.tutorialTicks = Math.round(TUNING.TUTORIAL_FINAL_SECONDS * TUNING.TICK_RATE);
            advanced = true;
        }
        if (advanced) this.updateTutorial(player);
    }

    advanceTutorialForFaction(factionKey, event) {
        const faction = this.factions[factionKey];
        if (!faction || faction.controllerId === null) return;
        this.advanceTutorial(this.players[faction.controllerId], event);
    }

    tutorialTarget(player) {
        if (!player || !player.factionKey) return null;
        const owned = this.nests.filter((nest) => nest.ownerKey === player.factionKey);
        if (!owned.length) return null;
        const selected = player.selectedNestId ? this.getNest(player.selectedNestId) : null;
        const source = selected && selected.ownerKey === player.factionKey
            ? selected
            : owned.slice().sort((a, b) => b.bugs - a.bugs)[0];
        if (player.tutorialStep === 0 || player.tutorialStep === 2) return source;
        if (player.tutorialStep === 1) {
            return this.foodPatches.slice().sort((a, b) => distance(source, a) - distance(source, b))[0] || source;
        }
        if (player.tutorialStep === 3 || player.tutorialStep === 4) {
            return this.nests
                .filter((nest) => nest.ownerKey !== player.factionKey)
                .sort((a, b) => (a.bugs + distance(source, a) * 0.35) - (b.bugs + distance(source, b) * 0.35))[0] || source;
        }
        return null;
    }

    updateTutorial(player) {
        if (!player || !player.tutorial || !player.tutorialContainer) return;
        const visible = player.tutorialEnabled && this.phase === 'running' && !player.spectator;
        const ids = visible ? [player.id] : [0];
        for (const node of player.tutorialContainer.nodes) {
            node.playerIds = ids;
            node.node.playerIds = ids;
        }
        if (!visible) {
            player.tutorial.highlight.coordinates2d = rectangle(0, 0, 0, 0);
            player.tutorial.highlight.node.coordinates2d = player.tutorial.highlight.coordinates2d;
            return;
        }
        const copy = [
            ['1 · SELECT A NEST', 'Tap your colored QUEEN nest to prepare a swarm.  Tap ? to hide help.'],
            ['2 · FORAGE FOR NECTAR', 'Tap a yellow bloom. Bugs gather nectar, then carry it home.'],
            ['3 · GROW AUTOMATICALLY', 'Wait for the swarm to return. Nectar is spent to hatch new bugs.'],
            ['4 · EXPAND YOUR COLONY', 'Select a strong nest, then tap a gray nest to raid and capture it.'],
            ['5 · WIN THE RAID', 'More attacking bugs than defenders captures the nest. Watch the swarm arrive.'],
            ['YOU KNOW THE LOOP', 'Forage → hatch → capture. FRENZY speeds every moving swarm.']
        ][clamp(player.tutorialStep, 0, 5)];
        const target = this.tutorialTarget(player);
        // Put the instruction banner on the opposite side of the battlefield
        // from the highlighted target. This keeps the thing being explained
        // visible while the transparent input catcher remains fully usable.
        const panelY = target && target.y < 45 ? 72.8 : 7.7;
        player.tutorial.panel.coordinates2d = rectangle(5, panelY, 90, 9.2);
        player.tutorial.panel.node.coordinates2d = player.tutorial.panel.coordinates2d;
        this.setText(player.tutorial.title, { text: copy[0], x: 8, y: panelY + 2.5 });
        this.setText(player.tutorial.body, { text: copy[1], x: 8, y: panelY + 5.9 });
        if (target) {
            const radius = target.radius ? target.radius + 1.5 : 3;
            player.tutorial.highlight.coordinates2d = polyCircle(target.x, target.y, radius, 22);
            player.tutorial.highlight.node.coordinates2d = player.tutorial.highlight.coordinates2d;
            player.tutorial.highlight.color = player.tutorialStep === 1 ? PALETTE.nectar : PALETTE.white;
            player.tutorial.highlight.node.color = player.tutorial.highlight.color;
        } else {
            player.tutorial.highlight.coordinates2d = rectangle(0, 0, 0, 0);
            player.tutorial.highlight.node.coordinates2d = player.tutorial.highlight.coordinates2d;
        }
    }

    buildSpectatorHud(player) {
        const ids = [player.id];
        const group = this.makeContainer(ids);
        group.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 85, 100, 15),
            fill: PALETTE.panel,
            color: PALETTE.lineBright,
            border: 2,
            playerIds: ids
        }));
        group.addChild(this.makeText('SPECTATING — JOIN NEXT ROUND', 50, 91, 1.35, PALETTE.muted, 'center', ids));
        player.hudContainer = group;
        player.hud = null;
        this.hudLayer.addChild(group);
    }

    buildGameOverHud(player) {
        player.hudContainer = null;
        player.hud = null;
    }

    setSendPercent(playerId, percent) {
        const player = this.players[playerId];
        if (!player || player.spectator || this.phase !== 'running') return;
        player.sendPercent = percent;
        this.setStatus(player, `${Math.round(percent * 100)}% SWARM READY`);
        this.refreshHud(true);
        this.base.node.onStateChange();
    }

    triggerFrenzy(playerId) {
        const player = this.players[playerId];
        if (!player || player.spectator || !player.factionKey) return;
        const faction = this.factions[player.factionKey];
        if (!faction || faction.frenzyCooldownTicks > 0) {
            this.setStatus(player, 'FRENZY RECHARGING');
            return;
        }
        faction.frenzyTicks = Math.round(TUNING.FRENZY_DURATION_SECONDS * TUNING.TICK_RATE);
        faction.frenzyCooldownTicks = Math.round(TUNING.FRENZY_COOLDOWN_SECONDS * TUNING.TICK_RATE);
        this.setStatus(player, 'THE SWARM SURGES');
        this.refreshHud(true);
        this.base.node.onStateChange();
    }

    handleMapTap(playerId, x, y) {
        if (this.phase !== 'running' || y >= 85) return;
        const player = this.players[playerId];
        if (!player || player.spectator || !player.factionKey) return;
        const nearestNest = this.findNearestNest(x, y, TUNING.TAP_RADIUS);
        const nearestFood = this.findNearestFood(x, y, TUNING.TAP_RADIUS);

        if (!player.selectedNestId) {
            if (nearestNest && nearestNest.ownerKey === player.factionKey) {
                player.selectedNestId = nearestNest.id;
                this.setStatus(player, `${Math.floor(nearestNest.bugs)} BUGS READY`);
                this.advanceTutorial(player, 'selected_nest');
                this.updateSelectionRing(player);
                this.updateTutorial(player);
                this.base.node.onStateChange();
            } else {
                this.setStatus(player, 'SELECT ONE OF YOUR NESTS');
            }
            return;
        }

        const source = this.getNest(player.selectedNestId);
        if (!source || source.ownerKey !== player.factionKey) {
            this.clearSelection(playerId);
            return;
        }

        if (nearestFood && (!nearestNest || distance({ x, y }, nearestFood) < distance({ x, y }, nearestNest))) {
            this.launchSwarm(player, source, 'food', nearestFood.id);
            return;
        }

        if (nearestNest) {
            if (nearestNest.id === source.id) {
                this.clearSelection(playerId);
                return;
            }
            this.launchSwarm(player, source, 'nest', nearestNest.id);
            return;
        }

        this.setStatus(player, 'TAP A BLOOM OR NEST');
    }

    launchSwarm(player, source, targetType, targetId) {
        const minimumReserve = source.queen ? 6 : 3;
        const available = Math.floor(source.bugs - minimumReserve);
        const amount = Math.floor(source.bugs * player.sendPercent);
        const send = Math.min(available, amount);
        if (send < 2) {
            this.setStatus(player, 'NOT ENOUGH BUGS');
            return false;
        }
        const slot = this.swarms.find((swarm) => !swarm.active);
        if (!slot) {
            this.setStatus(player, 'TOO MANY ACTIVE SWARMS');
            return false;
        }
        const target = targetType === 'food' ? this.getFood(targetId) : this.getNest(targetId);
        if (!target) return false;
        source.bugs -= send;
        slot.active = true;
        slot.id = this.nextSwarmId;
        this.nextSwarmId += 1;
        slot.ownerKey = player.factionKey;
        slot.bugs = send;
        slot.carrying = 0;
        slot.sourceNestId = source.id;
        slot.targetId = targetId;
        slot.targetType = targetType;
        slot.mode = targetType === 'food' ? 'forage' : (target.ownerKey === player.factionKey ? 'reinforce' : 'raid');
        if (player.id !== undefined && player.id !== null) {
            if (slot.mode === 'forage') this.advanceTutorial(player, 'forage_launched');
            else if (slot.mode === 'raid') this.advanceTutorial(player, 'raid_launched');
        }
        slot.progress = 0;
        slot.durationTicks = this.travelTicks(source, target, slot.ownerKey);
        slot.harvestTicks = 0;
        slot.group.playerIds = undefined;
        slot.group.node.playerIds = undefined;
        this.updateSwarmVisual(slot, true);
        const verb = slot.mode === 'forage' ? 'FORAGING' : slot.mode === 'reinforce' ? 'REINFORCING' : 'RAIDING';
        this.setStatus(player, `${verb} WITH ${send}`);
        player.selectedNestId = null;
        this.updateSelectionRing(player);
        this.refreshNestVisuals(false);
        this.refreshHud(false);
        this.base.node.onStateChange();
        return true;
    }

    travelTicks(source, target, ownerKey) {
        const faction = this.factions[ownerKey];
        return Math.max(1, Math.round(distance(source, target) / TUNING.SWARM_SPEED_PER_SECOND * TUNING.TICK_RATE));
    }

    tickNests() {
        let changed = false;
        const perTick = 1 / (TUNING.HATCH_SECONDS * TUNING.TICK_RATE);
        for (const nest of this.nests) {
            if (!nest.ownerKey || nest.nectar < 1 || nest.bugs >= TUNING.MAX_NEST_BUGS) continue;
            nest.hatchProgress += perTick;
            while (nest.hatchProgress >= 1 && nest.nectar >= 1 && nest.bugs < TUNING.MAX_NEST_BUGS) {
                nest.hatchProgress -= 1;
                nest.nectar -= 1;
                nest.bugs = Math.min(TUNING.MAX_NEST_BUGS, nest.bugs + TUNING.HATCH_BATCH);
                changed = true;
            }
        }
        return changed;
    }

    tickFood() {
        let changed = false;
        const gain = TUNING.PATCH_REGEN_PER_SECOND / TUNING.TICK_RATE;
        for (const patch of this.foodPatches) {
            if (patch.nectar < patch.maxNectar) {
                patch.nectar = Math.min(patch.maxNectar, patch.nectar + gain);
                changed = true;
            }
        }
        return changed;
    }

    tickFrenzy() {
        let changed = false;
        for (const key of this.factionOrder) {
            const faction = this.factions[key];
            if (faction.frenzyTicks > 0) {
                faction.frenzyTicks -= 1;
                changed = true;
            }
            if (faction.frenzyCooldownTicks > 0) {
                faction.frenzyCooldownTicks -= 1;
                changed = true;
            }
        }
        return changed;
    }

    tickSwarms() {
        let changed = false;
        for (const swarm of this.swarms) {
            if (!swarm.active) continue;
            if (swarm.mode === 'harvest') {
                changed = this.tickHarvest(swarm) || changed;
                this.updateSwarmVisual(swarm, false);
                continue;
            }
            const faction = this.factions[swarm.ownerKey];
            const speedMultiplier = faction && faction.frenzyTicks > 0 ? TUNING.FRENZY_SPEED_MULTIPLIER : 1;
            swarm.progress += speedMultiplier / swarm.durationTicks;
            if (swarm.progress >= 1) {
                swarm.progress = 1;
                this.resolveArrival(swarm);
                changed = true;
            } else {
                this.updateSwarmVisual(swarm, false);
                changed = true;
            }
        }
        return changed;
    }

    tickHarvest(swarm) {
        const patch = this.getFood(swarm.targetId);
        if (!patch || patch.nectar <= 0.02) {
            this.beginReturn(swarm);
            return true;
        }
        swarm.harvestTicks += 1;
        const interval = Math.max(1, Math.round(TUNING.FORAGE_SECONDS * TUNING.TICK_RATE / Math.max(1, Math.sqrt(swarm.bugs / 5))));
        if (swarm.harvestTicks < interval) return false;
        swarm.harvestTicks = 0;
        const capacity = Math.max(3, Math.floor(swarm.bugs * TUNING.CARRY_PER_BUG));
        const take = Math.min(2, patch.nectar, capacity - swarm.carrying);
        swarm.carrying += take;
        patch.nectar -= take;
        if (swarm.carrying >= capacity - 0.01 || patch.nectar <= 0.02) this.beginReturn(swarm);
        return true;
    }

    beginReturn(swarm) {
        const nest = this.findNearestOwnedNest(swarm.ownerKey, this.getFood(swarm.targetId) || this.getNest(swarm.targetId));
        if (!nest) {
            this.deactivateSwarm(swarm);
            return;
        }
        const origin = this.getSwarmPosition(swarm);
        swarm.sourceNestId = null;
        swarm.returnStart = origin;
        swarm.targetType = 'nest';
        swarm.targetId = nest.id;
        swarm.mode = 'return';
        swarm.progress = 0;
        swarm.durationTicks = this.travelTicks(origin, nest, swarm.ownerKey);
    }

    resolveArrival(swarm) {
        if (swarm.mode === 'forage') {
            swarm.mode = 'harvest';
            swarm.progress = 1;
            swarm.harvestTicks = 0;
            return;
        }
        const nest = this.getNest(swarm.targetId);
        if (!nest) {
            this.deactivateSwarm(swarm);
            return;
        }
        if (swarm.mode === 'return') {
            if (nest.ownerKey !== swarm.ownerKey) {
                const retarget = this.findNearestOwnedNest(swarm.ownerKey, nest);
                if (!retarget) {
                    this.deactivateSwarm(swarm);
                    return;
                }
                swarm.returnStart = { x: nest.x, y: nest.y };
                swarm.targetId = retarget.id;
                swarm.progress = 0;
                swarm.durationTicks = this.travelTicks(swarm.returnStart, retarget, swarm.ownerKey);
                return;
            }
            nest.bugs = Math.min(TUNING.MAX_NEST_BUGS, nest.bugs + swarm.bugs);
            nest.nectar = Math.min(TUNING.MAX_NEST_NECTAR, nest.nectar + swarm.carrying);
            this.advanceTutorialForFaction(swarm.ownerKey, 'forage_returned');
            this.deactivateSwarm(swarm);
            return;
        }
        if (nest.ownerKey === swarm.ownerKey) {
            nest.bugs = Math.min(TUNING.MAX_NEST_BUGS, nest.bugs + swarm.bugs);
            this.deactivateSwarm(swarm);
            return;
        }
        if (swarm.bugs > nest.bugs) {
            const oldOwner = nest.ownerKey;
            const remaining = Math.max(2, swarm.bugs - nest.bugs);
            nest.ownerKey = swarm.ownerKey;
            nest.bugs = remaining;
            nest.nectar = Math.floor(nest.nectar * 0.5);
            nest.hatchProgress = 0;
            if (oldOwner) this.notifyFaction(oldOwner, `${this.nestLabel(nest)} LOST`);
            this.notifyFaction(swarm.ownerKey, `${this.nestLabel(nest)} CAPTURED`);
            this.advanceTutorialForFaction(swarm.ownerKey, 'captured_nest');
        } else {
            nest.bugs -= swarm.bugs;
        }
        this.deactivateSwarm(swarm);
    }

    deactivateSwarm(swarm) {
        swarm.active = false;
        swarm.group.playerIds = [0];
        swarm.group.node.playerIds = [0];
        swarm.bugs = 0;
        swarm.carrying = 0;
        swarm.returnStart = null;
        swarm.trail.coordinates2d = rectangle(0, 0, 0, 0);
        swarm.trail.node.coordinates2d = swarm.trail.coordinates2d;
        for (const dot of swarm.dots) {
            dot.coordinates2d = rectangle(0, 0, 0, 0);
            dot.node.coordinates2d = dot.coordinates2d;
        }
        swarm.cargo.coordinates2d = rectangle(0, 0, 0, 0);
        swarm.cargo.node.coordinates2d = swarm.cargo.coordinates2d;
        this.setText(swarm.label, { text: '' });
    }

    getSwarmPosition(swarm) {
        let source;
        if (swarm.returnStart) source = swarm.returnStart;
        else source = this.getNest(swarm.sourceNestId);
        const target = swarm.targetType === 'food' ? this.getFood(swarm.targetId) : this.getNest(swarm.targetId);
        if (!source || !target) return { x: 0, y: 0 };
        return {
            x: source.x + (target.x - source.x) * swarm.progress,
            y: source.y + (target.y - source.y) * swarm.progress
        };
    }

    updateSwarmVisual(swarm) {
        if (!swarm.active) return;
        const faction = this.factions[swarm.ownerKey];
        const color = faction ? faction.color : PALETTE.neutral;
        const source = swarm.returnStart || this.getNest(swarm.sourceNestId) || this.getSwarmPosition(swarm);
        const position = this.getSwarmPosition(swarm);
        swarm.trail.coordinates2d = thickLine(source.x, source.y, position.x, position.y, 0.28);
        swarm.trail.node.coordinates2d = swarm.trail.coordinates2d;
        swarm.trail.fill = colorAlpha(color, 80);
        swarm.trail.node.fill = swarm.trail.fill;
        swarm.trail.color = colorAlpha(color, 120);
        swarm.trail.node.color = swarm.trail.color;
        const radius = clamp(0.65 + Math.sqrt(swarm.bugs) * 0.09, 0.8, 1.55);
        for (let index = 0; index < swarm.dots.length; index += 1) {
            const angle = index * Math.PI * 2 / swarm.dots.length + swarm.progress * 8;
            const wave = 0.5 + (index % 3) * 0.18;
            const x = position.x + Math.cos(angle) * radius * wave;
            const y = position.y + Math.sin(angle) * radius * wave;
            const dotRadius = index === 0 ? 0.48 : 0.31;
            const dot = swarm.dots[index];
            dot.coordinates2d = polyCircle(x, y, dotRadius, 8);
            dot.node.coordinates2d = dot.coordinates2d;
            dot.fill = color;
            dot.node.fill = color;
            dot.color = PALETTE.white;
            dot.node.color = PALETTE.white;
        }
        if (swarm.carrying > 0) {
            swarm.cargo.coordinates2d = polyCircle(position.x, position.y - 1.05, 0.42, 8);
            swarm.cargo.node.coordinates2d = swarm.cargo.coordinates2d;
        } else {
            swarm.cargo.coordinates2d = rectangle(0, 0, 0, 0);
            swarm.cargo.node.coordinates2d = swarm.cargo.coordinates2d;
        }
        this.setText(swarm.label, {
            text: `${Math.floor(swarm.bugs)}${swarm.carrying > 0 ? ` +${Math.floor(swarm.carrying)}` : ''}`,
            x: position.x,
            y: position.y + 1.65,
            color
        });
    }

    runAi() {
        let changed = false;
        for (const key of this.factionOrder) {
            const faction = this.factions[key];
            if (!faction || faction.isHuman) continue;
            const nests = this.nests.filter((nest) => nest.ownerKey === key && nest.bugs >= TUNING.AI_MIN_SEND + 4);
            if (!nests.length) continue;
            nests.sort((a, b) => b.bugs - a.bugs);
            const source = nests[0];
            const totalNectar = this.nests.filter((nest) => nest.ownerKey === key).reduce((sum, nest) => sum + nest.nectar, 0);
            const playerLike = { factionKey: key, sendPercent: 0.5, selectedNestId: source.id };
            if (totalNectar < 6 || source.nectar < 2) {
                const food = this.foodPatches
                    .filter((patch) => patch.nectar >= 3)
                    .sort((a, b) => distance(source, a) - distance(source, b))[0];
                if (food) changed = this.launchSwarm(playerLike, source, 'food', food.id) || changed;
                continue;
            }
            const enemies = this.nests
                .filter((nest) => nest.ownerKey !== key)
                .map((nest) => ({ nest, score: nest.bugs * 1.8 + distance(source, nest) - (nest.heart ? 8 : 0) }))
                .sort((a, b) => a.score - b.score);
            if (enemies.length && source.bugs > enemies[0].nest.bugs + 5) {
                playerLike.sendPercent = source.bugs > enemies[0].nest.bugs * 2.4 ? 0.5 : 1;
                changed = this.launchSwarm(playerLike, source, 'nest', enemies[0].nest.id) || changed;
            } else {
                const weak = this.nests
                    .filter((nest) => nest.ownerKey === key && nest.id !== source.id)
                    .sort((a, b) => a.bugs - b.bugs)[0];
                if (weak && weak.bugs < 12) changed = this.launchSwarm(playerLike, source, 'nest', weak.id) || changed;
                else {
                    const food = this.foodPatches
                        .filter((patch) => patch.nectar >= 5)
                        .sort((a, b) => distance(source, a) - distance(source, b))[0];
                    if (food) changed = this.launchSwarm(playerLike, source, 'food', food.id) || changed;
                }
            }
            if (faction.frenzyCooldownTicks <= 0 && this.swarms.filter((swarm) => swarm.active && swarm.ownerKey === key).length >= 3) {
                faction.frenzyTicks = Math.round(TUNING.FRENZY_DURATION_SECONDS * TUNING.TICK_RATE);
                faction.frenzyCooldownTicks = Math.round(TUNING.FRENZY_COOLDOWN_SECONDS * TUNING.TICK_RATE);
                changed = true;
            }
        }
        return changed;
    }

    tickStatuses() {
        let changed = false;
        for (const id of this.playerOrder) {
            const player = this.players[id];
            if (player.statusTicks > 0) {
                player.statusTicks -= 1;
                if (player.statusTicks === 0) {
                    player.statusText = '';
                    changed = true;
                }
            }
        }
        return changed;
    }

    tickTutorials() {
        let changed = false;
        for (const id of this.playerOrder) {
            const player = this.players[id];
            if (!player || !player.tutorialEnabled || player.tutorialStep !== 5 || player.tutorialTicks <= 0) continue;
            player.tutorialTicks -= 1;
            if (player.tutorialTicks === 0) {
                player.tutorialEnabled = false;
                player.tutorialSeen = true;
                this.updateTutorial(player);
                changed = true;
            }
        }
        return changed;
    }

    setStatus(player, text) {
        if (!player || !player.hud) return;
        player.statusText = text;
        player.statusTicks = Math.round(TUNING.STATUS_SECONDS * TUNING.TICK_RATE);
        this.setText(player.hud.status, { text });
    }

    notifyFaction(factionKey, text) {
        const faction = this.factions[factionKey];
        if (!faction || faction.controllerId === null) return;
        const player = this.players[faction.controllerId];
        if (player) this.setStatus(player, text);
    }

    clearSelection(playerId) {
        const player = this.players[playerId];
        if (!player) return;
        player.selectedNestId = null;
        this.updateSelectionRing(player);
        this.base.node.onStateChange();
    }

    updateSelectionRing(player) {
        if (!player.selectionRing) return;
        const nest = player.selectedNestId ? this.getNest(player.selectedNestId) : null;
        if (!nest) {
            player.selectionRing.coordinates2d = rectangle(0, 0, 0, 0);
            player.selectionRing.node.coordinates2d = player.selectionRing.coordinates2d;
            return;
        }
        const faction = this.factions[player.factionKey];
        const color = faction ? faction.color : PALETTE.white;
        player.selectionRing.coordinates2d = polyCircle(nest.x, nest.y, nest.radius + 1.2, 22);
        player.selectionRing.node.coordinates2d = player.selectionRing.coordinates2d;
        player.selectionRing.color = color;
        player.selectionRing.node.color = color;
        player.selectionRing.effects = glow(color, 9);
        player.selectionRing.node.effects = player.selectionRing.effects;
    }

    refreshNestVisuals() {
        for (const nest of this.nests) {
            const faction = nest.ownerKey ? this.factions[nest.ownerKey] : null;
            const color = faction ? faction.color : PALETTE.neutral;
            const dark = faction ? faction.dark : PALETTE.neutralDark;
            nest.shell.fill = dark;
            nest.shell.node.fill = dark;
            nest.shell.color = color;
            nest.shell.node.color = color;
            nest.shell.effects = glow(color, nest.heart ? 12 : 7);
            nest.shell.node.effects = nest.shell.effects;
            nest.inner.fill = colorAlpha(color, 80);
            nest.inner.node.fill = nest.inner.fill;
            nest.inner.color = color;
            nest.inner.node.color = color;
            this.setText(nest.bugText, {
                text: `${Math.floor(nest.bugs)}`,
                color: PALETTE.white
            });
            this.setText(nest.nectarText, {
                text: nest.ownerKey ? `NECTAR ${Math.floor(nest.nectar)}` : '',
                color: nest.ownerKey ? PALETTE.nectar : PALETTE.muted
            });
            this.setText(nest.queenMark, {
                text: nest.heart ? 'THE WELL' : nest.queen && nest.ownerKey ? 'QUEEN' : '',
                color: nest.heart ? PALETTE.nectar : color
            });
        }
    }

    refreshFoodVisuals() {
        for (const patch of this.foodPatches) {
            const ratio = patch.maxNectar > 0 ? patch.nectar / patch.maxNectar : 0;
            patch.petals.forEach((petal, index) => {
                const alpha = Math.floor(70 + ratio * 185 - index * 5);
                petal.fill = colorAlpha(PALETTE.nectarDark, alpha);
                petal.node.fill = petal.fill;
                petal.color = colorAlpha(PALETTE.nectar, Math.floor(80 + ratio * 175));
                petal.node.color = petal.color;
            });
            this.setText(patch.label, {
                text: `${Math.floor(patch.nectar)}`,
                color: ratio > 0.2 ? PALETTE.nectar : PALETTE.muted
            });
        }
    }

    refreshHud() {
        for (const id of this.playerOrder) {
            const player = this.players[id];
            if (!player.hud || !player.factionKey) continue;
            const faction = this.factions[player.factionKey];
            const owned = this.nests.filter((nest) => nest.ownerKey === faction.key);
            const bugs = owned.reduce((sum, nest) => sum + nest.bugs, 0) + this.swarms.filter((swarm) => swarm.active && swarm.ownerKey === faction.key).reduce((sum, swarm) => sum + swarm.bugs, 0);
            const nectar = owned.reduce((sum, nest) => sum + nest.nectar, 0);
            this.setText(player.hud.title, {
                text: `YOUR COLONY  •  ${owned.length} NEST${owned.length === 1 ? '' : 'S'}`,
                color: faction.color
            });
            this.setText(player.hud.economy, {
                text: `${Math.floor(bugs)} BUGS  •  ${Math.floor(nectar)} NECTAR`
            });
            this.setText(player.hud.status, {
                text: player.statusText || (player.selectedNestId ? 'Flower: gather food  /  Nest: conquer' : 'Tap your glowing nest to send a swarm')
            });
            player.hud.percentButtons.forEach((button, index) => {
                const percent = [0.25, 0.5, 1][index];
                const selected = player.sendPercent === percent;
                button.fill = selected ? faction.dark : PALETTE.panelAlt;
                button.node.fill = button.fill;
                button.color = selected ? faction.color : PALETTE.lineBright;
                button.node.color = button.color;
            });
            const remaining = Math.ceil(faction.frenzyCooldownTicks / TUNING.TICK_RATE);
            const active = faction.frenzyTicks > 0;
            player.hud.frenzyButton.fill = active ? faction.dark : PALETTE.panelAlt;
            player.hud.frenzyButton.node.fill = player.hud.frenzyButton.fill;
            player.hud.frenzyButton.color = active ? faction.color : remaining > 0 ? PALETTE.muted : PALETTE.nectar;
            player.hud.frenzyButton.node.color = player.hud.frenzyButton.color;
            if (player.hud.frenzyButton.labelNode) {
                this.setText(player.hud.frenzyButton.labelNode, {
                    text: active ? 'FRENZY!' : remaining > 0 ? `FRENZY ${remaining}` : 'FRENZY'
                });
            }
            this.updateSelectionRing(player);
            this.updateTutorial(player);
        }
    }

    checkWinner() {
        const alive = this.factionOrder.filter((key) => {
            const ownsNest = this.nests.some((nest) => nest.ownerKey === key);
            const hasSwarm = this.swarms.some((swarm) => swarm.active && swarm.ownerKey === key);
            return ownsNest || hasSwarm;
        });
        if (alive.length !== 1) return false;
        this.winnerKey = alive[0];
        this.endGame();
        return true;
    }

    endGame() {
        this.phase = 'gameover';
        this.hudLayer.clearChildren();
        this.overlayLayer.clearChildren();
        const winner = this.factions[this.winnerKey];
        this.overlayLayer.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(14, 28, 72, 40),
            fill: PALETTE.panel,
            color: winner ? winner.color : PALETTE.white,
            border: 4
        }));
        this.overlayLayer.addChild(this.makeText('THE SWARM PREVAILS', 50, 36, 2.1, PALETTE.white));
        this.overlayLayer.addChild(this.makeText(winner ? winner.name.toUpperCase() : 'UNKNOWN COLONY', 50, 44, 3.6, winner ? winner.color : PALETTE.white));
        this.overlayLayer.addChild(this.makeText(`TIME ${this.formatTime(this.elapsedTicks / TUNING.TICK_RATE)}`, 50, 51, 1.2, PALETTE.muted));
        this.overlayLayer.addChild(this.makeButton({
            x: 22, y: 57, width: 25, height: 8, label: 'REPLAY', fill: winner ? winner.dark : PALETTE.panelAlt,
            color: winner ? winner.color : PALETTE.white, onClick: () => this.startGame(), size: 1.35
        }));
        this.overlayLayer.addChild(this.makeButton({
            x: 53, y: 57, width: 25, height: 8, label: 'WORLD SELECT', fill: PALETTE.panelAlt,
            color: PALETTE.lineBright, onClick: () => this.renderLobby(), size: 1.25
        }));
        for (const id of this.playerOrder) this.buildGameOverHud(this.players[id]);
        this.base.node.onStateChange();
    }

    renderGameOver() {
        if (this.phase !== 'gameover') return;
        this.endGame();
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainder = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${minutes}:${remainder}`;
    }

    findNearestNest(x, y, radius) {
        let best = null;
        let bestDistance = radius;
        for (const nest of this.nests) {
            const value = distance({ x, y }, nest);
            if (value <= bestDistance) {
                best = nest;
                bestDistance = value;
            }
        }
        return best;
    }

    findNearestFood(x, y, radius) {
        let best = null;
        let bestDistance = radius;
        for (const patch of this.foodPatches) {
            const value = distance({ x, y }, patch);
            if (value <= bestDistance) {
                best = patch;
                bestDistance = value;
            }
        }
        return best;
    }

    findNearestOwnedNest(ownerKey, position) {
        return this.nests
            .filter((nest) => nest.ownerKey === ownerKey)
            .sort((a, b) => distance(position, a) - distance(position, b))[0] || null;
    }

    getNest(id) {
        return this.nests.find((nest) => nest.id === id) || null;
    }

    getFood(id) {
        return this.foodPatches.find((patch) => patch.id === id) || null;
    }

    nestLabel(nest) {
        if (nest.heart) return 'THE WELL';
        if (nest.queen) return 'QUEEN NEST';
        return 'BROOD NEST';
    }

    clearSwarms() {
        for (const swarm of this.swarms) this.deactivateSwarm(swarm);
    }
}

Swarmwell.WORLDS = GENERATED_WORLDS;
Swarmwell.TUNING = TUNING;

module.exports = Swarmwell;
