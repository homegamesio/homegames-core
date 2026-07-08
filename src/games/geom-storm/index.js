const { Game, GameNode, Shapes, ShapeUtils } = require('squish-142');

// GEOM STORM — a Geometry Wars-style arena shooter, built deliberately as a
// polygon stress test: every enemy death sprays particles and drops magnetic
// geoms, and everything on screen is a live squish node rebuilt per tick.
// The HUD shows the live node count and effective tick rate so the pipeline's
// breaking point is visible in-game.
//
// Controls: WASD move, arrow keys fire (hold combinations for diagonals).
// Touch/mouse: hold to steer toward the pointer; the ship auto-fires at the
// nearest enemy when no fire keys are held.

const TICK_RATE = 30;

const ARENA = { minX: 1.5, maxX: 98.5, minY: 7, maxY: 98 };

// Deep violet-black space, hot neon everything — every enemy type gets its
// own neon, Geometry Wars style.
const BG = [8, 6, 18, 255];
const GRID = [36, 26, 70, 255];
const WALL = [120, 60, 255, 255];
const SHIP_COLOR = [255, 40, 190, 255];
const BULLET_COLOR = [255, 245, 160, 255];
const GEOM_COLOR = [80, 255, 120, 255];
const INK = [240, 236, 255, 255];
const GOLD = [255, 210, 80, 255];
const DIM = [150, 140, 190, 255];
const GRID_HOT = [150, 100, 255, 255];
const EXHAUST = [255, 120, 70, 255];
const STAR_DIM = [70, 60, 120, 255];
const STAR_BRIGHT = [150, 140, 210, 255];
const TRAIL_1 = [210, 190, 100, 255];
const TRAIL_2 = [120, 100, 55, 255];
const BOMB_COLOR = [255, 90, 60, 255];

const ENEMY_TYPES = {
    wanderer: { color: [0, 230, 255, 255], size: 2.2, speed: 0.19, hp: 1, score: 25 },
    seeker: { color: [255, 140, 0, 255], size: 2.0, speed: 0.37, hp: 1, score: 50 },
    pinwheel: { color: [200, 80, 255, 255], size: 2.6, speed: 0.23, hp: 1, score: 40 },
    splitter: { color: [60, 255, 60, 255], size: 2.8, speed: 0.27, hp: 2, score: 75 },
    mini: { color: [160, 255, 100, 255], size: 1.3, speed: 0.57, hp: 1, score: 15 },
};

const TEXT_H = 16 / 9; // aspect factor so text y-sizes read right

const glow = (color, blur) => ({ shadow: { color: [color[0], color[1], color[2], 255], blur } });

// n-gon / rotated polygon as a closed coordinates2d ring. Y distances are
// scaled by the aspect factor so shapes read round, not squashed.
const ngon = (cx, cy, radius, sides, angle) => {
    const pts = [];
    for (let i = 0; i < sides; i++) {
        const a = angle + (i * 2 * Math.PI) / sides;
        pts.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a) * TEXT_H]);
    }
    pts.push([pts[0][0], pts[0][1]]);
    return pts;
};

const shape = (coordinates2d, fill, effects) => new GameNode.Shape({
    shapeType: Shapes.POLYGON,
    coordinates2d,
    fill,
    effects,
});

const text = (x, y, size, message, color, align) => new GameNode.Text({
    textInfo: { x, y, text: message, size, color, align: align || 'left', font: 'monospace' },
});

class GeomStorm extends Game {
    static metadata() {
        return {
            aspectRatio: { x: 16, y: 9 },
            squishVersion: '142',
            author: 'Joseph Garcia',
            name: 'Geom Storm',
            description: 'A neon arena shooter built to melt renderers: swarms, particle bursts, and magnetic geoms — the HUD counts the polygons so you can watch it strain.',
            tickRate: TICK_RATE,
        };
    }

