'use strict';

// SPDX-License-Identifier: MIT

const { Game, GameNode, Shapes, ShapeUtils } = require('squish-150');
const { ActionModel, ACTIONS, FEATURE_NAMES, INTERFACE_ID } = require('./action-model');

const TUNING = {
    TICK_RATE: 120, // tickRate - MUST match the literal in metadata()
    MAX_PLAYERS: 1, // maxPlayers - MUST match the literal in metadata()
    ARENA_LEFT: 2,
    ARENA_TOP: 10,
    ARENA_RIGHT: 73,
    ARENA_BOTTOM: 98,
    PLAYER_SPEED: 26,
    ENEMY_SPEED: 23,
    BODY_RADIUS: 2.1,
    MAX_HEALTH: 100,
    MAX_STAMINA: 100,
    MAX_POSTURE: 100,
    STAMINA_REGEN: 24,
    POSTURE_REGEN: 12,
    BLOCK_MOVE_SCALE: 0.42,
    HITSTOP_TICKS: 3,
    SAMPLE_EVERY_TICKS: 18,
    SAMPLE_HORIZON_TICKS: 38,
    AI_DECISION_TICKS: 4,
    APEX_WIN_THRESHOLD: 7,
    PROJECTILE_POOL: 12,
    PARTICLE_POOL: 18,
    BETWEEN_DUELS_TICKS: 90,
    COUNTDOWN_TICKS: 90,
    STATUS_TICKS: 180
};

const ACTION_SPEC = {
    LIGHT: {
        startup: 7,
        active: 5,
        recovery: 18,
        stamina: 12,
        damage: 12,
        posture: 15,
        range: 7.8,
        arc: 1.35,
        lunge: 8
    },
    HEAVY: {
        startup: 20,
        active: 5,
        recovery: 31,
        stamina: 25,
        damage: 25,
        posture: 38,
        range: 9.2,
        arc: 0.82,
        lunge: 12
    },
    RANGED: {
        startup: 16,
        active: 1,
        recovery: 24,
        stamina: 23,
        damage: 11,
        posture: 18,
        speed: 43,
        life: 210
    },
    DODGE: {
        startup: 0,
        active: 12,
        recovery: 8,
        stamina: 21,
        speed: 42,
        invulnerable: 9
    }
};

const C = {
    bg: [5, 7, 11, 255],
    floor: [13, 18, 25, 255],
    floorAlt: [18, 24, 33, 255],
    panel: [10, 14, 21, 255],
    panelAlt: [18, 24, 35, 255],
    line: [60, 76, 98, 255],
    text: [242, 246, 252, 255],
    muted: [143, 157, 178, 255],
    player: [65, 221, 255, 255],
    playerDark: [20, 92, 118, 255],
    enemy: [255, 72, 92, 255],
    enemyDark: [121, 28, 47, 255],
    apex: [205, 91, 255, 255],
    gold: [255, 211, 84, 255],
    green: [91, 230, 145, 255],
    orange: [255, 143, 63, 255],
    blue: [83, 137, 255, 255],
    white: [255, 255, 255, 255],
    black: [0, 0, 0, 255],
    transparent: [0, 0, 0, 0]
};

