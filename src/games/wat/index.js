const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-150');
const { COLORS } = Colors;

// ──────────────────────────────────────────────
// TUNING
// ──────────────────────────────────────────────
const T = {
    COLS: 20, ROWS: 20, CELL: 5,
    PATH_WIDTH: 3.5,
    TICK: 20, MAX_PLAYERS: 4,

    // Enemies
    ENEMY_BASE_HP: 50, HP_SCALE: 1.22, SPEED_SCALE: 1.06,
    ENEMY_DIST: 8,
    BASE_SPEED: 25,    // distance per tick at level 1
    SPAWN_INTERVAL: 40,   // ticks between spawns in a wave
    WAVE_LEN: 15,         // enemies per wave at level 1
    WAVE_COOLDOWN: 60,   // ticks between waves

    // Towers
    TOWER_RANGE: 18,       // base range (scaled by level)
    TOWER_BASE_DPS: 2.5,   // damage per tick
    TOWER_LEVELS: 3,
    TOWER_COST: [10, 25, 60],

    // Projectiles
    PROJ_SPEED: 3.5,
    PROJECTILE_RANGE: 200,

    // Player
    GOLD_START: 150,
    STARTING_GOLD_PER_WAVE: 25,
    GOLD_PER_KILL: 10,
};

// ──────────────────────────────────────────────
// TOWER DEFINITIONS
// ──────────────────────────────────────────────
const TOWER_DEFS = {
    archer:  { name: 'Archer', color: [180,230,120], cost: T.TOWER_COST[0], damage: 4, range: T.TOWER_RANGE * 1.2, fireRate: 10 },
    cannon:  { name: 'Cannon', color: [230,140,50],  cost: T.TOWER_COST[1], damage: 16, range: T.TOWER_RANGE * 0.75, fireRate: 35 },
    sniper:  { name: 'Sniper', color: [140,180,255], cost: T.TOWER_COST[2], damage: 20, range: T.TOWER_RANGE * 1.6, fireRate: 50 },
};

// ──────────────────────────────────────────────
// GAME CLASS
// ──────────────────────────────────────────────
class TowerDefense extends Game {

    static metadata() {
        return {
            // Catalog review: Unfinished tower defense: broken wave/enemy lifecycle and no base-health loss loop.
            isTest: true,
            squishVersion: '150',
            name: 'Tower Defense',
            author: "Joseph Garcia",
            description: 'Place towers along the path. Survive endless waves of enemies!',
            aspectRatio: { x: 1, y: 1 },
            tickRate: T.TICK,
            maxPlayers: T.MAX_PLAYERS,
        };
    }

    constructor() {
        super();

        // ── State ───────────────────────────
        this.gold = T.GOLD_START;
        this.wave = 0;
        this.enemiesKilled = 0;

        // Phase: 'lobby' | 'wave' | 'between'
        this.phase = 'lobby';

        // ── Grid / Path ─────────────────────
        this.path = [];  // array of {x, y} points along the path centerline
        this.pathSegs = []; // segments with distance along path
        this.buildPath();

        // ── Game objects ────────────────────
        this.enemies = [];       // { node, hp, maxHp, dist, speed, id }
        this.towers = [];        // { node, type, level, x, y, angle, fireTimer }
        this.projectiles = [];   // { node, tx, ty, speed, dmg, id }
        this.particles = [];     // pooled effect nodes

        // ── UI ─────────────────────────────
        this.goldText = null;
        this.waveText = null;
        this.killedText = null;

        // ── Placement state ────────────────
        this.placingType = null;  // 'archer' | 'cannon' | 'sniper'
        this.hoverCell = null;    // {col, row}

        // ── Timers (tick-based) ────────────
        this.spawnTimer = 0;
        this.waveTimer = 0;

        // ── Build the scene ────────────────
        this.buildScene();

        // ── Start countdown → first wave ───
        this.startWave(0);
    }