    constructor() {
        super();

        this.root = shape(ShapeUtils.rectangle(0, 0, 0, 0), [0, 0, 0, 0]);

        // Static backdrop: arena, grid, walls — built once.
        const bg = shape(ShapeUtils.rectangle(0, 0, 100, 100), BG);
        // grid lines are kept by position so explosion shockwaves can ripple
        // through them (mutating fills each tick — free wire load, big flash)
        this.gridLines = [];
        for (let x = 10; x < 100; x += 10) {
            const line = shape([[x, ARENA.minY], [x + 0.22, ARENA.minY], [x + 0.22, ARENA.maxY], [x, ARENA.maxY], [x, ARENA.minY]], GRID.slice());
            this.gridLines.push({ node: line, axis: 'x', pos: x });
            bg.addChild(line, false);
        }
        for (let y = 15; y < 98; y += 10) {
            const line = shape([[ARENA.minX, y], [ARENA.maxX, y], [ARENA.maxX, y + 0.35], [ARENA.minX, y + 0.35], [ARENA.minX, y]], GRID.slice());
            this.gridLines.push({ node: line, axis: 'y', pos: y });
            bg.addChild(line, false);
        }
        const wallGlow = glow(WALL, 12);
        bg.addChild(shape(ShapeUtils.rectangle(ARENA.minX - 0.6, ARENA.minY - 1, ARENA.maxX - ARENA.minX + 1.2, 0.7), WALL, wallGlow), false);
        bg.addChild(shape(ShapeUtils.rectangle(ARENA.minX - 0.6, ARENA.maxY + 0.3, ARENA.maxX - ARENA.minX + 1.2, 0.7), WALL, wallGlow), false);
        bg.addChild(shape(ShapeUtils.rectangle(ARENA.minX - 0.6, ARENA.minY - 1, 0.4, ARENA.maxY - ARENA.minY + 2), WALL, wallGlow), false);
        bg.addChild(shape(ShapeUtils.rectangle(ARENA.maxX + 0.2, ARENA.minY - 1, 0.4, ARENA.maxY - ARENA.minY + 2), WALL, wallGlow), false);

        // Dynamic layer — rebuilt every tick.
        this.dynamicRoot = shape(ShapeUtils.rectangle(0, 0, 0, 0), [0, 0, 0, 0]);

        // Full-screen tap catcher ABOVE the playfield (topmost containing node
        // wins the hit-test) — steers the ship on touch/mouse hold.
        this.tapCatcher = shape(ShapeUtils.rectangle(0, 0, 100, 100), [0, 0, 0, 0]);
        this.tapCatcher.node.handleClick = (playerId, x, y) => this.handleTap(x, y);

        // HUD — mutated in place, drawn on top (Text nodes aren't clickable,
        // so they can safely sit above the tap catcher).
        this.hudScore = text(2, 1.5, 1.7, 'SCORE 0', INK);
        this.hudMulti = text(2, 4.2, 1.3, '', GEOM_COLOR);
        this.hudLives = text(50, 1.5, 1.7, '', SHIP_COLOR, 'center');
        this.hudStress = text(98, 1.5, 1.3, '', DIM, 'right');
        this.hudStress2 = text(98, 4.2, 1.3, '', DIM, 'right');
        const hudRoot = shape(ShapeUtils.rectangle(0, 0, 0, 0), [0, 0, 0, 0]);
        hudRoot.addChildren(this.hudScore, this.hudMulti, this.hudLives, this.hudStress, this.hudStress2);

        this.root.addChildren(bg, this.dynamicRoot, this.tapCatcher, hudRoot);

        // Drifting starfield — pure baseline node load, rebuilt every tick
        // like everything else.
        this.stars = [];
        for (let i = 0; i < 70; i++) {
            this.stars.push({
                x: ARENA.minX + 1 + Math.random() * (ARENA.maxX - ARENA.minX - 2),
                y: ARENA.minY + 1 + Math.random() * (ARENA.maxY - ARENA.minY - 2),
                phase: Math.floor(Math.random() * 60),
                drift: 0.008 + Math.random() * 0.022,
            });
        }

        this.keysDown = {};
        this._tickTimes = [];
        this._lastTickAt = null;
        this.resetGame();
    }

    resetGame() {
        this.playing = false;
        this.gameOver = false;
        this.score = 0;
        this.multiplier = 1;
        this.lives = 3;
        this.elapsed = 0;
        this.invulnTicks = 0;
        this.fireCooldown = 0;
        this.spawnCooldown = 45;
        this.moveTarget = null;
        this.ship = { x: 50, y: 55, vx: 0, vy: 0, angle: -Math.PI / 2 };
        this.enemies = [];
        this.bullets = [];
        this.geoms = [];
        this.particles = [];
        this.rings = [];
        this.pulses = [];
        this.popups = [];
        this.pickups = [];
        this.bombs = 2;
        this.spreadTicks = 0;
        // Ambient drifters so the title screen already has motion
        for (let i = 0; i < 8; i++) this.spawnEnemy('wanderer');
    }

