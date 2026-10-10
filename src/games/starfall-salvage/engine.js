'use strict';

const { SECTORS, MODULES, CREW, SUPPLIES, MISSIONS, CONTRACTS, INTERIORS, TUNING: T } = require('./content');
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const number = (n, fallback, lo, hi) => Number.isFinite(n) ? clamp(n, lo, hi) : fallback;
const choice = (id, label) => ({ id, label });
const moduleById = id => MODULES.find(m => m.id === id);
const STARTERS = ['spark', 'port-wing', 'starboard-wing', 'ion-drive', 'patchwork-hull'];
const ENEMY_STATS = {
    drone: { hp: 39, radius: 2.8, speed: 14, damage: 10 }, pirate: { hp: 60, radius: 3.4, speed: 12, damage: 13 },
    bruiser: { hp: 105, radius: 4.3, speed: 8, damage: 17 }, queen: { hp: 335, radius: 7.5, speed: 8, damage: 16 },
    warden: { hp: 560, radius: 9, speed: 6, damage: 20 }, bot: { hp: 48, radius: 1.15, speed: 5, damage: 8 },
    turret: { hp: 62, radius: 1.4, speed: 0, damage: 11 }, sentinel: { hp: 88, radius: 1.6, speed: 4, damage: 12 }
};

function solidAt(map, aboard, x, y, radius) {
    if (!map) return true;
    const r = radius;
    if (!aboard) {
        if (x < r + 2 || y < r + 2 || x > map.width - r - 2 || y > map.height - r - 2) return true;
        return map.rocks.some(rock => Math.hypot(x - rock.x, y - rock.y) < rock.radius + r)
            || map.pois.some(p => p.kind === 'station' && Math.hypot(x - p.x, y - p.y) < p.radius * .55 + r);
    }
    const corners = [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]];
    if (!corners.every(c => map.rooms.some(room => c[0] >= room.x && c[0] <= room.x + room.w && c[1] >= room.y && c[1] <= room.y + room.h))) return true;
    return map.walls.some(w => x + r > w.x && x - r < w.x + w.w && y + r > w.y && y - r < w.y + w.h);
}

class Salvage {
    constructor(saveData) {
        this.phase = 'title'; this.hasSave = false; this.mode = 'space'; this.sector = 0; this.time = 0;
        this.ship = { x: 56, y: 96, vx: 0, vy: 0, angle: -.2, hull: 145, maxHull: 145, shield: 65, maxShield: 65, energy: 100, heat: 0, boost: 100, hurt: 0, dash: 0, moving: false };
        this.pilot = { x: 10, y: 33, angle: 0, hp: 100, maxHp: 100, oxygen: 100, dash: 0, hurt: 0, moving: false };
        this.inventory = { credits: 185, scrap: 45, crystal: 5, medkits: 4 };
        this.owned = STARTERS.slice(); this.loadout = { weapon: 'spark', port: 'port-wing', starboard: 'starboard-wing', drive: 'ion-drive', hull: 'patchwork-hull' };
        this.crew = []; this.mission = 0;
        this.flags = { fragment: false, archivePreserved: false, archiveHarvested: false, anchorA: false, anchorB: false, blockade: false, carrier: false, awakened: false, steward: false, finished: false };
        this.stats = { kills: 0, salvage: 0, boarded: 0, mined: 0, contracts: 0, recoveries: 0 };
        this.log = ['Captain’s log: one borrowed ship, one open berth, and a signal nobody else can hear. Find Mara at Lantern Anchorage.'];
        this.contracts = CONTRACTS.map(c => ({ id: c.id, status: 'available', round: 0 }));
        this.enemies = []; this.shots = []; this.loot = []; this.effects = []; this.events = [];
        this.dialogue = null; this.interior = null; this.message = 'Welcome aboard the Kestrel. Approach Lantern Anchorage and press E.'; this.messageUntil = 10;
        this.dirty = false; this.seed = 194873; this.defeated = []; this.rockHealth = {}; this.visited = [];
        this.contexts = {}; this.fireCooldown = 0; this.podCooldown = 0; this.dashCooldown = 0; this.pulseCooldown = 0;
        this.lastDamage = -100; this.saveClock = 0; this.shotId = 0; this.lootId = 0; this.tractorTarget = null;
        this.lastMove = { x: 1, y: 0 }; this.dashAngle = 0;
        this.buildWorld(); this.load(saveData);
    }

    get player() { return this.mode === 'board' ? this.pilot : this.ship; }
    get endingText() {
        const future = this.flags.awakened
            ? 'You release the living star. It unfolds into a thousand warm lights, carrying water, power, and new gardens to every settlement. Nobody holds the switch.'
            : 'You build a circle of caretakers around the living star. Every settlement gets a voice, and every decision is recorded in the open. Its first gift is clean power for everyone.';
        const memory = this.flags.archivePreserved
            ? 'The Choir’s memories survive intact. Pip teaches a language that has not been spoken for ten thousand years.'
            : 'The recovered archive power cells rebuild the evacuation fleet. Pip saves the surviving songs and teaches them to the children.';
        return future + ' ' + memory + ' Moth charts places worth loving. Oru finally launches his last lifeboat. Mara leaves the light on. The Kestrel has new scars, a crowded kitchen, and no empty berths. You set a course for tomorrow.';
    }

    random() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
    notify(text, sound) { this.message = text; this.messageUntil = this.time + 5; if (sound && this.events.length < 16) this.events.push(sound); }
    record(text) { this.log.push(text); this.log = this.log.slice(-60); this.dirty = true; }
    begin() {
        if (this.phase === 'title' || this.phase === 'ending') {
            const after = this.phase === 'ending'; this.phase = 'play'; this.dialogue = null;
            this.notify(after ? 'The stars are open. Outfit your ship, revisit the wrecks, and protect the salvage lanes.' : this.hasSave ? 'Welcome back, Captain. Your crew kept the kettle warm.' : 'WASD to thrust. E docks at the station beside you. Space fires with auto-aim.', 'start');
        }
    }

    shipStats() {
        const weapon = moduleById(this.loadout.weapon), hull = moduleById(this.loadout.hull), drive = moduleById(this.loadout.drive);
        const port = moduleById(this.loadout.port), starboard = moduleById(this.loadout.starboard);
        return { damage: weapon.damage, speed: drive.speed, fireRate: 1 / weapon.rate, cooldown: weapon.rate, range: weapon.range,
            maxHull: hull.hull, hull: hull.hull, maxShield: hull.shield + (starboard.shield || 0) + (this.crew.includes('moth') ? 20 : 0),
            shieldRegen: T.shieldRegen + (starboard.shieldRegen || 0) + (this.crew.includes('oru') ? 4 : 0),
            energyRegen: drive.energyRegen, dashCooldown: drive.dashCooldown, tractor: port.tractor || 13,
            salvage: 1 + (hull.salvage || 0) + (port.salvage || 0) + (this.crew.includes('pip') ? .2 : 0),
            heat: weapon.heat, energy: weapon.energy, chain: port.chain || 0, missile: starboard.missile || 0 };
    }
    refreshStats() {
        const s = this.shipStats(), oldHull = this.ship.maxHull, oldShield = this.ship.maxShield;
        this.ship.maxHull = s.maxHull; this.ship.maxShield = s.maxShield;
        this.ship.hull = clamp(this.ship.hull + Math.max(0, s.maxHull - oldHull), 1, s.maxHull);
        this.ship.shield = clamp(this.ship.shield + Math.max(0, s.maxShield - oldShield), 0, s.maxShield);
    }
    buildWorld() {
        const base = SECTORS[this.sector];
        this.world = Object.assign({}, base, { pois: base.pois.map(p => Object.assign({}, p)), rocks: base.rocks.filter(r => this.rockHealth[this.sector + ':' + r.id] !== 0).map(r => Object.assign({}, r, { hp: this.rockHealth[this.sector + ':' + r.id] === undefined ? r.hp : this.rockHealth[this.sector + ':' + r.id] })) });
    }
    contextKey() { return this.mode === 'board' && this.interior ? 'board:' + this.interior.id : 'space:' + this.sector; }
    cacheContext() { this.contexts[this.contextKey()] = { enemies: this.enemies, loot: this.loot }; }
    activateContext() {
        const state = this.contexts[this.contextKey()]; this.enemies = state ? state.enemies : []; this.loot = state ? state.loot : [];
        this.shots = []; this.effects = []; this.tractorTarget = null; this.fireCooldown = 0;
    }
    makeInterior(id) {
        const base = INTERIORS[id];
        this.interior = Object.assign({}, base, { rooms: base.rooms.map(r => Object.assign({}, r)), walls: base.walls.map(w => Object.assign({}, w)), props: base.props.filter(p => !p.crewId || !this.crew.includes(p.crewId)).map(p => Object.assign({}, p, { looted: this.flags['cache:' + id + ':' + p.id] === true })) });
    }
    atDock() { return this.mode === 'space' && this.world.pois.some(p => p.kind === 'station' && distance(p, this.ship) <= p.radius + 9); }
    canFit() { return this.phase === 'play' && this.atDock(); }
    inCombat() {
        if (this.time - this.lastDamage < 3) return true;
        return this.enemies.some(e => e.hp > 0 && e.alerted && distance(e, this.player) < (this.mode === 'space' ? 84 : 30)) || this.shots.some(s => s.owner === 'enemy' && distance(s, this.player) < 35);
    }