    // ──────────────────────────────────────────
    // Path — a winding path through the grid
    // ──────────────────────────────────────────
    buildPath() {
        const C = T.CELL;
        // Define waypoints in cell coordinates (col, row)
        const waypoints = [
            [-1, 5],   // spawn: enter from left of row 5
            [4, 5],
            [4, 12],
            [10, 12],
            [10, 3],
            [15, 3],
            [15, 8],
            [20, 8],   // exit: leave right of row 8
        ];

        this.path = [];
        let prevX = -C, prevY = waypoints[0][1] * C + C / 2;

        for (const [col, row] of waypoints) {
            const x = col * C;
            const y = row * C + C / 2;
            this.path.push({ x: prevX, y: prevY });
            this.pathSegs.push(this._dist(prevX, prevY, x, y));
            // Add intermediate waypoints for smooth movement
            const seg = this._dist(prevX, prevY, x, y);
            if (seg > C * 2) {
                const mid = seg / 2;
                this.path.push({ x: prevX + (x - prevX) * mid / seg, y: prevY + (y - prevY) * mid / seg });
                this.pathSegs.push(mid);
            }
            prevX = x;
            prevY = y;
        }

        // Add exit point
        this.path.push({ x: prevX, y: prevY });
    }

    _dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }

    // ──────────────────────────────────────────
    // Build the scene (constructor)
    // ──────────────────────────────────────────
    buildScene() {
        const C = T.CELL;

        // Background (full-screen)
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [30, 28, 40, 255],
        });

        // Draw the path as a wide polygon
        const pathVerts = [];
        for (let i = 0; i < this.path.length; i++) {
            const p = this.path[i];
            // Left and right edges of the path at each waypoint
            const d = Math.hypot(
                i > 0 ? this.path[i - 1].x - p.x : 0,
                i > 0 ? this.path[i - 1].y - p.y : 0,
            );
            const angle = d > 0 ? Math.atan2(this.path[i - 1].y - p.y, this.path[i - 1].x - p.x) : Math.PI / 2;
            const hw = T.PATH_WIDTH / 2;
            const lx = p.x - Math.sin(angle) * hw;
            const ly = p.y + Math.cos(angle) * hw;
            pathVerts.push([lx, ly]);
        }

        this.pathShape = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: pathVerts,
            fill: [50, 48, 55, 255],
        });

        // Path border (slightly wider)
        const pathVertsBorder = [];
        for (let i = 0; i < this.path.length; i++) {
            const p = this.path[i];
            const d = Math.hypot(
                i > 0 ? this.path[i - 1].x - p.x : 0,
                i > 0 ? this.path[i - 1].y - p.y : 0,
            );
            const angle = d > 0 ? Math.atan2(this.path[i - 1].y - p.y, this.path[i - 1].x - p.x) : Math.PI / 2;
            const hw = (T.PATH_WIDTH + 1.5) / 2;
            pathVertsBorder.push([p.x - Math.sin(angle) * hw, p.y + Math.cos(angle) * hw]);
        }

        this.pathBorder = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: pathVertsBorder,
            fill: [40, 38, 50, 255],
            color: [70, 68, 80, 200],
            border: 2,
        });

        this.base.addChildren(this.pathBorder, this.pathShape);

        // ── Build a pool of 80 particle nodes ─
        this.particles = [];
        for (let i = 0; i < 80; i++) {
            const p = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                fill: [255, 255, 100, 0],
                color: [255, 255, 100, 0],
            });
            this.pathShape.addChild(p);
            this.particles.push({ node: p, active: false, life: 0 });
        }

        // ── Build UI ───────────────────────
        this.buildUI();
    }

    buildUI() {
        const C = T.CELL;

        // Top bar background
        this.topBar = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 8),
            fill: [20, 18, 30, 255],
        });

        // Gold text
        this.goldText = new GameNode.Text({
            textInfo: {
                text: '💰 150', x: 8, y: 3.5, size: 2, align: 'left', color: [255, 210, 50, 255],
            }
        });

        // Wave text
        this.waveText = new GameNode.Text({
            textInfo: {
                text: 'Wave 0', x: 45, y: 3.5, size: 2, align: 'center', color: [180, 180, 255, 255],
            }
        });

        // Killed text
        this.killedText = new GameNode.Text({
            textInfo: {
                text: 'Kills: 0', x: 92, y: 3.5, size: 1.6, align: 'right', color: [180, 230, 140, 255],
            }
        });

        this.base.addChild(this.topBar);
        this.base.addChildren(this.goldText, this.waveText, this.killedText);

        // ── Tower shop buttons (bottom) ────
        this.shopBar = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 93, 100, 7),
            fill: [25, 24, 38, 255],
        });

        this.shopButtons = [];
        const buttonW = 20, buttonH = 6;
        let bx = 5;

        for (const [key, def] of Object.entries(TOWER_DEFS)) {
            // Button background
            const bg = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(bx, 93.5, buttonW + 1, buttonH - 1),
                fill: def.color.slice(0, 3).concat([180]),
                onClick: (pid) => this.togglePlace(key),
            });

            // Button label
            const label = new GameNode.Text({
                textInfo: {
                    text: def.name, x: bx + buttonW / 2, y: 97.5, size: 1.2, align: 'center', color: [255, 255, 255, 255],
                }
            });

            bg.addChild(label);
            this.shopBar.addChild(bg);
            this.shopButtons.push({ key, bg, label });

            bx += buttonW + 2;
        }

        this.base.addChildren(this.shopBar, ...this.shopButtons.map(b => b.bg));
    }

    // ──────────────────────────────────────────
    // Tower placement
    // ──────────────────────────────────────────
    togglePlace(type) {
        if (type === this.placingType) {
            // Deselect: check if we have gold for the cheapest tower
            const canAfford = Object.values(TOWER_DEFS).some(d => this.gold >= d.cost);
            if (!canAfford) return; // don't deselect if can't afford anything
            this.placingType = null;
            this.hoverCell = null;
        } else {
            const def = TOWER_DEFS[type];
            if (this.gold < def.cost) {
                // Flash red to indicate can't afford
                this._flashButton(type, true);
                return;
            }
            this.placingType = type;
        }

        // Highlight the selected button
        for (const btn of this.shopButtons) {
            const selected = btn.key === this.placingType;
            const canAfford = this.gold >= TOWER_DEFS[btn.key].cost;
            if (selected && canAfford) {
                btn.bg.node.fill = [255, 200, 50, 255];
            } else if (selected && !canAfford) {
                btn.bg.node.fill = [255, 80, 50, 180];
            } else {
                const def = TOWER_DEFS[btn.key];
                btn.bg.node.fill = def.color.slice(0, 3).concat([180]);
            }
        }

        this.base.node.onStateChange();
    }

    _flashButton(type, on) {
        for (const btn of this.shopButtons) {
            if (btn.key === type && on) {
                btn.bg.node.fill = [255, 80, 50, 180];
            }
        }
    }

    // ──────────────────────────────────────────
    // Click handling (tower placement)
    // ──────────────────────────────────────────
    handleMouseDown(playerId, { x, y }) {}

    handleMouseUp(playerId, data) {
        console.log('what is data');
        console.log(data);
        if (this.placingType === null) return;
        
        const { x, y } = data;

        const col = Math.floor(x / T.CELL);
        const row = Math.floor(y / T.CELL);

        if (this._isValidTowerSpot(col, row)) {
            const def = TOWER_DEFS[this.placingType];
            if (this.gold >= def.cost) {
                this.gold -= def.cost;
                this._placeTower(col, row);
            }
        }

        this.hoverCell = null;
    }

    handleMouseMove(playerId, { x, y }) {
        if (this.placingType === null) return;
        const col = Math.floor(x / T.CELL);
        const row = Math.floor(y / T.CELL);

        if (col !== this.hoverCell?.col || row !== this.hoverCell?.row) {
            this.hoverCell = { col, row };
            // Highlight the cell
        } else if (this.hoverCell && this.hoverCell.col !== -1) {
            // Re-highlight to maintain visual feedback
        }

        this.base.node.onStateChange();
    }

    _isValidTowerSpot(col, row) {
        if (col < 0 || col >= T.COLS || row < 0 || row >= T.ROWS) return false;
        const cx = col * T.CELL + T.CELL / 2;
        const cy = row * T.CELL + T.CELL / 2;

        // Must be far enough from the path
        for (let i = 0; i < this.path.length - 1; i++) {
            const segDist = this._distToSeg(cx, cy, this.path[i], this.path[i + 1]);
            if (segDist < T.PATH_WIDTH) return false;
        }

        // Must not overlap an existing tower
        for (const t of this.towers) {
            if (t.col === col && t.row === row) return false;
        }

        // Must not overlap any other tower too closely (at least 2 cells apart)
        for (const t of this.towers) {
            if (Math.abs(t.col - col) <= 1 && Math.abs(t.row - row) <= 1) return false;
        }

        return true;
    }

    _distToSeg(px, py, a, b) {
        const ax = a.x - px, ay = a.y - py;
        const bx = b.x - px, by = b.y - py;
        let t = (ax * bx + ay * by) / (bx * bx + by * by);
        t = Math.max(0, Math.min(1, t));
        const nx = a.x + bx * t;
        const ny = a.y + by * t;
        return Math.hypot(px - nx, py - ny);
    }

    _placeTower(col, row) {
        const def = TOWER_DEFS[this.placingType];
        const cx = col * T.CELL + T.CELL / 2;
        const cy = row * T.CELL + T.CELL / 2;

        // Tower base (the clickable button)
        const size = T.CELL - 2;
        const towerShape = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(cx - size / 2, cy - size / 2, size, size),
            fill: def.color.slice(0, 3).concat([255]),
        });

        // Tower turret (points toward first enemy or down)
        const turret = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(cx - 1.5, cy - 0.5, 3, 2),
            fill: [60, 58, 70, 255],
        });

        const tower = {
            type: this.placingType,
            level: 1,
            col, row, x: cx, y: cy,
            node: turret,
            fireTimer: 0,
        };

        this.pathShape.addChild(towerShape);
        towerShape.addChild(turret);
        this.towers.push(tower);

        // Update UI
        const totalCost = def.cost;
        this.goldText.node.text = { text: `💰 ${this.gold}`, x: 8, y: 3.5, size: 2, align: 'left', color: [255, 210, 50] };
        this.base.node.onStateChange();

        // Spawn a placement particle effect
        this._spawnParticles(cx, cy, def.color);
    }

    // ──────────────────────────────────────────
    // Enemy spawning & wave management
    // ──────────────────────────────────────────
    startWave(level) {
        this.wave = level + 1;
        this.phase = 'wave';

        const scale = 1 + (this.wave - 1) * 0.2;
        const hp = Math.round(T.ENEMY_BASE_HP * scale);
        const speed = T.BASE_SPEED * (1 + (this.wave - 1) * 0.04);
        const count = Math.round(T.WAVE_LEN * scale);

        this.waveTimer = 0;
        this.spawnTimer = T.SPAWN_INTERVAL / scale;

        // Update wave text
        this.waveText.node.text = {
            text: `Wave ${this.wave}`, x: 45, y: 3.5, size: 2, align: 'center', color: [180, 180, 255],
        };
    }

    spawnEnemy() {
        const scale = 1 + (this.wave - 1) * 0.2;
        const hp = Math.round(T.ENEMY_BASE_HP * scale);
        const speed = T.BASE_SPEED + (this.wave - 1) * 2;

        const enemy = {
            id: Date.now() + Math.random(),
            hp, maxHp: hp,
            dist: 0, speed,
            alive: true,
        };

        // Enemy node — a circle polygon approximated by 12-sided polygon
        const verts = [];
        for (let i = 0; i <= 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            verts.push([Math.cos(a) * 4, Math.sin(a) * 4]);
        }

        const node = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: verts,
            fill: [255, 80, 60, 255],
        });

        enemy.node = node;
        this.pathShape.addChild(node);
        this.enemies.push(enemy);

        // Spawn at the first waypoint
        const start = this.path[0];
        enemy.x = start.x;
        enemy.y = start.y;
    }

    // ──────────────────────────────────────────
    // Game tick — core simulation loop
    // ──────────────────────────────────────────
    tick() {
        if (this.phase !== 'wave') return;

        // ── Spawn timer ────────────────────
        this.spawnTimer--;
        if (this.spawnTimer <= 0) {
            const remaining = this.enemies.filter(e => e.alive).length;
            if (remaining < this.wave - 1 ? 0 : this._getWaveCount()) {
                // Check if we've spawned enough for this wave
            }
        }

        const count = Math.round(T.WAVE_LEN * (1 + (this.wave - 1) * 0.2));

        // Spawn wave in bursts
        if (this.waveTimer < count) {
            this.spawnEnemy();
            this.waveTimer++;
        }

        // ── Move enemies along path ────────
        for (const e of this.enemies) {
            if (!e.alive) continue;

            e.dist += e.speed / T.TICK;

            // Find which segment they're on
            let reachedEnd = false;
            for (let i = 0; i < this.path.length - 1; i++) {
                const segLen = this.pathSegs[i];
                if (e.dist <= segLen) {
                    // Interpolate between waypoints
                    const t = e.dist / segLen;
                    e.x = this.path[i].x + (this.path[i + 1].x - this.path[i].x) * t;
                    e.y = this.path[i].y + (this.path[i + 1].y - this.path[i].y) * t;
                    e.node.node.coordinates2d = [[e.x - 4, e.y - 4], [e.x + 4, e.y - 4],
                                                 [e.x + 4, e.y + 4], [e.x - 4, e.y + 4],
                                                 [e.x - 4, e.y - 4]];
                    break;
                } else {
                    e.dist -= segLen;
                }
            }

            // Enemy reached the end — remove them, give gold for surviving (bonus)
            if (e.dist < 0 || e.x > this.path[this.path.length - 1].x + 2) {
                this._removeEnemy(e);
            }

            // Update enemy color to show HP percentage
            const hpPct = e.hp / e.maxHp;
            if (hpPct >= 0.6) {
                e.node.node.fill = [255, 80, 60];
            } else if (hpPct >= 0.3) {
                e.node.node.fill = [255, 140, 60];
            } else {
                e.node.node.fill = [255, 180, 60];
            }
        }

        // ── Tower targeting & firing ───────
        for (const t of this.towers) {
            const def = TOWER_DEFS[t.type];
            const range = def.range + (t.level - 1) * 3;
            let closest = null;
            let closestDist = range;

            for (const e of this.enemies) {
                if (!e.alive) continue;
                const d = Math.hypot(e.x - t.x, e.y - t.y);
                if (d < closestDist) {
                    closestDist = d;
                    closest = e;
                }
            }

            // Rotate turret toward target
            if (closest) {
                const angle = Math.atan2(closest.y - t.y, closest.x - t.x);
                const halfW = 1.5;
                t.node.node.coordinates2d = [[t.x + Math.cos(angle) * halfW, t.y - 0.5],
                                            [t.x + Math.cos(angle) * halfW, t.y + 0.5],
                                            [t.x - Math.cos(angle) * halfW, t.y + 0.5],
                                            [t.x - Math.cos(angle) * halfW, t.y - 0.5],
                                            [t.x + Math.cos(angle) * halfW, t.y - 0.5]];
            }

            // Fire
            t.fireTimer--;
            if (closest && t.fireTimer <= 0) {
                const damage = def.damage + (t.level - 1) * 2;
                this._fireProjectile(t, closest, damage);
                t.fireTimer = def.fireRate;
            }
        }

        // ── Move projectiles ───────────────
        for (const p of this.projectiles) {
            if (!p.alive) continue;

            const dx = p.tx - p.x, dy = p.y - p.y;
            const d = Math.hypot(dx, dy);

            if (d < T.PROJ_SPEED) {
                // Hit target
                p.node.node.coordinates2d = ShapeUtils.rectangle(p.x, p.y, 0, 0);
                p.alive = false;
                this._hitEnemy(p.tx, p.ty, p.dmg);
            } else {
                const move = T.PROJ_SPEED / d;
                p.x += dx * move;
                p.y += dy * move;
                p.node.node.coordinates2d = [[p.x - 0.5, p.y - 0.5], [p.x + 0.5, p.y + 0.5]];
            }
        }

        // ── Remove dead projectiles & enemies ─
        this.projectiles = this.projectiles.filter(p => p.alive);

        // ── Check if wave is done ───────────
        const allDone = this.enemies.every(e => !e.alive);

        if (allDone) {
            this.phase = 'between';
            this.waveTimer = 0;

            // Give bonus gold for completing the wave
            const bonus = T.STARTING_GOLD_PER_WAVE + this.enemies.length * 5;
            this.gold += bonus;

            // After cooldown, start next wave
        } else {
            this.waveTimer++;
            if (this.waveTimer >= T.WAVE_COOLDOWN && allDone) {
                this.phase = 'between';
            }
        }

        if (this.phase === 'wave') this.base.node.onStateChange();
    }

    // ──────────────────────────────────────────
    // Projectile & damage system
    // ──────────────────────────────────────────
    _fireProjectile(tower, target, damage) {
        const p = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(tower.x - 0.5, tower.y - 0.5, 1, 1),
            fill: [255, 200, 30],
        });

        this.pathShape.addChild(p);

        this.projectiles.push({
            node: p, x: tower.x, y: tower.y,
            tx: target.x, ty: target.y, dmg: damage, alive: true,
        });

        this._spawnParticles(tower.x, tower.y, [255, 180, 30]);
    }

    _hitEnemy(x, y, damage) {
        for (const e of this.enemies) {
            if (!e.alive) continue;
            if (Math.hypot(e.x - x, e.y - y) < 5) {
                e.hp -= damage;
                this._spawnParticles(x, y, [255, 100, 30]);

                if (e.hp <= 0) {
                    this._removeEnemy(e);
                    this.gold += T.GOLD_PER_KILL;
                    this.enemiesKilled++;
                }
                break;
            }
        }

        this.goldText.node.text = { text: `💰 ${this.gold}`, x: 8, y: 3.5, size: 2, align: 'left', color: [255, 210, 50] };
        this.killedText.node.text = { text: `Kills: ${this.enemiesKilled}`, x: 92, y: 3.5, size: 1.6, align: 'right', color: [180, 230, 140] };
    }

    _removeEnemy(e) {
        if (e.node && e.node.node) {
            this.pathShape.removeChild(e.node.node.id);
        }
    }

    // ──────────────────────────────────────────
    // Particle effects (from pool)
    // ──────────────────────────────────────────
    _spawnParticles(x, y, color) {
        const available = this.particles.filter(p => !p.active).slice(0, 4);
        for (const p of available) {
            p.active = true;
            p.life = 15;
            p.x = x + (Math.random() - 0.5) * 4;
            p.y = y + (Math.random() - 0.5) * 4;
            p.vx = (Math.random() - 0.5) * 1.5;
            p.vy = (Math.random() - 0.5) * 1.5;
            p.color = color;
        }

        for (const p of this.particles) {
            if (!p.active) continue;
            p.x += p.vx;
            p.y += p.vy;
            p.life--;

            if (p.life <= 0) {
                p.active = false;
                p.node.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
                p.node.node.fill = [0, 0, 0, 0];
            } else {
                p.node.node.coordinates2d = ShapeUtils.rectangle(
                    p.x - 0.5, p.y - 0.5, 1, 1
                );
                p.node.node.fill = [p.color[0], p.color[1], p.color[2], Math.round(255 * p.life / 15)];
            }
        }

        this.base.node.onStateChange();
    }

    // ──────────────────────────────────────────
    // Utility
    // ──────────────────────────────────────────
    _getWaveCount() {
        return Math.round(T.WAVE_LEN * (1 + (this.wave - 1) * 0.2));
    }

    // ──────────────────────────────────────────
    // Required methods
    // ──────────────────────────────────────────
    getLayers() {
        return [{ root: this.base }];
    }

    handleNewPlayer({ playerId }) {
        // In multiplayer, each player sees the same game (shared view)
    }

    handleKeyDown(playerId, key) {
        // Allow keyboard movement for the player's tower if they want — optional quality of life
    }

    handlePlayerDisconnect(playerId) {
        // Nothing to clean up in single-player, but for multiplayer:
    }

    close() {
        // Clean up timers if we used any
    }
}

module.exports = TowerDefense;

