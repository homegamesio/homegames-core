
'use strict';

const { Game, ViewableGame, GameNode, Shapes, ShapeUtils } = require('squish-150');

const PulsefrontClassic = (() => {
const TUNING = {
    TICK_RATE: 60,
    MAX_PLAYERS: 6,
    MAX_FLEETS: 48,
    STARTING_ENERGY: 34,
    MAX_CORE_ENERGY: 99,
    BASE_PRODUCTION_PER_SECOND: 0.9,
    LINK_BONUS_PER_NEIGHBOR: 0.1,
    MAX_LINK_BONUS: 0.3,
    FLEET_SPEED_PER_SECOND: 11,
    AI_DECISION_SECONDS: 1.2,
    AI_MIN_SEND: 8,
    MAP_TAP_RADIUS: 7.5,
    WIN_CHECK_TICKS: 60,
    STATUS_SECONDS: 1.8
};

const PALETTE = {
    background: [5, 8, 18, 255],
    backgroundAlt: [10, 15, 30, 255],
    grid: [20, 31, 55, 255],
    line: [31, 45, 70, 255],
    lineBright: [74, 93, 126, 255],
    neutral: [113, 127, 153, 255],
    neutralDark: [43, 51, 70, 255],
    white: [244, 248, 255, 255],
    muted: [153, 166, 190, 255],
    panel: [14, 21, 39, 255],
    panelAlt: [24, 34, 57, 255],
    danger: [255, 76, 103, 255],
    transparent: [0, 0, 0, 0]
};

const FACTION_COLORS = [
    { name: 'CYAN', color: [61, 224, 255, 255], dark: [17, 99, 120, 255] },
    { name: 'MAGENTA', color: [255, 82, 191, 255], dark: [119, 27, 86, 255] },
    { name: 'GOLD', color: [255, 205, 65, 255], dark: [121, 83, 18, 255] },
    { name: 'LIME', color: [135, 238, 80, 255], dark: [48, 110, 31, 255] },
    { name: 'VIOLET', color: [174, 117, 255, 255], dark: [76, 42, 125, 255] },
    { name: 'ORANGE', color: [255, 137, 62, 255], dark: [126, 57, 20, 255] }
];

const MAP_CENTER = { x: 50, y: 47 };

function rounded(value) {
    return Math.round(value * 10) / 10;
}

function makeCoreSpec(id, x, y, neutralEnergy, options = {}) {
    return {
        id,
        x: rounded(x),
        y: rounded(y),
        neutralEnergy,
        radius: options.radius || 3.7,
        strategicValue: options.strategicValue || 0
    };
}

function makeRing(prefix, count, radiusX, radiusY, rotationDegrees, neutralEnergy, options = {}) {
    const cores = [];
    for (let index = 0; index < count; index += 1) {
        const angle = (rotationDegrees + index * 360 / count) * Math.PI / 180;
        cores.push(makeCoreSpec(
            `${prefix}${index}`,
            MAP_CENTER.x + Math.cos(angle) * radiusX,
            MAP_CENTER.y + Math.sin(angle) * radiusY,
            typeof neutralEnergy === 'function' ? neutralEnergy(index) : neutralEnergy,
            options
        ));
    }
    return cores;
}

function linkKey(aId, bId) {
    return aId < bId ? `${aId}|${bId}` : `${bId}|${aId}`;
}

function finalizeMap(config) {
    const links = [];
    const seen = {};
    const blocked = {};
    for (const pair of config.blockedLinks || []) blocked[linkKey(pair[0], pair[1])] = true;

    if (config.linkDistance) {
        for (let left = 0; left < config.cores.length; left += 1) {
            for (let right = left + 1; right < config.cores.length; right += 1) {
                const a = config.cores[left];
                const b = config.cores[right];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                if (Math.sqrt(dx * dx + dy * dy) <= config.linkDistance) {
                    const key = linkKey(a.id, b.id);
                    if (!blocked[key]) {
                        seen[key] = true;
                        links.push([a.id, b.id]);
                    }
                }
            }
        }
    }

    for (const pair of config.extraLinks || []) {
        const key = linkKey(pair[0], pair[1]);
        if (!seen[key] && !blocked[key]) {
            seen[key] = true;
            links.push(pair);
        }
    }

    return {
        id: config.id,
        name: config.name,
        tagline: config.tagline,
        description: config.description,
        cores: config.cores,
        links,
        spawnCoreIds: config.spawnCoreIds,
        recommendedPlayers: config.recommendedPlayers || '1–6'
    };
}

function makeRadialMap(config) {
    const rings = [];
    const cores = [];
    for (const ring of config.rings) {
        const generated = makeRing(
            ring.prefix,
            ring.count || 6,
            ring.radiusX,
            ring.radiusY,
            ring.rotation,
            ring.energy,
            { radius: ring.coreRadius, strategicValue: ring.strategicValue }
        );
        rings.push(generated);
        cores.push(...generated);
    }
    if (config.center) {
        cores.push(makeCoreSpec(
            config.center.id || 'center',
            MAP_CENTER.x,
            MAP_CENTER.y,
            config.center.energy,
            { radius: config.center.coreRadius || 4.7, strategicValue: config.center.strategicValue || 0 }
        ));
    }
    return finalizeMap({
        ...config,
        cores,
        spawnCoreIds: rings[config.spawnRing || 0].map((core) => core.id)
    });
}

const MAPS = [
    makeRadialMap({
        id: 'crown',
        name: 'THE CROWN',
        tagline: 'Balanced. Open. Ruthless.',
        description: 'The original tournament map. Six equal approaches surround a valuable center.',
        recommendedPlayers: '1–6',
        linkDistance: 25.5,
        spawnRing: 0,
        rings: [
            { prefix: 'o', radiusX: 38, radiusY: 35, rotation: -90, energy: (index) => 21 + (index % 3) * 3, coreRadius: 4.2 },
            { prefix: 'i', radiusX: 19, radiusY: 17.5, rotation: -90, energy: (index) => 13 + (index % 2) * 3, coreRadius: 3.7 }
        ],
        center: { energy: 28, coreRadius: 4.8, strategicValue: 8 }
    }),
    finalizeMap({
        id: 'twin-suns',
        name: 'TWIN SUNS',
        tagline: 'Two prizes. No safe side.',
        description: 'Two powerful central cores create a permanent choice between splitting forces and committing hard.',
        recommendedPlayers: '2–6',
        linkDistance: 23,
        spawnCoreIds: ['s0', 's1', 's2', 's3', 's4', 's5'],
        cores: [
            makeCoreSpec('s0', 50, 11, 23, { radius: 4.2 }),
            makeCoreSpec('s1', 84, 28, 23, { radius: 4.2 }),
            makeCoreSpec('s2', 84, 66, 23, { radius: 4.2 }),
            makeCoreSpec('s3', 50, 83, 23, { radius: 4.2 }),
            makeCoreSpec('s4', 16, 66, 23, { radius: 4.2 }),
            makeCoreSpec('s5', 16, 28, 23, { radius: 4.2 }),
            makeCoreSpec('sunA', 40.5, 47, 34, { radius: 4.8, strategicValue: 10 }),
            makeCoreSpec('sunB', 59.5, 47, 34, { radius: 4.8, strategicValue: 10 }),
            makeCoreSpec('n0', 34, 31, 15),
            makeCoreSpec('n1', 66, 31, 15),
            makeCoreSpec('n2', 34, 63, 15),
            makeCoreSpec('n3', 66, 63, 15),
            makeCoreSpec('n4', 50, 29, 18),
            makeCoreSpec('n5', 50, 65, 18)
        ]
    }),
    finalizeMap({
        id: 'the-bridge',
        name: 'THE BRIDGE',
        tagline: 'Own the crossing or go around.',
        description: 'Two dense territories are joined by a narrow diagonal crossing. Long attacks remain possible, but reinforcement is costly.',
        recommendedPlayers: '2–6',
        linkDistance: 20.5,
        spawnCoreIds: ['s0', 's1', 's2', 's3', 's4', 's5'],
        cores: [
            makeCoreSpec('s0', 11, 17, 22, { radius: 4.1 }),
            makeCoreSpec('s1', 11, 47, 22, { radius: 4.1 }),
            makeCoreSpec('s2', 11, 77, 22, { radius: 4.1 }),
            makeCoreSpec('s3', 89, 17, 22, { radius: 4.1 }),
            makeCoreSpec('s4', 89, 47, 22, { radius: 4.1 }),
            makeCoreSpec('s5', 89, 77, 22, { radius: 4.1 }),
            makeCoreSpec('l0', 27, 20, 14),
            makeCoreSpec('l1', 27, 47, 17),
            makeCoreSpec('l2', 27, 74, 14),
            makeCoreSpec('r0', 73, 20, 14),
            makeCoreSpec('r1', 73, 47, 17),
            makeCoreSpec('r2', 73, 74, 14),
            makeCoreSpec('b0', 40, 31, 18),
            makeCoreSpec('b1', 50, 47, 30, { radius: 4.5, strategicValue: 9 }),
            makeCoreSpec('b2', 60, 63, 18),
            makeCoreSpec('b3', 40, 63, 18),
            makeCoreSpec('b4', 60, 31, 18)
        ],
        extraLinks: [['b0', 'b1'], ['b1', 'b2'], ['b3', 'b1'], ['b1', 'b4'], ['l1', 'b0'], ['l1', 'b3'], ['r1', 'b4'], ['r1', 'b2']]
    }),
    finalizeMap({
        id: 'triad',
        name: 'TRIAD',
        tagline: 'Three fronts. Six starting points.',
        description: 'Three lobes pull the battle apart before the inner triangle forces everyone back together.',
        recommendedPlayers: '3 or 6',
        linkDistance: 22,
        spawnCoreIds: ['s0', 's1', 's2', 's3', 's4', 's5'],
        cores: [
            makeCoreSpec('s0', 39, 12, 22, { radius: 4.1 }),
            makeCoreSpec('s1', 61, 12, 22, { radius: 4.1 }),
            makeCoreSpec('s2', 87, 62, 22, { radius: 4.1 }),
            makeCoreSpec('s3', 75, 81, 22, { radius: 4.1 }),
            makeCoreSpec('s4', 25, 81, 22, { radius: 4.1 }),
            makeCoreSpec('s5', 13, 62, 22, { radius: 4.1 }),
            makeCoreSpec('h0', 50, 27, 18, { radius: 4 }),
            makeCoreSpec('h1', 69, 64, 18, { radius: 4 }),
            makeCoreSpec('h2', 31, 64, 18, { radius: 4 }),
            makeCoreSpec('i0', 50, 39, 14),
            makeCoreSpec('i1', 61, 58, 14),
            makeCoreSpec('i2', 39, 58, 14),
            makeCoreSpec('center', 50, 53, 27, { radius: 4.6, strategicValue: 8 })
        ],
        blockedLinks: [['s0', 's1']]
    }),
    makeRadialMap({
        id: 'spiral',
        name: 'SPIRAL',
        tagline: 'Every route bends inward.',
        description: 'Offset rings create fast attacks along six curling lanes and awkward cross-map reinforcement.',
        recommendedPlayers: '1–6',
        linkDistance: 21,
        spawnRing: 0,
        rings: [
            { prefix: 's', radiusX: 38, radiusY: 35, rotation: -90, energy: 22, coreRadius: 4.1 },
            { prefix: 'm', radiusX: 27, radiusY: 25, rotation: -70, energy: 16, coreRadius: 3.7 },
            { prefix: 'i', radiusX: 15, radiusY: 14, rotation: -50, energy: 13, coreRadius: 3.5 }
        ],
        center: { energy: 30, coreRadius: 4.7, strategicValue: 9 }
    }),
    finalizeMap({
        id: 'crossroads',
        name: 'CROSSROADS',
        tagline: 'The middle belongs to nobody.',
        description: 'Six gates feed four central junctions. Holding one route is easy; holding the whole center is not.',
        recommendedPlayers: '2–6',
        linkDistance: 22,
        spawnCoreIds: ['s0', 's1', 's2', 's3', 's4', 's5'],
        cores: [
            ...makeRing('s', 6, 38, 35, -90, 22, { radius: 4.1 }),
            ...makeRing('g', 6, 25, 23, -90, 15, { radius: 3.7 }),
            makeCoreSpec('north', 50, 34, 17),
            makeCoreSpec('east', 63, 47, 17),
            makeCoreSpec('south', 50, 60, 17),
            makeCoreSpec('west', 37, 47, 17),
            makeCoreSpec('center', 50, 47, 31, { radius: 4.8, strategicValue: 10 })
        ],
        blockedLinks: [['s0', 'north'], ['s3', 'south']]
    }),
    finalizeMap({
        id: 'archipelago',
        name: 'ARCHIPELAGO',
        tagline: 'Small islands. Long wars.',
        description: 'Each starting core has a nearby island, while a neutral central triangle rewards players willing to travel.',
        recommendedPlayers: '2–6',
        linkDistance: 20.5,
        spawnCoreIds: ['s0', 's1', 's2', 's3', 's4', 's5'],
        cores: [
            ...makeRing('s', 6, 38, 35, -90, 22, { radius: 4.1 }),
            ...makeRing('a', 6, 26, 24, -90, 12, { radius: 3.6 }),
            ...makeRing('c', 3, 10, 9, -90, 20, { radius: 3.9, strategicValue: 4 })
        ],
        extraLinks: [['a0', 'c0'], ['a1', 'c0'], ['a2', 'c1'], ['a3', 'c1'], ['a4', 'c2'], ['a5', 'c2']]
    }),
    makeRadialMap({
        id: 'fortress',
        name: 'FORTRESS',
        tagline: 'Break the walls. Claim the heart.',
        description: 'Three defensive rings protect the richest core in the game. Expansion is safe; conquest is expensive.',
        recommendedPlayers: '3–6',
        linkDistance: 20.5,
        spawnRing: 0,
        rings: [
            { prefix: 's', radiusX: 38, radiusY: 35, rotation: -90, energy: 22, coreRadius: 4.1 },
            { prefix: 'r', radiusX: 27, radiusY: 25, rotation: -90, energy: 19, coreRadius: 3.8 },
            { prefix: 'i', radiusX: 16, radiusY: 15, rotation: -60, energy: 24, coreRadius: 3.9, strategicValue: 3 }
        ],
        center: { energy: 42, coreRadius: 5, strategicValue: 14 }
    })
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
        const angle = (index / sides) * Math.PI * 2;
        points.push([
            cx + Math.cos(angle) * radius,
            cy + Math.sin(angle) * radius
        ]);
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

function glow(color, blur) {
    return {
        shadow: {
            color: [color[0], color[1], color[2], 255],
            blur
        }
    };
}

function lerp(start, end, amount) {
    return start + (end - start) * amount;
}

function colorWithAlpha(color, alpha) {
    return [color[0], color[1], color[2], alpha];
}

class PulsefrontClassic extends Game {

    constructor() {
        super();

        this.phase = 'lobby';
        this.players = {};
        this.playerOrder = [];
        this.factions = {};
        this.factionOrder = [];
        this.cores = [];
        this.edges = [];
        this.fleets = [];
        this.nextFleetId = 1;
        this.aiClock = 0;
        this.winClock = 0;
        this.elapsedTicks = 0;
        this.winnerKey = null;
        this.selectedMapIndex = 0;
        this.currentMap = null;

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 0, 100, 100),
            fill: PALETTE.background,
            color: PALETTE.white
        });

        this.starLayer = this.makeContainer();
        this.connectionLayer = this.makeContainer();
        this.coreLayer = this.makeContainer();
        this.fleetLayer = this.makeContainer();
        this.privateWorldLayer = this.makeContainer();
        this.tapCatcher = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 7, 100, 80),
            fill: PALETTE.transparent,
            color: PALETTE.white,
            onClick: (playerId, x, y) => this.handleMapTap(Number(playerId), x, y)
        });
        this.hudLayer = this.makeContainer();
        this.overlayLayer = this.makeContainer();

        this.base.addChildren(
            this.starLayer,
            this.connectionLayer,
            this.coreLayer,
            this.fleetLayer,
            this.privateWorldLayer,
            this.tapCatcher,
            this.hudLayer,
            this.overlayLayer
        );

        this.buildStarfield();
        this.buildFleetPool();
        this.renderLobby();
    }

    getLayers() {
        return [{ root: this.base }];
    }

    canAddPlayer() {
        return this.playerOrder.length < TUNING.MAX_PLAYERS;
    }

    handleNewPlayer({ playerId, info }) {
        const id = Number(playerId);
        if (this.players[id]) return;

        const player = {
            id,
            name: info && info.name ? String(info.name).slice(0, 16) : `PLAYER ${id}`,
            factionKey: null,
            sendPercent: 0.5,
            selectedCoreId: null,
            statusText: '',
            statusTicks: 0,
            privacyAnchor: null,
            selectionRing: null,
            hudContainer: null,
            hud: null,
            spectator: this.phase === 'running'
        };

        this.players[id] = player;
        this.playerOrder.push(id);
        this.createPrivacyAnchor(player);

        if (this.phase === 'lobby') {
            this.renderLobby();
        } else if (this.phase === 'running') {
            this.buildSpectatorHud(player);
            this.setPlayerStatus(player, 'SPECTATING — JOIN NEXT MATCH');
        } else {
            this.buildGameOverHud(player);
        }
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
            faction.ai = this.makeAiState(this.factionOrder.indexOf(faction.key));
        }

        if (player.privacyAnchor) this.privateWorldLayer.removeChild(player.privacyAnchor.id);
        if (player.selectionRing) this.privateWorldLayer.removeChild(player.selectionRing.id);
        if (player.hudContainer) this.hudLayer.removeChild(player.hudContainer.id);

        delete this.players[id];
        this.playerOrder = this.playerOrder.filter((value) => value !== id);

        if (this.phase === 'lobby') {
            this.renderLobby();
        } else if (this.phase === 'running') {
            this.refreshScoreboard(true);
        } else {
            this.renderGameOver();
        }
    }

    handleKeyDown(playerId, key) {
        const id = Number(playerId);
        if ((key === 'Enter' || key === ' ') && (this.phase === 'lobby' || this.phase === 'gameover')) {
            this.startGame(id);
        }
        if (key === 'Escape' && this.phase === 'running') {
            this.clearSelection(id);
        }
    }

    tick() {
        if (this.phase !== 'running') return;

        let changed = false;
        this.elapsedTicks += 1;

        changed = this.tickProduction() || changed;
        changed = this.tickFleets() || changed;
        changed = this.tickPlayerStatuses() || changed;

        this.aiClock += 1;
        if (this.aiClock >= Math.round(TUNING.AI_DECISION_SECONDS * TUNING.TICK_RATE)) {
            this.aiClock = 0;
            changed = this.runAiTurn() || changed;
        }

        this.winClock += 1;
        if (this.winClock >= TUNING.WIN_CHECK_TICKS) {
            this.winClock = 0;
            if (this.checkForWinner()) return;
        }

        if (changed) {
            this.refreshCoreVisuals(false);
            this.refreshConnections(false);
            this.refreshScoreboard(false);
            this.base.node.onStateChange();
        }
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
            textInfo: {
                text,
                x,
                y,
                size,
                align,
                color,
                font: 'monospace'
            },
            playerIds
        });
    }

    makeButton({ x, y, width, height, label, fill, color, playerIds, onClick, size = 2.1 }) {
        const button = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(x, y, width, height),
            fill,
            color: color || PALETTE.white,
            border: 3,
            playerIds,
            onClick
        });
        button.addChild(this.makeText(
            label,
            x + width / 2,
            y + height / 2 - size * 0.45,
            size,
            PALETTE.white,
            'center',
            playerIds
        ));
        return button;
    }

    buildStarfield() {
        this.starLayer.clearChildren();
        const stars = [
            [7, 11, 0.14], [14, 48, 0.09], [24, 17, 0.12], [31, 82, 0.11],
            [38, 7, 0.08], [46, 22, 0.1], [57, 8, 0.13], [64, 84, 0.09],
            [72, 18, 0.12], [79, 52, 0.08], [91, 13, 0.1], [94, 73, 0.12],
            [8, 79, 0.08], [19, 91, 0.13], [84, 90, 0.09], [55, 94, 0.1],
            [3, 35, 0.08], [97, 42, 0.1], [42, 76, 0.07], [69, 73, 0.08]
        ];
        for (const [x, y, radius] of stars) {
            this.starLayer.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: polyCircle(x, y, radius, 8),
                fill: [117, 156, 210, 255],
                color: [255, 255, 255, 180]
            }));
        }
    }

    buildFleetPool() {
        this.fleetLayer.clearChildren();
        this.fleets = [];

        for (let index = 0; index < TUNING.MAX_FLEETS; index += 1) {
            const group = this.makeContainer([0]);
            const trail = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: PALETTE.white,
                color: PALETTE.white
            });
            const orb = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: PALETTE.white,
                color: PALETTE.white,
                effects: glow(PALETTE.white, 12)
            });
            const label = this.makeText('', 0, 0, 1.2, PALETTE.white);
            group.addChildren(trail, orb, label);
            this.fleetLayer.addChild(group);

            this.fleets.push({
                active: false,
                slot: index,
                id: null,
                ownerKey: null,
                sourceId: null,
                destinationId: null,
                amount: 0,
                progress: 0,
                durationTicks: 1,
                group,
                trail,
                orb,
                label
            });
        }
    }

    createPrivacyAnchor(player) {
        const anchor = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 0, 0, 0),
            fill: PALETTE.transparent,
            color: PALETTE.white,
            playerIds: [player.id]
        });
        player.privacyAnchor = anchor;
        this.privateWorldLayer.addChild(anchor);
    }

    renderLobby() {
        this.phase = 'lobby';
        this.currentMap = null;
        this.connectionLayer.clearChildren();
        this.coreLayer.clearChildren();
        this.clearActiveFleets();
        this.hudLayer.clearChildren();
        this.overlayLayer.clearChildren();

        for (const playerId of this.playerOrder) {
            const player = this.players[playerId];
            player.factionKey = null;
            player.selectedCoreId = null;
            player.spectator = false;
            player.hudContainer = null;
            player.hud = null;
            if (!player.privacyAnchor) this.createPrivacyAnchor(player);
        }

        const map = MAPS[this.selectedMapIndex];
        this.overlayLayer.addChild(this.makeText('CHOOSE A BATTLEFIELD', 50, 18, 1.55, PALETTE.white));

        this.overlayLayer.addChild(this.makeButton({
            x: 8,
            y: 38,
            width: 10,
            height: 10,
            label: '<',
            fill: PALETTE.panelAlt,
            color: PALETTE.lineBright,
            onClick: () => this.cycleMap(-1),
            size: 2.4
        }));
        this.overlayLayer.addChild(this.makeButton({
            x: 82,
            y: 38,
            width: 10,
            height: 10,
            label: '>',
            fill: PALETTE.panelAlt,
            color: PALETTE.lineBright,
            onClick: () => this.cycleMap(1),
            size: 2.4
        }));

        this.renderLobbyMapPreview(map);
        this.overlayLayer.addChild(this.makeText(map.name, 50, 24, 2.5, FACTION_COLORS[0].color));
        this.overlayLayer.addChild(this.makeText(map.tagline.toUpperCase(), 50, 28.5, 1.15, PALETTE.muted));
        this.overlayLayer.addChild(this.makeText(
            `${this.selectedMapIndex + 1} / ${MAPS.length}   •   ${map.cores.length} CORES   •   ${map.recommendedPlayers} PLAYERS`,
            50,
            33,
            1,
            PALETTE.muted
        ));

        const count = this.playerOrder.length;
        this.overlayLayer.addChild(this.makeText(
            `${count} PLAYER${count === 1 ? '' : 'S'} CONNECTED`,
            50,
            73,
            1.45,
            count > 0 ? FACTION_COLORS[0].color : PALETTE.muted
        ));

        this.overlayLayer.addChild(this.makeButton({
            x: 31,
            y: 77,
            width: 38,
            height: 9,
            label: count > 0 ? 'START CONQUEST' : 'WAITING FOR PLAYER',
            fill: count > 0 ? FACTION_COLORS[0].dark : PALETTE.panelAlt,
            color: count > 0 ? FACTION_COLORS[0].color : PALETTE.muted,
            onClick: (playerId) => this.startGame(Number(playerId)),
            size: 1.8
        }));
        this.overlayLayer.addChild(this.makeText(
            count === 1 ? 'SOLO ADDS TWO AI RIVALS' : 'FREE-FOR-ALL',
            50,
            89,
            1.05,
            PALETTE.muted
        ));
    }

    cycleMap(direction) {
        if (this.phase !== 'lobby') return;
        this.selectedMapIndex = (this.selectedMapIndex + direction + MAPS.length) % MAPS.length;
        this.renderLobby();
        this.base.node.onStateChange();
    }

    renderLobbyMapPreview(map) {
        const minX = Math.min(...map.cores.map((core) => core.x));
        const maxX = Math.max(...map.cores.map((core) => core.x));
        const minY = Math.min(...map.cores.map((core) => core.y));
        const maxY = Math.max(...map.cores.map((core) => core.y));
        const scale = Math.min(45 / Math.max(1, maxX - minX), 28 / Math.max(1, maxY - minY));
        const convert = (core) => ({
            x: 50 + (core.x - (minX + maxX) / 2) * scale,
            y: 51 + (core.y - (minY + maxY) / 2) * scale
        });
        const byId = {};
        for (const core of map.cores) byId[core.id] = core;

        for (const pair of map.links) {
            const a = convert(byId[pair[0]]);
            const b = convert(byId[pair[1]]);
            this.overlayLayer.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: thickLine(a.x, a.y, b.x, b.y, 0.28),
                fill: PALETTE.line,
                color: PALETTE.white
            }));
        }
        for (const core of map.cores) {
            const point = convert(core);
            const spawn = map.spawnCoreIds.includes(core.id);
            this.overlayLayer.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: polyCircle(point.x, point.y, spawn ? 1.25 : 0.85, 12),
                fill: spawn ? FACTION_COLORS[0].dark : PALETTE.neutralDark,
                color: spawn ? FACTION_COLORS[0].color : PALETTE.neutral,
                effects: spawn ? glow(FACTION_COLORS[0].color, 5) : null
            }));
        }
    }

    startGame(requestingPlayerId) {
        if (!this.players[requestingPlayerId] || this.playerOrder.length === 0) return;

        this.phase = 'running';
        this.elapsedTicks = 0;
        this.aiClock = 0;
        this.winClock = 0;
        this.winnerKey = null;
        this.currentMap = MAPS[this.selectedMapIndex];
        this.factions = {};
        this.factionOrder = [];
        this.cores = [];
        this.edges = [];
        this.nextFleetId = 1;

        this.connectionLayer.clearChildren();
        this.coreLayer.clearChildren();
        this.hudLayer.clearChildren();
        this.overlayLayer.clearChildren();
        this.clearActiveFleets();

        const humans = this.playerOrder.map((id) => this.players[id]);
        for (let index = 0; index < humans.length; index += 1) {
            const player = humans[index];
            const key = `p${player.id}`;
            this.factions[key] = {
                key,
                name: player.name,
                colorName: FACTION_COLORS[index].name,
                color: FACTION_COLORS[index].color,
                dark: FACTION_COLORS[index].dark,
                isHuman: true,
                controllerId: player.id,
                ai: null,
                scoreboard: null
            };
            this.factionOrder.push(key);
            player.factionKey = key;
            player.sendPercent = 0.5;
            player.selectedCoreId = null;
            player.spectator = false;
            player.cameraInput = { left: false, right: false, up: false, down: false };
        }

        if (humans.length === 1) {
            for (let aiIndex = 0; aiIndex < 2; aiIndex += 1) {
                const colorIndex = humans.length + aiIndex;
                const key = `ai${aiIndex + 1}`;
                this.factions[key] = {
                    key,
                    name: aiIndex === 0 ? 'VECTOR' : 'EMBER',
                    colorName: FACTION_COLORS[colorIndex].name,
                    color: FACTION_COLORS[colorIndex].color,
                    dark: FACTION_COLORS[colorIndex].dark,
                    isHuman: false,
                    controllerId: null,
                    ai: this.makeAiState(aiIndex),
                    scoreboard: null
                };
                this.factionOrder.push(key);
            }
        }

        this.buildMap();
        this.buildScoreboard();
        this.buildHumanHuds();
        this.refreshEverything(true);
    }

    makeAiState(index) {
        return {
            personality: index % 3,
            aggression: [0.9, 1.08, 1.22][index % 3],
            reserve: [0.44, 0.36, 0.28][index % 3]
        };
    }

    buildMap() {
        const map = this.currentMap || MAPS[this.selectedMapIndex];
        const spawnIds = this.chooseSpawnCoreIds(map, this.factionOrder.length);
        const spawnOwners = {};
        for (let index = 0; index < spawnIds.length; index += 1) {
            spawnOwners[spawnIds[index]] = this.factionOrder[index];
        }

        for (const point of map.cores) {
            const ownerKey = spawnOwners[point.id] || null;
            const core = {
                id: point.id,
                x: point.x,
                y: point.y,
                radius: point.radius || 3.7,
                ownerKey,
                energy: ownerKey ? TUNING.STARTING_ENERGY : point.neutralEnergy,
                neutralEnergy: point.neutralEnergy,
                strategicValue: point.strategicValue || 0,
                productionAccumulator: 0,
                sameOwnerNeighbors: 0,
                visual: null
            };
            this.cores.push(core);
        }

        const byId = {};
        for (const core of this.cores) byId[core.id] = core;
        for (const pair of map.links) {
            const a = byId[pair[0]];
            const b = byId[pair[1]];
            if (!a || !b) continue;
            const line = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: thickLine(a.x, a.y, b.x, b.y, 0.5),
                fill: PALETTE.line,
                color: PALETTE.white
            });
            this.connectionLayer.addChild(line);
            this.edges.push({ aId: a.id, bId: b.id, line });
        }

        for (const core of this.cores) {
            core.visual = this.buildCoreVisual(core);
            this.coreLayer.addChild(core.visual.group);
        }
    }

    chooseSpawnCoreIds(map, count) {
        const candidates = map.spawnCoreIds.map((id) => map.cores.find((core) => core.id === id));
        if (count >= candidates.length) return candidates.slice(0, count).map((core) => core.id);

        let best = null;
        const choose = (start, selected) => {
            if (selected.length === count) {
                let minimumDistance = Infinity;
                let totalDistance = 0;
                for (let left = 0; left < selected.length; left += 1) {
                    for (let right = left + 1; right < selected.length; right += 1) {
                        const current = distance(selected[left], selected[right]);
                        minimumDistance = Math.min(minimumDistance, current);
                        totalDistance += current;
                    }
                }
                const score = minimumDistance * 1000 + totalDistance;
                if (!best || score > best.score) best = { score, selected: selected.slice() };
                return;
            }
            for (let index = start; index <= candidates.length - (count - selected.length); index += 1) {
                selected.push(candidates[index]);
                choose(index + 1, selected);
                selected.pop();
            }
        };
        choose(0, []);
        return best.selected.map((core) => core.id);
    }

    buildCoreVisual(core) {
        const group = this.makeContainer();
        const outer = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: polyCircle(core.x, core.y, core.radius + 1.15, 22),
            fill: PALETTE.neutralDark,
            color: PALETTE.white
        });
        const body = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: polyCircle(core.x, core.y, core.radius, 22),
            fill: PALETTE.neutral,
            color: PALETTE.white,
            effects: glow(PALETTE.neutral, 10)
        });
        const center = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: polyCircle(core.x, core.y, Math.max(0.8, core.radius * 0.25), 14),
            fill: PALETTE.white,
            color: PALETTE.white
        });
        const energy = this.makeText(
            String(Math.floor(core.energy)),
            core.x,
            core.y - 0.9,
            core.radius > 4 ? 2 : 1.6,
            PALETTE.background
        );
        group.addChildren(outer, body, center, energy);
        return { group, outer, body, center, energy };
    }

    buildScoreboard() {
        for (let index = 0; index < this.factionOrder.length; index += 1) {
            const faction = this.factions[this.factionOrder[index]];
            const width = 100 / this.factionOrder.length;
            const x = width * index + width / 2;
            const dot = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: polyCircle(x - 4, 3.5, 1.2, 12),
                fill: faction.color,
                color: faction.color,
                effects: glow(faction.color, 8)
            });
            const count = this.makeText('1', x, 2.3, 1.45, PALETTE.white);
            const name = this.makeText(
                faction.colorName,
                x,
                5.1,
                this.factionOrder.length > 4 ? 0.9 : 1.05,
                faction.color
            );
            this.hudLayer.addChildren(dot, count, name);
            faction.scoreboard = { dot, count, name };
        }
    }

    buildHumanHuds() {
        for (const playerId of this.playerOrder) {
            const player = this.players[playerId];
            this.buildPlayerHud(player);
        }
    }

    buildPlayerHud(player) {
        if (player.hudContainer) this.hudLayer.removeChild(player.hudContainer.id);
        if (player.selectionRing) this.privateWorldLayer.removeChild(player.selectionRing.id);

        const faction = this.factions[player.factionKey];
        const container = this.makeContainer([player.id]);
        player.hudContainer = container;
        player.hud = {};

        const panel = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 87, 100, 13),
            fill: PALETTE.panel,
            color: faction.color,
            border: 2,
            playerIds: [player.id]
        });
        container.addChild(panel);

        player.hud.identity = this.makeText(
            `YOU ARE ${faction.colorName}`,
            12,
            89.1,
            1.05,
            faction.color,
            'left',
            [player.id]
        );
        container.addChild(player.hud.identity);

        player.hud.instruction = this.makeText(
            'TAP CORE → TARGET',
            12,
            92.1,
            1.05,
            PALETTE.muted,
            'left',
            [player.id]
        );
        container.addChild(player.hud.instruction);

        player.hud.status = this.makeText(
            '',
            50,
            84.2,
            1.25,
            faction.color,
            'center',
            [player.id]
        );
        container.addChild(player.hud.status);

        player.hud.buttons = [];
        const percentages = [0.25, 0.5, 1];
        for (let index = 0; index < percentages.length; index += 1) {
            const value = percentages[index];
            const button = this.makeButton({
                x: 47 + index * 17,
                y: 90,
                width: 15,
                height: 7,
                label: `${Math.round(value * 100)}%`,
                fill: value === player.sendPercent ? faction.dark : PALETTE.panelAlt,
                color: value === player.sendPercent ? faction.color : PALETTE.lineBright,
                playerIds: [player.id],
                onClick: (clickingPlayerId) => {
                    if (Number(clickingPlayerId) !== player.id) return;
                    this.setSendPercent(player.id, value);
                },
                size: 1.55
            });
            player.hud.buttons.push({ value, button });
            container.addChild(button);
        }

        this.hudLayer.addChild(container);

        const ring = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 0, 0, 0),
            fill: PALETTE.transparent,
            color: faction.color,
            border: 8,
            effects: glow(faction.color, 14),
            playerIds: [player.id]
        });
        player.selectionRing = ring;
        this.privateWorldLayer.addChild(ring);
    }

    buildSpectatorHud(player) {
        if (player.hudContainer) this.hudLayer.removeChild(player.hudContainer.id);
        const container = this.makeContainer([player.id]);
        player.hudContainer = container;
        player.hud = {};
        const panel = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 87, 100, 13),
            fill: PALETTE.panel,
            color: PALETTE.lineBright,
            border: 2,
            playerIds: [player.id]
        });
        player.hud.status = this.makeText(
            'SPECTATING — JOIN NEXT MATCH',
            50,
            92,
            1.5,
            PALETTE.muted,
            'center',
            [player.id]
        );
        container.addChildren(panel, player.hud.status);
        this.hudLayer.addChild(container);
    }

    buildGameOverHud(player) {
        const container = this.makeContainer([player.id]);
        player.hudContainer = container;
        player.hud = {};
        this.hudLayer.addChild(container);
    }

    setSendPercent(playerId, value) {
        const player = this.players[playerId];
        if (!player || this.phase !== 'running' || player.spectator) return;
        player.sendPercent = value;
        const faction = this.factions[player.factionKey];
        for (const item of player.hud.buttons) {
            const selected = item.value === value;
            item.button.node.fill = selected ? faction.dark : PALETTE.panelAlt;
            item.button.node.color = selected ? faction.color : PALETTE.lineBright;
        }
        this.setPlayerStatus(player, `SEND ${Math.round(value * 100)}%`);
        this.base.node.onStateChange();
    }

    handleMapTap(playerId, x, y) {
        if (this.phase !== 'running') return;
        const player = this.players[playerId];
        if (!player || player.spectator || !player.factionKey) return;

        const tappedCore = this.findCoreAt(x, y);
        if (!tappedCore) {
            this.clearSelection(playerId);
            return;
        }

        if (!player.selectedCoreId) {
            if (tappedCore.ownerKey !== player.factionKey) {
                this.setPlayerStatus(player, 'SELECT ONE OF YOUR CORES');
                this.base.node.onStateChange();
                return;
            }
            this.selectCore(player, tappedCore);
            return;
        }

        const source = this.getCore(player.selectedCoreId);
        if (!source || source.ownerKey !== player.factionKey) {
            this.clearSelection(playerId);
            return;
        }

        if (source.id === tappedCore.id) {
            this.clearSelection(playerId);
            return;
        }

        const launched = this.launchFleet(
            player.factionKey,
            source.id,
            tappedCore.id,
            player.sendPercent
        );
        if (launched) {
            this.setPlayerStatus(player, `${launched.amount} ENERGY SENT`);
            this.clearSelection(playerId, false);
            this.refreshEverything(false);
            this.base.node.onStateChange();
        } else {
            this.setPlayerStatus(player, 'NOT ENOUGH ENERGY');
            this.base.node.onStateChange();
        }
    }

    findCoreAt(x, y) {
        let best = null;
        let bestDistance = Infinity;
        for (const core of this.cores) {
            const dx = core.x - x;
            const dy = core.y - y;
            const currentDistance = Math.sqrt(dx * dx + dy * dy);
            if (currentDistance <= Math.max(TUNING.MAP_TAP_RADIUS, core.radius + 2) && currentDistance < bestDistance) {
                best = core;
                bestDistance = currentDistance;
            }
        }
        return best;
    }

    selectCore(player, core) {
        player.selectedCoreId = core.id;
        const radius = core.radius + 2.2;
        player.selectionRing.node.coordinates2d = polyCircle(core.x, core.y, radius, 24);
        const faction = this.factions[player.factionKey];
        player.selectionRing.node.color = faction.color;
        player.selectionRing.node.effects = glow(faction.color, 14);
        this.setPlayerStatus(player, `${Math.floor(core.energy)} READY — CHOOSE TARGET`);
        this.base.node.onStateChange();
    }

    clearSelection(playerId, notify = true) {
        const player = this.players[playerId];
        if (!player) return;
        player.selectedCoreId = null;
        if (player.selectionRing) player.selectionRing.node.coordinates2d = rectangle(0, 0, 0, 0);
        if (notify) this.base.node.onStateChange();
    }

    launchFleet(ownerKey, sourceId, destinationId, percent) {
        const source = this.getCore(sourceId);
        const destination = this.getCore(destinationId);
        if (!source || !destination || source.ownerKey !== ownerKey) return null;

        const amount = Math.floor(source.energy * percent);
        if (amount < 2) return null;

        const slot = this.fleets.find((fleet) => !fleet.active);
        if (!slot) return null;

        source.energy -= amount;
        slot.active = true;
        slot.id = this.nextFleetId;
        this.nextFleetId += 1;
        slot.ownerKey = ownerKey;
        slot.sourceId = sourceId;
        slot.destinationId = destinationId;
        slot.amount = amount;
        slot.progress = 0;
        slot.durationTicks = Math.max(
            1,
            Math.round(distance(source, destination) / TUNING.FLEET_SPEED_PER_SECOND * TUNING.TICK_RATE)
        );
        slot.group.node.playerIds = [];
        this.updateFleetVisual(slot);
        return slot;
    }

    tickProduction() {
        let changed = false;
        this.updateNetworkCounts();

        for (const core of this.cores) {
            if (!core.ownerKey || core.energy >= TUNING.MAX_CORE_ENERGY) continue;
            const bonus = Math.min(
                TUNING.MAX_LINK_BONUS,
                core.sameOwnerNeighbors * TUNING.LINK_BONUS_PER_NEIGHBOR
            );
            core.productionAccumulator += (
                TUNING.BASE_PRODUCTION_PER_SECOND * (1 + bonus)
            ) / TUNING.TICK_RATE;

            if (core.productionAccumulator >= 1) {
                const whole = Math.floor(core.productionAccumulator);
                core.productionAccumulator -= whole;
                core.energy = Math.min(TUNING.MAX_CORE_ENERGY, core.energy + whole);
                changed = true;
            }
        }
        return changed;
    }

    tickFleets() {
        let changed = false;
        for (const fleet of this.fleets) {
            if (!fleet.active) continue;
            fleet.progress += 1 / fleet.durationTicks;
            if (fleet.progress >= 1) {
                this.resolveFleetArrival(fleet);
            } else {
                this.updateFleetVisual(fleet);
            }
            changed = true;
        }
        return changed;
    }

    resolveFleetArrival(fleet) {
        const destination = this.getCore(fleet.destinationId);
        if (destination) {
            if (destination.ownerKey === fleet.ownerKey) {
                destination.energy = Math.min(
                    TUNING.MAX_CORE_ENERGY,
                    destination.energy + fleet.amount
                );
            } else if (fleet.amount >= destination.energy) {
                destination.ownerKey = fleet.ownerKey;
                destination.energy = clamp(
                    fleet.amount - Math.floor(destination.energy),
                    1,
                    TUNING.MAX_CORE_ENERGY
                );
                destination.productionAccumulator = 0;
                this.clearSelectionsForCore(destination.id);
            } else {
                destination.energy = Math.max(0, destination.energy - fleet.amount);
            }
        }
        this.deactivateFleet(fleet);
    }

    updateFleetVisual(fleet) {
        const source = this.getCore(fleet.sourceId);
        const destination = this.getCore(fleet.destinationId);
        const faction = this.factions[fleet.ownerKey];
        if (!source || !destination || !faction) {
            this.deactivateFleet(fleet);
            return;
        }

        const progress = clamp(fleet.progress, 0, 1);
        const x = lerp(source.x, destination.x, progress);
        const y = lerp(source.y, destination.y, progress);
        const previous = Math.max(0, progress - 0.08);
        const previousX = lerp(source.x, destination.x, previous);
        const previousY = lerp(source.y, destination.y, previous);

        fleet.trail.node.coordinates2d = thickLine(previousX, previousY, x, y, 1.25);
        fleet.trail.node.fill = faction.dark;
        fleet.trail.node.color = colorWithAlpha(PALETTE.white, 190);
        fleet.orb.node.coordinates2d = polyCircle(x, y, 1.25, 14);
        fleet.orb.node.fill = faction.color;
        fleet.orb.node.color = faction.color;
        fleet.orb.node.effects = glow(faction.color, 12);
        fleet.label.node.text = {
            text: String(fleet.amount),
            x,
            y: y - 0.7,
            size: 0.95,
            align: 'center',
            color: PALETTE.background,
            font: 'monospace'
        };
    }

    deactivateFleet(fleet) {
        fleet.active = false;
        fleet.id = null;
        fleet.ownerKey = null;
        fleet.sourceId = null;
        fleet.destinationId = null;
        fleet.amount = 0;
        fleet.progress = 0;
        fleet.group.node.playerIds = [0];
        fleet.trail.node.coordinates2d = rectangle(0, 0, 0, 0);
        fleet.orb.node.coordinates2d = rectangle(0, 0, 0, 0);
        fleet.label.node.text = {
            text: '',
            x: 0,
            y: 0,
            size: 1,
            align: 'center',
            color: PALETTE.white,
            font: 'monospace'
        };
    }

    clearActiveFleets() {
        for (const fleet of this.fleets) this.deactivateFleet(fleet);
    }

    updateNetworkCounts() {
        for (const core of this.cores) core.sameOwnerNeighbors = 0;
        for (const edge of this.edges) {
            const a = this.getCore(edge.aId);
            const b = this.getCore(edge.bId);
            if (a && b && a.ownerKey && a.ownerKey === b.ownerKey) {
                a.sameOwnerNeighbors += 1;
                b.sameOwnerNeighbors += 1;
            }
        }
    }

    runAiTurn() {
        let changed = false;
        for (const factionKey of this.factionOrder) {
            const faction = this.factions[factionKey];
            if (!faction || faction.isHuman || !faction.ai) continue;
            changed = this.runSingleAi(faction) || changed;
        }
        return changed;
    }

    runSingleAi(faction) {
        const owned = this.cores.filter((core) => core.ownerKey === faction.key);
        if (owned.length === 0) return false;

        const threatened = this.findThreatenedCore(faction.key);
        if (threatened) {
            const source = owned
                .filter((core) => core.id !== threatened.id && core.energy >= TUNING.AI_MIN_SEND)
                .sort((a, b) => b.energy - a.energy)[0];
            if (source) {
                const launched = this.launchFleet(faction.key, source.id, threatened.id, 0.5);
                return Boolean(launched);
            }
        }

        const source = owned
            .filter((core) => core.energy >= TUNING.AI_MIN_SEND)
            .sort((a, b) => b.energy - a.energy)[0];
        if (!source) return false;

        let bestTarget = null;
        let bestScore = -Infinity;
        for (const target of this.cores) {
            if (target.id === source.id || target.ownerKey === faction.key) continue;
            const dist = distance(source, target);
            const neutralBonus = target.ownerKey ? 0 : 16;
            const strategicBonus = target.strategicValue || 0;
            const linkBonus = this.countOwnedNeighbors(target.id, faction.key) * 7;
            const enemyPenalty = target.ownerKey ? target.energy * 0.7 : target.energy * 0.45;
            const personalityBonus = faction.ai.personality === 0 && !target.ownerKey ? 6 : 0;
            const raiderBonus = faction.ai.personality === 2 && target.ownerKey ? 7 : 0;
            const score = neutralBonus + strategicBonus + linkBonus + personalityBonus + raiderBonus
                - enemyPenalty - dist * 0.22 + Math.random() * 5;
            if (score > bestScore) {
                bestScore = score;
                bestTarget = target;
            }
        }

        if (!bestTarget) return false;
        const predictedSend = source.energy * (1 - faction.ai.reserve) * faction.ai.aggression;
        if (predictedSend < Math.max(TUNING.AI_MIN_SEND, bestTarget.energy * 0.75)) return false;

        const percent = source.energy > 70 ? 1 : source.energy > 35 ? 0.5 : 0.25;
        return Boolean(this.launchFleet(faction.key, source.id, bestTarget.id, percent));
    }

    findThreatenedCore(factionKey) {
        let best = null;
        let worstMargin = 0;
        for (const core of this.cores) {
            if (core.ownerKey !== factionKey) continue;
            let hostileIncoming = 0;
            for (const fleet of this.fleets) {
                if (fleet.active && fleet.destinationId === core.id && fleet.ownerKey !== factionKey) {
                    hostileIncoming += fleet.amount;
                }
            }
            const margin = hostileIncoming - core.energy;
            if (margin > worstMargin) {
                worstMargin = margin;
                best = core;
            }
        }
        return best;
    }

    countOwnedNeighbors(coreId, factionKey) {
        let count = 0;
        for (const edge of this.edges) {
            let otherId = null;
            if (edge.aId === coreId) otherId = edge.bId;
            if (edge.bId === coreId) otherId = edge.aId;
            if (otherId && this.getCore(otherId).ownerKey === factionKey) count += 1;
        }
        return count;
    }

    tickPlayerStatuses() {
        let changed = false;
        for (const playerId of this.playerOrder) {
            const player = this.players[playerId];
            if (!player || player.statusTicks <= 0) continue;
            player.statusTicks -= 1;
            if (player.statusTicks === 0 && player.hud && player.hud.status) {
                player.statusText = '';
                player.hud.status.node.text = {
                    text: '',
                    x: 50,
                    y: 84.2,
                    size: 1.25,
                    align: 'center',
                    color: player.factionKey && this.factions[player.factionKey]
                        ? this.factions[player.factionKey].color
                        : PALETTE.muted,
                    font: 'monospace'
                };
                changed = true;
            }
        }
        return changed;
    }

    setPlayerStatus(player, text) {
        if (!player || !player.hud || !player.hud.status) return;
        player.statusText = text;
        player.statusTicks = Math.round(TUNING.STATUS_SECONDS * TUNING.TICK_RATE);
        const color = player.factionKey && this.factions[player.factionKey]
            ? this.factions[player.factionKey].color
            : PALETTE.muted;
        player.hud.status.node.text = {
            text,
            x: 50,
            y: player.spectator ? 92 : 84.2,
            size: player.spectator ? 1.5 : 1.25,
            align: 'center',
            color,
            font: 'monospace'
        };
    }

    checkForWinner() {
        const alive = this.factionOrder.filter((factionKey) => {
            const ownsCore = this.cores.some((core) => core.ownerKey === factionKey);
            const hasFleet = this.fleets.some((fleet) => fleet.active && fleet.ownerKey === factionKey);
            return ownsCore || hasFleet;
        });

        if (alive.length === 1 && this.elapsedTicks > TUNING.TICK_RATE * 3) {
            this.endGame(alive[0]);
            return true;
        }
        return false;
    }

    endGame(winnerKey) {
        this.phase = 'gameover';
        this.winnerKey = winnerKey;
        for (const playerId of this.playerOrder) this.clearSelection(playerId, false);
        this.renderGameOver();
        this.base.node.onStateChange();
    }

    renderGameOver() {
        this.overlayLayer.clearChildren();
        const faction = this.factions[this.winnerKey];
        const winnerColor = faction ? faction.color : PALETTE.white;
        const winnerName = faction ? faction.name.toUpperCase() : 'UNKNOWN';

        const curtain = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 0, 100, 100),
            fill: PALETTE.backgroundAlt,
            color: PALETTE.white
        });
        this.overlayLayer.addChild(curtain);
        this.overlayLayer.addChild(this.makeText('FIELD CONQUERED', 50, 31, 3.7, winnerColor));
        this.overlayLayer.addChild(this.makeText(winnerName, 50, 43, 5, PALETTE.white));
        this.overlayLayer.addChild(this.makeText(
            `${this.countFactionCores(this.winnerKey)} CORES CONTROLLED`,
            50,
            53,
            1.5,
            winnerColor
        ));
        this.overlayLayer.addChild(this.makeButton({
            x: 18,
            y: 64,
            width: 29,
            height: 10,
            label: 'PLAY AGAIN',
            fill: faction ? faction.dark : PALETTE.panelAlt,
            color: winnerColor,
            onClick: (playerId) => this.startGame(Number(playerId)),
            size: 2
        }));
        this.overlayLayer.addChild(this.makeButton({
            x: 53,
            y: 64,
            width: 29,
            height: 10,
            label: 'MAP SELECT',
            fill: PALETTE.panelAlt,
            color: PALETTE.lineBright,
            onClick: () => this.returnToLobby(),
            size: 1.75
        }));
        this.overlayLayer.addChild(this.makeText('ENTER / SPACE RESTARTS SAME MAP', 50, 79, 1.1, PALETTE.muted));
    }

    returnToLobby() {
        this.renderLobby();
        this.base.node.onStateChange();
    }

    refreshEverything(notify) {
        this.refreshCoreVisuals(false);
        this.refreshConnections(false);
        this.refreshScoreboard(false);
        if (notify) this.base.node.onStateChange();
    }

    refreshCoreVisuals(notify) {
        for (const core of this.cores) {
            if (!core.visual) continue;
            const faction = core.ownerKey ? this.factions[core.ownerKey] : null;
            const main = faction ? faction.color : PALETTE.neutral;
            const dark = faction ? faction.dark : PALETTE.neutralDark;
            core.visual.outer.node.fill = dark;
            core.visual.body.node.fill = main;
            core.visual.body.node.color = main;
            core.visual.body.node.effects = glow(main, faction ? 15 : 8);
            core.visual.center.node.fill = PALETTE.white;
            core.visual.center.node.color = PALETTE.white;
            core.visual.energy.node.text = {
                text: String(Math.floor(core.energy)),
                x: core.x,
                y: core.y - 0.9,
                size: core.radius > 4 ? 2 : 1.6,
                align: 'center',
                color: faction ? PALETTE.background : PALETTE.backgroundAlt,
                font: 'monospace'
            };
        }
        if (notify) this.base.node.onStateChange();
    }

    refreshConnections(notify) {
        for (const edge of this.edges) {
            const a = this.getCore(edge.aId);
            const b = this.getCore(edge.bId);
            if (a && b && a.ownerKey && a.ownerKey === b.ownerKey && this.factions[a.ownerKey]) {
                edge.line.node.fill = this.factions[a.ownerKey].dark;
                edge.line.node.effects = glow(this.factions[a.ownerKey].color, 7);
            } else {
                edge.line.node.fill = PALETTE.line;
                edge.line.node.effects = null;
            }
        }
        if (notify) this.base.node.onStateChange();
    }

    refreshScoreboard(notify) {
        for (const factionKey of this.factionOrder) {
            const faction = this.factions[factionKey];
            if (!faction || !faction.scoreboard) continue;
            const coreCount = this.countFactionCores(factionKey);
            faction.scoreboard.count.node.text = {
                text: String(coreCount),
                x: faction.scoreboard.count.node.text.x,
                y: 2.3,
                size: 1.45,
                align: 'center',
                color: coreCount > 0 ? PALETTE.white : PALETTE.muted,
                font: 'monospace'
            };
            faction.scoreboard.dot.node.fill = coreCount > 0 ? faction.color : PALETTE.neutralDark;
            faction.scoreboard.name.node.text = {
                text: faction.colorName,
                x: faction.scoreboard.name.node.text.x,
                y: 5.1,
                size: this.factionOrder.length > 4 ? 0.9 : 1.05,
                align: 'center',
                color: coreCount > 0 ? faction.color : PALETTE.muted,
                font: 'monospace'
            };
        }
        if (notify) this.base.node.onStateChange();
    }

    clearSelectionsForCore(coreId) {
        for (const playerId of this.playerOrder) {
            const player = this.players[playerId];
            if (player && player.selectedCoreId === coreId) this.clearSelection(playerId, false);
        }
    }

    countFactionCores(factionKey) {
        return this.cores.filter((core) => core.ownerKey === factionKey).length;
    }

    getCore(coreId) {
        return this.cores.find((core) => core.id === coreId);
    }
}

