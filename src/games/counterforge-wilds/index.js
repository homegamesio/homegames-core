'use strict';

// SPDX-License-Identifier: MIT

const { ViewableGame, GameNode, Shapes, ShapeUtils } = require('squish-150');
const {
    WORLD_SIZE,
    CHUNK_SIZE,
    generateChunk,
    generateDungeon
} = require('./world/generator');
const {
    WEAPONS,
    RANGED_WEAPONS,
    UPGRADES,
    ENEMY_TYPES,
    QUEST_TEMPLATES
} = require('./data/content');
const {
    createActor,
    actionPhase,
    beginAction,
    cancelAction,
    tickActor,
    guard,
    breakPosture,
    clamp
} = require('./combat/system');

const TUNING = {
    TICK_RATE: 120, // tickRate - MUST match the literal in metadata()
    MAX_PLAYERS: 1, // maxPlayers - MUST match the literal in metadata()
    DT: 1 / 120,
    VIEW_SIZE: 100,
    PLAYER_SPEED_PER_SECOND: 25,
    CAMERA_FOLLOW_PER_SECOND: 12,
    BODY_RADIUS: 2.05,
    BLOCK_MOVE_SCALE: 0.42,
    MAX_ACTIVE_ENEMIES: 8,
    PROP_POOL: 28,
    WALL_POOL: 24,
    INTERACTABLE_POOL: 10,
    PROJECTILE_POOL: 10,
    PARTICLE_POOL: 16,
    HITSTOP_SECONDS: 0.025,
    STATUS_SECONDS: 2.2,
    PLAYER_RESPAWN_GOLD_LOSS: 0.12,
    ENEMY_ACTIVE_RADIUS: 86,
    CHUNK_LOAD_RADIUS: 2,
    AI_THINK_SECONDS: 0.08,
    ENEMY_DESPAWN_SECONDS: 0.6,
    PICKUP_LIFE_SECONDS: 28,
    WORLD_BOUND: WORLD_SIZE / 2 - 100
};

const C = {
    black: [0, 0, 0, 255],
    transparent: [0, 0, 0, 0],
    white: [248, 250, 255, 255],
    muted: [154, 166, 186, 255],
    line: [71, 85, 109, 255],
    panel: [9, 13, 20, 238],
    panelSolid: [9, 13, 20, 255],
    player: [63, 220, 255, 255],
    playerDark: [18, 91, 119, 255],
    health: [237, 76, 91, 255],
    stamina: [72, 220, 143, 255],
    posture: [255, 192, 71, 255],
    xp: [117, 149, 255, 255],
    gold: [255, 213, 90, 255],
    purple: [203, 102, 255, 255],
    secret: [117, 239, 219, 255],
    dungeon: [145, 115, 230, 255],
    npc: [255, 199, 108, 255],
    loot: [255, 233, 147, 255],
    damage: [255, 91, 86, 255],
    block: [111, 171, 255, 255],
    parry: [255, 244, 137, 255],
    dungeonFloor: [22, 24, 34, 255],
    dungeonGrid: [31, 34, 47, 255],
    dungeonWall: [78, 82, 104, 255],
    dungeonSecretWall: [82, 99, 105, 255]
};

function ticksFor(seconds) {
    return Math.max(1, Math.round(seconds * TUNING.TICK_RATE));
}

function distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

function normalize(x, y) {
    const length = Math.sqrt(x * x + y * y) || 1;
    return { x: x / length, y: y / length };
}

function angleDifference(a, b) {
    let difference = a - b;
    while (difference > Math.PI) difference -= Math.PI * 2;
    while (difference < -Math.PI) difference += Math.PI * 2;
    return difference;
}

function lerp(start, end, amount) {
    return start + (end - start) * amount;
}

function safePoints(points) {
    return points.map((point) => [clamp(point[0], 0, 100), clamp(point[1], 0, 100)]);
}

function safeRectangle(x, y, width, height) {
    const x1 = clamp(x, 0, 100);
    const y1 = clamp(y, 0, 100);
    const x2 = clamp(x + width, 0, 100);
    const y2 = clamp(y + height, 0, 100);
    return [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]];
}

function polyCircle(cx, cy, radius, sides) {
    const points = [];
    const count = sides || 12;
    for (let index = 0; index <= count; index += 1) {
        const angle = index / count * Math.PI * 2;
        points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
    }
    return safePoints(points);
}

function thickLine(x1, y1, x2, y2, width) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const dx = Math.sin(angle) * width / 2;
    const dy = Math.cos(angle) * width / 2;
    return safePoints([
        [x1 - dx, y1 + dy],
        [x2 - dx, y2 + dy],
        [x2 + dx, y2 - dy],
        [x1 + dx, y1 - dy],
        [x1 - dx, y1 + dy]
    ]);
}

function facingTriangle(x, y, angle, size) {
    return safePoints(ShapeUtils.triangle(
        x + Math.cos(angle) * size,
        y + Math.sin(angle) * size,
        x + Math.cos(angle + 2.5) * size * 0.7,
        y + Math.sin(angle + 2.5) * size * 0.7,
        x + Math.cos(angle - 2.5) * size * 0.7,
        y + Math.sin(angle - 2.5) * size * 0.7
    ));
}

function arcSector(cx, cy, angle, radius, halfArc) {
    const points = [[cx, cy]];
    const segments = 7;
    for (let index = 0; index <= segments; index += 1) {
        const a = angle - halfArc + index / segments * halfArc * 2;
        points.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]);
    }
    points.push([cx, cy]);
    return safePoints(points);
}

function keyOfChunk(x, y) {
    return `${x},${y}`;
}

function rectCircleCollision(rect, x, y, radius) {
    const nearestX = clamp(x, rect.x, rect.x + rect.w);
    const nearestY = clamp(y, rect.y, rect.y + rect.h);
    const dx = x - nearestX;
    const dy = y - nearestY;
    return dx * dx + dy * dy < radius * radius;
}

function valueOr(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
}

class CounterforgeWilds extends ViewableGame {
    static metadata() {
        return {
            isTest: true, // Catalog review: see docs/game-consolidation.md.

            squishVersion: '150',
            name: 'Counterforge: Wilds',
            author: "Joseph Garcia",
            description: 'A seamless 120 Hz action RPG across a massive procedural world of quests, dungeons, secrets, bosses, and precise combat.',
            aspectRatio: { x: 1, y: 1 },
            tickRate: 120, // keep in sync with TUNING.TICK_RATE; this must remain literal
            maxPlayers: 1 // keep in sync with TUNING.MAX_PLAYERS; this must remain literal
        };
    }

    constructor() {
        super(WORLD_SIZE);

        this.phase = 'title';
        this.mode = 'overworld';
        this.tickCount = 0;
        this.playerId = null;
        this.privacyAnchor = null;
        this.keys = {};
        this.pendingActions = [];
        this.moveTarget = null;
        this.touchGuardUntil = 0;
        this.hitstopTicks = 0;
        this.rngState = 0x5a17c9e3;
        this.worldSeed = 0x00c0ffee;
        this.cameraX = CHUNK_SIZE / 2;
        this.cameraY = CHUNK_SIZE / 2;
        this.lastChunkKey = null;
        this.loadedChunks = [];
        this.chunkCache = {};
        this.entityState = {};
        this.secretState = {};
        this.dungeonState = {};
        this.activeEnemies = [];
        this.visibleProps = [];
        this.visibleWalls = [];
        this.visibleInteractables = [];
        this.lootDrops = [];
        this.currentInteraction = null;
        this.currentDungeon = null;
        this.overworldReturn = null;
        this.checkpoint = { mode: 'overworld', x: CHUNK_SIZE / 2, y: CHUNK_SIZE / 2 };
        this.statusText = '';
        this.statusTicks = 0;
        this.dialogLines = [];
        this.upgradeChoices = [];
        this.activeQuest = null;
        this.completedQuests = {};
        this.player = this.makePlayer();

        this.base = this.makeRect(0, 0, 100, 100, [9, 13, 19, 255]);
        this.groundLayer = this.makeContainer();
        this.propLayer = this.makeContainer();
        this.wallLayer = this.makeContainer();
        this.interactableLayer = this.makeContainer();
        this.entityLayer = this.makeContainer();
        this.effectLayer = this.makeContainer();
        this.tapCatcher = this.makeRect(0, 0, 100, 100, C.transparent, null, null, (playerId, x, y) => this.handleWorldTap(playerId, x, y));
        this.hudLayer = this.makeContainer();
        this.overlayLayer = this.makeContainer();

        this.base.addChildren(
            this.groundLayer,
            this.propLayer,
            this.wallLayer,
            this.interactableLayer,
            this.entityLayer,
            this.effectLayer,
            this.tapCatcher,
            this.hudLayer,
            this.overlayLayer
        );
        this.getViewRoot().addChild(this.base);

        this.buildGround();
        this.buildPools();
        this.buildPlayerVisuals();
        this.buildHud();
        this.buildOverlay();
        this.refreshArea(true);
        this.renderAll(true);
    }

    getLayers() {
        return [{ root: this.getViewRoot() }];
    }

