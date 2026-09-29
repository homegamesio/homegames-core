const { RULES: R, C, SITES, MODS, ENEMIES, CONTRACTS, WEAPONS } = require('./settings');
const CombatSystems = require('./combat');
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lerpAngle = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
function random(seed) {
    let state = seed >>> 0;
    return () => {
        state += 0x6D2B79F5;
        let t = Math.imul(state ^ state >>> 15, 1 | state);
        t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
// Swept collision: a fast projectile must not tunnel through small enemies.
function segmentHit(ax, ay, bx, by, target, radius) {
    const dx = bx - ax, dy = by - ay;
    const t = clamp(((target.x - ax) * dx + (target.y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(ax + dx * t - target.x, ay + dy * t - target.y) <= radius;
}
function pool(n) { return Array.from({ length: n }, () => ({ life: 0 })); }
function slot(items) { return items.find(v => v.life <= 0); }

class Engine extends CombatSystems {
    constructor(seed = 12345) {
        super();
        this.phase = 'title'; this.time = 0; this.paused = false; this.reduced = false;
        this.seed = seed >>> 0; this.best = 0; this.sound = true; this.events = [];
        this.input = { x: 0, y: 0, aimX: 100, aimY: 45, fire: false, dash: false };
        this.initialize(this.seed);
        this.phase = 'title';
    }
    initialize(seed) {
        this.seed = seed >>> 0; this.rng = random(seed); this.fxRng = random(seed ^ 0x7F4A7C15);
        this.runTime = 0; this.score = 0; this.geoms = 0; this.multiplier = 1;
        this.combo = 0; this.kills = 0; this.operations = 0; this.selected = 0; this.practice = false;
        this.weapon = 'needle'; this.salvage = 0; this.flux = 35; this.overload = 0; this.alert = 0;
        this.raids = 0; this.entityId = 0; this.chain = 0; this.chainTime = 0; this.bestChain = 0; this.guide = false;
        this.upgrades = {}; this.history = []; this.events = []; this.shake = 0; this.flash = 0;
        this.player = { x: 80, y: 62, vx: 0, vy: 0, angle: -Math.PI / 2, aim: -Math.PI / 2,
            hp: 6, maxHp: 6, inv: 0, dash: 0, dashX: 0, dashY: 0, charges: 2, recharge: 0,
            shot: 0, recoil: 0, trailClock: 0, dashSerial: 0 };
        const types = ['reactor', 'foundry', 'relay'];
        for (let i = types.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [types[i], types[j]] = [types[j], types[i]]; }
        const pos = [[36, 31], [61, 51], [35, 70]];
        this.world = { shields: 30, heavies: 5, reserves: 16, clock: 0, delivery: 0, convoys: [],
            nodes: types.map((type, i) => ({ type, x: pos[i][0] + this.rng() * 8 - 4,
                y: pos[i][1] + this.rng() * 5 - 2.5, captured: false, raided: false, ordinal: i + 1,
                layout: Math.floor(this.rng() * 3), contract: CONTRACTS[Math.floor(this.rng() * CONTRACTS.length)].id })) };
        this.world.nodes.push({ type: 'fortress', x: 101, y: 48, captured: false, ordinal: 4 });
        this.resetArena(); this.paused = false; this.phase = 'map';
    }
    resetArena() {
        this.enemies = pool(R.maxEnemies); this.bullets = pool(R.maxBullets);
        this.hostile = pool(R.maxHostile); this.gems = pool(R.maxGems);
        this.particles = pool(R.maxParticles); this.rings = pool(R.maxRings); this.labels = pool(R.maxLabels);
        this.hazards = pool(R.maxHazards); this.links = pool(R.maxLinks); this.blasts = []; this.barrels = [];
        this.overload = 0; this.arcCooldown = 0; this.droneShot = 0; this.rewardInfo = null; this.rerolls = 0;
        this.structures = []; this.boss = null; this.mission = null; this.events = [];
        this.capture = 0; this.captureBlocked = false; this.shake = 0; this.flash = 0; this.hitStop = 0;
    }
    start(seed = this.seed) { this.initialize(seed); this.emitSound('select'); }
    owned(type) { return this.world.nodes.some(n => n.type === type && n.captured); }
    chooseWeapon(id) {
        if (!WEAPONS.some(w => w.id === id)) return false;
        if (this.phase !== 'loadout' && this.phase !== 'map' && !(this.phase === 'combat' && this.practice)) return false;
        this.weapon = id; if (this.phase === 'loadout') this.phase = 'map'; this.emitSound('select'); return true;
    }
    repairHull() {
        if (this.phase !== 'map' || this.salvage < 20 || this.player.hp >= this.player.maxHp) return false;
        this.salvage -= 20; this.player.hp = Math.min(this.player.maxHp, this.player.hp + 2); this.emitSound('capture'); return true;
    }
    enter(index, practice = false, mode = 'capture') {
        if (!practice && (this.phase !== 'map' || !this.world.nodes[index] || this.world.nodes[index].captured)) return false;
        if (!practice && mode === 'raid' && (this.world.nodes[index].raided || this.world.nodes[index].type === 'fortress')) return false;
        this.resetArena(); this.practice = practice;
        const type = practice ? 'range' : this.world.nodes[index].type;
        this.mission = { type, index, mode, time: 0, reserve: practice ? 999 : 20 + index * 3 + Math.floor(this.alert / 6),
            spawn: 1.1, wave: 0, deliveries: 0, kills: 0, captured: false, damage: 0, peakMultiplier: 1,
            cargoKills: 0, contract: practice || type === 'fortress' ? null : this.world.nodes[index].contract };
        if (this.mission.contract === 'hunter' && this.owned('relay')) this.mission.contract = 'clean';
        const p = this.player;
        Object.assign(p, { x: 80, y: 64, vx: 0, vy: 0, angle: -Math.PI / 2, aim: -Math.PI / 2,
            shot: 0, inv: 1.5, charges: 2, recharge: 0, dash: 0, recoil: 0 });
        this.input.fire = false; this.input.dash = false; this.input.aimX = 80; this.input.aimY = 36;
        this.phase = 'combat'; this.paused = false; this.combo = 0;
        if (this.owned('relay')) p.hp = Math.min(p.maxHp, p.hp + 1);
        if (type === 'fortress') {
            this.boss = { x: 80, y: 39, r: 5, hp: 420, maxHp: 420, id: 'core', angle: 0, shot: 2, beam: 4,
                flash: 0, stage: 1, transition: 0, warning: 0, heavy: this.world.heavies, reserve: this.world.reserves,
                activeShield: this.world.shields > 0 };
            this.mission.reserve = 6;
            if (this.world.shields > 0) {
                [[58, 31], [102, 31], [80, 53]].forEach(([x, y]) => this.addStructure(x, y, 4 + Math.ceil(this.world.shields / 3), 'shield'));
            }
        } else if (!practice) {
            const layouts = [[[43, 33], [117, 34], [80, 58]], [[42, 55], [82, 26], [119, 53]], [[39, 42], [115, 28], [111, 63]]];
            layouts[this.world.nodes[index].layout].forEach(([x, y]) => this.addStructure(x, y, type === 'foundry' ? 18 : 15, type));
            this.structures[0].priority = true;
            // Existing defenders make the first seconds of an invasion active.
            const defenders = type === 'reactor' ? ['chaser', 'warden', 'shooter', 'sniper'] : type === 'foundry' ? ['heavy', 'charger', 'chaser', 'bomber'] : ['weaver', 'sniper', 'leech', 'charger'];
            [[30, 29], [55, 28], [110, 30], [131, 46]].forEach(([x, y], i) => this.spawn(defenders[i], x, y));
        }
        if (!practice) {
            [[28, 52], [60, 65], [103, 59], [134, 31]].forEach(([x, y], i) => this.barrels.push({ x, y, hp: 2, maxHp: 2, r: 1.1, id: 'fuel'+i, type: 'fuel', color: C.orange, flash: 0 }));
        }
        this.banner = practice ? 'FLIGHT SCHOOL / NO HULL DAMAGE' : type === 'fortress' ? 'BREACH THE CITADEL' : 'DISABLE THE THREE UPLINKS';
        this.bannerTime = 3; this.emitSound('deploy');
        if (mode === 'raid') this.banner = 'RAID / BREAK THE MARKED UPLINK, THEN EXTRACT';
        this.ring(p.x, p.y, C.cyan, 12, .7);
        return true;
    }
    addStructure(x, y, hp, type) { this.structures.push({ x, y, r: 2.7, hp, maxHp: hp, id: 'pylon'+this.structures.length, type, flash: 0, angle: this.rng() * TAU, pulse: 4 + this.rng() * 2 }); }
    emitSound(name) { if (this.events.length < 20) this.events.push(name); }
    burst(x, y, color, count, speed = 25) {
        for (let i = 0; i < count; i++) {
            const v = slot(this.particles); if (!v) break;
            const a = this.fxRng() * TAU, s = speed * (.2 + this.fxRng() * .8), life = .18 + this.fxRng() * .48;
            Object.assign(v, { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, size: .12 + this.fxRng() * .2 });
        }
    }
    ring(x, y, color, size = 6, life = .35) {
        const v = slot(this.rings); if (v) Object.assign(v, { x, y, color, size, life, max: life });
    }
    label(x, y, text, color = C.cyan) {
        const v = slot(this.labels); if (v) Object.assign(v, { x, y, text, color, life: .85, max: .85 });
    }
    step(dt = R.step) {
        if (this.paused) return;
        this.time += dt;
        if (this.phase !== 'combat') return;
        this.runTime += dt; this.mission.time += dt;
        this.bannerTime = Math.max(0, this.bannerTime - dt);
        this.shake *= Math.exp(-14 * dt); this.flash = Math.max(0, this.flash - dt * 3);
        this.updateFX(dt);
        if (this.mission.finishTimer > 0) {
            this.mission.finishTimer -= dt;
            if (this.mission.finishTimer <= 0) {
                if (this.mission.finish === 'won') this.win();
                else if (this.mission.finish === 'raid') this.completeRaid();
                else this.completeSite();
            }
            return;
        }
        // Brief impact slowdown affects enemies and debris, never steering or firing.
        this.hitStop = Math.max(0, this.hitStop - dt);
        const worldDt = this.hitStop > 0 ? dt * .25 : dt;
        this.updatePlayer(dt);
        this.updateBullets(dt);
        this.updateAbilities(dt);
        this.updateEnemies(worldDt);
        this.updateHazards(worldDt);
        if (this.phase !== 'combat') return;
        this.updateGems(dt);
        this.updateMission(worldDt);
        this.combo = Math.max(0, this.combo - dt);
        if (this.combo === 0 && this.multiplier > 1) this.multiplier = Math.max(1, this.multiplier - dt * .7);
        if (!this.practice) this.updateEconomy(dt);
        this.mission.peakMultiplier = Math.max(this.mission.peakMultiplier, Math.floor(this.multiplier));
    }
    updatePlayer(dt) {
        const p = this.player, input = this.input;
        let mx = input.x, my = input.y;
        const length = Math.hypot(mx, my); if (length > 1) { mx /= length; my /= length; }
        p.inv = Math.max(0, p.inv - dt); p.shot -= dt; p.recoil *= Math.exp(-24 * dt);
        p.aim = Math.atan2(input.aimY - p.y, input.aimX - p.x);
        p.angle = lerpAngle(p.angle, p.aim, 1 - Math.exp(-32 * dt));
        if (p.charges < 2) {
            p.recharge += dt / (R.dashRecharge * (this.upgrades.dash ? .7 : 1));
            if (p.recharge >= 1) { p.charges++; p.recharge = 0; if (p.charges === 2) this.emitSound('ready'); }
        }
        if (input.dash && p.charges > 0 && p.dash <= 0) {
            const a = length > .1 ? Math.atan2(my, mx) : p.aim;
            p.dashX = Math.cos(a); p.dashY = Math.sin(a); p.dash = R.dashTime;
            p.dashSerial++;
            p.inv = Math.max(p.inv, R.dashTime + .12); p.charges--;
            this.ring(p.x, p.y, C.cyan, 5, .25); this.emitSound('dash');
        }
        input.dash = false;
        if (p.dash > 0) {
            p.dash -= dt; p.vx = p.dashX * R.dashSpeed; p.vy = p.dashY * R.dashSpeed;
        } else {
            const k = 1 - Math.exp(-(length > .1 ? R.acceleration : R.braking) * dt);
            p.vx += (mx * R.speed - p.vx) * k; p.vy += (my * R.speed - p.vy) * k;
        }
        const oldX = p.x, oldY = p.y;
        p.x = clamp(p.x + p.vx * dt, R.bounds.left + 1, R.bounds.right - 1);
        p.y = clamp(p.y + p.vy * dt, R.bounds.top + 1, R.bounds.bottom - 1);
        if (p.dash > 0) this.dashContacts(oldX, oldY, p.x, p.y);
        p.trailClock -= dt;
        if (p.trailClock <= 0 && Math.hypot(p.vx, p.vy) > 2) {
            p.trailClock = p.dash > 0 ? .012 : .028;
            const v = slot(this.particles);
            if (v) Object.assign(v, { x: p.x - Math.cos(p.angle) * 1.1, y: p.y - Math.sin(p.angle) * 1.1,
                vx: -p.vx * .15, vy: -p.vy * .15, life: .24, max: .24, color: C.cyan, size: p.dash > 0 ? .6 : .22 });
        }
        if (input.fire && p.shot <= 0) {
            this.fireWeapon();
        }
    }
    spawn(type, x, y, immediate = false, elite = false) {
        const v = slot(this.enemies); if (!v) return false;
        if (x === undefined) {
            for (let tries = 0; tries < 10; tries++) {
                const side = Math.floor(this.rng() * 4);
                x = side === 0 ? 10 : side === 1 ? 150 : 12 + this.rng() * 136;
                y = side === 2 ? 20 : side === 3 ? 73 : 22 + this.rng() * 49;
                if (Math.hypot(x - this.player.x, y - this.player.y) > 20) break;
            }
        }
        const stats = ENEMIES[type]; if (!stats) return false;
        const hp = stats.hp * (elite ? 1.7 : 1);
        Object.assign(v, { id: ++this.entityId, x, y, vx: 0, vy: 0, hp, maxHp: hp, speed: stats.speed * (elite ? 1.1 : 1), r: stats.r * (elite ? 1.15 : 1),
            color: stats.color, type, life: 1, spawn: immediate ? 0 : .8, flash: 0, angle: Math.atan2(this.player.y - y, this.player.x - x),
            shot: 1.2 + this.rng() * 1.2, phase: this.rng() * TAU, age: 0, elite, destroyed: false,
            attack: 'idle', timer: 0, lockAngle: 0, stolen: 0, chill: 0, stun: 0, shieldFlash: 0, lastDash: -1, protected: [] });
        return true;
    }
    updateEnemies(dt) {
        const p = this.player;
        for (const e of this.enemies) {
            if (e.life <= 0) continue;
            e.age += dt; e.flash = Math.max(0, e.flash - dt * 7);
            e.shieldFlash = Math.max(0, e.shieldFlash - dt); e.chill = Math.max(0, e.chill - dt);
            if (e.spawn > 0) { e.spawn -= dt; continue; }
            if (e.stun > 0) { e.stun -= dt; continue; }
            const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
            const facing = Math.atan2(dy, dx);
            e.angle = e.type === 'heavy' ? lerpAngle(e.angle, facing, Math.min(1, dt * .9)) : facing; e.shot -= dt;
            let tx = dx / d, ty = dy / d;
            if (e.type === 'shooter') {
                const approach = d < 23 ? -.6 : d > 34 ? 1 : 0;
                tx = tx * approach - dy / d * .45; ty = ty * approach + dx / d * .45;
                if (e.shot <= 0) { this.enemyShot(e, e.angle, 24); e.shot = 2.5; }
            } else if (e.type === 'weaver') {
                const sway = Math.sin(e.age * 5 + e.phase) * .8;
                tx -= dy / d * sway; ty += dx / d * sway;
            } else if (e.type === 'heavy' && e.shot <= 0) {
                for (let i = -1; i <= 1; i++) this.enemyShot(e, e.angle + i * .24, 21);
                e.shot = 3.2;
            } else if (e.type === 'carrier') {
                tx = 1; ty = 0;
                if (e.x > 150) {
                    e.life = 0; this.world.reserves += 3; this.mission.deliveries++;
                    this.label(135, 22, '+3 ENEMY RESERVES', C.red); this.emitSound('alert'); continue;
                }
            }
            [tx, ty] = this.specialEnemy(e, dt, tx, ty);
            // Local separation makes crowds flow around each other instead of stacking.
            if (e.type !== 'carrier') for (const other of this.enemies) {
                if (other === e || other.life <= 0 || other.spawn > 0) continue;
                const sx = e.x - other.x, sy = e.y - other.y, sd = Math.hypot(sx, sy);
                if (sd > .01 && sd < e.r + other.r + 1) {
                    const push = (e.r + other.r + 1 - sd) * .7;
                    tx += sx / sd * push; ty += sy / sd * push;
                }
            }
            const k = 1 - Math.exp(-(e.attack === 'charge' ? 35 : 6) * dt), speed = e.speed * (e.chill > 0 ? .5 : 1);
            e.vx += (tx * speed - e.vx) * k; e.vy += (ty * speed - e.vy) * k;
            e.x = clamp(e.x + e.vx * dt, 7, 153); e.y = clamp(e.y + e.vy * dt, 17, 76);
            if (distance(e, p) < e.r + .65) {
                this.damagePlayer(e); if (this.phase !== 'combat') return;
                e.vx -= tx * 30; e.vy -= ty * 30;
            }
        }
        for (const b of this.hostile) {
            if (b.life <= 0) continue;
            const x = b.x, y = b.y; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
            if (segmentHit(x, y, b.x, b.y, p, .9)) { this.damagePlayer(b); b.life = 0; }
            if (b.life > 0) for (const barrel of this.barrels) if (barrel.hp > 0 && segmentHit(x, y, b.x, b.y, barrel, barrel.r)) { this.hitTarget(barrel, 2, 'enemy'); b.life = 0; break; }
            if (b.x < 6 || b.x > 154 || b.y < 16 || b.y > 77) b.life = 0;
        }
    }
    enemyShot(e, angle, speed) {
        const b = slot(this.hostile); if (!b) return;
        Object.assign(b, { x: e.x + Math.cos(angle) * e.r, y: e.y + Math.sin(angle) * e.r,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, angle, life: 6 });
    }
    updateBullets(dt) {
        const targets = this.enemies.filter(e => e.life > 0 && e.spawn <= 0).concat(this.structures.filter(s => s.hp > 0), this.barrels.filter(s => s.hp > 0));
        if (this.boss && this.boss.hp > 0) targets.push(this.boss);
        for (const b of this.bullets) {
            if (b.life <= 0) continue;
            const ox = b.x, oy = b.y; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
            if (!b.hitIds) b.hitIds = [];
            // Near-to-far resolution preserves occlusion when targets overlap.
            targets.sort((a, c) => Math.hypot(a.x - ox, a.y - oy) - Math.hypot(c.x - ox, c.y - oy));
            for (const e of targets) {
                if (e.hp <= 0 || e.spawn > 0 || b.hitIds.includes(e.id)) continue;
                if (!segmentHit(ox, oy, b.x, b.y, e, e.r + .25)) continue;
                b.hitIds.push(e.id);
                const damaged = this.hitTarget(e, b.damage, b.source || 'weapon', b);
                if (b.pierce > 0 && damaged) b.pierce--; else { b.life = 0; break; }
            }
            if (b.x < 6 || b.x > 154 || b.y < 16 || b.y > 77) {
                if (b.life > 0) this.burst(clamp(b.x, 6, 154), clamp(b.y, 16, 77), C.teal, 2, 8);
                if (b.bounce > 0 && b.life > 0) {
                    b.bounce--; if (b.x < 6 || b.x > 154) b.vx *= -1; if (b.y < 16 || b.y > 77) b.vy *= -1;
                    b.x = clamp(b.x, 6.1, 153.9); b.y = clamp(b.y, 16.1, 76.9); b.angle = Math.atan2(b.vy, b.vx);
                } else b.life = 0;
            }
        }
    }
    destroy(e) {
        if (e.destroyed) return;
        e.destroyed = true;
        const type = e.type, x = e.x, y = e.y, stolen = e.stolen || 0, elite = e.elite;
        e.life = 0; e.hp = 0;
        if (type === 'fuel') { this.explode(x, y, 10, 14, C.orange, 'fuel'); this.label(x, y - 3, 'FUEL CHAIN', C.orange); return; }
        const structure = this.structures.includes(e), boss = e === this.boss;
        this.shake = Math.max(this.shake, boss ? 1.8 : structure || elite ? .85 : .32);
        this.hitStop = structure || e.type === 'heavy' ? .045 : .015;
        this.burst(e.x, e.y, e.color || C.blue, boss ? 65 : structure ? 22 : 12, boss ? 60 : 31);
        this.ring(e.x, e.y, e.color || C.blue, boss ? 28 : structure ? 10 : 5, boss ? 1 : .4);
        this.score += Math.round((structure ? 400 : boss ? 5000 : e.type === 'heavy' ? 150 : 50) * this.multiplier);
        this.combo = 5; this.kills++; this.mission.kills++;
        this.addFlux(elite ? 12 : structure ? 12 : 4);
        this.chain++; this.chainTime = 1.1; this.bestChain = Math.max(this.bestChain, this.chain);
        if (this.chain >= 3) { this.label(x, y - 3, this.chain+' CHAIN', this.chain > 5 ? C.yellow : C.cyan); this.score += this.chain * 20; }
        if (elite) { this.salvage += 8; this.label(x, y - 5, 'ELITE +8 SALVAGE', C.yellow); }
        this.emitSound(structure || boss || e.type === 'heavy' ? 'boom' : 'kill');
        if (boss) { this.beginFinish('won'); return; }
        const count = (structure ? 8 : type === 'carrier' ? 12 : type === 'heavy' ? 6 : 2) + stolen + (elite ? 5 : 0);
        for (let i = 0; i < count; i++) {
            const gem = slot(this.gems); if (!gem) break;
            const a = this.rng() * TAU, s = 3 + this.rng() * 12;
            Object.assign(gem, { x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 18, angle: a });
        }
        if (type === 'weaver') {
            this.spawn('small', x - 1, y, false); this.spawn('small', x + 1, y, false);
        }
        if (type === 'carrier') { this.mission.cargoKills++; this.salvage += 10; this.label(x, y - 3, 'SHIPMENT DENIED +10', C.cyan); }
        if (type === 'leech' && stolen) this.label(x, y - 3, 'GEOMS RECOVERED', C.green);
        if (type === 'warden') {
            for (const other of this.enemies) if (other.life > 0 && Math.hypot(x - other.x, y - other.y) < 14) other.stun = 1;
            this.ring(x, y, C.blue, 14, .45); this.label(x, y - 3, 'SHIELD COLLAPSE', C.blue);
        }
        if (!structure && this.upgrades.volatile) this.explode(x, y, 6.5, 3, C.orange, 'detonation');
        if (structure && this.mission.type === 'reactor') {
            for (const other of this.enemies) if (other.life > 0 && Math.hypot(x - other.x, y - other.y) < 20) other.stun = 1.2;
            this.ring(x, y, C.blue, 20, .5);
        }
        if (structure && e.priority && this.mission.mode === 'raid') {
            this.banner = 'STOCKPILE HIT / EXTRACT AT THE SOUTH BEACON'; this.bannerTime = 3;
            this.spawn('charger', 55, 55); this.spawn('charger', 105, 55);
        }
        if (structure && this.structures.every(s => s.hp <= 0)) {
            this.banner = this.boss ? 'SHIELDS DOWN / CORE EXPOSED' : this.mission.mode === 'raid' ? 'STOCKPILE HIT / EXTRACT AT THE SOUTH BEACON' : 'UPLINKS DOWN / BREAK THE ELITE GUARD';
            this.bannerTime = 3; this.emitSound('capture');
            if (this.boss) this.world.shields = 0;
            else if (this.mission.mode !== 'raid') {
                this.mission.guardPending = this.mission.type === 'reactor' ? 'warden' : this.mission.type === 'foundry' ? 'heavy' : 'charger';
                this.deployGuard();
                for (let i = 0; i < 5; i++) {
                    const a = i / 5 * TAU;
                    this.spawn(i === 0 ? 'charger' : 'chaser', 80 + Math.cos(a) * 22, 44 + Math.sin(a) * 19);
                }
                this.mission.reserve = Math.max(0, this.mission.reserve - 6);
            }
        }
    }
    damagePlayer(source) {
        const p = this.player;
        if (p.inv > 0 || this.phase !== 'combat' || this.practice || this.mission.finishTimer > 0) return;
        p.hp--; p.inv = 1.3; this.multiplier = Math.max(1, Math.floor(this.multiplier / 2)); this.mission.damage++;
        this.flash = .65; this.shake = 1; this.combo = 0;
        this.burst(p.x, p.y, C.red, 20, 36); this.ring(p.x, p.y, C.red, 8, .45); this.emitSound('hurt');
        const a = Math.atan2(p.y - source.y, p.x - source.x);
        p.vx += Math.cos(a) * 15; p.vy += Math.sin(a) * 15;
        if (p.hp <= 0) { this.phase = 'dead'; this.best = Math.max(this.best, this.score); this.emitSound('defeat'); }
    }
    updateGems(dt) {
        const p = this.player, magnet = this.overload > 0 ? 30 : this.upgrades.magnet ? 24 : 12;
        for (const gem of this.gems) {
            if (gem.life <= 0) continue;
            gem.life -= dt; const d = distance(gem, p);
            if (d < magnet) {
                const k = 1 - Math.exp(-14 * dt), speed = 25 + (magnet - d) * 3;
                gem.vx += ((p.x - gem.x) / (d || 1) * speed - gem.vx) * k;
                gem.vy += ((p.y - gem.y) / (d || 1) * speed - gem.vy) * k;
            } else { gem.vx *= Math.exp(-4 * dt); gem.vy *= Math.exp(-4 * dt); }
            gem.x = clamp(gem.x + gem.vx * dt, 7, 153); gem.y = clamp(gem.y + gem.vy * dt, 17, 76);
            gem.angle += dt * 3;
            if (d < 1.5) {
                gem.life = 0; this.geoms++; this.combo = 5; this.multiplier = Math.min(20, this.multiplier + .16);
                this.salvage++; this.addFlux(1.2);
                if (this.upgrades.vampire && this.geoms % 35 === 0) { p.hp = Math.min(p.maxHp, p.hp + 1); this.label(p.x, p.y - 3, 'HULL RECLAIMED', C.green); }
                this.score += Math.round(15 * this.multiplier);
                if (this.geoms % 3 === 0) this.emitSound('geom');
            }
        }
    }
    updateMission(dt) {
        const m = this.mission; if (!m || this.phase !== 'combat') return;
        if (m.guardPending) this.deployGuard();
        this.structures.forEach(s => {
            s.flash = Math.max(0, s.flash - dt * 7); s.angle += dt * .15;
            if (s.hp > 0 && m.type === 'reactor') {
                s.pulse -= dt;
                if (s.pulse <= 0) { this.hazard('pulse', s.x, s.y, 0, 0, { r: 7, warn: 1.25, life: 1.45 }); s.pulse = 5; }
            }
        });
        m.spawn -= dt;
        if (m.spawn <= 0) {
            m.spawn = this.practice ? 2.2 : this.boss ? 3.0 : Math.max(2.1, 3.4 - this.alert * .015);
            m.wave++;
            const rosters = {
                reactor: ['chaser', 'weaver', 'warden', 'sniper', 'charger'],
                foundry: ['chaser', 'heavy', 'charger', 'bomber', 'shooter'],
                relay: ['weaver', 'charger', 'leech', 'sniper', 'shooter'],
                fortress: ['chaser', 'charger', 'sniper', 'weaver', 'bomber'],
                range: ['chaser', 'weaver', 'charger', 'sniper', 'warden', 'bomber', 'leech', 'heavy'],
            };
            const roster = rosters[m.type], count = this.practice ? 1 : m.time < 9 ? 2 : 3;
            for (let i = 0; i < count && m.reserve > 0; i++) {
                const type = this.practice ? roster[(m.wave - 1) % roster.length] : roster[Math.floor(this.rng() * roster.length)];
                const elite = !this.practice && this.alert >= 12 && m.wave % 4 === 3 && i === 0;
                if (this.spawn(type, undefined, undefined, false, elite)) m.reserve--;
                if (elite) { this.banner = 'ELITE SIGNAL / +8 SALVAGE ON KILL'; this.bannerTime = 2; }
            }
            if (this.boss && this.boss.heavy > 0 && this.spawn('heavy')) { this.boss.heavy--; this.world.heavies--; }
            if (this.boss && this.boss.reserve > 0 && m.time > 6 && this.spawn(m.wave % 3 === 0 ? 'warden' : 'shooter')) { this.boss.reserve--; this.world.reserves--; }
        }
        if (this.boss) this.updateBoss(dt);
        else if (!this.practice && m.mode === 'raid' && this.structures.find(s => s.priority).hp <= 0) {
            if (Math.hypot(this.player.x - 80, this.player.y - 69) < 6) this.capture += dt;
            if (this.capture >= 1.5) this.beginFinish('raid');
        } else if (!this.practice && this.structures.every(s => s.hp <= 0)) {
            this.captureBlocked = !!m.guardPending || this.enemies.some(e => e.life > 0 && (e.id === m.guardId || (e.spawn <= 0 && Math.hypot(e.x - 80, e.y - 44) < 9)));
            if (Math.hypot(this.player.x - 80, this.player.y - 44) < 8 && !this.captureBlocked) this.capture += dt;
            if (this.capture >= R.captureTime) this.beginFinish('capture');
        }
        // The relay sends actual, shootable cargo into optional operations.
        if (!this.practice && !this.boss && !this.world.nodes.find(n => n.type === 'relay').captured && m.time > 8 && !m.carrier) {
            if (this.spawn('carrier', 9, 23)) m.carrier = true;
        }
    }
    deployGuard() {
        const m = this.mission;
        if (m.guardPending && this.spawn(m.guardPending, 80, 37, false, true)) {
            m.guardId = this.entityId; m.guardPending = null;
        }
    }
    updateBoss(dt) {
        const b = this.boss;
        if (b.hp <= 0) return;
        b.angle += dt * .25; b.shot -= dt; b.beam -= dt; b.flash = Math.max(0, b.flash - dt * 7);
        b.transition = Math.max(0, b.transition - dt);
        const nextStage = b.hp < b.maxHp * .33 ? 3 : b.hp < b.maxHp * .67 ? 2 : 1;
        if (nextStage > b.stage) {
            b.stage = nextStage; b.transition = 1; b.shot = 1.5; b.beam = 2;
            for (const bullet of this.hostile) bullet.life = 0;
            this.banner = b.stage === 2 ? 'CITADEL PHASE II / RAIL ARRAY ONLINE' : 'CITADEL PHASE III / CORE MELTDOWN'; this.bannerTime = 2;
            this.ring(b.x, b.y, C.red, 25, .7); this.emitSound('phase'); this.shake = .8;
        }
        if (b.transition > 0) return;
        if (b.shot <= 0) {
            const count = b.stage === 3 ? 16 : b.stage === 2 ? 12 : 10;
            for (let i = 0; i < count; i++) this.enemyShot(b, i / count * TAU + b.angle, b.stage === 2 ? 20 : 16);
            const a = Math.atan2(this.player.y - b.y, this.player.x - b.x);
            for (let i = -1; i <= 1; i++) this.enemyShot(b, a + i * .18, 27);
            b.shot = b.stage === 3 ? 1.45 : b.stage === 2 ? 1.9 : 2.6;
            this.ring(b.x, b.y, C.red, 8, .35); this.emitSound('boss');
        }
        if (b.stage >= 2 && b.beam <= 0) {
            const a = Math.atan2(this.player.y - b.y, this.player.x - b.x);
            this.hazard('beam', b.x, b.y, a, 0, { warn: 1.15, life: 1.4 });
            if (b.stage === 3) { this.hazard('beam', b.x, b.y, a - .4, 0, { warn: 1.15, life: 1.4 }); this.hazard('beam', b.x, b.y, a + .4, 0, { warn: 1.15, life: 1.4 }); }
            b.beam = 4;
        }
        if (distance(this.player, b) < b.r + .8) this.damagePlayer(b);
    }
    updateEconomy(dt) {
        // Production is explicit: sites dispatch cargo; it takes time to arrive.
        // The strategic screen is paused so deliberation is free.
        if (this.boss) return;
        this.world.clock += dt;
        if (this.world.clock >= 16 && !this.boss) {
            this.world.clock -= 16;
            for (const n of this.world.nodes) {
                if (n.captured || n.type === 'fortress' || n.type === 'relay') continue;
                this.world.convoys.push({ from: n.type, progress: 0 });
            }
        }
        for (const c of this.world.convoys) {
            c.progress += dt / 10;
            if (c.progress >= 1 && !c.delivered) {
                c.delivered = true;
                if (!this.world.nodes.find(n => n.type === c.from).captured) {
                    if (c.from === 'reactor') this.world.shields = Math.min(60, this.world.shields + 3);
                    if (c.from === 'foundry') this.world.heavies = Math.min(12, this.world.heavies + 1);
                }
            }
        }
        this.world.convoys = this.world.convoys.filter(c => !c.delivered);
    }
    completeSite() {
        const node = this.world.nodes[this.mission.index];
        if (node.captured) return;
        node.captured = true; this.operations++; this.alert = Math.min(60, this.alert + 12);
        if (node.type === 'reactor') this.world.shields = 0;
        if (node.type === 'foundry') this.world.heavies = 0;
        if (node.type === 'relay') this.world.reserves = 0;
        this.world.convoys = this.world.convoys.filter(c => c.from !== node.type);
        this.history.push(SITES[node.type].effect);
        this.score += 1500; this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
        this.rewardInfo = this.operationReward('capture', 20);
        this.phase = 'upgrade'; this.emitSound('capture');
        this.draft(); this.best = Math.max(this.best, this.score);
    }
    contractComplete() {
        const m = this.mission;
        if (!m?.contract) return false;
        return m.contract === 'clean' ? m.damage === 0 : m.contract === 'swift' ? (m.completedAt ?? m.time) <= 55 : m.contract === 'hunter' ? m.cargoKills > 0 : m.peakMultiplier >= 5;
    }
    operationReward(mode, amount) {
        const contract = this.contractComplete(), bonus = contract ? 25 : 0;
        this.salvage += amount + bonus;
        return { mode, amount, contract, bonus, objective: this.mission.contract };
    }
    completeRaid() {
        const node = this.world.nodes[this.mission.index]; if (node.raided) return;
        node.raided = true; this.raids++; this.alert = Math.min(60, this.alert + 6);
        const resource = { reactor: 'shields', foundry: 'heavies', relay: 'reserves' }[node.type];
        const before = this.world[resource]; this.world[resource] = Math.floor(before / 2);
        this.rewardInfo = { ...this.operationReward('raid', 25), removed: before - this.world[resource], resource };
        this.score += 750; this.best = Math.max(this.best, this.score); this.phase = 'report'; this.emitSound('capture');
    }
    draft(excluded = []) {
        const eligible = MODS.filter(v => v.id === 'repair' || (this.upgrades[v.id] || 0) < (v.max || 1));
        const available = eligible.filter(v => !excluded.includes(v.id));
        for (let i = available.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [available[i], available[j]] = [available[j], available[i]]; }
        for (const v of eligible) if (available.length < 3 && !available.includes(v)) available.push(v);
        this.choices = available.slice(0, 3); this.rerolls = this.rerolls || 0;
    }
    reroll() {
        if (this.phase !== 'upgrade' || this.salvage < 15 || this.rerolls > 0) return false;
        this.salvage -= 15; this.rerolls++; this.draft(this.choices.map(c => c.id)); this.emitSound('select'); return true;
    }
    buyModule() {
        if (this.phase !== 'map' || this.salvage < 60) return false;
        this.salvage -= 60; this.rewardInfo = { mode: 'purchase', amount: 0, bonus: 0 }; this.rerolls = 0; this.draft(); this.phase = 'upgrade'; return true;
    }
    beginFinish(outcome) {
        if (this.mission.finishTimer > 0) return;
        this.mission.completedAt = this.mission.time;
        this.mission.finish = outcome; this.mission.finishTimer = outcome === 'won' ? 1.25 : .85;
        this.banner = outcome === 'won' ? 'COMMAND CORE DESTROYED' : outcome === 'raid' ? 'RAID COMPLETE / STOCKPILE COMPROMISED' : 'TERRITORY SECURED'; this.bannerTime = 2;
        if (outcome === 'capture') {
            this.burst(80, 44, C.cyan, 40, 42); this.ring(80, 44, C.cyan, 28, .85); this.emitSound('capture');
        }
        for (const b of this.hostile) b.life = 0;
    }
    choose(index) {
        if (this.phase !== 'upgrade' || !this.choices[index]) return;
        const id = this.choices[index].id; this.upgrades[id] = (this.upgrades[id] || 0) + 1;
        if (id === 'repair') { this.player.maxHp = Math.min(10, this.player.maxHp + 1); this.player.hp = this.player.maxHp; }
        if (id === 'magnet' || id === 'dash') this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
        this.phase = 'map'; this.selected = this.world.nodes.findIndex(n => !n.captured); this.emitSound('select');
    }
    win() {
        this.world.nodes[3].captured = true; this.phase = 'won';
        this.best = Math.max(this.best, this.score); this.emitSound('victory');
    }
    updateFX(dt) {
        for (const p of this.particles) {
            if (p.life <= 0) continue;
            p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
            p.vx *= Math.exp(-4 * dt); p.vy *= Math.exp(-4 * dt);
        }
        for (const r of this.rings) if (r.life > 0) r.life -= dt;
        for (const l of this.labels) if (l.life > 0) { l.life -= dt; l.y -= dt * 3; }
    }
}
module.exports = { Engine, random, clamp, distance, segmentHit, lerpAngle };