PulsefrontClassic.MAPS = MAPS;
PulsefrontClassic.finalizeMap = finalizeMap;
PulsefrontClassic.makeRing = makeRing;

const CLASSIC_MEDAL_TARGETS = {
    crown: { gold: 150, silver: 220, bronze: 320 },
    'twin-suns': { gold: 175, silver: 250, bronze: 360 },
    'the-bridge': { gold: 205, silver: 295, bronze: 420 },
    triad: { gold: 180, silver: 260, bronze: 370 },
    spiral: { gold: 195, silver: 280, bronze: 400 },
    crossroads: { gold: 190, silver: 275, bronze: 390 },
    archipelago: { gold: 235, silver: 340, bronze: 485 },
    fortress: { gold: 255, silver: 370, bronze: 525 }
};

const MEDAL_COLORS = {
    gold: [255, 205, 65, 255],
    silver: [203, 214, 232, 255],
    bronze: [205, 127, 67, 255],
    none: PALETTE.muted
};

function formatClock(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function medalForTime(mapId, seconds) {
    const targets = CLASSIC_MEDAL_TARGETS[mapId];
    if (!targets) return 'none';
    if (seconds <= targets.gold) return 'gold';
    if (seconds <= targets.silver) return 'silver';
    if (seconds <= targets.bronze) return 'bronze';
    return 'none';
}

for (const map of MAPS) map.medals = CLASSIC_MEDAL_TARGETS[map.id];

const originalClassicRenderLobby = PulsefrontClassic.prototype.renderLobby;
PulsefrontClassic.prototype.renderLobby = function renderLobbyWithMedals() {
    originalClassicRenderLobby.call(this);
    const map = MAPS[this.selectedMapIndex];
    const targets = map.medals;
    const record = this.sessionRecords ? this.sessionRecords[map.id] : null;

    this.overlayLayer.addChild(this.makeButton({
        x: 2,
        y: 2,
        width: 16,
        height: 6,
        label: 'MODES',
        fill: PALETTE.panelAlt,
        color: PALETTE.lineBright,
        onClick: () => {
            if (typeof this.onExitMode === 'function') this.onExitMode();
        },
        size: 1.1
    }));

    if (targets) {
        this.overlayLayer.addChild(this.makeText(
            `SOLO MEDALS   G ${formatClock(targets.gold)}   S ${formatClock(targets.silver)}   B ${formatClock(targets.bronze)}`,
            50,
            68.2,
            0.95,
            MEDAL_COLORS.silver
        ));
    }

    this.overlayLayer.addChild(this.makeText(
        record ? `SESSION BEST ${record.medal.toUpperCase()}  •  ${formatClock(record.bestSeconds)}` : 'SESSION BEST —',
        50,
        70.5,
        0.92,
        record ? MEDAL_COLORS[record.medal] : PALETTE.muted
    ));
};

const originalClassicBuildPlayerHud = PulsefrontClassic.prototype.buildPlayerHud;
PulsefrontClassic.prototype.buildPlayerHud = function buildClassicPlayerHudWithTimer(player) {
    originalClassicBuildPlayerHud.call(this, player);
    if (!player || !player.hudContainer || !player.hud) return;
    player.hud.timer = this.makeText(
        'TIME 0:00',
        12,
        95.1,
        0.95,
        PALETTE.muted,
        'left',
        [player.id]
    );
    player.hudContainer.addChild(player.hud.timer);
};

const originalClassicRefreshScoreboard = PulsefrontClassic.prototype.refreshScoreboard;
PulsefrontClassic.prototype.refreshScoreboard = function refreshClassicScoreboardWithTimer(notify) {
    originalClassicRefreshScoreboard.call(this, false);
    const elapsedSeconds = this.elapsedTicks / TUNING.TICK_RATE;
    const targets = this.currentMap ? CLASSIC_MEDAL_TARGETS[this.currentMap.id] : null;
    for (const playerId of this.playerOrder) {
        const player = this.players[playerId];
        if (!player || !player.hud || !player.hud.timer) continue;
        let suffix = '';
        let color = PALETTE.muted;
        if (this.humanStartCount === 1 && targets) {
            if (elapsedSeconds <= targets.gold) {
                suffix = '  •  GOLD PACE';
                color = MEDAL_COLORS.gold;
            } else if (elapsedSeconds <= targets.silver) {
                suffix = '  •  SILVER PACE';
                color = MEDAL_COLORS.silver;
            } else if (elapsedSeconds <= targets.bronze) {
                suffix = '  •  BRONZE PACE';
                color = MEDAL_COLORS.bronze;
            } else {
                suffix = '  •  NO MEDAL';
                color = PALETTE.danger;
            }
        }
        player.hud.timer.node.text = {
            text: `TIME ${formatClock(elapsedSeconds)}${suffix}`,
            x: 12,
            y: 95.1,
            size: 0.95,
            align: 'left',
            color,
            font: 'monospace'
        };
    }
    if (notify) this.base.node.onStateChange();
};

const originalClassicStartGame = PulsefrontClassic.prototype.startGame;
PulsefrontClassic.prototype.startGame = function startClassicGame(requestingPlayerId) {
    originalClassicStartGame.call(this, requestingPlayerId);
    if (this.phase === 'running') {
        this.humanStartCount = this.factionOrder.filter((key) => this.factions[key] && this.factions[key].isHuman).length;
        this.lastResult = null;
    }
};

const originalClassicEndGame = PulsefrontClassic.prototype.endGame;
PulsefrontClassic.prototype.endGame = function endClassicGame(winnerKey) {
    const elapsedSeconds = this.elapsedTicks / TUNING.TICK_RATE;
    const faction = this.factions[winnerKey];
    const eligible = this.humanStartCount === 1 && faction && faction.isHuman;
    const mapId = this.currentMap ? this.currentMap.id : null;
    const medal = eligible && mapId ? medalForTime(mapId, elapsedSeconds) : 'none';

    this.lastResult = {
        elapsedSeconds,
        eligible,
        medal,
        mapId,
        humanVictory: Boolean(faction && faction.isHuman)
    };

    if (eligible && mapId && medal !== 'none') {
        if (!this.sessionRecords) this.sessionRecords = {};
        const previous = this.sessionRecords[mapId];
        if (!previous || elapsedSeconds < previous.bestSeconds) {
            this.sessionRecords[mapId] = { bestSeconds: elapsedSeconds, medal };
        }
    }

    originalClassicEndGame.call(this, winnerKey);
};

PulsefrontClassic.prototype.renderGameOver = function renderClassicGameOverWithMedal() {
    this.overlayLayer.clearChildren();
    const faction = this.factions[this.winnerKey];
    const winnerColor = faction ? faction.color : PALETTE.white;
    const winnerName = faction ? faction.name.toUpperCase() : 'UNKNOWN';
    const result = this.lastResult || {
        elapsedSeconds: this.elapsedTicks / TUNING.TICK_RATE,
        eligible: false,
        medal: 'none',
        humanVictory: false
    };

    this.overlayLayer.addChild(new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: rectangle(0, 0, 100, 100),
        fill: PALETTE.backgroundAlt,
        color: PALETTE.white
    }));
    this.overlayLayer.addChild(this.makeText('FIELD CONQUERED', 50, 27, 3.5, winnerColor));
    this.overlayLayer.addChild(this.makeText(winnerName, 50, 38, 4.7, PALETTE.white));
    this.overlayLayer.addChild(this.makeText(
        `${this.countFactionCores(this.winnerKey)} CORES  •  ${formatClock(result.elapsedSeconds)}`,
        50,
        48,
        1.4,
        winnerColor
    ));

    let resultText = 'MULTIPLAYER — MEDALS DISABLED';
    let resultColor = PALETTE.muted;
    if (result.eligible) {
        resultText = result.medal === 'none' ? 'NO MEDAL — BEAT THE BRONZE TIME' : `${result.medal.toUpperCase()} MEDAL`;
        resultColor = MEDAL_COLORS[result.medal];
    } else if (this.humanStartCount === 1 && !result.humanVictory) {
        resultText = 'RIVAL VICTORY — NO MEDAL';
        resultColor = PALETTE.danger;
    }
    this.overlayLayer.addChild(this.makeText(resultText, 50, 55, 2, resultColor));

    if (result.mapId && CLASSIC_MEDAL_TARGETS[result.mapId]) {
        const targets = CLASSIC_MEDAL_TARGETS[result.mapId];
        this.overlayLayer.addChild(this.makeText(
            `G ${formatClock(targets.gold)}   S ${formatClock(targets.silver)}   B ${formatClock(targets.bronze)}`,
            50,
            59.5,
            1,
            PALETTE.muted
        ));
    }

    this.overlayLayer.addChild(this.makeButton({
        x: 17,
        y: 67,
        width: 30,
        height: 10,
        label: 'PLAY AGAIN',
        fill: faction ? faction.dark : PALETTE.panelAlt,
        color: winnerColor,
        onClick: (playerId) => this.startGame(Number(playerId)),
        size: 1.9
    }));
    this.overlayLayer.addChild(this.makeButton({
        x: 53,
        y: 67,
        width: 30,
        height: 10,
        label: 'MAP SELECT',
        fill: PALETTE.panelAlt,
        color: PALETTE.lineBright,
        onClick: () => this.returnToLobby(),
        size: 1.7
    }));
    this.overlayLayer.addChild(this.makeText('ENTER / SPACE RESTARTS SAME MAP', 50, 83, 1.05, PALETTE.muted));
};

