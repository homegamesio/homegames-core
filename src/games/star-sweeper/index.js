const { ViewableGame, GameNode, Shapes, ShapeUtils, ViewUtils } = require('squish-142');

const TICK_RATE = 20;

const WORLD = 300;
const VIEW_SIZE = 100;
const MATCH_SECONDS = 90;
const ORB_COUNT = 45;
const ASTEROID_COUNT = 7;
const MAX_PLAYERS = 6;

const PALETTE = [
    { name: 'CYAN', color: [0, 255, 255, 255] },
    { name: 'MAGENTA', color: [255, 0, 255, 255] },
    { name: 'LIME', color: [57, 255, 20, 255] },
    { name: 'AMBER', color: [255, 191, 0, 255] },
    { name: 'SKY', color: [135, 206, 250, 255] },
    { name: 'PINK', color: [255, 105, 180, 255] }
];

const SPACE = [8, 9, 26, 255];
const INK = [235, 240, 255, 255];
const FAINT = [130, 140, 180, 255];
const GOLD = [255, 210, 90, 255];
const ORB_COLOR = [255, 230, 120, 255];

const glow = (color, blur) => ({ shadow: { color: [color[0], color[1], color[2], 255], blur } });
const light = (color, f) => [
    Math.round(color[0] + (255 - color[0]) * f),
    Math.round(color[1] + (255 - color[1]) * f),
    Math.round(color[2] + (255 - color[2]) * f),
    255
];

class StarSweeper extends ViewableGame {
    static metadata() {
        return {
            aspectRatio: { x: 1, y: 1 },
            squishVersion: '142',
            author: 'Joseph Garcia',
            name: 'Star Sweeper',
            description: 'Race across a world nine screens wide - every player gets their own camera. Sweep up star orbs, dodge asteroids, and top the board before time runs out.',
            tickRate: TICK_RATE
        };
    }