    startGame() {
        this.resetGame();
        this.playing = true;
        this.enemies = [];
        this.spawnCooldown = 30;
    }

    // --- Input ---

    handleNewPlayer() {}
    handlePlayerDisconnect() { this.keysDown = {}; }

    handleKeyDown(playerId, key) {
        if (key === ' ' && !this.keysDown[key] && this.playing) this.useBomb();
        this.keysDown[key] = true;
        if (!this.playing) this.startGame();
    }

    useBomb() {
        if (this.bombs <= 0 || this.enemies.length === 0) return;
        this.bombs--;

        // no score, no geoms — a panic button, and the biggest flash event
        // in the game: every enemy erupts, five rings, grid-wide shockwaves
        for (const e of this.enemies) {
            this.burst(e.x, e.y, ENEMY_TYPES[e.type].color, 12);
        }
        this.enemies = [];

        const ringColors = [BOMB_COLOR, GOLD, SHIP_COLOR, WALL, BULLET_COLOR];
        ringColors.forEach((color, i) => {
            this.rings.push({ x: this.ship.x, y: this.ship.y, r: 1 + i * 2.5, vr: 2.2, life: 20, color });
        });
        this.pulses = [];
        this.addPulse(this.ship.x, this.ship.y);
        this.addPulse(25, 30); this.addPulse(75, 30);
        this.addPulse(25, 75); this.addPulse(75, 75);
        this.addPopup(this.ship.x, this.ship.y - 5, 'BOMB!', BOMB_COLOR);
        this.spawnCooldown = Math.max(this.spawnCooldown, 40);
    }

    handleKeyUp(playerId, key) {
        this.keysDown[key] = false;
    }

    handleTap(x, y) {
        if (!this.playing) { this.startGame(); return; }
        this.moveTarget = { x, y };
    }

    // --- Spawning ---

    spawnEnemy(type, atX, atY) {
        const def = ENEMY_TYPES[type];
        let x = atX, y = atY;
        if (x === undefined) {
            // spawn on an edge, away from the ship
            do {
                const edge = Math.floor(Math.random() * 4);
                x = edge < 2 ? (edge === 0 ? ARENA.minX + 2 : ARENA.maxX - 2) : ARENA.minX + Math.random() * (ARENA.maxX - ARENA.minX);
                y = edge >= 2 ? (edge === 2 ? ARENA.minY + 2 : ARENA.maxY - 2) : ARENA.minY + Math.random() * (ARENA.maxY - ARENA.minY);
            } while (this.playing && Math.abs(x - this.ship.x) < 26 && Math.abs(y - this.ship.y) < 26);
        }
        const a = Math.random() * Math.PI * 2;
        this.enemies.push({
            type, x, y, hp: def.hp,
            vx: Math.cos(a) * def.speed, vy: Math.sin(a) * def.speed,
            spin: Math.random() * Math.PI * 2,
            age: 0,
            // spawn telegraph: inert + blinking, harmless to touch, but
            // shootable — fair warning AND extra flash
            warmup: this.playing ? 24 : 0,
        });
    }

    runSpawns() {
        this.spawnCooldown--;
        if (this.spawnCooldown > 0) return;

        // Difficulty ramps with time: bigger batches, shorter gaps.
        const intensity = 1 + Math.floor(this.elapsed / 450);
        this.spawnCooldown = Math.max(18, 52 - intensity * 3);

        const roll = Math.random();
        if (roll < 0.14 && this.elapsed > 900) {
            // swarm burst — the stress moment
            for (let i = 0; i < 14 + intensity * 3; i++) this.spawnEnemy('wanderer');
        } else {
            const types = ['wanderer', 'wanderer', 'wanderer', 'seeker'];
            if (this.elapsed > 450) types.push('pinwheel');
            if (this.elapsed > 800) types.push('splitter', 'seeker');
            for (let i = 0; i < Math.min(1 + intensity, 10); i++) {
                this.spawnEnemy(types[Math.floor(Math.random() * types.length)]);
            }
        }
    }

    // --- Deaths ---