const ACTION_INDEX = {};
for (let i = 0; i < ACTIONS.length; i += 1) ACTION_INDEX[ACTIONS[i]] = i;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function seconds(value) {
    return Math.max(1, Math.round(value * TUNING.TICK_RATE));
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
    const count = sides || 14;
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
        x + Math.cos(angle + 2.48) * size * 0.68,
        y + Math.sin(angle + 2.48) * size * 0.68,
        x + Math.cos(angle - 2.48) * size * 0.68,
        y + Math.sin(angle - 2.48) * size * 0.68
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

function signed(value) {
    if (Math.abs(value) < 0.005) return '0.00';
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

function actionPhase(actor) {
    if (actor.action === 'NEUTRAL') return 'neutral';
    const spec = ACTION_SPEC[actor.action];
    if (!spec) return 'neutral';
    if (actor.actionTick < spec.startup) return 'startup';
    if (actor.actionTick < spec.startup + spec.active) return 'active';
    return 'recovery';
}

function actionRemaining(actor) {
    if (actor.action === 'NEUTRAL') return 0;
    const spec = ACTION_SPEC[actor.action];
    return spec ? Math.max(0, spec.startup + spec.active + spec.recovery - actor.actionTick) : 0;
}

class CounterforgeApex extends Game {
    static metadata() {
        return {
            isTest: true,
            thumbnail: './assets/thumbnail.png',
            name: 'Counterforge: Apex',
            author: "Joseph Garcia",
            description: 'Duel a rival that learns your habits. Defeat seven versions, then survive its unbeatable final form.',
            aspectRatio: { x: 1, y: 1 },
            tickRate: 120,
            maxPlayers: 1,
            gameId: "e0a913fe-f95d-597c-a7ec-bc6d30cb9365"
        };
    }

    constructor() {
        super();

        this.phase = 'title';
        this.phaseTicks = 0;
        this.tickCount = 0;
        this.playerId = null;
        this.keys = {};
        this.pendingActions = [];
        this.moveTarget = null;
        this.touchGuardUntil = 0;
        this.hitstop = 0;
        this.rngState = 0xA91E5D3;
        this.wins = 0;
        this.duel = 0;
        this.apex = false;
        this.apexStartTick = 0;
        this.apexSurvivalTicks = 0;
        this.bestApexSurvival = 0;
        this.status = '';
        this.statusUntil = 0;
        this.model = new ActionModel();
        this.modelQueue = [];
        this.nextSampleAt = 0;
        this.lastPlayerActionTick = 0;
        this.playerActionHistory = [];
        this.lastPlayerX = 20;
        this.lastPlayerY = 54;
        this.lastFeatureVector = new Array(FEATURE_NAMES.length).fill(0);
        this.lastFeatureVector[0] = 1;
        this.lastProbabilities = ACTIONS.map(() => 1 / ACTIONS.length);
        this.lastCounter = 'OBSERVING';
        this.lastTraining = 'No example yet';
        this.lastExplanation = [];
        this.uiClock = 0;

        this.player = this.makeActor('player', 19, 54, 0, C.player, C.playerDark);
        this.enemy = this.makeActor('enemy', 58, 54, Math.PI, C.enemy, C.enemyDark);
        this.enemy.plan = null;
        this.enemy.intent = 'DORMANT';
        this.enemy.blockUntil = 0;
        this.enemy.predictedAction = ACTION_INDEX.WAIT;
        this.enemy.predictedConfidence = 1 / ACTIONS.length;
        this.enemy.reactionFrames = 22;

        this.projectiles = [];
        this.particles = [];

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: C.bg
        });
        this.backgroundLayer = this.makeContainer();
        this.entityLayer = this.makeContainer();
        this.catcherLayer = this.makeContainer();
        this.hudLayer = this.makeContainer();
        this.overlayLayer = this.makeContainer();
        this.base.addChildren(
            this.backgroundLayer,
            this.entityLayer,
            this.catcherLayer,
            this.hudLayer,
            this.overlayLayer
        );

        this.buildArena();
        this.buildFighterNodes();
        this.buildProjectilePool();
        this.buildParticlePool();
        this.buildTapCatcher();
        this.buildHud();
        this.buildOverlay();
        this.renderAll(true);
    }

    getLayers() {
        return [{ root: this.base }];
    }

    makeContainer() {
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill: C.transparent
        });
    }

    makeRect(x, y, width, height, fill, color, border, onClick, playerIds) {
        const options = {
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, width, height),
            fill
        };
        if (color && border) {
            options.color = color;
            options.border = border;
        }
        if (onClick) options.onClick = onClick;
        if (playerIds) options.playerIds = playerIds;
        return new GameNode.Shape(options);
    }

    makeText(text, x, y, size, align, color, playerIds) {
        const options = { textInfo: { text, x, y, size, align, color, font: 'monospace' } };
        if (playerIds) options.playerIds = playerIds;
        return new GameNode.Text(options);
    }

    setText(node, text, x, y, size, align, color) {
        node.node.text = { text, x, y, size, align, color, font: 'monospace' };
    }

    makeButton(x, y, width, height, label, fill, textColor, onClick) {
        const root = this.makeRect(x, y, width, height, fill, C.white, 3, onClick);
        const text = this.makeText(label, x + width / 2, y + height / 2 - 0.7, 1.05, 'center', textColor);
        root.addChild(text);
        return { root, text, x, y, width, height };
    }

    makeActor(kind, x, y, angle, color, darkColor) {
        return {
            kind,
            x,
            y,
            previousX: x,
            previousY: y,
            angle,
            health: TUNING.MAX_HEALTH,
            stamina: TUNING.MAX_STAMINA,
            posture: TUNING.MAX_POSTURE,
            action: 'NEUTRAL',
            actionTick: 0,
            attackConnected: false,
            blockHeld: false,
            parryTicks: 0,
            riposteTicks: 0,
            staggerTicks: 0,
            invulnerableTicks: 0,
            dashX: 0,
            dashY: 0,
            alive: true,
            color,
            darkColor,
            flashTicks: 0,
            knockX: 0,
            knockY: 0
        };
    }

    buildArena() {
        this.backgroundLayer.addChild(this.makeRect(1, 8, 73, 91, C.floor, C.line, 4));
        this.backgroundLayer.addChild(this.makeRect(75, 8, 24, 91, C.panel, C.line, 4));

        for (let x = 6; x < 73; x += 7) {
            this.backgroundLayer.addChild(this.makeRect(x, 10, 0.12, 88, C.floorAlt));
        }
        for (let y = 14; y < 98; y += 7) {
            this.backgroundLayer.addChild(this.makeRect(2, y, 71, 0.12, C.floorAlt));
        }

        this.ringTop = this.makeRect(2, 10, 71, 0.6, C.line);
        this.ringBottom = this.makeRect(2, 97.4, 71, 0.6, C.line);
        this.ringLeft = this.makeRect(2, 10, 0.6, 88, C.line);
        this.ringRight = this.makeRect(72.4, 10, 0.6, 88, C.line);
        this.backgroundLayer.addChildren(this.ringTop, this.ringBottom, this.ringLeft, this.ringRight);
    }

    buildFighterNodes() {
        this.playerNodes = this.makeFighterVisuals(C.player, C.playerDark);
        this.enemyNodes = this.makeFighterVisuals(C.enemy, C.enemyDark);
        this.entityLayer.addChildren(
            this.playerNodes.body,
            this.playerNodes.facing,
            this.playerNodes.weapon,
            this.playerNodes.shield,
            this.playerNodes.arc,
            this.playerNodes.healthBack,
            this.playerNodes.healthFill,
            this.playerNodes.postureBack,
            this.playerNodes.postureFill,
            this.playerNodes.stateText,
            this.enemyNodes.body,
            this.enemyNodes.facing,
            this.enemyNodes.weapon,
            this.enemyNodes.shield,
            this.enemyNodes.arc,
            this.enemyNodes.healthBack,
            this.enemyNodes.healthFill,
            this.enemyNodes.postureBack,
            this.enemyNodes.postureFill,
            this.enemyNodes.stateText
        );
    }

    makeFighterVisuals(color, darkColor) {
        return {
            body: new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                fill: darkColor,
                color: C.white,
                border: 3
            }),
            facing: new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                fill: color
            }),
            weapon: new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                fill: C.transparent,
                color: C.white,
                border: 2
            }),
            shield: new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                fill: C.transparent,
                color: C.white,
                border: 3
            }),
            arc: new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                fill: C.transparent,
                color: C.white
            }),
            healthBack: this.makeRect(0, 0, 0, 0, C.transparent),
            healthFill: this.makeRect(0, 0, 0, 0, C.transparent),
            postureBack: this.makeRect(0, 0, 0, 0, C.transparent),
            postureFill: this.makeRect(0, 0, 0, 0, C.transparent),
            stateText: this.makeText('', 0, 0, 0.82, 'center', C.text)
        };
    }

    buildProjectilePool() {
        for (let index = 0; index < TUNING.PROJECTILE_POOL; index += 1) {
            const node = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                fill: C.transparent,
                color: C.transparent
            });
            this.projectiles.push({
                active: false,
                node,
                owner: '',
                x: 0,
                y: 0,
                vx: 0,
                vy: 0,
                life: 0,
                damage: 0,
                posture: 0,
                reflected: false
            });
            this.entityLayer.addChild(node);
        }
    }

    buildParticlePool() {
        for (let index = 0; index < TUNING.PARTICLE_POOL; index += 1) {
            const node = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                fill: C.transparent,
                color: C.transparent
            });
            this.particles.push({
                active: false,
                node,
                x: 0,
                y: 0,
                vx: 0,
                vy: 0,
                life: 0,
                maxLife: 1,
                size: 0.5,
                fill: C.white
            });
            this.entityLayer.addChild(node);
        }
    }

    buildTapCatcher() {
        this.tapCatcher = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(
                TUNING.ARENA_LEFT,
                TUNING.ARENA_TOP,
                TUNING.ARENA_RIGHT - TUNING.ARENA_LEFT,
                TUNING.ARENA_BOTTOM - TUNING.ARENA_TOP
            ),
            fill: C.transparent,
            onClick: (playerId, x, y) => this.handleArenaTap(playerId, x, y)
        });
        this.catcherLayer.addChild(this.tapCatcher);
    }

    buildHud() {

        this.duelText = this.makeText('', 72.5, 3.0, 1.0, 'right', C.muted);
        this.hudLayer.addChildren(this.duelText);

        this.playerLabel = this.makeText('YOU', 4, 9.0, 0.8, 'left', C.player);
        this.enemyLabel = this.makeText('THE MIRROR', 71, 9.0, 0.8, 'right', C.enemy);
        this.hudLayer.addChildren(this.playerLabel, this.enemyLabel);

        // Show the opponent's tell, not its internal training diagnostics.
        this.modelTitle = this.makeText('PREDICTS', 87, 14, 1.15, 'center', C.muted);
        this.predictionText = this.makeText('', 87, 20, 1.8, 'center', C.text);
        this.counterText = this.makeText('', 87, 27, 1.05, 'center', C.gold);
        this.masteryText = this.makeText('ADAPTATION', 77, 38, 0.85, 'left', C.muted);
        this.masteryBack = this.makeRect(77, 42, 20, 1.5, C.floorAlt);
        this.masteryFill = this.makeRect(77, 42, 0, 1.5, C.apex);
        this.safetyTitle = this.makeText('', 87, 52, 1.25, 'center', C.apex);
        this.safetyLine1 = this.makeText('', 87, 59, 0.75, 'center', C.muted);
        this.safetyLine2 = this.makeText('', 87, 63, 0.75, 'center', C.muted);
        this.hudLayer.addChildren(this.modelTitle, this.predictionText, this.counterText,
            this.masteryText, this.masteryBack, this.masteryFill,
            this.safetyTitle, this.safetyLine1, this.safetyLine2);

        this.lightButton = this.makeButton(76.5, 75.0, 10, 6.5, 'J LIGHT', C.orange, C.black, () => this.queuePlayerAction('LIGHT'));
        this.heavyButton = this.makeButton(87.5, 75.0, 10, 6.5, 'K HEAVY', C.enemyDark, C.text, () => this.queuePlayerAction('HEAVY'));
        this.guardButton = this.makeButton(76.5, 82.3, 10, 6.5, 'L GUARD', C.blue, C.text, () => this.touchGuard());
        this.rangedButton = this.makeButton(87.5, 82.3, 10, 6.5, 'I SHOT', C.playerDark, C.text, () => this.queuePlayerAction('RANGED'));
        this.dodgeButton = this.makeButton(76.5, 89.6, 21, 6.5, 'SPACE DODGE', C.panelAlt, C.text, () => this.queuePlayerAction('DODGE'));
        this.hudLayer.addChildren(
            this.lightButton.root,
            this.heavyButton.root,
            this.guardButton.root,
            this.rangedButton.root,
            this.dodgeButton.root
        );
    }

    buildOverlay() {
        this.overlayShade = this.makeRect(5, 22, 65, 54, C.panel, C.line, 4);
        this.overlayHeadline = this.makeText('', 37.5, 28, 2.6, 'center', C.text);
        this.overlayLine1 = this.makeText('', 37.5, 36, 0.95, 'center', C.muted);
        this.overlayLine2 = this.makeText('', 37.5, 40, 0.95, 'center', C.muted);
        this.overlayLine3 = this.makeText('', 37.5, 44, 0.95, 'center', C.muted);
        this.overlayLine4 = this.makeText('', 37.5, 48, 0.95, 'center', C.muted);
        this.overlayControls1 = this.makeText('', 37.5, 55, 0.82, 'center', C.text);
        this.overlayControls2 = this.makeText('', 37.5, 59, 0.82, 'center', C.text);
        this.startButton = this.makeButton(25, 64, 25, 8, 'ENTER THE DUEL', C.apex, C.white, () => this.startOrRestart());
        this.overlayLayer.addChildren(
            this.overlayShade,
            this.overlayHeadline,
            this.overlayLine1,
            this.overlayLine2,
            this.overlayLine3,
            this.overlayLine4,
            this.overlayControls1,
            this.overlayControls2,
            this.startButton.root
        );
    }

    handleNewPlayer({ playerId }) {
        if (this.playerId !== null) return;
        this.playerId = Number(playerId);
        this.privacyAnchor = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            playerIds: [this.playerId]
        });
        this.base.addChild(this.privacyAnchor);
        this.renderAll(true);
    }

    handlePlayerDisconnect(playerId) {
        if (Number(playerId) !== Number(this.playerId)) return;
        if (this.privacyAnchor) this.base.removeChild(this.privacyAnchor.id);
        this.privacyAnchor = null;
        this.playerId = null;
        this.keys = {};
        this.phase = 'title';
        this.phaseTicks = 0;
        this.renderAll(true);
    }

    handleKeyDown(playerId, key) {
        if (Number(playerId) !== Number(this.playerId)) return;
        const normalized = key.length === 1 ? key.toLowerCase() : key;
        const fresh = !this.keys[normalized];
        this.keys[normalized] = true;
        if (!fresh) return;

        if (normalized === 'Enter') {
            this.startOrRestart();
            return;
        }
        if (normalized === 'j') this.queuePlayerAction('LIGHT');
        else if (normalized === 'k') this.queuePlayerAction('HEAVY');
        else if (normalized === 'i') this.queuePlayerAction('RANGED');
        else if (normalized === ' ') this.queuePlayerAction('DODGE');
        else if (normalized === 'l') this.pressPlayerGuard();
    }

    handleKeyUp(playerId, key) {
        if (Number(playerId) !== Number(this.playerId)) return;
        const normalized = key.length === 1 ? key.toLowerCase() : key;
        delete this.keys[normalized];
        if (normalized === 'l') this.player.blockHeld = false;
    }

    handleArenaTap(playerId, x, y) {
        if (Number(playerId) !== Number(this.playerId)) return;
        if (this.phase !== 'duel') return;
        this.moveTarget = {
            x: clamp(x, TUNING.ARENA_LEFT + 2.5, TUNING.ARENA_RIGHT - 2.5),
            y: clamp(y, TUNING.ARENA_TOP + 2.5, TUNING.ARENA_BOTTOM - 2.5)
        };
        this.player.angle = Math.atan2(y - this.player.y, x - this.player.x);
    }

    startOrRestart() {
        if (this.phase !== 'title' && this.phase !== 'gameover') return;
        this.startRun();
    }

    startRun() {
        this.wins = 0;
        this.duel = 0;
        this.apex = false;
        this.apexStartTick = 0;
        this.apexSurvivalTicks = 0;
        this.model.reset();
        this.modelQueue = [];
        this.playerActionHistory = [];
        this.lastPlayerActionTick = this.tickCount;
        this.lastTraining = 'Brain reset: all weights are zero.';
        this.lastCounter = 'NOVICE CHASE';
        this.phase = 'countdown';
        this.phaseTicks = TUNING.COUNTDOWN_TICKS;
        this.prepareDuel();
        this.statusMessage('THE MIRROR REMEMBERS EVERY COMMITMENT');
    }

    prepareDuel() {
        this.duel = this.wins + 1;
        this.apex = this.wins >= TUNING.APEX_WIN_THRESHOLD;
        if (this.apex && this.apexStartTick === 0) this.apexStartTick = this.tickCount;
        this.resetActor(this.player, 18, 54, 0);
        this.resetActor(this.enemy, 58, 54, Math.PI);
        this.enemy.plan = null;
        this.enemy.intent = this.apex ? 'APEX LOCK' : 'READING YOU';
        this.enemy.blockUntil = 0;
        this.pendingActions = [];
        this.moveTarget = null;
        this.modelQueue = [];
        this.nextSampleAt = this.tickCount + TUNING.SAMPLE_EVERY_TICKS;
        this.lastPlayerX = this.player.x;
        this.lastPlayerY = this.player.y;
        this.deactivateProjectiles();
        this.deactivateParticles();
    }

    resetActor(actor, x, y, angle) {
        actor.x = x;
        actor.y = y;
        actor.previousX = x;
        actor.previousY = y;
        actor.angle = angle;
        actor.health = TUNING.MAX_HEALTH;
        actor.stamina = TUNING.MAX_STAMINA;
        actor.posture = TUNING.MAX_POSTURE;
        actor.action = 'NEUTRAL';
        actor.actionTick = 0;
        actor.attackConnected = false;
        actor.blockHeld = false;
        actor.parryTicks = 0;
        actor.riposteTicks = 0;
        actor.staggerTicks = 0;
        actor.invulnerableTicks = 0;
        actor.dashX = 0;
        actor.dashY = 0;
        actor.alive = true;
        actor.flashTicks = 0;
        actor.knockX = 0;
        actor.knockY = 0;
    }

    queuePlayerAction(action) {
        if (this.phase === 'title' || this.phase === 'gameover') {
            this.startOrRestart();
            return;
        }
        if (this.phase !== 'duel') return;
        if (this.pendingActions.length < 2) this.pendingActions.push(action);
    }

    pressPlayerGuard() {
        if (this.phase !== 'duel' || !this.player.alive) return;
        if (this.player.action !== 'NEUTRAL' || this.player.staggerTicks > 0) return;
        if (!this.player.blockHeld) this.registerPlayerAction('BLOCK');
        this.player.blockHeld = true;
        this.player.parryTicks = 6;
        this.statusMessage('PARRY WINDOW: 6 FRAMES');
    }

    touchGuard() {
        if (this.phase !== 'duel') return;
        this.touchGuardUntil = this.tickCount + 42;
        this.pressPlayerGuard();
    }

    tick() {
        this.tickCount += 1;

        if (this.statusUntil > 0 && this.tickCount >= this.statusUntil) {
            this.status = '';
            this.statusUntil = 0;
        }

        if (this.phase === 'title') return;

        if (this.phase === 'countdown') {
            this.phaseTicks -= 1;
            if (this.phaseTicks <= 0) {
                this.phase = 'duel';
                this.statusMessage(this.apex ? 'APEX LOCK ACTIVE' : `DUEL ${this.duel}`);
            }
            this.renderAll(false);
            this.base.node.onStateChange();
            return;
        }

        if (this.phase === 'between') {
            this.phaseTicks -= 1;
            this.updateParticles();
            if (this.phaseTicks <= 0) {
                this.prepareDuel();
                this.phase = 'countdown';
                this.phaseTicks = Math.round(TUNING.COUNTDOWN_TICKS * 0.66);
            }
            this.renderAll(false);
            this.base.node.onStateChange();
            return;
        }

        if (this.phase === 'gameover') {
            this.updateParticles();
            this.renderAll(false);
            if (this.particles.some((particle) => particle.active)) this.base.node.onStateChange();
            return;
        }

        if (this.phase !== 'duel') return;

        if (this.apex) this.apexSurvivalTicks += 1;

        if (this.hitstop > 0) {
            this.hitstop -= 1;
            this.updateParticles();
            this.renderAll(false);
            this.base.node.onStateChange();
            return;
        }

        this.updatePlayer();
        if (this.phase !== 'duel') return;
        this.updateModelSampling();
        this.updateEnemy();
        if (this.phase !== 'duel') return;
        this.resolveActorSeparation();
        this.updateProjectiles();
        if (this.phase !== 'duel') return;
        this.updateParticles();
        this.renderAll(false);
        this.base.node.onStateChange();
    }

    updatePlayer() {
        const player = this.player;
        if (!player.alive) return;

        if (this.tickCount >= this.touchGuardUntil && !this.keys.l) player.blockHeld = false;
        this.updateActorTimers(player);
        this.updatePlayerAim();

        if (player.staggerTicks <= 0) {
            this.consumePlayerAction();
            this.movePlayer();
        }
        this.updateActorAction(player, this.enemy);
        this.regenerateActor(player);
    }

    updatePlayerAim() {
        let aimX = 0;
        let aimY = 0;
        if (this.keys.ArrowLeft) aimX -= 1;
        if (this.keys.ArrowRight) aimX += 1;
        if (this.keys.ArrowUp) aimY -= 1;
        if (this.keys.ArrowDown) aimY += 1;
        if (aimX !== 0 || aimY !== 0) {
            this.player.angle = Math.atan2(aimY, aimX);
        } else if (this.enemy.alive) {
            this.player.angle = Math.atan2(this.enemy.y - this.player.y, this.enemy.x - this.player.x);
        }
    }

    consumePlayerAction() {
        if (this.player.action !== 'NEUTRAL' || this.player.blockHeld || this.pendingActions.length === 0) return;
        const next = this.pendingActions.shift();
        this.beginAction(this.player, next, true);
    }

    movePlayer() {
        const actor = this.player;
        if (actor.action === 'DODGE') return;
        let moveX = 0;
        let moveY = 0;
        if (this.keys.a) moveX -= 1;
        if (this.keys.d) moveX += 1;
        if (this.keys.w) moveY -= 1;
        if (this.keys.s) moveY += 1;

        if (moveX === 0 && moveY === 0 && this.moveTarget) {
            const dx = this.moveTarget.x - actor.x;
            const dy = this.moveTarget.y - actor.y;
            if (Math.sqrt(dx * dx + dy * dy) < 1.2) this.moveTarget = null;
            else {
                moveX = dx;
                moveY = dy;
            }
        } else if (moveX !== 0 || moveY !== 0) {
            this.moveTarget = null;
        }

        if (moveX === 0 && moveY === 0) return;
        const direction = normalize(moveX, moveY);
        let scale = 1;
        const phase = actionPhase(actor);
        if (actor.blockHeld) scale *= TUNING.BLOCK_MOVE_SCALE;
        if (phase === 'startup') scale *= 0.42;
        else if (phase === 'active') scale *= 0.25;
        else if (phase === 'recovery') scale *= 0.34;
        this.moveActor(actor, direction.x * TUNING.PLAYER_SPEED * scale / TUNING.TICK_RATE, direction.y * TUNING.PLAYER_SPEED * scale / TUNING.TICK_RATE);
    }

    updateEnemy() {
        const enemy = this.enemy;
        if (!enemy.alive) return;
        this.updateActorTimers(enemy);

        if (this.tickCount % TUNING.AI_DECISION_TICKS === 0) this.thinkEnemy();
        this.executeEnemyPlan();
        this.moveEnemy();
        this.updateActorAction(enemy, this.player);
        this.regenerateActor(enemy);
    }

    thinkEnemy() {
        const enemy = this.enemy;
        const player = this.player;
        if (enemy.staggerTicks > 0 || enemy.action !== 'NEUTRAL') return;

        const features = this.computeFeatures();
        const probabilities = this.model.predict(features);
        this.lastFeatureVector = features.slice();
        this.lastProbabilities = probabilities.slice();
        const top = this.model.top(probabilities, 1)[0];
        enemy.predictedAction = top.index;
        enemy.predictedConfidence = top.probability;
        const mastery = this.currentMastery();
        enemy.reactionFrames = this.apex ? 0 : Math.max(2, Math.round(23 * (1 - mastery)));

        if (this.apex) {
            enemy.intent = 'APEX: SAFE NEUTRAL';
            this.lastCounter = 'DOMINANCE LOCK';
            if (player.action !== 'NEUTRAL') this.armApexResponse(player.action);
            else if (!enemy.plan) this.planApexOffense(probabilities);
            return;
        }

        if (player.action !== 'NEUTRAL' && actionPhase(player) === 'startup') {
            const actual = ACTION_INDEX[player.action];
            const predictedCorrectly = top.index === actual;
            const actionProbability = probabilities[actual];
            if (predictedCorrectly || actionProbability > lerp(0.62, 0.34, mastery)) {
                this.planCounter(player.action, enemy.reactionFrames, `READ ${player.action} ${Math.round(actionProbability * 100)}%`);
                return;
            }
        }

        if (enemy.plan) return;
        const d = distance(enemy.x, enemy.y, player.x, player.y);
        const obeyModel = this.random() < mastery;
        if (!obeyModel) {
            if (d < 8.2 && enemy.stamina >= ACTION_SPEC.LIGHT.stamina) {
                this.enemy.plan = { type: 'LIGHT', executeAt: this.tickCount + 5, reason: 'NOVICE SWING' };
                enemy.intent = 'NOVICE SWING';
            } else {
                enemy.intent = 'CLOSE DISTANCE';
            }
            return;
        }

        if ((top.action === 'LIGHT' || top.action === 'HEAVY') && top.probability > 0.31 && d < 11) {
            this.enemy.blockHeld = true;
            this.enemy.blockUntil = this.tickCount + 20 + Math.round(mastery * 24);
            this.enemy.parryTicks = Math.round(2 + mastery * 5);
            this.enemy.intent = `PRE-BLOCK ${top.action}`;
            this.lastCounter = `BLOCK ${top.action}`;
        } else if (top.action === 'RANGED' && top.probability > 0.28) {
            this.enemy.intent = 'SIDESTEP SHOT';
            if (enemy.stamina >= ACTION_SPEC.DODGE.stamina && d < 18) {
                this.enemy.plan = { type: 'DODGE', executeAt: this.tickCount + enemy.reactionFrames, reason: 'READ RANGED' };
            }
        } else if (top.action === 'BLOCK' && d < 10 && enemy.stamina >= ACTION_SPEC.HEAVY.stamina) {
            this.enemy.plan = { type: 'HEAVY', executeAt: this.tickCount + 5, reason: 'GUARD BREAK' };
            enemy.intent = 'GUARD BREAK';
            this.lastCounter = 'HEAVY VS BLOCK';
        } else if (top.action === 'DODGE' && d < 10) {
            this.enemy.plan = { type: 'HEAVY', executeAt: this.tickCount + 14, reason: 'DELAYED CATCH' };
            enemy.intent = 'DELAYED CATCH';
            this.lastCounter = 'DELAY VS DODGE';
        } else if (top.action === 'WAIT' && d > 10 && enemy.stamina >= ACTION_SPEC.RANGED.stamina) {
            this.enemy.plan = { type: 'RANGED', executeAt: this.tickCount + 4, reason: 'PUNISH WAIT' };
            enemy.intent = 'PUNISH WAIT';
            this.lastCounter = 'SHOT VS WAIT';
        } else if (d < 8.5 && enemy.stamina >= ACTION_SPEC.LIGHT.stamina) {
            const attack = top.action === 'LIGHT' && mastery > 0.55 ? 'HEAVY' : 'LIGHT';
            this.enemy.plan = { type: attack, executeAt: this.tickCount + 4, reason: 'PRESSURE' };
            enemy.intent = attack;
        } else {
            enemy.intent = top.action === 'WAIT' ? 'TAKING SPACE' : `TRACKING ${top.action}`;
        }
    }

    planCounter(playerAction, delay, reason) {
        let response = 'BLOCK';
        if (playerAction === 'RANGED') response = 'DODGE';
        else if (playerAction === 'BLOCK') response = 'HEAVY';
        else if (playerAction === 'DODGE') response = 'HEAVY';
        this.enemy.plan = { type: response, executeAt: this.tickCount + delay, reason };
        this.enemy.intent = `${reason} → ${response}`;
        this.lastCounter = `${response} IN ${delay}f`;
    }

    armApexResponse(playerAction) {
        if (playerAction === 'LIGHT' || playerAction === 'HEAVY') {
            this.enemy.blockHeld = true;
            this.enemy.blockUntil = this.tickCount + 60;
            this.enemy.parryTicks = 60;
            this.enemy.intent = `PERFECT PARRY ${playerAction}`;
            this.lastCounter = `LOCKED: PARRY ${playerAction}`;
        } else if (playerAction === 'RANGED') {
            if (this.enemy.action === 'NEUTRAL') this.beginAction(this.enemy, 'DODGE', false);
            this.enemy.intent = 'PERFECT REFLECT';
            this.lastCounter = 'LOCKED: REFLECT SHOT';
        } else if (playerAction === 'BLOCK') {
            this.enemy.plan = { type: 'HEAVY', executeAt: this.tickCount + 1, reason: 'PERFECT GUARD BREAK' };
            this.enemy.intent = 'PERFECT GUARD BREAK';
            this.lastCounter = 'LOCKED: HEAVY';
        } else if (playerAction === 'DODGE') {
            this.enemy.plan = { type: 'HEAVY', executeAt: this.tickCount + 8, reason: 'CATCH ENDPOINT' };
            this.enemy.intent = 'CATCH ENDPOINT';
            this.lastCounter = 'LOCKED: DELAYED HEAVY';
        }
    }

    planApexOffense(probabilities) {
        const d = distance(this.enemy.x, this.enemy.y, this.player.x, this.player.y);
        if (this.player.action !== 'NEUTRAL') return;
        if (this.player.blockHeld && d < 10) {
            this.enemy.plan = { type: 'HEAVY', executeAt: this.tickCount + 1, reason: 'BREAK STATIC GUARD' };
        } else if (d > 12 && this.enemy.stamina >= ACTION_SPEC.RANGED.stamina) {
            this.enemy.plan = { type: 'RANGED', executeAt: this.tickCount + 1, reason: 'FORCE COMMITMENT' };
        } else if (d < 8.5 && this.player.stamina < 35) {
            this.enemy.plan = { type: 'HEAVY', executeAt: this.tickCount + 1, reason: 'STAMINA CHECKMATE' };
        } else if (d < 8.5 && probabilities[ACTION_INDEX.BLOCK] < 0.3) {
            this.enemy.plan = { type: 'LIGHT', executeAt: this.tickCount + 1, reason: 'SAFE POKE' };
        }
    }

    executeEnemyPlan() {
        const enemy = this.enemy;
        if (enemy.blockUntil > 0 && this.tickCount >= enemy.blockUntil) {
            enemy.blockHeld = false;
            enemy.blockUntil = 0;
        }
        if (!enemy.plan || this.tickCount < enemy.plan.executeAt) return;
        if (enemy.action !== 'NEUTRAL' || enemy.staggerTicks > 0) return;
        const plan = enemy.plan;
        enemy.plan = null;
        if (plan.type === 'BLOCK') {
            enemy.blockHeld = true;
            enemy.blockUntil = this.tickCount + 36;
            enemy.parryTicks = Math.max(enemy.parryTicks, this.apex ? 60 : 5);
            enemy.intent = plan.reason;
        } else {
            this.beginAction(enemy, plan.type, false);
            enemy.intent = plan.reason;
        }
    }

    moveEnemy() {
        const enemy = this.enemy;
        const player = this.player;
        if (enemy.staggerTicks > 0 || enemy.action === 'DODGE') return;
        enemy.angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        const d = distance(enemy.x, enemy.y, player.x, player.y);
        const mastery = this.currentMastery();
        const predicted = ACTIONS[enemy.predictedAction];
        let radial = 0;
        let tangent = 0;

        if (d > 10.5) radial = 1;
        else if (d < 6.3) radial = -0.8;
        if ((predicted === 'LIGHT' || predicted === 'HEAVY') && mastery > 0.35) tangent = this.random() < 0.5 ? -0.72 : 0.72;
        if (this.apex && this.player.action === 'NEUTRAL' && d > 8) radial = 1;

        const toward = normalize(player.x - enemy.x, player.y - enemy.y);
        let moveX = toward.x * radial - toward.y * tangent;
        let moveY = toward.y * radial + toward.x * tangent;
        if (moveX === 0 && moveY === 0) return;
        const direction = normalize(moveX, moveY);
        let scale = 1;
        const phase = actionPhase(enemy);
        if (enemy.blockHeld) scale *= TUNING.BLOCK_MOVE_SCALE;
        if (phase === 'startup') scale *= 0.38;
        else if (phase === 'active') scale *= 0.22;
        else if (phase === 'recovery') scale *= 0.32;
        this.moveActor(enemy, direction.x * TUNING.ENEMY_SPEED * scale / TUNING.TICK_RATE, direction.y * TUNING.ENEMY_SPEED * scale / TUNING.TICK_RATE);
    }

    updateActorTimers(actor) {
        actor.previousX = actor.x;
        actor.previousY = actor.y;
        if (actor.parryTicks > 0) actor.parryTicks -= 1;
        if (actor.riposteTicks > 0) actor.riposteTicks -= 1;
        if (actor.staggerTicks > 0) actor.staggerTicks -= 1;
        if (actor.invulnerableTicks > 0) actor.invulnerableTicks -= 1;
        if (actor.flashTicks > 0) actor.flashTicks -= 1;
        actor.knockX *= 0.84;
        actor.knockY *= 0.84;
        if (Math.abs(actor.knockX) > 0.01 || Math.abs(actor.knockY) > 0.01) this.moveActor(actor, actor.knockX, actor.knockY);
    }

    beginAction(actor, action, fromPlayer) {
        if (!actor.alive || actor.staggerTicks > 0 || actor.action !== 'NEUTRAL') return false;
        const spec = ACTION_SPEC[action];
        if (!spec || actor.stamina < spec.stamina) {
            if (fromPlayer) this.statusMessage('NOT ENOUGH STAMINA');
            return false;
        }
        actor.blockHeld = false;
        actor.stamina -= spec.stamina;
        actor.action = action;
        actor.actionTick = 0;
        actor.attackConnected = false;
        if (action === 'DODGE') {
            let dx = 0;
            let dy = 0;
            if (fromPlayer) {
                if (this.keys.a) dx -= 1;
                if (this.keys.d) dx += 1;
                if (this.keys.w) dy -= 1;
                if (this.keys.s) dy += 1;
                if (dx === 0 && dy === 0) {
                    dx = -Math.cos(actor.angle);
                    dy = -Math.sin(actor.angle);
                }
            } else {
                const toward = normalize(this.player.x - actor.x, this.player.y - actor.y);
                dx = -toward.y;
                dy = toward.x;
                if (this.random() < 0.5) {
                    dx *= -1;
                    dy *= -1;
                }
            }
            const direction = normalize(dx, dy);
            actor.dashX = direction.x;
            actor.dashY = direction.y;
            actor.invulnerableTicks = spec.invulnerable;
        }
        if (fromPlayer) this.registerPlayerAction(action);
        return true;
    }

    updateActorAction(actor, target) {
        if (actor.staggerTicks > 0) return;
        if (actor.action === 'NEUTRAL') return;
        const spec = ACTION_SPEC[actor.action];
        const phase = actionPhase(actor);

        if (actor.action === 'DODGE' && phase === 'active') {
            this.moveActor(
                actor,
                actor.dashX * spec.speed / TUNING.TICK_RATE,
                actor.dashY * spec.speed / TUNING.TICK_RATE
            );
        }

        if ((actor.action === 'LIGHT' || actor.action === 'HEAVY') && phase === 'active') {
            const lunge = spec.lunge / TUNING.TICK_RATE;
            this.moveActor(actor, Math.cos(actor.angle) * lunge, Math.sin(actor.angle) * lunge);
            if (!actor.attackConnected) this.resolveMelee(actor, target, spec);
        }

        if (actor.action === 'RANGED' && actor.actionTick === spec.startup && !actor.attackConnected) {
            actor.attackConnected = true;
            this.spawnProjectile(actor);
        }

        actor.actionTick += 1;
        if (actor.actionTick >= spec.startup + spec.active + spec.recovery) {
            actor.action = 'NEUTRAL';
            actor.actionTick = 0;
            actor.attackConnected = false;
        }
    }

    resolveMelee(attacker, target, spec) {
        if (!target.alive || target.invulnerableTicks > 0) return;
        const d = distance(attacker.x, attacker.y, target.x, target.y);
        if (d > spec.range + TUNING.BODY_RADIUS) return;
        const towardTarget = Math.atan2(target.y - attacker.y, target.x - attacker.x);
        if (Math.abs(angleDifference(towardTarget, attacker.angle)) > spec.arc / 2) return;
        attacker.attackConnected = true;

        if (target.kind === 'enemy' && this.apex) {
            this.forceApexParry(attacker, target, attacker.action);
            return;
        }

        if (this.isBlockingAgainst(target, attacker.x, attacker.y)) {
            if (target.parryTicks > 0) {
                this.applyParry(target, attacker);
                return;
            }
            this.applyBlockedHit(target, attacker, spec);
            return;
        }

        let damage = spec.damage;
        if (attacker.riposteTicks > 0) {
            damage = Math.round(damage * 1.55);
            attacker.riposteTicks = 0;
            this.statusMessage(attacker.kind === 'player' ? 'RIPOSTE' : 'ENEMY RIPOSTE');
        }
        this.applyDamage(target, damage, spec.posture * 0.28, attacker);
    }

    isBlockingAgainst(target, sourceX, sourceY) {
        if (!target.blockHeld || target.action !== 'NEUTRAL' || target.staggerTicks > 0) return false;
        const towardSource = Math.atan2(sourceY - target.y, sourceX - target.x);
        return Math.abs(angleDifference(towardSource, target.angle)) <= 1.1;
    }

    applyParry(defender, attacker) {
        attacker.staggerTicks = 30;
        attacker.action = 'NEUTRAL';
        attacker.actionTick = 0;
        defender.riposteTicks = 54;
        defender.posture = clamp(defender.posture + 24, 0, TUNING.MAX_POSTURE);
        defender.stamina = clamp(defender.stamina + 14, 0, TUNING.MAX_STAMINA);
        this.hitstop = TUNING.HITSTOP_TICKS + 2;
        this.emitBurst(defender.x, defender.y, C.gold, 8);
        this.statusMessage(defender.kind === 'player' ? 'PARRY • RIPOSTE READY' : 'THE MIRROR PARRIED');
        if (defender.kind === 'enemy') this.lastCounter = this.apex ? 'DOMINANCE PARRY' : 'LEARNED PARRY';
    }

    forceApexParry(attacker, defender, action) {
        defender.blockHeld = true;
        defender.parryTicks = 60;
        defender.intent = `DOMINANCE PARRY ${action}`;
        this.lastCounter = `SAFETY OVERRIDE: ${action}`;
        this.applyParry(defender, attacker);
    }

    applyBlockedHit(defender, attacker, spec) {
        defender.posture -= spec.posture;
        this.hitstop = TUNING.HITSTOP_TICKS;
        this.emitBurst(defender.x, defender.y, C.blue, 5);
        if (defender.posture <= 0) {
            defender.posture = 0;
            defender.blockHeld = false;
            defender.staggerTicks = 48;
            defender.health -= Math.round(spec.damage * 0.35);
            this.statusMessage(defender.kind === 'player' ? 'YOUR GUARD BROKE' : 'GUARD BREAK');
            this.checkDeath(defender, attacker);
        } else {
            const direction = normalize(defender.x - attacker.x, defender.y - attacker.y);
            defender.knockX += direction.x * 0.3;
            defender.knockY += direction.y * 0.3;
        }
    }

    applyDamage(target, damage, postureDamage, attacker) {
        target.health -= damage;
        target.posture = Math.max(0, target.posture - postureDamage);
        target.flashTicks = 7;
        const direction = normalize(target.x - attacker.x, target.y - attacker.y);
        target.knockX += direction.x * 0.42;
        target.knockY += direction.y * 0.42;
        this.hitstop = TUNING.HITSTOP_TICKS;
        this.emitBurst(target.x, target.y, target.kind === 'player' ? C.player : C.enemy, 7);
        this.statusMessage(`${target.kind === 'player' ? 'YOU TAKE' : 'HIT'} ${damage}`);
        this.checkDeath(target, attacker);
    }

    checkDeath(target) {
        if (target.health > 0) return;
        target.health = 0;
        target.alive = false;
        target.action = 'NEUTRAL';
        target.blockHeld = false;
        this.emitBurst(target.x, target.y, target.kind === 'player' ? C.player : (this.apex ? C.apex : C.enemy), 18);

        if (target.kind === 'enemy') {
            this.wins += 1;
            this.phase = 'between';
            this.phaseTicks = TUNING.BETWEEN_DUELS_TICKS;
            this.lastTraining = `Generation ${this.wins} defeated; weights persist.`;
            this.statusMessage(this.wins >= TUNING.APEX_WIN_THRESHOLD ? 'YOU CREATED THE APEX' : `WIN ${this.wins} • IT LEARNED`);
        } else {
            this.phase = 'gameover';
            if (this.apex) this.bestApexSurvival = Math.max(this.bestApexSurvival, this.apexSurvivalTicks);
            this.statusMessage(this.apex ? 'THE MODEL CONVERGED' : 'RUN ENDED');
        }
    }

    regenerateActor(actor) {
        if (!actor.alive || actor.staggerTicks > 0) return;
        if (actor.action === 'NEUTRAL' && !actor.blockHeld) {
            actor.stamina = clamp(actor.stamina + TUNING.STAMINA_REGEN / TUNING.TICK_RATE, 0, TUNING.MAX_STAMINA);
        }
        if (!actor.blockHeld && actor.action === 'NEUTRAL') {
            actor.posture = clamp(actor.posture + TUNING.POSTURE_REGEN / TUNING.TICK_RATE, 0, TUNING.MAX_POSTURE);
        }
    }

    moveActor(actor, dx, dy) {
        actor.x = clamp(actor.x + dx, TUNING.ARENA_LEFT + TUNING.BODY_RADIUS, TUNING.ARENA_RIGHT - TUNING.BODY_RADIUS);
        actor.y = clamp(actor.y + dy, TUNING.ARENA_TOP + TUNING.BODY_RADIUS, TUNING.ARENA_BOTTOM - TUNING.BODY_RADIUS);
    }

    resolveActorSeparation() {
        if (!this.player.alive || !this.enemy.alive) return;
        const dx = this.enemy.x - this.player.x;
        const dy = this.enemy.y - this.player.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const minimum = TUNING.BODY_RADIUS * 2;
        if (d >= minimum) return;
        const push = (minimum - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        this.moveActor(this.player, -nx * push, -ny * push);
        this.moveActor(this.enemy, nx * push, ny * push);
    }

    spawnProjectile(actor) {
        const projectile = this.projectiles.find((candidate) => !candidate.active);
        if (!projectile) return;
        const spec = ACTION_SPEC.RANGED;
        projectile.active = true;
        projectile.owner = actor.kind;
        projectile.x = actor.x + Math.cos(actor.angle) * 3;
        projectile.y = actor.y + Math.sin(actor.angle) * 3;
        projectile.vx = Math.cos(actor.angle) * spec.speed / TUNING.TICK_RATE;
        projectile.vy = Math.sin(actor.angle) * spec.speed / TUNING.TICK_RATE;
        projectile.life = spec.life;
        projectile.damage = spec.damage;
        projectile.posture = spec.posture;
        projectile.reflected = false;
        this.emitBurst(projectile.x, projectile.y, actor.kind === 'player' ? C.player : C.enemy, 3);
    }

    updateProjectiles() {
        for (const projectile of this.projectiles) {
            if (!projectile.active) continue;
            projectile.x += projectile.vx;
            projectile.y += projectile.vy;
            projectile.life -= 1;
            if (
                projectile.life <= 0 ||
                projectile.x < TUNING.ARENA_LEFT || projectile.x > TUNING.ARENA_RIGHT ||
                projectile.y < TUNING.ARENA_TOP || projectile.y > TUNING.ARENA_BOTTOM
            ) {
                this.hideProjectile(projectile);
                continue;
            }

            const target = projectile.owner === 'player' ? this.enemy : this.player;
            if (!target.alive || target.invulnerableTicks > 0) continue;
            if (distance(projectile.x, projectile.y, target.x, target.y) > TUNING.BODY_RADIUS + 0.75) continue;

            if (target.kind === 'enemy' && this.apex && projectile.owner === 'player') {
                this.reflectProjectile(projectile, target, true);
                continue;
            }

            const source = projectile.owner === 'player' ? this.player : this.enemy;
            if (this.isBlockingAgainst(target, source.x, source.y)) {
                if (target.parryTicks > 0) this.reflectProjectile(projectile, target, false);
                else {
                    target.posture -= projectile.posture;
                    this.emitBurst(projectile.x, projectile.y, C.blue, 5);
                    this.hideProjectile(projectile);
                    if (target.posture <= 0) {
                        target.posture = 0;
                        target.blockHeld = false;
                        target.staggerTicks = 42;
                        this.statusMessage(target.kind === 'player' ? 'SHOT BROKE YOUR GUARD' : 'SHOT GUARD BREAK');
                    }
                }
                continue;
            }

            this.hideProjectile(projectile);
            this.applyDamage(target, projectile.damage, projectile.posture * 0.25, source);
            if (this.phase !== 'duel') return;
        }
    }

    reflectProjectile(projectile, defender, apexReflect) {
        projectile.owner = defender.kind;
        const direction = normalize(-projectile.vx, -projectile.vy);
        const speed = ACTION_SPEC.RANGED.speed / TUNING.TICK_RATE * (apexReflect ? 1.25 : 1.08);
        projectile.vx = direction.x * speed;
        projectile.vy = direction.y * speed;
        projectile.damage += apexReflect ? 5 : 2;
        projectile.reflected = true;
        projectile.life = Math.max(projectile.life, 100);
        this.emitBurst(projectile.x, projectile.y, apexReflect ? C.apex : C.gold, 7);
        this.statusMessage(apexReflect ? 'APEX REFLECT' : 'PROJECTILE PARRY');
        if (defender.kind === 'enemy') this.lastCounter = apexReflect ? 'SAFETY OVERRIDE: REFLECT' : 'LEARNED REFLECT';
    }

    hideProjectile(projectile) {
        projectile.active = false;
        projectile.node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
        projectile.node.node.fill = C.transparent;
        projectile.node.node.color = C.transparent;
    }

    deactivateProjectiles() {
        for (const projectile of this.projectiles) this.hideProjectile(projectile);
    }

    emitBurst(x, y, fill, count) {
        for (const particle of this.particles) {
            if (count <= 0) break;
            if (particle.active) continue;
            count -= 1;
            const angle = this.random() * Math.PI * 2;
            const speed = 0.08 + this.random() * 0.28;
            particle.active = true;
            particle.x = x;
            particle.y = y;
            particle.vx = Math.cos(angle) * speed;
            particle.vy = Math.sin(angle) * speed;
            particle.life = 18 + Math.floor(this.random() * 22);
            particle.maxLife = particle.life;
            particle.size = 0.25 + this.random() * 0.55;
            particle.fill = fill;
        }
    }

    updateParticles() {
        for (const particle of this.particles) {
            if (!particle.active) continue;
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vx *= 0.94;
            particle.vy *= 0.94;
            particle.life -= 1;
            if (particle.life <= 0) {
                particle.active = false;
                particle.node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                particle.node.node.fill = C.transparent;
                particle.node.node.color = C.transparent;
            }
        }
    }

    deactivateParticles() {
        for (const particle of this.particles) {
            particle.active = false;
            particle.node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
            particle.node.node.fill = C.transparent;
            particle.node.node.color = C.transparent;
        }
    }

    registerPlayerAction(action) {
        const label = ACTION_INDEX[action];
        this.lastPlayerActionTick = this.tickCount;
        this.playerActionHistory.push({ action, tick: this.tickCount });
        if (this.playerActionHistory.length > 12) this.playerActionHistory.shift();
        for (const sample of this.modelQueue) {
            if (sample.label === null && this.tickCount <= sample.resolveAt) sample.label = label;
        }
    }

    updateModelSampling() {
        if (this.tickCount >= this.nextSampleAt) {
            this.nextSampleAt += TUNING.SAMPLE_EVERY_TICKS;
            this.modelQueue.push({
                features: this.computeFeatures(),
                label: null,
                resolveAt: this.tickCount + TUNING.SAMPLE_HORIZON_TICKS
            });
        }

        while (this.modelQueue.length > 0 && this.tickCount >= this.modelQueue[0].resolveAt) {
            const sample = this.modelQueue.shift();
            const label = sample.label === null ? ACTION_INDEX.WAIT : sample.label;
            const result = this.model.train(sample.features, label);
            if (result) {
                const predicted = ACTIONS[result.predicted];
                const actual = ACTIONS[result.label];
                this.lastTraining = `${predicted} → ${actual}  LOSS ${result.loss.toFixed(2)}`;
            }
        }
    }

    computeFeatures() {
        const player = this.player;
        const enemy = this.enemy;
        const d = distance(player.x, player.y, enemy.x, enemy.y);
        const centerX = (TUNING.ARENA_LEFT + TUNING.ARENA_RIGHT) / 2;
        const centerY = (TUNING.ARENA_TOP + TUNING.ARENA_BOTTOM) / 2;
        const wallDistance = Math.min(
            player.x - TUNING.ARENA_LEFT,
            TUNING.ARENA_RIGHT - player.x,
            player.y - TUNING.ARENA_TOP,
            TUNING.ARENA_BOTTOM - player.y
        );
        const idle = clamp((this.tickCount - this.lastPlayerActionTick) / seconds(1.6), 0, 1);
        const last = this.playerActionHistory.length > 0 ? this.playerActionHistory[this.playerActionHistory.length - 1].action : 'WAIT';
        let repeating = 0;
        if (this.playerActionHistory.length >= 3) {
            const a = this.playerActionHistory[this.playerActionHistory.length - 1].action;
            const b = this.playerActionHistory[this.playerActionHistory.length - 2].action;
            const c = this.playerActionHistory[this.playerActionHistory.length - 3].action;
            repeating = a === b && b === c ? 1 : a === b ? 0.65 : 0;
        }
        const velocityX = (player.x - this.lastPlayerX) * TUNING.TICK_RATE / TUNING.AI_DECISION_TICKS;
        const velocityY = (player.y - this.lastPlayerY) * TUNING.TICK_RATE / TUNING.AI_DECISION_TICKS;
        this.lastPlayerX = player.x;
        this.lastPlayerY = player.y;
        const toward = normalize(enemy.x - player.x, enemy.y - player.y);
        const radialVelocity = velocityX * toward.x + velocityY * toward.y;
        const tangentVelocity = -velocityX * toward.y + velocityY * toward.x;
        const enemyRecovering = actionPhase(enemy) === 'recovery' ? 1 : 0;
        const nearWall = clamp(1 - wallDistance / 10, 0, 1);
        const centerDistance = distance(player.x, player.y, centerX, centerY);

        return [
            1,
            clamp(1 - d / 12, 0, 1),
            clamp(1 - Math.abs(d - 15) / 9, 0, 1),
            clamp(1 - player.stamina / TUNING.MAX_STAMINA, 0, 1),
            clamp(1 - player.posture / TUNING.MAX_POSTURE, 0, 1),
            enemyRecovering,
            clamp(nearWall + centerDistance / 100, 0, 1),
            idle,
            last === 'LIGHT' ? 1 : 0,
            last === 'HEAVY' ? 1 : 0,
            last === 'RANGED' ? 1 : 0,
            last === 'BLOCK' ? 1 : 0,
            last === 'DODGE' ? 1 : 0,
            repeating,
            clamp((radialVelocity + 20) / 40, 0, 1),
            clamp(Math.abs(tangentVelocity) / 20, 0, 1)
        ];
    }

    currentMastery() {
        if (this.apex) return 1;
        return this.model.mastery(this.wins);
    }

    random() {
        this.rngState = (this.rngState * 1664525 + 1013904223) >>> 0;
        return this.rngState / 4294967296;
    }

    statusMessage(text) {
        this.status = text;
        this.statusUntil = this.tickCount + TUNING.STATUS_TICKS;
    }

    renderAll(forceUi) {
        this.renderFighter(this.player, this.playerNodes, true);
        this.renderFighter(this.enemy, this.enemyNodes, false);
        this.renderProjectiles();
        this.renderParticles();
        this.renderOverlay();
        this.uiClock += 1;
        if (forceUi || this.uiClock >= 10) {
            this.uiClock = 0;
            this.renderHud();
        }
    }

    renderFighter(actor, nodes, isPlayer) {
        if (!actor.alive) {
            const hidden = ShapeUtils.rectangle(0, 0, 0, 0);
            nodes.body.node.coordinates2d = hidden;
            nodes.facing.node.coordinates2d = hidden;
            nodes.weapon.node.coordinates2d = hidden;
            nodes.shield.node.coordinates2d = hidden;
            nodes.arc.node.coordinates2d = hidden;
            nodes.healthBack.node.coordinates2d = hidden;
            nodes.healthFill.node.coordinates2d = hidden;
            nodes.postureBack.node.coordinates2d = hidden;
            nodes.postureFill.node.coordinates2d = hidden;
            this.setText(nodes.stateText, '', 0, 0, 0.1, 'center', C.text);
            return;
        }

        const bodyColor = actor.flashTicks > 0 ? C.white : (isPlayer ? actor.darkColor : (this.apex ? C.apex : actor.darkColor));
        const coreColor = isPlayer ? actor.color : (this.apex ? C.apex : actor.color);
        nodes.body.node.coordinates2d = polyCircle(actor.x, actor.y, TUNING.BODY_RADIUS, 14);
        nodes.body.node.fill = bodyColor;
        nodes.facing.node.coordinates2d = facingTriangle(actor.x, actor.y, actor.angle, TUNING.BODY_RADIUS + 1.45);
        nodes.facing.node.fill = coreColor;

        const phase = actionPhase(actor);
        if (actor.action === 'LIGHT' || actor.action === 'HEAVY') {
            const spec = ACTION_SPEC[actor.action];
            const totalSwing = spec.startup + spec.active;
            const swingProgress = clamp(actor.actionTick / Math.max(1, totalSwing), 0, 1);
            const startOffset = actor.action === 'LIGHT' ? -1.05 : -0.62;
            const endOffset = actor.action === 'LIGHT' ? 1.15 : 0.72;
            const weaponAngle = actor.angle + lerp(startOffset, endOffset, swingProgress);
            const length = actor.action === 'LIGHT' ? 6.7 : 8.2;
            nodes.weapon.node.coordinates2d = thickLine(
                actor.x + Math.cos(weaponAngle) * 1.1,
                actor.y + Math.sin(weaponAngle) * 1.1,
                actor.x + Math.cos(weaponAngle) * length,
                actor.y + Math.sin(weaponAngle) * length,
                actor.action === 'LIGHT' ? 0.72 : 0.94
            );
            nodes.weapon.node.fill = phase === 'startup' ? C.gold : C.orange;
            if (phase === 'startup') {
                nodes.arc.node.coordinates2d = arcSector(actor.x, actor.y, actor.angle, spec.range, spec.arc / 2);
                nodes.arc.node.fill = coreColor;
                nodes.arc.node.color = [255, 255, 255, 65];
            } else {
                nodes.arc.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                nodes.arc.node.fill = C.transparent;
            }
        } else if (actor.action === 'RANGED') {
            const charge = clamp(actor.actionTick / ACTION_SPEC.RANGED.startup, 0, 1);
            nodes.weapon.node.coordinates2d = polyCircle(
                actor.x + Math.cos(actor.angle) * 3.2,
                actor.y + Math.sin(actor.angle) * 3.2,
                0.4 + charge * 0.9,
                10
            );
            nodes.weapon.node.fill = coreColor;
            nodes.arc.node.coordinates2d = thickLine(
                actor.x,
                actor.y,
                actor.x + Math.cos(actor.angle) * 13,
                actor.y + Math.sin(actor.angle) * 13,
                0.16
            );
            nodes.arc.node.fill = coreColor;
        } else {
            nodes.weapon.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
            nodes.weapon.node.fill = C.transparent;
            nodes.arc.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
            nodes.arc.node.fill = C.transparent;
        }

        if (actor.blockHeld && actor.action === 'NEUTRAL') {
            const centerX = actor.x + Math.cos(actor.angle) * 3.1;
            const centerY = actor.y + Math.sin(actor.angle) * 3.1;
            const tangentX = -Math.sin(actor.angle) * 2.3;
            const tangentY = Math.cos(actor.angle) * 2.3;
            nodes.shield.node.coordinates2d = thickLine(
                centerX - tangentX,
                centerY - tangentY,
                centerX + tangentX,
                centerY + tangentY,
                1.05
            );
            nodes.shield.node.fill = actor.parryTicks > 0 ? C.gold : C.blue;
        } else {
            nodes.shield.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
            nodes.shield.node.fill = C.transparent;
        }

        nodes.healthBack.node.coordinates2d = safeRectangle(actor.x - 4.2, actor.y - 5.6, 8.4, 0.75);
        nodes.healthBack.node.fill = C.floorAlt;
        nodes.healthFill.node.coordinates2d = safeRectangle(actor.x - 4.2, actor.y - 5.6, 8.4 * actor.health / TUNING.MAX_HEALTH, 0.75);
        nodes.healthFill.node.fill = actor.health < 30 ? C.enemy : C.green;
        nodes.postureBack.node.coordinates2d = safeRectangle(actor.x - 4.2, actor.y - 4.55, 8.4, 0.48);
        nodes.postureBack.node.fill = C.floorAlt;
        nodes.postureFill.node.coordinates2d = safeRectangle(actor.x - 4.2, actor.y - 4.55, 8.4 * actor.posture / TUNING.MAX_POSTURE, 0.48);
        nodes.postureFill.node.fill = C.gold;

        const state = actor.staggerTicks > 0 ? 'STUNNED'
            : actor.blockHeld ? (actor.parryTicks > 0 ? 'PARRY' : 'BLOCK') : '';
        this.setText(nodes.stateText, state, actor.x, actor.y + 5.2, 1.15, 'center', isPlayer ? C.player : C.enemy);
    }

    renderProjectiles() {
        for (const projectile of this.projectiles) {
            if (!projectile.active) continue;
            projectile.node.node.coordinates2d = polyCircle(projectile.x, projectile.y, projectile.reflected ? 0.85 : 0.62, 9);
            projectile.node.node.fill = projectile.owner === 'player' ? C.player : (this.apex ? C.apex : C.enemy);
            projectile.node.node.color = C.white;
        }
    }

    renderParticles() {
        for (const particle of this.particles) {
            if (!particle.active) continue;
            const alpha = clamp(Math.round(255 * particle.life / particle.maxLife), 0, 255);
            particle.node.node.coordinates2d = safeRectangle(
                particle.x - particle.size / 2,
                particle.y - particle.size / 2,
                particle.size,
                particle.size
            );
            particle.node.node.fill = [particle.fill[0], particle.fill[1], particle.fill[2], 255];
            particle.node.node.color = [255, 255, 255, alpha];
        }
    }

    renderHud() {
        const mastery = this.currentMastery();
        const predicted = this.model.top(this.lastProbabilities, 1)[0] || { action: 'WAIT' };
        const names = { LIGHT: 'LIGHT HIT', HEAVY: 'HEAVY HIT', RANGED: 'A SHOT', GUARD: 'A BLOCK', DODGE: 'A DODGE', WAIT: 'A PAUSE' };
        this.setText(this.duelText, `WINS ${this.wins}  /  DUEL ${this.duel || 1}`, 72.5, 3, 0.95, 'right', C.muted);
        this.setText(this.predictionText, names[predicted.action] || predicted.action, 87, 20, 1.65, 'center', C.text);
        this.setText(this.counterText, 'BREAK YOUR PATTERN', 87, 27, 1.05, 'center', C.gold);
        this.setText(this.masteryText, `ADAPTATION ${Math.round(mastery * 100)}%`, 77, 38, 1.15, 'left', C.muted);
        this.masteryFill.node.coordinates2d = ShapeUtils.rectangle(77, 42, 20 * mastery, 1.5);
        this.masteryFill.node.fill = this.apex ? C.apex : C.player;
        this.setText(this.safetyTitle, this.apex ? 'FINAL FORM' : `${TUNING.APEX_WIN_THRESHOLD - this.wins} WINS TO FINAL FORM`, 87, 52, 1.05, 'center', this.apex ? C.apex : C.text);
        this.setText(this.safetyLine1, '', 87, 59, 1.05, 'center', C.muted);
        this.setText(this.safetyLine2, '', 87, 63, 1.05, 'center', C.muted);
    }

    renderOverlay() {
        const visible = this.phase === 'title' || this.phase === 'countdown' || this.phase === 'between' || this.phase === 'gameover';
        this.overlayShade.node.playerIds = visible ? [] : [0];
        this.overlayHeadline.node.playerIds = visible ? [] : [0];
        this.overlayLine1.node.playerIds = visible ? [] : [0];
        this.overlayLine2.node.playerIds = visible ? [] : [0];
        this.overlayLine3.node.playerIds = visible ? [] : [0];
        this.overlayLine4.node.playerIds = visible ? [] : [0];
        this.overlayControls1.node.playerIds = visible ? [] : [0];
        this.overlayControls2.node.playerIds = visible ? [] : [0];
        this.startButton.root.node.playerIds = (this.phase === 'title' || this.phase === 'gameover') ? [] : [0];
        this.startButton.text.node.playerIds = (this.phase === 'title' || this.phase === 'gameover') ? [] : [0];

        if (!visible) return;

        if (this.phase === 'title') {
            this.setText(this.overlayHeadline, 'MEET YOUR MATCH', 37.5, 30, 2.2, 'center', C.text);
            this.setText(this.overlayLine1, 'Your rival learns your moves.', 37.5, 42, 1.5, 'center', C.muted);
            this.setText(this.overlayLine2, '', 37.5, 40, 1.3, 'center', C.muted);
            this.setText(this.overlayLine3, '', 37.5, 44, 1.25, 'center', C.apex);
            this.setText(this.overlayLine4, '', 37.5, 48, 1.3, 'center', C.muted);
            this.setText(this.overlayControls1, 'WASD / tap: move   Arrows: aim', 37.5, 55, 1.15, 'center', C.text);
            this.setText(this.overlayControls2, '', 37.5, 59, 1.15, 'center', C.text);
            this.setText(this.startButton.text, 'ENTER THE DUEL', 37.5, 67.1, 1.05, 'center', C.white);
        } else if (this.phase === 'countdown') {
            const count = Math.max(1, Math.ceil(this.phaseTicks / 30));
            this.setText(this.overlayHeadline, this.apex ? 'APEX' : `GENERATION ${this.duel}`, 37.5, 31, 2.5, 'center', this.apex ? C.apex : C.text);
            this.setText(this.overlayLine1, `${count}`, 37.5, 40, 4.0, 'center', this.apex ? C.apex : C.gold);
            this.setText(this.overlayLine2, this.apex ? 'The final form is ready.' : 'It remembers your last duel.', 37.5, 49, 0.9, 'center', C.muted);
            this.setText(this.overlayLine3, this.apex ? 'How long can you last?' : 'Change your approach.', 37.5, 53, 0.9, 'center', this.apex ? C.apex : C.muted);
            this.setText(this.overlayLine4, '', 37.5, 57, 0.1, 'center', C.muted);
            this.setText(this.overlayControls1, '', 37.5, 61, 0.1, 'center', C.text);
            this.setText(this.overlayControls2, '', 37.5, 65, 0.1, 'center', C.text);
        } else if (this.phase === 'between') {
            this.setText(this.overlayHeadline, `VERSION ${this.wins} DEFEATED`, 37.5, 31, 2.2, 'center', C.text);
            this.setText(this.overlayLine1, 'Both fighters recover.', 37.5, 40, 0.9, 'center', C.muted);
            this.setText(this.overlayLine2, 'It remembers how you won.', 37.5, 44, 1.1, 'center', C.apex);
            this.setText(this.overlayLine3, 'Try a new rhythm next round.', 37.5, 49, 0.82, 'center', C.muted);
            this.setText(this.overlayLine4, this.wins >= TUNING.APEX_WIN_THRESHOLD ? 'THE FINAL FORM IS READY.' : `${TUNING.APEX_WIN_THRESHOLD - this.wins} WINS UNTIL APEX`, 37.5, 54, 0.9, 'center', this.wins >= TUNING.APEX_WIN_THRESHOLD ? C.apex : C.gold);
            this.setText(this.overlayControls1, '', 37.5, 59, 0.1, 'center', C.text);
            this.setText(this.overlayControls2, '', 37.5, 63, 0.1, 'center', C.text);
        } else if (this.phase === 'gameover') {
            const survival = this.apex ? (this.apexSurvivalTicks / TUNING.TICK_RATE).toFixed(2) : '0.00';
            this.setText(this.overlayHeadline, this.apex ? 'INEVITABLE' : 'THE MIRROR WON', 37.5, 29, 2.8, 'center', this.apex ? C.apex : C.enemy);
            this.setText(this.overlayLine1, `VERSIONS DEFEATED ${this.wins}`, 37.5, 38, 1.0, 'center', C.text);
            this.setText(this.overlayLine2, 'Every duel taught it something.', 37.5, 43, 0.78, 'center', C.muted);
            this.setText(this.overlayLine3, this.apex ? `APEX SURVIVAL ${survival}s` : 'Try mixing attacks with blocks and dodges.', 37.5, 48, 0.9, 'center', this.apex ? C.apex : C.muted);
            this.setText(this.overlayLine4, this.apex ? 'You reached the final form.' : 'A new run starts with a fresh rival.', 37.5, 53, 0.78, 'center', C.muted);
            this.setText(this.overlayControls1, '', 37.5, 58, 0.72, 'center', C.text);
            this.setText(this.overlayControls2, '', 37.5, 61.5, 0.72, 'center', C.text);
            this.setText(this.startButton.text, 'TRY AGAIN', 37.5, 67.1, 1.05, 'center', C.white);
        }
    }

    exportBrainCheckpoint(name) {
        return this.model.exportCheckpoint(name || `Counterforge Apex Gen ${this.wins}`, {
            wins: this.wins,
            description: `Trained through ${this.wins} defeated duel generations.`
        });
    }
}

module.exports = CounterforgeApex;