    makeContainer() {
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });
    }

    makeRect(x, y, width, height, fill, color, border, onClick, playerIds) {
        const options = {
            shapeType: Shapes.POLYGON,
            coordinates2d: safeRectangle(x, y, width, height),
            fill: fill || C.transparent
        };
        if (color) options.color = color;
        if (Number.isFinite(border)) options.border = border;
        if (onClick) options.onClick = onClick;
        if (playerIds) options.playerIds = playerIds;
        return new GameNode.Shape(options);
    }

    makeText(text, x, y, size, align, color, playerIds) {
        const options = {
            textInfo: {
                text: String(text || ''),
                x,
                y,
                size,
                align: align || 'left',
                color: color || C.white,
                font: 'monospace'
            }
        };
        if (playerIds) options.playerIds = playerIds;
        return new GameNode.Text(options);
    }

    setText(node, text, x, y, size, align, color) {
        node.node.text = {
            text: String(text || ''),
            x,
            y,
            size,
            align: align || 'left',
            color: color || C.white,
            font: 'monospace'
        };
    }

    makeButton(x, y, width, height, label, fill, onClick) {
        const root = this.makeRect(x, y, width, height, fill, C.line, 4, onClick);
        const text = this.makeText(label, x + width / 2, y + height / 2 - 1.15, 2, 'center', C.white);
        root.addChild(text);
        return {
            root,
            text,
            x,
            y,
            width,
            height,
            label,
            fill: fill.slice(),
            color: C.line.slice(),
            border: 4,
            textSize: 2
        };
    }

    showButton(button, label) {
        const shownLabel = label === undefined ? button.label : String(label);
        this.showNodeForAll(button.root);
        this.showNodeForAll(button.text);
        button.root.node.coordinates2d = safeRectangle(button.x, button.y, button.width, button.height);
        button.root.node.fill = button.fill.slice();
        button.root.node.color = button.color.slice();
        button.root.node.border = button.border;
        this.setText(
            button.text,
            shownLabel,
            button.x + button.width / 2,
            button.y + button.height / 2 - 1.15,
            button.textSize,
            'center',
            C.white
        );
    }

    hideButton(button) {
        this.hideNode(button.root);
        this.hideNode(button.text);
        button.root.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
        button.root.node.fill = C.transparent;
        button.root.node.color = [255, 255, 255, 255];
        button.root.node.border = 0;
        this.hideText(button.text);
    }

    makePlayer() {
        const player = createActor({
            id: 'player',
            kind: 'player',
            type: 'player',
            x: CHUNK_SIZE / 2,
            y: CHUNK_SIZE / 2,
            angle: -Math.PI / 2,
            radius: TUNING.BODY_RADIUS,
            speedPerSecond: TUNING.PLAYER_SPEED_PER_SECOND,
            maxHealth: 100,
            maxStamina: 100,
            maxPosture: 100,
            staminaRegenPerSecond: 25,
            postureRegenPerSecond: 13,
            parryWindowTicks: ticksFor(0.05),
            color: C.player,
            darkColor: C.playerDark
        });
        player.level = 1;
        player.xp = 0;
        player.xpNext = 70;
        player.gold = 0;
        player.meleeInventory = ['traveler-blade'];
        player.rangedInventory = ['short-bow'];
        player.weaponIndex = 0;
        player.rangedIndex = 0;
        player.upgrades = {};
        player.riposteTicks = 0;
        player.kills = 0;
        player.secrets = 0;
        player.bosses = 0;
        return player;
    }

    buildGround() {
        this.floorNode = this.makeRect(0, 0, 100, 100, [25, 47, 38, 255]);
        this.groundLayer.addChild(this.floorNode);
        this.gridNodes = [];
        for (let index = 0; index < 11; index += 1) {
            const vertical = this.makeRect(0, 0, 0.11, 100, [255, 255, 255, 255], [255, 255, 255, 28]);
            const horizontal = this.makeRect(0, 0, 100, 0.11, [255, 255, 255, 255], [255, 255, 255, 28]);
            vertical.node.color = [255, 255, 255, 22];
            horizontal.node.color = [255, 255, 255, 22];
            this.gridNodes.push(vertical, horizontal);
            this.groundLayer.addChildren(vertical, horizontal);
        }
    }

    buildPools() {
        this.propNodes = [];
        for (let index = 0; index < TUNING.PROP_POOL; index += 1) {
            const node = this.makeRect(0, 0, 0, 0, C.transparent);
            this.propNodes.push(node);
            this.propLayer.addChild(node);
        }

        this.wallNodes = [];
        for (let index = 0; index < TUNING.WALL_POOL; index += 1) {
            const node = this.makeRect(0, 0, 0, 0, C.transparent);
            this.wallNodes.push(node);
            this.wallLayer.addChild(node);
        }

        this.interactableNodes = [];
        for (let index = 0; index < TUNING.INTERACTABLE_POOL; index += 1) {
            const shape = this.makeRect(0, 0, 0, 0, C.transparent, C.white, 4);
            const marker = this.makeText('', 0, 0, 1.5, 'center', C.white);
            shape.addChild(marker);
            this.interactableNodes.push({ shape, marker });
            this.interactableLayer.addChild(shape);
        }

        this.enemyVisuals = [];
        for (let index = 0; index < TUNING.MAX_ACTIVE_ENEMIES; index += 1) {
            const shadow = this.makeRect(0, 0, 0, 0, C.transparent);
            const body = this.makeRect(0, 0, 0, 0, C.transparent, C.black, 4);
            const facing = this.makeRect(0, 0, 0, 0, C.transparent);
            const weapon = this.makeRect(0, 0, 0, 0, C.transparent);
            const shield = this.makeRect(0, 0, 0, 0, C.transparent);
            const healthBack = this.makeRect(0, 0, 0, 0, C.transparent);
            const healthFill = this.makeRect(0, 0, 0, 0, C.transparent);
            this.enemyVisuals.push({ shadow, body, facing, weapon, shield, healthBack, healthFill });
            this.entityLayer.addChildren(shadow, body, facing, weapon, shield, healthBack, healthFill);
        }

        this.projectiles = [];
        for (let index = 0; index < TUNING.PROJECTILE_POOL; index += 1) {
            const node = this.makeRect(0, 0, 0, 0, C.transparent);
            this.projectiles.push({
                active: false,
                owner: null,
                x: 0,
                y: 0,
                vx: 0,
                vy: 0,
                lifeTicks: 0,
                damage: 0,
                posture: 0,
                reflected: false,
                color: C.white,
                node
            });
            this.effectLayer.addChild(node);
        }

        this.particles = [];
        for (let index = 0; index < TUNING.PARTICLE_POOL; index += 1) {
            const node = this.makeRect(0, 0, 0, 0, C.transparent);
            this.particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, lifeTicks: 0, maxLifeTicks: 0, size: 0.5, color: C.white, node });
            this.effectLayer.addChild(node);
        }
    }

    buildPlayerVisuals() {
        this.playerNodes = {
            shadow: this.makeRect(0, 0, 0, 0, C.transparent),
            body: this.makeRect(0, 0, 0, 0, C.transparent, C.black, 5),
            facing: this.makeRect(0, 0, 0, 0, C.transparent),
            weapon: this.makeRect(0, 0, 0, 0, C.transparent),
            shield: this.makeRect(0, 0, 0, 0, C.transparent),
            arc: this.makeRect(0, 0, 0, 0, C.transparent)
        };
        this.entityLayer.addChildren(
            this.playerNodes.shadow,
            this.playerNodes.body,
            this.playerNodes.facing,
            this.playerNodes.weapon,
            this.playerNodes.shield,
            this.playerNodes.arc
        );
    }

    buildHud() {
        this.hudTop = this.makeRect(0, 0, 100, 10.5, C.panel);
        this.hudLayer.addChild(this.hudTop);

        this.healthBack = this.makeRect(2, 2, 24, 2.2, [47, 30, 38, 255]);
        this.healthFill = this.makeRect(2, 2, 24, 2.2, C.health);
        this.staminaBack = this.makeRect(2, 5, 24, 1.4, [26, 50, 41, 255]);
        this.staminaFill = this.makeRect(2, 5, 24, 1.4, C.stamina);
        this.postureBack = this.makeRect(2, 7, 24, 1.1, [59, 48, 27, 255]);
        this.postureFill = this.makeRect(2, 7, 24, 1.1, C.posture);
        this.xpBack = this.makeRect(29, 7.2, 28, 0.9, [35, 40, 64, 255]);
        this.xpFill = this.makeRect(29, 7.2, 0, 0.9, C.xp);
        this.levelText = this.makeText('LV 1', 29, 1.6, 1.8, 'left', C.white);
        this.weaponText = this.makeText('Traveler Blade', 29, 4.2, 1.55, 'left', C.muted);
        this.areaText = this.makeText('Windmeadow', 58, 1.6, 1.8, 'left', C.white);
        this.coordText = this.makeText('0,0', 58, 4.2, 1.45, 'left', C.muted);
        this.goldText = this.makeText('0G', 97, 1.6, 1.8, 'right', C.gold);
        this.questText = this.makeText('NO QUEST', 97, 4.2, 1.35, 'right', C.muted);
        this.promptText = this.makeText('', 50, 82.8, 1.7, 'center', C.white);
        this.statusNode = this.makeText('', 50, 12, 1.6, 'center', C.white);

        this.hudLayer.addChildren(
            this.healthBack,
            this.healthFill,
            this.staminaBack,
            this.staminaFill,
            this.postureBack,
            this.postureFill,
            this.xpBack,
            this.xpFill,
            this.levelText,
            this.weaponText,
            this.areaText,
            this.coordText,
            this.goldText,
            this.questText,
            this.promptText,
            this.statusNode
        );

        this.lightButton = this.makeButton(61, 91, 8, 7, 'J', [42, 91, 112, 235], () => this.queuePlayerAction('LIGHT'));
        this.heavyButton = this.makeButton(70, 91, 8, 7, 'K', [91, 55, 77, 235], () => this.queuePlayerAction('HEAVY'));
        this.guardButton = this.makeButton(79, 91, 8, 7, 'L', [40, 66, 110, 235], () => this.touchGuard());
        this.rangedButton = this.makeButton(88, 91, 8, 7, 'I', [56, 79, 57, 235], () => this.queuePlayerAction('RANGED'));
        this.dodgeButton = this.makeButton(52, 91, 8, 7, 'SP', [66, 61, 97, 235], () => this.queuePlayerAction('DODGE'));
        this.interactButton = this.makeButton(2, 91, 10, 7, 'E', [91, 73, 39, 235], () => this.interact());
        this.weaponButton = this.makeButton(13, 91, 10, 7, 'Q', [40, 72, 78, 235], () => this.cycleWeapon());
        this.hudLayer.addChildren(
            this.lightButton.root,
            this.heavyButton.root,
            this.guardButton.root,
            this.rangedButton.root,
            this.dodgeButton.root,
            this.interactButton.root,
            this.weaponButton.root
        );
    }

    buildOverlay() {
        this.overlayShade = this.makeRect(0, 0, 100, 100, [4, 6, 10, 242]);
        this.overlayTitle = this.makeText('', 50, 24, 4.2, 'center', C.white);
        this.overlayLines = [];
        for (let index = 0; index < 7; index += 1) {
            const line = this.makeText('', 50, 36 + index * 5, 1.7, 'center', index === 0 ? C.white : C.muted);
            this.overlayLines.push(line);
        }
        this.overlayHint = this.makeText('', 50, 78, 1.8, 'center', C.gold);
        // This catcher sits above overlay text and below real buttons. It makes
        // title/dialog/death screens clickable without letting the full-screen
        // shade swallow input.
        this.overlayTapCatcher = this.makeRect(
            0,
            0,
            100,
            100,
            C.transparent,
            null,
            null,
            (playerId) => this.handleOverlayTap(playerId)
        );
        this.startButton = this.makeButton(35, 84, 30, 8, 'ENTER THE WILDS', [33, 103, 124, 255], () => this.overlayPrimaryAction());
        this.choiceButtons = [];
        for (let index = 0; index < 3; index += 1) {
            const button = this.makeButton(9 + index * 31, 72, 27, 12, `${index + 1}`, [49, 59, 82, 255], () => this.chooseUpgrade(index));
            this.choiceButtons.push(button);
        }
        this.overlayLayer.addChildren(
            this.overlayShade,
            this.overlayTitle,
            ...this.overlayLines,
            this.overlayHint,
            this.overlayTapCatcher,
            this.startButton.root
        );
        for (const button of this.choiceButtons) this.overlayLayer.addChild(button.root);
    }

    handleNewPlayer({ playerId }) {
        if (this.playerId !== null) return;
        this.playerId = Number(playerId);

        // Frameless/local sessions can fall back to an unfiltered frame when a
        // player has no node scoped specifically to them. That makes [0]-hidden
        // controls visible and clickable. A permanent zero-size anchor guarantees
        // that playerIds filtering is active for the whole session.
        this.privacyAnchor = this.makeRect(0, 0, 0, 0, C.transparent, null, null, null, [this.playerId]);
        this.base.addChild(this.privacyAnchor);

        this.renderAll(true);
        this.getViewRoot().node.onStateChange();
    }

    handlePlayerDisconnect(playerId) {
        if (Number(playerId) !== Number(this.playerId)) return;
        if (this.privacyAnchor) {
            this.base.removeChild(this.privacyAnchor.id);
            this.privacyAnchor = null;
        }
        this.playerId = null;
        this.keys = {};
    }

    handleKeyDown(playerId, key) {
        if (Number(playerId) !== Number(this.playerId)) return;
        const normalized = key.length === 1 ? key.toLowerCase() : key;
        if (this.keys[normalized]) return;
        this.keys[normalized] = true;

        if (this.phase === 'title') {
            if (normalized === 'Enter' || normalized === ' ') this.startGame();
            return;
        }
        if (this.phase === 'dialog') {
            if (normalized === 'Enter' || normalized === 'e' || normalized === ' ') this.closeDialog();
            return;
        }
        if (this.phase === 'death') {
            if (normalized === 'Enter' || normalized === ' ') this.respawnPlayer();
            return;
        }
        if (this.phase === 'upgrade') {
            if (normalized === '1') this.chooseUpgrade(0);
            if (normalized === '2') this.chooseUpgrade(1);
            if (normalized === '3') this.chooseUpgrade(2);
            return;
        }
        if (this.phase !== 'playing') return;

        if (normalized === 'j') this.queuePlayerAction('LIGHT');
        else if (normalized === 'k') this.queuePlayerAction('HEAVY');
        else if (normalized === 'i') this.queuePlayerAction('RANGED');
        else if (normalized === ' ') this.queuePlayerAction('DODGE');
        else if (normalized === 'l') guard(this.player, true);
        else if (normalized === 'e' || normalized === 'Enter') this.interact();
        else if (normalized === 'q') this.cycleWeapon();
        else if (normalized === 'c') this.cycleRanged();
    }

    handleKeyUp(playerId, key) {
        if (Number(playerId) !== Number(this.playerId)) return;
        const normalized = key.length === 1 ? key.toLowerCase() : key;
        this.keys[normalized] = false;
        if (normalized === 'l') guard(this.player, false);
    }

    handleWorldTap(playerId, x, y) {
        if (Number(playerId) !== Number(this.playerId) || this.phase !== 'playing') return;
        if (y > 88 || y < 10.5) return;
        this.moveTarget = {
            x: this.cameraX + (x - 50) / 100 * TUNING.VIEW_SIZE,
            y: this.cameraY + (y - 50) / 100 * TUNING.VIEW_SIZE
        };
        const dx = this.moveTarget.x - this.player.x;
        const dy = this.moveTarget.y - this.player.y;
        if (Math.abs(dx) + Math.abs(dy) > 0.1) this.player.angle = Math.atan2(dy, dx);
    }


    handleOverlayTap(playerId) {
        if (this.playerId !== null && Number(playerId) !== Number(this.playerId)) return;
        if (this.phase === 'title') this.startGame();
        else if (this.phase === 'dialog') this.closeDialog();
        else if (this.phase === 'death') this.respawnPlayer();
    }

    overlayPrimaryAction() {
        if (this.phase === 'title') this.startGame();
        else if (this.phase === 'death') this.respawnPlayer();
    }

    startGame() {
        if (this.phase !== 'title') return;
        this.phase = 'playing';
        this.keys = {};
        this.statusMessage('Find Mira or walk east to the First Hollow.');
        this.renderAll(true);
        this.getViewRoot().node.onStateChange();
    }

    queuePlayerAction(action) {
        if (this.phase !== 'playing') return;
        if (this.pendingActions.length >= 2) return;
        this.pendingActions.push(action);
    }

    touchGuard() {
        if (this.phase !== 'playing') return;
        this.touchGuardUntil = this.tickCount + ticksFor(0.34);
        guard(this.player, true);
    }

    currentWeapon() {
        const id = this.player.meleeInventory[this.player.weaponIndex] || 'traveler-blade';
        return WEAPONS[id] || WEAPONS['traveler-blade'];
    }

    currentRangedWeapon() {
        const id = this.player.rangedInventory[this.player.rangedIndex] || 'short-bow';
        return RANGED_WEAPONS[id] || RANGED_WEAPONS['short-bow'];
    }

    cycleWeapon() {
        if (this.player.meleeInventory.length < 2) {
            this.statusMessage('No other melee weapon found yet.');
            return;
        }
        this.player.weaponIndex = (this.player.weaponIndex + 1) % this.player.meleeInventory.length;
        this.statusMessage(`Equipped ${this.currentWeapon().name}.`);
        this.renderAll(true);
        this.getViewRoot().node.onStateChange();
    }

    cycleRanged() {
        if (this.player.rangedInventory.length < 2) {
            this.statusMessage('No other ranged weapon found yet.');
            return;
        }
        this.player.rangedIndex = (this.player.rangedIndex + 1) % this.player.rangedInventory.length;
        this.statusMessage(`Equipped ${this.currentRangedWeapon().name}.`);
        this.renderAll(true);
        this.getViewRoot().node.onStateChange();
    }

    refreshArea(force) {
        if (this.mode === 'overworld') this.refreshOverworld(force);
        else this.refreshDungeon(force);
        this.syncActiveEnemies(true);
        this.updateInteractionTarget();
    }

    refreshOverworld(force) {
        const cx = Math.floor(this.player.x / CHUNK_SIZE);
        const cy = Math.floor(this.player.y / CHUNK_SIZE);
        const key = keyOfChunk(cx, cy);
        if (!force && key === this.lastChunkKey) return;
        this.lastChunkKey = key;
        this.loadedChunks = [];
        for (let dy = -TUNING.CHUNK_LOAD_RADIUS; dy <= TUNING.CHUNK_LOAD_RADIUS; dy += 1) {
            for (let dx = -TUNING.CHUNK_LOAD_RADIUS; dx <= TUNING.CHUNK_LOAD_RADIUS; dx += 1) {
                const chunkX = cx + dx;
                const chunkY = cy + dy;
                const chunkKey = keyOfChunk(chunkX, chunkY);
                if (!this.chunkCache[chunkKey]) this.chunkCache[chunkKey] = generateChunk(this.worldSeed, chunkX, chunkY);
                this.loadedChunks.push(this.chunkCache[chunkKey]);
            }
        }
        this.visibleProps = [];
        this.visibleWalls = [];
        this.visibleInteractables = [];
        for (const chunk of this.loadedChunks) {
            for (const prop of chunk.props) this.visibleProps.push(prop);
            for (const landmark of chunk.landmarks) this.visibleInteractables.push(Object.assign({ interactionKind: 'landmark' }, landmark));
            for (const npc of chunk.npcs) this.visibleInteractables.push(Object.assign({ interactionKind: 'npc' }, npc));
            for (const dungeon of chunk.dungeons) this.visibleInteractables.push(Object.assign({ interactionKind: 'dungeon' }, dungeon));
            for (const secret of chunk.secrets) {
                if (!this.secretState[secret.id] || !this.secretState[secret.id].opened) {
                    this.visibleInteractables.push(Object.assign({ interactionKind: 'secret' }, secret));
                }
            }
        }
    }

    refreshDungeon(force) {
        if (!this.currentDungeon) return;
        if (!force && this.lastChunkKey === `dungeon:${this.currentDungeon.id}`) return;
        this.lastChunkKey = `dungeon:${this.currentDungeon.id}`;
        this.loadedChunks = [];
        this.visibleProps = [];
        this.visibleWalls = this.currentDungeon.walls;
        this.visibleInteractables = [Object.assign({ interactionKind: 'exit' }, this.currentDungeon.exit)];
        if (this.currentDungeon.secret) {
            const state = this.secretState[this.currentDungeon.secret.id];
            if (!state || !state.opened) this.visibleInteractables.push(Object.assign({ interactionKind: 'secret' }, this.currentDungeon.secret));
        }
    }

    desiredEnemySpawns() {
        const spawns = [];
        if (this.mode === 'overworld') {
            for (const chunk of this.loadedChunks) {
                for (const spawn of chunk.enemies) {
                    const state = this.entityState[spawn.id];
                    if (state && state.dead) continue;
                    const d = distance(this.player.x, this.player.y, state && Number.isFinite(state.x) ? state.x : spawn.x, state && Number.isFinite(state.y) ? state.y : spawn.y);
                    if (d <= TUNING.ENEMY_ACTIVE_RADIUS) spawns.push(spawn);
                }
            }
        } else if (this.currentDungeon) {
            for (const spawn of this.currentDungeon.enemies) {
                const state = this.entityState[spawn.id];
                if (state && state.dead) continue;
                const d = distance(this.player.x, this.player.y, state && Number.isFinite(state.x) ? state.x : spawn.x, state && Number.isFinite(state.y) ? state.y : spawn.y);
                if (d <= TUNING.ENEMY_ACTIVE_RADIUS) spawns.push(spawn);
            }
        }
        spawns.sort((a, b) => distance(this.player.x, this.player.y, a.x, a.y) - distance(this.player.x, this.player.y, b.x, b.y));
        return spawns.slice(0, TUNING.MAX_ACTIVE_ENEMIES);
    }

    syncActiveEnemies(force) {
        const desired = this.desiredEnemySpawns();
        const desiredIds = {};
        for (const spawn of desired) desiredIds[spawn.id] = spawn;

        const kept = [];
        for (const actor of this.activeEnemies) {
            if (desiredIds[actor.worldId] || (actor.dead && actor.despawnTicks > 0)) {
                kept.push(actor);
            } else {
                this.persistEnemy(actor);
            }
        }
        this.activeEnemies = kept;

        const existing = {};
        for (const actor of this.activeEnemies) existing[actor.worldId] = true;
        for (const spawn of desired) {
            if (this.activeEnemies.length >= TUNING.MAX_ACTIVE_ENEMIES) break;
            if (existing[spawn.id]) continue;
            this.activeEnemies.push(this.makeEnemy(spawn));
            existing[spawn.id] = true;
        }

        if (force) this.renderEnemies();
    }

    makeEnemy(spawn) {
        const type = ENEMY_TYPES[spawn.type] || ENEMY_TYPES.raider;
        const state = this.entityState[spawn.id] || {};
        const levelScale = 1 + Math.max(0, (spawn.level || 1) - 1) * 0.16;
        const healthScale = spawn.boss ? 1 + Math.max(0, (spawn.level || 1) - 1) * 0.22 : levelScale;
        const actor = createActor({
            id: spawn.id,
            worldId: spawn.id,
            kind: 'enemy',
            type: type.id,
            x: valueOr(state.x, spawn.x),
            y: valueOr(state.y, spawn.y),
            homeX: spawn.homeX,
            homeY: spawn.homeY,
            angle: 0,
            radius: spawn.boss ? 2.8 : TUNING.BODY_RADIUS,
            speedPerSecond: type.speed * (1 + Math.min(0.22, (spawn.level - 1) * 0.025)),
            maxHealth: type.health * healthScale,
            health: valueOr(state.health, type.health * healthScale),
            maxStamina: type.stamina * levelScale,
            stamina: valueOr(state.stamina, type.stamina * levelScale),
            maxPosture: type.posture * levelScale,
            posture: valueOr(state.posture, type.posture * levelScale),
            staminaRegenPerSecond: 20,
            postureRegenPerSecond: 10,
            parryWindowTicks: ticksFor(type.style === 'guard' || type.style === 'boss' ? 5 / 120 : 3 / 120),
            color: type.color,
            darkColor: type.dark,
            style: type.style,
            boss: spawn.boss,
            level: spawn.level || 1,
            xp: Math.round(type.xp * levelScale),
            gold: Math.round(type.gold * levelScale)
        });
        actor.aiThinkTicks = Math.floor(this.random() * ticksFor(TUNING.AI_THINK_SECONDS));
        actor.aggro = Boolean(spawn.boss);
        actor.damageScale = 1 + Math.max(0, actor.level - 1) * 0.075;
        actor.despawnTicks = 0;
        return actor;
    }

    persistEnemy(actor) {
        if (!actor || !actor.worldId) return;
        this.entityState[actor.worldId] = {
            dead: Boolean(actor.dead),
            x: actor.x,
            y: actor.y,
            health: actor.health,
            stamina: actor.stamina,
            posture: actor.posture
        };
    }

    tick() {
        this.tickCount += 1;
        if (this.statusTicks > 0) this.statusTicks -= 1;
        if (this.playerId === null) return;
        if (this.phase !== 'playing') return;

        if (this.hitstopTicks > 0) {
            this.hitstopTicks -= 1;
            this.renderAll(false);
            this.getViewRoot().node.onStateChange();
            return;
        }

        if (this.touchGuardUntil > 0 && this.tickCount >= this.touchGuardUntil) {
            this.touchGuardUntil = 0;
            guard(this.player, false);
        }

        this.updatePlayer();
        if (this.phase !== 'playing') {
            this.renderAll(true);
            this.getViewRoot().node.onStateChange();
            return;
        }
        this.updateEnemies();
        if (this.phase !== 'playing') {
            this.renderAll(true);
            this.getViewRoot().node.onStateChange();
            return;
        }
        this.updateProjectiles();
        if (this.phase !== 'playing') {
            this.renderAll(true);
            this.getViewRoot().node.onStateChange();
            return;
        }
        this.updateParticles();
        this.resolveActorSeparation();
        this.updateLootDrops();
        this.updateCamera();

        const oldChunk = this.lastChunkKey;
        if (this.mode === 'overworld') this.refreshOverworld(false);
        if (oldChunk !== this.lastChunkKey || this.tickCount % ticksFor(0.25) === 0) this.syncActiveEnemies(false);
        this.updateInteractionTarget();
        this.renderAll(false);
        this.getViewRoot().node.onStateChange();
    }

    updatePlayer() {
        if (this.player.dead) return;
        this.updateAim();
        this.consumePlayerAction();
        tickActor(this.player, TUNING.DT, TUNING.BLOCK_MOVE_SCALE, this.player.upgrades);
        if (this.player.riposteTicks > 0) this.player.riposteTicks -= 1;
        this.movePlayer();
        this.updateActorAction(this.player);
    }

    updateAim() {
        let aimX = 0;
        let aimY = 0;
        if (this.keys.ArrowLeft) aimX -= 1;
        if (this.keys.ArrowRight) aimX += 1;
        if (this.keys.ArrowUp) aimY -= 1;
        if (this.keys.ArrowDown) aimY += 1;
        if (aimX !== 0 || aimY !== 0) {
            this.player.angle = Math.atan2(aimY, aimX);
            this.moveTarget = null;
        }
    }

    consumePlayerAction() {
        if (this.pendingActions.length === 0) return;
        const action = this.pendingActions[0];
        const started = beginAction(
            this.player,
            action,
            ticksFor,
            this.currentWeapon(),
            this.currentRangedWeapon(),
            this.player.upgrades
        );
        if (started) {
            this.pendingActions.shift();
            this.moveTarget = null;
        } else if (this.player.action !== 'NEUTRAL' || this.player.staggerTicks > 0) {
            return;
        } else {
            this.pendingActions.shift();
        }
    }

    movePlayer() {
        if (this.player.staggerTicks > 0) return;
        let dx = 0;
        let dy = 0;
        if (this.keys.a) dx -= 1;
        if (this.keys.d) dx += 1;
        if (this.keys.w) dy -= 1;
        if (this.keys.s) dy += 1;

        if (dx === 0 && dy === 0 && this.moveTarget) {
            const tx = this.moveTarget.x - this.player.x;
            const ty = this.moveTarget.y - this.player.y;
            if (Math.sqrt(tx * tx + ty * ty) < 1.2) this.moveTarget = null;
            else {
                const direction = normalize(tx, ty);
                dx = direction.x;
                dy = direction.y;
            }
        }

        if (this.player.action === 'DODGE' && this.player.actionSpec && actionPhase(this.player) === 'active') {
            dx = Math.cos(this.player.angle);
            dy = Math.sin(this.player.angle);
            const speed = this.player.actionSpec.dodgeSpeedPerSecond;
            this.moveActor(this.player, dx * speed * TUNING.DT, dy * speed * TUNING.DT);
            return;
        }

        if (dx === 0 && dy === 0) return;
        const direction = normalize(dx, dy);
        if (!this.keys.ArrowLeft && !this.keys.ArrowRight && !this.keys.ArrowUp && !this.keys.ArrowDown) {
            this.player.angle = Math.atan2(direction.y, direction.x);
        }
        const speed = this.player.speedPerSecond * (this.player.moveScale || 1);
        this.moveActor(this.player, direction.x * speed * TUNING.DT, direction.y * speed * TUNING.DT);
    }

    updateEnemies() {
        for (const enemy of this.activeEnemies) {
            if (enemy.dead) {
                enemy.despawnTicks -= 1;
                continue;
            }
            tickActor(enemy, TUNING.DT, TUNING.BLOCK_MOVE_SCALE, null);
            this.thinkEnemy(enemy);
            this.moveEnemy(enemy);
            this.updateActorAction(enemy);
        }
        const kept = [];
        for (const enemy of this.activeEnemies) {
            if (!enemy.dead || enemy.despawnTicks > 0) kept.push(enemy);
            else this.persistEnemy(enemy);
        }
        this.activeEnemies = kept;
    }

    thinkEnemy(enemy) {
        if (enemy.dead || enemy.staggerTicks > 0) return;
        enemy.aiThinkTicks -= 1;
        if (enemy.aiThinkTicks > 0) return;
        enemy.aiThinkTicks = ticksFor(TUNING.AI_THINK_SECONDS) + Math.floor(this.random() * ticksFor(0.04));

        const dx = this.player.x - enemy.x;
        const dy = this.player.y - enemy.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        const detectionRange = this.mode === 'dungeon' ? 25 : 17;
        if (!enemy.aggro && (d <= detectionRange || enemy.health < enemy.maxHealth || enemy.boss)) enemy.aggro = true;
        if (enemy.aggro && this.mode === 'overworld' && d > 43 && enemy.health >= enemy.maxHealth * 0.98) enemy.aggro = false;
        if (!enemy.aggro) {
            enemy.angle = Math.atan2(enemy.homeY - enemy.y, enemy.homeX - enemy.x);
            return;
        }
        enemy.angle = Math.atan2(dy, dx);
        const playerPhase = actionPhase(this.player);
        const playerAttacking = this.player.action === 'LIGHT' || this.player.action === 'HEAVY';
        const lowStamina = enemy.stamina < enemy.maxStamina * 0.24;

        if (enemy.guarding && (!playerAttacking || d > 11)) guard(enemy, false);
        if (enemy.action !== 'NEUTRAL' || enemy.guarding || enemy.staggerTicks > 0) return;

        if (enemy.style === 'rush') {
            if (playerAttacking && d < 9 && this.random() < 0.38) {
                if (this.random() < 0.52) guard(enemy, true);
                else this.beginEnemyAction(enemy, 'DODGE');
            } else if (d < 7.2 && !lowStamina) {
                this.beginEnemyAction(enemy, this.random() < 0.76 ? 'LIGHT' : 'HEAVY');
            }
        } else if (enemy.style === 'ranged') {
            if (d < 7.5 && this.random() < 0.7) this.beginEnemyAction(enemy, 'DODGE');
            else if (d > 13 && d < 42 && !lowStamina) this.beginEnemyAction(enemy, 'RANGED');
            else if (d < 8.5) this.beginEnemyAction(enemy, 'LIGHT');
        } else if (enemy.style === 'guard') {
            if (playerAttacking && playerPhase === 'startup' && d < 10.5) guard(enemy, true);
            else if (this.player.guarding && d < 8.5 && !lowStamina) this.beginEnemyAction(enemy, 'HEAVY');
            else if (d < 8 && !lowStamina) this.beginEnemyAction(enemy, this.random() < 0.55 ? 'LIGHT' : 'HEAVY');
        } else if (enemy.style === 'boss') {
            enemy.bossPhase = enemy.health < enemy.maxHealth * 0.42 ? 2 : 1;
            if (playerAttacking && playerPhase === 'startup' && d < 11 && this.random() < (enemy.bossPhase === 2 ? 0.72 : 0.48)) {
                if (this.random() < 0.62) guard(enemy, true);
                else this.beginEnemyAction(enemy, 'DODGE');
            } else if (d > 16 && !lowStamina && this.random() < 0.62) {
                this.beginEnemyAction(enemy, 'RANGED');
            } else if (this.player.guarding && d < 10 && !lowStamina) {
                this.beginEnemyAction(enemy, 'HEAVY');
            } else if (d < 9.5 && !lowStamina) {
                const roll = this.random();
                this.beginEnemyAction(enemy, roll < 0.45 ? 'LIGHT' : roll < 0.8 ? 'HEAVY' : 'DODGE');
            }
        } else {
            if (playerAttacking && playerPhase === 'startup' && d < 9.5 && this.random() < 0.34) guard(enemy, true);
            else if (this.player.guarding && d < 8.5 && !lowStamina && this.random() < 0.58) this.beginEnemyAction(enemy, 'HEAVY');
            else if (d < 8.2 && !lowStamina) this.beginEnemyAction(enemy, this.random() < 0.68 ? 'LIGHT' : 'HEAVY');
            else if (d > 14 && d < 35 && !lowStamina && this.random() < 0.15) this.beginEnemyAction(enemy, 'RANGED');
        }
    }

    beginEnemyAction(enemy, action) {
        const weapon = action === 'HEAVY' && enemy.type === 'sentinel' ? WEAPONS['moon-spear'] : WEAPONS['traveler-blade'];
        const ranged = enemy.style === 'boss' ? RANGED_WEAPONS['hunter-bow'] : RANGED_WEAPONS['short-bow'];
        return beginAction(enemy, action, ticksFor, weapon, ranged, {});
    }

    moveEnemy(enemy) {
        if (enemy.dead || enemy.staggerTicks > 0) return;
        const dx = this.player.x - enemy.x;
        const dy = this.player.y - enemy.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        let moveX = 0;
        let moveY = 0;

        if (!enemy.aggro) {
            const homeDistance = distance(enemy.x, enemy.y, enemy.homeX, enemy.homeY);
            if (homeDistance > 2) {
                const home = normalize(enemy.homeX - enemy.x, enemy.homeY - enemy.y);
                const speed = enemy.speedPerSecond * 0.45;
                this.moveActor(enemy, home.x * speed * TUNING.DT, home.y * speed * TUNING.DT);
            }
            return;
        }

        if (enemy.action === 'DODGE' && enemy.actionSpec && actionPhase(enemy) === 'active') {
            const side = enemy.worldId.length % 2 === 0 ? 1 : -1;
            moveX = -Math.sin(enemy.angle) * side;
            moveY = Math.cos(enemy.angle) * side;
            const speed = enemy.actionSpec.dodgeSpeedPerSecond;
            this.moveActor(enemy, moveX * speed * TUNING.DT, moveY * speed * TUNING.DT);
            return;
        }

        if (enemy.action !== 'NEUTRAL' || enemy.guarding) return;
        if (enemy.style === 'ranged') {
            if (d < 12) {
                moveX = -dx / d;
                moveY = -dy / d;
            } else if (d > 26) {
                moveX = dx / d;
                moveY = dy / d;
            } else {
                moveX = -dy / d * 0.55;
                moveY = dx / d * 0.55;
            }
        } else if (enemy.style === 'boss') {
            if (d > 8.4) {
                moveX = dx / d;
                moveY = dy / d;
            } else {
                const side = this.tickCount % ticksFor(2) < ticksFor(1) ? 1 : -1;
                moveX = -dy / d * 0.7 * side;
                moveY = dx / d * 0.7 * side;
            }
        } else if (d > 6.6) {
            moveX = dx / d;
            moveY = dy / d;
        } else if (d < 4.6) {
            moveX = -dx / d * 0.35;
            moveY = -dy / d * 0.35;
        }

        const leash = distance(enemy.x, enemy.y, enemy.homeX, enemy.homeY);
        if (this.mode === 'overworld' && leash > 34 && d > 20) {
            const home = normalize(enemy.homeX - enemy.x, enemy.homeY - enemy.y);
            moveX = home.x;
            moveY = home.y;
        }
        if (moveX !== 0 || moveY !== 0) {
            const speed = enemy.speedPerSecond * (enemy.moveScale || 1);
            this.moveActor(enemy, moveX * speed * TUNING.DT, moveY * speed * TUNING.DT);
        }
    }

    updateActorAction(actor) {
        if (actor.dead || actor.action === 'NEUTRAL' || !actor.actionSpec) return;
        const phase = actionPhase(actor);
        if ((actor.action === 'LIGHT' || actor.action === 'HEAVY') && phase === 'active') {
            const lunge = actor.actionSpec.lungePerSecond * TUNING.DT;
            this.moveActor(actor, Math.cos(actor.angle) * lunge, Math.sin(actor.angle) * lunge);
            if (actor.kind === 'player') {
                for (const enemy of this.activeEnemies) this.resolveMelee(actor, enemy);
                if (actor.action === 'HEAVY') this.strikeSecretWalls(actor);
            } else {
                this.resolveMelee(actor, this.player);
            }
        }
        if (actor.action === 'RANGED' && phase === 'active' && !actor.rangedFired) {
            actor.rangedFired = true;
            this.spawnProjectile(actor);
        }
    }

    resolveMelee(attacker, target) {
        if (!attacker || !target || attacker.dead || target.dead || !attacker.actionSpec) return;
        if (attacker.attackConnected[target.id]) return;
        const spec = attacker.actionSpec;
        const dx = target.x - attacker.x;
        const dy = target.y - attacker.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > spec.range + target.radius) return;
        const angleToTarget = Math.atan2(dy, dx);
        if (Math.abs(angleDifference(angleToTarget, attacker.angle)) > spec.arc * 0.58) return;
        attacker.attackConnected[target.id] = true;
        if (target.invulnerableTicks > 0) {
            this.emitBurst(target.x, target.y, C.muted, 3);
            return;
        }

        if (this.isBlockingAgainst(target, attacker.x, attacker.y)) {
            if (target.guardTicks <= target.parryWindowTicks) this.applyParry(target, attacker);
            else this.applyBlockedHit(target, attacker, spec);
            return;
        }

        let damage = spec.damage;
        let posture = spec.posture;
        if (attacker.kind === 'enemy') {
            damage *= attacker.damageScale || 1;
            posture *= 1 + Math.max(0, attacker.level - 1) * 0.05;
        }
        if (attacker.kind === 'player' && attacker.riposteTicks > 0) {
            damage *= 1.55;
            posture *= 1.65;
            attacker.riposteTicks = 0;
            this.statusMessage('RIPOSTE');
        }
        this.applyDamage(target, damage, posture, attacker);
    }

    isBlockingAgainst(target, sourceX, sourceY) {
        if (!target.guarding || target.staggerTicks > 0) return false;
        const sourceAngle = Math.atan2(sourceY - target.y, sourceX - target.x);
        return Math.abs(angleDifference(sourceAngle, target.angle)) <= 1.18;
    }

    applyParry(defender, attacker) {
        defender.parryFlashTicks = ticksFor(0.15);
        defender.posture = clamp(defender.posture + defender.maxPosture * 0.16, 0, defender.maxPosture);
        attacker.staggerTicks = Math.max(attacker.staggerTicks, ticksFor(0.46));
        attacker.posture = Math.max(0, attacker.posture - attacker.maxPosture * 0.26);
        attacker.guarding = false;
        cancelAction(attacker);
        if (defender.kind === 'player') defender.riposteTicks = ticksFor(1.05);
        this.hitstopTicks = ticksFor(TUNING.HITSTOP_SECONDS * 1.5);
        this.emitBurst(defender.x, defender.y, C.parry, 7);
    }

    applyBlockedHit(defender, attacker, spec) {
        const blockCost = spec.posture * 0.75;
        defender.blockFlashTicks = ticksFor(0.1);
        defender.posture -= blockCost;
        defender.stamina = Math.max(0, defender.stamina - spec.stamina * 0.28);
        attacker.staggerTicks = Math.max(attacker.staggerTicks, ticksFor(0.08));
        this.hitstopTicks = ticksFor(TUNING.HITSTOP_SECONDS);
        this.emitBurst(defender.x, defender.y, C.block, 4);
        if (defender.posture <= 0) {
            breakPosture(defender, ticksFor(0.72));
            this.statusMessage(defender.kind === 'player' ? 'YOUR GUARD BROKE' : 'GUARD BREAK');
        }
    }

    applyDamage(target, damage, postureDamage, attacker) {
        if (target.dead || target.invulnerableTicks > 0) return;
        target.health = Math.max(0, target.health - damage);
        target.posture = Math.max(0, target.posture - postureDamage);
        target.hitFlashTicks = ticksFor(0.12);
        if (target.kind === 'enemy') target.aggro = true;
        target.staggerTicks = Math.max(target.staggerTicks, ticksFor(target.boss ? 0.08 : 0.16));
        target.guarding = false;
        this.hitstopTicks = ticksFor(TUNING.HITSTOP_SECONDS);
        this.emitBurst(target.x, target.y, C.damage, target.boss ? 8 : 5);
        if (target.posture <= 0 && target.health > 0) breakPosture(target, ticksFor(target.boss ? 0.45 : 0.68));
        if (target.health <= 0) this.killActor(target, attacker);
    }

    killActor(target, attacker) {
        if (target.dead) return;
        target.dead = true;
        target.health = 0;
        target.guarding = false;
        cancelAction(target);
        target.despawnTicks = ticksFor(TUNING.ENEMY_DESPAWN_SECONDS);

        if (target.kind === 'player') {
            this.phase = 'death';
            const loss = Math.floor(this.player.gold * TUNING.PLAYER_RESPAWN_GOLD_LOSS);
            this.player.gold = Math.max(0, this.player.gold - loss);
            this.dialogLines = [
                'You were returned to your last refuge.',
                loss > 0 ? `${loss} gold was lost.` : 'No gold was lost.',
                'The world and completed discoveries remain.'
            ];
            this.renderAll(true);
            this.getViewRoot().node.onStateChange();
            return;
        }

        this.persistEnemy(target);
        this.entityState[target.worldId].dead = true;
        this.player.kills += 1;
        this.gainXp(target.xp || 10);
        this.player.gold += target.gold || 0;
        this.progressQuest('hunt', 1);
        this.spawnLootDrop(target);

        if (target.boss) {
            this.player.bosses += 1;
            this.progressQuest('dungeon', 1);
            if (this.currentDungeon) {
                const state = this.dungeonState[this.currentDungeon.id] || {};
                state.cleared = true;
                this.dungeonState[this.currentDungeon.id] = state;
                this.unlockWeapon(this.currentDungeon.rewardWeapon);
            }
            this.openUpgradeChoice();
        }
    }

    strikeSecretWalls(actor) {
        if (this.mode !== 'dungeon' || !this.currentDungeon || !actor.actionSpec) return;
        for (const wall of this.visibleWalls) {
            if (!wall.secret || wall.hp <= 0 || actor.attackConnected[wall.id]) continue;
            const centerX = wall.x + wall.w / 2;
            const centerY = wall.y + wall.h / 2;
            const d = distance(actor.x, actor.y, centerX, centerY);
            if (d > actor.actionSpec.range + 3) continue;
            const angle = Math.atan2(centerY - actor.y, centerX - actor.x);
            if (Math.abs(angleDifference(angle, actor.angle)) > 0.72) continue;
            actor.attackConnected[wall.id] = true;
            wall.hp -= 1;
            this.emitBurst(centerX, centerY, C.secret, 8);
            if (wall.hp <= 0) {
                wall.solid = false;
                this.statusMessage('A HIDDEN PASSAGE OPENS');
            } else {
                this.statusMessage('The wall sounds hollow. Hit it again.');
            }
        }
    }

    spawnProjectile(actor) {
        const projectile = this.projectiles.find((candidate) => !candidate.active);
        if (!projectile || !actor.actionSpec) return;
        projectile.active = true;
        projectile.owner = actor;
        projectile.x = actor.x + Math.cos(actor.angle) * (actor.radius + 1.8);
        projectile.y = actor.y + Math.sin(actor.angle) * (actor.radius + 1.8);
        projectile.vx = Math.cos(actor.angle) * actor.actionSpec.projectileSpeedPerSecond;
        projectile.vy = Math.sin(actor.angle) * actor.actionSpec.projectileSpeedPerSecond;
        projectile.lifeTicks = actor.actionSpec.projectileLifeTicks;
        projectile.damage = actor.actionSpec.damage * (actor.kind === 'enemy' ? actor.damageScale || 1 : 1);
        projectile.posture = actor.actionSpec.posture;
        projectile.reflected = false;
        projectile.color = actor.kind === 'player' ? this.currentRangedWeapon().color : actor.color;
    }

    updateProjectiles() {
        for (const projectile of this.projectiles) {
            if (!projectile.active) continue;
            projectile.x += projectile.vx * TUNING.DT;
            projectile.y += projectile.vy * TUNING.DT;
            projectile.lifeTicks -= 1;
            if (projectile.lifeTicks <= 0 || this.projectileHitsObstacle(projectile)) {
                this.hideProjectile(projectile);
                continue;
            }

            if (projectile.owner && projectile.owner.kind === 'player') {
                for (const enemy of this.activeEnemies) {
                    if (enemy.dead || distance(projectile.x, projectile.y, enemy.x, enemy.y) > enemy.radius + 0.8) continue;
                    if (enemy.invulnerableTicks > 0) {
                        this.hideProjectile(projectile);
                        break;
                    }
                    if (this.isBlockingAgainst(enemy, projectile.x, projectile.y)) {
                        if (enemy.guardTicks <= enemy.parryWindowTicks) this.reflectProjectile(projectile, enemy);
                        else {
                            enemy.posture -= projectile.posture * 0.7;
                            this.emitBurst(enemy.x, enemy.y, C.block, 4);
                            this.hideProjectile(projectile);
                        }
                    } else {
                        this.applyDamage(enemy, projectile.damage, projectile.posture, projectile.owner);
                        this.hideProjectile(projectile);
                    }
                    break;
                }
            } else if (!this.player.dead && distance(projectile.x, projectile.y, this.player.x, this.player.y) <= this.player.radius + 0.8) {
                if (this.player.invulnerableTicks > 0) {
                    this.hideProjectile(projectile);
                } else if (this.isBlockingAgainst(this.player, projectile.x, projectile.y)) {
                    if (this.player.guardTicks <= this.player.parryWindowTicks) this.reflectProjectile(projectile, this.player);
                    else {
                        this.player.posture -= projectile.posture * 0.72;
                        this.emitBurst(this.player.x, this.player.y, C.block, 4);
                        this.hideProjectile(projectile);
                    }
                } else {
                    this.applyDamage(this.player, projectile.damage, projectile.posture, projectile.owner);
                    this.hideProjectile(projectile);
                }
            }
        }
    }

    reflectProjectile(projectile, defender) {
        projectile.owner = defender;
        projectile.reflected = true;
        projectile.vx *= -1.28;
        projectile.vy *= -1.28;
        projectile.damage *= 1.35;
        projectile.lifeTicks = Math.max(projectile.lifeTicks, ticksFor(0.8));
        projectile.color = C.parry;
        defender.parryFlashTicks = ticksFor(0.15);
        if (defender.kind === 'player') defender.riposteTicks = ticksFor(1.05);
        this.emitBurst(defender.x, defender.y, C.parry, 7);
    }

    projectileHitsObstacle(projectile) {
        for (const prop of this.visibleProps) {
            if (!prop.solid) continue;
            if (distance(projectile.x, projectile.y, prop.x, prop.y) < prop.radius + 0.45) return true;
        }
        for (const wall of this.visibleWalls) {
            if (!wall.solid) continue;
            if (rectCircleCollision(wall, projectile.x, projectile.y, 0.45)) return true;
        }
        return false;
    }

    hideProjectile(projectile) {
        projectile.active = false;
        projectile.owner = null;
        projectile.lifeTicks = 0;
    }

    moveActor(actor, dx, dy) {
        if (!actor || actor.dead) return;
        let nextX = actor.x + dx;
        let nextY = actor.y;
        if (!this.collidesAt(actor, nextX, nextY)) actor.x = nextX;
        nextX = actor.x;
        nextY = actor.y + dy;
        if (!this.collidesAt(actor, nextX, nextY)) actor.y = nextY;
        if (this.mode === 'overworld') {
            actor.x = clamp(actor.x, -TUNING.WORLD_BOUND, TUNING.WORLD_BOUND);
            actor.y = clamp(actor.y, -TUNING.WORLD_BOUND, TUNING.WORLD_BOUND);
        } else if (this.currentDungeon) {
            actor.x = clamp(actor.x, actor.radius, this.currentDungeon.width - actor.radius);
            actor.y = clamp(actor.y, actor.radius, this.currentDungeon.height - actor.radius);
        }
    }

    collidesAt(actor, x, y) {
        for (const prop of this.visibleProps) {
            if (!prop.solid) continue;
            if (distance(x, y, prop.x, prop.y) < actor.radius + prop.radius) return true;
        }
        for (const wall of this.visibleWalls) {
            if (!wall.solid) continue;
            if (rectCircleCollision(wall, x, y, actor.radius)) return true;
        }
        return false;
    }

    resolveActorSeparation() {
        for (const enemy of this.activeEnemies) {
            if (enemy.dead) continue;
            const dx = enemy.x - this.player.x;
            const dy = enemy.y - this.player.y;
            const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
            const minimum = enemy.radius + this.player.radius;
            if (d < minimum) {
                const push = (minimum - d) * 0.5;
                const nx = dx / d;
                const ny = dy / d;
                if (!this.collidesAt(this.player, this.player.x - nx * push, this.player.y - ny * push)) {
                    this.player.x -= nx * push;
                    this.player.y -= ny * push;
                }
                if (!this.collidesAt(enemy, enemy.x + nx * push, enemy.y + ny * push)) {
                    enemy.x += nx * push;
                    enemy.y += ny * push;
                }
            }
        }
        for (let a = 0; a < this.activeEnemies.length; a += 1) {
            const first = this.activeEnemies[a];
            if (first.dead) continue;
            for (let b = a + 1; b < this.activeEnemies.length; b += 1) {
                const second = this.activeEnemies[b];
                if (second.dead) continue;
                const dx = second.x - first.x;
                const dy = second.y - first.y;
                const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
                const minimum = first.radius + second.radius;
                if (d < minimum) {
                    const push = (minimum - d) * 0.28;
                    first.x -= dx / d * push;
                    first.y -= dy / d * push;
                    second.x += dx / d * push;
                    second.y += dy / d * push;
                }
            }
        }
    }

    spawnLootDrop(enemy) {
        if (this.lootDrops.length >= 6) this.lootDrops.shift();
        const roll = this.random();
        if (roll < 0.48) return;
        const kind = roll < 0.72 ? 'gold' : roll < 0.9 ? 'healing' : 'stamina';
        this.lootDrops.push({
            id: `loot:${this.tickCount}:${enemy.worldId}`,
            x: enemy.x,
            y: enemy.y,
            kind,
            amount: kind === 'gold' ? 8 + Math.floor(this.random() * 12) : 24,
            lifeTicks: ticksFor(TUNING.PICKUP_LIFE_SECONDS)
        });
    }

    updateLootDrops() {
        const kept = [];
        for (const loot of this.lootDrops) {
            loot.lifeTicks -= 1;
            if (loot.lifeTicks > 0) kept.push(loot);
        }
        this.lootDrops = kept;
    }

    gainXp(amount) {
        this.player.xp += Math.max(0, Math.round(amount));
        while (this.player.xp >= this.player.xpNext) {
            this.player.xp -= this.player.xpNext;
            this.player.level += 1;
            this.player.xpNext = Math.round(70 + this.player.level * 38 + this.player.level * this.player.level * 4);
            this.player.maxHealth += 7;
            this.player.maxStamina += 4;
            this.player.maxPosture += 5;
            this.player.health = this.player.maxHealth;
            this.player.stamina = this.player.maxStamina;
            this.player.posture = this.player.maxPosture;
            this.statusMessage(`LEVEL ${this.player.level} — VITALITY RESTORED`);
        }
    }

    unlockWeapon(id) {
        if (WEAPONS[id] && !this.player.meleeInventory.includes(id)) {
            this.player.meleeInventory.push(id);
            this.player.weaponIndex = this.player.meleeInventory.indexOf(id);
            this.statusMessage(`FOUND ${WEAPONS[id].name.toUpperCase()}`);
        } else if (RANGED_WEAPONS[id] && !this.player.rangedInventory.includes(id)) {
            this.player.rangedInventory.push(id);
            this.player.rangedIndex = this.player.rangedInventory.indexOf(id);
            this.statusMessage(`FOUND ${RANGED_WEAPONS[id].name.toUpperCase()}`);
        }
    }

    progressQuest(kind, amount) {
        if (!this.activeQuest || this.activeQuest.kind !== kind || this.activeQuest.complete) return;
        this.activeQuest.progress = Math.min(this.activeQuest.target, this.activeQuest.progress + amount);
        if (this.activeQuest.progress >= this.activeQuest.target) {
            this.activeQuest.complete = true;
            this.statusMessage(`QUEST COMPLETE — RETURN TO ${this.activeQuest.npcName.toUpperCase()}`);
        }
    }

    interact() {
        if (this.phase !== 'playing') return;
        this.updateInteractionTarget();
        const target = this.currentInteraction;
        if (!target) {
            this.statusMessage('Nothing nearby to interact with.');
            return;
        }
        if (target.interactionKind === 'npc') this.interactNpc(target);
        else if (target.interactionKind === 'dungeon') this.enterDungeon(target);
        else if (target.interactionKind === 'exit') this.exitDungeon();
        else if (target.interactionKind === 'secret') this.openSecret(target);
        else if (target.interactionKind === 'loot') this.collectLoot(target);
        else if (target.interactionKind === 'landmark') this.useLandmark(target);
    }

    interactNpc(npc) {
        const questTemplate = QUEST_TEMPLATES[npc.questKind] || QUEST_TEMPLATES.hunt;
        if (!this.activeQuest) {
            this.activeQuest = {
                id: `${npc.id}:${questTemplate.kind}`,
                sourceNpcId: npc.id,
                npcName: npc.name,
                kind: questTemplate.kind,
                title: questTemplate.title,
                description: questTemplate.description,
                target: questTemplate.target,
                progress: 0,
                rewardXp: questTemplate.rewardXp,
                rewardGold: questTemplate.rewardGold,
                complete: false
            };
            this.openDialog(npc.name, [
                questTemplate.title,
                questTemplate.description,
                `Goal: 0 / ${questTemplate.target}`,
                'Return when it is done.'
            ]);
            return;
        }

        if (this.activeQuest.sourceNpcId === npc.id && this.activeQuest.complete) {
            this.player.gold += this.activeQuest.rewardGold;
            this.gainXp(this.activeQuest.rewardXp);
            this.completedQuests[this.activeQuest.id] = true;
            const title = this.activeQuest.title;
            const rewardGold = this.activeQuest.rewardGold;
            const rewardXp = this.activeQuest.rewardXp;
            this.activeQuest = null;
            this.openDialog(npc.name, [
                `${title} is finished.`,
                `Reward: ${rewardXp} XP and ${rewardGold} gold.`,
                'The roads remember what you cleared.'
            ]);
            return;
        }

        if (this.activeQuest.sourceNpcId === npc.id) {
            this.openDialog(npc.name, [
                this.activeQuest.title,
                `${this.activeQuest.progress} / ${this.activeQuest.target}`,
                this.activeQuest.complete ? 'You have done it.' : 'The work is not finished.'
            ]);
        } else {
            this.openDialog(npc.name, [
                'You already carry another promise.',
                `${this.activeQuest.title}: ${this.activeQuest.progress} / ${this.activeQuest.target}`
            ]);
        }
    }

    enterDungeon(entrance) {
        if (this.mode !== 'overworld') return;
        this.overworldReturn = { x: this.player.x, y: this.player.y };
        this.currentDungeon = generateDungeon(this.worldSeed, entrance.id, entrance.level || 1);
        this.currentDungeon.name = entrance.name || this.currentDungeon.name;
        this.mode = 'dungeon';
        this.player.x = this.currentDungeon.start.x;
        this.player.y = this.currentDungeon.start.y;
        this.player.angle = -Math.PI / 2;
        this.cameraX = this.player.x;
        this.cameraY = this.player.y;
        this.checkpoint = { mode: 'dungeon', dungeonId: this.currentDungeon.id, x: this.player.x, y: this.player.y };
        this.lastChunkKey = null;
        this.activeEnemies = [];
        this.lootDrops = [];
        this.refreshArea(true);
        this.statusMessage(this.currentDungeon.name.toUpperCase());
    }

    exitDungeon() {
        if (this.mode !== 'dungeon' || !this.overworldReturn) return;
        for (const enemy of this.activeEnemies) this.persistEnemy(enemy);
        this.mode = 'overworld';
        this.player.x = this.overworldReturn.x;
        this.player.y = this.overworldReturn.y;
        this.cameraX = this.player.x;
        this.cameraY = this.player.y;
        this.currentDungeon = null;
        this.overworldReturn = null;
        this.checkpoint = { mode: 'overworld', x: this.player.x, y: this.player.y };
        this.lastChunkKey = null;
        this.activeEnemies = [];
        this.lootDrops = [];
        this.refreshArea(true);
        this.statusMessage('RETURNED TO THE SURFACE');
    }

    openSecret(secret) {
        if (this.secretState[secret.id] && this.secretState[secret.id].opened) return;
        if (this.mode === 'dungeon' && secret.roomId && !this.secretRoomAccessible(secret)) {
            this.statusMessage('A sealed wall blocks the way.');
            return;
        }
        this.secretState[secret.id] = { opened: true };
        this.player.secrets += 1;
        this.progressQuest('secret', 1);
        this.gainXp(45 + this.player.level * 6);
        this.player.gold += 22 + this.player.level * 3;
        if (secret.reward === 'iron-longsword' || secret.reward === 'moon-spear' || secret.reward === 'hunter-bow') {
            this.unlockWeapon(secret.reward);
        } else if (secret.reward === 'upgrade') {
            const choices = Object.keys(UPGRADES).filter((id) => !this.player.upgrades[id]);
            if (choices.length > 0) {
                const id = choices[Math.floor(this.random() * choices.length)];
                this.applyUpgrade(id);
            }
        }
        this.statusMessage('SECRET FOUND');
        this.refreshArea(true);
    }

    secretRoomAccessible(secret) {
        if (!this.currentDungeon) return false;
        const room = this.currentDungeon.rooms.find((candidate) => candidate.id === secret.roomId);
        if (!room) return false;
        for (const wall of this.currentDungeon.walls) {
            if (wall.secret && wall.hp > 0 && distance(secret.x, secret.y, wall.x + wall.w / 2, wall.y + wall.h / 2) < 35) return false;
        }
        return true;
    }

    collectLoot(loot) {
        const index = this.lootDrops.findIndex((candidate) => candidate.id === loot.id);
        if (index < 0) return;
        const item = this.lootDrops[index];
        if (item.kind === 'gold') {
            this.player.gold += item.amount;
            this.statusMessage(`+${item.amount} GOLD`);
        } else if (item.kind === 'healing') {
            this.player.health = clamp(this.player.health + item.amount, 0, this.player.maxHealth);
            this.statusMessage('HEALTH RESTORED');
        } else {
            this.player.stamina = clamp(this.player.stamina + item.amount, 0, this.player.maxStamina);
            this.statusMessage('STAMINA RESTORED');
        }
        this.lootDrops.splice(index, 1);
    }

    useLandmark(landmark) {
        if (landmark.kind !== 'campfire') return;
        this.player.health = this.player.maxHealth;
        this.player.stamina = this.player.maxStamina;
        this.player.posture = this.player.maxPosture;
        this.checkpoint = { mode: this.mode, dungeonId: this.currentDungeon ? this.currentDungeon.id : null, x: this.player.x, y: this.player.y };
        this.statusMessage('REFUGE SET — RESOURCES RESTORED');
    }

    updateInteractionTarget() {
        let best = null;
        let bestDistance = Infinity;
        for (const item of this.visibleInteractables) {
            if (item.interactionKind === 'secret') {
                const revealDistance = item.roomId ? 7 : 8;
                if (distance(this.player.x, this.player.y, item.x, item.y) > revealDistance) continue;
            }
            const d = distance(this.player.x, this.player.y, item.x, item.y);
            const range = item.interactionKind === 'dungeon' || item.interactionKind === 'exit' ? 5.5 : 4.5;
            if (d <= range && d < bestDistance) {
                best = item;
                bestDistance = d;
            }
        }
        for (const loot of this.lootDrops) {
            const d = distance(this.player.x, this.player.y, loot.x, loot.y);
            if (d <= 3.8 && d < bestDistance) {
                best = Object.assign({ interactionKind: 'loot' }, loot);
                bestDistance = d;
            }
        }
        this.currentInteraction = best;
    }

    openDialog(title, lines) {
        this.phase = 'dialog';
        this.dialogTitle = title;
        this.dialogLines = lines.slice(0, 6);
        this.keys = {};
        guard(this.player, false);
        this.renderAll(true);
        this.getViewRoot().node.onStateChange();
    }

    closeDialog() {
        if (this.phase !== 'dialog') return;
        this.phase = 'playing';
        this.keys = {};
        this.renderAll(true);
        this.getViewRoot().node.onStateChange();
    }

    respawnPlayer() {
        if (this.phase !== 'death') return;
        this.player.dead = false;
        this.player.health = this.player.maxHealth;
        this.player.stamina = this.player.maxStamina;
        this.player.posture = this.player.maxPosture;
        this.player.staggerTicks = 0;
        this.player.invulnerableTicks = ticksFor(1.2);
        cancelAction(this.player);
        guard(this.player, false);

        if (this.checkpoint.mode === 'dungeon' && this.currentDungeon && this.currentDungeon.id === this.checkpoint.dungeonId) {
            this.player.x = this.checkpoint.x;
            this.player.y = this.checkpoint.y;
        } else {
            if (this.mode === 'dungeon' && this.overworldReturn) {
                this.mode = 'overworld';
                this.currentDungeon = null;
                this.player.x = this.overworldReturn.x;
                this.player.y = this.overworldReturn.y;
                this.overworldReturn = null;
            } else {
                this.player.x = this.checkpoint.x;
                this.player.y = this.checkpoint.y;
            }
        }
        this.cameraX = this.player.x;
        this.cameraY = this.player.y;
        this.phase = 'playing';
        this.lastChunkKey = null;
        this.activeEnemies = [];
        this.refreshArea(true);
        this.statusMessage('RETURNED TO REFUGE');
        this.renderAll(true);
        this.getViewRoot().node.onStateChange();
    }

    openUpgradeChoice() {
        const available = Object.keys(UPGRADES).filter((id) => !this.player.upgrades[id]);
        while (available.length < 3) available.push(['vitality', 'flow', 'breaker'][available.length]);
        this.upgradeChoices = [];
        while (this.upgradeChoices.length < 3 && available.length > 0) {
            const index = Math.floor(this.random() * available.length);
            this.upgradeChoices.push(available.splice(index, 1)[0]);
        }
        this.phase = 'upgrade';
        this.keys = {};
        guard(this.player, false);
        this.renderAll(true);
        this.getViewRoot().node.onStateChange();
    }

    chooseUpgrade(index) {
        if (this.phase !== 'upgrade') return;
        const id = this.upgradeChoices[index];
        if (!id) return;
        this.applyUpgrade(id);
        this.phase = 'playing';
        this.player.health = this.player.maxHealth;
        this.player.stamina = this.player.maxStamina;
        this.player.posture = this.player.maxPosture;
        this.statusMessage(`${UPGRADES[id].name.toUpperCase()} ACQUIRED`);
        this.renderAll(true);
        this.getViewRoot().node.onStateChange();
    }

    applyUpgrade(id) {
        if (!UPGRADES[id]) return;
        this.player.upgrades[id] = true;
        if (id === 'vitality') {
            this.player.maxHealth += 18;
            this.player.health = this.player.maxHealth;
        } else if (id === 'parry') {
            this.player.parryWindowTicks += 2;
        }
    }

    statusMessage(text) {
        this.statusText = String(text || '');
        this.statusTicks = ticksFor(TUNING.STATUS_SECONDS);
    }

    updateCamera() {
        const amount = clamp(TUNING.CAMERA_FOLLOW_PER_SECOND * TUNING.DT, 0, 1);
        this.cameraX = lerp(this.cameraX, this.player.x, amount);
        this.cameraY = lerp(this.cameraY, this.player.y, amount);
    }

    emitBurst(x, y, color, count) {
        let remaining = count;
        for (const particle of this.particles) {
            if (remaining <= 0) break;
            if (particle.active) continue;
            remaining -= 1;
            const angle = this.random() * Math.PI * 2;
            const speed = 6 + this.random() * 15;
            particle.active = true;
            particle.x = x;
            particle.y = y;
            particle.vx = Math.cos(angle) * speed;
            particle.vy = Math.sin(angle) * speed;
            particle.lifeTicks = ticksFor(0.18 + this.random() * 0.22);
            particle.maxLifeTicks = particle.lifeTicks;
            particle.size = 0.25 + this.random() * 0.55;
            particle.color = color.slice();
        }
    }

    updateParticles() {
        for (const particle of this.particles) {
            if (!particle.active) continue;
            particle.x += particle.vx * TUNING.DT;
            particle.y += particle.vy * TUNING.DT;
            particle.vx *= 0.96;
            particle.vy *= 0.96;
            particle.lifeTicks -= 1;
            if (particle.lifeTicks <= 0) particle.active = false;
        }
    }

    random() {
        let x = this.rngState | 0;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        this.rngState = x >>> 0;
        return this.rngState / 4294967296;
    }

    toScreen(worldX, worldY) {
        const scale = 100 / TUNING.VIEW_SIZE;
        return {
            x: 50 + (worldX - this.cameraX) * scale,
            y: 50 + (worldY - this.cameraY) * scale,
            scale
        };
    }

    isOnScreen(worldX, worldY, margin) {
        const point = this.toScreen(worldX, worldY);
        const pad = margin || 4;
        return point.x >= -pad && point.x <= 100 + pad && point.y >= -pad && point.y <= 100 + pad;
    }

    hideShape(node) {
        node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
        node.node.fill = C.transparent;
        node.node.color = [255, 255, 255, 255];
        node.node.effects = null;
    }

    hideText(node) {
        this.setText(node, '', 0, 0, 1, 'left', C.white);
    }

    showNodeForAll(node) {
        node.node.playerIds = [];
    }

    hideNode(node) {
        node.node.playerIds = [0];
    }

    renderAll(forceUi) {
        this.renderGround();
        this.renderProps();
        this.renderWalls();
        this.renderInteractables();
        this.renderEnemies();
        this.renderPlayer();
        this.renderProjectiles();
        this.renderParticles();
        this.renderHud(forceUi);
        this.renderOverlay();
    }

    currentBiome() {
        if (this.mode === 'dungeon') return null;
        const cx = Math.floor(this.player.x / CHUNK_SIZE);
        const cy = Math.floor(this.player.y / CHUNK_SIZE);
        const key = keyOfChunk(cx, cy);
        const chunk = this.chunkCache[key] || generateChunk(this.worldSeed, cx, cy);
        this.chunkCache[key] = chunk;
        return chunk.biome;
    }

    renderGround() {
        const biome = this.currentBiome();
        this.floorNode.node.fill = this.mode === 'dungeon' ? C.dungeonFloor : biome.floor;
        const gridColor = this.mode === 'dungeon' ? [255, 255, 255, 22] : [255, 255, 255, 15];
        const spacing = this.mode === 'dungeon' ? 11.5 : 10;
        const offsetX = ((-this.cameraX % spacing) + spacing) % spacing;
        const offsetY = ((-this.cameraY % spacing) + spacing) % spacing;
        let pair = 0;
        for (let index = -1; index < 10; index += 1) {
            const vertical = this.gridNodes[pair++];
            const horizontal = this.gridNodes[pair++];
            const x = offsetX + index * spacing;
            const y = offsetY + index * spacing;
            vertical.node.coordinates2d = safeRectangle(x, 0, 0.1, 100);
            horizontal.node.coordinates2d = safeRectangle(0, y, 100, 0.1);
            vertical.node.fill = [255, 255, 255, 255];
            horizontal.node.fill = [255, 255, 255, 255];
            vertical.node.color = gridColor;
            horizontal.node.color = gridColor;
        }
    }

    renderProps() {
        const visible = [];
        for (const prop of this.visibleProps) {
            if (this.isOnScreen(prop.x, prop.y, prop.radius + 3)) visible.push(prop);
        }
        visible.sort((a, b) => distance(this.player.x, this.player.y, a.x, a.y) - distance(this.player.x, this.player.y, b.x, b.y));
        for (let index = 0; index < this.propNodes.length; index += 1) {
            const node = this.propNodes[index];
            const prop = visible[index];
            if (!prop) {
                this.hideShape(node);
                continue;
            }
            const screen = this.toScreen(prop.x, prop.y);
            const radius = prop.radius * screen.scale;
            if (prop.kind === 'rock') node.node.coordinates2d = safeRectangle(screen.x - radius, screen.y - radius * 0.7, radius * 2, radius * 1.4);
            else node.node.coordinates2d = polyCircle(screen.x, screen.y, radius, prop.kind === 'tree' ? 10 : 7);
            node.node.fill = prop.color;
            node.node.color = prop.solid ? [10, 18, 18, 190] : [255, 255, 255, 110];
            node.node.border = prop.solid ? 4 : 0;
        }
    }

    renderWalls() {
        const visible = [];
        for (const wall of this.visibleWalls) {
            if (!wall.solid) continue;
            const centerX = wall.x + wall.w / 2;
            const centerY = wall.y + wall.h / 2;
            if (this.isOnScreen(centerX, centerY, Math.max(wall.w, wall.h))) visible.push(wall);
        }
        visible.sort((a, b) => distance(this.player.x, this.player.y, a.x, a.y) - distance(this.player.x, this.player.y, b.x, b.y));
        for (let index = 0; index < this.wallNodes.length; index += 1) {
            const node = this.wallNodes[index];
            const wall = visible[index];
            if (!wall) {
                this.hideShape(node);
                continue;
            }
            const screen = this.toScreen(wall.x, wall.y);
            node.node.coordinates2d = safeRectangle(screen.x, screen.y, wall.w * screen.scale, wall.h * screen.scale);
            const nearSecret = wall.secret && distance(this.player.x, this.player.y, wall.x + wall.w / 2, wall.y + wall.h / 2) < 8;
            node.node.fill = nearSecret ? C.dungeonSecretWall : C.dungeonWall;
            node.node.color = nearSecret ? C.secret : [18, 20, 29, 255];
            node.node.border = nearSecret ? 5 : 3;
        }
    }

    renderInteractables() {
        const list = [];
        for (const item of this.visibleInteractables) {
            if (!this.isOnScreen(item.x, item.y, 6)) continue;
            if (item.interactionKind === 'secret') {
                const reveal = item.roomId ? 8 : 9;
                if (distance(this.player.x, this.player.y, item.x, item.y) > reveal) continue;
                if (item.roomId && !this.secretRoomAccessible(item)) continue;
            }
            list.push(item);
        }
        for (const loot of this.lootDrops) {
            if (this.isOnScreen(loot.x, loot.y, 4)) list.push(Object.assign({ interactionKind: 'loot' }, loot));
        }
        list.sort((a, b) => distance(this.player.x, this.player.y, a.x, a.y) - distance(this.player.x, this.player.y, b.x, b.y));

        for (let index = 0; index < this.interactableNodes.length; index += 1) {
            const visual = this.interactableNodes[index];
            const item = list[index];
            if (!item) {
                this.hideShape(visual.shape);
                this.hideText(visual.marker);
                continue;
            }
            const screen = this.toScreen(item.x, item.y);
            let fill = C.loot;
            let marker = '*';
            let radius = 1.7;
            if (item.interactionKind === 'npc') {
                fill = item.color || C.npc;
                marker = this.activeQuest && this.activeQuest.sourceNpcId === item.id && this.activeQuest.complete ? '?' : '!';
                radius = 2.1;
            } else if (item.interactionKind === 'dungeon') {
                fill = C.dungeon;
                marker = 'D';
                radius = 2.7;
            } else if (item.interactionKind === 'exit') {
                fill = C.white;
                marker = 'X';
                radius = 2.4;
            } else if (item.interactionKind === 'secret') {
                fill = C.secret;
                marker = '?';
                radius = 1.8;
            } else if (item.interactionKind === 'landmark') {
                fill = C.gold;
                marker = 'R';
                radius = 2.2;
            } else if (item.interactionKind === 'loot') {
                fill = item.kind === 'gold' ? C.gold : item.kind === 'healing' ? C.health : C.stamina;
                marker = '+';
                radius = 1.25;
            }
            visual.shape.node.coordinates2d = polyCircle(screen.x, screen.y, radius * screen.scale, 9);
            visual.shape.node.fill = fill;
            visual.shape.node.color = [255, 255, 255, 210];
            visual.shape.node.border = 4;
            this.setText(visual.marker, marker, screen.x, screen.y - radius - 2.2, 1.5, 'center', fill);
        }
    }

    renderEnemies() {
        for (let index = 0; index < this.enemyVisuals.length; index += 1) {
            const visual = this.enemyVisuals[index];
            const enemy = this.activeEnemies[index];
            if (!enemy || !this.isOnScreen(enemy.x, enemy.y, 12)) {
                this.hideActorVisual(visual);
                continue;
            }
            this.renderActor(enemy, visual, false);
        }
    }

    renderPlayer() {
        this.renderActor(this.player, this.playerNodes, true);
    }

    hideActorVisual(visual) {
        for (const key of Object.keys(visual)) this.hideShape(visual[key]);
    }

    renderActor(actor, visual, isPlayer) {
        if (!actor || !this.isOnScreen(actor.x, actor.y, 12)) {
            this.hideActorVisual(visual);
            return;
        }
        const screen = this.toScreen(actor.x, actor.y);
        const deathScale = actor.dead ? clamp(actor.despawnTicks / ticksFor(TUNING.ENEMY_DESPAWN_SECONDS), 0, 1) : 1;
        const radius = actor.radius * screen.scale * deathScale;
        const baseColor = actor.hitFlashTicks > 0 ? C.white : actor.parryFlashTicks > 0 ? C.parry : actor.blockFlashTicks > 0 ? C.block : actor.color;
        visual.shadow.node.coordinates2d = safeRectangle(screen.x - radius * 0.9, screen.y + radius * 0.5, radius * 1.8, radius * 0.65);
        visual.shadow.node.fill = [0, 0, 0, 255];
        visual.shadow.node.color = [255, 255, 255, 90];
        visual.body.node.coordinates2d = polyCircle(screen.x, screen.y, radius, actor.boss ? 14 : 11);
        visual.body.node.fill = baseColor;
        visual.body.node.color = [actor.darkColor[0], actor.darkColor[1], actor.darkColor[2], Math.round(255 * deathScale)];
        visual.body.node.border = actor.boss ? 7 : 5;
        visual.body.node.effects = actor.boss && !actor.dead ? { shadow: { color: [actor.color[0], actor.color[1], actor.color[2], 255], blur: 10 } } : null;
        visual.facing.node.coordinates2d = facingTriangle(screen.x, screen.y, actor.angle, radius * 1.18);
        visual.facing.node.fill = actor.darkColor;
        visual.facing.node.color = [255, 255, 255, Math.round(255 * deathScale)];

        const weaponColor = isPlayer ? this.currentWeapon().color : C.white;
        const phase = actionPhase(actor);
        let weaponLength = radius * 2.4;
        if (actor.action === 'LIGHT' || actor.action === 'HEAVY') {
            weaponLength = radius * (phase === 'active' ? 4.2 : phase === 'startup' ? 3.1 : 2.2);
        }
        const handX = screen.x + Math.cos(actor.angle) * radius * 0.6;
        const handY = screen.y + Math.sin(actor.angle) * radius * 0.6;
        const tipX = screen.x + Math.cos(actor.angle) * weaponLength;
        const tipY = screen.y + Math.sin(actor.angle) * weaponLength;
        visual.weapon.node.coordinates2d = thickLine(handX, handY, tipX, tipY, actor.action === 'HEAVY' ? 0.75 : 0.48);
        visual.weapon.node.fill = weaponColor;
        visual.weapon.node.color = [255, 255, 255, Math.round(255 * deathScale)];

        if (actor.guarding) {
            const frontX = screen.x + Math.cos(actor.angle) * radius * 1.45;
            const frontY = screen.y + Math.sin(actor.angle) * radius * 1.45;
            const sideX = Math.sin(actor.angle) * radius * 1.15;
            const sideY = -Math.cos(actor.angle) * radius * 1.15;
            visual.shield.node.coordinates2d = thickLine(frontX - sideX, frontY - sideY, frontX + sideX, frontY + sideY, 0.9);
            visual.shield.node.fill = actor.guardTicks <= actor.parryWindowTicks ? C.parry : C.block;
            visual.shield.node.color = [255, 255, 255, 255];
        } else {
            this.hideShape(visual.shield);
        }

        if (visual.healthBack && visual.healthFill) {
            const width = actor.boss ? 11 : 7;
            const ratio = clamp(actor.health / actor.maxHealth, 0, 1);
            visual.healthBack.node.coordinates2d = safeRectangle(screen.x - width / 2, screen.y - radius - 3.4, width, 0.9);
            visual.healthBack.node.fill = [50, 25, 33, 255];
            visual.healthFill.node.coordinates2d = safeRectangle(screen.x - width / 2, screen.y - radius - 3.4, width * ratio, 0.9);
            visual.healthFill.node.fill = actor.boss ? C.purple : C.health;
        }

        if (isPlayer && visual.arc) {
            if ((actor.action === 'LIGHT' || actor.action === 'HEAVY') && phase === 'active' && actor.actionSpec) {
                visual.arc.node.coordinates2d = arcSector(screen.x, screen.y, actor.angle, actor.actionSpec.range * screen.scale, actor.actionSpec.arc * 0.58);
                visual.arc.node.fill = [255, 255, 255, 255];
                visual.arc.node.color = [weaponColor[0], weaponColor[1], weaponColor[2], 95];
            } else this.hideShape(visual.arc);
        }
    }

    renderProjectiles() {
        for (const projectile of this.projectiles) {
            if (!projectile.active || !this.isOnScreen(projectile.x, projectile.y, 3)) {
                this.hideShape(projectile.node);
                continue;
            }
            const screen = this.toScreen(projectile.x, projectile.y);
            const angle = Math.atan2(projectile.vy, projectile.vx);
            projectile.node.node.coordinates2d = thickLine(
                screen.x - Math.cos(angle) * 1.1,
                screen.y - Math.sin(angle) * 1.1,
                screen.x + Math.cos(angle) * 1.1,
                screen.y + Math.sin(angle) * 1.1,
                0.45
            );
            projectile.node.node.fill = projectile.color;
            projectile.node.node.color = [255, 255, 255, 255];
        }
    }

    renderParticles() {
        for (const particle of this.particles) {
            if (!particle.active || !this.isOnScreen(particle.x, particle.y, 2)) {
                this.hideShape(particle.node);
                continue;
            }
            const screen = this.toScreen(particle.x, particle.y);
            const alpha = Math.round(230 * clamp(particle.lifeTicks / Math.max(1, particle.maxLifeTicks), 0, 1));
            particle.node.node.coordinates2d = polyCircle(screen.x, screen.y, particle.size * screen.scale, 6);
            particle.node.node.fill = [particle.color[0], particle.color[1], particle.color[2], 255];
            particle.node.node.color = [255, 255, 255, alpha];
        }
    }

    renderHud() {
        const healthRatio = clamp(this.player.health / this.player.maxHealth, 0, 1);
        const staminaRatio = clamp(this.player.stamina / this.player.maxStamina, 0, 1);
        const postureRatio = clamp(this.player.posture / this.player.maxPosture, 0, 1);
        const xpRatio = clamp(this.player.xp / this.player.xpNext, 0, 1);
        this.healthFill.node.coordinates2d = safeRectangle(2, 2, 24 * healthRatio, 2.2);
        this.staminaFill.node.coordinates2d = safeRectangle(2, 5, 24 * staminaRatio, 1.4);
        this.postureFill.node.coordinates2d = safeRectangle(2, 7, 24 * postureRatio, 1.1);
        this.xpFill.node.coordinates2d = safeRectangle(29, 7.2, 28 * xpRatio, 0.9);
        this.setText(this.levelText, `LV ${this.player.level}  XP ${this.player.xp}/${this.player.xpNext}`, 29, 1.6, 1.65, 'left', C.white);
        this.setText(this.weaponText, `${this.currentWeapon().name} / ${this.currentRangedWeapon().name}`, 29, 4.2, 1.35, 'left', C.muted);
        const area = this.mode === 'dungeon' && this.currentDungeon ? this.currentDungeon.name : this.currentBiome().name;
        this.setText(this.areaText, area.toUpperCase(), 58, 1.6, 1.65, 'left', C.white);
        const cx = Math.floor(this.player.x / CHUNK_SIZE);
        const cy = Math.floor(this.player.y / CHUNK_SIZE);
        this.setText(this.coordText, this.mode === 'dungeon' ? `DEPTH ${this.currentDungeon.level}` : `CHUNK ${cx},${cy}  SEED C0FFEE`, 58, 4.2, 1.25, 'left', C.muted);
        this.setText(this.goldText, `${this.player.gold}G`, 97, 1.6, 1.7, 'right', C.gold);
        const quest = this.activeQuest ? `${this.activeQuest.title.toUpperCase()} ${this.activeQuest.progress}/${this.activeQuest.target}` : 'NO QUEST';
        this.setText(this.questText, quest, 97, 4.2, 1.15, 'right', this.activeQuest && this.activeQuest.complete ? C.gold : C.muted);
        const prompt = this.interactionPrompt();
        this.setText(this.promptText, prompt, 50, 84.8, 1.55, 'center', prompt ? C.white : C.transparent);
        this.setText(this.statusNode, this.statusTicks > 0 ? this.statusText : '', 50, 12, 1.55, 'center', C.white);
    }

    interactionPrompt() {
        const target = this.currentInteraction;
        if (!target) return '';
        if (target.interactionKind === 'npc') return `E — TALK TO ${target.name.toUpperCase()}`;
        if (target.interactionKind === 'dungeon') return `E — ENTER ${target.name.toUpperCase()}`;
        if (target.interactionKind === 'exit') return 'E — RETURN TO THE SURFACE';
        if (target.interactionKind === 'secret') return 'E — OPEN HIDDEN CACHE';
        if (target.interactionKind === 'loot') return 'E — TAKE DROP';
        if (target.interactionKind === 'landmark') return 'E — REST AT REFUGE';
        return '';
    }


    exportSaveState(name) {
        return {
            kind: 'homegames.save',
            formatVersion: 1,
            game: 'counterforge-wilds',
            name: name || 'Wilds Save',
            seed: this.worldSeed,
            player: {
                level: this.player.level,
                xp: this.player.xp,
                xpNext: this.player.xpNext,
                gold: this.player.gold,
                maxHealth: this.player.maxHealth,
                maxStamina: this.player.maxStamina,
                maxPosture: this.player.maxPosture,
                meleeInventory: this.player.meleeInventory.slice(),
                rangedInventory: this.player.rangedInventory.slice(),
                weaponIndex: this.player.weaponIndex,
                rangedIndex: this.player.rangedIndex,
                upgrades: Object.assign({}, this.player.upgrades),
                kills: this.player.kills,
                secrets: this.player.secrets,
                bosses: this.player.bosses
            },
            position: {
                mode: this.mode,
                x: this.player.x,
                y: this.player.y,
                dungeonId: this.currentDungeon ? this.currentDungeon.id : null,
                overworldReturn: this.overworldReturn ? Object.assign({}, this.overworldReturn) : null,
                checkpoint: Object.assign({}, this.checkpoint)
            },
            progress: {
                entityState: Object.assign({}, this.entityState),
                secretState: Object.assign({}, this.secretState),
                dungeonState: Object.assign({}, this.dungeonState),
                completedQuests: Object.assign({}, this.completedQuests),
                activeQuest: this.activeQuest ? Object.assign({}, this.activeQuest) : null
            }
        };
    }

    renderOverlay() {
        const hideOverlayText = (node) => {
            this.hideNode(node);
            this.hideText(node);
        };
        const showOverlayText = (node) => this.showNodeForAll(node);
        const hideOverlayShape = (node) => {
            this.hideNode(node);
            this.hideShape(node);
        };

        // Collapse click targets geometrically as well as scoping them to [0].
        // Hidden controls therefore cannot intercept input even if a host sends an
        // unfiltered frame.
        hideOverlayShape(this.overlayShade);
        hideOverlayText(this.overlayTitle);
        for (const line of this.overlayLines) hideOverlayText(line);
        hideOverlayText(this.overlayHint);
        hideOverlayShape(this.overlayTapCatcher);
        this.hideButton(this.startButton);
        for (const button of this.choiceButtons) this.hideButton(button);

        if (this.phase === 'playing') return;

        this.showNodeForAll(this.overlayShade);
        this.overlayShade.node.coordinates2d = safeRectangle(0, 0, 100, 100);
        this.overlayShade.node.fill = [4, 6, 10, 242];
        this.overlayShade.node.color = [255, 255, 255, 255];
        this.overlayShade.node.effects = null;
        showOverlayText(this.overlayTitle);
        for (const line of this.overlayLines) showOverlayText(line);
        showOverlayText(this.overlayHint);
        this.showNodeForAll(this.overlayTapCatcher);
        this.overlayTapCatcher.node.coordinates2d = safeRectangle(0, 0, 100, 100);
        this.overlayTapCatcher.node.fill = C.transparent;

        if (this.phase === 'title') {
            this.setText(this.overlayTitle, 'COUNTERFORGE: WILDS', 50, 22, 4.1, 'center', C.white);
            const lines = [
                'A huge deterministic world generated as you travel.',
                'Precise 120 Hz combat: attack, block, parry, shoot, dodge.',
                'Find NPC quests, hidden caches, dungeons, bosses and weapons.',
                'WASD move  ARROWS aim  J/K attacks  L guard  I bow',
                'SPACE dodge  E interact  Q melee  C ranged',
                'Menus advance only when you choose. Tick rate never changes pace.',
                `WORLD: ${WORLD_SIZE.toLocaleString('en-US')} x ${WORLD_SIZE.toLocaleString('en-US')}`
            ];
            for (let index = 0; index < this.overlayLines.length; index += 1) {
                this.setText(this.overlayLines[index], lines[index] || '', 50, 35 + index * 5, index === 6 ? 1.45 : 1.55, 'center', index === 0 ? C.white : C.muted);
            }
            this.setText(this.overlayHint, 'PRESS ENTER OR CLICK TO BEGIN', 50, 76.5, 1.7, 'center', C.gold);
            this.showButton(this.startButton, 'ENTER THE WILDS');
        } else if (this.phase === 'dialog') {
            this.setText(this.overlayTitle, String(this.dialogTitle || 'TRAVELER').toUpperCase(), 50, 24, 3.2, 'center', C.white);
            for (let index = 0; index < this.overlayLines.length; index += 1) {
                this.setText(this.overlayLines[index], this.dialogLines[index] || '', 50, 38 + index * 5, 1.65, 'center', index === 0 ? C.gold : C.muted);
            }
            this.setText(this.overlayHint, 'CLICK, PRESS E, OR PRESS ENTER TO CONTINUE', 50, 78, 1.55, 'center', C.gold);
        } else if (this.phase === 'death') {
            this.setText(this.overlayTitle, 'YOU FELL', 50, 24, 4, 'center', C.health);
            for (let index = 0; index < this.overlayLines.length; index += 1) {
                this.setText(this.overlayLines[index], this.dialogLines[index] || '', 50, 40 + index * 5, 1.65, 'center', C.muted);
            }
            this.setText(this.overlayHint, 'PRESS ENTER OR CLICK RETURN', 50, 76, 1.7, 'center', C.gold);
            this.showButton(this.startButton, 'RETURN');
        } else if (this.phase === 'upgrade') {
            this.setText(this.overlayTitle, 'WARDEN DEFEATED', 50, 20, 3.5, 'center', C.purple);
            this.setText(this.overlayLines[0], 'Choose one permanent combat upgrade.', 50, 31, 1.7, 'center', C.white);
            for (let index = 0; index < 3; index += 1) {
                const upgrade = UPGRADES[this.upgradeChoices[index]];
                this.setText(this.overlayLines[1 + index * 2], `${index + 1}. ${upgrade ? upgrade.name.toUpperCase() : ''}`, 50, 39 + index * 9, 1.7, 'center', C.gold);
                this.setText(this.overlayLines[2 + index * 2], upgrade ? upgrade.description : '', 50, 43 + index * 9, 1.35, 'center', C.muted);
                this.showButton(this.choiceButtons[index], String(index + 1));
            }
            this.setText(this.overlayHint, 'PRESS 1, 2 OR 3 — THIS SCREEN HAS NO TIMER', 50, 87, 1.5, 'center', C.gold);
        }
    }

}

module.exports = CounterforgeWilds;