PulsefrontClassic.CLASSIC_MEDAL_TARGETS = CLASSIC_MEDAL_TARGETS;
PulsefrontClassic.medalForTime = medalForTime;

return PulsefrontClassic;
})();

const PulsefrontExpanse = (() => {
const TUNING = {
    TICK_RATE: 60,
    MAX_PLAYERS: 6,
    MAX_FLEETS: 72,
    MAX_VISIBLE_CORES: 30,
    MAX_VISIBLE_EDGES: 44,
    MAX_VISIBLE_FLEETS: 22,
    STARTING_ENERGY: 38,
    MAX_CORE_ENERGY: 120,
    BASE_PRODUCTION_PER_SECOND: 0.82,
    LINK_BONUS_PER_NEIGHBOR: 0.08,
    MAX_LINK_BONUS: 0.32,
    FLEET_SPEED_PER_SECOND: 25,
    AI_DECISION_SECONDS: 1.15,
    AI_MIN_SEND: 9,
    WIN_CHECK_TICKS: 60,
    STATUS_SECONDS: 1.8,
    VIEW_CENTER_X: 50,
    VIEW_CENTER_Y: 45,
    VIEW_TOP: 7,
    VIEW_BOTTOM: 82,
    MIN_ZOOM: 0.62,
    DEFAULT_ZOOM: 0.92,
    MAX_ZOOM: 1.55,
    ZOOM_STEP: 0.18,
    PAN_STEP_SCREEN: 18,
    PAN_SPEED_SCREEN_PER_SECOND: 72,
    CAMERA_EASE_PER_SECOND: 13,
    ZOOM_EASE_PER_SECOND: 11,
    CAMERA_EPSILON: 0.01,
    MAP_TAP_RADIUS_SCREEN: 6.8,
    MINIMAP_X: 2,
    MINIMAP_Y: 84,
    MINIMAP_W: 28,
    MINIMAP_H: 14
};

const PALETTE = {
    background: [4, 7, 16, 255],
    backgroundAlt: [9, 14, 28, 255],
    grid: [18, 28, 50, 255],
    line: [30, 45, 70, 255],
    lineBright: [80, 105, 145, 255],
    neutral: [119, 132, 155, 255],
    neutralDark: [39, 47, 64, 255],
    white: [244, 248, 255, 255],
    muted: [150, 164, 188, 255],
    panel: [12, 19, 35, 255],
    panelAlt: [22, 32, 54, 255],
    danger: [255, 72, 100, 255],
    transparent: [0, 0, 0, 0],
    minimap: [8, 13, 25, 235]
};

const FACTION_COLORS = [
    { name: 'CYAN', color: [61, 224, 255, 255], dark: [17, 99, 120, 255] },
    { name: 'MAGENTA', color: [255, 82, 191, 255], dark: [119, 27, 86, 255] },
    { name: 'GOLD', color: [255, 205, 65, 255], dark: [121, 83, 18, 255] },
    { name: 'LIME', color: [135, 238, 80, 255], dark: [48, 110, 31, 255] },
    { name: 'VIOLET', color: [174, 117, 255, 255], dark: [76, 42, 125, 255] },
    { name: 'ORANGE', color: [255, 137, 62, 255], dark: [126, 57, 20, 255] }
];

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function round1(value) {
    return Math.round(value * 10) / 10;
}

function rectangle(x, y, width, height) {
    return [
        [x, y],
        [x + width, y],
        [x + width, y + height],
        [x, y + height]
    ];
}

function polyCircle(x, y, radius, sides = 16) {
    const points = [];
    for (let index = 0; index < sides; index += 1) {
        const angle = index / sides * Math.PI * 2;
        points.push([x + Math.cos(angle) * radius, y + Math.sin(angle) * radius]);
    }
    return points;
}

function thickLine(x1, y1, x2, y2, width) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.max(0.0001, Math.sqrt(dx * dx + dy * dy));
    const ox = -dy / length * width / 2;
    const oy = dx / length * width / 2;
    return [
        [x1 + ox, y1 + oy],
        [x2 + ox, y2 + oy],
        [x2 - ox, y2 - oy],
        [x1 - ox, y1 - oy]
    ];
}

function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function lerp(start, end, amount) {
    return start + (end - start) * amount;
}

function colorWithAlpha(color, alpha) {
    return [color[0], color[1], color[2], alpha];
}

function glow(color, blur) {
    return {
        shadow: {
            color: [color[0], color[1], color[2], 255],
            blur
        }
    };
}

function makePrng(seed) {
    let state = seed >>> 0;
    return function random() {
        state += 0x6D2B79F5;
        let value = state;
        value = Math.imul(value ^ value >>> 15, value | 1);
        value ^= value + Math.imul(value ^ value >>> 7, value | 61);
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
}

function linkKey(aId, bId) {
    return aId < bId ? `${aId}|${bId}` : `${bId}|${aId}`;
}

function addLink(links, seen, aId, bId) {
    if (!aId || !bId || aId === bId) return;
    const key = linkKey(aId, bId);
    if (seen[key]) return;
    seen[key] = true;
    links.push([aId, bId]);
}

function makeCore(id, x, y, neutralEnergy, radius = 4, strategicValue = 0, region = 0) {
    return {
        id,
        x: round1(x),
        y: round1(y),
        neutralEnergy,
        radius,
        strategicValue,
        region
    };
}

function generateMegaworld(config) {
    const random = makePrng(config.seed);
    const center = { x: 150, y: 150 };
    const cores = [];
    const links = [];
    const seen = {};
    const spawnCoreIds = [];
    const sector = [];

    const rotation = config.rotation || -90;
    const warp = config.warp || 1;
    const radialJitter = () => (random() - 0.5) * (config.jitter || 7);
    const angleJitter = () => (random() - 0.5) * (config.angleJitter || 4);
    const point = (radius, angleDegrees) => {
        const angle = angleDegrees * Math.PI / 180;
        return {
            x: center.x + Math.cos(angle) * radius,
            y: center.y + Math.sin(angle) * radius * warp
        };
    };

    for (let side = 0; side < 6; side += 1) {
        const angle = rotation + side * 60;
        const spawnPoint = point(128 + radialJitter(), angle + angleJitter());
        const spawnId = `s${side}`;
        spawnCoreIds.push(spawnId);
        cores.push(makeCore(spawnId, spawnPoint.x, spawnPoint.y, 24, 5.2, 3, side));

        const localIds = [];
        const localSpecs = [
            [108, -10, 17, 4.1],
            [108, 10, 17, 4.1],
            [132, -13, 14, 3.8],
            [132, 13, 14, 3.8],
            [92, 0, 21, 4.3]
        ];
        for (let localIndex = 0; localIndex < localSpecs.length; localIndex += 1) {
            const spec = localSpecs[localIndex];
            const current = point(spec[0] + radialJitter(), angle + spec[1] + angleJitter());
            const id = `s${side}n${localIndex}`;
            localIds.push(id);
            cores.push(makeCore(
                id,
                current.x,
                current.y,
                spec[2] + Math.floor(random() * 5),
                spec[3],
                localIndex === 4 ? 4 : 1,
                side
            ));
        }
        sector.push({ spawnId, localIds });
    }

    const midIds = [];
    for (let index = 0; index < 12; index += 1) {
        const angle = rotation + 15 + index * 30 + angleJitter();
        const current = point(70 + radialJitter(), angle);
        const id = `m${index}`;
        midIds.push(id);
        cores.push(makeCore(id, current.x, current.y, 19 + Math.floor(random() * 8), 4.2, index % 2 ? 3 : 5, Math.floor(index / 2)));
    }

    const innerIds = [];
    for (let index = 0; index < 6; index += 1) {
        const angle = rotation + index * 60 + angleJitter();
        const current = point(39 + radialJitter() * 0.45, angle);
        const id = `i${index}`;
        innerIds.push(id);
        cores.push(makeCore(id, current.x, current.y, 27 + Math.floor(random() * 8), 4.8, 8, index));
    }

    const gateIds = [];
    for (let index = 0; index < 6; index += 1) {
        const angle = rotation + 30 + index * 60 + angleJitter();
        const current = point(98 + radialJitter(), angle);
        const id = `g${index}`;
        gateIds.push(id);
        cores.push(makeCore(id, current.x, current.y, 24 + Math.floor(random() * 8), 4.4, 6, index));
    }

    cores.push(makeCore('center', center.x, center.y, config.centerEnergy || 58, 6.4, 18, 6));

    for (let side = 0; side < 6; side += 1) {
        const current = sector[side];
        const next = sector[(side + 1) % 6];
        addLink(links, seen, current.spawnId, current.localIds[0]);
        addLink(links, seen, current.spawnId, current.localIds[1]);
        addLink(links, seen, current.spawnId, current.localIds[2]);
        addLink(links, seen, current.spawnId, current.localIds[3]);
        addLink(links, seen, current.localIds[0], current.localIds[4]);
        addLink(links, seen, current.localIds[1], current.localIds[4]);
        addLink(links, seen, current.localIds[2], current.localIds[0]);
        addLink(links, seen, current.localIds[3], current.localIds[1]);
        addLink(links, seen, current.localIds[3], next.localIds[2]);
        addLink(links, seen, current.localIds[4], midIds[side * 2]);
        addLink(links, seen, current.localIds[4], midIds[side * 2 + 1]);
        addLink(links, seen, current.localIds[0], gateIds[(side + 5) % 6]);
        addLink(links, seen, current.localIds[1], gateIds[side]);
    }

    for (let index = 0; index < 12; index += 1) {
        addLink(links, seen, midIds[index], midIds[(index + 1) % 12]);
        if (config.denseMid || index % 2 === 0) addLink(links, seen, midIds[index], midIds[(index + 2) % 12]);
        addLink(links, seen, midIds[index], innerIds[Math.floor(index / 2)]);
    }

    for (let index = 0; index < 6; index += 1) {
        addLink(links, seen, innerIds[index], innerIds[(index + 1) % 6]);
        addLink(links, seen, innerIds[index], 'center');
        addLink(links, seen, gateIds[index], midIds[(index * 2 + 1) % 12]);
        addLink(links, seen, gateIds[index], midIds[(index * 2 + 2) % 12]);
        if (config.crossGates) addLink(links, seen, gateIds[index], gateIds[(index + 2) % 6]);
    }

    if (config.longLanes) {
        for (let index = 0; index < 6; index += 1) {
            addLink(links, seen, sector[index].spawnId, innerIds[index]);
        }
    }

    return {
        id: config.id,
        name: config.name,
        tagline: config.tagline,
        description: config.description,
        seed: config.seed,
        recommendedPlayers: config.recommendedPlayers || '2–6',
        bounds: { minX: 0, minY: 0, maxX: 300, maxY: 300 },
        cores,
        links,
        spawnCoreIds,
        minimapCoreIds: [...spawnCoreIds, ...gateIds, ...innerIds, 'center']
    };
}

const WORLDS = [
    generateMegaworld({
        id: 'nova-expanse',
        name: 'NOVA EXPANSE',
        tagline: 'A continent of light.',
        description: 'Sixty-one cores across six frontier regions, a contested middle ring, and a brutal central prize.',
        seed: 117,
        rotation: -90,
        warp: 0.94,
        jitter: 6,
        denseMid: true,
        crossGates: true,
        centerEnergy: 64
    }),
    generateMegaworld({
        id: 'shattered-ring',
        name: 'SHATTERED RING',
        tagline: 'Chokepoints decide empires.',
        description: 'Sparse cross-links turn the six gate cores into strategic bridges between otherwise distant fronts.',
        seed: 2048,
        rotation: -60,
        warp: 0.86,
        jitter: 9,
        denseMid: false,
        crossGates: false,
        centerEnergy: 72
    }),
    generateMegaworld({
        id: 'starweb',
        name: 'STARWEB',
        tagline: 'Everything connects eventually.',
        description: 'Dense internal lanes reward network empires and make attacks arrive from unexpected directions.',
        seed: 9001,
        rotation: -105,
        warp: 1,
        jitter: 7,
        denseMid: true,
        crossGates: true,
        longLanes: true,
        centerEnergy: 82
    }),
    generateMegaworld({
        id: 'deep-frontier',
        name: 'DEEP FRONTIER',
        tagline: 'Long roads. Huge commitments.',
        description: 'A stretched battlefield with expensive travel, isolated border regions, and decisive deep strikes.',
        seed: 314159,
        rotation: -75,
        warp: 1.08,
        jitter: 11,
        denseMid: false,
        crossGates: false,
        longLanes: true,
        centerEnergy: 58
    })
];

class PulsefrontExpanse extends ViewableGame {

    constructor() {
        super(300);
        this.phase = 'lobby';
        this.players = {};
        this.playerOrder = [];
        this.factions = {};
        this.factionOrder = [];
        this.cores = [];
        this.coreById = {};
        this.edges = [];
        this.fleets = [];
        this.nextFleetId = 1;
        this.selectedWorldIndex = 0;
        this.currentWorld = null;
        this.elapsedTicks = 0;
        this.aiClock = 0;
        this.winClock = 0;
        this.winnerKey = null;

        this.base = this.getViewRoot();
        this.base.node.coordinates2d = rectangle(0, 0, 100, 100);
        this.base.node.fill = PALETTE.background;
        this.base.node.color = PALETTE.white;
        this.starLayer = this.makeContainer();
        this.sharedHudLayer = this.makeContainer();
        this.playerViewLayer = this.makeContainer();
        this.cameraControlLayer = this.makeContainer();
        this.overlayLayer = this.makeContainer();
        this.tapCatcher = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, TUNING.VIEW_TOP, 100, TUNING.VIEW_BOTTOM - TUNING.VIEW_TOP),
            fill: PALETTE.transparent,
            color: PALETTE.white,
            onClick: (playerId, x, y) => this.handleWorldTap(Number(playerId), x, y)
        });
        this.base.addChildren(
            this.starLayer,
            this.sharedHudLayer,
            this.playerViewLayer,
            this.tapCatcher,
            this.cameraControlLayer,
            this.overlayLayer
        );
        this.buildStarfield();
        this.renderLobby();
    }

    getLayers() {
        return [{ root: this.getViewRoot() }];
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

    makeButton({ x, y, width, height, label, fill, color, playerIds, onClick, size = 1.5 }) {
        const button = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(x, y, width, height),
            fill,
            color,
            border: 3,
            playerIds,
            onClick
        });
        button.addChild(this.makeText(label, x + width / 2, y + height / 2 - size * 0.45, size, PALETTE.white, 'center', playerIds));
        return button;
    }

    buildStarfield() {
        this.starLayer.clearChildren();
        const random = makePrng(8181);
        for (let index = 0; index < 42; index += 1) {
            const x = 1 + random() * 98;
            const y = 1 + random() * 96;
            const radius = 0.05 + random() * 0.11;
            this.starLayer.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: polyCircle(x, y, radius, 8),
                fill: [102, 139, 190, 230],
                color: [255, 255, 255, 180]
            }));
        }
    }

    handleNewPlayer({ playerId, info }) {
        const id = Number(playerId);
        if (this.players[id]) return;
        const player = {
            id,
            name: info && info.name ? String(info.name).slice(0, 16) : `PLAYER ${id}`,
            factionKey: null,
            spectator: this.phase === 'running',
            selectedCoreId: null,
            sendPercent: 0.5,
            statusTicks: 0,
            camera: {
                x: 150, y: 150, zoom: TUNING.DEFAULT_ZOOM,
                targetX: 150, targetY: 150, targetZoom: TUNING.DEFAULT_ZOOM
            },
            cameraInput: { left: false, right: false, up: false, down: false },
            view: null
        };
        this.players[id] = player;
        this.playerOrder.push(id);
        if (this.phase === 'lobby') this.renderLobby();
        else if (this.phase === 'running') {
            this.buildPlayerView(player, true);
            this.setStatus(player, 'SPECTATING — JOIN NEXT MATCH');
            this.renderPlayerView(player);
            this.base.node.onStateChange();
        } else {
            this.buildPlayerView(player, true);
            this.renderPlayerView(player);
            this.base.node.onStateChange();
        }
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
            faction.ai = this.makeAiState(this.factionOrder.indexOf(faction.key));
        }
        if (player.view && player.view.root) this.playerViewLayer.removeChild(player.view.root.id);
        if (player.view && player.view.cameraControlsRoot) this.cameraControlLayer.removeChild(player.view.cameraControlsRoot.id);
        delete this.players[id];
        this.playerOrder = this.playerOrder.filter((value) => value !== id);
        if (this.phase === 'lobby') this.renderLobby();
        else {
            this.refreshSharedScoreboard();
            this.base.node.onStateChange();
        }
    }

    handleKeyDown(playerId, key) {
        const id = Number(playerId);
        if ((key === 'Enter' || key === ' ') && (this.phase === 'lobby' || this.phase === 'gameover')) {
            this.startGame(id);
            return;
        }
        if (this.phase !== 'running') return;
        const player = this.players[id];
        if (!player) return;
        const lower = String(key).toLowerCase();
        if (lower === 'arrowleft' || lower === 'a') player.cameraInput.left = true;
        if (lower === 'arrowright' || lower === 'd') player.cameraInput.right = true;
        if (lower === 'arrowup' || lower === 'w') player.cameraInput.up = true;
        if (lower === 'arrowdown' || lower === 's') player.cameraInput.down = true;
        if (lower === '+' || lower === '=') this.changeZoom(player, TUNING.ZOOM_STEP);
        if (lower === '-' || lower === '_') this.changeZoom(player, -TUNING.ZOOM_STEP);
        if (lower === 'h' || lower === 'home' || lower === '0') this.focusHome(player);
        if (!player.spectator && lower === 'escape') this.clearSelection(player, true);
        if (!player.spectator && lower === 'f') this.focusSelection(player);
    }

    handleKeyUp(playerId, key) {
        const player = this.players[Number(playerId)];
        if (!player || !player.cameraInput) return;
        const lower = String(key).toLowerCase();
        if (lower === 'arrowleft' || lower === 'a') player.cameraInput.left = false;
        if (lower === 'arrowright' || lower === 'd') player.cameraInput.right = false;
        if (lower === 'arrowup' || lower === 'w') player.cameraInput.up = false;
        if (lower === 'arrowdown' || lower === 's') player.cameraInput.down = false;
    }

    tick() {
        if (this.phase !== 'running') return;
        const cameraChangedPlayers = this.tickCameras();
        let changed = false;
        this.elapsedTicks += 1;
        changed = this.tickProduction() || changed;
        changed = this.tickFleets() || changed;
        changed = this.tickStatuses() || changed;
        this.aiClock += 1;
        if (this.aiClock >= Math.round(TUNING.AI_DECISION_SECONDS * TUNING.TICK_RATE)) {
            this.aiClock = 0;
            changed = this.runAiTurn() || changed;
        }
        this.winClock += 1;
        if (this.winClock >= TUNING.WIN_CHECK_TICKS) {
            this.winClock = 0;
            if (this.checkForWinner()) return;
        }
        if (changed) {
            this.updateNetworkCounts();
            for (const playerId of this.playerOrder) this.renderPlayerView(this.players[playerId]);
            this.refreshSharedScoreboard();
            this.base.node.onStateChange();
        } else {
            for (const player of cameraChangedPlayers) {
                this.renderPlayerView(player);
                if (player.view && player.view.root) player.view.root.node.onStateChange();
            }
        }
    }

    renderLobby() {
        this.phase = 'lobby';
        this.currentWorld = null;
        this.sharedHudLayer.clearChildren();
        this.overlayLayer.clearChildren();
        this.playerViewLayer.clearChildren();
        this.cameraControlLayer.clearChildren();
        for (const playerId of this.playerOrder) {
            const player = this.players[playerId];
            player.view = null;
            player.factionKey = null;
            player.selectedCoreId = null;
            player.spectator = false;
            player.cameraInput = { left: false, right: false, up: false, down: false };
        }
        const world = WORLDS[this.selectedWorldIndex];

        this.overlayLayer.addChild(this.makeText('EXPANSE', 50, 15, 2.1, PALETTE.white));
        this.overlayLayer.addChild(this.makeText(world.name, 50, 23, 2.5, FACTION_COLORS[0].color));
        this.overlayLayer.addChild(this.makeText(world.tagline.toUpperCase(), 50, 28, 1.1, PALETTE.muted));
        this.renderWorldPreview(world);
        this.overlayLayer.addChild(this.makeButton({
            x: 5, y: 43, width: 10, height: 10, label: '<', fill: PALETTE.panelAlt, color: PALETTE.lineBright,
            onClick: () => this.cycleWorld(-1), size: 2.4
        }));
        this.overlayLayer.addChild(this.makeButton({
            x: 85, y: 43, width: 10, height: 10, label: '>', fill: PALETTE.panelAlt, color: PALETTE.lineBright,
            onClick: () => this.cycleWorld(1), size: 2.4
        }));
        this.overlayLayer.addChild(this.makeText(
            `${this.selectedWorldIndex + 1} / ${WORLDS.length}  •  ${world.cores.length} CORES  •  SEED ${world.seed}`,
            50, 68, 1.05, PALETTE.muted
        ));
        const count = this.playerOrder.length;
        this.overlayLayer.addChild(this.makeText(`${count} PLAYER${count === 1 ? '' : 'S'} CONNECTED`, 50, 75, 1.35, count ? FACTION_COLORS[0].color : PALETTE.muted));
        this.overlayLayer.addChild(this.makeButton({
            x: 28, y: 79, width: 44, height: 9,
            label: count ? 'ENTER THE EXPANSE' : 'WAITING FOR PLAYER',
            fill: count ? FACTION_COLORS[0].dark : PALETTE.panelAlt,
            color: count ? FACTION_COLORS[0].color : PALETTE.muted,
            onClick: (playerId) => this.startGame(Number(playerId)), size: 1.65
        }));
        this.overlayLayer.addChild(this.makeText('HOLD WASD / ARROWS • MINIMAP JUMP • + / − ZOOM • H HOME', 50, 93, 0.95, PALETTE.muted));
        this.base.node.onStateChange();
    }

    cycleWorld(direction) {
        if (this.phase !== 'lobby') return;
        this.selectedWorldIndex = (this.selectedWorldIndex + direction + WORLDS.length) % WORLDS.length;
        this.renderLobby();
    }

    renderWorldPreview(world) {
        const x = 18;
        const y = 32;
        const w = 64;
        const h = 31;
        this.overlayLayer.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(x, y, w, h),
            fill: PALETTE.backgroundAlt,
            color: PALETTE.lineBright,
            border: 2
        }));
        const convert = (core) => ({
            x: x + (core.x - world.bounds.minX) / (world.bounds.maxX - world.bounds.minX) * w,
            y: y + (core.y - world.bounds.minY) / (world.bounds.maxY - world.bounds.minY) * h
        });
        const byId = {};
        for (const core of world.cores) byId[core.id] = core;
        for (const pair of world.links) {
            if (!world.minimapCoreIds.includes(pair[0]) || !world.minimapCoreIds.includes(pair[1])) continue;
            const a = convert(byId[pair[0]]);
            const b = convert(byId[pair[1]]);
            this.overlayLayer.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: thickLine(a.x, a.y, b.x, b.y, 0.22),
                fill: PALETTE.line,
                color: PALETTE.line
            }));
        }
        for (const coreId of world.minimapCoreIds) {
            const core = byId[coreId];
            const point = convert(core);
            const spawn = world.spawnCoreIds.includes(core.id);
            this.overlayLayer.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: polyCircle(point.x, point.y, spawn ? 1.05 : 0.72, 10),
                fill: spawn ? FACTION_COLORS[0].dark : PALETTE.neutralDark,
                color: spawn ? FACTION_COLORS[0].color : PALETTE.neutral
            }));
        }
    }

    startGame(requestingPlayerId) {
        if (!this.players[requestingPlayerId] || this.playerOrder.length === 0) return;
        this.phase = 'running';
        this.currentWorld = WORLDS[this.selectedWorldIndex];
        this.elapsedTicks = 0;
        this.aiClock = 0;
        this.winClock = 0;
        this.winnerKey = null;
        this.nextFleetId = 1;
        this.factions = {};
        this.factionOrder = [];
        this.cores = [];
        this.coreById = {};
        this.edges = [];
        this.fleets = [];
        this.sharedHudLayer.clearChildren();
        this.overlayLayer.clearChildren();
        this.playerViewLayer.clearChildren();
        this.cameraControlLayer.clearChildren();

        const humans = this.playerOrder.map((id) => this.players[id]);
        for (let index = 0; index < humans.length; index += 1) {
            const player = humans[index];
            const key = `p${player.id}`;
            this.factions[key] = {
                key,
                name: player.name,
                colorName: FACTION_COLORS[index].name,
                color: FACTION_COLORS[index].color,
                dark: FACTION_COLORS[index].dark,
                isHuman: true,
                controllerId: player.id,
                ai: null,
                scoreboard: null,
                homeCoreId: null
            };
            this.factionOrder.push(key);
            player.factionKey = key;
            player.sendPercent = 0.5;
            player.selectedCoreId = null;
            player.spectator = false;
            player.cameraInput = { left: false, right: false, up: false, down: false };
        }
        if (humans.length === 1) {
            for (let index = 0; index < 2; index += 1) {
                const colorIndex = index + 1;
                const key = `ai${index + 1}`;
                this.factions[key] = {
                    key,
                    name: index ? 'EMBER' : 'VECTOR',
                    colorName: FACTION_COLORS[colorIndex].name,
                    color: FACTION_COLORS[colorIndex].color,
                    dark: FACTION_COLORS[colorIndex].dark,
                    isHuman: false,
                    controllerId: null,
                    ai: this.makeAiState(index),
                    scoreboard: null,
                    homeCoreId: null
                };
                this.factionOrder.push(key);
            }
        }
        this.buildLogicalWorld();
        this.buildSharedScoreboard();
        for (const playerId of this.playerOrder) {
            const player = this.players[playerId];
            this.buildPlayerView(player, false);
            this.focusHome(player, false);
            this.renderPlayerView(player);
        }
        this.refreshSharedScoreboard();
        this.base.node.onStateChange();
    }

    makeAiState(index) {
        return {
            personality: index % 3,
            aggression: [0.92, 1.08, 1.22][index % 3],
            reserve: [0.43, 0.34, 0.27][index % 3]
        };
    }

    buildLogicalWorld() {
        const world = this.currentWorld;
        const spawnIds = this.chooseSpawnCoreIds(world, this.factionOrder.length);
        const owners = {};
        for (let index = 0; index < spawnIds.length; index += 1) {
            owners[spawnIds[index]] = this.factionOrder[index];
            this.factions[this.factionOrder[index]].homeCoreId = spawnIds[index];
        }
        for (const spec of world.cores) {
            const ownerKey = owners[spec.id] || null;
            const core = {
                id: spec.id,
                x: spec.x,
                y: spec.y,
                radius: spec.radius,
                ownerKey,
                energy: ownerKey ? TUNING.STARTING_ENERGY : spec.neutralEnergy,
                neutralEnergy: spec.neutralEnergy,
                strategicValue: spec.strategicValue,
                region: spec.region,
                productionAccumulator: 0,
                sameOwnerNeighbors: 0
            };
            this.cores.push(core);
            this.coreById[core.id] = core;
        }
        for (const pair of world.links) this.edges.push({ aId: pair[0], bId: pair[1] });
        for (let index = 0; index < TUNING.MAX_FLEETS; index += 1) {
            this.fleets.push({
                active: false,
                slot: index,
                id: null,
                ownerKey: null,
                sourceId: null,
                destinationId: null,
                amount: 0,
                progress: 0,
                durationTicks: 1
            });
        }
        this.updateNetworkCounts();
    }

    chooseSpawnCoreIds(world, count) {
        const candidates = world.spawnCoreIds.map((id) => world.cores.find((core) => core.id === id));
        if (count >= candidates.length) return candidates.slice(0, count).map((core) => core.id);
        let best = null;
        const choose = (start, selected) => {
            if (selected.length === count) {
                let minimum = Infinity;
                let total = 0;
                for (let left = 0; left < selected.length; left += 1) {
                    for (let right = left + 1; right < selected.length; right += 1) {
                        const current = distance(selected[left], selected[right]);
                        minimum = Math.min(minimum, current);
                        total += current;
                    }
                }
                const score = minimum * 1000 + total;
                if (!best || score > best.score) best = { score, selected: selected.slice() };
                return;
            }
            for (let index = start; index <= candidates.length - (count - selected.length); index += 1) {
                selected.push(candidates[index]);
                choose(index + 1, selected);
                selected.pop();
            }
        };
        choose(0, []);
        return best.selected.map((core) => core.id);
    }

    buildSharedScoreboard() {
        this.sharedHudLayer.clearChildren();
        for (let index = 0; index < this.factionOrder.length; index += 1) {
            const faction = this.factions[this.factionOrder[index]];
            const width = 100 / this.factionOrder.length;
            const x = width * index + width / 2;
            const dot = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: polyCircle(x - 4, 3.3, 1.05, 12),
                fill: faction.color,
                color: faction.color,
                effects: glow(faction.color, 7)
            });
            const count = this.makeText('1', x, 2.2, 1.35, PALETTE.white);
            const name = this.makeText(faction.colorName, x, 4.8, this.factionOrder.length > 4 ? 0.82 : 0.98, faction.color);
            this.sharedHudLayer.addChildren(dot, count, name);
            faction.scoreboard = { dot, count, name };
        }
    }

    buildPlayerView(player, spectator) {
        const root = this.makeContainer([player.id]);
        const worldLayer = this.makeContainer([player.id]);
        const edgeLayer = this.makeContainer([player.id]);
        const coreLayer = this.makeContainer([player.id]);
        const fleetLayer = this.makeContainer([player.id]);
        const privateLayer = this.makeContainer([player.id]);
        const hudLayer = this.makeContainer([player.id]);
        root.addChildren(worldLayer, edgeLayer, coreLayer, fleetLayer, privateLayer, hudLayer);
        this.playerViewLayer.addChild(root);

        const view = {
            root,
            worldLayer,
            edgeLayer,
            coreLayer,
            fleetLayer,
            privateLayer,
            hudLayer,
            edgeSlots: [],
            coreSlots: [],
            fleetSlots: [],
            minimapMarkers: [],
            minimapViewport: null,
            selectionRing: null,
            status: null,
            sourceLabel: null,
            zoomLabel: null,
            buttons: [],
            cameraControlsRoot: null
        };
        player.view = view;
        player.spectator = Boolean(spectator);

        const worldPanel = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, TUNING.VIEW_TOP, 100, TUNING.VIEW_BOTTOM - TUNING.VIEW_TOP),
            fill: [3, 6, 14, 175],
            color: PALETTE.line,
            border: 1,
            playerIds: [player.id]
        });
        worldLayer.addChild(worldPanel);

        for (let index = 0; index < TUNING.MAX_VISIBLE_EDGES; index += 1) {
            const line = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: PALETTE.line,
                color: PALETTE.line,
                playerIds: [player.id]
            });
            edgeLayer.addChild(line);
            view.edgeSlots.push(line);
        }

        for (let index = 0; index < TUNING.MAX_VISIBLE_CORES; index += 1) {
            const body = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: PALETTE.neutral,
                color: PALETTE.neutral,
                border: 3,
                playerIds: [player.id]
            });
            const energy = this.makeText('', 0, 0, 1, PALETTE.background, 'center', [player.id]);
            coreLayer.addChildren(body, energy);
            view.coreSlots.push({ body, energy, coreId: null });
        }

        for (let index = 0; index < TUNING.MAX_VISIBLE_FLEETS; index += 1) {
            const trail = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: PALETTE.white,
                color: PALETTE.white,
                playerIds: [player.id]
            });
            const orb = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: PALETTE.white,
                color: PALETTE.white,
                effects: glow(PALETTE.white, 10),
                playerIds: [player.id]
            });
            fleetLayer.addChildren(trail, orb);
            view.fleetSlots.push({ trail, orb, fleetId: null });
        }

        view.selectionRing = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 0, 0, 0),
            fill: PALETTE.transparent,
            color: PALETTE.white,
            border: 7,
            playerIds: [player.id]
        });
        privateLayer.addChild(view.selectionRing);
        this.buildCameraControls(player);
        this.buildPlayerHud(player);
    }

    buildCameraControls(player) {
        const ids = [player.id];
        const root = this.makeContainer(ids);
        const controls = [
            { points: [[1.5, 44.5], [6.5, 39], [6.5, 50]], dx: -1, dy: 0 },
            { points: [[98.5, 44.5], [93.5, 39], [93.5, 50]], dx: 1, dy: 0 },
            { points: [[50, 8], [46, 13], [54, 13]], dx: 0, dy: -1 },
            { points: [[50, 81], [46, 76], [54, 76]], dx: 0, dy: 1 }
        ];
        for (const control of controls) {
            root.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: control.points,
                fill: [22, 32, 54, 210],
                color: PALETTE.lineBright,
                border: 3,
                playerIds: ids,
                onClick: (clickingPlayerId) => {
                    if (Number(clickingPlayerId) !== player.id) return;
                    this.panCamera(player, control.dx, control.dy);
                }
            }));
        }
        player.view.cameraControlsRoot = root;
        this.cameraControlLayer.addChild(root);
    }

    buildPlayerHud(player) {
        const view = player.view;
        const faction = player.factionKey ? this.factions[player.factionKey] : null;
        const accent = faction ? faction.color : PALETTE.lineBright;
        const dark = faction ? faction.dark : PALETTE.panelAlt;
        const ids = [player.id];

        const minimap = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(TUNING.MINIMAP_X, TUNING.MINIMAP_Y, TUNING.MINIMAP_W, TUNING.MINIMAP_H),
            fill: PALETTE.minimap,
            color: accent,
            border: 2,
            playerIds: ids,
            onClick: (clickingPlayerId, x, y) => this.handleMinimapTap(Number(clickingPlayerId), x, y)
        });
        view.hudLayer.addChild(minimap);

        const markerIds = this.currentWorld ? this.currentWorld.minimapCoreIds : [];
        for (let index = 0; index < markerIds.length; index += 1) {
            const marker = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: rectangle(0, 0, 0, 0),
                fill: PALETTE.neutral,
                color: PALETTE.neutral,
                playerIds: ids
            });
            view.hudLayer.addChild(marker);
            view.minimapMarkers.push({ marker, coreId: markerIds[index] });
        }
        view.minimapViewport = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 0, 0, 0),
            fill: PALETTE.transparent,
            color: PALETTE.white,
            border: 3,
            playerIds: ids
        });
        view.hudLayer.addChild(view.minimapViewport);

        view.status = this.makeText(player.spectator ? 'SPECTATING' : '', 64, 84.2, 1.05, accent, 'center', ids);
        view.sourceLabel = this.makeText('NO CORE SELECTED', 64, 87, 0.9, PALETTE.muted, 'center', ids);
        view.zoomLabel = this.makeText('ZOOM 92%', 91, 84.1, 0.8, PALETTE.muted, 'center', ids);
        view.hudLayer.addChildren(view.status, view.sourceLabel, view.zoomLabel);

        if (!player.spectator) {
            const percentages = [0.25, 0.5, 1];
            for (let index = 0; index < percentages.length; index += 1) {
                const value = percentages[index];
                const button = this.makeButton({
                    x: 35 + index * 12.5, y: 90, width: 11.5, height: 7,
                    label: `${Math.round(value * 100)}%`,
                    fill: value === player.sendPercent ? dark : PALETTE.panelAlt,
                    color: value === player.sendPercent ? accent : PALETTE.lineBright,
                    playerIds: ids,
                    onClick: (clickingPlayerId) => this.setSendPercent(Number(clickingPlayerId), value),
                    size: 1.25
                });
                view.buttons.push({ kind: 'send', value, button });
                view.hudLayer.addChild(button);
            }
        }
        const controls = [
            ['−', 74, () => this.changeZoom(player, -TUNING.ZOOM_STEP)],
            ['+', 83, () => this.changeZoom(player, TUNING.ZOOM_STEP)],
            ['H', 92, () => this.focusHome(player)]
        ];
        for (const item of controls) {
            const button = this.makeButton({
                x: item[1], y: 90, width: 7, height: 7, label: item[0], fill: PALETTE.panelAlt,
                color: PALETTE.lineBright, playerIds: ids,
                onClick: (clickingPlayerId) => {
                    if (Number(clickingPlayerId) !== player.id) return;
                    item[2]();
                }, size: 1.35
            });
            view.buttons.push({ kind: 'control', button });
            view.hudLayer.addChild(button);
        }
    }

    worldToScreen(player, x, y) {
        return {
            x: TUNING.VIEW_CENTER_X + (x - player.camera.x) * player.camera.zoom,
            y: TUNING.VIEW_CENTER_Y + (y - player.camera.y) * player.camera.zoom
        };
    }

    screenToWorld(player, x, y) {
        return {
            x: player.camera.x + (x - TUNING.VIEW_CENTER_X) / player.camera.zoom,
            y: player.camera.y + (y - TUNING.VIEW_CENTER_Y) / player.camera.zoom
        };
    }

    isWorldPointVisible(player, x, y, padding = 0) {
        const screen = this.worldToScreen(player, x, y);
        return screen.x >= -padding && screen.x <= 100 + padding
            && screen.y >= TUNING.VIEW_TOP - padding && screen.y <= TUNING.VIEW_BOTTOM + padding;
    }

    renderPlayerView(player) {
        if (!player || !player.view || !this.currentWorld) return;
        const view = player.view;
        const visibleCores = this.cores
            .filter((core) => this.isWorldPointVisible(player, core.x, core.y, 10))
            .sort((a, b) => distance(a, player.camera) - distance(b, player.camera))
            .slice(0, TUNING.MAX_VISIBLE_CORES);
        const visibleCoreIds = {};
        for (const core of visibleCores) visibleCoreIds[core.id] = true;

        for (let index = 0; index < view.coreSlots.length; index += 1) {
            const slot = view.coreSlots[index];
            const core = visibleCores[index];
            if (!core) {
                slot.coreId = null;
                slot.body.node.coordinates2d = rectangle(0, 0, 0, 0);
                slot.energy.node.text = { text: '', x: 0, y: 0, size: 1, align: 'center', color: PALETTE.white, font: 'monospace' };
                continue;
            }
            slot.coreId = core.id;
            const point = this.worldToScreen(player, core.x, core.y);
            const radius = clamp(core.radius * player.camera.zoom, 1.65, 6.8);
            const faction = core.ownerKey ? this.factions[core.ownerKey] : null;
            const color = faction ? faction.color : PALETTE.neutral;
            const dark = faction ? faction.dark : PALETTE.neutralDark;
            slot.body.node.coordinates2d = polyCircle(point.x, point.y, radius, radius > 4.5 ? 20 : 14);
            slot.body.node.fill = color;
            slot.body.node.color = dark;
            slot.body.node.border = Math.max(2, Math.round(radius * 0.55));
            slot.body.node.effects = glow(color, faction ? 10 : 5);
            const showEnergy = player.camera.zoom >= 0.78;
            slot.energy.node.text = {
                text: showEnergy ? String(Math.floor(core.energy)) : '',
                x: point.x,
                y: point.y - clamp(radius * 0.28, 0.45, 1.1),
                size: clamp(radius * 0.42, 0.8, 1.8),
                align: 'center',
                color: faction ? PALETTE.background : PALETTE.backgroundAlt,
                font: 'monospace'
            };
        }

        const visibleEdges = this.edges.filter((edge) => visibleCoreIds[edge.aId] && visibleCoreIds[edge.bId]).slice(0, TUNING.MAX_VISIBLE_EDGES);
        for (let index = 0; index < view.edgeSlots.length; index += 1) {
            const line = view.edgeSlots[index];
            const edge = visibleEdges[index];
            if (!edge) {
                line.node.coordinates2d = rectangle(0, 0, 0, 0);
                continue;
            }
            const a = this.coreById[edge.aId];
            const b = this.coreById[edge.bId];
            const sa = this.worldToScreen(player, a.x, a.y);
            const sb = this.worldToScreen(player, b.x, b.y);
            line.node.coordinates2d = thickLine(sa.x, sa.y, sb.x, sb.y, clamp(0.35 * player.camera.zoom, 0.22, 0.7));
            if (a.ownerKey && a.ownerKey === b.ownerKey && this.factions[a.ownerKey]) {
                line.node.fill = this.factions[a.ownerKey].dark;
                line.node.effects = glow(this.factions[a.ownerKey].color, 5);
            } else {
                line.node.fill = PALETTE.line;
                line.node.effects = null;
            }
        }

        const visibleFleets = this.fleets
            .filter((fleet) => fleet.active)
            .map((fleet) => ({ fleet, point: this.getFleetWorldPoint(fleet) }))
            .filter((item) => this.isWorldPointVisible(player, item.point.x, item.point.y, 8))
            .sort((a, b) => distance(a.point, player.camera) - distance(b.point, player.camera))
            .slice(0, TUNING.MAX_VISIBLE_FLEETS);
        for (let index = 0; index < view.fleetSlots.length; index += 1) {
            const slot = view.fleetSlots[index];
            const item = visibleFleets[index];
            if (!item) {
                slot.fleetId = null;
                slot.trail.node.coordinates2d = rectangle(0, 0, 0, 0);
                slot.orb.node.coordinates2d = rectangle(0, 0, 0, 0);
                continue;
            }
            const fleet = item.fleet;
            const faction = this.factions[fleet.ownerKey];
            const source = this.coreById[fleet.sourceId];
            const destination = this.coreById[fleet.destinationId];
            const previousProgress = Math.max(0, fleet.progress - 0.045);
            const previousWorld = {
                x: lerp(source.x, destination.x, previousProgress),
                y: lerp(source.y, destination.y, previousProgress)
            };
            const currentScreen = this.worldToScreen(player, item.point.x, item.point.y);
            const previousScreen = this.worldToScreen(player, previousWorld.x, previousWorld.y);
            const orbRadius = clamp(1.25 * player.camera.zoom, 0.7, 1.8);
            slot.fleetId = fleet.id;
            slot.trail.node.coordinates2d = thickLine(previousScreen.x, previousScreen.y, currentScreen.x, currentScreen.y, orbRadius * 0.85);
            slot.trail.node.fill = faction.dark;
            slot.trail.node.color = colorWithAlpha(PALETTE.white, 170);
            slot.orb.node.coordinates2d = polyCircle(currentScreen.x, currentScreen.y, orbRadius, 12);
            slot.orb.node.fill = faction.color;
            slot.orb.node.color = faction.color;
            slot.orb.node.effects = glow(faction.color, 8);
        }

        if (player.selectedCoreId && this.coreById[player.selectedCoreId]) {
            const selected = this.coreById[player.selectedCoreId];
            if (this.isWorldPointVisible(player, selected.x, selected.y, 5)) {
                const point = this.worldToScreen(player, selected.x, selected.y);
                const radius = clamp((selected.radius + 2.3) * player.camera.zoom, 3, 9);
                const faction = this.factions[player.factionKey];
                view.selectionRing.node.coordinates2d = polyCircle(point.x, point.y, radius, 22);
                view.selectionRing.node.color = faction ? faction.color : PALETTE.white;
                view.selectionRing.node.effects = faction ? glow(faction.color, 11) : null;
            } else {
                view.selectionRing.node.coordinates2d = rectangle(0, 0, 0, 0);
            }
        } else {
            view.selectionRing.node.coordinates2d = rectangle(0, 0, 0, 0);
        }
        this.renderMinimap(player);
        this.refreshPlayerHud(player);
    }

    renderMinimap(player) {
        const view = player.view;
        const world = this.currentWorld;
        const minX = world.bounds.minX;
        const minY = world.bounds.minY;
        const width = world.bounds.maxX - minX;
        const height = world.bounds.maxY - minY;
        const convert = (x, y) => ({
            x: TUNING.MINIMAP_X + (x - minX) / width * TUNING.MINIMAP_W,
            y: TUNING.MINIMAP_Y + (y - minY) / height * TUNING.MINIMAP_H
        });
        for (const item of view.minimapMarkers) {
            const core = this.coreById[item.coreId];
            if (!core) continue;
            const point = convert(core.x, core.y);
            const faction = core.ownerKey ? this.factions[core.ownerKey] : null;
            const color = faction ? faction.color : PALETTE.neutral;
            item.marker.node.coordinates2d = polyCircle(point.x, point.y, core.id === 'center' ? 0.72 : 0.5, 8);
            item.marker.node.fill = color;
            item.marker.node.color = color;
        }
        const halfWorldWidth = 50 / player.camera.zoom;
        const halfWorldHeight = (TUNING.VIEW_BOTTOM - TUNING.VIEW_TOP) / 2 / player.camera.zoom;
        const topLeft = convert(player.camera.x - halfWorldWidth, player.camera.y - halfWorldHeight);
        const bottomRight = convert(player.camera.x + halfWorldWidth, player.camera.y + halfWorldHeight);
        view.minimapViewport.node.coordinates2d = rectangle(
            clamp(topLeft.x, TUNING.MINIMAP_X, TUNING.MINIMAP_X + TUNING.MINIMAP_W),
            clamp(topLeft.y, TUNING.MINIMAP_Y, TUNING.MINIMAP_Y + TUNING.MINIMAP_H),
            clamp(bottomRight.x - topLeft.x, 1, TUNING.MINIMAP_W),
            clamp(bottomRight.y - topLeft.y, 1, TUNING.MINIMAP_H)
        );
    }

    refreshPlayerHud(player) {
        if (!player.view) return;
        const view = player.view;
        const faction = player.factionKey ? this.factions[player.factionKey] : null;
        const accent = faction ? faction.color : PALETTE.lineBright;
        if (view.zoomLabel) {
            view.zoomLabel.node.text = {
                text: `ZOOM ${Math.round(player.camera.zoom * 100)}%`,
                x: 91, y: 84.1, size: 0.8, align: 'center', color: PALETTE.muted, font: 'monospace'
            };
        }
        if (view.sourceLabel) {
            const selected = player.selectedCoreId ? this.coreById[player.selectedCoreId] : null;
            view.sourceLabel.node.text = {
                text: selected ? `SOURCE ${Math.floor(selected.energy)} • TAP TARGET` : (player.spectator ? 'WORLD OVERVIEW' : 'NO CORE SELECTED'),
                x: 64, y: 87, size: 0.9, align: 'center', color: selected ? accent : PALETTE.muted, font: 'monospace'
            };
        }
        for (const item of view.buttons) {
            if (item.kind !== 'send') continue;
            const selected = item.value === player.sendPercent;
            item.button.node.fill = selected && faction ? faction.dark : PALETTE.panelAlt;
            item.button.node.color = selected && faction ? faction.color : PALETTE.lineBright;
        }
    }

    handleWorldTap(playerId, x, y) {
        if (this.phase !== 'running') return;
        const player = this.players[playerId];
        if (!player || player.spectator || !player.factionKey) return;
        if (y < TUNING.VIEW_TOP || y > TUNING.VIEW_BOTTOM) return;
        const worldPoint = this.screenToWorld(player, x, y);
        const core = this.findCoreAtWorld(worldPoint.x, worldPoint.y, TUNING.MAP_TAP_RADIUS_SCREEN / player.camera.zoom);
        if (!core) {
            this.clearSelection(player, true);
            return;
        }
        if (!player.selectedCoreId) {
            if (core.ownerKey !== player.factionKey) {
                this.setStatus(player, 'SELECT ONE OF YOUR CORES');
                this.base.node.onStateChange();
                return;
            }
            player.selectedCoreId = core.id;
            this.setStatus(player, `${Math.floor(core.energy)} READY — CHOOSE TARGET`);
            this.renderPlayerView(player);
            this.base.node.onStateChange();
            return;
        }
        const source = this.coreById[player.selectedCoreId];
        if (!source || source.ownerKey !== player.factionKey) {
            this.clearSelection(player, true);
            return;
        }
        if (source.id === core.id) {
            this.clearSelection(player, true);
            return;
        }
        const launched = this.launchFleet(player.factionKey, source.id, core.id, player.sendPercent);
        if (launched) {
            this.setStatus(player, `${launched.amount} ENERGY SENT`);
            player.selectedCoreId = null;
            for (const playerKey of this.playerOrder) this.renderPlayerView(this.players[playerKey]);
            this.base.node.onStateChange();
        } else {
            this.setStatus(player, 'NOT ENOUGH ENERGY OR FLEET CAP');
            this.base.node.onStateChange();
        }
    }

    handleMinimapTap(playerId, x, y) {
        if (this.phase !== 'running') return;
        const player = this.players[playerId];
        if (!player) return;
        if (x < TUNING.MINIMAP_X || x > TUNING.MINIMAP_X + TUNING.MINIMAP_W
            || y < TUNING.MINIMAP_Y || y > TUNING.MINIMAP_Y + TUNING.MINIMAP_H) return;
        const world = this.currentWorld;
        player.camera.targetX = world.bounds.minX + (x - TUNING.MINIMAP_X) / TUNING.MINIMAP_W * (world.bounds.maxX - world.bounds.minX);
        player.camera.targetY = world.bounds.minY + (y - TUNING.MINIMAP_Y) / TUNING.MINIMAP_H * (world.bounds.maxY - world.bounds.minY);
        this.clampCamera(player);
    }

    setSendPercent(playerId, value) {
        const player = this.players[playerId];
        if (!player || player.spectator || this.phase !== 'running') return;
        player.sendPercent = value;
        this.setStatus(player, `SEND ${Math.round(value * 100)}%`);
        this.refreshPlayerHud(player);
        this.base.node.onStateChange();
    }

    tickCameras() {
        const changedPlayers = [];
        const dt = 1 / TUNING.TICK_RATE;
        const moveAlpha = 1 - Math.exp(-TUNING.CAMERA_EASE_PER_SECOND * dt);
        const zoomAlpha = 1 - Math.exp(-TUNING.ZOOM_EASE_PER_SECOND * dt);
        for (const playerId of this.playerOrder) {
            const player = this.players[playerId];
            if (!player || !player.view || !player.cameraInput) continue;
            const horizontal = (player.cameraInput.right ? 1 : 0) - (player.cameraInput.left ? 1 : 0);
            const vertical = (player.cameraInput.down ? 1 : 0) - (player.cameraInput.up ? 1 : 0);
            if (horizontal || vertical) {
                const length = Math.max(1, Math.sqrt(horizontal * horizontal + vertical * vertical));
                const worldSpeed = TUNING.PAN_SPEED_SCREEN_PER_SECOND / Math.max(TUNING.MIN_ZOOM, player.camera.targetZoom);
                player.camera.targetX += horizontal / length * worldSpeed * dt;
                player.camera.targetY += vertical / length * worldSpeed * dt;
            }
            this.clampCamera(player);
            const beforeX = player.camera.x;
            const beforeY = player.camera.y;
            const beforeZoom = player.camera.zoom;
            player.camera.x = lerp(player.camera.x, player.camera.targetX, moveAlpha);
            player.camera.y = lerp(player.camera.y, player.camera.targetY, moveAlpha);
            player.camera.zoom = lerp(player.camera.zoom, player.camera.targetZoom, zoomAlpha);
            if (Math.abs(player.camera.x - player.camera.targetX) < TUNING.CAMERA_EPSILON) player.camera.x = player.camera.targetX;
            if (Math.abs(player.camera.y - player.camera.targetY) < TUNING.CAMERA_EPSILON) player.camera.y = player.camera.targetY;
            if (Math.abs(player.camera.zoom - player.camera.targetZoom) < TUNING.CAMERA_EPSILON) player.camera.zoom = player.camera.targetZoom;
            this.clampCamera(player);
            if (Math.abs(beforeX - player.camera.x) > TUNING.CAMERA_EPSILON
                || Math.abs(beforeY - player.camera.y) > TUNING.CAMERA_EPSILON
                || Math.abs(beforeZoom - player.camera.zoom) > TUNING.CAMERA_EPSILON) {
                changedPlayers.push(player);
            }
        }
        return changedPlayers;
    }

    panCamera(player, dx, dy) {
        if (!player || !player.camera) return;
        const amount = TUNING.PAN_STEP_SCREEN / Math.max(TUNING.MIN_ZOOM, player.camera.targetZoom);
        player.camera.targetX += dx * amount;
        player.camera.targetY += dy * amount;
        this.clampCamera(player);
    }

    changeZoom(player, delta) {
        if (!player || !player.camera) return;
        player.camera.targetZoom = clamp(round1(player.camera.targetZoom + delta), TUNING.MIN_ZOOM, TUNING.MAX_ZOOM);
        this.clampCamera(player);
    }

    clampCamera(player) {
        const world = this.currentWorld;
        if (!world || !player || !player.camera) return;
        const clampPoint = (zoom, x, y) => {
            const halfW = 50 / zoom;
            const halfH = (TUNING.VIEW_BOTTOM - TUNING.VIEW_TOP) / 2 / zoom;
            return {
                x: clamp(x, world.bounds.minX + halfW, world.bounds.maxX - halfW),
                y: clamp(y, world.bounds.minY + halfH, world.bounds.maxY - halfH)
            };
        };
        const current = clampPoint(player.camera.zoom, player.camera.x, player.camera.y);
        player.camera.x = current.x;
        player.camera.y = current.y;
        const target = clampPoint(player.camera.targetZoom, player.camera.targetX, player.camera.targetY);
        player.camera.targetX = target.x;
        player.camera.targetY = target.y;
    }

    focusHome(player, notify = true) {
        if (!player) return;
        const faction = player.factionKey ? this.factions[player.factionKey] : null;
        const home = faction && this.coreById[faction.homeCoreId];
        const target = home || { x: 150, y: 150 };
        player.camera.targetX = target.x;
        player.camera.targetY = target.y;
        player.camera.targetZoom = TUNING.DEFAULT_ZOOM;
        if (!notify) {
            player.camera.x = target.x;
            player.camera.y = target.y;
            player.camera.zoom = TUNING.DEFAULT_ZOOM;
        }
        this.clampCamera(player);
        if (!notify && player.view) this.renderPlayerView(player);
    }

    focusSelection(player) {
        if (!player || !player.selectedCoreId) return;
        const core = this.coreById[player.selectedCoreId];
        if (!core) return;
        player.camera.targetX = core.x;
        player.camera.targetY = core.y;
        this.clampCamera(player);
    }

    clearSelection(player, notify) {
        if (!player) return;
        player.selectedCoreId = null;
        if (player.view) this.renderPlayerView(player);
        if (notify) this.base.node.onStateChange();
    }

    findCoreAtWorld(x, y, radius) {
        let best = null;
        let bestDistance = Infinity;
        for (const core of this.cores) {
            const current = distance(core, { x, y });
            if (current <= Math.max(radius, core.radius + 2) && current < bestDistance) {
                best = core;
                bestDistance = current;
            }
        }
        return best;
    }

    launchFleet(ownerKey, sourceId, destinationId, percent) {
        const source = this.coreById[sourceId];
        const destination = this.coreById[destinationId];
        if (!source || !destination || source.ownerKey !== ownerKey) return null;
        const amount = Math.floor(source.energy * percent);
        if (amount < 2) return null;
        const slot = this.fleets.find((fleet) => !fleet.active);
        if (!slot) return null;
        source.energy -= amount;
        slot.active = true;
        slot.id = this.nextFleetId++;
        slot.ownerKey = ownerKey;
        slot.sourceId = sourceId;
        slot.destinationId = destinationId;
        slot.amount = amount;
        slot.progress = 0;
        slot.durationTicks = Math.max(1, Math.round(distance(source, destination) / TUNING.FLEET_SPEED_PER_SECOND * TUNING.TICK_RATE));
        return slot;
    }

    getFleetWorldPoint(fleet) {
        const source = this.coreById[fleet.sourceId];
        const destination = this.coreById[fleet.destinationId];
        return {
            x: lerp(source.x, destination.x, clamp(fleet.progress, 0, 1)),
            y: lerp(source.y, destination.y, clamp(fleet.progress, 0, 1))
        };
    }

    tickProduction() {
        let changed = false;
        this.updateNetworkCounts();
        for (const core of this.cores) {
            if (!core.ownerKey || core.energy >= TUNING.MAX_CORE_ENERGY) continue;
            const bonus = Math.min(TUNING.MAX_LINK_BONUS, core.sameOwnerNeighbors * TUNING.LINK_BONUS_PER_NEIGHBOR);
            core.productionAccumulator += TUNING.BASE_PRODUCTION_PER_SECOND * (1 + bonus) / TUNING.TICK_RATE;
            if (core.productionAccumulator >= 1) {
                const whole = Math.floor(core.productionAccumulator);
                core.productionAccumulator -= whole;
                core.energy = Math.min(TUNING.MAX_CORE_ENERGY, core.energy + whole);
                changed = true;
            }
        }
        return changed;
    }

    tickFleets() {
        let changed = false;
        for (const fleet of this.fleets) {
            if (!fleet.active) continue;
            fleet.progress += 1 / fleet.durationTicks;
            if (fleet.progress >= 1) this.resolveFleetArrival(fleet);
            changed = true;
        }
        return changed;
    }

    resolveFleetArrival(fleet) {
        const destination = this.coreById[fleet.destinationId];
        if (destination) {
            if (destination.ownerKey === fleet.ownerKey) {
                destination.energy = Math.min(TUNING.MAX_CORE_ENERGY, destination.energy + fleet.amount);
            } else if (fleet.amount >= destination.energy) {
                destination.ownerKey = fleet.ownerKey;
                destination.energy = clamp(fleet.amount - Math.floor(destination.energy), 1, TUNING.MAX_CORE_ENERGY);
                destination.productionAccumulator = 0;
                for (const playerId of this.playerOrder) {
                    const player = this.players[playerId];
                    if (player.selectedCoreId === destination.id) player.selectedCoreId = null;
                }
            } else {
                destination.energy = Math.max(0, destination.energy - fleet.amount);
            }
        }
        fleet.active = false;
        fleet.id = null;
        fleet.ownerKey = null;
        fleet.sourceId = null;
        fleet.destinationId = null;
        fleet.amount = 0;
        fleet.progress = 0;
    }

    updateNetworkCounts() {
        for (const core of this.cores) core.sameOwnerNeighbors = 0;
        for (const edge of this.edges) {
            const a = this.coreById[edge.aId];
            const b = this.coreById[edge.bId];
            if (a && b && a.ownerKey && a.ownerKey === b.ownerKey) {
                a.sameOwnerNeighbors += 1;
                b.sameOwnerNeighbors += 1;
            }
        }
    }

    runAiTurn() {
        let changed = false;
        for (const factionKey of this.factionOrder) {
            const faction = this.factions[factionKey];
            if (!faction || faction.isHuman || !faction.ai) continue;
            changed = this.runSingleAi(faction) || changed;
        }
        return changed;
    }

    runSingleAi(faction) {
        const owned = this.cores.filter((core) => core.ownerKey === faction.key);
        if (!owned.length) return false;
        const threatened = this.findThreatenedCore(faction.key);
        if (threatened) {
            const source = owned.filter((core) => core.id !== threatened.id && core.energy >= TUNING.AI_MIN_SEND).sort((a, b) => b.energy - a.energy)[0];
            if (source) return Boolean(this.launchFleet(faction.key, source.id, threatened.id, 0.5));
        }
        const source = owned.filter((core) => core.energy >= TUNING.AI_MIN_SEND).sort((a, b) => b.energy - a.energy)[0];
        if (!source) return false;
        let bestTarget = null;
        let bestScore = -Infinity;
        for (const target of this.cores) {
            if (target.id === source.id || target.ownerKey === faction.key) continue;
            const dist = distance(source, target);
            const neutralBonus = target.ownerKey ? 0 : 18;
            const strategicBonus = target.strategicValue || 0;
            const linkBonus = this.countOwnedNeighbors(target.id, faction.key) * 6;
            const enemyPenalty = target.ownerKey ? target.energy * 0.64 : target.energy * 0.42;
            const regionBonus = target.region !== source.region ? 3 : 0;
            const personalityBonus = faction.ai.personality === 0 && !target.ownerKey ? 7 : 0;
            const raiderBonus = faction.ai.personality === 2 && target.ownerKey ? 8 : 0;
            const score = neutralBonus + strategicBonus + linkBonus + regionBonus + personalityBonus + raiderBonus
                - enemyPenalty - dist * 0.11 + Math.random() * 6;
            if (score > bestScore) {
                bestScore = score;
                bestTarget = target;
            }
        }
        if (!bestTarget) return false;
        const predictedSend = source.energy * (1 - faction.ai.reserve) * faction.ai.aggression;
        if (predictedSend < Math.max(TUNING.AI_MIN_SEND, bestTarget.energy * 0.72)) return false;
        const percent = source.energy > 82 ? 1 : source.energy > 40 ? 0.5 : 0.25;
        return Boolean(this.launchFleet(faction.key, source.id, bestTarget.id, percent));
    }

    findThreatenedCore(factionKey) {
        let best = null;
        let worst = 0;
        for (const core of this.cores) {
            if (core.ownerKey !== factionKey) continue;
            let hostile = 0;
            for (const fleet of this.fleets) {
                if (fleet.active && fleet.destinationId === core.id && fleet.ownerKey !== factionKey) hostile += fleet.amount;
            }
            const margin = hostile - core.energy;
            if (margin > worst) {
                worst = margin;
                best = core;
            }
        }
        return best;
    }

    countOwnedNeighbors(coreId, factionKey) {
        let count = 0;
        for (const edge of this.edges) {
            let otherId = null;
            if (edge.aId === coreId) otherId = edge.bId;
            if (edge.bId === coreId) otherId = edge.aId;
            if (otherId && this.coreById[otherId].ownerKey === factionKey) count += 1;
        }
        return count;
    }

    tickStatuses() {
        let changed = false;
        for (const playerId of this.playerOrder) {
            const player = this.players[playerId];
            if (!player || player.statusTicks <= 0 || !player.view || !player.view.status) continue;
            player.statusTicks -= 1;
            if (player.statusTicks === 0) {
                player.view.status.node.text = {
                    text: player.spectator ? 'SPECTATING' : '', x: 64, y: 84.2, size: 1.05,
                    align: 'center', color: player.factionKey ? this.factions[player.factionKey].color : PALETTE.muted, font: 'monospace'
                };
                changed = true;
            }
        }
        return changed;
    }

    setStatus(player, text) {
        if (!player || !player.view || !player.view.status) return;
        player.statusTicks = Math.round(TUNING.STATUS_SECONDS * TUNING.TICK_RATE);
        const color = player.factionKey && this.factions[player.factionKey] ? this.factions[player.factionKey].color : PALETTE.muted;
        player.view.status.node.text = { text, x: 64, y: 84.2, size: 1.05, align: 'center', color, font: 'monospace' };
    }

    refreshSharedScoreboard() {
        for (const factionKey of this.factionOrder) {
            const faction = this.factions[factionKey];
            if (!faction || !faction.scoreboard) continue;
            const count = this.cores.filter((core) => core.ownerKey === factionKey).length;
            const x = faction.scoreboard.count.node.text.x;
            faction.scoreboard.count.node.text = {
                text: String(count), x, y: 2.2, size: 1.35, align: 'center',
                color: count ? PALETTE.white : PALETTE.muted, font: 'monospace'
            };
            faction.scoreboard.dot.node.fill = count ? faction.color : PALETTE.neutralDark;
        }
    }

    checkForWinner() {
        const alive = this.factionOrder.filter((factionKey) => {
            const ownsCore = this.cores.some((core) => core.ownerKey === factionKey);
            const hasFleet = this.fleets.some((fleet) => fleet.active && fleet.ownerKey === factionKey);
            return ownsCore || hasFleet;
        });
        if (alive.length === 1 && this.elapsedTicks > TUNING.TICK_RATE * 4) {
            this.endGame(alive[0]);
            return true;
        }
        return false;
    }

    endGame(winnerKey) {
        this.phase = 'gameover';
        this.winnerKey = winnerKey;
        this.overlayLayer.clearChildren();
        const faction = this.factions[winnerKey];
        const color = faction ? faction.color : PALETTE.white;
        this.overlayLayer.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: rectangle(0, 0, 100, 100),
            fill: [4, 7, 16, 238],
            color: PALETTE.white
        }));
        this.overlayLayer.addChild(this.makeText('THE EXPANSE IS YOURS', 50, 33, 3.3, color));
        this.overlayLayer.addChild(this.makeText(faction ? faction.name.toUpperCase() : 'UNKNOWN', 50, 44, 4.4, PALETTE.white));
        this.overlayLayer.addChild(this.makeText(`${this.cores.filter((core) => core.ownerKey === winnerKey).length} CORES CONTROLLED`, 50, 53, 1.4, color));
        this.overlayLayer.addChild(this.makeButton({
            x: 19, y: 65, width: 28, height: 10, label: 'PLAY AGAIN', fill: faction ? faction.dark : PALETTE.panelAlt,
            color, onClick: (playerId) => this.startGame(Number(playerId)), size: 1.8
        }));
        this.overlayLayer.addChild(this.makeButton({
            x: 53, y: 65, width: 28, height: 10, label: 'WORLD SELECT', fill: PALETTE.panelAlt,
            color: PALETTE.lineBright, onClick: () => this.renderLobby(), size: 1.55
        }));
        this.base.node.onStateChange();
    }
}

