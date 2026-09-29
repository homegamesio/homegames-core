const { C, WEAPONS } = require('./settings');
const TAU = Math.PI * 2;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const slot = items => items.find(v => v.life <= 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function segmentDistance(x, y, xx, yy, p) {
    const dx = xx - x, dy = yy - y;
    const t = clamp(((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(x + dx * t - p.x, y + dy * t - p.y);
}

// Reusable combat verbs. Engine owns the lifecycle and calls these methods;
// neither this module nor the simulation depends on rendering or a browser.
class CombatSystems {
    addFlux(amount) {
        if (this.overload > 0) return;
        const was = this.flux;
        this.flux = Math.min(100, this.flux + amount * (this.upgrades.battery ? 1.5 : 1));
        if (was < 100 && this.flux >= 100) { this.label(this.player.x, this.player.y - 4, 'Q / OVERLOAD READY', C.violet); this.emitSound('charged'); }
    }
    activateOverload() {
        if (this.phase !== 'combat' || this.paused || this.mission.finishTimer > 0 || this.flux < 100 || this.overload > 0) return false;
        this.flux = 0; this.overload = this.upgrades.battery ? 7 : 5;
        this.player.inv = Math.max(this.player.inv, .5);
        for (const b of this.hostile) b.life = 0;
        for (const h of this.hazards) h.life = 0;
        this.explode(this.player.x, this.player.y, 14, 6, C.violet, 'overload');
        this.banner = 'OVERLOAD / WEAPONS UNBOUND'; this.bannerTime = 1.8;
        this.emitSound('overload'); return true;
    }
    fireWeapon() {
        const p = this.player, w = WEAPONS.find(w => w.id === this.weapon) || WEAPONS[0];
        p.shot = w.interval * (this.upgrades.rapid ? .78 : 1) * (this.overload > 0 ? .62 : 1);
        p.recoil = w.id === 'needle' ? .5 : .95;
        const count = this.upgrades.split ? Math.ceil(w.count * 1.5) : w.count;
        for (let i = 0; i < count; i++) {
            const b = slot(this.bullets); if (!b) break;
            const a = p.aim + (count > 1 ? (i / (count - 1) - .5) * (w.spread || .08) : 0);
            const spread = count > 1 && w.id !== 'scatter' ? (i % 2 ? .38 : -.38) : 0;
            Object.assign(b, { x: p.x + Math.cos(a) * 1.7 - Math.sin(a) * spread,
                y: p.y + Math.sin(a) * 1.7 + Math.cos(a) * spread,
                vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, angle: a, life: w.life,
                damage: w.damage * (1 + .25 * (this.upgrades.power || 0)) * (this.upgrades.split ? .8 : 1),
                pierce: w.pierce + (this.upgrades.pierce ? 2 : 0) + (this.overload > 0 ? 1 : 0),
                hitIds: [], bounce: this.upgrades.ricochet ? 1 : 0, armorPiercing: w.id === 'lance',
                color: this.overload > 0 ? C.violet : w.color, width: w.id === 'lance' ? .52 : w.id === 'scatter' ? .33 : .27,
                trail: w.id === 'lance' ? 5 : 2.8, source: 'weapon' });
        }
        this.burst(p.x + Math.cos(p.aim) * 2, p.y + Math.sin(p.aim) * 2, w.color, w.id === 'needle' ? 1 : 4, 9);
        this.emitSound(w.id === 'needle' ? 'shot' : w.id);
    }
    hitTarget(target, damage, source = 'weapon', projectile = null) {
        if (target.hp <= 0 || (target.life !== undefined && target.life <= 0)) return false;
        if (target === this.boss && (this.structures.some(s => s.hp > 0) || target.transition > 0)) {
            target.flash = .5; this.burst(target.x, target.y, C.blue, 2, 12); return false;
        }
        const enemy = this.enemies.includes(target), direct = source === 'weapon' || source === 'drone';
        if (enemy && direct && target.type !== 'warden' && this.enemies.some(w => w.life > 0 && w.spawn <= 0 && w.type === 'warden' && w !== target && distance(w, target) < 14)) {
            damage *= .35; target.shieldFlash = .2;
        }
        if (enemy && target.type === 'heavy' && direct && !projectile?.armorPiercing) {
            const angle = projectile ? projectile.angle + Math.PI : Math.atan2(this.player.y - target.y, this.player.x - target.x);
            const difference = Math.abs(Math.atan2(Math.sin(angle - target.angle), Math.cos(angle - target.angle)));
            if (difference < 1.15) { damage *= .3; target.shieldFlash = .2; }
            else damage *= 1.6;
        }
        target.hp -= damage; target.flash = 1;
        if (enemy) {
            if (projectile) { target.vx += projectile.vx * .03; target.vy += projectile.vy * .03; }
            if (this.upgrades.frost && direct) target.chill = 1;
        }
        this.burst(target.x, target.y, target.color || C.cyan, source === 'dash' ? 7 : 2, 15);
        if (this.upgrades.arc && direct && this.arcCooldown <= 0 && enemy) {
            const next = this.enemies.filter(e => e !== target && e.life > 0 && e.spawn <= 0 && distance(e, target) < 13)
                .sort((a, b) => distance(a, target) - distance(b, target))[0];
            if (next) {
                this.arcCooldown = .12; this.link(target.x, target.y, next.x, next.y, C.blue);
                this.hitTarget(next, 1.4, 'arc'); this.emitSound('arc');
            }
        }
        if (target.hp <= 0) this.destroy(target);
        return true;
    }
    link(x, y, xx, yy, color) {
        const l = slot(this.links); if (l) Object.assign(l, { x, y, xx, yy, color, life: .16, max: .16 });
    }
    explode(x, y, radius, damage, color = C.orange, source = 'explosion') {
        this.burst(x, y, color, 18, 40); this.ring(x, y, color, radius, .38);
        this.shake = Math.max(this.shake, .48); this.emitSound('boom');
        // Queue chain reactions; never recursively walk a changing object pool.
        this.blasts.push({ x, y, radius, damage, source });
    }
    updateAbilities(dt) {
        this.overload = Math.max(0, this.overload - dt); this.arcCooldown = Math.max(0, this.arcCooldown - dt);
        this.chainTime = Math.max(0, this.chainTime - dt);
        if (!this.chainTime) this.chain = 0;
        if (this.owned('reactor')) this.addFlux(dt * 2);
        if (this.practice) this.addFlux(dt * 5);
        for (const l of this.links) l.life = Math.max(0, l.life - dt);
        // At most 64 deaths in a frame, even with overlapping fuel and detonation.
        for (let i = 0; this.blasts.length && i < 64; i++) {
            const blast = this.blasts.shift();
            const targets = this.enemies.filter(e => e.life > 0 && e.spawn <= 0).concat(this.barrels.filter(b => b.hp > 0));
            for (const target of targets) if (distance(blast, target) < blast.radius + target.r) this.hitTarget(target, blast.damage, blast.source);
            if (this.boss && this.boss.hp > 0 && distance(blast, this.boss) < blast.radius + this.boss.r) this.hitTarget(this.boss, blast.damage * .5, blast.source);
        }
        this.droneShot -= dt;
        if (this.owned('foundry') && this.droneShot <= 0) {
            const p = this.player, target = this.enemies.filter(e => e.life > 0 && e.spawn <= 0).sort((a, b) => distance(a, p) - distance(b, p))[0] || this.structures.find(s => s.hp > 0) || this.boss;
            if (target && target.hp > 0) {
                this.droneShot = .55; const a = this.time * 1.8, x = p.x + Math.cos(a) * 3, y = p.y + Math.sin(a) * 3;
                const b = slot(this.bullets), aim = Math.atan2(target.y - y, target.x - x);
                if (b) Object.assign(b, { x, y, vx: Math.cos(aim) * 125, vy: Math.sin(aim) * 125, angle: aim,
                    life: 1.2, damage: .9, pierce: 0, hitIds: [], bounce: 0, armorPiercing: false, color: C.yellow, width: .22, trail: 2, source: 'drone' });
            }
        }
    }
    dashContacts(x, y, xx, yy) {
        const p = this.player;
        for (const e of this.enemies) {
            if (e.life <= 0 || e.spawn > 0 || e.lastDash === p.dashSerial) continue;
            if (segmentDistance(x, y, xx, yy, e) < e.r + 1) {
                e.lastDash = p.dashSerial; e.stun = .35;
                this.hitTarget(e, this.upgrades.blade ? 8 : 2, 'dash');
                this.addFlux(5); this.link(x, y, xx, yy, C.cyan); this.emitSound('slice');
            }
        }
        let absorbed = 0;
        for (const b of this.hostile) if (b.life > 0 && segmentDistance(x, y, xx, yy, b) < 2.2) { b.life = 0; absorbed++; }
        if (absorbed) { this.addFlux(absorbed * 3); this.burst(p.x, p.y, C.violet, 5, 14); this.label(p.x, p.y - 3, 'ABSORB +'+absorbed * 3, C.violet); }
    }
    hazard(kind, x, y, angle = 0, owner = 0, options = {}) {
        const h = slot(this.hazards); if (!h) return false;
        const warn = kind === 'beam' ? .9 : 1.15, active = kind === 'beam' ? .22 : .2;
        Object.assign(h, { kind, x, y, angle, owner, age: 0, warn, active, r: kind === 'beam' ? .55 : 5,
            length: kind === 'beam' ? 160 : 0, life: warn + active, fired: false, ...options });
        return true;
    }
    updateHazards(dt) {
        for (const h of this.hazards) {
            if (h.life <= 0) continue;
            if (h.owner && !this.enemies.some(e => e.life > 0 && e.id === h.owner)) { h.life = 0; continue; }
            h.age += dt; h.life -= dt;
            if (h.age < h.warn) continue;
            if (!h.fired) {
                h.fired = true; this.emitSound(h.kind === 'beam' ? 'laser' : 'mine');
                if (h.kind !== 'beam') { this.ring(h.x, h.y, C.orange, h.r, .3); this.burst(h.x, h.y, C.orange, 8, 22); }
            }
            const p = this.player;
            const hit = h.kind === 'beam' ? segmentDistance(h.x, h.y, h.x + Math.cos(h.angle) * h.length, h.y + Math.sin(h.angle) * h.length, p) < h.r + .6 : distance(h, p) < h.r + .6;
            if (hit) this.damagePlayer(h);
        }
    }
    specialEnemy(e, dt, tx, ty) {
        const p = this.player, d = distance(e, p) || 1;
        if (e.type === 'charger') {
            if (e.attack === 'windup') {
                tx = ty = 0; e.timer -= dt;
                if (e.timer <= 0) { e.attack = 'charge'; e.timer = .46; this.emitSound('charge'); }
            } else if (e.attack === 'charge') {
                tx = Math.cos(e.lockAngle) * 7.5; ty = Math.sin(e.lockAngle) * 7.5;
                e.timer -= dt;
                if (e.timer <= 0) { e.attack = 'recover'; e.timer = .85; }
            } else if (e.attack === 'recover') {
                tx *= .15; ty *= .15; e.timer -= dt;
                if (e.timer <= 0) { e.attack = 'idle'; e.shot = .7; }
            } else if (e.shot <= 0 && d < 65) { e.attack = 'windup'; e.timer = .7; e.lockAngle = e.angle; }
        } else if (e.type === 'sniper') {
            tx *= d < 32 ? -.4 : d > 55 ? .6 : 0; ty *= d < 32 ? -.4 : d > 55 ? .6 : 0;
            if (e.shot <= 0) { this.hazard('beam', e.x, e.y, e.angle, e.id); e.shot = 3.4; }
        } else if (e.type === 'warden') {
            tx *= d < 25 ? -.3 : .5; ty *= d < 25 ? -.3 : .5;
            e.protected = this.enemies.filter(o => o !== e && o.type !== 'warden' && o.life > 0 && o.spawn <= 0 && distance(o, e) < 14).slice(0, 3).map(o => o.id);
        } else if (e.type === 'bomber') {
            const dx = tx, dy = ty, approach = d < 18 ? -.35 : .4;
            tx = dx * approach - dy * .8; ty = dy * approach + dx * .8;
            if (e.shot <= 0) {
                this.hazard('mine', clamp(p.x + p.vx * .35, 10, 150), clamp(p.y + p.vy * .35, 20, 73)); e.shot = 2.8;
            }
        } else if (e.type === 'leech') {
            const gem = this.gems.filter(g => g.life > 0).sort((a, b) => distance(e, a) - distance(e, b))[0];
            if (e.stolen >= 5) {
                const exit = e.x < 80 ? 6 : 154; tx = Math.sign(exit - e.x); ty = 0;
                if (e.x < 8 || e.x > 152) { e.life = 0; this.world.reserves = Math.min(30, this.world.reserves + 2); this.label(e.x, e.y, '+2 ENEMY RESERVES', C.red); }
            } else if (gem) {
                const dist = distance(gem, e) || 1; tx = (gem.x - e.x) / dist; ty = (gem.y - e.y) / dist;
                if (dist < 1.4) { gem.life = 0; e.stolen++; this.link(e.x, e.y, gem.x, gem.y, C.green); }
            } else { tx *= .6; ty *= .6; }
        }
        return [tx, ty];
    }
}
module.exports = CombatSystems;
