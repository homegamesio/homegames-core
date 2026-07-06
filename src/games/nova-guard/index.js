const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-142');

const TICK_RATE = 20;

const CENTER = 50;
const PADDLE_R_INNER = 12;
const PADDLE_R_OUTER = 14.8;
const PADDLE_HALF_ARC = 0.55;
const CORE_RADIUS = 6;
const CORE_HIT_RADIUS = 7.5;
const SPAWN_RADIUS = 48;
const MAX_CORE_HP = 100;
const MAX_PLAYERS = 6;

const PALETTE = [
    { name: 'CYAN', color: [0, 255, 255, 255] },
    { name: 'MAGENTA', color: [255, 0, 255, 255] },
    { name: 'LIME', color: [57, 255, 20, 255] },
    { name: 'AMBER', color: [255, 191, 0, 255] },
    { name: 'SKY', color: [135, 206, 250, 255] },
    { name: 'PINK', color: [255, 105, 180, 255] }
];

const ENEMY_COLORS = [[255, 90, 70, 255], [255, 140, 60, 255], [240, 70, 120, 255]];

// Red-alert theme: deep crimson space, warning-light accents
const BG = [26, 6, 14, 255];
const ACCENT = [255, 80, 95, 255];
const INK = [255, 240, 240, 255];
const FAINT = [185, 135, 150, 255];
const GOLD = [255, 210, 90, 255];

const TAU = Math.PI * 2;

const glow = (color, blur) => ({ shadow: { color: [color[0], color[1], color[2], 255], blur } });
const light = (color, f) => [
    Math.round(color[0] + (255 - color[0]) * f),
    Math.round(color[1] + (255 - color[1]) * f),
    Math.round(color[2] + (255 - color[2]) * f),
    255
];

const angleDiff = (a, b) => {
    let d = (a - b) % TAU;
    if (d > Math.PI) {
        d -= TAU;
    }
    if (d < -Math.PI) {
        d += TAU;
    }
    return d;
};

class NovaGuard extends Game {
    static metadata() {
        return {
            aspectRatio: { x: 1, y: 1 },
            squishVersion: '142',
            author: 'Joseph Garcia',
            name: 'Nova Guard',
            description: 'Co-op arcade defense. Every player pilots an orbital shield around a shared core - block the swarm together and see how many waves your crew survives.',
            tickRate: TICK_RATE
        };
    }