PulsefrontExpanse.WORLDS = WORLDS;
PulsefrontExpanse.generateMegaworld = generateMegaworld;
PulsefrontExpanse.TUNING = TUNING;

function formatExpanseClock(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

const originalExpanseRenderLobby = PulsefrontExpanse.prototype.renderLobby;
PulsefrontExpanse.prototype.renderLobby = function renderExpanseLobbyWithModeExit() {
    originalExpanseRenderLobby.call(this);
    this.overlayLayer.addChild(this.makeButton({
        x: 2,
        y: 2,
        width: 16,
        height: 6,
        label: 'MODES',
        fill: PALETTE.panelAlt,
        color: PALETTE.lineBright,
        onClick: () => {
            if (typeof this.onExitMode === 'function') this.onExitMode();
        },
        size: 1.1
    }));
};

const originalExpanseEndGame = PulsefrontExpanse.prototype.endGame;
PulsefrontExpanse.prototype.endGame = function endExpanseGame(winnerKey) {
    this.lastElapsedSeconds = this.elapsedTicks / TUNING.TICK_RATE;
    originalExpanseEndGame.call(this, winnerKey);
    this.overlayLayer.addChild(this.makeText(
        `WAR TIME ${formatExpanseClock(this.lastElapsedSeconds)}`,
        50,
        58.5,
        1.2,
        PALETTE.muted
    ));
    this.base.node.onStateChange();
};

return PulsefrontExpanse;
})();