    burst(x, y, color, count, force) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const speed = (0.4 + Math.random() * 1.1) * (force || 1);
            this.particles.push({
                x, y,
                vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
                life: 11 + Math.floor(Math.random() * 10),
                color,
            });
        }
    }

    addRing(x, y, color, big) {
        this.rings.push({ x, y, r: big ? 2 : 1.2, vr: big ? 1.7 : 1.1, life: big ? 16 : 12, color });
    }

    addPulse(x, y) {
        if (this.pulses.length < 6) this.pulses.push({ x, y, r: 0, life: 26 });
    }

    addPopup(x, y, message, color) {
        this.popups.push({ x: Math.max(6, Math.min(94, x)), y: Math.max(ARENA.minY + 3, y), text: message, color, life: 22 });
        if (this.popups.length > 12) this.popups.shift();
    }

    collectGeom() {
        this.multiplier++;
        if ([10, 25, 50, 100, 200].includes(this.multiplier)) {
            this.addPopup(this.ship.x, this.ship.y - 4, 'x' + this.multiplier + '!', GOLD);
            this.addRing(this.ship.x, this.ship.y, GOLD, true);
            this.addPulse(this.ship.x, this.ship.y);
        }
    }

    killEnemy(enemy, index) {
        const def = ENEMY_TYPES[enemy.type];
        this.enemies.splice(index, 1);
        const points = def.score * this.multiplier;
        this.score += points;
        this.burst(enemy.x, enemy.y, def.color, 16);
        this.addRing(enemy.x, enemy.y, def.color, false);
        if (enemy.type !== 'mini') this.addPulse(enemy.x, enemy.y);
        this.addPopup(enemy.x, enemy.y - 2, '+' + points, def.color);

        if (enemy.type === 'splitter') {
            this.spawnEnemy('mini', enemy.x - 1.5, enemy.y);
            this.spawnEnemy('mini', enemy.x + 1.5, enemy.y);
        }

        if (Math.random() < 0.05 && this.pickups.length < 3) {
            this.pickups.push({
                type: Math.random() < 0.6 ? 'spread' : 'bomb',
                x: enemy.x, y: enemy.y,
                life: 360,
            });
        }

        const drops = enemy.type === 'mini' ? 2 : 4 + Math.floor(Math.random() * 4);
        for (let i = 0; i < drops; i++) {
            const a = Math.random() * Math.PI * 2;
            this.geoms.push({
                x: enemy.x, y: enemy.y,
                vx: Math.cos(a) * 0.5, vy: Math.sin(a) * 0.5,
                life: 200,
            });
        }
    }

    killShip() {
        // Full-board clear, Geometry Wars style: every enemy erupts at once —
        // the single heaviest frame the game produces, on purpose.
        this.burst(this.ship.x, this.ship.y, SHIP_COLOR, 90, 1.8);
        this.addRing(this.ship.x, this.ship.y, SHIP_COLOR, true);
        this.addRing(this.ship.x, this.ship.y, WALL, true);
        this.addRing(this.ship.x, this.ship.y, BULLET_COLOR, true);
        this.addPulse(this.ship.x, this.ship.y);
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            this.burst(e.x, e.y, ENEMY_TYPES[e.type].color, 12);
        }
        this.enemies = [];
        this.multiplier = 1;
        this.lives--;
        if (this.lives <= 0) {
            this.playing = false;
            this.gameOver = true;
        } else {
            this.ship.x = 50; this.ship.y = 55; this.ship.vx = 0; this.ship.vy = 0;
            this.invulnTicks = 90;
            this.moveTarget = null;
            this.spawnCooldown = 52;
        }
    }

    // --- Tick ---

    tick() {
        const now = Date.now();
        if (this._lastTickAt) {
            this._tickTimes.push(now - this._lastTickAt);
            if (this._tickTimes.length > 20) this._tickTimes.shift();
        }
        this._lastTickAt = now;

        this.elapsed++;

        if (this.playing) {
            this.runSpawns();
            this.moveShip();
            this.fire();
        } else {
            // ambient drift on the title screen
            if (this.enemies.length < 8 && this.elapsed % 60 === 0) this.spawnEnemy('wanderer');
        }

        this.moveEnemies();
        this.moveBullets();
        this.moveGeoms();
        this.moveParticles();
        this.updateEffects();
        if (this.playing) this.checkShipCollisions();

        this.render();
    }

    moveShip() {
        const s = this.ship;
        let ax = 0, ay = 0;
        if (this.keysDown['w'] || this.keysDown['W']) ay -= 1;
        if (this.keysDown['s'] || this.keysDown['S']) ay += 1;
        if (this.keysDown['a'] || this.keysDown['A']) ax -= 1;
        if (this.keysDown['d'] || this.keysDown['D']) ax += 1;

        if (ax === 0 && ay === 0 && this.moveTarget) {
            const dx = this.moveTarget.x - s.x;
            const dy = this.moveTarget.y - s.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > 2) { ax = dx / d; ay = dy / d; } else { this.moveTarget = null; }
        }

        s.vx = (s.vx + ax * 0.23) * 0.89;
        s.vy = (s.vy + ay * 0.23) * 0.89;
        s.x = Math.max(ARENA.minX + 1.2, Math.min(ARENA.maxX - 1.2, s.x + s.vx));
        s.y = Math.max(ARENA.minY + 2, Math.min(ARENA.maxY - 2, s.y + s.vy));
        if (Math.abs(s.vx) + Math.abs(s.vy) > 0.12) {
            s.angle = Math.atan2(s.vy, s.vx);
            // engine exhaust — constant sparkle behind a moving ship
            for (let i = 0; i < 2; i++) {
                this.particles.push({
                    x: s.x - Math.cos(s.angle) * 1.4 + (Math.random() - 0.5) * 0.6,
                    y: s.y - Math.sin(s.angle) * 1.4 * TEXT_H + (Math.random() - 0.5) * 0.6,
                    vx: -Math.cos(s.angle) * 0.5 + (Math.random() - 0.5) * 0.25,
                    vy: -Math.sin(s.angle) * 0.5 + (Math.random() - 0.5) * 0.25,
                    life: 5 + Math.floor(Math.random() * 5),
                    color: Math.random() < 0.5 ? EXHAUST : SHIP_COLOR,
                });
            }
        }
        if (this.invulnTicks > 0) this.invulnTicks--;
    }

    fire() {
        if (this.fireCooldown > 0) { this.fireCooldown--; return; }

        let fx = 0, fy = 0;
        if (this.keysDown['ArrowUp']) fy -= 1;
        if (this.keysDown['ArrowDown']) fy += 1;
        if (this.keysDown['ArrowLeft']) fx -= 1;
        if (this.keysDown['ArrowRight']) fx += 1;

        let auto = false;
        if (fx === 0 && fy === 0) {
            // no fire keys: auto-aim at the nearest enemy (touch-friendly)
            let best = null, bestD = 55;
            for (const e of this.enemies) {
                const d = Math.abs(e.x - this.ship.x) + Math.abs(e.y - this.ship.y);
                if (d < bestD) { bestD = d; best = e; }
            }
            if (!best) return;
            fx = best.x - this.ship.x; fy = best.y - this.ship.y;
            auto = true;
        }

        const base = Math.atan2(fy, fx);
        const pattern = this.spreadTicks > 0
            ? [-0.34, -0.17, 0, 0.17, 0.34]
            : [-0.09, 0, 0.09];
        for (const spread of pattern) {
            const a = base + spread;
            this.bullets.push({
                x: this.ship.x, y: this.ship.y,
                vx: Math.cos(a) * 2.1, vy: Math.sin(a) * 2.1,
            });
        }
        this.fireCooldown = auto ? 6 : 4;
    }

    moveEnemies() {
        const s = this.ship;
        for (const e of this.enemies) {
            const def = ENEMY_TYPES[e.type];
            e.age++;
            e.spin += 0.25;

            if (e.warmup > 0) { e.warmup--; continue; }

            if ((e.type === 'seeker' || e.type === 'mini') && this.playing) {
                const dx = s.x - e.x, dy = s.y - e.y;
                const d = Math.sqrt(dx * dx + dy * dy) || 1;
                e.vx = (dx / d) * def.speed;
                e.vy = (dy / d) * def.speed;
            } else if (e.type === 'pinwheel' && e.age % 45 === 0) {
                const a = Math.random() * Math.PI * 2;
                e.vx = Math.cos(a) * def.speed;
                e.vy = Math.sin(a) * def.speed;
            } else if (e.type === 'splitter' && this.playing) {
                const dx = s.x - e.x, dy = s.y - e.y;
                const d = Math.sqrt(dx * dx + dy * dy) || 1;
                e.vx = (e.vx * 0.97) + (dx / d) * def.speed * 0.05;
                e.vy = (e.vy * 0.97) + (dy / d) * def.speed * 0.05;
            }

            e.x += e.vx; e.y += e.vy;
            if (e.x < ARENA.minX + 1 || e.x > ARENA.maxX - 1) { e.vx *= -1; e.x = Math.max(ARENA.minX + 1, Math.min(ARENA.maxX - 1, e.x)); }
            if (e.y < ARENA.minY + 1.5 || e.y > ARENA.maxY - 1.5) { e.vy *= -1; e.y = Math.max(ARENA.minY + 1.5, Math.min(ARENA.maxY - 1.5, e.y)); }
        }
    }

    moveBullets() {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.x += b.vx; b.y += b.vy;
            if (b.x < ARENA.minX || b.x > ARENA.maxX || b.y < ARENA.minY || b.y > ARENA.maxY) {
                this.bullets.splice(i, 1);
                continue;
            }
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                const e = this.enemies[j];
                const r = ENEMY_TYPES[e.type].size;
                if (Math.abs(e.x - b.x) < r && Math.abs(e.y - b.y) < r * TEXT_H) {
                    this.bullets.splice(i, 1);
                    e.hp--;
                    if (e.hp <= 0) this.killEnemy(e, j);
                    else this.burst(b.x, b.y, ENEMY_TYPES[e.type].color, 3, 0.5);
                    break;
                }
            }
        }
    }

    moveGeoms() {
        const s = this.ship;
        for (let i = this.geoms.length - 1; i >= 0; i--) {
            const g = this.geoms[i];
            g.life--;
            if (g.life <= 0) { this.geoms.splice(i, 1); continue; }

            if (this.playing) {
                const dx = s.x - g.x, dy = s.y - g.y;
                const d = Math.sqrt(dx * dx + dy * dy) || 1;
                if (d < 16) {
                    g.vx = (g.vx + (dx / d) * 0.33) * 0.93;
                    g.vy = (g.vy + (dy / d) * 0.33) * 0.93;
                } else {
                    g.vx *= 0.9; g.vy *= 0.9;
                }
                if (d < 2.2) {
                    this.geoms.splice(i, 1);
                    this.collectGeom();
                    continue;
                }
            } else {
                g.vx *= 0.9; g.vy *= 0.9;
            }
            g.x += g.vx; g.y += g.vy;
        }
    }

    updateEffects() {
        for (let i = this.rings.length - 1; i >= 0; i--) {
            const r = this.rings[i];
            r.r += r.vr;
            r.life--;
            if (r.life <= 0) this.rings.splice(i, 1);
        }
        for (let i = this.popups.length - 1; i >= 0; i--) {
            const p = this.popups[i];
            p.y -= 0.28;
            p.life--;
            if (p.life <= 0) this.popups.splice(i, 1);
        }

        if (this.spreadTicks > 0) this.spreadTicks--;

        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const pk = this.pickups[i];
            pk.life--;
            if (pk.life <= 0) { this.pickups.splice(i, 1); continue; }
            if (!this.playing) continue;
            const dx = pk.x - this.ship.x, dy = pk.y - this.ship.y;
            if (Math.abs(dx) < 2.6 && Math.abs(dy) < 2.6 * TEXT_H) {
                this.pickups.splice(i, 1);
                if (pk.type === 'spread') {
                    this.spreadTicks = 450;
                    this.addPopup(this.ship.x, this.ship.y - 4, 'SPREAD SHOT', BULLET_COLOR);
                } else {
                    this.bombs = Math.min(9, this.bombs + 1);
                    this.addPopup(this.ship.x, this.ship.y - 4, '+BOMB', BOMB_COLOR);
                }
                this.addRing(this.ship.x, this.ship.y, GOLD, true);
            }
        }

        // shockwave pulses ripple through the grid: each expanding pulse
        // lights up grid lines its wavefront is crossing
        for (let i = this.pulses.length - 1; i >= 0; i--) {
            const p = this.pulses[i];
            p.r += 2.4;
            p.life--;
            if (p.life <= 0) this.pulses.splice(i, 1);
        }
        for (const line of this.gridLines) {
            let heat = 0;
            for (const p of this.pulses) {
                const d = Math.abs((line.axis === 'x' ? p.x : p.y) - line.pos);
                const edge = Math.abs(d - p.r);
                if (edge < 8) heat = Math.max(heat, (1 - edge / 8) * (p.life / 26));
            }
            const fill = line.node.node.fill;
            const target = [
                GRID[0] + (GRID_HOT[0] - GRID[0]) * heat,
                GRID[1] + (GRID_HOT[1] - GRID[1]) * heat,
                GRID[2] + (GRID_HOT[2] - GRID[2]) * heat,
            ];
            if (Math.abs(fill[0] - target[0]) > 2 || Math.abs(fill[2] - target[2]) > 2) {
                fill[0] = Math.round(target[0]);
                fill[1] = Math.round(target[1]);
                fill[2] = Math.round(target[2]);
                line.node.node.onStateChange();
            }
        }
    }

    moveParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life--;
            if (p.life <= 0) { this.particles.splice(i, 1); continue; }
            p.x += p.vx; p.y += p.vy;
            p.vx *= 0.95; p.vy *= 0.95;
        }
    }

    checkShipCollisions() {
        if (this.invulnTicks > 0) return;
        const s = this.ship;
        for (const e of this.enemies) {
            if (e.warmup > 0) continue;
            const r = ENEMY_TYPES[e.type].size * 0.7 + 1;
            if (Math.abs(e.x - s.x) < r && Math.abs(e.y - s.y) < r * TEXT_H) {
                this.killShip();
                return;
            }
        }
    }

    // --- Render: rebuild the dynamic layer as one batch per tick ---

    countNodes(node, count) {
        count = (count || 0) + 1;
        for (const child of node.node.children) count = this.countNodes(child, count);
        return count;
    }

    render() {
        const nodes = [];

        for (const st of this.stars) {
            st.y += st.drift;
            if (st.y > ARENA.maxY - 0.6) st.y = ARENA.minY + 0.6;
            const bright = ((this.elapsed + st.phase) % 60) < 30;
            nodes.push(shape(ShapeUtils.rectangle(st.x, st.y, 0.26, 0.26 * TEXT_H), bright ? STAR_BRIGHT : STAR_DIM));
        }

        for (const g of this.geoms) {
            const blink = g.life < 45 && g.life % 6 < 3;
            if (!blink) nodes.push(shape(ngon(g.x, g.y, 0.7, 4, Math.PI / 4), GEOM_COLOR, glow(GEOM_COLOR, 5)));
        }

        for (const pk of this.pickups) {
            const blink = pk.life < 60 && pk.life % 6 < 3;
            if (blink) continue;
            const wobble = Math.sin(this.elapsed * 0.2) * 0.3;
            if (pk.type === 'spread') {
                nodes.push(shape(ngon(pk.x, pk.y + wobble, 1.5, 5, this.elapsed * 0.08), BULLET_COLOR, glow(BULLET_COLOR, 7)));
                nodes.push(shape(ngon(pk.x, pk.y + wobble, 0.7, 5, -this.elapsed * 0.08), [140, 110, 30, 255]));
            } else {
                nodes.push(shape(ngon(pk.x, pk.y + wobble, 1.5, 6, this.elapsed * 0.05), BOMB_COLOR, glow(BOMB_COLOR, 7)));
                nodes.push(shape(ngon(pk.x, pk.y + wobble, 0.7, 6, 0), [120, 30, 20, 255]));
            }
        }

        for (const e of this.enemies) {
            const def = ENEMY_TYPES[e.type];
            if (e.warmup > 0) {
                // telegraph: blinking, growing outline where the enemy will be
                if (e.warmup % 6 < 3) {
                    const t = 1 - e.warmup / 24;
                    nodes.push(shape(ngon(e.x, e.y, def.size * (0.4 + 0.6 * t), 4, e.warmup * 0.1), def.color));
                }
                continue;
            }
            let coords;
            if (e.type === 'wanderer') coords = ngon(e.x, e.y, def.size, 4, e.spin * 0.2);
            else if (e.type === 'seeker') coords = ngon(e.x, e.y, def.size, 3, Math.atan2(this.ship.y - e.y, this.ship.x - e.x));
            else if (e.type === 'pinwheel') coords = ngon(e.x, e.y, def.size, 5, e.spin);
            else if (e.type === 'splitter') coords = ngon(e.x, e.y, def.size, 6, e.spin * 0.1);
            else coords = ngon(e.x, e.y, def.size, 3, e.spin);
            nodes.push(shape(coords, def.color));
        }

        for (const b of this.bullets) {
            // two fading ghost segments trailing each bullet
            nodes.push(shape(ShapeUtils.rectangle(b.x - b.vx * 1.1 - 0.18, b.y - b.vy * 1.1 - 0.18 * TEXT_H, 0.36, 0.36 * TEXT_H), TRAIL_2));
            nodes.push(shape(ShapeUtils.rectangle(b.x - b.vx * 0.55 - 0.24, b.y - b.vy * 0.55 - 0.24 * TEXT_H, 0.48, 0.48 * TEXT_H), TRAIL_1));
            nodes.push(shape(ShapeUtils.rectangle(b.x - 0.3, b.y - 0.3 * TEXT_H, 0.6, 0.6 * TEXT_H), BULLET_COLOR, glow(BULLET_COLOR, 4)));
        }

        for (const p of this.particles) {
            nodes.push(shape(ShapeUtils.rectangle(p.x - 0.26, p.y - 0.26, 0.52, 0.52), p.color));
        }

        // explosion rings: 14 segments each, expanding outward
        for (const r of this.rings) {
            for (let i = 0; i < 14; i++) {
                const a = (i / 14) * Math.PI * 2 + r.r * 0.06;
                nodes.push(shape(ShapeUtils.rectangle(
                    r.x + r.r * Math.cos(a) - 0.24,
                    r.y + r.r * Math.sin(a) * TEXT_H - 0.24 * TEXT_H,
                    0.48, 0.48 * TEXT_H
                ), r.color));
            }
        }

        for (const p of this.popups) {
            nodes.push(text(p.x, p.y, 1.25, p.text, p.color, 'center'));
        }

        if (this.playing && !(this.invulnTicks > 0 && this.elapsed % 4 < 2)) {
            const s = this.ship;
            nodes.push(shape([
                [s.x + 1.7 * Math.cos(s.angle), s.y + 1.7 * Math.sin(s.angle) * TEXT_H],
                [s.x + 1.4 * Math.cos(s.angle + 2.5), s.y + 1.4 * Math.sin(s.angle + 2.5) * TEXT_H],
                [s.x + 0.5 * Math.cos(s.angle + Math.PI), s.y + 0.5 * Math.sin(s.angle + Math.PI) * TEXT_H],
                [s.x + 1.4 * Math.cos(s.angle - 2.5), s.y + 1.4 * Math.sin(s.angle - 2.5) * TEXT_H],
                [s.x + 1.7 * Math.cos(s.angle), s.y + 1.7 * Math.sin(s.angle) * TEXT_H],
            ], SHIP_COLOR, glow(SHIP_COLOR, 8)));
        }

        if (!this.playing) {
            nodes.push(shape(ShapeUtils.rectangle(24, 30, 52, 34), [8, 6, 18, 235], glow(WALL, 10)));
            nodes.push(text(50, 34, 5, 'GEOM STORM', SHIP_COLOR, 'center'));
            if (this.gameOver) {
                nodes.push(text(50, 45, 2.2, `FINAL SCORE ${this.score}`, GOLD, 'center'));
                nodes.push(text(50, 51, 1.6, 'ANY KEY / TAP TO GO AGAIN', INK, 'center'));
            } else {
                nodes.push(text(50, 45, 1.6, 'WASD MOVE — ARROWS FIRE — SPACE BOMBS — OR HOLD TO STEER', INK, 'center'));
                nodes.push(text(50, 50, 1.6, 'GRAB GEOMS TO GROW YOUR MULTIPLIER', GEOM_COLOR, 'center'));
                nodes.push(text(50, 56, 1.8, 'ANY KEY / TAP TO START', GOLD, 'center'));
            }
        }

        this.dynamicRoot.clearChildren();
        if (nodes.length) this.dynamicRoot.addChildren(...nodes);

        // HUD — mutate in place
        this.hudScore.node.text.text = `SCORE ${this.score}`;
        let multiLine = this.multiplier > 1 ? `x${this.multiplier}` : '';
        if (this.spreadTicks > 0) multiLine += `${multiLine ? ' · ' : ''}SPREAD ${Math.ceil(this.spreadTicks / TICK_RATE)}s`;
        this.hudMulti.node.text.text = multiLine;
        const bombStr = this.bombs > 0 ? '  ' + '◆'.repeat(this.bombs) : '';
        this.hudLives.node.text.text = this.playing || this.gameOver ? ('▲ '.repeat(Math.max(0, this.lives)).trim() + bombStr) : '';

        const avg = this._tickTimes.length
            ? this._tickTimes.reduce((a, b) => a + b, 0) / this._tickTimes.length
            : 1000 / TICK_RATE;
        const effHz = Math.min(TICK_RATE, 1000 / avg);
        this.hudStress.node.text.text = `${this.countNodes(this.root)} NODES`;
        this.hudStress2.node.text.text = `TICK ${effHz.toFixed(1)}/${TICK_RATE}`;
        this.hudScore.node.onStateChange();
        this.hudMulti.node.onStateChange();
        this.hudLives.node.onStateChange();
        this.hudStress.node.onStateChange();
        this.hudStress2.node.onStateChange();
    }

    getLayers() {
        return [{ root: this.root }];
    }
}

module.exports = GeomStorm;
