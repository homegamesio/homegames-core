const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-140');
const { COLORS } = Colors;

// ---------------------------------------------------------------------------
// Singularity — a no-assets multiplayer space deathmatch fought around a black
// hole at the center of the arena. Gravity pulls your ship AND your bullets, so
// shots curve: you bank fire around the well and slingshot kills. Fly into the
// core and you die; so do drifting asteroids. Last thing standing racks up the
// score. Everything is drawn from polygons + text — no images, no audio.
//
// Controls: A / D (or ← / →) rotate · W (or ↑) thrust · Space fires.
// Keyboard-driven (it's a twin-stick-style shooter); best on desktop.
// ---------------------------------------------------------------------------

// Arena is the standard 0–100 plane, presented square so geometry isn't stretched.
const CENTER = { x: 50, y: 50 };

// Gravity well
const CORE_R = 3.5;            // touch this and you die
const GRAV = 9;                // pull strength: accel = GRAV / dist^2
const MIN_GRAV_DIST = 7;       // clamp distance so the pull near the core stays sane

// Ships
const SHIP_SIZE = 2.4;
const TURN_RATE = 0.085;       // radians per tick while turning
const THRUST = 0.05;           // velocity added per tick while thrusting
const SHIP_DRAG = 0.992;       // mild damping so control is possible
const MAX_SPEED = 1.1;
const RESPAWN_TICKS = 150;     // 2.5s at 60fps
const INVULN_TICKS = 90;       // spawn protection (ship blinks)

// Bullets
const BULLET_SPEED = 0.85;
const BULLET_LIFE = 150;
const FIRE_COOLDOWN = 16;
const BULLET_SIZE = 0.9;

// Asteroids
const ASTEROID_COUNT = 4;