const MENU = {
    background: [4, 7, 16, 255],
    panel: [13, 21, 39, 255],
    panelAlt: [23, 34, 58, 255],
    white: [244, 248, 255, 255],
    muted: [151, 165, 190, 255],
    cyan: [61, 224, 255, 255],
    cyanDark: [17, 99, 120, 255],
    gold: [255, 205, 65, 255],
    line: [76, 101, 141, 255],
    transparent: [0, 0, 0, 0]
};

class PulsefrontComplete extends ViewableGame {
    static metadata() {
        return {
            isTest: true,
            name: 'Pulsefront',
            thumbnail: './assets/thumbnail.png',
            author: "Joseph Garcia",
            description: 'Fast curated conquest maps and vast scrollable worlds in one strategy game.',
            aspectRatio: { x: 1, y: 1 },
            tickRate: 60,
            maxPlayers: 6,
            gameId: "2524d7a6-34e7-5968-a998-dee74432c143"
        };
    }

    constructor() {
        super(300);
        this.players = {};
        this.playerOrder = [];
        this.activeMode = null;
        this.activeGame = null;
        this.sessionRecords = {};

        this.base = this.getViewRoot();
        this.base.node.coordinates2d = ShapeUtils.rectangle(0, 0, 100, 100);
        this.base.node.fill = MENU.background;
        this.base.node.color = MENU.white;
        this.menuLayer = this.makeContainer();
        this.activeLayer = this.makeContainer();
        this.base.addChildren(this.menuLayer, this.activeLayer);
        this.renderModeMenu();
    }