    constructor() {
        super(WORLD);

        this.worldBase = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, WORLD, WORLD),
            fill: SPACE
        });
        this.getPlane().addChild(this.worldBase, false);

        this.buildWorldDressing();

        // Screen-space UI shared by everyone; added after per-player view roots
        // so it always draws on top of the world. The tap layer sits between
        // world views and the UI: view clones cover the whole screen, so taps
        // need a clickable catcher above them (the hit-test stops at the
        // topmost containing node).
        this.tapLayer = this.makeScreenContainer();
        this.hud = this.makeScreenContainer();
        this.overlay = this.makeScreenContainer();

        this.players = {};
        this.ships = {};
        this.playerViews = {};
        this.orbs = [];
        this.asteroids = [];
        this.particles = [];
        this.transients = [];
        this.minimapDots = {};
        this.tickCount = 0;

        this.getViewRoot().addChildren(this.tapLayer, this.hud, this.overlay);

        this.showLobby();
    }

    makeScreenContainer() {
        // Zero-size rect: full-screen containers swallow clicks for everything
        // drawn beneath them (the server hit-test picks the topmost containing
        // node whether or not it is clickable).
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });
    }

    buildWorldDressing() {
        for (let i = 0; i < 60; i++) {
            const size = 0.4 + Math.random() * 0.7;
            this.worldBase.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(Math.random() * (WORLD - 2), Math.random() * (WORLD - 2), size, size),
                fill: [200, 210, 255, 255],
                color: [255, 255, 255, 70 + Math.floor(Math.random() * 120)]
            }), false);
        }

        const borderColor = [90, 120, 255, 255];
        const walls = [
            ShapeUtils.rectangle(0, 0, WORLD, 1.5),
            ShapeUtils.rectangle(0, WORLD - 1.5, WORLD, 1.5),
            ShapeUtils.rectangle(0, 0, 1.5, WORLD),
            ShapeUtils.rectangle(WORLD - 1.5, 0, 1.5, WORLD)
        ];
        walls.forEach(coords => this.worldBase.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: coords,
            fill: borderColor,
            effects: glow(borderColor, 10)
        }), false));
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
            fill: [14, 16, 40, 255],
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

    // --- lobby ---

    showLobby() {
        this.phase = 'lobby';
        this.clearWorldActors();
        this.hud.clearChildren();
        this.overlay.clearChildren();
        this.transients = [];

        Object.keys(this.playerViews).map(Number).forEach(pid => this.removeCamera(pid));

        const title = this.makeGlowText('STAR SWEEPER', 50, 12, 6, INK, [255, 191, 0, 255]);
        this.titleHalos = title.slice(0, 4);
        title.forEach(n => this.overlay.addChild(n, false));

        this.overlay.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 21, text: 'A WORLD NINE SCREENS WIDE - YOUR OWN CAMERA', size: 1.7, align: 'center', font: 'monospace', color: FAINT }
        }), false);

        this.startButton = this.makeButton('SWEEP', 25, 66, 50, 8, [57, 255, 20, 255], (playerId) => {
            if (this.phase === 'lobby' && this.players[playerId]) {
                this.startMatch();
            }
        });
        this.overlay.addChild(this.startButton, false);

        const lines = [
            'STEER WITH WASD / ARROWS - OR TAP WHERE YOU WANT TO FLY',
            'GRAB THE GOLD ORBS - ASTEROIDS KNOCK THEM LOOSE',
            'MOST ORBS IN 90 SECONDS WINS - DROP IN ANY TIME'
        ];
        lines.forEach((text, i) => this.overlay.addChild(new GameNode.Text({
            textInfo: { x: 50, y: 78 + i * 3.4, text, size: 1.4, align: 'center', font: 'monospace', color: FAINT }
        }), false));

        this.getViewRoot().node.onStateChange();
    }

    clearWorldActors() {
        this.orbs.forEach(orb => this.worldBase.removeChild(orb.node.id, false));
        this.asteroids.forEach(a => this.worldBase.removeChild(a.node.id, false));
        this.particles.forEach(p => this.worldBase.removeChild(p.node.id, false));
        Object.values(this.ships).forEach(ship => {
            this.worldBase.removeChild(ship.node.id, false);
            this.worldBase.removeChild(ship.label.id, false);
        });
        this.orbs = [];
        this.asteroids = [];
        this.particles = [];
        this.ships = {};
        this.minimapDots = {};
    }

    // --- match setup ---

    startMatch() {
        this.phase = 'playing';
        this.matchTicksLeft = MATCH_SECONDS * TICK_RATE;
        this.clearWorldActors();
        this.overlay.clearChildren();
        this.transients = [];

        for (let i = 0; i < ORB_COUNT; i++) {
            this.spawnOrb();
        }
        for (let i = 0; i < ASTEROID_COUNT; i++) {
            this.spawnAsteroid();
        }

        Object.keys(this.players).map(Number).forEach(pid => this.addShip(pid));
        this.buildHud();
        this.addTransient(this.makeGlowText('SWEEP!', 50, 40, 6, INK, GOLD), TICK_RATE);
        this.getViewRoot().node.onStateChange();
    }

    spawnOrb() {
        const orb = {
            x: 15 + Math.random() * (WORLD - 30),
            y: 15 + Math.random() * (WORLD - 30)
        };
        orb.node = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: this.diamond(orb.x, orb.y, 1.7),
            fill: ORB_COLOR,
            color: [255, 255, 255, 255],
            effects: glow(ORB_COLOR, 10)
        });
        this.orbs.push(orb);
        this.worldBase.addChild(orb.node, false);
    }

    spawnAsteroid() {
        const size = 7 + Math.random() * 6;
        const asteroid = {
            x: 20 + Math.random() * (WORLD - 40),
            y: 20 + Math.random() * (WORLD - 40),
            vx: (Math.random() - 0.5) * 1.4,
            vy: (Math.random() - 0.5) * 1.4,
            size
        };
        asteroid.node = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: this.roughRock(asteroid.x, asteroid.y, size),
            fill: [90, 88, 110, 255],
            color: [255, 255, 255, 255],
            effects: glow([140, 130, 170, 255], 6)
        });
        this.asteroids.push(asteroid);
        this.worldBase.addChild(asteroid.node, false);
    }

    diamond(cx, cy, r) {
        return [
            [cx, cy - r],
            [cx + r, cy],
            [cx, cy + r],
            [cx - r, cy],
            [cx, cy - r]
        ].map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
    }

    roughRock(cx, cy, size) {
        const points = [];
        const sides = 7;
        for (let i = 0; i <= sides; i++) {
            const a = (i / sides) * Math.PI * 2;
            const r = size / 2 * (i === sides ? 1 : 0.75 + Math.random() * 0.4);
            points.push([
                Math.round((cx + Math.cos(a) * r) * 100) / 100,
                Math.round((cy + Math.sin(a) * r) * 100) / 100
            ]);
        }
        points[sides] = points[0];
        return points;
    }

    shipTriangle(ship) {
        const angle = ship.heading;
        const r = 2.6;
        const points = [
            [ship.x + Math.cos(angle) * r, ship.y + Math.sin(angle) * r],
            [ship.x + Math.cos(angle + 2.5) * r, ship.y + Math.sin(angle + 2.5) * r],
            [ship.x + Math.cos(angle - 2.5) * r, ship.y + Math.sin(angle - 2.5) * r]
        ];
        points.push(points[0]);
        return points.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
    }

    addShip(playerId) {
        if (this.ships[playerId] || Object.keys(this.ships).length >= MAX_PLAYERS) {
            return;
        }
        const used = new Set(Object.values(this.ships).map(s => s.colorIndex));
        const colorIndex = PALETTE.findIndex((c, i) => !used.has(i));
        const spawnPoints = [[60, 60], [240, 60], [60, 240], [240, 240], [150, 60], [150, 240]];
        const spawn = spawnPoints[colorIndex % spawnPoints.length];
        const ship = {
            playerId,
            colorIndex,
            color: PALETTE[colorIndex].color,
            x: spawn[0],
            y: spawn[1],
            vx: 0,
            vy: 0,
            heading: 0,
            thrustX: 0,
            thrustY: 0,
            thrustTicks: 0,
            stunTicks: 0,
            safeTicks: 2 * TICK_RATE,
            score: 0
        };
        ship.node = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: this.shipTriangle(ship),
            fill: ship.color,
            color: [255, 255, 255, 255],
            effects: glow(ship.color, 12)
        });
        ship.label = new GameNode.Text({
            textInfo: { x: ship.x, y: ship.y - 6, text: this.playerName(playerId), size: 1.3, align: 'center', font: 'monospace', color: light(ship.color, 0.4) }
        });
        this.ships[playerId] = ship;
        this.worldBase.addChildren(ship.node, ship.label);
        this.addCamera(playerId);
        this.buildHud();
        this.addTransient(this.makeGlowText('YOU FLY THE ' + PALETTE[colorIndex].name + ' SHIP', 50, 48, 2, ship.color, null, [playerId]), 3 * TICK_RATE);
    }

    // --- cameras ---

    addCamera(playerId) {
        if (this.playerViews[playerId]) {
            return;
        }
        const realRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: SPACE,
            playerIds: [playerId]
        });
        const tapCatcher = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            playerIds: [playerId],
            onClick: (pid, x, y) => this.handleTap(pid, x, y)
        });
        this.playerViews[playerId] = {
            view: { x: 0, y: 0, w: VIEW_SIZE, h: VIEW_SIZE },
            root: realRoot,
            tapCatcher
        };
        this.tapLayer.addChild(tapCatcher, false);
        // Cameras must render under the tap layer and HUD: re-add those
        // containers after so they stay last in draw order.
        this.getViewRoot().addChild(realRoot, false);
        [this.tapLayer, this.hud, this.overlay].forEach(container =>
            this.getViewRoot().removeChild(container.id, false));
        this.getViewRoot().addChildren(this.tapLayer, this.hud, this.overlay);
    }

    removeCamera(playerId) {
        const entry = this.playerViews[playerId];
        if (entry) {
            this.getViewRoot().removeChild(entry.root.node.id, false);
            this.tapLayer.removeChild(entry.tapCatcher.id, false);
            delete this.playerViews[playerId];
        }
    }

    updateCameras() {
        Object.keys(this.playerViews).map(Number).forEach(pid => {
            const entry = this.playerViews[pid];
            const ship = this.ships[pid];
            if (!ship) {
                return;
            }
            entry.view.x = Math.max(0, Math.min(WORLD - VIEW_SIZE, ship.x - VIEW_SIZE / 2));
            entry.view.y = Math.max(0, Math.min(WORLD - VIEW_SIZE, ship.y - VIEW_SIZE / 2));
            const viewContent = ViewUtils.getView(this.getPlane(), entry.view, [pid]);
            entry.root.node.clearChildren();
            entry.root.node.addChild(viewContent);
        });
    }

    // --- hud ---

    buildHud() {
        this.hud.clearChildren();
        if (this.phase === 'lobby') {
            return;
        }

        this.timerText = new GameNode.Text({
            textInfo: { x: 50, y: 1.5, text: String(MATCH_SECONDS), size: 2.4, align: 'center', font: 'monospace', color: GOLD }
        });
        this.hud.addChild(this.timerText, false);

        const ships = Object.values(this.ships);
        ships.forEach((ship, i) => {
            const x = 2 + i * 15.5;
            this.hud.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(x, 2, 1.8, 1.8),
                fill: ship.color,
                color: [255, 255, 255, 255]
            }), false);
            this.hud.addChild(new GameNode.Text({
                textInfo: { x: x + 2.6, y: 1.6, text: this.playerName(ship.playerId).slice(0, 6), size: 1.1, font: 'monospace', color: INK }
            }), false);
            ship.scoreText = new GameNode.Text({
                textInfo: { x: x + 2.6, y: 3.6, text: '◆ ' + ship.score, size: 1.3, font: 'monospace', color: GOLD }
            });
            this.hud.addChild(ship.scoreText, false);
            // frameless sessions have no chrome showing your name, so each
            // player gets a private marker on their own entry
            this.hud.addChild(new GameNode.Text({
                textInfo: { x: x + 6.2, y: 3.8, text: 'YOU', size: 1, font: 'monospace', color: GOLD },
                playerIds: [ship.playerId]
            }), false);
        });

        // minimap
        const mapX = 78;
        const mapY = 78;
        const mapSize = 19;
        this.hud.addChild(new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(mapX, mapY, mapSize, mapSize),
            fill: [10, 12, 34, 235],
            color: [90, 120, 255, 255],
            border: 4
        }), false);
        this.minimap = { x: mapX, y: mapY, size: mapSize };
        this.minimapDots = {};
        ships.forEach(ship => {
            const dot = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(mapX, mapY, 1, 1),
                fill: ship.color,
                color: [255, 255, 255, 255]
            });
            this.minimapDots[ship.playerId] = dot;
            this.hud.addChild(dot, false);
        });
    }

    updateMinimap() {
        if (!this.minimap) {
            return;
        }
        Object.values(this.ships).forEach(ship => {
            const dot = this.minimapDots[ship.playerId];
            if (dot) {
                const x = this.minimap.x + (ship.x / WORLD) * (this.minimap.size - 1);
                const y = this.minimap.y + (ship.y / WORLD) * (this.minimap.size - 1);
                dot.node.coordinates2d = ShapeUtils.rectangle(Math.round(x * 100) / 100, Math.round(y * 100) / 100, 1, 1);
            }
        });
    }

    // --- world simulation ---

    updateShips() {
        Object.values(this.ships).forEach(ship => {
            if (ship.stunTicks > 0) {
                ship.stunTicks--;
            } else if (ship.thrustTicks > 0) {
                ship.thrustTicks--;
                ship.vx += ship.thrustX * 0.34;
                ship.vy += ship.thrustY * 0.34;
            }
            if (ship.safeTicks > 0) {
                ship.safeTicks--;
            }

            ship.vx *= 0.9;
            ship.vy *= 0.9;
            const speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
            if (speed > 2.4) {
                ship.vx *= 2.4 / speed;
                ship.vy *= 2.4 / speed;
            }
            ship.x = Math.max(5, Math.min(WORLD - 5, ship.x + ship.vx));
            ship.y = Math.max(5, Math.min(WORLD - 5, ship.y + ship.vy));
            if (speed > 0.15) {
                ship.heading = Math.atan2(ship.vy, ship.vx);
            }

            ship.node.node.coordinates2d = this.shipTriangle(ship);
            const flicker = ship.stunTicks > 0 && this.tickCount % 2 === 0;
            ship.node.node.color = [255, 255, 255, flicker ? 70 : 255];
            ship.label.node.text.x = Math.round(ship.x * 100) / 100;
            ship.label.node.text.y = Math.round((ship.y - 6) * 100) / 100;

            // orb pickup
            for (let i = this.orbs.length - 1; i >= 0; i--) {
                const orb = this.orbs[i];
                const dx = orb.x - ship.x;
                const dy = orb.y - ship.y;
                if (dx * dx + dy * dy < 12) {
                    this.worldBase.removeChild(orb.node.id, false);
                    this.orbs.splice(i, 1);
                    ship.score++;
                    if (ship.scoreText) {
                        ship.scoreText.node.text.text = '◆ ' + ship.score;
                    }
                    this.burst(orb.x, orb.y, ORB_COLOR, 6);
                    this.spawnOrb();
                }
            }

            // asteroid collisions
            if (ship.safeTicks <= 0 && ship.stunTicks <= 0) {
                this.asteroids.forEach(asteroid => {
                    const dx = asteroid.x - ship.x;
                    const dy = asteroid.y - ship.y;
                    const range = asteroid.size / 2 + 2;
                    if (dx * dx + dy * dy < range * range) {
                        ship.stunTicks = TICK_RATE;
                        ship.safeTicks = 2 * TICK_RATE;
                        ship.vx = -dx * 0.4;
                        ship.vy = -dy * 0.4;
                        const dropped = Math.min(2, ship.score);
                        ship.score -= dropped;
                        if (ship.scoreText) {
                            ship.scoreText.node.text.text = '◆ ' + ship.score;
                        }
                        for (let d = 0; d < dropped; d++) {
                            const orb = {
                                x: Math.max(10, Math.min(WORLD - 10, ship.x + (Math.random() - 0.5) * 24)),
                                y: Math.max(10, Math.min(WORLD - 10, ship.y + (Math.random() - 0.5) * 24))
                            };
                            orb.node = new GameNode.Shape({
                                shapeType: Shapes.POLYGON,
                                coordinates2d: this.diamond(orb.x, orb.y, 1.7),
                                fill: ORB_COLOR,
                                color: [255, 255, 255, 255],
                                effects: glow(ORB_COLOR, 10)
                            });
                            this.orbs.push(orb);
                            this.worldBase.addChild(orb.node, false);
                        }
                        this.burst(ship.x, ship.y, ship.color, 12);
                        if (dropped > 0) {
                            this.addTransient(this.makeGlowText('ASTEROID! -' + dropped + ' ◆', 50, 20, 2.2, [255, 110, 90, 255], null, [ship.playerId]), TICK_RATE);
                        }
                    }
                });
            }
        });
    }

    updateAsteroids() {
        this.asteroids.forEach(asteroid => {
            asteroid.x += asteroid.vx;
            asteroid.y += asteroid.vy;
            if (asteroid.x < asteroid.size || asteroid.x > WORLD - asteroid.size) {
                asteroid.vx *= -1;
            }
            if (asteroid.y < asteroid.size || asteroid.y > WORLD - asteroid.size) {
                asteroid.vy *= -1;
            }
            asteroid.x = Math.max(asteroid.size, Math.min(WORLD - asteroid.size, asteroid.x));
            asteroid.y = Math.max(asteroid.size, Math.min(WORLD - asteroid.size, asteroid.y));
            asteroid.node.node.coordinates2d = this.roughRockTranslate(asteroid);
        });
    }

    roughRockTranslate(asteroid) {
        // keep the rock's silhouette stable: translate the existing polygon
        const coords = asteroid.node.node.coordinates2d;
        if (!asteroid._shape) {
            const cx = coords.reduce((sum, p) => sum + p[0], 0) / coords.length;
            const cy = coords.reduce((sum, p) => sum + p[1], 0) / coords.length;
            asteroid._shape = coords.map(([x, y]) => [x - cx, y - cy]);
        }
        return asteroid._shape.map(([dx, dy]) => [
            Math.round((asteroid.x + dx) * 100) / 100,
            Math.round((asteroid.y + dy) * 100) / 100
        ]);
    }

    burst(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.5 + Math.random() * 1.2;
            const particle = {
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 5 + Math.floor(Math.random() * 5),
                maxLife: 10,
                color,
                node: new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(x, y, 0.9, 0.9),
                    fill: light(color, 0.3),
                    color: [color[0], color[1], color[2], 255]
                })
            };
            this.particles.push(particle);
            this.worldBase.addChild(particle.node, false);
        }
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            if (p.life <= 0) {
                this.worldBase.removeChild(p.node.id, false);
                this.particles.splice(i, 1);
            } else {
                const frac = p.life / p.maxLife;
                p.node.node.coordinates2d = ShapeUtils.rectangle(
                    Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100, 0.9 * frac + 0.2, 0.9 * frac + 0.2);
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

    endMatch() {
        this.phase = 'results';
        this.overlay.clearChildren();
        this.transients = [];

        const standings = Object.values(this.ships).sort((a, b) => b.score - a.score);
        const winner = standings[0];

        this.makeGlowText('SWEEP COMPLETE', 50, 18, 4, INK, GOLD)
            .forEach(n => this.overlay.addChild(n, false));
        if (winner) {
            this.makeGlowText(this.playerName(winner.playerId) + ' SWEPT THE STARS', 50, 27, 2.4, light(winner.color, 0.4), winner.color)
                .forEach(n => this.overlay.addChild(n, false));
        }
        standings.forEach((ship, i) => {
            this.overlay.addChild(new GameNode.Text({
                textInfo: { x: 50, y: 36 + i * 3.6, text: (i + 1) + '. ' + this.playerName(ship.playerId) + ' - ' + ship.score + ' ◆', size: 1.7, align: 'center', font: 'monospace', color: ship.color }
            }), false);
        });

        this.overlay.addChild(this.makeButton('SWEEP AGAIN', 25, 70, 50, 8, [0, 255, 255, 255], (playerId) => {
            if (this.phase === 'results' && this.players[playerId]) {
                this.startMatch();
            }
        }), false);
    }

    // --- simulation ---

    tick() {
        this.tickCount++;

        if (this.phase === 'lobby') {
            if (this.titleHalos) {
                const alpha = 110 + Math.round(60 * Math.sin(this.tickCount / 4));
                this.titleHalos.forEach(halo => {
                    halo.node.text.color = [255, 191, 0, alpha];
                });
            }
        } else if (this.phase === 'playing') {
            this.matchTicksLeft--;
            if (this.timerText && this.matchTicksLeft % TICK_RATE === 0) {
                const secs = Math.ceil(this.matchTicksLeft / TICK_RATE);
                this.timerText.node.text.text = String(secs);
                this.timerText.node.text.color = secs <= 10 ? [240, 80, 80, 255] : GOLD;
            }
            this.updateShips();
            this.updateAsteroids();
            this.updateParticles();
            this.updateMinimap();
            this.updateCameras();
            if (this.matchTicksLeft <= 0) {
                this.endMatch();
            }
        } else if (this.phase === 'results') {
            this.updateParticles();
            this.updateCameras();
        }

        this.updateTransients();
        this.getViewRoot().node.onStateChange();
    }

    // --- input ---

    handleTap(playerId, x, y) {
        const ship = this.ships[playerId];
        if (!ship || this.phase !== 'playing') {
            return;
        }
        const dx = x - 50;
        const dy = y - 50;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 3) {
            return;
        }
        ship.thrustX = dx / len;
        ship.thrustY = dy / len;
        ship.thrustTicks = 5;
    }

    handleKeyDown(playerId, key) {
        const ship = this.ships[playerId];
        if (!ship || this.phase !== 'playing') {
            return;
        }
        const dirs = {
            'ArrowUp': [0, -1], 'w': [0, -1], 'W': [0, -1],
            'ArrowDown': [0, 1], 's': [0, 1], 'S': [0, 1],
            'ArrowLeft': [-1, 0], 'a': [-1, 0], 'A': [-1, 0],
            'ArrowRight': [1, 0], 'd': [1, 0], 'D': [1, 0]
        };
        const dir = dirs[key];
        if (dir) {
            ship.thrustX = dir[0];
            ship.thrustY = dir[1];
            ship.thrustTicks = 3;
        }
    }

    // --- platform hooks ---

    handleNewPlayer({ playerId, info }) {
        this.players[playerId] = { name: (info && info.name) || ('PLAYER ' + playerId) };
        if (this.phase === 'playing') {
            this.addShip(playerId);
            this.addTransient(this.makeGlowText(this.playerName(playerId) + ' JOINED THE SWEEP', 50, 12, 1.8, [57, 255, 20, 255]), 2 * TICK_RATE);
        }
        this.getViewRoot().node.onStateChange();
    }

    handlePlayerDisconnect(playerId) {
        delete this.players[playerId];
        const ship = this.ships[playerId];
        if (ship) {
            this.worldBase.removeChild(ship.node.id, false);
            this.worldBase.removeChild(ship.label.id, false);
            delete this.ships[playerId];
        }
        this.removeCamera(playerId);

        if (Object.keys(this.players).length === 0) {
            this.showLobby();
        } else if (this.phase !== 'lobby') {
            this.buildHud();
        }
        this.getViewRoot().node.onStateChange();
    }
}

module.exports = StarSweeper;
