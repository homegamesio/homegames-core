'use strict';
const { TOWERS, ENEMIES, fieldFor, ROAD, RADIUS, stats, clone, clamp } = require('./content');
const { validateLevel } = require('./design');
const STEP = 1 / 60, MAX_TOWERS = 32, MAX_ENEMIES = 80;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function segmentDistance(x, y, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}
function routeData(points) {
    let length = 0;
    const segments = points.slice(1).map((b, i) => { const a = points[i], size = Math.hypot(b[0] - a[0], b[1] - a[1]); const s = { a, b, size, start: length }; length += size; return s; });
    return { points, segments, length };
}
function position(route, progress) {
    const s = route.segments.find(s => progress <= s.start + s.size) || route.segments[route.segments.length - 1];
    const t = clamp((progress - s.start) / s.size, 0, 1);
    return { x: s.a[0] + (s.b[0] - s.a[0]) * t, y: s.a[1] + (s.b[1] - s.a[1]) * t, angle: Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0]) };
}
function schedule(wave) {
    let id = 0;
    return wave.flatMap(g => Array.from({ length: g.count }, (_, i) => ({ kind: g.kind, at: g.delay + i * g.gap, route: g.route, order: id++ })))
        .sort((a, b) => a.at - b.at || a.order - b.order);
}