    getLayers() {
        return [{ root: this.getViewRoot() }];
    }

    canAddPlayer() {
        return this.playerOrder.length < 6;
    }

    makeContainer() {
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill: MENU.transparent,
            color: MENU.white
        });
    }

    makeText(text, x, y, size, color, align = 'center') {
        return new GameNode.Text({
            textInfo: { text, x, y, size, align, color, font: 'monospace' }
        });
    }

    makeButton({ x, y, width, height, label, subtitle, fill, color, onClick }) {
        const button = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, width, height),
            fill,
            color,
            border: 3,
            onClick
        });
        button.addChild(this.makeText(label, x + width / 2, y + 5.4, 2.15, MENU.white));
        button.addChild(this.makeText(subtitle, x + width / 2, y + 10.1, 1.6, MENU.muted));
        return button;
    }

    renderModeMenu() {
        this.activeMode = null;
        this.activeGame = null;
        this.activeLayer.clearChildren();
        this.menuLayer.clearChildren();

        this.menuLayer.addChild(this.makeText('CHOOSE A MATCH', 50, 18, 1.3, MENU.white));

        this.menuLayer.addChild(this.makeButton({
            x: 12,
            y: 29,
            width: 76,
            height: 16,
            label: 'CLASSIC CONQUEST',
            subtitle: 'Quick matches on small maps',
            fill: MENU.cyanDark,
            color: MENU.cyan,
            onClick: () => this.startMode('classic')
        }));

        this.menuLayer.addChild(this.makeButton({
            x: 12,
            y: 51,
            width: 76,
            height: 16,
            label: 'EXPANSE',
            subtitle: 'Longer battles across large worlds',
            fill: MENU.panelAlt,
            color: MENU.gold,
            onClick: () => this.startMode('expanse')
        }));

        const medals = Object.values(this.sessionRecords);
        const golds = medals.filter((record) => record.medal === 'gold').length;
        const silvers = medals.filter((record) => record.medal === 'silver').length;
        const bronzes = medals.filter((record) => record.medal === 'bronze').length;
        if (golds + silvers + bronzes) this.menuLayer.addChild(this.makeText(
            `SESSION MEDALS   GOLD ${golds}   SILVER ${silvers}   BRONZE ${bronzes}`,
            50,
            75,
            1.05,
            medals.length ? MENU.gold : MENU.muted
        ));

        const count = this.playerOrder.length;
        this.menuLayer.addChild(this.makeText(
            `${count} PLAYER${count === 1 ? '' : 'S'} CONNECTED`,
            50,
            84,
            1.3,
            count ? MENU.cyan : MENU.muted
        ));
        this.base.node.onStateChange();
    }

    startMode(mode) {
        if (this.activeGame) return;
        this.activeMode = mode;
        this.menuLayer.clearChildren();
        this.activeLayer.clearChildren();

        const child = mode === 'classic' ? new PulsefrontClassic() : new PulsefrontExpanse();
        child.onExitMode = () => this.exitMode();
        child.sessionRecords = this.sessionRecords;
        const childNotify = child.base.node.onStateChange.bind(child.base.node);
        child.base.node.onStateChange = () => {
            childNotify();
            this.base.node.onStateChange();
        };
        this.activeGame = child;
        this.activeLayer.addChild(child.base);

        for (const id of this.playerOrder) {
            const player = this.players[id];
            child.handleNewPlayer({ playerId: id, info: { name: player.name } });
        }
        this.base.node.onStateChange();
    }

    exitMode() {
        this.activeLayer.clearChildren();
        this.activeGame = null;
        this.activeMode = null;
        this.renderModeMenu();
    }

    handleNewPlayer({ playerId, info }) {
        const id = Number(playerId);
        if (this.players[id]) return;
        this.players[id] = {
            id,
            name: info && info.name ? String(info.name).slice(0, 16) : `PLAYER ${id}`
        };
        this.playerOrder.push(id);
        if (this.activeGame) this.activeGame.handleNewPlayer({ playerId: id, info });
        else this.renderModeMenu();
    }

    handlePlayerDisconnect(playerId) {
        const id = Number(playerId);
        if (!this.players[id]) return;
        if (this.activeGame) this.activeGame.handlePlayerDisconnect(id);
        delete this.players[id];
        this.playerOrder = this.playerOrder.filter((value) => value !== id);
        if (!this.activeGame) this.renderModeMenu();
    }

    handleKeyDown(playerId, key) {
        if (this.activeGame) {
            this.activeGame.handleKeyDown(playerId, key);
            return;
        }
        const lower = String(key).toLowerCase();
        if (lower === '1' || lower === 'c' || lower === 'enter' || lower === ' ') this.startMode('classic');
        if (lower === '2' || lower === 'e') this.startMode('expanse');
    }

    handleKeyUp(playerId, key) {
        if (this.activeGame && typeof this.activeGame.handleKeyUp === 'function') {
            this.activeGame.handleKeyUp(playerId, key);
        }
    }

    tick() {
        if (this.activeGame) this.activeGame.tick();
    }
}

PulsefrontComplete.Classic = PulsefrontClassic;
PulsefrontComplete.Expanse = PulsefrontExpanse;
PulsefrontComplete.MAPS = PulsefrontClassic.MAPS;
PulsefrontComplete.WORLDS = PulsefrontExpanse.WORLDS;
PulsefrontComplete.CLASSIC_MEDAL_TARGETS = PulsefrontClassic.CLASSIC_MEDAL_TARGETS;

module.exports = PulsefrontComplete;