const TAU = Math.PI * 2;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// Vertices of a regular polygon — used for the well rings and asteroids.
const polyCircle = (cx, cy, r, sides, jitter = 0, seed = 0) => {
    const pts = [];
    for (let i = 0; i <= sides; i++) {
        const a = (i / sides) * TAU;
        // deterministic per-vertex wobble for lumpy asteroids
        const rr = r * (1 + (jitter ? jitter * Math.sin(seed + i * 1.7) : 0));
        pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    return pts;
};

class Singularity extends Game {
    static metadata() {
        return {
            squishVersion: '140',
            name: 'Singularity',
            author: 'Claude',
            description: 'Space deathmatch around a black hole — gravity bends your ship and your shots.',
            aspectRatio: { x: 1, y: 1 },
            tickRate: 60,
        };
    }

    constructor() {
        super();
        this._t = 0;
        this.players = {};     // playerId -> ship state
        this.bullets = [];     // { node, x, y, vx, vy, owner, life }
        this.asteroids = [];   // { node, x, y, vx, vy, r, sides, seed }

        // Deep-space backdrop.
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [8, 8, 16, 255],
        });

        // Static starfield (cheap ambiance). Deterministic positions.
        for (let i = 0; i < 36; i++) {
            const sx = (i * 37.6) % 100;
            const sy = (i * 61.3) % 100;
            const s = 0.3 + (i % 3) * 0.15;
            this.base.addChild(new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(sx, sy, s, s),
                fill: [200, 200, 230, 120 + (i % 4) * 30],
            }));
        }

        // The well: an accretion ring + event horizon + black core. The ring
        // pulses in tick() for a bit of life.
        this.ringNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: polyCircle(CENTER.x, CENTER.y, CORE_R * 2.6, 24),
            fill: [90, 40, 130, 90],
        });
        this.horizonNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: polyCircle(CENTER.x, CENTER.y, CORE_R * 1.7, 24),
            fill: [60, 90, 200, 130],
        });
        this.coreNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: polyCircle(CENTER.x, CENTER.y, CORE_R, 24),
            fill: [0, 0, 0, 255],
        });
        this.base.addChildren(this.ringNode, this.horizonNode, this.coreNode);

        // Containers (kept above the well so ships/shots draw on top).
        this.entityLayer = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0) });
        this.shipLayer = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0) });
        this.scoreboard = new GameNode.Shape({ shapeType: Shapes.POLYGON, coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0) });
        this.base.addChildren(this.entityLayer, this.shipLayer, this.scoreboard);

        // Title / controls.
        this.base.addChild(new GameNode.Text({
            textInfo: { text: 'SINGULARITY', x: 50, y: 3, size: 2.2, align: 'center', color: [150, 130, 220, 255] },
        }));
        this.hint = new GameNode.Text({
            textInfo: { text: 'A/D or ←/→ turn · W/↑ thrust · Space fire', x: 50, y: 96.5, size: 1.1, align: 'center', color: [120, 120, 150, 255] },
        });
        this.base.addChild(this.hint);

        for (let i = 0; i < ASTEROID_COUNT; i++) this.spawnAsteroid();
    }

    getLayers() {
        return [{ root: this.base }];
    }

    // --- player lifecycle ---------------------------------------------------

    handleNewPlayer({ playerId, info }) {
        // randomColor excludes by color NAME, not value — keep ships off the dark backdrop.
        const color = Colors.randomColor(['BLACK', 'ALMOST_BLACK', 'HG_BLACK', 'CHARCOAL', 'WHITE']);
        const p = {
            id: playerId,
            name: (info && info.name) || ('Pilot ' + playerId),
            color,
            keys: {},
            score: 0,
            fireReady: 0,
            alive: false,
            respawnAt: this._t + 30,   // brief delay before first spawn
            x: 50, y: 50, vx: 0, vy: 0, angle: 0,
            node: new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.triangle(0, 0, 0, 0, 0, 0),
                fill: [0, 0, 0, 0],
            }),
            nameNode: new GameNode.Text({
                textInfo: { text: '', x: 50, y: 50, size: 1, align: 'center', color },
            }),
        };
        this.players[playerId] = p;
        this.shipLayer.addChildren(p.node, p.nameNode);
        this.renderScoreboard();
    }

    handlePlayerDisconnect(playerId) {
        const p = this.players[playerId];
        if (!p) return;
        this.shipLayer.removeChild(p.node.id);
        this.shipLayer.removeChild(p.nameNode.id);
        delete this.players[playerId];
        this.renderScoreboard();
    }

    handleKeyDown(playerId, key) {
        const p = this.players[playerId];
        if (p) p.keys[key] = true;
    }

    handleKeyUp(playerId, key) {
        const p = this.players[playerId];
        if (p) p.keys[key] = false;
    }

    // --- spawning -----------------------------------------------------------

    respawn(p) {
        const a = (this._t * 0.7 + p.id) % TAU;     // varied spawn angle
        const r = 30;
        p.x = CENTER.x + Math.cos(a) * r;
        p.y = CENTER.y + Math.sin(a) * r;
        // tangential velocity → a natural orbit to start
        p.vx = -Math.sin(a) * 0.28;
        p.vy = Math.cos(a) * 0.28;
        p.angle = a + Math.PI / 2;
        p.alive = true;
        p.invulnUntil = this._t + INVULN_TICKS;
    }

    spawnAsteroid() {
        const a = (this._t * 1.3 + this.asteroids.length * 2.1) % TAU;
        const r = 42 + (this.asteroids.length % 3) * 4;
        const x = CENTER.x + Math.cos(a) * r;
        const y = CENTER.y + Math.sin(a) * r;
        this.addAsteroid(x, y, 3.5 + Math.random() * 2, -Math.sin(a) * 0.12, Math.cos(a) * 0.12);
    }

    addAsteroid(x, y, radius, vx, vy) {
        const seed = (x * 13.1 + y * 7.7) % TAU;
        const sides = 9;
        const ast = {
            x, y, vx, vy, r: radius, sides, seed,
            node: new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: polyCircle(x, y, radius, sides, 0.28, seed),
                fill: [110, 100, 90, 255],
            }),
        };
        this.asteroids.push(ast);
        this.entityLayer.addChild(ast.node);
    }

    fire(p) {
        const tipX = p.x + Math.cos(p.angle) * SHIP_SIZE;
        const tipY = p.y + Math.sin(p.angle) * SHIP_SIZE;
        const b = {
            x: tipX, y: tipY,
            vx: Math.cos(p.angle) * BULLET_SPEED + p.vx,
            vy: Math.sin(p.angle) * BULLET_SPEED + p.vy,
            owner: p.id,
            life: BULLET_LIFE,
            node: new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(tipX, tipY, BULLET_SIZE, BULLET_SIZE),
                fill: p.color,
            }),
        };
        this.bullets.push(b);
        this.entityLayer.addChild(b.node);
    }

    // pull toward the center; returns the new velocity components
    applyGravity(x, y, vx, vy) {
        const dx = CENTER.x - x;
        const dy = CENTER.y - y;
        const d = Math.max(Math.hypot(dx, dy), MIN_GRAV_DIST);
        const a = GRAV / (d * d);
        return [vx + (dx / d) * a, vy + (dy / d) * a];
    }

    // --- main loop ----------------------------------------------------------

    tick() {
        this._t++;
        const t = this._t;

        // Pulse the accretion ring.
        const pulse = CORE_R * (2.5 + 0.18 * Math.sin(t * 0.08));
        this.ringNode.node.coordinates2d = polyCircle(CENTER.x, CENTER.y, pulse, 24);

        // --- ships ---
        for (const id in this.players) {
            const p = this.players[id];

            if (!p.alive) {
                if (t >= p.respawnAt) this.respawn(p);
                else { p.node.node.fill = [0, 0, 0, 0]; p.nameNode.node.text = { text: '', x: 0, y: 0, size: 1, align: 'center', color: p.color }; continue; }
            }

            // rotation
            if (p.keys['a'] || p.keys['ArrowLeft']) p.angle -= TURN_RATE;
            if (p.keys['d'] || p.keys['ArrowRight']) p.angle += TURN_RATE;

            // thrust
            if (p.keys['w'] || p.keys['ArrowUp']) {
                p.vx += Math.cos(p.angle) * THRUST;
                p.vy += Math.sin(p.angle) * THRUST;
            }

            // fire (auto while held, on cooldown)
            if ((p.keys[' '] || p.keys['Spacebar'] || p.keys['Space']) && t >= p.fireReady) {
                this.fire(p);
                p.fireReady = t + FIRE_COOLDOWN;
            }

            // gravity + integrate
            [p.vx, p.vy] = this.applyGravity(p.x, p.y, p.vx, p.vy);
            p.vx *= SHIP_DRAG; p.vy *= SHIP_DRAG;
            const sp = Math.hypot(p.vx, p.vy);
            if (sp > MAX_SPEED) { p.vx = (p.vx / sp) * MAX_SPEED; p.vy = (p.vy / sp) * MAX_SPEED; }
            p.x += p.vx; p.y += p.vy;

            // bounce off the arena walls (kept dampened so the action stays central)
            if (p.x < 1) { p.x = 1; p.vx = Math.abs(p.vx) * 0.6; }
            if (p.x > 99) { p.x = 99; p.vx = -Math.abs(p.vx) * 0.6; }
            if (p.y < 1) { p.y = 1; p.vy = Math.abs(p.vy) * 0.6; }
            if (p.y > 99) { p.y = 99; p.vy = -Math.abs(p.vy) * 0.6; }

            const invuln = t < p.invulnUntil;

            // death by core
            if (!invuln && dist(p.x, p.y, CENTER.x, CENTER.y) < CORE_R + SHIP_SIZE * 0.4) {
                this.kill(p, null);
                continue;
            }

            // render ship (blink during invulnerability)
            const blink = invuln && (Math.floor(t / 6) % 2 === 0);
            p.node.node.coordinates2d = this.shipVerts(p.x, p.y, p.angle);
            p.node.node.fill = blink ? [255, 255, 255, 120] : p.color;
            p.nameNode.node.text = { text: p.name, x: p.x, y: p.y - SHIP_SIZE - 1.6, size: 0.9, align: 'center', color: p.color };
        }

        // --- asteroids ---
        for (let i = this.asteroids.length - 1; i >= 0; i--) {
            const ast = this.asteroids[i];
            [ast.vx, ast.vy] = this.applyGravity(ast.x, ast.y, ast.vx, ast.vy);
            ast.x += ast.vx; ast.y += ast.vy;

            // consumed by the core → respawn a fresh one
            if (dist(ast.x, ast.y, CENTER.x, CENTER.y) < CORE_R) {
                this.entityLayer.removeChild(ast.node.id);
                this.asteroids.splice(i, 1);
                this.spawnAsteroid();
                continue;
            }
            // drift off the edge → wrap
            if (ast.x < -8) ast.x = 108; if (ast.x > 108) ast.x = -8;
            if (ast.y < -8) ast.y = 108; if (ast.y > 108) ast.y = -8;

            ast.node.node.coordinates2d = polyCircle(ast.x, ast.y, ast.r, ast.sides, 0.28, ast.seed + t * 0.01);

            // asteroid vs ship
            for (const id in this.players) {
                const p = this.players[id];
                if (p.alive && t >= p.invulnUntil && dist(p.x, p.y, ast.x, ast.y) < ast.r + SHIP_SIZE * 0.5) {
                    this.kill(p, null);
                }
            }
        }

        // --- bullets ---
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            [b.vx, b.vy] = this.applyGravity(b.x, b.y, b.vx, b.vy);
            b.x += b.vx; b.y += b.vy;
            b.life--;

            let dead = b.life <= 0
                || dist(b.x, b.y, CENTER.x, CENTER.y) < CORE_R     // swallowed by the hole
                || b.x < 0 || b.x > 100 || b.y < 0 || b.y > 100;

            // bullet vs ships
            if (!dead) {
                for (const id in this.players) {
                    const p = this.players[id];
                    if (p.alive && p.id !== b.owner && t >= p.invulnUntil
                        && dist(b.x, b.y, p.x, p.y) < SHIP_SIZE) {
                        this.kill(p, b.owner);
                        dead = true;
                        break;
                    }
                }
            }

            // bullet vs asteroids (split big ones, score for the shooter)
            if (!dead) {
                for (let j = this.asteroids.length - 1; j >= 0; j--) {
                    const ast = this.asteroids[j];
                    if (dist(b.x, b.y, ast.x, ast.y) < ast.r) {
                        dead = true;
                        this.scorePoint(b.owner, 1);
                        this.entityLayer.removeChild(ast.node.id);
                        this.asteroids.splice(j, 1);
                        if (ast.r > 3) {
                            for (let k = 0; k < 2; k++) {
                                const a = Math.random() * TAU;
                                this.addAsteroid(ast.x, ast.y, ast.r * 0.6, Math.cos(a) * 0.25, Math.sin(a) * 0.25);
                            }
                        } else {
                            this.spawnAsteroid();
                        }
                        break;
                    }
                }
            }

            if (dead) {
                this.entityLayer.removeChild(b.node.id);
                this.bullets.splice(i, 1);
            } else {
                b.node.node.coordinates2d = ShapeUtils.rectangle(b.x - BULLET_SIZE / 2, b.y - BULLET_SIZE / 2, BULLET_SIZE, BULLET_SIZE);
            }
        }

        this.base.node.onStateChange();   // ONE notify per tick
    }

    // triangle pointing along `angle`, centered on (x,y)
    shipVerts(x, y, angle) {
        const tip = [x + Math.cos(angle) * SHIP_SIZE, y + Math.sin(angle) * SHIP_SIZE];
        const l = angle + 2.6, r = angle - 2.6;
        const left = [x + Math.cos(l) * SHIP_SIZE * 0.9, y + Math.sin(l) * SHIP_SIZE * 0.9];
        const right = [x + Math.cos(r) * SHIP_SIZE * 0.9, y + Math.sin(r) * SHIP_SIZE * 0.9];
        return ShapeUtils.triangle(tip[0], tip[1], left[0], left[1], right[0], right[1]);
    }

    kill(victim, killerId) {
        victim.alive = false;
        victim.respawnAt = this._t + RESPAWN_TICKS;
        victim.node.node.fill = [0, 0, 0, 0];
        if (killerId != null && this.players[killerId]) this.scorePoint(killerId, 2);
    }

    scorePoint(playerId, n) {
        const p = this.players[playerId];
        if (!p) return;
        p.score += n;
        this.renderScoreboard();
    }

    renderScoreboard() {
        this.scoreboard.clearChildren();
        const ranked = Object.values(this.players).sort((a, b) => b.score - a.score);
        ranked.slice(0, 8).forEach((p, i) => {
            this.scoreboard.addChild(new GameNode.Text({
                textInfo: { text: `${p.name}: ${p.score}`, x: 2, y: 8 + i * 3.4, size: 1.1, align: 'left', color: p.color },
            }));
        });
        // clearChildren/addChild notify for us, but tick()'s onStateChange covers it too.
    }
}

module.exports = Singularity;
