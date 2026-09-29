const { Engine, clamp, distance, segmentHit, lerpAngle } = require('./engine');
const { C, ENEMIES } = require('./settings');
const { FACTIONS, UNITS, SOCKETS } = require('./war-settings');
const TAU = Math.PI * 2;

// One persistent battlefield per outpost. The same movement, projectiles and
// damage rules run on the map and while the pilot is controlling their ship.
class WarBattle extends Engine {
    constructor(war, node) {
        super((war.seed + node.id * 173) >>> 0);
        this.war = war; this.outpost = node; this.campaignArena = true;
        this.units = []; this.enemies = []; this.allies = [];
        this.friendlyShots = Array.from({ length: 64 }, () => ({ life: 0 }));
        this.phase = 'combat'; this.practice = false; this.boss = null;
        this.mission = { type: 'foundry', mode: 'capture', time: 0, kills: 0, damage: 0 };
        this.core = { id: 'core:'+node.id, x: 80, y: 44, r: 4, hp: node.maxHp, maxHp: node.maxHp,
            type: 'command', color: FACTIONS[node.owner], faction: node.owner, flash: 0, shot: 1.5, life: 1 };
        this.structures = []; this.bannerTime = 0; this.manual = false; this.lastCombat = 0;
        this.barrels = [[29, 32], [130, 59]].map(([x, y], i) => ({ x, y, hp: 2, maxHp: 2, r: 1.1,
            id: 'fuel:'+node.id+':'+i, type: 'fuel', color: C.orange, flash: 0, life: 1 }));
    }
    owned(type) { return this.manual && type === 'reactor' && this.war.nodes.some(n => n.owner === 1 && n.type === 'reactor'); }
    addUnit(kind, faction, x, y, existing, socket = null) {
        if (this.units.filter(u => u.life > 0).length >= 40) return null;
        const spec = UNITS[kind];
        const unit = existing || { id: ++this.war.entityId, kind, type: spec.type, faction, hp: spec.hp, maxHp: spec.hp,
            r: spec.r, speed: spec.speed, life: 1, flash: 0, shieldFlash: 0, chill: 0, stun: 0, age: 0,
            angle: faction === 1 ? 0 : Math.PI, shot: this.rng() * .6 + .3, phase: this.rng() * TAU,
            attack: 'idle', spawn: .65, elite: false, lastDash: -1, protected: [], vx: 0, vy: 0, destroyed: false };
        unit.x = x; unit.y = y; unit.socket = socket; unit.color = FACTIONS[faction];
        unit.guardX = x; unit.guardY = y; this.units.push(unit); this.refresh(); return unit;
    }
    refresh() {
        this.enemies = this.units.filter(u => u.life > 0 && u.faction !== 1);
        this.allies = this.units.filter(u => u.life > 0 && u.faction === 1);
        this.structures = this.outpost.owner === 1 ? [] : [this.core];
    }
    force(faction, mobileOnly = false) {
        return this.units.filter(u => u.life > 0 && u.faction === faction && (!mobileOnly || !UNITS[u.kind].static));
    }
    power(faction) { return this.force(faction).reduce((sum, u) => sum + UNITS[u.kind].power * u.hp / u.maxHp, 0); }
    contested() { return this.units.some(u => u.life > 0 && u.faction !== this.outpost.owner) || (this.manual && this.outpost.owner !== 1); }
    shoot(source, target, damage, speed = 34) {
        const pool = source.faction === 1 ? this.friendlyShots : this.hostile, shot = pool.find(b => b.life <= 0);
        if (!shot) return;
        const angle = Math.atan2(target.y - source.y, target.x - source.x);
        Object.assign(shot, { x: source.x + Math.cos(angle) * source.r, y: source.y + Math.sin(angle) * source.r,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, angle, life: 3.5, damage,
            faction: source.faction, source: 'army', armorPiercing: source.kind === 'rail' });
        source.flash = Math.max(source.flash || 0, .18);
    }
    hitTarget(target, damage, source = 'weapon', projectile = null) {
        if (target.hp <= 0 || target.life <= 0 || target.destroyed) return false;
        const attacker = projectile?.faction ?? 1;
        if (target.faction === attacker) return false;
        const isUnit = this.units.includes(target), direct = ['weapon', 'army', 'drone'].includes(source);
        if (isUnit && direct && target.type !== 'warden' && this.units.some(w => w.life > 0 && w.spawn <= 0 && w.type === 'warden' && w.faction === target.faction && distance(w, target) < 14)) {
            damage *= .35; target.shieldFlash = .2;
        }
        if (isUnit && target.type === 'heavy' && direct && !projectile?.armorPiercing) {
            const angle = projectile ? projectile.angle + Math.PI : Math.atan2(this.player.y - target.y, this.player.x - target.x);
            const difference = Math.abs(Math.atan2(Math.sin(angle - target.angle), Math.cos(angle - target.angle)));
            damage *= difference < 1.15 ? .3 : 1.6;
            if (difference < 1.15) target.shieldFlash = .2;
        }
        target.hp -= damage; target.flash = 1; target.lastAttacker = attacker; target.lastSource = source; this.lastCombat = this.time;
        if (this.manual) {
            this.burst(target.x, target.y, target.color || C.orange, 2, 15);
            if (isUnit && source === 'weapon') {
                if (projectile) { target.vx += projectile.vx * .03; target.vy += projectile.vy * .03; }
                if (this.upgrades.frost) target.chill = 1;
                if (this.upgrades.arc && this.arcCooldown <= 0) {
                    const other = this.enemies.find(e => e !== target && e.life > 0 && e.spawn <= 0 && distance(e, target) < 13);
                    if (other) { this.arcCooldown = .12; this.link(target.x, target.y, other.x, other.y, C.blue); this.hitTarget(other, 1.4, 'arc'); this.emitSound('arc'); }
                }
            }
        }
        if (target.hp <= 0) this.destroy(target);
        return true;
    }
    destroy(target) {
        if (target.destroyed) return;
        if (target === this.core) { this.war.capture(this.outpost.id, target.lastAttacker ?? 1); return; }
        target.destroyed = true; target.hp = 0; target.life = 0;
        if (target.type === 'fuel') {
            // Fuel is a player opportunity, not a source of offscreen income.
            this.explode(target.x, target.y, 10, 14, C.orange, 'fuel');
            if (this.manual) this.label(target.x, target.y - 3, 'FUEL CHAIN', C.orange);
            return;
        }
        this.war.stats.losses[target.faction]++;
        if (target.socket !== null && target.socket !== undefined) this.outpost.sockets[target.socket] = null;
        if (target.type === 'warden') for (const unit of this.units)
            if (unit.life > 0 && unit.faction === target.faction && distance(unit, target) < 14) unit.stun = 1;
        if (!this.manual) return;
        this.burst(target.x, target.y, target.color, 16, 32); this.ring(target.x, target.y, target.color, target.type === 'heavy' ? 9 : 5, .4);
        this.shake = .4; this.emitSound(target.type === 'heavy' ? 'boom' : 'kill');
        if (target.faction === 1) return;
        this.kills++; this.mission.kills++; this.score += Math.round(60 * this.multiplier);
        this.combo = 5; this.addFlux(6); this.chain++; this.chainTime = 1.1; this.bestChain = Math.max(this.bestChain, this.chain);
        if (target.lastAttacker === 1 && target.lastSource !== 'army') this.war.stats.pilotKills++;
        if (this.chain >= 3) this.label(target.x, target.y - 3, this.chain+' CHAIN', C.yellow);
        for (let i = 0; i < (target.type === 'heavy' ? 5 : 2); i++) {
            const gem = this.gems.find(g => g.life <= 0); if (!gem) break;
            const angle = this.rng() * TAU;
            Object.assign(gem, { x: target.x, y: target.y, vx: Math.cos(angle) * 10, vy: Math.sin(angle) * 10, life: 18, angle });
        }
        if (target.type === 'warden') {
            for (const unit of this.units) if (unit.life > 0 && unit.faction === target.faction && distance(unit, target) < 14) unit.stun = 1;
            this.ring(target.x, target.y, C.blue, 14, .45); this.label(target.x, target.y - 3, 'SHIELD COLLAPSE', C.blue);
        }
        if (this.upgrades.volatile) this.explode(target.x, target.y, 6.5, 3, C.orange, 'detonation');
    }
    damagePlayer(source) {
        if (!this.manual || this.player.inv > 0 || this.war.result) return;
        this.player.hp--; this.player.inv = 1.3; this.multiplier = Math.max(1, Math.floor(this.multiplier / 2));
        this.flash = .6; this.shake = 1; this.emitSound('hurt'); this.mission.damage++;
        if (this.player.hp <= 0) this.war.losePilot();
    }
    updateArmy(dt) {
        const fighters = this.units.filter(u => u.life > 0);
        for (const u of fighters) {
            u.age += dt; u.flash = Math.max(0, u.flash - dt * 7); u.shieldFlash = Math.max(0, u.shieldFlash - dt);
            u.chill = Math.max(0, u.chill - dt); u.stun = Math.max(0, u.stun - dt); u.shot -= dt;
            if (u.spawn > 0) { u.spawn -= dt; continue; }
            if (u.stun > 0) continue;
            const spec = UNITS[u.kind];
            let targets = fighters.filter(t => t.life > 0 && t.faction !== u.faction && t.spawn <= 0);
            if (this.manual && u.faction !== 1 && this.player.hp > 0) targets.push(this.player);
            if (this.core.faction !== u.faction && this.core.hp > 0) targets.push(this.core);
            let target = null, nearest = Infinity;
            for (const candidate of targets) { const d = distance(u, candidate) + (candidate === this.core ? 12 : 0); if (d < nearest) { nearest = d; target = candidate; } }
            u.targeting = !!target;
            const tx = target ? target.x : u.guardX, ty = target ? target.y : u.guardY;
            const dx = tx - u.x, dy = ty - u.y, dist = Math.hypot(dx, dy) || 1;
            const aim = Math.atan2(dy, dx);
            u.angle = lerpAngle(u.angle, aim, Math.min(1, dt * (u.type === 'heavy' ? .9 : 12)));
            if (u.type === 'warden') u.protected = fighters.filter(t => t !== u && t.faction === u.faction && t.type !== 'warden' && distance(t, u) < 14).slice(0, 3).map(t => t.id);
            if (target && dist <= spec.range && u.shot <= 0) { this.shoot(u, target, spec.damage, u.kind === 'rail' ? 100 : 34); u.shot = spec.interval; }
            if (!spec.static) {
                const desired = target ? spec.range * (u.type === 'warden' ? .85 : .65) : 1;
                let vx = dist > desired ? dx / dist : 0, vy = dist > desired ? dy / dist : 0;
                for (const other of fighters) {
                    if (other === u || other.life <= 0) continue;
                    const ox = u.x - other.x, oy = u.y - other.y, od = Math.hypot(ox, oy);
                    if (od > .01 && od < u.r + other.r + .6) { vx += ox / od * .8; vy += oy / od * .8; }
                }
                const k = 1 - Math.exp(-6 * dt), speed = u.speed * (u.chill > 0 ? .5 : 1);
                u.vx += (vx * speed - u.vx) * k; u.vy += (vy * speed - u.vy) * k;
                u.x = clamp(u.x + u.vx * dt, 8, 152); u.y = clamp(u.y + u.vy * dt, 18, 75);
                if (this.manual && u.faction !== 1 && distance(u, this.player) < u.r + .65) this.damagePlayer(u);
            }
        }
        this.core.flash = Math.max(0, this.core.flash - dt * 7); this.core.shot -= dt;
        const intruders = fighters.filter(u => u.life > 0 && u.faction !== this.core.faction);
        if (this.manual && this.core.faction !== 1) intruders.push(this.player);
        const target = intruders.sort((a, b) => distance(this.core, a) - distance(this.core, b))[0];
        if (target && distance(target, this.core) < 50 && this.core.shot <= 0) { this.shoot(this.core, target, 1.2, 27); this.core.shot = 1.6; }
        if (!target && this.time - this.lastCombat > 10) this.core.hp = Math.min(this.core.maxHp, this.core.hp + dt * 1.5);
    }
    updateArmyShots(dt) {
        for (const pool of [this.hostile, this.friendlyShots]) for (const b of pool) {
            if (b.life <= 0) continue;
            const x = b.x, y = b.y; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
            const targets = this.units.filter(u => u.life > 0 && u.spawn <= 0 && u.faction !== b.faction);
            if (this.core.faction !== b.faction) targets.push(this.core);
            if (this.manual && b.faction !== 1 && this.player.hp > 0) targets.push(this.player);
            targets.sort((a, c) => Math.hypot(a.x - x, a.y - y) - Math.hypot(c.x - x, c.y - y));
            for (const target of targets) if (segmentHit(x, y, b.x, b.y, target, (target.r || .7) + .2)) {
                if (target === this.player) this.damagePlayer(b); else this.hitTarget(target, b.damage, 'army', b);
                b.life = 0; break;
            }
            if (b.x < 6 || b.x > 154 || b.y < 16 || b.y > 77) b.life = 0;
        }
    }
    step(dt) {
        this.time += dt; this.mission.time += dt; this.events.length = 0; this.refresh();
        this.manual = this.war.activeBattle === this && !this.war.hero.rebuild;
        this.updateFX(dt); this.shake *= Math.exp(-14 * dt); this.flash = Math.max(0, this.flash - dt * 3);
        this.bannerTime = Math.max(0, this.bannerTime - dt);
        if (this.manual) {
            this.updatePlayer(dt); this.updateBullets(dt); this.updateAbilities(dt);
            const geoms = this.geoms; this.updateGems(dt); this.war.bank[1] += this.geoms - geoms; this.war.earned[1] += this.geoms - geoms;
            this.combo = Math.max(0, this.combo - dt);
            if (!this.combo) this.multiplier = Math.max(1, this.multiplier - dt * .7);
        } else {
            // Projectiles already fired by the pilot keep flying after returning to the map.
            this.updateBullets(dt);
            this.updateAbilities(dt);
            for (const g of this.gems) g.life = Math.max(0, g.life - dt);
        }
        this.updateArmy(dt); this.updateArmyShots(dt);
        this.units = this.units.filter(u => u.life > 0); this.refresh();
    }
}
module.exports = { WarBattle };
