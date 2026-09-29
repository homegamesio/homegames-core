const { BOUNDS: B, UPGRADES } = require('./settings');
const TAU = Math.PI * 2;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const neutral = () => ({ x: 0, y: 0, ax: 0, ay: 0, catch: false, fire: false, dash: false, nova: false });
function segmentDistance(x, y, xx, yy, p) {
    const dx = xx - x, dy = yy - y, len = dx * dx + dy * dy;
    const t = len ? clamp(((p.x - x) * dx + (p.y - y) * dy) / len, 0, 1) : 0;
    return Math.hypot(p.x - x - dx * t, p.y - y - dy * t);
}

// Pure simulation: no Squish, browser, wall clock, or platform dependencies.
class Engine {
    constructor(seed = 1) {
        this.seed = seed >>> 0; this.phase = 'title'; this.time = 0; this.uiTime = 0;
        this.best = 0; this.sound = true; this.reduced = false; this.input = neutral();
        this.events = []; this.selected = 0; this.enemies = []; this.bullets = []; this.shots = [];
        this.particles = []; this.rings = []; this.beams = []; this.upgrades = new Set();
        this.player = this.newPlayer(); this.score = 0; this.sector = 0; this.paused = false; this.combo = 0;
        this.stats = { catches: 0, perfect: 0, returns: 0, kills: 0, hits: 0 };
    }
    random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
    newPlayer() {
        return { x: 40, y: 47, vx: 0, vy: 0, angle: 0, hp: 6, maxHp: 6, orbit: [], capacity: 6,
            inv: 0, dash: 0, dashCooldown: 0, shotCooldown: 0, captureAge: 10, catching: false, energy: 0 };
    }
    start(practice = false) {
        this.phase = 'play'; this.paused = false; this.practice = practice; this.input = neutral();
        this.player = this.newPlayer(); this.time = 0; this.score = 0; this.sector = 0; this.combo = 0;
        this.stats = { catches: 0, perfect: 0, returns: 0, kills: 0, hits: 0 };
        this.upgrades.clear(); this.training = 0; this.trainingMove = 0;
        this.enterSector(); this.emit('launch');
    }
    enterSector() {
        this.enemies = []; this.bullets = []; this.shots = []; this.beams = []; this.particles = []; this.rings = [];
        this.boss = null; this.sectorTime = 0; this.spawnClock = this.practice ? 0 : 2.5;
        this.spawned = 0; this.reserve = this.sector === 0 ? 10 : this.sector === 1 ? 15 : 0;
        this.clearTime = 0; this.banner = 3; this.selected = 0;
        Object.assign(this.player, { x: 40, y: 47, vx: 0, vy: 0, inv: 2, dash: 0, catching: false });
        this.input = neutral();
        if (this.practice) { this.reserve = 0; this.spawn('turret', 97, 47); }
        else if (this.sector === 2) { this.boss = this.spawn('boss', 101, 47); this.boss.hp = this.boss.maxHp = 160; }
    }
    emit(name) { if (this.events.length < 24) this.events.push(name); }
    ring(x, y, color, max = 12) {
        if (this.rings.length >= 10) this.rings.shift();
        this.rings.push({ x, y, color, r: 1, max, life: .5, total: .5 });
    }
    burst(x, y, color, count = 9) {
        for (let i = 0; i < count && this.particles.length < 60; i++) {
            const a = this.random() * TAU, speed = 5 + this.random() * 22;
            this.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
                life: .25 + this.random() * .4, color });
        }
    }
    addScore(points) { this.score += Math.round(points * (1 + Math.min(4, Math.floor(this.combo / 4)))); }
    charge(amount) { this.player.energy = Math.min(100, this.player.energy + amount * (this.upgrades.has('nova') ? 1.5 : 1)); }
    spawn(type, x, y) {
        const hp = { turret: 9, drifter: 7, hunter: 5, lance: 13, boss: 160 }[type];
        const e = { type, x, y, hp, maxHp: hp, r: type === 'boss' ? 6 : type === 'hunter' ? 1.6 : 2.3,
            warm: 1.1, cooldown: 1.2 + this.random() * .8, age: 0, flash: 0, serial: this.spawned++ };
        this.enemies.push(e); return e;
    }
    enemyShot(e, angle, speed = 22, heavy = false) {
        if (this.bullets.length >= 92) return;
        this.bullets.push({ x: e.x, y: e.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            life: 8, heavy, r: heavy ? .85 : .55 });
    }
    damage(e, amount) {
        if (e.hp <= 0 || e.warm > 0) return;
        e.hp -= amount; e.flash = .09;
        if (e.hp <= 0) {
            this.stats.kills++; this.combo++; this.addScore(e.type === 'boss' ? 2500 : 100);
            this.charge(e.type === 'hunter' ? 8 : 5); this.burst(e.x, e.y, e.type === 'boss' ? 'gold' : 'red', 16);
            this.ring(e.x, e.y, 'gold', e.type === 'boss' ? 35 : 9); this.emit('kill');
            if (e.type === 'boss') { this.finish(true); }
        }
    }
    hurt() {
        const p = this.player;
        if (p.inv > 0 || this.practice || this.phase !== 'play') return;
        p.hp--; p.inv = 1.2; this.stats.hits++; this.combo = 0; this.shake = .32;
        this.burst(p.x, p.y, 'red'); this.emit('hurt');
        if (p.hp <= 0) this.finish(false);
    }
    finish(won) {
        this.phase = won ? 'won' : 'dead'; this.best = Math.max(this.best, this.score);
        this.input = neutral(); this.player.catching = false; this.selected = 0; this.emit(won ? 'win' : 'lose');
    }
    shoot() {
        const p = this.player;
        if (p.shotCooldown > 0 || this.shots.length >= 48) return;
        const ammo = p.orbit.shift(), returned = !!ammo;
        const damage = returned ? (ammo.perfect ? 7 : 4) * (this.upgrades.has('power') ? 1.5 : 1) : .9;
        this.shots.push({ x: p.x + Math.cos(p.angle) * 2, y: p.y + Math.sin(p.angle) * 2,
            vx: Math.cos(p.angle) * (returned ? 95 : 80), vy: Math.sin(p.angle) * (returned ? 95 : 80),
            life: 1.8, damage, returned, perfect: !!(ammo && ammo.perfect),
            pierce: ammo && ammo.perfect && this.upgrades.has('power') ? 2 : 1, hit: [] });
        p.shotCooldown = returned ? .14 : .19;
        if (returned) { this.stats.returns++; this.emit('return'); } else this.emit('pulse');
    }
    dash() {
        const p = this.player, input = this.input;
        if (p.dashCooldown > 0) return false;
        const angle = Math.hypot(input.x, input.y) > .2 ? Math.atan2(input.y, input.x) : p.angle;
        p.vx = Math.cos(angle) * 88; p.vy = Math.sin(angle) * 88;
        p.dash = .17; p.inv = Math.max(p.inv, .26); p.dashCooldown = this.upgrades.has('dash') ? .78 : 1.2;
        this.ring(p.x, p.y, 'teal', 6); this.emit('dash');
        if (this.upgrades.has('dash')) {
            this.ring(p.x, p.y, 'blue', 12);
            for (const e of this.enemies) if (distance(e, p) < 12) this.damage(e, 5);
            this.bullets = this.bullets.filter(b => distance(b, p) > 12);
        }
        return true;
    }
    nova() {
        const p = this.player;
        if (p.energy < 100) return false;
        p.energy = 0; p.inv = Math.max(p.inv, .8); this.shake = .25;
        this.ring(p.x, p.y, 'teal', 90); this.burst(p.x, p.y, 'teal', 22); this.emit('nova');
        this.bullets = []; this.beams = [];
        for (const e of this.enemies) this.damage(e, e.type === 'boss' ? 22 : 14);
        if (this.upgrades.has('nova')) {
            p.hp = Math.min(p.maxHp, p.hp + 1);
            while (p.orbit.length < p.capacity) p.orbit.push({ perfect: false });
        }
        return true;
    }
    capture(b) {
        const p = this.player, perfect = p.captureAge < .22;
        p.orbit.push({ perfect }); b.life = 0; this.stats.catches++; this.combo++;
        this.charge(perfect ? 16 : 7); this.addScore(perfect ? 40 : 15);
        if (perfect) {
            this.stats.perfect++; this.perfectFlash = .7; this.emit('perfect');
            this.ring(p.x, p.y, 'gold', 9);
            if (this.upgrades.has('hull')) p.hp = Math.min(p.maxHp, p.hp + .25);
        } else this.emit('catch');
        this.burst(b.x, b.y, perfect ? 'gold' : 'teal', 3);
    }
    updateProjectiles(dt) {
        const p = this.player, radius = this.upgrades.has('capacity') ? 8 : 6.5;
        for (const b of this.bullets) {
            const x = b.x, y = b.y; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
            const d = segmentDistance(x, y, b.x, b.y, p);
            const a = Math.atan2(y - p.y, x - p.x) - p.angle;
            if (!b.heavy && p.catching && p.orbit.length < p.capacity && d <= radius && Math.cos(a) > Math.cos(1.06)) this.capture(b);
            if (b.life > 0 && d < 1.35 + b.r) { this.hurt(); b.life = 0; }
            if (b.x < B.left || b.x > B.right || b.y < B.top || b.y > B.bottom) b.life = 0;
        }
        for (const s of this.shots) {
            const x = s.x, y = s.y; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
            for (const e of this.enemies) {
                if (s.life <= 0 || e.hp <= 0 || s.hit.includes(e) || e.warm > 0) continue;
                if (segmentDistance(x, y, s.x, s.y, e) < e.r + .5) {
                    const shield = e.type === 'boss' && this.sectorTime % 9 < 5;
                    this.damage(e, s.damage * (e.type !== 'boss' ? 1 : shield ? (s.returned ? 1 : .4) : 1.5));
                    s.hit.push(e); if (--s.pierce <= 0) s.life = 0;
                    this.burst(s.x, s.y, s.returned ? 'teal' : 'blue', 2);
                }
            }
            if (s.x < B.left || s.x > B.right || s.y < B.top || s.y > B.bottom) s.life = 0;
        }
        this.bullets = this.bullets.filter(b => b.life > 0); this.shots = this.shots.filter(s => s.life > 0);
    }
    updateEnemies(dt) {
        const p = this.player;
        for (const e of this.enemies) {
            if (e.hp <= 0) continue;
            e.age += dt; e.warm -= dt; e.flash = Math.max(0, e.flash - dt);
            if (e.warm > 0) continue;
            const angle = Math.atan2(p.y - e.y, p.x - e.x), d = distance(e, p);
            if (e.type === 'hunter') {
                e.x += Math.cos(angle) * 11 * dt; e.y += Math.sin(angle) * 11 * dt;
            } else if (e.type === 'drifter') {
                e.x += (Math.cos(angle) * (d > 30 ? 3 : -3) + Math.cos(angle + Math.PI / 2) * 5) * dt;
                e.y += (Math.sin(angle) * (d > 30 ? 3 : -3) + Math.sin(angle + Math.PI / 2) * 5) * dt;
            } else if (e.type === 'boss') e.y = 47 + Math.sin(e.age * .45) * 15;
            e.x = clamp(e.x, B.left + 3, B.right - 3); e.y = clamp(e.y, B.top + 3, B.bottom - 3);
            if (d < e.r + 1.3) this.hurt();
            e.cooldown -= dt;
            if (e.cooldown <= 0) {
                if (e.type === 'turret' || e.type === 'drifter') {
                    const spread = e.type === 'drifter' ? [-.16, 0, .16] : [0];
                    for (const offset of spread) this.enemyShot(e, angle + offset, this.practice ? 16 : 21 + this.sector * 3);
                    e.cooldown = this.practice ? 1.2 : 1.6;
                } else if (e.type === 'lance') {
                    this.beams.push({ x: e.x, y: e.y, angle, age: 0, duration: 1.25, fired: false });
                    this.enemyShot(e, angle - .3); this.enemyShot(e, angle + .3); e.cooldown = 3.6;
                } else if (e.type === 'boss') {
                    const furious = e.hp < e.maxHp * .5;
                    for (let i = 0; i < 12; i++) this.enemyShot(e, e.age * .42 + i * TAU / 12, furious ? 27 : 21);
                    for (let i = -1; i <= 1; i++) this.enemyShot(e, angle + i * .14, 28);
                    if (Math.floor(e.age) % 4 < 2 && this.beams.length < 3) {
                        this.beams.push({ x: e.x, y: e.y, angle, age: 0, duration: furious ? 1.05 : 1.4, fired: false });
                    }
                    e.cooldown = furious ? .95 : 1.35;
                } else e.cooldown = 2;
            }
        }
        for (const beam of this.beams) {
            beam.age += dt;
            if (beam.age >= beam.duration && !beam.fired) { beam.fired = true; this.emit('laser'); }
            if (beam.fired && beam.age < beam.duration + .24 && segmentDistance(beam.x, beam.y,
                beam.x + Math.cos(beam.angle) * 160, beam.y + Math.sin(beam.angle) * 160, p) < 2) this.hurt();
        }
        this.beams = this.beams.filter(b => b.age < b.duration + .3);
        this.enemies = this.enemies.filter(e => e.hp > 0);
    }
    completeSector() {
        this.phase = 'upgrade'; this.selected = 0; this.input = neutral(); this.player.catching = false;
        const available = UPGRADES.filter(u => !this.upgrades.has(u.id));
        for (let i = available.length - 1; i > 0; i--) {
            const j = Math.floor(this.random() * (i + 1)); [available[i], available[j]] = [available[j], available[i]];
        }
        this.choices = available.slice(0, 3); this.player.hp = Math.min(this.player.maxHp, this.player.hp + 2);
        this.emit('upgrade');
    }
    choose(index) {
        if (this.phase !== 'upgrade' || !this.choices[index]) return false;
        const id = this.choices[index].id; this.upgrades.add(id);
        if (id === 'capacity') this.player.capacity = 10;
        if (id === 'hull') { this.player.maxHp += 2; this.player.hp = this.player.maxHp; }
        this.sector++; this.phase = 'play'; this.enterSector(); this.emit('launch'); return true;
    }
    step(dt = 1 / 30) {
        dt = clamp(dt, 0, .05); this.uiTime += dt;
        if (this.phase !== 'play' || this.paused) return;
        this.time += dt; this.sectorTime += dt; this.banner = Math.max(0, this.banner - dt);
        this.shake = Math.max(0, (this.shake || 0) - dt); this.perfectFlash = Math.max(0, (this.perfectFlash || 0) - dt);
        const p = this.player, input = this.input;
        p.inv = Math.max(0, p.inv - dt); p.dash = Math.max(0, p.dash - dt);
        p.dashCooldown = Math.max(0, p.dashCooldown - dt); p.shotCooldown = Math.max(0, p.shotCooldown - dt);
        if (Math.hypot(input.ax, input.ay) > .2) p.angle = Math.atan2(input.ay, input.ax);
        if (input.catch && !p.catching) p.captureAge = 0; else p.captureAge += dt;
        p.catching = !!input.catch;
        if (input.dash) this.dash(); if (input.nova) this.nova(); input.dash = input.nova = false;
        if (p.dash <= 0) {
            const mag = Math.max(1, Math.hypot(input.x, input.y)), speed = input.catch ? 20 : 27;
            const f = 1 - Math.exp(-20 * dt);
            p.vx += (input.x / mag * speed - p.vx) * f; p.vy += (input.y / mag * speed - p.vy) * f;
        }
        p.x = clamp(p.x + p.vx * dt, B.left + 2, B.right - 2); p.y = clamp(p.y + p.vy * dt, B.top + 2, B.bottom - 2);
        if (input.fire) this.shoot();
        this.updateEnemies(dt); this.updateProjectiles(dt);
        for (const v of this.particles) { v.x += v.vx * dt; v.y += v.vy * dt; v.life -= dt; }
        this.particles = this.particles.filter(v => v.life > 0);
        for (const r of this.rings) { r.life -= dt; r.r = r.max * (1 - r.life / r.total); }
        this.rings = this.rings.filter(r => r.life > 0);
        if (this.phase !== 'play') return;
        if (this.practice) {
            this.trainingMove += Math.hypot(p.vx, p.vy) * dt;
            if (this.training === 0 && this.trainingMove > 12 && Math.abs(p.angle) > .2) this.training = 1;
            if (this.training === 1 && this.stats.catches >= 3) this.training = 2;
            if (this.training === 2 && this.stats.returns >= 3 && this.stats.kills > 0) this.training = 3;
            if (this.enemies.length === 0 && this.training < 3) this.spawn('turret', 97, 47);
        } else if (this.sector < 2) {
            this.spawnClock -= dt;
            if (this.reserve > 0 && this.spawnClock <= 0 && this.enemies.length < 7) {
                const side = this.spawned % 4;
                const x = side === 0 ? 116 : side === 1 ? 65 + this.random() * 40 : side === 2 ? 17 : 25 + this.random() * 80;
                const y = side === 0 || side === 2 ? 24 + this.random() * 46 : side === 1 ? 22 : 72;
                // Spawn telegraphs last over a second; never materialize on the ship.
                const type = this.sector === 1 && this.spawned % 4 === 3 ? 'lance' : this.spawned % 3 === 2 ? 'hunter' : this.spawned % 3 === 1 ? 'drifter' : 'turret';
                this.spawn(type, x, y); this.reserve--; this.spawnClock = this.sector === 0 ? 3.2 : 2.6;
            }
            if (this.reserve === 0 && this.enemies.length === 0) {
                this.clearTime += dt; if (this.clearTime > 1.1) this.completeSector();
            }
        }
    }
}
module.exports = { Engine, clamp, distance, segmentDistance, neutral };