    solid(x, y, radius) {
        const r = radius === undefined ? (this.mode === 'space' ? T.shipRadius : T.pilotRadius) : radius;
        return solidAt(this.mode === 'board' ? this.interior : this.world, this.mode === 'board', x, y, r);
    }
    move(actor, dx, dy, radius) {
        const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 1.2));
        for (let i = 0; i < steps; i++) {
            if (!this.solid(actor.x + dx / steps, actor.y, radius)) actor.x += dx / steps;
            else if (actor === this.ship) actor.vx *= .4;
            if (!this.solid(actor.x, actor.y + dy / steps, radius)) actor.y += dy / steps;
            else if (actor === this.ship) actor.vy *= .4;
        }
    }
    lineClear(a, b) {
        const steps = Math.max(1, Math.ceil(distance(a, b) / 1.5));
        for (let i = 1; i < steps; i++) if (this.solid(a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps, 0)) return false;
        return true;
    }

    tick(dt, input) {
        if (this.phase !== 'play') return;
        dt = number(dt, .05, .001, .12); input = input || {}; this.time += dt;
        this.events = this.events.slice(-16); this.saveClock += dt;
        if (this.saveClock > 12) { this.saveClock = 0; this.dirty = true; }
        ['fireCooldown', 'podCooldown', 'dashCooldown', 'pulseCooldown'].forEach(key => { this[key] = Math.max(0, this[key] - dt); });
        const p = this.player, stats = this.shipStats(); p.hurt = Math.max(0, p.hurt - dt); p.dash = Math.max(0, p.dash - dt);
        let mx = number(input.x, 0, -1, 1), my = number(input.y, 0, -1, 1), length = Math.hypot(mx, my);
        if (length) { mx /= length; my /= length; this.lastMove = { x: mx, y: my }; }
        const ox = p.x, oy = p.y;
        if (this.mode === 'space') {
            const boosting = input.boost && p.boost > 2 && length > 0;
            if (p.dash > 0) { p.vx = Math.cos(this.dashAngle) * 85; p.vy = Math.sin(this.dashAngle) * 85; }
            else {
                const speed = stats.speed * (boosting ? T.boostMultiplier : 1), factor = Math.min(1, T.shipAcceleration * dt);
                p.vx += (mx * speed - p.vx) * factor; p.vy += (my * speed - p.vy) * factor;
            }
            this.move(p, p.vx * dt, p.vy * dt, T.shipRadius);
            if (length && !input.fire) p.angle = Math.atan2(my, mx);
            p.boost = clamp(p.boost + dt * (boosting ? -T.boostDrain : T.boostRegen * (this.crew.includes('moth') ? 1.25 : 1)), 0, 100);
            p.energy = Math.min(100, p.energy + stats.energyRegen * dt); p.heat = Math.max(0, p.heat - T.heatCool * dt);
            if (this.time - this.lastDamage > T.shieldDelay) {
                p.shield = Math.min(p.maxShield, p.shield + stats.shieldRegen * dt);
                if (this.crew.includes('oru')) p.hull = Math.min(p.maxHull, p.hull + 2 * dt);
            }
            p.boosting = boosting || p.dash > 0;
        } else {
            const speed = p.dash > 0 ? 40 : T.pilotSpeed;
            this.move(p, (p.dash > 0 ? Math.cos(this.dashAngle) : mx) * speed * dt, (p.dash > 0 ? Math.sin(this.dashAngle) : my) * speed * dt, T.pilotRadius);
            if (length && !input.fire) p.angle = Math.atan2(my, mx);
            p.oxygen = Math.max(0, p.oxygen - dt * T.oxygenDrain * (this.crew.includes('pip') ? .5 : 1));
            if (p.oxygen <= 0 && p.hurt <= 0) { this.damagePlayer(3); this.notify('Oxygen depleted. Return to the airlock or use emergency recall.'); }
        }
        p.moving = Math.hypot(p.x - ox, p.y - oy) > .015;
        this.spawnEncounters();
        if (input.fire) this.fire(input.aim);
        this.updateEnemies(dt); this.updateShots(dt); this.collectLoot(dt); this.checkContracts();
        this.effects.forEach(e => { e.life -= dt; }); this.effects = this.effects.filter(e => e.life > 0).slice(-T.maxEffects);
    }

    spawnEnemy(id, group, x, y, type) {
        if (this.defeated.includes(id) || this.enemies.some(e => e.id === id) || this.enemies.length >= T.maxEnemies) return;
        const stats = ENEMY_STATS[type];
        if (this.solid(x, y, stats.radius)) {
            for (let i = 0; i < 24; i++) {
                const tx = x + Math.cos(i * 2.4) * (3 + i * .6), ty = y + Math.sin(i * 2.4) * (3 + i * .6);
                if (!this.solid(tx, ty, stats.radius)) { x = tx; y = ty; break; }
            }
        }
        this.enemies.push({ id, group, type, x, y, homeX: x, homeY: y, vx: 0, vy: 0, angle: 0, hp: stats.hp, maxHp: stats.hp, radius: stats.radius, windup: 0, cooldown: 1.1 + this.random() * .6, targetAngle: 0, alerted: false, boss: type === 'queen' || type === 'warden', volleys: 0, moving: false });
    }
    spawnSpaceGroup(group, poi, count, boss) {
        for (let i = 0; i < count; i++) {
            const angle = i * 2.399, radius = 17 + i * 3;
            const type = boss && i === count - 1 ? boss : i % 4 === 3 ? 'bruiser' : i % 2 ? 'pirate' : 'drone';
            this.spawnEnemy(group + ':' + i, group, clamp(poi.x + Math.cos(angle) * radius, 12, 228), clamp(poi.y + Math.sin(angle) * radius, 12, 168), type);
        }
    }
    spawnEncounters() {
        const m = MISSIONS[this.mission];
        if (this.mode === 'board') {
            const id = this.interior.id, mission = MISSIONS.find(v => v.wreck === id), count = mission ? mission.boardCount : 3;
            for (let i = 0; i < count; i++) { const at = this.interior.spawns[i % this.interior.spawns.length]; this.spawnEnemy('interior:' + id + ':' + i, 'interior:' + id, at.x, at.y, i % 4 === 3 ? 'turret' : i % 5 === 4 ? 'sentinel' : 'bot'); }
            return;
        }
        if (m && m.sector === this.sector) {
            if (m.spaceCount) {
                const poi = this.world.pois.find(p => p.id === m.poi);
                if (poi && distance(this.ship, poi) < 112) this.spawnSpaceGroup('story:' + this.mission, poi, m.spaceCount, m.boss);
            }
            if (m.relays) m.relays.forEach(id => {
                const p = this.world.pois.find(poi => poi.id === id);
                if (distance(this.ship, p) < 86 && !this.flags['relay:' + id]) this.spawnSpaceGroup('relay:' + id, p, 2, false);
            });
        }
        this.contracts.filter(c => c.status === 'active').forEach(c => {
            const data = CONTRACTS.find(item => item.id === c.id);
            if (data.sector === this.sector && distance(this.ship, data) < 100) this.spawnSpaceGroup('contract:' + c.id + ':' + c.round, data, data.count, false);
        });
    }
    groupCleared(group, count) { for (let i = 0; i < count; i++) if (!this.defeated.includes(group + ':' + i)) return false; return true; }

    updateEnemies(dt) {
        const p = this.player, aboard = this.mode === 'board', safe = !aboard && this.atDock();
        this.enemies.forEach(e => {
            if (e.hp <= 0) return;
            const stats = ENEMY_STATS[e.type], d = distance(e, p); e.moving = false; e.cooldown = Math.max(0, e.cooldown - dt);
            if (safe || d > (aboard ? 55 : 105)) {
                e.windup = 0; e.alerted = false;
                const home = { x: e.homeX, y: e.homeY };
                if (distance(e, home) > 2 && stats.speed) { const a = Math.atan2(home.y - e.y, home.x - e.x); this.move(e, Math.cos(a) * stats.speed * dt, Math.sin(a) * stats.speed * dt, e.radius); }
                return;
            }
            if (e.windup > 0) {
                e.windup -= dt;
                if (e.windup <= 0 && this.lineClear(e, p)) {
                    const angles = e.boss ? [-.2, 0, .2] : [0];
                    e.volleys++;
                    if (e.boss && e.hp < e.maxHp * .5 && e.volleys % 3 === 0) for (let i = 0; i < 8; i++) angles.push(i * Math.PI / 4);
                    angles.forEach(offset => this.addShot(e.x, e.y, e.targetAngle + offset, aboard ? 26 : T.enemyBulletSpeed, stats.damage, 'enemy', e.boss ? 'plasma' : 'bolt', aboard ? 50 : 100));
                    this.effect(e.x, e.y, 'muzzle', .16, e.radius + 1); e.cooldown = e.boss ? 1.6 : T.enemyCooldown;
                }
                return;
            }
            if (d < (aboard ? 38 : T.enemyNotice)) e.alerted = true;
            if (!e.alerted) return;
            e.angle = Math.atan2(p.y - e.y, p.x - e.x);
            const desired = aboard ? 14 : e.boss ? 43 : 37;
            if (stats.speed && (d > desired || !this.lineClear(e, p))) {
                let a = e.angle;
                if (this.solid(e.x + Math.cos(a) * 3, e.y + Math.sin(a) * 3, e.radius)) a += .95;
                this.move(e, Math.cos(a) * stats.speed * dt, Math.sin(a) * stats.speed * dt, e.radius); e.moving = true;
            }
            if (d < (aboard ? 29 : T.enemyRange) && e.cooldown <= 0 && this.lineClear(e, p)) {
                e.windup = e.boss ? 1.15 : T.enemyWindup;
                e.targetAngle = e.angle + (this.random() - .5) * (aboard ? .08 : .11);
            }
        });
    }

    addShot(x, y, angle, speed, damage, owner, kind, range, extra) {
        if (this.shots.length >= T.maxShots) return;
        this.shots.push(Object.assign({ id: ++this.shotId, x, y, px: x, py: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, angle, damage, owner, kind, life: range / speed, radius: kind === 'rocket' ? 1.3 : .7, pierced: [] }, extra || {}));
    }
    fire(aim) {
        if (this.phase !== 'play' || this.fireCooldown > 0 || this.player.dash > 0) return false;
        const p = this.player, aboard = this.mode === 'board', stats = this.shipStats(), weapon = moduleById(this.loadout.weapon);
        if (!aboard && (p.energy < weapon.energy || p.heat > 92)) { this.fireCooldown = .25; this.notify(p.heat > 92 ? 'Cannons cooling. Keep moving.' : 'Capacitors recharging.'); return false; }
        let angle = p.angle;
        if (aim && Number.isFinite(aim.x) && Number.isFinite(aim.y)) angle = Math.atan2(aim.y - p.y, aim.x - p.x);
        else {
            let target = this.enemies.filter(e => e.hp > 0 && distance(e, p) < (aboard ? 47 : stats.range) && this.lineClear(p, e)).sort((a, b) => distance(a, p) - distance(b, p))[0];
            if (!target && !aboard) target = this.world.rocks.filter(r => distance(r, p) < 70).sort((a, b) => distance(a, p) - distance(b, p))[0];
            if (target) angle = Math.atan2(target.y - p.y, target.x - p.x);
        }
        p.angle = angle; this.fireCooldown = aboard ? .28 : weapon.rate;
        if (!aboard) { p.energy -= weapon.energy; p.heat = Math.min(100, p.heat + weapon.heat); }
        const pellets = aboard ? 1 : weapon.pellets;
        for (let i = 0; i < pellets; i++) {
            const a = angle + (pellets > 1 ? (i - 2) * .075 : 0);
            this.addShot(p.x + Math.cos(a) * (aboard ? .8 : 3), p.y + Math.sin(a) * (aboard ? .8 : 3), a, !aboard && weapon.homing ? 64 : T.bulletSpeed,
                aboard ? 28 : stats.damage, 'player', aboard ? 'cutter' : weapon.homing ? 'rocket' : weapon.id === 'lance' || weapon.id === 'sunblade' ? 'lance' : 'bolt', aboard ? 48 : stats.range,
                { pierce: aboard ? 1 : weapon.pierce || 1, homing: !aboard && !!weapon.homing, splash: aboard ? 0 : weapon.splash || 0, chain: aboard ? 0 : stats.chain });
        }
        if (!aboard && stats.missile && this.podCooldown <= 0) { this.addShot(p.x, p.y, angle, 69, stats.missile, 'player', 'rocket', 105, { homing: true, splash: 9, pierce: 1 }); this.podCooldown = 1.6; }
        this.effect(p.x + Math.cos(angle) * (aboard ? 2 : 5), p.y + Math.sin(angle) * (aboard ? 2 : 5), 'muzzle', .12, aboard ? 1 : 2);
        this.events.push(aboard ? 'cutter' : weapon.homing ? 'rocket' : 'shot'); this.dirty = true; return true;
    }
    updateShots(dt) {
        this.shots.forEach(s => {
            if (s.homing) {
                const target = this.enemies.filter(e => e.hp > 0).sort((a, b) => distance(a, s) - distance(b, s))[0];
                if (target) { const a = Math.atan2(target.y - s.y, target.x - s.x), speed = Math.hypot(s.vx, s.vy); s.vx += (Math.cos(a) * speed - s.vx) * Math.min(1, dt * 5); s.vy += (Math.sin(a) * speed - s.vy) * Math.min(1, dt * 5); }
            }
            s.px = s.x; s.py = s.y; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
            const targets = s.owner === 'player' ? this.enemies : [this.player];
            for (const target of targets) {
                if ((target.hp !== undefined && target.hp <= 0) || (s.pierced && s.pierced.includes(target.id))) continue;
                const radius = s.owner === 'enemy' ? (this.mode === 'board' ? 1.1 : 3) : target.radius;
                if (this.segmentDistance(s, target) > radius + s.radius || !this.lineClear({ x: s.px, y: s.py }, target)) continue;
                if (s.owner === 'enemy') { this.damagePlayer(s.damage); s.life = 0; }
                else {
                    this.damageEnemy(target, s.damage); s.pierced.push(target.id);
                    if (s.chain) { const secondary = this.enemies.find(e => e.hp > 0 && e.id !== target.id && distance(e, target) < 24 && this.lineClear(target, e)); if (secondary) { this.damageEnemy(secondary, s.chain); this.effect(secondary.x, secondary.y, 'arc', .35, 5); } }
                    if (s.splash) { this.enemies.filter(e => e.hp > 0 && e.id !== target.id && distance(e, target) < s.splash).forEach(e => this.damageEnemy(e, s.damage * .55)); this.effect(target.x, target.y, 'explosion', .55, s.splash); }
                    if (s.pierced.length >= (s.pierce || 1)) s.life = 0;
                }
                if (s.life <= 0) break;
            }
            if (s.life > 0 && this.mode === 'space') {
                const rock = this.world.rocks.find(r => this.segmentDistance(s, r) < r.radius + s.radius);
                if (rock) {
                    s.life = 0;
                    if (s.owner === 'player') this.mineRock(rock, s.damage);
                    this.effect(s.x, s.y, 'spark', .25, 2);
                }
            }
            if (s.life > 0 && (this.solid(s.x, s.y, 0) || !this.lineClear({ x: s.px, y: s.py }, s))) {
                s.life = 0; this.effect(s.x, s.y, 'spark', .2, 1);
            }
        });
        this.shots = this.shots.filter(s => s.life > 0); this.enemies = this.enemies.filter(e => e.hp > 0);
    }
    segmentDistance(s, target) {
        const dx = s.x - s.px, dy = s.y - s.py, d = dx * dx + dy * dy;
        const t = d ? clamp(((target.x - s.px) * dx + (target.y - s.py) * dy) / d, 0, 1) : 0;
        return Math.hypot(target.x - s.px - dx * t, target.y - s.py - dy * t);
    }
    damageEnemy(enemy, damage) {
        if (this.phase !== 'play' || enemy.hp <= 0) return;
        enemy.hp = Math.max(0, enemy.hp - damage); enemy.alerted = true; this.effect(enemy.x, enemy.y, 'hit', .25, enemy.radius + 1);
        if (enemy.hp <= 0) {
            if (!this.defeated.includes(enemy.id)) this.defeated.push(enemy.id);
            this.defeated = this.defeated.slice(-1000); this.stats.kills++;
            this.effect(enemy.x, enemy.y, 'explosion', .65, enemy.boss ? 16 : enemy.radius * 2.2);
            this.drop(enemy.x, enemy.y, 'scrap', enemy.boss ? 42 : this.mode === 'board' ? 7 : 10);
            this.drop(enemy.x + 2, enemy.y + 2, 'credits', enemy.boss ? 90 : 14 + Math.floor(this.random() * 9));
            if (enemy.boss || this.random() < .32) this.drop(enemy.x - 2, enemy.y, 'crystal', enemy.boss ? 8 : 2);
            if (this.random() < .2) this.drop(enemy.x, enemy.y - 2, 'medkit', 1);
            this.events.push(enemy.boss ? 'boss' : 'explosion');
            const m = MISSIONS[this.mission];
            if (m && this.mode === 'space' && m.spaceCount && this.groupCleared('story:' + this.mission, m.spaceCount)) this.notify(this.mission === 9 ? 'The Warden is quiet. Approach the living star and press E.' : this.mission === 5 ? 'The Needle Queen has fallen. The Choir’s airlock is open.' : 'The area is clear. Follow the gold beacon and interact.', 'quest');
        }
        this.dirty = true;
    }
    damagePlayer(damage) {
        if (this.phase !== 'play' || this.player.hurt > 0 || this.player.dash > 0 || (this.mode === 'space' && this.atDock())) return;
        const p = this.player; p.hurt = T.damageInvulnerability; this.lastDamage = this.time;
        if (this.mode === 'space') { const absorbed = Math.min(p.shield, damage); p.shield -= absorbed; p.hull = Math.max(0, p.hull - damage + absorbed); }
        else p.hp = Math.max(0, p.hp - damage);
        this.effect(p.x, p.y, this.mode === 'space' && p.shield > 0 ? 'shield' : 'hit', .35, this.mode === 'space' ? 7 : 2); this.events.push('hurt'); this.dirty = true;
        if (this.mode === 'space' ? p.hull <= 0 : p.hp <= 0) this.recall(true);
    }
    mineRock(rock, damage) {
        rock.hp = Math.max(0, rock.hp - damage); this.rockHealth[this.sector + ':' + rock.id] = rock.hp;
        if (rock.hp <= 0) {
            this.stats.mined++; this.effect(rock.x, rock.y, 'debris', .8, rock.radius * 2);
            this.drop(rock.x, rock.y, 'scrap', Math.round(rock.radius * 2)); this.drop(rock.x + 2, rock.y, rock.crystal ? 'crystal' : 'credits', rock.crystal ? 4 : 12);
            this.world.rocks = this.world.rocks.filter(r => r.id !== rock.id); this.events.push('salvage');
        }
        this.dirty = true;
    }
    effect(x, y, kind, life, radius) { if (this.effects.length >= T.maxEffects) this.effects.shift(); this.effects.push({ x, y, kind, life, maxLife: life, radius: radius || 3 }); }
    drop(x, y, kind, amount) { if (this.loot.length >= T.maxLoot) this.loot.shift(); this.loot.push({ id: 'loot-' + (++this.lootId), x, y, kind, amount, angle: this.random() * Math.PI * 2 }); }
    collectLoot(dt) {
        const p = this.player, range = this.mode === 'board' ? 7 : this.shipStats().tractor; this.tractorTarget = null;
        let collected = false;
        this.loot = this.loot.filter(item => {
            let d = distance(item, p);
            if (d < range && d > (this.mode === 'board' ? 2 : 4) && this.lineClear(item, p)) {
                const speed = Math.min(d, dt * (this.mode === 'board' ? 20 : 34)); item.x += (p.x - item.x) / d * speed; item.y += (p.y - item.y) / d * speed;
                if (!this.tractorTarget) this.tractorTarget = { x: item.x, y: item.y }; d = distance(item, p);
            }
            if (d > (this.mode === 'board' ? 2.3 : 4.5)) return true;
            const amount = item.kind === 'scrap' ? Math.ceil(item.amount * this.shipStats().salvage) : item.amount;
            if (item.kind === 'medkit') this.inventory.medkits = Math.min(30, this.inventory.medkits + amount);
            else this.inventory[item.kind] = Math.min(999999, (this.inventory[item.kind] || 0) + amount);
            if (item.kind === 'scrap') this.stats.salvage += amount;
            this.effect(item.x, item.y, 'loot', .5, 2); this.dirty = true; collected = true; return false;
        });
        if (collected) this.events.push('loot');
    }

    dash() {
        if (this.phase !== 'play' || this.dashCooldown > 0) return false;
        if (this.mode === 'space' && this.ship.boost < 25) { this.notify('Boost capacitors are recharging.'); return false; }
        this.dashAngle = Math.atan2(this.lastMove.y, this.lastMove.x); this.player.dash = this.mode === 'space' ? .28 : .24;
        this.dashCooldown = this.mode === 'space' ? this.shipStats().dashCooldown : 1.2;
        if (this.mode === 'space') this.ship.boost -= 25;
        this.effect(this.player.x, this.player.y, 'dash', .4, this.mode === 'space' ? 8 : 3); this.events.push('dash'); return true;
    }
    pulse() {
        if (this.phase !== 'play' || this.pulseCooldown > 0) return false;
        const aboard = this.mode === 'board';
        if (aboard ? this.pilot.oxygen < 8 : this.ship.energy < 45) { this.notify(aboard ? 'Not enough suit power. Return to the airlock.' : 'Pulse needs 45 energy.'); return false; }
        if (aboard) this.pilot.oxygen -= 8; else this.ship.energy -= 45;
        const range = aboard ? 15 : 36;
        this.enemies.filter(e => distance(e, this.player) < range && this.lineClear(this.player, e)).forEach(e => { this.damageEnemy(e, aboard ? 42 : 62); e.windup = 0; e.cooldown = 2.2; });
        this.shots = this.shots.filter(s => s.owner === 'player' || distance(s, this.player) > range);
        this.effect(this.player.x, this.player.y, 'pulse', .75, range); this.pulseCooldown = 6; this.events.push('pulse'); this.dirty = true; return true;
    }
    heal() {
        if (this.phase !== 'play') return false;
        if (this.inventory.medkits < 1) { this.notify('No repair kits. Stations repair and restock your emergency kit for free.'); return false; }
        if (this.mode === 'space' ? this.ship.hull >= this.ship.maxHull : this.pilot.hp >= this.pilot.maxHp) return false;
        this.inventory.medkits--;
        if (this.mode === 'space') this.ship.hull = Math.min(this.ship.maxHull, this.ship.hull + 85);
        else this.pilot.hp = Math.min(this.pilot.maxHp, this.pilot.hp + 65);
        this.effect(this.player.x, this.player.y, 'heal', .8, this.mode === 'space' ? 8 : 3); this.notify('Repair foam applied. Looking almost respectable.', 'heal'); this.dirty = true; return true;
    }
    repair() {
        if (!this.canFit()) { this.notify('Dock at a station to repair.'); return false; }
        this.ship.hull = this.ship.maxHull; this.ship.shield = this.ship.maxShield; this.ship.energy = 100; this.ship.boost = 100; this.ship.heat = 0;
        this.pilot.hp = this.pilot.maxHp; this.pilot.oxygen = 100; this.inventory.medkits = Math.max(2, this.inventory.medkits);
        this.notify('Station repair complete. Hull, shields, suit, and emergency kits restored for free.', 'heal'); this.dirty = true; return true;
    }
    recall(defeated) {
        if (this.phase !== 'play') return false;
        this.cacheContext(); this.mode = 'space'; this.interior = null; this.buildWorld(); this.activateContext();
        const cost = Math.min(this.inventory.credits, defeated === true ? 25 : 15); this.inventory.credits -= cost;
        this.ship.x = 56; this.ship.y = 96; this.ship.vx = 0; this.ship.vy = 0; this.ship.hull = this.ship.maxHull; this.ship.shield = this.ship.maxShield;
        this.ship.energy = 100; this.ship.heat = 0; this.ship.boost = 100; this.ship.hurt = 3; this.pilot.hp = this.pilot.maxHp; this.pilot.oxygen = 100;
        this.inventory.medkits = Math.max(this.inventory.medkits, 2); this.dialogue = null; this.lastDamage = this.time - 10; this.stats.recoveries++;
        this.notify('Tug pickup complete · $' + cost + '. Your ship, crew, salvage, and story progress are safe.', 'dock'); this.dirty = true; return true;
    }

    unlockedSectors() { const last = this.mission < 2 ? 0 : this.mission < 3 ? 1 : this.mission < 5 ? 2 : this.mission < 7 ? 3 : this.mission < 9 ? 4 : 5; return SECTORS.slice(0, last + 1).map(s => s.id); }
    travel(index) {
        if (this.phase !== 'play' || !Number.isInteger(index) || !this.unlockedSectors().includes(index)) return false;
        if (this.mode !== 'space') { this.notify('Return to the Kestrel before opening a slipstream.'); return false; }
        if (this.inCombat() && !this.atDock()) { this.notify('Clear the pursuers or retreat to a station before jumping.'); return false; }
        this.cacheContext(); this.sector = index; this.buildWorld(); this.activateContext();
        this.ship.x = 56; this.ship.y = 96; this.ship.vx = 0; this.ship.vy = 0; this.ship.angle = -.2; this.dialogue = null;
        this.notify(SECTORS[index].name.toUpperCase() + ' · ' + SECTORS[index].subtitle, 'warp'); this.dirty = true; return true;
    }
    board(id) {
        if (this.phase !== 'play' || this.mode !== 'space' || !INTERIORS[id]) return false;
        const poi = this.world.pois.find(p => p.id === id);
        if (!poi || distance(poi, this.ship) > poi.radius + 10) return false;
        const m = MISSIONS[this.mission];
        if (m && m.wreck === id && m.spaceCount && !this.groupCleared('story:' + this.mission, m.spaceCount)) { this.notify('Clear the exterior defenders before opening this airlock.'); return false; }
        if (id === 'choir' && this.mission < 5) { this.notify('The memory ark’s airlock is under the Needle Queen’s control.'); return false; }
        if (this.enemies.some(e => e.hp > 0 && distance(e, this.ship) < 45)) { this.notify('Hostiles are too close to board safely.'); return false; }
        this.cacheContext(); this.mode = 'board'; this.makeInterior(id); this.activateContext();
        this.pilot.x = this.interior.exit.x + 3; this.pilot.y = this.interior.exit.y; this.pilot.oxygen = 100; this.pilot.hurt = 1;
        this.ship.vx = 0; this.ship.vy = 0; this.dialogue = null;
        if (!this.visited.includes(id)) { this.visited.push(id); this.stats.boarded++; this.record('Boarded ' + this.interior.name + '. Every room has a story.'); }
        this.spawnEncounters(); this.notify('AIRLOCK SEALED · Explore on foot. Space fires your cutter; E interacts. Return here to leave.', 'board'); this.dirty = true; return true;
    }
    leaveBoard() {
        if (this.phase !== 'play' || this.mode !== 'board') return false;
        this.cacheContext(); this.mode = 'space'; this.interior = null; this.activateContext(); this.dialogue = null;
        this.notify('Back aboard the Kestrel. The stars are where you left them.', 'board'); this.dirty = true; return true;
    }

    setDialogue(kind, speaker, title, text, choices, extra) { this.dialogue = Object.assign({ kind, speaker, title, text, choices: choices || [choice('close', 'Back to the stars')] }, extra || {}); return this.dialogue; }
    closeDialogue() { this.dialogue = null; }
    nearestPoi() { return this.world.pois.filter(p => distance(p, this.ship) <= p.radius + 10).sort((a, b) => distance(a, this.ship) - a.radius - (distance(b, this.ship) - b.radius))[0]; }
    hint() {
        if (this.mode === 'board') {
            if (distance(this.pilot, this.interior.exit) < 5) return 'Return to the Kestrel';
            if (this.interior.props.some(p => distance(p, this.pilot) < 5)) return 'Inspect / interact';
            return 'Explore the rooms · follow the gold beacon';
        }
        const p = this.nearestPoi(); return p ? p.kind === 'station' ? 'Dock at ' + p.name : p.kind === 'wreck' ? 'Board ' + p.name : p.kind === 'gate' ? 'Open the star chart' : 'Inspect ' + p.name : 'Space: auto-aim fire · E: interact nearby';
    }
    interact() {
        if (this.phase !== 'play') return null;
        if (this.mode === 'board') return this.interiorInteract();
        const poi = this.nearestPoi();
        if (!poi) { this.notify('Move near a station, wreck, relay, or gate to interact.'); return null; }
        if (poi.kind === 'station') return this.dockDialogue(poi);
        if (poi.kind === 'wreck') { this.board(poi.id); return this.dialogue; }
        if (poi.kind === 'gate') return this.setDialogue('terminal', poi.id, poi.name, 'The Kestrel can ride this slipstream without fuel. Open your star chart and choose any discovered sector.', [choice('close', 'Back to the helm')], { sector: this.sector, x: poi.x, y: poi.y });
        if (this.mission === 3 && MISSIONS[3].relays.includes(poi.id)) {
            if (!this.groupCleared('relay:' + poi.id, 2)) { this.notify('The relay’s guardians must be cleared first.'); return null; }
            return this.setDialogue('terminal', poi.id, poi.name, this.flags['relay:' + poi.id] ? 'This relay is singing in tune with the others.' : 'A clear note hums inside the cracked housing. Tune the relay to complete the harmonic map.', this.flags['relay:' + poi.id] ? [choice('close', 'Leave it singing')] : [choice('tune', 'Tune the relay'), choice('close', 'Not yet')], { sector: this.sector, x: poi.x, y: poi.y });
        }
        if (this.mission === 7 && poi.id === 'stormgate') {
            if (!this.groupCleared('story:7', MISSIONS[7].spaceCount)) { this.notify('The weapons grid is still guarded.'); return null; }
            return this.setDialogue('terminal', poi.id, 'Stormgate’s last command', 'A guild transmission repeats: “PRIVATE PROPERTY. TURN BACK.” Oru finds the civilian override. For once, a door can open without an invoice.', [choice('disable', 'Open the civilian passage'), choice('close', 'Wait')], { sector: this.sector, x: poi.x, y: poi.y });
        }
        if (this.mission === 9 && poi.id === 'heart') {
            if (!this.groupCleared('story:9', MISSIONS[9].spaceCount)) { this.notify('The last Warden still bars the way.'); return null; }
            return this.setDialogue('choice', 'heart', 'The living star asks a question', 'It was never a machine. It was a seed, waiting for someone to trust. Moth sees a thousand possible gardens. Oru sees people who cannot wait. Pip asks: “Who gets to decide what a sunrise is for?”', [choice('awaken', 'Release it freely. Let every settlement share the light.'), choice('steward', 'Build a council of caretakers. Let every settlement choose.')], { sector: this.sector, x: poi.x, y: poi.y });
        }
        return this.setDialogue('terminal', poi.id, poi.name, poi.id === 'home-relay' ? 'Old weather reports, a recording of birdsong, and a message from Mara: “If you can hear this, you are not alone.”' : this.flags.finished ? 'The signal is clear. Civilian ships are crossing a horizon that used to belong to someone else.' : 'A faint harmonic answers the fragment aboard your ship. This place belongs to a larger story.', [choice('close', 'Continue')], { sector: this.sector, x: poi.x, y: poi.y });
    }

    dockDialogue(poi) {
        if (this.mission === 0 && poi.id === 'lantern') return this.setDialogue('dialogue', 'mara', 'Mara Bell · keeper of the light', '“Captain. The Kestrel’s yours as long as you bring her back in one piece. There is a signal inside the wreck of the Sable. Recover it, and we both eat this week. Space fires your cannons; E opens an airlock once the drones are gone.”', [choice('accept', 'A ship, a signal, a chance. I am in.'), choice('mara-story', 'Why keep this place running?'), choice('close', 'Let me look around.')], { sector: this.sector, x: poi.x, y: poi.y });
        if (this.mission === 6 && poi.id === 'freehouse') return this.setDialogue('dialogue', 'pip', 'Pip Nine · a very small invitation', '“Your star fragment is alive! It remembers being a seed. The guild is using its guardian network as a fence. I know how to open it. Also, your ship’s kitchen is a disgrace. May I come aboard?”', [choice('recruit-pip', 'There is a place at our table.'), choice('pip-story', 'Tell me about the Choir.'), choice('close', 'We will be right back.')], { sector: this.sector, x: poi.x, y: poi.y });
        const text = this.flags.finished ? 'Mara’s message is pinned beside the repair bay: “Good ships need good crews. You found both.” Repairs and emergency kits are on the house. There is always more work on the contract board.' : 'A warm repair bay, a kettle that never quite boils, and racks of real ship parts. Repair for free, fit visible modules, stock repair kits, or accept a salvage-lane contract.';
        return this.setDialogue('dock', poi.id, poi.name, text, [choice('repair', 'Free repair and emergency supplies'), choice('contracts', 'Open the contract board'), choice('crew-story', 'A moment with the crew'), choice('close', 'Undock')], { sector: this.sector, x: poi.x, y: poi.y, items: MODULES.filter(m => m.price > 0).map(m => m.id).concat(['medkit', 'crystal-pack']) });
    }
    interiorInteract() {
        const i = this.interior, p = this.pilot, m = MISSIONS[this.mission];
        if (distance(p, i.exit) < 5) { this.leaveBoard(); return null; }
        const target = i.props.filter(prop => distance(prop, p) < 5.5).sort((a, b) => distance(a, p) - distance(b, p))[0];
        if (!target) { this.notify('Look for a console, supply crate, or the airlock.'); return null; }
        if (target.kind === 'crate') {
            const key = 'cache:' + i.id + ':' + target.id;
            if (this.flags[key]) { this.notify('This cargo crate is empty.'); return null; }
            if (this.enemies.some(e => e.hp > 0 && distance(e, p) < 10)) { this.notify('Clear the immediate danger before opening the crate.'); return null; }
            this.flags[key] = true; target.looted = true; this.inventory.scrap += 15; this.inventory.credits += 25; this.inventory.medkits = Math.min(30, this.inventory.medkits + 1);
            this.notify('Cargo recovered · +15 scrap · +$25 · +1 repair kit', 'salvage'); this.dirty = true; return null;
        }
        if (target.kind === 'bed') {
            if (this.enemies.some(e => e.hp > 0 && distance(e, p) < 15)) { this.notify('The medical cot cannot stabilize you under fire.'); return null; }
            p.hp = p.maxHp; p.oxygen = Math.max(p.oxygen, 70); this.notify('The old medical cot still works. Suit and vitals stabilized.', 'heal'); this.dirty = true; return null;
        }
        if (!m || m.wreck !== i.id) return this.setDialogue('terminal', target.id, i.name, this.visited.includes(i.id) && MISSIONS.findIndex(v => v.wreck === i.id) < this.mission ? 'The danger has passed. Your crew left a little lamp burning here. Search unopened crates, or return to the Kestrel.' : 'A stubborn emergency seal holds the bridge systems closed. Follow the signal’s current chapter before attempting the override.', [choice('close', 'Continue exploring')], { interior: i.id, x: target.x, y: target.y });
        if (!this.groupCleared('interior:' + i.id, m.boardCount)) { this.notify('Security machines are still active. Clear them before accessing the ship’s systems.'); return null; }
        if (i.id === 'sunward' && (target.id === 'anchor-a' || target.id === 'anchor-b')) {
            return this.setDialogue('terminal', target.id, 'Sunward anchor control', 'The carrier’s anchor is draining the living star. Release this clamp and a whole section of the ship goes quietly dark.', [choice('release-anchor', 'Release the anchor'), choice('close', 'Not yet')], { interior: i.id, x: target.x, y: target.y });
        }
        if (distance(p, i.objective) > 6.5) return this.setDialogue('terminal', target.id, i.name, 'Power runs through these old conduits toward the bridge. Your objective is marked in gold.', [choice('close', 'Follow the conduits')], { interior: i.id, x: target.x, y: target.y });
        const extra = { interior: i.id, x: i.objective.x, y: i.objective.y };
        if (i.id === 'sable') return this.setDialogue('terminal', 'sable-core', 'Something that remembers sunlight', 'A warm shard rests inside a nest of broken copper. When you touch the casing, a garden appears in your mind. Mara whispers over comms: “That is no ordinary salvage. There is a navigator in the Orchard who might understand.”', [choice('recover', 'Recover the star fragment'), choice('close', 'A moment longer')], extra);
        if (i.id === 'lark') return this.setDialogue('dialogue', 'moth', 'Moth · a map with room for you', '“I mapped every stone in this graveyard. Still got lost. Your fragment is singing the coordinates of a place that should not exist. I can get us there. If you have room for someone who dreams in directions.”', [choice('recruit-moth', 'Welcome aboard, Moth.'), choice('close', 'I will come back.')], extra);
        if (i.id === 'mercy') return this.setDialogue('dialogue', 'oru', 'Oru Venn · one more thing to save', '“The last lifeboat would not start. I stayed to fix it. Then the years got away from me.” He folds a paper bird with hands the size of your helmet. “Give me an engine worth saving. I will give you everything I have left.”', [choice('recruit-oru', 'Help us bring everyone home.'), choice('close', 'Let me prepare the berth.')], extra);
        if (i.id === 'choir') return this.setDialogue('choice', 'choir-memory', 'The archive and the lifeboats', 'The Choir holds an extinct civilization’s voices. Preserving its memory core keeps them whole. Harvesting the core gives Oru power cells for evacuation ships—but some memories will be lost. Pip’s little voice asks you to choose carefully.', [choice('preserve', 'Preserve the archive. Some things cannot be replaced.'), choice('harvest', 'Power the rescue fleet. Save the people still here.')], extra);
        if (i.id === 'sunward') {
            if (!this.flags.anchorA || !this.flags.anchorB) { this.notify('Release both anchor consoles in the hangar before opening the star lock.'); return null; }
            return this.setDialogue('terminal', 'sunward-command', 'No owner found', 'The command screen demands an owner’s authorization. Pip types EVERYONE. For a moment nothing happens. Then the lock opens. Somewhere beyond the hull, the star takes its first free breath.', [choice('release-star', 'Open the way to the Heart of Dawn')], extra);
        }
        return null;
    }

    validDialogue(d) {
        if (d.interior) return this.mode === 'board' && this.interior.id === d.interior && distance(this.pilot, d) < 10;
        return this.mode === 'space' && (d.sector === undefined || this.sector === d.sector) && (!Number.isFinite(d.x) || distance(this.ship, d) < 30);
    }
    choose(id) {
        if (this.phase !== 'play' || !this.dialogue || !this.dialogue.choices.some(c => c.id === id)) return this.dialogue;
        const d = this.dialogue;
        if (id === 'close') { this.dialogue = null; return null; }
        if (!this.validDialogue(d)) { this.dialogue = null; this.notify('Return to the console or station to continue.'); return null; }
        if (id === 'accept' && this.mission === 0) { this.advance('Mara trusted us with the Kestrel. First stop: the Sable, and a signal with a heartbeat.'); return null; }
        if (id === 'mara-story') return this.setDialogue('dialogue', 'mara', 'Mara · the reason for the lamp', '“After the moon broke, people needed somewhere to arrive. That is all a home is: a place where somebody is glad you made it. Now go find that signal. I suspect it has been waiting a very long time.”', [choice('accept', 'Then let us give it a place to arrive.'), choice('close', 'Thank you, Mara.')], { sector: d.sector, x: d.x, y: d.y });
        if (id === 'recover' && this.mission === 1 && this.mode === 'board' && this.interior.id === 'sable') { this.flags.fragment = true; this.inventory.crystal += 6; this.advance('The Sable carried a living star fragment. It showed us a garden. The Orchard may hold someone who can read its map.'); return null; }
        if (id === 'recruit-moth' && this.mission === 2) { this.recruit('moth'); this.advance('Moth joined the crew. Their dream-map points to three harmonic relays in Prismwake.'); return null; }
        if (id === 'recruit-oru' && this.mission === 4) { this.recruit('oru'); this.advance('Oru left a paper bird in the Mercy’s engine room. Our new engineer knows the Needle Queen guards an ancient memory ark.'); return null; }
        if (id === 'recruit-pip' && this.mission === 6) { this.recruit('pip'); this.advance('Pip joined as archivist, cook, and self-appointed conscience. The guild’s Red Meridian blockade stands between us and the living star.'); return null; }
        if (id === 'pip-story') return this.setDialogue('dialogue', 'pip', 'Pip · what a civilization keeps', '“The Choir’s people built a star that could grow gardens in empty space. Then they vanished. Their guardian machines kept their promise so well that nobody could come close enough to help. I remember their recipes. I think that matters.”', [choice('recruit-pip', 'It matters to us. Welcome aboard.'), choice('close', 'We will be back.')], { sector: d.sector, x: d.x, y: d.y });
        if (id === 'tune' && this.mission === 3 && MISSIONS[3].relays.includes(d.speaker) && this.groupCleared('relay:' + d.speaker, 2)) {
            this.flags['relay:' + d.speaker] = true; this.inventory.credits += 35; this.inventory.crystal += 3; this.dialogue = null;
            if (MISSIONS[3].relays.every(relay => this.flags['relay:' + relay])) this.advance('Three relays sing together. The Mercy’s distress call emerged from the harmony; someone is still alive aboard.');
            else this.notify('Relay tuned. The harmony grows clearer.', 'quest'); this.dirty = true; return null;
        }
        if ((id === 'preserve' || id === 'harvest') && this.mission === 5 && this.mode === 'board' && this.interior.id === 'choir') {
            this.flags.archivePreserved = id === 'preserve'; this.flags.archiveHarvested = id === 'harvest';
            if (id === 'preserve') { this.inventory.crystal += 12; this.record('We preserved the Choir’s memories. Pip sent a message: “You saved a whole language for tomorrow.”'); }
            else { this.inventory.scrap += 75; this.inventory.credits += 120; this.record('We harvested the archive’s power cells for the rescue fleet. Oru saved every recording the smaller cores could hold.'); }
            this.advance('The living star is a seed. Its last caretaker, Pip Nine, is waiting at the Freehouse.'); return null;
        }
        if (id === 'disable' && this.mission === 7 && this.groupCleared('story:7', MISSIONS[7].spaceCount)) { this.flags.blockade = true; this.advance('Stormgate is open to civilians. The Sunward carrier still holds the star’s last anchor.'); return null; }
        if (id === 'release-anchor' && this.mission === 8 && this.mode === 'board' && this.interior.id === 'sunward') {
            if (d.speaker === 'anchor-a') this.flags.anchorA = true; if (d.speaker === 'anchor-b') this.flags.anchorB = true;
            this.dialogue = null; this.notify('Anchor released. ' + ((this.flags.anchorA ? 1 : 0) + (this.flags.anchorB ? 1 : 0)) + ' / 2 offline.', 'quest'); this.dirty = true; return null;
        }
        if (id === 'release-star' && this.mission === 8 && this.flags.anchorA && this.flags.anchorB) { this.flags.carrier = true; this.advance('Pip typed EVERYONE into the authorization field. The Sunward opened a road to the Heart of Dawn.'); return null; }
        if ((id === 'awaken' || id === 'steward') && this.mission === 9 && this.groupCleared('story:9', MISSIONS[9].spaceCount)) {
            this.flags.awakened = id === 'awaken'; this.flags.steward = id === 'steward'; this.flags.finished = true;
            this.advance(id === 'awaken' ? 'We released the living star to everyone. A thousand settlements woke to a shared dawn.' : 'We entrusted the living star to a council of every settlement. Power and responsibility will be shared in the open.');
            this.phase = 'ending'; this.dialogue = null; this.dirty = true; return null;
        }
        if (id === 'repair') { this.repair(); return this.dialogue; }
        if (id === 'contracts') return this.contractBoard(d);
        if (id.startsWith('contract:')) {
            const c = this.contracts.find(c => c.id === id.slice(9)), info = c && CONTRACTS.find(v => v.id === c.id);
            if (c && info && this.unlockedSectors().includes(info.sector) && c.status !== 'active') {
                if (c.status === 'complete') { const prefix = 'contract:' + c.id + ':' + c.round + ':'; this.defeated = this.defeated.filter(e => !e.startsWith(prefix)); c.round++; }
                c.status = 'active'; this.notify('Contract accepted: ' + info.name + '. Its location is marked on your chart.', 'quest'); this.dirty = true;
            }
            return this.contractBoard(d);
        }
        if (id === 'crew-story') {
            const texts = this.crew.map(id => CREW.find(c => c.id === id).story);
            return this.setDialogue('dialogue', d.speaker, 'The Kestrel’s kitchen table', texts.length ? texts.join(' ') : 'An empty chair, two chipped mugs, and a paper star taped above the galley. Someday there will be more people here. For now, Mara always answers the radio.', [choice('close', 'Keep a place at the table')], { sector: d.sector, x: d.x, y: d.y });
        }
        return this.dialogue;
    }
    recruit(id) { if (!this.crew.includes(id)) { this.crew.push(id); this.refreshStats(); if (this.interior) this.makeInterior(this.interior.id); this.notify(CREW.find(c => c.id === id).name + ' joined the Kestrel.', 'crew'); this.dirty = true; } }
    advance(log) {
        const m = MISSIONS[this.mission]; if (!m) return;
        this.inventory.credits += m.reward; this.inventory.scrap += 20 + this.mission * 4; this.inventory.crystal += 2;
        this.record(log); this.mission++; this.dialogue = null;
        this.notify('CHAPTER COMPLETE · +$' + m.reward + ' · ' + (MISSIONS[this.mission] ? MISSIONS[this.mission].title : 'The stars are open'), 'quest'); this.dirty = true;
    }
    contractBoard(d) {
        const choices = this.contracts.filter(c => c.status !== 'active' && this.unlockedSectors().includes(CONTRACTS.find(v => v.id === c.id).sector)).map(c => { const info = CONTRACTS.find(v => v.id === c.id); return choice('contract:' + c.id, (c.status === 'complete' ? 'Again: ' : '') + info.name + ' · $' + info.reward); });
        choices.push(choice('close', 'Back to the ship'));
        return this.setDialogue('dock', d.speaker, 'The civilian contract board', 'Keep the salvage lanes open. Payment is automatic when the last hostile is defeated. The same route can be patrolled again when new trouble arrives.', choices, { sector: d.sector, x: d.x, y: d.y, contracts: true });
    }
    checkContracts() {
        this.contracts.filter(c => c.status === 'active').forEach(c => {
            const info = CONTRACTS.find(v => v.id === c.id);
            if (this.groupCleared('contract:' + c.id + ':' + c.round, info.count)) {
                c.status = 'complete'; this.inventory.credits += info.reward; this.inventory.scrap += info.scrap; this.inventory.crystal += info.crystal; this.stats.contracts++;
                this.notify('CONTRACT COMPLETE · ' + info.name + ' · $' + info.reward + ' + salvage', 'quest'); this.dirty = true;
            }
        });
    }
    buy(id) {
        if (!this.canFit()) { this.notify('Dock at a station to buy and install ship parts.'); return false; }
        const item = moduleById(id) || SUPPLIES.find(supply => supply.id === id);
        if (!item || this.owned.includes(id)) return false;
        if (this.inventory.credits < item.price || this.inventory.scrap < item.scrap || this.inventory.crystal < item.crystal) { this.notify('More salvage needed: $' + item.price + ', ' + item.scrap + ' scrap, ' + item.crystal + ' crystal. Mine asteroids or take a contract.'); return false; }
        if (id === 'medkit' && this.inventory.medkits >= 30) return false;
        this.inventory.credits -= item.price; this.inventory.scrap -= item.scrap; this.inventory.crystal -= item.crystal;
        if (id === 'medkit') this.inventory.medkits++;
        else if (id === 'crystal-pack') this.inventory.crystal += 5;
        else { this.owned.push(id); this.equip(id); }
        this.notify(item.name + ' acquired and secured aboard.', 'buy'); this.dirty = true; return true;
    }
    equip(id) {
        if (!this.canFit()) { this.notify('A fitting bay is required to change modules.'); return false; }
        const item = moduleById(id); if (!item || !this.owned.includes(id)) return false;
        this.loadout[item.slot] = id; this.refreshStats(); this.notify(item.name + ' installed. Look at the Kestrel now.', 'equip'); this.dirty = true; return true;
    }

    objective() {
        const m = MISSIONS[this.mission];
        if (this.mode === 'board') {
            const i = this.interior, matching = m && m.wreck === i.id;
            if (!matching) return { title: 'Return to the Kestrel', text: 'Explore unopened cargo or head back to the airlock.', progress: 'AIRLOCK', sector: this.sector, x: i.exit.x, y: i.exit.y };
            const cleared = this.defeated.filter(id => id.startsWith('interior:' + i.id + ':')).length;
            let target = i.objective;
            if (i.id === 'sunward' && cleared >= m.boardCount) target = !this.flags.anchorA ? i.props.find(p => p.id === 'anchor-a') : !this.flags.anchorB ? i.props.find(p => p.id === 'anchor-b') : i.objective;
            return { title: m.title, text: cleared < m.boardCount ? 'Clear the security machines, then reach the marked console.' : i.id === 'sunward' && (!this.flags.anchorA || !this.flags.anchorB) ? 'Release both hangar anchors.' : 'Interact with the marked console to continue.', progress: cleared + ' / ' + m.boardCount + ' security machines', sector: this.sector, x: target.x, y: target.y };
        }
        if (!m) {
            const c = this.contracts.find(c => c.status === 'active'), data = c && CONTRACTS.find(v => v.id === c.id);
            return data ? { title: data.name, text: data.description, progress: 'CIVILIAN CONTRACT', sector: data.sector, x: data.x, y: data.y } : { title: 'The open stars', text: 'Refit the Kestrel, explore old wrecks, and take new civilian contracts at any station.', progress: 'STORY COMPLETE', sector: this.sector, x: 35, y: 91 };
        }
        let id = m.poi;
        if (this.mission === 3) id = m.relays.find(r => !this.flags['relay:' + r]) || m.poi;
        if (this.mission === 5 && this.groupCleared('story:5', m.spaceCount)) id = 'choir';
        const poi = SECTORS[m.sector].pois.find(p => p.id === id);
        let progress = m.spaceCount ? this.defeated.filter(v => v.startsWith('story:' + this.mission + ':')).length + ' / ' + m.spaceCount + ' exterior defenders' : this.mission === 3 ? m.relays.filter(r => this.flags['relay:' + r]).length + ' / 3 relays' : 'FOLLOW THE SIGNAL';
        if (this.sector !== m.sector) progress = 'CHART → ' + SECTORS[m.sector].name.toUpperCase();
        return { title: m.title, text: m.description, progress, sector: m.sector, x: poi.x, y: poi.y };
    }

    serialize() {
        this.cacheContext();
        const contexts = {};
        Object.keys(this.contexts).forEach(key => { const c = this.contexts[key]; contexts[key] = { enemies: c.enemies.filter(e => e.hp > 0).map(e => Object.assign({}, e, { windup: 0, cooldown: 1.2 })), loot: c.loot.map(l => Object.assign({}, l)) }; });
        return { version: 1, mode: this.mode, sector: this.sector, interior: this.interior ? this.interior.id : null, time: this.time, seed: this.seed,
            ship: Object.assign({}, this.ship, { vx: 0, vy: 0, hurt: 0, dash: 0, moving: false }), pilot: Object.assign({}, this.pilot, { hurt: 0, dash: 0, moving: false }),
            inventory: Object.assign({}, this.inventory), owned: this.owned.slice(), loadout: Object.assign({}, this.loadout), crew: this.crew.slice(), mission: this.mission,
            flags: Object.assign({}, this.flags), stats: Object.assign({}, this.stats), log: this.log.slice(), contracts: this.contracts.map(c => Object.assign({}, c)),
            defeated: this.defeated.slice(-1000), rockHealth: Object.assign({}, this.rockHealth), visited: this.visited.slice(), contexts };
    }
    load(data) {
        if (!data || typeof data !== 'object' || data.version !== 1 || !data.ship || typeof data.ship !== 'object') return false;
        const ids = MODULES.map(m => m.id);
        this.owned = Array.isArray(data.owned) ? Array.from(new Set(data.owned.filter(id => ids.includes(id)))) : [];
        STARTERS.forEach(id => { if (!this.owned.includes(id)) this.owned.push(id); });
        if (data.loadout && typeof data.loadout === 'object') Object.keys(this.loadout).forEach(slot => { const item = moduleById(data.loadout[slot]); if (item && item.slot === slot && this.owned.includes(item.id)) this.loadout[slot] = item.id; });
        this.crew = Array.isArray(data.crew) ? Array.from(new Set(data.crew.filter(id => CREW.some(c => c.id === id)))) : [];
        this.mission = Math.floor(number(data.mission, 0, 0, MISSIONS.length));
        if (this.mission > 2 && !this.crew.includes('moth')) this.crew.push('moth');
        if (this.mission > 4 && !this.crew.includes('oru')) this.crew.push('oru');
        if (this.mission > 6 && !this.crew.includes('pip')) this.crew.push('pip');
        this.refreshStats();
        const s = data.ship;
        this.ship.x = number(s.x, 56, 5, 235); this.ship.y = number(s.y, 96, 5, 175); this.ship.angle = number(s.angle, 0, -7, 7);
        this.ship.hull = number(s.hull, this.ship.maxHull, 1, this.ship.maxHull); this.ship.shield = number(s.shield, this.ship.maxShield, 0, this.ship.maxShield);
        this.ship.energy = number(s.energy, 100, 0, 100); this.ship.heat = number(s.heat, 0, 0, 100); this.ship.boost = number(s.boost, 100, 0, 100);
        const p = data.pilot && typeof data.pilot === 'object' ? data.pilot : {};
        this.pilot.hp = number(p.hp, 100, 1, 100); this.pilot.oxygen = number(p.oxygen, 100, 1, 100); this.pilot.angle = number(p.angle, 0, -7, 7);
        if (data.inventory && typeof data.inventory === 'object') Object.keys(this.inventory).forEach(key => { this.inventory[key] = Math.floor(number(data.inventory[key], this.inventory[key], 0, key === 'medkits' ? 30 : 999999)); });
        this.sector = Math.floor(number(data.sector, 0, 0, 5)); if (!this.unlockedSectors().includes(this.sector)) this.sector = 0;
        this.time = number(data.time, 0, 0, 10000000); this.seed = Math.floor(number(data.seed, this.seed, 0, 4294967295));
        const validFlags = Object.keys(this.flags).concat(['relay:prism-a', 'relay:prism-b', 'relay:prism-c']);
        Object.keys(INTERIORS).forEach(id => INTERIORS[id].props.filter(prop => prop.kind === 'crate').forEach(prop => validFlags.push('cache:' + id + ':' + prop.id)));
        if (data.flags && typeof data.flags === 'object') validFlags.forEach(key => { if (data.flags[key] === true) this.flags[key] = true; });
        this.flags.fragment = this.mission > 1; this.flags.blockade = this.mission > 7; this.flags.carrier = this.mission > 8; this.flags.finished = this.mission >= MISSIONS.length;
        if (this.mission > 3) ['prism-a', 'prism-b', 'prism-c'].forEach(id => { this.flags['relay:' + id] = true; });
        if (this.mission > 8) { this.flags.anchorA = true; this.flags.anchorB = true; }
        if (data.stats && typeof data.stats === 'object') Object.keys(this.stats).forEach(key => { this.stats[key] = Math.floor(number(data.stats[key], 0, 0, 999999)); });
        if (Array.isArray(data.log)) this.log = data.log.filter(v => typeof v === 'string').map(v => v.slice(0, 500)).slice(-60);
        if (Array.isArray(data.visited)) this.visited = Array.from(new Set(data.visited.filter(id => Object.prototype.hasOwnProperty.call(INTERIORS, id))));
        if (Array.isArray(data.contracts)) this.contracts.forEach(c => { const saved = data.contracts.find(v => v && v.id === c.id); if (saved) { c.status = ['available', 'active', 'complete'].includes(saved.status) ? saved.status : 'available'; c.round = Math.floor(number(saved.round, 0, 0, 999999)); } });
        const validEnemyId = id => typeof id === 'string' && /^(story:[1-9]|relay:prism-[abc]|interior:(sable|lark|mercy|choir|sunward)|contract:(orchard-run|prism-cleanup|meridian-escort):\d{1,6}):\d$/.test(id);
        this.defeated = Array.isArray(data.defeated) ? Array.from(new Set(data.defeated.filter(validEnemyId).slice(-1000))) : [];
        if (data.rockHealth && typeof data.rockHealth === 'object') SECTORS.forEach(sec => sec.rocks.forEach(rock => { const key = sec.id + ':' + rock.id; if (Number.isFinite(data.rockHealth[key])) this.rockHealth[key] = number(data.rockHealth[key], rock.hp, 0, rock.maxHp); }));
        this.buildWorld();
        const validKeys = SECTORS.map(sec => 'space:' + sec.id).concat(Object.keys(INTERIORS).map(id => 'board:' + id));
        if (data.contexts && typeof data.contexts === 'object') validKeys.forEach(key => {
            const saved = data.contexts[key]; if (!saved || typeof saved !== 'object') return;
            const board = key.startsWith('board:'), map = board ? INTERIORS[key.slice(6)] : SECTORS[Number(key.slice(6))];
            const collisionMap = board ? map : Object.assign({}, map, { rocks: map.rocks.filter(r => this.rockHealth[map.id + ':' + r.id] !== 0) });
            const state = { enemies: [], loot: [] };
            if (Array.isArray(saved.enemies)) saved.enemies.slice(0, T.maxEnemies).forEach(e => {
                if (!e || !validEnemyId(e.id) || this.defeated.includes(e.id) || state.enemies.some(v => v.id === e.id) || !Object.prototype.hasOwnProperty.call(ENEMY_STATS, e.type)) return;
                const type = e.type, stats = ENEMY_STATS[type], group = e.id.slice(0, e.id.lastIndexOf(':'));
                if (board ? group !== 'interior:' + map.id : group.startsWith('interior:')) return;
                if (board ? !['bot', 'turret', 'sentinel'].includes(type) : !['drone', 'pirate', 'bruiser', 'queen', 'warden'].includes(type)) return;
                if (!board && group.startsWith('story:') && (group !== 'story:' + this.mission || !MISSIONS[this.mission] || MISSIONS[this.mission].sector !== map.id)) return;
                if (!board && group.startsWith('relay:') && (this.mission !== 3 || map.id !== 2)) return;
                if (!board && group.startsWith('contract:') && !this.contracts.some(c => c.status === 'active' && group === 'contract:' + c.id + ':' + c.round && CONTRACTS.find(v => v.id === c.id).sector === map.id)) return;
                const x = number(e.x, board ? 44 : 160, 2, map.width - 2), y = number(e.y, board ? 20 : 90, 2, map.height - 2);
                // Bad actor positions are discarded so normal encounter spawning
                // restores them to reachable authored locations on the next tick.
                if (solidAt(collisionMap, board, x, y, stats.radius)) return;
                let homeX = number(e.homeX, x, 2, map.width - 2), homeY = number(e.homeY, y, 2, map.height - 2);
                if (solidAt(collisionMap, board, homeX, homeY, stats.radius)) { homeX = x; homeY = y; }
                state.enemies.push({ id: e.id, group, type, x, y, homeX, homeY, vx: 0, vy: 0, angle: number(e.angle, 0, -7, 7), hp: number(e.hp, stats.hp, 1, stats.hp), maxHp: stats.hp, radius: stats.radius, windup: 0, cooldown: 1.4, targetAngle: 0, alerted: e.alerted === true, boss: type === 'queen' || type === 'warden', volleys: Math.floor(number(e.volleys, 0, 0, 100000)), moving: false });
            });
            if (Array.isArray(saved.loot)) saved.loot.slice(0, T.maxLoot).forEach(l => { if (l && ['credits', 'scrap', 'crystal', 'medkit'].includes(l.kind)) state.loot.push({ id: 'loot-' + (++this.lootId), x: number(l.x, 40, 2, map.width - 2), y: number(l.y, 30, 2, map.height - 2), kind: l.kind, amount: Math.floor(number(l.amount, 1, 1, l.kind === 'medkit' ? 3 : 100)), angle: 0 }); });
            this.contexts[key] = state;
        });
        if (this.solid(this.ship.x, this.ship.y, T.shipRadius)) { this.ship.x = 56; this.ship.y = 96; }
        const wreck = typeof data.interior === 'string' && Object.prototype.hasOwnProperty.call(INTERIORS, data.interior) && this.world.pois.some(poi => poi.id === data.interior) ? data.interior : null;
        if (data.mode === 'board' && wreck) { this.mode = 'board'; this.makeInterior(wreck); this.pilot.x = number(p.x, this.interior.exit.x + 3, 2, this.interior.width - 2); this.pilot.y = number(p.y, this.interior.exit.y, 2, this.interior.height - 2); if (this.solid(this.pilot.x, this.pilot.y, 1)) { this.pilot.x = this.interior.exit.x + 3; this.pilot.y = this.interior.exit.y; } }
        this.activateContext(); this.hasSave = true; this.messageUntil = this.time + 10; return true;
    }
}

module.exports = { Salvage, clamp, distance };