    constructor() {
        super();

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: BG
        });

        this.buildStars();
        this.buildRing();

        this.coreNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: this.polygonAround(CENTER, CENTER, CORE_RADIUS, 8, 0),
            fill: [90, 230, 160, 255],
            color: [255, 255, 255, 255],
            effects: glow([90, 230, 160, 255], 20)
        });
        this.base.addChild(this.coreNode, false);

        this.paddleLayer = this.makeContainer();
        this.enemyLayer = this.makeContainer();
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
        this.base.addChildren(this.paddleLayer, this.enemyLayer, this.particleLayer, this.tapCatcher, this.hud, this.overlay);

        this.players = {};
        this.guards = {};
        this.particles = [];
        this.transients = [];
        this.enemies = [];
        this.tickCount = 0;
        this.bestWave = 0;

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

    buildStars() {
        for (let i = 0; i < 44; i++) {
            const size = 0.15 + Math.random() * 0.3;
            this.base.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(Math.random() * 99, Math.random() * 99, size, size),
                fill: [255, 205, 205, 255],
                color: [255, 255, 255, 80 + Math.floor(Math.random() * 130)]
            }), false);
        }
    }

    buildRing() {
        const points = [];
        const segments = 30;
        for (let i = 0; i <= segments; i++) {
            const a = (i / segments) * TAU;
            points.push([CENTER + Math.cos(a) * 13.7, CENTER + Math.sin(a) * 13.7]);
        }
        for (let i = segments; i >= 0; i--) {
            const a = (i / segments) * TAU;
            points.push([CENTER + Math.cos(a) * 13.3, CENTER + Math.sin(a) * 13.3]);
        }
        points.push(points[0]);
        this.base.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: points.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]),
            fill: [88, 28, 44, 255]
        }), false);
    }

    polygonAround(cx, cy, radius, sides, rotation) {
        const points = [];
        for (let i = 0; i <= sides; i++) {
            const a = rotation + (i / sides) * TAU;
            points.push([
                Math.round((cx + Math.cos(a) * radius) * 100) / 100,
                Math.round((cy + Math.sin(a) * radius) * 100) / 100
            ]);
        }
        return points;
    }

    arcPolygon(angle, halfArc) {
        const points = [];
        const steps = 6;
        for (let i = 0; i <= steps; i++) {
            const a = angle - halfArc + (i / steps) * halfArc * 2;
            points.push([CENTER + Math.cos(a) * PADDLE_R_OUTER, CENTER + Math.sin(a) * PADDLE_R_OUTER]);
        }
        for (let i = steps; i >= 0; i--) {
            const a = angle - halfArc + (i / steps) * halfArc * 2;
            points.push([CENTER + Math.cos(a) * PADDLE_R_INNER, CENTER + Math.sin(a) * PADDLE_R_INNER]);
        }
        points.push(points[0]);
        return points.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
    }

    makeGlowText(text, x, y, size, color, glowColor, playerIds) {
        const gc = glowColor || color;
        const offsets = [[-0.25, 0], [0.25, 0], [0, -0.25], [0, 0.25]];
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

    makeButton(label, x, y, w, h, color, onClick, playerIds) {
        const button = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(x, y, w, h),
            fill: [32, 10, 18, 255],
            color,
            border: 8,
            effects: glow(color, 8),
            onClick,
            playerIds
        });
        button.addChild(new GameNode.Text({
            textInfo: { x: x + w / 2, y: y + (h - 2.4) / 2, text: label, size: 2.4, align: 'center', font: 'monospace', color },
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

    // --- lobby / game over ---

    showLobby() {
        this.phase = 'lobby';
        this.enemies = [];
        this.particles = [];
        this.transients = [];
        Object.values(this.guards).forEach(guard => this.paddleLayer.removeChild(guard.node.id, false));
        this.guards = {};
        this.enemyLayer.clearChildren();
        this.particleLayer.clearChildren();
        this.hud.clearChildren();
        this.overlay.clearChildren();

        const title = this.makeGlowText('NOVA GUARD', 50, 12, 6, INK, ACCENT);
        this.titleHalos = title.slice(0, 4);
        title.forEach(n => this.overlay.addChild(n, false));

        this.overlay.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 21, text: 'CO-OP CORE DEFENSE', size: 2, align: 'center', font: 'monospace', color: FAINT }
        }), false);

        if (this.bestWave > 0) {
            this.overlay.addChild(new GameNode.Text({
                textInfo: { x: 50, y: 26, text: 'CREW RECORD: WAVE ' + this.bestWave, size: 1.7, align: 'center', font: 'monospace', color: GOLD }
            }), false);
        }

        this.startButton = this.makeButton('LAUNCH', 25, 74, 50, 8, [57, 255, 20, 255], (playerId) => {
            if (this.phase === 'lobby' && this.players[playerId]) {
                this.startRun();
            }
        });
        this.overlay.addChild(this.startButton, false);

        const lines = [
            'TAP ANYWHERE TO SWING YOUR SHIELD THERE',
            'OR STEER WITH ARROW KEYS / A + D',
            'BLOCK THE SWARM - PROTECT THE CORE - NOBODY FIGHTS ALONE',
            'FRIENDS CAN DROP IN MID-RUN'
        ];
        lines.forEach((text, i) => this.overlay.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 85 + i * 3, text, size: 1.3, align: 'center', font: 'monospace', color: FAINT }
        }), false));

        this.coreNode.node.fill = [90, 230, 160, 255];
        this.coreNode.node.effects = glow([90, 230, 160, 255], 20);
        this.base.node.onStateChange();
    }

    startRun() {
        this.phase = 'playing';
        this.wave = 0;
        this.coreHp = MAX_CORE_HP;
        this.blocksTotal = 0;
        this.enemies = [];
        this.transients = [];
        this.enemyLayer.clearChildren();
        this.overlay.clearChildren();

        Object.keys(this.players).map(Number).forEach(pid => this.addGuard(pid));
        this.rebuildHud();
        this.startIntermission();
    }

    addGuard(playerId) {
        if (this.guards[playerId] || Object.keys(this.guards).length >= MAX_PLAYERS) {
            return;
        }
        const used = new Set(Object.values(this.guards).map(g => g.colorIndex));
        const colorIndex = PALETTE.findIndex((c, i) => !used.has(i));
        const count = Object.keys(this.guards).length;
        const angle = (count / MAX_PLAYERS) * TAU;
        const guard = {
            playerId,
            colorIndex,
            color: PALETTE[colorIndex].color,
            angle,
            targetAngle: angle,
            blocks: 0,
            node: new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: this.arcPolygon(angle, PADDLE_HALF_ARC),
                fill: PALETTE[colorIndex].color,
                color: [255, 255, 255, 255],
                effects: glow(PALETTE[colorIndex].color, 12)
            })
        };
        this.guards[playerId] = guard;
        this.paddleLayer.addChild(guard.node, false);
        this.addTransient(this.makeGlowText('YOU ARE THE ' + PALETTE[colorIndex].name + ' SHIELD', 50, 38, 2, PALETTE[colorIndex].color, null, [playerId]), 3 * TICK_RATE);
    }

    startIntermission() {
        this.wave++;
        this.phase = 'intermission';
        this.intermissionTicks = 3 * TICK_RATE;
        this.coreHp = Math.min(MAX_CORE_HP, this.coreHp + (this.wave > 1 ? 12 : 0));

        const playerCount = Math.max(1, Object.keys(this.guards).length);
        this.spawnQueue = Math.round((5 + this.wave * 3) * (0.7 + 0.3 * playerCount));
        this.spawnInterval = Math.max(3, 13 - this.wave);
        this.spawnTicks = this.spawnInterval;
        this.bossQueued = this.wave % 3 === 0;

        this.addTransient(this.makeGlowText('WAVE ' + this.wave, 50, 26, 4.5, INK, ACCENT), this.intermissionTicks);
        if (this.bossQueued) {
            this.addTransient(this.makeGlowText('SOMETHING BIG INBOUND', 50, 34, 1.8, [255, 120, 90, 255]), this.intermissionTicks);
        }
        this.rebuildHud();
    }

    rebuildHud() {
        this.hud.clearChildren();
        if (this.phase === 'lobby') {
            return;
        }

        this.hud.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 1.5, text: 'WAVE ' + this.wave, size: 2, align: 'center', font: 'monospace', color: INK }
        }), false);
        this.hud.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 5.4, text: 'BLOCKS ' + this.blocksTotal + (this.bestWave ? '   BEST W' + this.bestWave : ''), size: 1.3, align: 'center', font: 'monospace', color: FAINT }
        }), false);

        this.hud.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(25, 96.5, 50, 1.6),
            fill: [30, 32, 60, 255]
        }), false);
        const frac = Math.max(0, this.coreHp / MAX_CORE_HP);
        this.hud.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(25, 96.5, 50 * frac, 1.6),
            fill: frac > 0.5 ? [90, 230, 160, 255] : (frac > 0.25 ? [255, 191, 0, 255] : [240, 80, 80, 255])
        }), false);
        this.hud.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 93, text: 'CORE', size: 1.2, align: 'center', font: 'monospace', color: FAINT }
        }), false);

        Object.values(this.guards).forEach((guard, i) => {
            const x = 2 + i * 16;
            this.hud.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(x, 2, 1.8, 1.8),
                fill: guard.color,
                color: [255, 255, 255, 255]
            }), false);
            this.hud.addChild(new GameNode.Text({
                textInfo: { x: x + 2.6, y: 1.7, text: this.playerName(guard.playerId).slice(0, 6), size: 1.1, font: 'monospace', color: INK }
            }), false);
            this.hud.addChild(new GameNode.Text({
                textInfo: { x: x + 2.6, y: 3.7, text: String(guard.blocks), size: 1.2, font: 'monospace', color: GOLD }
            }), false);
            // frameless sessions have no chrome showing your name, so each
            // player gets a private marker on their own entry
            this.hud.addChild(new GameNode.Text({
                textInfo: { x: x + 5.4, y: 3.8, text: 'YOU', size: 1, font: 'monospace', color: GOLD },
                playerIds: [guard.playerId]
            }), false);
        });
    }

    // --- enemies ---

    spawnEnemy(isBoss) {
        const angle = Math.random() * TAU;
        const tint = ENEMY_COLORS[Math.floor(Math.random() * ENEMY_COLORS.length)];
        const enemy = {
            angle,
            radius: SPAWN_RADIUS,
            speed: (0.14 + this.wave * 0.016 + Math.random() * 0.05) * (isBoss ? 0.55 : 1),
            drift: (Math.random() - 0.5) * 0.012,
            size: isBoss ? 4.6 : 1.7 + Math.random() * 0.8,
            hp: isBoss ? 2 + Math.ceil(this.wave / 3) : 1,
            isBoss: !!isBoss,
            color: isBoss ? [255, 70, 90, 255] : tint
        };
        enemy.node = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: this.enemyRect(enemy),
            fill: enemy.color,
            color: [255, 255, 255, 255],
            effects: isBoss ? glow(enemy.color, 16) : glow(enemy.color, 5)
        });
        this.enemies.push(enemy);
        this.enemyLayer.addChild(enemy.node, false);
    }

    enemyRect(enemy) {
        const x = CENTER + Math.cos(enemy.angle) * enemy.radius;
        const y = CENTER + Math.sin(enemy.angle) * enemy.radius;
        const s = enemy.size;
        return ShapeUtils.rectangle(
            Math.max(0, Math.min(100 - s, x - s / 2)),
            Math.max(0, Math.min(100 - s, y - s / 2)),
            s, s);
    }

    updateEnemies() {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.radius -= enemy.speed;
            enemy.angle += enemy.drift;

            if (enemy.radius <= PADDLE_R_OUTER && enemy.radius >= PADDLE_R_INNER - 0.5) {
                const enemyHalfArc = (enemy.size / 2) / Math.max(1, enemy.radius);
                const blocker = Object.values(this.guards).find(guard =>
                    Math.abs(angleDiff(guard.angle, enemy.angle)) < PADDLE_HALF_ARC + enemyHalfArc);
                if (blocker) {
                    enemy.hp--;
                    this.burst(CENTER + Math.cos(enemy.angle) * enemy.radius,
                        CENTER + Math.sin(enemy.angle) * enemy.radius, blocker.color, enemy.isBoss ? 14 : 7);
                    if (enemy.hp <= 0) {
                        blocker.blocks++;
                        this.blocksTotal++;
                        this.enemyLayer.removeChild(enemy.node.id, false);
                        this.enemies.splice(i, 1);
                        this.rebuildHud();
                        continue;
                    } else {
                        enemy.radius = Math.min(SPAWN_RADIUS, enemy.radius + 14);
                    }
                }
            }

            if (enemy.radius <= CORE_HIT_RADIUS) {
                this.coreHp -= enemy.isBoss ? 26 : 9;
                this.burst(CENTER, CENTER, [255, 90, 70, 255], 12);
                this.enemyLayer.removeChild(enemy.node.id, false);
                this.enemies.splice(i, 1);
                this.rebuildHud();
                if (this.coreHp <= 0) {
                    this.gameOver();
                    return;
                }
                continue;
            }

            enemy.node.node.coordinates2d = this.enemyRect(enemy);
        }
    }

    gameOver() {
        this.phase = 'gameOver';
        this.bestWave = Math.max(this.bestWave, this.wave);
        this.enemies.forEach(enemy => this.enemyLayer.removeChild(enemy.node.id, false));
        this.enemies = [];
        this.overlay.clearChildren();
        this.transients = [];

        this.burst(CENTER, CENTER, [255, 200, 120, 255], 30);
        this.coreNode.node.fill = [70, 40, 60, 255];
        this.coreNode.node.effects = null;

        this.makeGlowText('THE CORE FELL', 50, 24, 4.5, [255, 110, 90, 255])
            .forEach(n => this.overlay.addChild(n, false));
        this.makeGlowText('YOUR CREW HELD ' + (this.wave - 1) + ' WAVE' + (this.wave - 1 === 1 ? '' : 'S'), 50, 32, 2.2, INK)
            .forEach(n => this.overlay.addChild(n, false));

        const guards = Object.values(this.guards).sort((a, b) => b.blocks - a.blocks);
        guards.forEach((guard, i) => {
            this.overlay.addChild(new GameNode.Text({
                textInfo: { x: 50, y: 40 + i * 3.4, text: this.playerName(guard.playerId) + ' - ' + guard.blocks + ' BLOCKS', size: 1.6, align: 'center', font: 'monospace', color: guard.color }
            }), false);
        });

        this.overlay.addChild(this.makeButton('GO AGAIN', 25, 72, 50, 8, ACCENT, (playerId) => {
            if (this.phase === 'gameOver' && this.players[playerId]) {
                this.startRun();
            }
        }), false);
        this.rebuildHud();
    }

    // --- particles ---

    burst(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * TAU;
            const speed = 0.3 + Math.random() * 0.8;
            const particle = {
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 7 + Math.floor(Math.random() * 7),
                maxLife: 14,
                color,
                node: new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(x, y, 0.8, 0.8),
                    fill: light(color, 0.3),
                    color: [color[0], color[1], color[2], 255]
                })
            };
            this.particles.push(particle);
            this.particleLayer.addChild(particle.node, false);
        }
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            if (p.life <= 0 || p.x < 1 || p.x > 98 || p.y < 1 || p.y > 98) {
                this.particleLayer.removeChild(p.node.id, false);
                this.particles.splice(i, 1);
            } else {
                const frac = p.life / p.maxLife;
                p.node.node.coordinates2d = ShapeUtils.rectangle(p.x, p.y, 0.9 * frac + 0.15, 0.9 * frac + 0.15);
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

    // --- simulation ---

    tick() {
        this.tickCount++;

        if (this.phase === 'lobby' && this.titleHalos) {
            const alpha = 110 + Math.round(60 * Math.sin(this.tickCount / 5));
            this.titleHalos.forEach(halo => {
                halo.node.text.color = [ACCENT[0], ACCENT[1], ACCENT[2], alpha];
            });
        }

        if (this.phase === 'playing' || this.phase === 'intermission') {
            Object.values(this.guards).forEach(guard => {
                const diff = angleDiff(guard.targetAngle, guard.angle);
                if (Math.abs(diff) > 0.01) {
                    guard.angle += Math.max(-0.2, Math.min(0.2, diff));
                    guard.node.node.coordinates2d = this.arcPolygon(guard.angle, PADDLE_HALF_ARC);
                }
            });

            const pulse = CORE_RADIUS + Math.sin(this.tickCount / 4) * 0.4;
            this.coreNode.node.coordinates2d = this.polygonAround(CENTER, CENTER, pulse, 8, this.tickCount / 30);
            const frac = Math.max(0, this.coreHp / MAX_CORE_HP);
            const coreColor = frac > 0.5 ? [90, 230, 160, 255] : (frac > 0.25 ? [255, 191, 0, 255] : [240, 80, 80, 255]);
            this.coreNode.node.fill = coreColor;
            this.coreNode.node.effects = glow(coreColor, 20);
        }

        if (this.phase === 'intermission') {
            if (--this.intermissionTicks <= 0) {
                this.phase = 'playing';
            }
        } else if (this.phase === 'playing') {
            if (this.spawnQueue > 0 && --this.spawnTicks <= 0) {
                this.spawnTicks = this.spawnInterval;
                this.spawnQueue--;
                if (this.bossQueued && this.spawnQueue === Math.floor(this.spawnQueue / 2)) {
                    this.bossQueued = false;
                    this.spawnEnemy(true);
                } else {
                    this.spawnEnemy(false);
                }
            }
            this.updateEnemies();
            if (this.phase === 'playing' && this.spawnQueue <= 0 && this.enemies.length === 0) {
                this.addTransient(this.makeGlowText('WAVE ' + this.wave + ' CLEARED', 50, 30, 3, [57, 255, 20, 255]), 2 * TICK_RATE);
                this.startIntermission();
            }
        }

        this.updateParticles();
        this.updateTransients();
        this.base.node.onStateChange();
    }

    // --- input ---

    handleTap(playerId, x, y) {
        const guard = this.guards[playerId];
        if (!guard || (this.phase !== 'playing' && this.phase !== 'intermission')) {
            return;
        }
        const dx = x - CENTER;
        const dy = y - CENTER;
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) {
            return;
        }
        guard.targetAngle = Math.atan2(dy, dx);
    }

    handleKeyDown(playerId, key) {
        const guard = this.guards[playerId];
        if (!guard || (this.phase !== 'playing' && this.phase !== 'intermission')) {
            return;
        }
        if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
            guard.targetAngle = guard.angle - 0.3;
        } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
            guard.targetAngle = guard.angle + 0.3;
        }
    }

    // --- platform hooks ---

    handleNewPlayer({ playerId, info }) {
        this.players[playerId] = { name: (info && info.name) || ('PLAYER ' + playerId) };
        if (this.phase === 'playing' || this.phase === 'intermission') {
            if (Object.keys(this.guards).length < MAX_PLAYERS) {
                this.addGuard(playerId);
                this.addTransient(this.makeGlowText('REINFORCEMENTS: ' + this.playerName(playerId), 50, 20, 2, [57, 255, 20, 255]), 2 * TICK_RATE);
                this.rebuildHud();
            }
        }
        this.base.node.onStateChange();
    }

    handlePlayerDisconnect(playerId) {
        delete this.players[playerId];
        const guard = this.guards[playerId];
        if (guard) {
            this.paddleLayer.removeChild(guard.node.id, false);
            delete this.guards[playerId];
            this.rebuildHud();
        }

        if (Object.keys(this.players).length === 0) {
            this.showLobby();
        } else if ((this.phase === 'playing' || this.phase === 'intermission') && Object.keys(this.guards).length === 0) {
            this.gameOver();
        }
        this.base.node.onStateChange();
    }

    getLayers() {
        return [{ root: this.base }];
    }
}

module.exports = NovaGuard;