class Defense {
    constructor(level) {
        const valid = validateLevel(level);
        if (valid.error) throw new Error(valid.error);
        this.level = valid.level; this.routes = this.level.paths.map(routeData);
        this.towers = []; this.enemies = []; this.shots = []; this.effects = []; this.fires = []; this.events = [];
        this.cash = level.cash; this.gold = level.gold; this.wave = 0; this.phase = 'build'; this.paused = false;
        this.time = 0; this.waveTime = 0; this.speed = 1; this.accumulator = 0; this.nextId = 1; this.kills = 0; this.stolen = 0;
        this.spawnIndex = 0; this.queue = []; this.revision = 0; this.saloonHit = 0; this.totalSpent = 0;
        this.checkpoint = this.snapshot();
    }
    emit(kind, x, y, extra = {}) { this.effects.push({ kind, x, y, age: 0, life: kind === 'burst' ? .55 : .35, ...extra }); if (this.effects.length > 120) this.effects.shift(); }
    sound(kind) { if (!this.events.includes(kind)) this.events.push(kind); }
    canPlace(kind, x, y) {
        if (!['build', 'wave'].includes(this.phase) || !this.level.unlocked.includes(kind) || !Number.isFinite(x) || !Number.isFinite(y)) return 'locked';
        if (this.towers.length >= MAX_TOWERS) return 'full';
        const field = fieldFor(this.level);
        if (x < field.x + RADIUS || x > field.x + field.w - RADIUS || y < field.y + RADIUS || y > field.y + field.h - RADIUS) return 'edge';
        if (this.routes.some(r => r.segments.some(s => segmentDistance(x, y, s.a, s.b) < ROAD + RADIUS))) return 'road';
        const end = this.level.paths[0].at(-1);
        if (Math.hypot(x - end[0], y - end[1]) < 8) return 'saloon';
        if (this.towers.some(t => Math.hypot(x - t.x, y - t.y) < RADIUS * 2 + .7)) return 'tower';
        if (this.level.decor.some(d => d.kind === 'rock' && Math.hypot(d.x - x, d.y - y) < 4)) return 'rock';
        if (this.cash < TOWERS[kind].cost) return 'cash';
        return null;
    }
    place(kind, x, y) {
        const error = this.canPlace(kind, x, y); if (error) return { error };
        const tower = { id: this.nextId++, kind, x, y, rank: 0, branch: null, target: 'first', cooldown: 0, aim: -.8, recoil: 0, spent: TOWERS[kind].cost, kills: 0 };
        this.towers.push(tower); this.cash -= tower.spent; this.totalSpent += tower.spent; this.revision++;
        this.emit('build', x, y); this.sound('build'); return { tower };
    }
    upgrade(id, branch = 0) {
        const t = this.towers.find(t => t.id === id);
        if (!['build', 'wave'].includes(this.phase) || !t || t.rank >= 3 || ![0, 1].includes(branch)) return false;
        const cost = TOWERS[t.kind].upgrades[t.rank]; if (this.cash < cost) return false;
        if (t.rank === 1) t.branch = branch;
        t.rank++; t.spent += cost; this.cash -= cost; this.totalSpent += cost; this.revision++;
        this.emit('upgrade', t.x, t.y, { rank: t.rank, life: .6 }); this.sound('build'); return true;
    }
    sell(id) {
        const t = this.towers.find(t => t.id === id); if (!t || !['build', 'wave'].includes(this.phase)) return false;
        this.cash += this.refund(t); this.towers = this.towers.filter(v => v !== t); this.revision++; this.sound('coin'); return true;
    }
    refund(t) { return this.phase === 'build' && this.wave === 0 ? t.spent : Math.floor(t.spent * .75); }
    startWave() {
        if (this.phase !== 'build' || this.wave >= this.level.waves.length) return false;
        this.checkpoint = this.snapshot(); this.queue = schedule(this.level.waves[this.wave]); this.spawnIndex = 0;
        this.waveTime = 0; this.accumulator = 0; this.phase = 'wave'; this.paused = false; this.sound('bell'); this.revision++; return true;
    }
    spawn(item) {
        const type = ENEMIES[item.kind], route = this.routes[item.route];
        this.enemies.push({ id: this.nextId++, kind: item.kind, route: item.route, progress: 0, ...position(route, 0), hp: type.hp, maxHp: type.hp,
            speed: type.speed, armor: type.armor, loot: type.loot, bounty: type.bounty, slow: 1, slowTime: 0, mark: 1, markTime: 0, flash: 0, bloodAt: -1 });
    }
    damage(e, amount, pierce = 0, towerId, impact = true) {
        if (e.hp <= 0) return;
        e.hp -= Math.max(amount * .18, amount - Math.max(0, e.armor - pierce)) * e.mark; e.flash = .1;
        // A short, shared burst per bandit keeps rapid fire from filling the trail.
        if (impact && amount > 0 && e.kind !== 'wagon' && this.time - e.bloodAt >= .2) {
            const source = this.towers.find(t => t.id === towerId);
            const height = e.kind === 'rider' ? 3.3 : e.kind === 'baron' ? 2.9 : e.kind === 'brute' ? 2.4 : 1.9;
            this.emit('blood', e.x, e.y - height, { life: .28, angle: source ? Math.atan2(e.y - source.y, e.x - source.x) : e.angle });
            e.bloodAt = this.time;
        }
        if (e.hp <= 0) {
            this.cash += e.bounty; this.kills++; const tower = this.towers.find(t => t.id === towerId); if (tower) tower.kills++;
            const direction = Math.sign(tower ? e.x - tower.x : Math.cos(e.angle)) || (e.id % 2 ? 1 : -1);
            this.emit('death', e.x, e.y, { enemyKind: e.kind, direction, life: .55 }); this.sound('pop');
        }
    }
    targetList(t, s) {
        const list = this.enemies.filter(e => e.hp > 0 && distance(e, t) <= s.range);
        const remaining = e => (this.routes[e.route].length - e.progress) / e.speed;
        list.sort((a, b) => (t.target === 'strong' ? b.hp - a.hp : t.target === 'last' ? remaining(b) - remaining(a) : remaining(a) - remaining(b)) || a.id - b.id);
        return list;
    }
    attack(t, s, targets) {
        const e = targets[0]; t.aim = Math.atan2(e.y - t.y, e.x - t.x); t.recoil = .18;
        if (t.kind === 'dynamite') {
            // Lead by travel time, then lock the landing marker: an actual ground
            // projectile, with predictable misses if a fast rider leaves its area.
            if (this.shots.length >= 64) return;
            const travel = .55, aim = position(this.routes[e.route], e.progress + e.speed * e.slow * travel);
            this.shots.push({ x: t.x, y: t.y, tx: aim.x, ty: aim.y, age: 0, life: travel, damage: s.damage, radius: s.splash, fire: s.fire, towerId: t.id });
        } else {
            for (const enemy of targets.slice(0, s.targets)) {
                this.damage(enemy, s.damage, s.pierce, t.id, t.kind !== 'lasso');
                if (s.slow) {
                    enemy.slow = Math.min(enemy.slow, s.slow); enemy.slowTime = Math.max(enemy.slowTime, s.duration);
                    enemy.mark = Math.max(enemy.mark, s.mark); enemy.markTime = Math.max(enemy.markTime, s.duration);
                }
                this.emit(t.kind === 'lasso' ? 'rope' : 'shot', t.x, t.y - 2, { tx: enemy.x, ty: enemy.y - 1.5, life: t.kind === 'lasso' ? .3 : .13, color: TOWERS[t.kind].color });
            }
        }
        this.sound(t.kind === 'dynamite' ? 'throw' : t.kind === 'lasso' ? 'rope' : 'shot');
    }
    step() {
        this.time += STEP; this.waveTime += STEP; this.saloonHit = Math.max(0, this.saloonHit - STEP);
        this.effects.forEach(e => { e.age += STEP; }); this.effects = this.effects.filter(e => e.age < e.life);
        while (this.spawnIndex < this.queue.length && this.queue[this.spawnIndex].at <= this.waveTime && this.enemies.length < MAX_ENEMIES) this.spawn(this.queue[this.spawnIndex++]);
        for (const e of this.enemies) {
            e.flash = Math.max(0, e.flash - STEP); e.slowTime -= STEP; e.markTime -= STEP;
            if (e.slowTime <= 0) e.slow = 1; if (e.markTime <= 0) e.mark = 1;
        }
        for (const shot of this.shots) {
            shot.age += STEP;
            if (shot.age >= shot.life) {
                for (const e of this.enemies) if (distance(e, { x: shot.tx, y: shot.ty }) <= shot.radius) this.damage(e, shot.damage, 99, shot.towerId);
                this.emit('burst', shot.tx, shot.ty, { radius: shot.radius }); this.sound('boom');
                if (shot.fire && this.fires.length < 24) this.fires.push({ x: shot.tx, y: shot.ty, radius: shot.radius, life: 3, damage: shot.fire, towerId: shot.towerId });
            }
        }
        this.shots = this.shots.filter(s => s.age < s.life);
        for (const fire of this.fires) {
            fire.life -= STEP;
            for (const e of this.enemies) if (distance(e, fire) <= fire.radius) this.damage(e, fire.damage * STEP, 99, fire.towerId, false);
        }
        this.fires = this.fires.filter(f => f.life > 0);
        const bands = this.towers.filter(t => t.kind === 'banjo').map(t => ({ t, s: stats(t) }));
        for (const t of this.towers) {
            t.recoil = Math.max(0, t.recoil - STEP); const s = stats(t);
            const aura = bands.reduce((n, band) => distance(t, band.t) <= band.s.range ? Math.max(n, band.s.aura) : n, 1);
            t.cooldown = Math.max(0, t.cooldown - STEP * aura);
            if (t.kind === 'banjo' || t.cooldown > 0) continue;
            const targets = this.targetList(t, s); if (!targets.length) continue;
            this.attack(t, s, targets); t.cooldown = s.interval;
        }
        for (const e of this.enemies) {
            if (e.hp <= 0) continue;
            e.progress += e.speed * e.slow * STEP;
            Object.assign(e, position(this.routes[e.route], e.progress));
            if (e.progress >= this.routes[e.route].length) {
                this.gold = Math.max(0, this.gold - e.loot); this.stolen += e.loot; e.hp = 0; this.saloonHit = .7;
                this.emit('steal', e.x, e.y, { value: e.loot, life: .8 }); this.sound('hurt');
            }
        }
        this.enemies = this.enemies.filter(e => e.hp > 0);
        if (this.gold <= 0) { this.phase = 'lost'; this.revision++; this.sound('lose'); }
        else if (this.spawnIndex === this.queue.length && !this.enemies.length && !this.shots.length) {
            const bonus = 32 + this.wave * 2 + bands.reduce((n, b) => n + b.s.income, 0);
            this.cash += bonus; this.wave++; this.fires = []; this.effects = this.effects.filter(e => e.kind === 'death'); this.revision++;
            this.phase = this.wave >= this.level.waves.length ? 'won' : 'build';
            this.checkpoint = this.snapshot(); this.sound(this.phase === 'won' ? 'win' : 'coin');
        }
    }
    tick(dt) {
        if (!Number.isFinite(dt) || dt <= 0 || this.paused) return;
        // Finish cosmetic animations after the last bandit without advancing combat.
        if (this.phase !== 'wave') { this.effects.forEach(e => { e.age += Math.min(dt, .1); }); this.effects = this.effects.filter(e => e.age < e.life); return; }
        this.accumulator += Math.min(dt, .1) * this.speed;
        while (this.accumulator + 1e-9 >= STEP && this.phase === 'wave') { this.accumulator -= STEP; this.step(); }
    }
    stars() { return this.phase !== 'won' ? 0 : this.stolen === 0 ? 3 : this.gold >= this.level.gold / 2 ? 2 : 1; }
    snapshot() {
        return { version: 1, level: clone(this.level), cash: this.cash, gold: this.gold, wave: this.wave, kills: this.kills, stolen: this.stolen,
            towers: this.towers.map(t => ({ kind: t.kind, x: t.x, y: t.y, rank: t.rank, branch: t.branch, target: t.target })) };
    }
    static restore(raw) {
        if (!raw || raw.version !== 1 || !validateLevel(raw.level).level || !Number.isInteger(raw.wave) || raw.wave < 0 || raw.wave >= raw.level.waves.length ||
            !Number.isInteger(raw.cash) || raw.cash < 0 || raw.cash > 100000 || !Number.isInteger(raw.gold) || raw.gold < 1 || raw.gold > raw.level.gold ||
            !Number.isInteger(raw.stolen) || raw.stolen < 0 || raw.stolen > 1000 || !Number.isInteger(raw.kills) || raw.kills < 0 || raw.kills > 10000 ||
            !Array.isArray(raw.towers) || raw.towers.length > MAX_TOWERS) return null;
        try {
            const run = new Defense(raw.level); run.cash = 100000;
            for (const t of raw.towers) {
                if (!Number.isInteger(t.rank) || t.rank < 0 || t.rank > 3 || (t.rank < 2 ? t.branch !== null : ![0, 1].includes(t.branch)) || !['first', 'last', 'strong'].includes(t.target)) return null;
                const placed = run.place(t.kind, t.x, t.y).tower; if (!placed) return null;
                for (let i = 0; i < t.rank; i++) run.upgrade(placed.id, t.branch || 0);
                placed.target = t.target;
            }
            Object.assign(run, { cash: raw.cash, gold: raw.gold, wave: raw.wave, kills: raw.kills, stolen: raw.stolen, effects: [], events: [], revision: 0 });
            run.checkpoint = run.snapshot(); return run;
        } catch (_) { return null; }
    }
}
module.exports = { Defense, position, routeData, segmentDistance, schedule, STEP, MAX_TOWERS, MAX_ENEMIES };
