'use strict';

const { WEAPONS, UPGRADES, OUTFITS, PROPERTIES, PERKS, MISSIONS, BOUNTIES, TUNING: T, buildWorld } = require('./content');
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const finite = (value, fallback, min, max) => Number.isFinite(value) ? clamp(value, min, max) : fallback;
const cleanIds = (value, ids) => Array.isArray(value) ? Array.from(new Set(value.filter(id => ids.includes(id)))) : [];
const choice = (id, label) => ({ id, label });

class Frontier {
    constructor(saveData) {
        this.world = buildWorld();
        this.phase = 'title';
        this.time = 0;
        this.player = {
            x: 62, y: 67, angle: -Math.PI / 2, hp: T.playerHp, maxHp: T.playerHp,
            stamina: 100, focus: 100, money: 65, xp: 0, level: 1,
            weapon: 'revolver', weapons: ['revolver'], mods: [], outfit: 'trailcoat',
            outfits: ['trailcoat'], properties: [], perks: [], perkPoints: 0,
            mounted: false, aboard: false, moving: false, ammo: 6, reserve: 84, medkits: 3,
            hurt: 0, dodge: 0, reloading: 0, fireCooldown: 0, focusTime: 0
        };
        this.horse = { x: 61, y: 72, angle: 0, moving: false, name: 'Comet' };
        this.train = { x: 141, y: 92, angle: 0, direction: 1 };
        this.enemies = [];
        this.shots = [];
        this.effects = [];
        this.loot = [];
        this.events = [];
        this.mission = 0;
        this.flags = { letter: false, water: false, prisoners: false, dynamo: false, mercy: false, justice: false, community: false, independent: false, finished: false };
        this.bounties = BOUNTIES.map(b => ({ id: b.id, status: 'available', rounds: 0 }));
        this.defeated = [];
        this.magazines = { revolver: 6 };
        this.propertyIncome = {};
        this.incomeClock = 0;
        this.dialogue = null;
        this.message = 'Seven years gone. One last letter. A whole valley to save.';
        this.messageUntil = 8;
        this.dirty = false;
        this.seed = 748923;
        this.shotId = 0;
        this.lootId = 0;
        this.saveClock = 0;
        this.aboardOffset = -12;
        this.dodgeAngle = 0;
        this.lastMove = { x: 0, y: -1 };
        this.hasSave = false;
        this.load(saveData);
    }

    random() {
        this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
        return this.seed / 4294967296;
    }

    notify(text, event) {
        this.message = text;
        this.messageUntil = this.time + 5;
        if (event && this.events.length < 12) this.events.push(event);
    }

    begin() {
        if (this.phase === 'ending') {
            this.phase = 'play';
            this.dialogue = null;
            this.notify('The valley is free. Build a home, hunt bounties, and ride wherever the light takes you.', 'quest');
            this.dirty = true;
        } else if (this.phase === 'title') {
            this.phase = 'play';
            this.notify(this.hasSave ? 'Welcome back, Rowan. The frontier remembers.' : 'Find June outside The Last Light. WASD to ride the road; E to talk.', 'start');
        }
    }

    get endingText() {
        const verdict = this.flags.mercy
            ? 'Vale stands trial in daylight. His ledger names every stolen acre; his fortune pays the families back.'
            : 'Vale leaves on a train he no longer owns. His surrendered fortune restores the families he drove out.';
        const charter = this.flags.community
            ? 'Your common charter gives the water to the valley and the railway to its workers.'
            : 'Every family receives a homestead deed, with clean water guaranteed to all.';
        return verdict + ' ' + charter + ' June keeps the lamps lit. Inez turns her engines to irrigation. Ada runs the first free passenger train. Sol’s orchard blooms; Ezra hangs a new OPEN sign. You leave a wildflower on your mother’s grave. Comet waits by the road. At last, Rowan Wren, you are home.';
    }

    weaponStats() {
        const p = this.player;
        const base = WEAPONS.find(w => w.id === p.weapon) || WEAPONS[0];
        return Object.assign({}, base, {
            damage: base.damage * (p.mods.includes('longbarrel') ? 1.25 : 1) * (p.perks.includes('gunslinger') ? 1.15 : 1),
            range: base.range * (p.mods.includes('longbarrel') ? 1.2 : 1),
            clip: base.clip + (p.mods.includes('drummag') ? 4 : 0),
            reload: base.reload * (p.mods.includes('drummag') ? 0.75 : 1)
        });
    }

    solid(x, y, radius) {
        const r = radius === undefined ? 1 : radius;
        if (x < 3 || y < 3 || x > T.width - 3 || y > T.height - 3) return true;
        return this.world.buildings.some(b => Math.abs(x - b.x) < b.w / 2 + r && Math.abs(y - b.y) < b.d / 2 + r)
            || this.world.props.some(prop => prop.kind === 'mesa' && Math.abs(x - prop.x) < prop.size + r && Math.abs(y - prop.y) < prop.size * 0.7 + r);
    }

    move(actor, dx, dy, radius) {
        // Axis resolution lets riders slide along walls rather than get stuck on corners.
        const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 1.2));
        for (let i = 0; i < steps; i++) {
            if (!this.solid(actor.x + dx / steps, actor.y, radius)) actor.x += dx / steps;
            if (!this.solid(actor.x, actor.y + dy / steps, radius)) actor.y += dy / steps;
        }
    }

    clearShot(a, b) {
        const d = distance(a, b), steps = Math.ceil(d / 2);
        for (let i = 1; i < steps; i++) {
            if (this.solid(a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps, 0)) return false;
        }
        return true;
    }

    tick(dt, input) {
        if (this.phase !== 'play') return;
        this.events = this.events.slice(-12);
        dt = finite(dt, 0.05, 0.001, 0.15);
        input = input || {};
        const p = this.player;
        this.time += dt;
        this.saveClock += dt;
        if (this.saveClock > 8) { this.saveClock = 0; this.dirty = true; }
        p.hurt = Math.max(0, p.hurt - dt);
        p.dodge = Math.max(0, p.dodge - dt);
        p.fireCooldown = Math.max(0, p.fireCooldown - dt);
        p.focusTime = Math.max(0, p.focusTime - dt);
        if (p.focusTime === 0) p.focus = Math.min(100, p.focus + dt * T.focusRegen);
        const worldDt = dt * (p.focusTime > 0 ? T.focusSlow : 1);
        this.train.x += this.train.direction * T.trainSpeed * worldDt;
        if (this.train.x > T.trainRight || this.train.x < T.trainLeft) {
            this.train.x = clamp(this.train.x, T.trainLeft, T.trainRight);
            // The shuttle changes its leading end at each terminus. Preserve the
            // positions of its cars and occupants instead of teleporting riders.
            this.train.x -= this.train.direction * T.trainSpan;
            this.aboardOffset = -T.trainSpan - this.aboardOffset;
            this.enemies.forEach(e => {
                if (e.trainOffset !== undefined) e.trainOffset = -T.trainSpan - e.trainOffset;
            });
            this.train.direction *= -1;
            this.train.angle = this.train.direction < 0 ? Math.PI : 0;
        }
        let mx = finite(input.x, 0, -1, 1), my = finite(input.y, 0, -1, 1);
        const length = Math.hypot(mx, my);
        const oldX = p.x, oldY = p.y;
        if (length > 0) { mx /= length; my /= length; this.lastMove = { x: mx, y: my }; }
        if (p.aboard) {
            this.aboardOffset = clamp(this.aboardOffset + mx * this.train.direction * dt * 11, T.trainRear, 3);
            p.x = clamp(this.train.x + this.aboardOffset * this.train.direction, 3, T.width - 3);
            p.y = this.train.y - 1;
        } else if (p.dodge > 0) {
            this.move(p, Math.cos(this.dodgeAngle) * T.dodgeSpeed * dt, Math.sin(this.dodgeAngle) * T.dodgeSpeed * dt, 0.8);
        } else if (length) {
            const running = input.sprint && p.stamina > 1 && !p.mounted;
            const speed = p.mounted ? T.horseSpeed * (p.perks.includes('rider') ? 1.2 : 1) : T.playerSpeed * (running ? T.sprint : 1);
            this.move(p, mx * speed * dt, my * speed * dt, p.mounted ? 1.4 : 1);
            p.angle = Math.atan2(my, mx);
            if (running) p.stamina = Math.max(0, p.stamina - dt * 26);
        }
        if (!input.sprint && p.dodge <= 0) p.stamina = Math.min(100, p.stamina + dt * T.staminaRegen * (p.perks.includes('rider') ? 1.3 : 1));
        p.moving = (length > 0 || p.dodge > 0) && Math.hypot(p.x - oldX, p.y - oldY) > 0.01;
        this.horse.moving = p.mounted && p.moving;
        if (p.mounted) { this.horse.x = p.x; this.horse.y = p.y; this.horse.angle = p.angle; }
        if (p.reloading > 0) {
            p.reloading = Math.max(0, p.reloading - dt);
            if (p.reloading === 0) {
                const amount = Math.min(this.weaponStats().clip - p.ammo, p.reserve);
                p.ammo += amount;
                p.reserve -= amount;
                this.magazines[p.weapon] = p.ammo;
                this.events.push('reload');
            }
        }
        this.spawnEncounters();
        if (input.fire) this.fire(input.aim);
        this.updateEnemies(worldDt);
        this.updateShots(worldDt, dt);
        if (this.phase !== 'play') return;
        this.effects.forEach(e => { e.life -= dt; });
        this.effects = this.effects.filter(e => e.life > 0).slice(-T.maxEffects);
        this.collectLoot();
        this.checkBounties();
        this.incomeClock += dt;
        if (this.incomeClock >= T.incomeInterval) {
            this.incomeClock %= T.incomeInterval;
            p.properties.forEach(id => { const property = PROPERTIES.find(v => v.id === id); this.propertyIncome[id] = Math.min(9999, (this.propertyIncome[id] || 0) + property.income); });
            if (p.properties.length) { this.notify('Your properties earned rent. Visit a property to collect it.', 'coin'); this.dirty = true; }
        }
    }

    fire(aim) {
        if (this.phase !== 'play') return false;
        const p = this.player, stats = this.weaponStats();
        if (p.fireCooldown > 0 || p.reloading > 0 || p.dodge > 0) return false;
        if (p.ammo <= 0) {
            if (p.reserve > 0) this.reload();
            else { p.fireCooldown = 0.5; this.notify('Out of ammunition. Camps and town merchants restock you for free.'); }
            return false;
        }
        let angle = p.angle;
        if (aim && Number.isFinite(aim.x) && Number.isFinite(aim.y)) angle = Math.atan2(aim.y - p.y, aim.x - p.x);
        else {
            const target = this.enemies.filter(e => e.hp > 0 && distance(e, p) <= stats.range && this.clearShot(p, e)).sort((a, b) => distance(a, p) - distance(b, p))[0];
            if (target) angle = Math.atan2(target.y - p.y, target.x - p.x);
        }
        p.angle = angle;
        p.fireCooldown = stats.rate;
        p.ammo--;
        this.magazines[p.weapon] = p.ammo;
        const shotHeight = p.aboard ? 11.3 : p.mounted ? 7 : 3.3;
        for (let i = 0; i < stats.pellets && this.shots.length < T.maxShots; i++) {
            const spread = stats.pellets > 1 ? (i - 2) * 0.075 : 0;
            this.shots.push({ id: ++this.shotId, x: p.x + Math.cos(angle) * 1.7, y: p.y + Math.sin(angle) * 1.7, px: p.x, py: p.y,
                vx: Math.cos(angle + spread) * T.bulletSpeed, vy: Math.sin(angle + spread) * T.bulletSpeed,
                enemy: false, damage: stats.damage, range: stats.range, weapon: p.weapon, life: stats.range / T.bulletSpeed, z: shotHeight });
        }
        this.effect(p.x + Math.cos(angle) * 3, p.y + Math.sin(angle) * 3, 'muzzle', 0.12, shotHeight);
        this.events.push(p.weapon === 'voltaic' ? 'electric' : 'shot');
        this.dirty = true;
        return true;
    }

    reload() {
        if (this.phase !== 'play') return false;
        const p = this.player, stats = this.weaponStats();
        if (p.reloading > 0 || p.ammo >= stats.clip || p.reserve <= 0) return false;
        p.reloading = stats.reload;
        this.notify('Reloading ' + stats.name + '…');
        return true;
    }

    dodge() {
        const p = this.player;
        if (this.phase !== 'play' || p.dodge > 0 || p.stamina < T.dodgeCost || p.aboard) return false;
        if (p.mounted) { this.notify('Dismount to dodge. Comet is fast enough to outrun a gunhand.'); return false; }
        p.stamina -= T.dodgeCost;
        p.dodge = T.dodgeDuration;
        p.hurt = Math.max(p.hurt, T.dodgeDuration);
        this.dodgeAngle = Math.atan2(this.lastMove.y, this.lastMove.x);
        this.effect(p.x, p.y, 'dust', 0.4);
        this.events.push('dodge');
        return true;
    }

    heal() {
        const p = this.player;
        if (this.phase !== 'play' || p.hp >= p.maxHp) return false;
        if (p.medkits <= 0) { this.notify('No medicine left. Rest at a camp or visit Dr. Sol.'); return false; }
        p.medkits--;
        p.hp = Math.min(p.maxHp, p.hp + 65);
        this.effect(p.x, p.y, 'heal', 0.9);
        this.notify('Medicine used. +65 health.', 'heal');
        this.dirty = true;
        return true;
    }

    focus() {
        const p = this.player;
        if (this.phase !== 'play' || p.focusTime > 0) return false;
        if (p.focus < 55) { this.notify('Steady your breath. Focus needs 55 charge.'); return false; }
        p.focus -= 55;
        p.focusTime = T.focusDuration;
        this.notify('HIGH NOON · Time slows. Make every shot count.', 'focus');
        return true;
    }

    mount() {
        if (this.phase !== 'play') return false;
        const p = this.player;
        if (p.aboard) return this.leaveTrain();
        if (p.mounted) {
            p.mounted = false;
            this.horse.x = p.x + 3;
            this.horse.y = p.y + 2;
            this.notify('You dismount Comet. H calls your horse back.');
        } else {
            // A whistle is always available: abandoning a horse cannot strand a quest.
            this.horse.x = p.x;
            this.horse.y = p.y;
            p.mounted = true;
            this.notify('Comet answers your whistle. Ride the whole valley.', 'horse');
        }
        this.dirty = true;
        return true;
    }

    trainNear() {
        const p = this.player, t = this.train;
        const dx = (p.x - t.x) * t.direction;
        return Math.abs(p.y - t.y) < 9 && dx > T.trainRear - 5 && dx < 8;
    }

    boardTrain() {
        if (this.phase !== 'play') return false;
        const p = this.player;
        if (!this.trainNear()) return false;
        p.mounted = false;
        p.aboard = true;
        this.aboardOffset = clamp((p.x - this.train.x) * this.train.direction, T.trainRear, 3);
        this.notify('Aboard the Copperline Express. Move along the cars; E to interact or disembark.', 'train');
        this.spawnEncounters();
        this.dirty = true;
        return true;
    }

    leaveTrain() {
        if (this.phase !== 'play' || !this.player.aboard) return false;
        const p = this.player;
        p.aboard = false;
        p.y = 99;
        p.x = clamp(p.x, 5, T.width - 5);
        if (this.solid(p.x, p.y, 1)) p.y = 85;
        this.horse.x = p.x + 3;
        this.horse.y = p.y + 2;
        this.notify('Back on the trail. Comet is waiting.', 'horse');
        this.dirty = true;
        return true;
    }

    spawnGroup(key, x, y, count, boss, train) {
        for (let i = 0; i < count; i++) {
            const id = key + '-' + i;
            if (this.defeated.includes(id) || this.enemies.some(e => e.id === id) || this.enemies.length >= T.maxEnemies) continue;
            const kind = boss && i === count - 1 ? 'boss' : i % 4 === 3 ? 'brute' : i % 3 === 2 ? 'gunner' : 'raider';
            const hp = kind === 'boss' ? 320 : kind === 'brute' ? 96 : kind === 'gunner' ? 70 : 55;
            let ex = x + Math.cos(i * 2.4) * (7 + i * 1.7), ey = y + Math.sin(i * 2.4) * (7 + i * 1.7);
            if (this.solid(ex, ey, 1)) { ex = x + (i - count / 2) * 4; ey = y + 8; }
            const e = { id, group: key, x: ex, y: ey, homeX: ex, homeY: ey, angle: 0, hp, maxHp: hp, kind, windup: 0, cooldown: 1.1 + i * 0.3, targetAngle: 0, alerted: false };
            if (train) { e.trainOffset = -3 - i * 15; e.x = this.train.x + e.trainOffset * this.train.direction; e.y = this.train.y + 1; }
            this.enemies.push(e);
        }
    }

    spawnEncounters() {
        const m = MISSIONS[this.mission];
        if (m && m.enemies) {
            const aboard = this.mission === 4;
            if (aboard ? this.player.aboard : distance(this.player, m) < 53) this.spawnGroup('mission-' + this.mission, m.x, m.y, m.enemies, this.mission === 7, aboard);
        }
        this.bounties.filter(b => b.status === 'active').forEach(b => {
            const info = BOUNTIES.find(v => v.id === b.id);
            if (distance(this.player, info) < 48) this.spawnGroup('bounty-' + b.id + '-' + b.rounds, info.x, info.y, info.count, false, false);
        });
    }

    groupCleared(key, count) {
        for (let i = 0; i < count; i++) if (!this.defeated.includes(key + '-' + i)) return false;
        return true;
    }

    updateEnemies(dt) {
        const p = this.player;
        this.enemies.forEach(e => {
            if (e.hp <= 0) return;
            e.moving = false;
            if (e.trainOffset !== undefined) { e.x = this.train.x + e.trainOffset * this.train.direction; e.y = this.train.y + 1; }
            const d = distance(e, p);
            // Disengaged gangs return to their marked camp. A failed retreat must
            // not leave a bounty gunhand frozen far away from its map marker.
            if (e.trainOffset === undefined && d > 52) {
                e.windup = 0;
                e.alerted = false;
                const homeDistance = Math.hypot(e.homeX - e.x, e.homeY - e.y);
                if (homeDistance > 1) {
                    e.angle = Math.atan2(e.homeY - e.y, e.homeX - e.x);
                    this.move(e, Math.cos(e.angle) * Math.min(homeDistance, T.enemySpeed * dt), Math.sin(e.angle) * Math.min(homeDistance, T.enemySpeed * dt), 0.8);
                    e.moving = true;
                }
                return;
            }
            if (d > 70) { e.windup = 0; return; }
            e.cooldown = Math.max(0, e.cooldown - dt);
            e.angle = Math.atan2(p.y - e.y, p.x - e.x);
            if (e.windup > 0) {
                e.windup -= dt;
                if (e.windup <= 0) {
                    if (e.kind === 'brute' && d < 7) {
                        this.hurtPlayer(23);
                        this.effect(e.x, e.y, 'impact', 0.35);
                    } else if (this.clearShot(e, p)) {
                        const spread = e.kind === 'boss' ? [-0.15, 0, 0.15] : [0];
                        spread.forEach(offset => {
                            if (this.shots.length >= T.maxShots) return;
                            const a = e.targetAngle + offset;
                            this.shots.push({ id: ++this.shotId, x: e.x + Math.cos(a) * 1.7, y: e.y + Math.sin(a) * 1.7, px: e.x, py: e.y,
                                vx: Math.cos(a) * T.enemyBulletSpeed, vy: Math.sin(a) * T.enemyBulletSpeed, enemy: true,
                                damage: e.kind === 'boss' ? 17 : T.enemyDamage, life: 1.8, range: 60, weapon: 'revolver', z: e.trainOffset !== undefined ? 11.3 : 3.3 });
                        });
                        this.effect(e.x, e.y, 'muzzle', 0.1, e.trainOffset !== undefined ? 11.3 : 3.3);
                    }
                    e.cooldown = T.enemyCooldown * (e.kind === 'boss' ? 0.8 : e.kind === 'gunner' ? 0.85 : 1);
                }
                return;
            }
            if (d < T.enemyNotice) e.alerted = true;
            if (!e.alerted) return;
            const preferred = e.kind === 'brute' ? 5 : e.kind === 'boss' ? 20 : 22;
            if (e.trainOffset === undefined && (d > preferred || !this.clearShot(e, p))) {
                const a = e.angle + (this.solid(e.x + Math.cos(e.angle) * 3, e.y + Math.sin(e.angle) * 3, 1) ? 0.85 : 0);
                this.move(e, Math.cos(a) * T.enemySpeed * dt, Math.sin(a) * T.enemySpeed * dt, 0.8);
                e.moving = true;
            }
            if (d < T.enemyRange && e.cooldown <= 0 && this.clearShot(e, p)) {
                e.windup = e.kind === 'boss' ? 1.1 : T.enemyWindup;
                // Aim is fixed at the start of the clear windup. Dodging has meaning.
                e.targetAngle = Math.atan2(p.y - e.y, p.x - e.x) + (this.random() - 0.5) * (0.05 + d * 0.002);
            }
        });
    }

    updateShots(worldDt, dt) {
        this.shots.forEach(s => {
            const step = s.enemy ? worldDt : dt;
            s.px = s.x; s.py = s.y;
            s.x += s.vx * step; s.y += s.vy * step; s.life -= step;
            const targets = s.enemy ? [this.player] : this.enemies;
            for (const target of targets) {
                if (target.hp <= 0) continue;
                const vx = s.x - s.px, vy = s.y - s.py;
                const denominator = vx * vx + vy * vy;
                const t = denominator ? clamp(((target.x - s.px) * vx + (target.y - s.py) * vy) / denominator, 0, 1) : 0;
                if (Math.hypot(target.x - s.px - t * vx, target.y - s.py - t * vy) <= (s.enemy ? 1.4 : target.kind === 'boss' ? 2.7 : 1.65)) {
                    if (!this.clearShot({ x: s.px, y: s.py }, target)) continue;
                    if (s.enemy) this.hurtPlayer(s.damage);
                    else {
                        this.damageEnemy(target, s.damage);
                        if (s.weapon === 'voltaic' || this.player.mods.includes('brasscoil')) {
                            const chain = this.enemies.find(e => e.id !== target.id && e.hp > 0 && distance(e, target) < 12 && this.clearShot(target, e));
                            if (chain) { this.damageEnemy(chain, s.weapon === 'voltaic' ? 26 : 14); this.effect(chain.x, chain.y, 'electric', 0.35, chain.trainOffset !== undefined ? 10 : 3); }
                        }
                    }
                    s.life = 0;
                    break;
                }
            }
            if (this.solid(s.x, s.y, 0)) { s.life = 0; this.effect(s.x, s.y, 'spark', 0.2); }
        });
        this.shots = this.shots.filter(s => s.life > 0);
        this.enemies = this.enemies.filter(e => e.hp > 0);
    }

    damageEnemy(enemy, amount) {
        if (this.phase !== 'play' || enemy.hp <= 0) return;
        enemy.hp = Math.max(0, enemy.hp - amount);
        enemy.alerted = true;
        this.effect(enemy.x, enemy.y, 'hit', 0.25, enemy.trainOffset !== undefined ? 10 : 3);
        if (enemy.hp === 0) {
            if (!this.defeated.includes(enemy.id)) this.defeated.push(enemy.id);
            if (this.defeated.length > 1200) this.defeated = this.defeated.slice(-1000);
            this.awardXp(enemy.kind === 'boss' ? 100 : 18);
            this.drop(enemy.x, enemy.y, 'money', enemy.kind === 'boss' ? 100 : 12 + Math.floor(this.random() * 10));
            this.drop(enemy.x + 1.6, enemy.y + 1.3, 'ammo', enemy.kind === 'brute' ? 16 : 9);
            if (this.random() < 0.24) this.drop(enemy.x - 1.6, enemy.y + 1.1, 'medicine', 1);
            this.events.push('hit');
            const m = MISSIONS[this.mission];
            if (m && m.enemies && this.groupCleared('mission-' + this.mission, m.enemies)) this.notify(this.mission === 7 ? 'Vale’s armor is broken. Find him at the manor steps and choose his fate.' : this.mission === 4 ? 'The guards are down. Press E aboard to free the prisoners.' : 'The defenders are down. Follow the gold marker and press E.', 'quest');
        }
        this.dirty = true;
    }

    hurtPlayer(amount) {
        const p = this.player;
        if (this.phase !== 'play' || p.hurt > 0 || p.dodge > 0) return;
        const outfit = OUTFITS.find(o => o.id === p.outfit) || OUTFITS[0];
        p.hp = Math.max(0, p.hp - amount * (1 - outfit.armor));
        p.hurt = 0.38;
        this.effect(p.x, p.y, 'hit', 0.25, p.aboard ? 10 : p.mounted ? 6 : 3);
        this.events.push('hurt');
        this.dirty = true;
        if (p.hp <= 0) {
            const loss = Math.min(p.money, 20);
            p.money -= loss;
            p.hp = p.maxHp;
            p.x = 82; p.y = 88;
            p.mounted = false; p.aboard = false; p.reloading = 0;
            p.hurt = 3;
            p.ammo = this.weaponStats().clip;
            p.reserve = Math.max(p.reserve, 36);
            p.medkits = Math.max(p.medkits, 1);
            this.horse.x = 87; this.horse.y = 89;
            this.shots = [];
            this.dialogue = null;
            this.notify('Sol patched you up. Lost $' + loss + '; all story progress and equipment kept.', 'heal');
        }
    }

    effect(x, y, kind, life, z) {
        if (this.effects.length >= T.maxEffects) this.effects.shift();
        this.effects.push({ x, y, kind, life, maxLife: life, z: Number.isFinite(z) ? z : undefined });
    }

    drop(x, y, kind, amount) {
        if (this.loot.length >= T.maxLoot) this.loot.shift();
        this.loot.push({ id: 'loot-' + (++this.lootId), x, y, kind, amount });
    }

    collectLoot() {
        this.loot = this.loot.filter(item => {
            if (distance(item, this.player) > (this.player.mounted ? 5 : 3.6)) return true;
            if (item.kind === 'money') this.player.money = Math.min(999999, this.player.money + item.amount);
            if (item.kind === 'ammo') this.player.reserve = Math.min(999, this.player.reserve + item.amount);
            if (item.kind === 'medicine') this.player.medkits = Math.min(20, this.player.medkits + item.amount);
            this.effect(item.x, item.y, 'loot', 0.6);
            this.dirty = true;
            return false;
        });
    }

    awardXp(amount) {
        const p = this.player;
        p.xp += amount;
        while (p.level < 30 && p.xp >= p.level * 100) {
            p.xp -= p.level * 100;
            p.level++;
            p.perkPoints++;
            p.maxHp += 8;
            p.hp = Math.min(p.maxHp, p.hp + 38);
            this.notify('LEVEL ' + p.level + ' · +8 health and a perk point. Spend it in your kit.', 'level');
        }
        this.dirty = true;
    }

    advance() {
        const m = MISSIONS[this.mission];
        if (!m) return;
        this.player.money += m.reward;
        this.awardXp(m.xp);
        this.mission++;
        this.dialogue = null;
        this.notify('CHAPTER COMPLETE · +$' + m.reward + ' · ' + (MISSIONS[this.mission] ? MISSIONS[this.mission].title : 'A free frontier'), 'quest');
        this.dirty = true;
    }

    objective() {
        const m = MISSIONS[this.mission];
        if (!m) {
            const active = this.bounties.find(b => b.status === 'active');
            const b = active && BOUNTIES.find(v => v.id === active.id);
            return b ? { title: b.title, text: b.description, x: b.x, y: b.y, progress: 'BOUNTY · $' + b.reward } : { title: 'The open frontier', text: 'Collect bounties from Ada or June. Buy homes, improve your arsenal, and ride free.', x: 62, y: 54, progress: 'STORY COMPLETE' };
        }
        const defeated = m.enemies ? this.defeated.filter(id => id.startsWith('mission-' + this.mission + '-')).length : 0;
        const target = this.mission === 4 ? this.train : m;
        const text = m.enemies && defeated >= m.enemies ? this.mission === 7 ? 'Talk to Silas Vale at the manor steps. Choose his fate.' : this.mission === 4 ? 'Press E aboard the train to open the prison car.' : 'Go to the gold marker and press E.' : m.description;
        return { title: m.title, text, x: target.x, y: target.y, progress: m.enemies ? defeated + ' / ' + m.enemies + ' defenders' : 'Speak with ' + (this.world.npcs.find(n => n.id === m.npc) || { name: 'your allies' }).name };
    }

    interact() {
        if (this.phase !== 'play') return null;
        const p = this.player, m = MISSIONS[this.mission];
        if (p.aboard) {
            if (this.mission === 4 && this.groupCleared('mission-4', m.enemies)) {
                this.flags.prisoners = true;
                this.advance();
                return this.setDialogue('dialogue', 'prisoners', 'The midnight passengers', 'Ada breaks the last lock. “My crew built this railway. Vale used it to cage us. Meet me at Salt Flats, Rowan. We are taking it back.”', [choice('leave-train', 'Jump off with the crew'), choice('close', 'Keep riding')]);
            }
            return this.setDialogue('train', 'train', 'Copperline Express', this.mission === 4 ? 'The prison car is locked. Defeat the guards along the cars, then press E.' : 'Steam, copper, and a horizon that refuses to end. The express carries you across the valley.', [choice('leave-train', 'Step off the train'), choice('close', 'Keep riding')]);
        }
        if (m && m.enemies && this.mission !== 4 && this.mission !== 7 && distance(p, m) < T.interactDistance) {
            if (!this.groupCleared('mission-' + this.mission, m.enemies)) { this.notify('Clear the defenders before working here.'); return null; }
            if (this.mission === 1) {
                this.flags.letter = true;
                this.advance();
                return this.setDialogue('dialogue', 'letter', 'A letter never sent', 'Your mother wrote: “The water belongs to the people who drink it. If Vale takes my land, let him never take that truth.” A copper circuit is pressed inside the ledger.', [choice('close', 'Take the ledger to Inez')]);
            }
            if (this.mission === 3) {
                this.flags.water = true;
                this.advance();
                return this.setDialogue('dialogue', 'water', 'The sound of rain', 'The wheel turns. Turquoise water fills the dry irrigation channels. Sol’s message arrives: “You bought every child here another summer. Ada’s crew are on the next prison train.”', [choice('close', 'Ride for the railway')]);
            }
            if (this.mission === 6) {
                this.flags.dynamo = true;
                this.effect(260, 180, 'electric', 2);
                this.advance();
                return this.setDialogue('dialogue', 'dynamo', 'A valley takes a breath', 'The dynamo opens like a copper flower. Its stolen blue fire returns to the earth. Far to the north, the lamps at Vale’s manor go dark. Inez smiles: “Now he is only a man.”', [choice('close', 'Ride to Crownridge')]);
            }
        }
        const npc = this.world.npcs.filter(n => distance(n, p) < T.interactDistance).sort((a, b) => distance(a, p) - distance(b, p))[0];
        if (npc) return this.talk(npc.id);
        const property = PROPERTIES.find(v => {
            const b = this.world.buildings.find(building => building.id === v.building);
            return distance(p, { x: b.x, y: b.y + b.d / 2 + 2 }) < 8;
        });
        if (property) return this.property(property.id);
        const camp = this.world.props.find(v => v.kind === 'camp' && distance(v, p) < 8);
        if (camp) return this.setDialogue('camp', camp.id, 'A fire under the stars', 'A tin mug, a warm fire, and Comet cropping the grass. Rest restores your health, a medicine tin, and enough ammunition to get back on the road.', [choice('rest', 'Rest and resupply'), choice('close', 'Back to the trail')]);
        if (this.trainNear()) { this.boardTrain(); return null; }
        this.notify('Ride closer to a person, property porch, campfire, or train. Follow the gold story marker.');
        return null;
    }

    setDialogue(kind, id, title, text, options, items) {
        this.dialogue = { kind, id, title, text, options: options || [choice('close', 'Back to the trail')] };
        if (items) this.dialogue.items = items;
        return this.dialogue;
    }

    closeDialogue() { this.dialogue = null; }

    talk(id) {
        if (this.phase !== 'play') return null;
        const npc = this.world.npcs.find(n => n.id === id);
        if (!npc || distance(npc, this.player) > T.interactDistance + 1) return null;
        if (id === 'june' && this.mission === 0) return this.setDialogue('dialogue', id, npc.name, '“Rowan Wren. Same eyes as your mother. Vale calls her death an accident. I call it an unpaid debt. His riders stole the water deeds. Get that strongbox from Red Mesa and we can prove it.”', [choice('accept', 'I will find the deeds.'), choice('mother', 'Tell me about my mother.'), choice('close', 'I need a moment.')]);
        if (id === 'inez' && this.mission === 2) return this.setDialogue('dialogue', id, npc.name, '“That circuit is mine. Vale took my work and built a pump that drinks the valley dry. Let me put a stormcoil on your gun. Then save the reservoir. I will help you break my terrible invention.”', [choice('accept', 'Fit the stormcoil. We fix this together.'), choice('blame', 'You built his machine?'), choice('shop', 'Show me your workshop.')]);
        if (id === 'ada' && this.mission === 5) return this.setDialogue('dialogue', id, npc.name, '“Those people in the train? My family. Not by blood; by every mile we laid together. The foundry feeds Vale’s armor. Vent its dynamo and the whole machine comes apart. I drew you a route.”', [choice('accept', 'We take the foundry.'), choice('future', 'What happens to the railway?'), choice('close', 'I will prepare first.')]);
        if (id === 'vale') {
            if (this.mission === 7 && this.groupCleared('mission-7', MISSIONS[7].enemies)) return this.setDialogue('dialogue', id, 'Silas Vale · a broken crown', '“I brought order. Roads. Jobs. Your mother would have left them with nothing but dirt.” He drops his ruined gun rig. “Name your price, Wren.” Behind him, the stolen deeds flutter in the wind.', [choice('mercy', 'Stand trial. The town deserves the truth.'), choice('justice', 'You leave this valley. Forever.')]);
            return this.setDialogue('dialogue', id, npc.name, this.flags.finished ? 'The estate is quiet. The name on the gate no longer owns the land beyond it.' : '“Everything you see is an investment, Wren. Even the people. Do not make yourself a bad one.”', [choice('close', 'Walk away.')]);
        }
        if (id === 'june' && this.mission === 8) return this.setDialogue('dialogue', id, 'June Bell · a new charter', '“We have the deeds. Vale is finished. Your mother wanted the water held in common. Ada wants the rails run by the workers. But you carried this on your back, Rowan. What are we building?”', [choice('community', 'A common charter. The valley belongs to everyone.'), choice('independent', 'Free homesteads. Give every family its own deed.')]);
        const lines = {
            june: this.flags.water ? '“Water in the channels. Hope in the street. Your mother would pretend she was not crying. I can offer bounties if you need money.”' : '“A badge is a promise, not a crown. The Last Light is still open; the outlaws would prefer it wasn’t.”',
            inez: '“A gun should tell its story before it fires. Copper barrel, exposed stormcoil, clockwork drum. You will see every piece I fit. Bring me something interesting.”',
            ezra: '“I sell second chances: clean cartridges, honest leather, and coats dramatic enough to deserve their own weather.”',
            sol: this.flags.water ? '“The children are drinking clean water again. That matters more than every statue Vale planned to build.”' : '“People are not good or bad investments, Rowan. They are people. Sit down. Let me see that scratch.”',
            ada: this.flags.prisoners ? '“Rail belongs to the hands that laid it. We keep the express moving. I also have names of people making the roads dangerous.”' : '“I am waiting for my crew’s train. It should have been here yesterday. Something is terribly wrong.”'
        };
        const options = [];
        if (['inez', 'ezra', 'sol'].includes(id)) options.push(choice('shop', id === 'sol' ? 'Medicine and free resupply' : 'Browse the goods'));
        if (['june', 'ada'].includes(id)) options.push(choice('bounties', 'Show me the bounty board'));
        if (id === 'june') options.push(choice('property-saloon', 'Talk about buying The Last Light'));
        options.push(choice('story', 'Tell me your story.'), choice('close', 'See you down the road.'));
        return this.setDialogue('dialogue', id, npc.name, lines[id], options);
    }

    choose(id) {
        if (this.phase !== 'play' || !this.dialogue) return null;
        const d = this.dialogue;
        if (!d.options.some(o => o.id === id)) return d;
        if (id === 'close') { this.dialogue = null; return null; }
        const speaker = this.world.npcs.find(n => n.id === d.id);
        const camp = d.kind === 'camp' && this.world.props.find(prop => prop.id === d.id);
        const property = d.kind === 'property' && this.world.buildings.find(building => building.id === d.id);
        const onPorch = property && distance(this.player, { x: property.x, y: property.y + property.d / 2 + 2 }) <= 11;
        const atSaloonDesk = d.id === 'saloon' && distance(this.player, this.world.npcs.find(n => n.id === 'june')) <= 11;
        if ((speaker && distance(speaker, this.player) > T.interactDistance + 1) || (camp && distance(camp, this.player) > 10) || (property && !onPorch && !atSaloonDesk)) {
            this.dialogue = null;
            this.notify('Return to the person or property to continue.');
            return null;
        }
        if (id === 'leave-train') { this.leaveTrain(); this.dialogue = null; return null; }
        if (id === 'accept') {
            if (d.id === 'june' && this.mission === 0) this.advance();
            else if (d.id === 'inez' && this.mission === 2) {
                if (!this.player.mods.includes('brasscoil')) this.player.mods.push('brasscoil');
                this.advance();
                this.notify('STORMCOIL INSTALLED · Turquoise coils now arc from your weapon. Save the reservoir!', 'electric');
            } else if (d.id === 'ada' && this.mission === 5) this.advance();
            return this.dialogue;
        }
        if (id === 'mother') return this.setDialogue('dialogue', 'june', 'June remembers Elin Wren', '“She could mend a fence and win an argument at the same time. Bought the first public well with poker money. Last thing she told me was: keep a light for Rowan. I did.”', [choice('accept', 'Then let us finish what she started.'), choice('close', 'Thank you, June.')]);
        if (id === 'blame') return this.setDialogue('dialogue', 'inez', 'The price of an invention', '“I thought power would make everyone free. Vale paid for it, patented it, and put a fence around the river. I cannot unbuild the past. I can put the tools in better hands.”', [choice('accept', 'Your hands can still make something good.'), choice('close', 'I will come back.')]);
        if (id === 'future') return this.setDialogue('dialogue', 'ada', 'Every mile belongs to someone', '“No more passenger cars with locks outside. Fair wages. Cheap tickets. Rails that join places instead of owning them. Imagine that, Rowan: a train that simply takes people home.”', [choice('accept', 'Let us make it happen.'), choice('close', 'I need to prepare.')]);
        if (id === 'mercy' || id === 'justice') {
            if (d.id !== 'vale' || this.mission !== 7 || !this.groupCleared('mission-7', MISSIONS[7].enemies)) return d;
            this.flags[id] = true;
            this.advance();
            return this.setDialogue('dialogue', 'verdict', id === 'mercy' ? 'A trial in daylight' : 'The long road out', id === 'mercy' ? 'June takes Vale’s gun. Ada takes his ledger. This time the testimony will be public, the names recorded, and the people he harmed will be heard.' : 'Vale signs the deeds over before June and Ada. His fortune pays the families he displaced. At sunset, a man with one suitcase boards a train that he no longer owns.', [choice('close', 'Return to Copperline')]);
        }
        if (id === 'community' || id === 'independent') {
            if (d.id !== 'june' || this.mission !== 8) return d;
            this.flags[id] = true;
            this.flags.finished = true;
            this.advance();
            this.phase = 'ending';
            this.dialogue = null;
            this.dirty = true;
            return null;
        }
        if (id === 'shop') return this.openShop(d.id);
        if (id === 'bounties') return this.bountyBoard(d.id);
        if (id.startsWith('bounty-')) {
            const bounty = this.bounties.find(b => b.id === id.slice(7));
            if (bounty && bounty.status !== 'active') {
                if (bounty.status === 'complete') {
                    const previousGroup = 'bounty-' + bounty.id + '-' + bounty.rounds + '-';
                    this.defeated = this.defeated.filter(enemyId => !enemyId.startsWith(previousGroup));
                    bounty.rounds++;
                }
                bounty.status = 'active';
                this.dirty = true;
                this.notify('Bounty accepted. Its location is marked on your map.', 'quest');
            }
            return this.bountyBoard(d.id);
        }
        if (id === 'property-saloon') return this.property('saloon');
        if (id === 'rest' || id === 'resupply') {
            const p = this.player;
            p.hp = p.maxHp; p.stamina = 100; p.focus = 100;
            p.reserve = Math.max(p.reserve, d.kind === 'camp' ? 36 : 72);
            p.medkits = Math.max(p.medkits, 2);
            p.ammo = this.weaponStats().clip;
            p.reloading = 0;
            this.magazines[p.weapon] = p.ammo;
            this.dirty = true;
            this.dialogue = null;
            this.notify('Rested and supplied. Health, medicine, and ammunition ready.', 'heal');
            return null;
        }
        if (id === 'collect') {
            if (!this.player.properties.includes(d.id)) return d;
            const amount = this.propertyIncome[d.id] || 0;
            this.player.money += amount;
            this.propertyIncome[d.id] = 0;
            this.dirty = true;
            this.notify('Collected $' + amount + ' in property income.', 'coin');
            return this.property(d.id);
        }
        if (id === 'story') {
            const stories = {
                june: '“I wore Vale’s badge once. Told myself I could soften his orders. Your mother taught me the difference between doing a little good and allowing a great wrong. I work for Copperline now.”',
                inez: '“My father made church bells. Said every piece of metal had a note inside it. I look for that note in engines. In this workshop, even a weapon is a little song about survival.”',
                ezra: '“I came west with six shirts and an astonishing number of bad ideas. Sold the shirts. Kept the ideas. The best one was staying when everyone sensible left.”',
                sol: '“My husband planted the orchard behind the clinic. He said you could judge a town by who gets its shade. I keep the gate open. I think he would like that.”',
                ada: '“I learned arithmetic counting ties. Learned politics counting the names missing from payroll. Built a family one rail at a time. Nobody gets to lock that family in a boxcar.”'
            };
            return this.setDialogue('dialogue', d.id, d.title, stories[d.id] || 'There will be new stories here, now.', [choice('back', 'Back'), choice('close', 'Until next time.')]);
        }
        if (id === 'back') return this.talk(d.id);
        return this.dialogue;
    }

    openShop(id) {
        if (this.phase !== 'play') return null;
        const npc = this.world.npcs.find(n => n.id === id);
        if (!npc || distance(npc, this.player) > T.interactDistance + 1) return null;
        const items = id === 'inez' ? WEAPONS.filter(w => w.price > 0).map(w => w.id).concat(UPGRADES.map(u => u.id)) : id === 'ezra' ? OUTFITS.filter(o => o.price > 0).map(o => o.id).concat(['ammo', 'medicine']) : ['ammo', 'medicine'];
        return this.setDialogue('shop', id, id === 'inez' ? 'Rojas & Spark · guns and visible upgrades' : id === 'ezra' ? 'Ezra’s · dress for the horizon' : 'Dr. Sol · care without conditions', 'Every purchase belongs to you. Weapons, modifications, clothes, and medicine are carried on Rowan or displayed at your properties. Basic resupply is always free.', [choice('resupply', 'Free rest and resupply'), choice('close', 'Back to the trail')], items);
    }

    property(id) {
        if (this.phase !== 'play') return null;
        const property = PROPERTIES.find(v => v.id === id);
        if (!property) return null;
        const owned = this.player.properties.includes(id);
        const options = owned ? [choice('collect', 'Collect $' + (this.propertyIncome[id] || 0) + ' rent'), choice('rest', 'Rest at home'), choice('close', 'Back to the trail')] : [choice('close', 'Think it over')];
        return this.setDialogue('property', id, property.name, owned ? 'Your deed is framed by the door. Your weapons fill the rack, your clothes hang beside it, and your story is written in the objects on the porch. Earns $' + property.income + ' every 95 seconds.' : property.description + ' Deed: $' + property.price + '. Income: $' + property.income + ' every 95 seconds.', options, owned ? [] : [id]);
    }

    bountyBoard(vendor) {
        if (this.phase !== 'play') return null;
        const options = this.bounties.filter(b => b.status !== 'active').map(b => {
            const info = BOUNTIES.find(v => v.id === b.id);
            return choice('bounty-' + b.id, (b.status === 'complete' ? 'New gang: ' : '') + info.title + ' · $' + info.reward);
        });
        options.push(choice('close', 'Back to the trail'));
        return this.setDialogue('dialogue', vendor, 'Wanted · the Copperline bounty board', 'Bring the roads back to the people. Active bounties appear on your map. Payment arrives as soon as the whole gang is defeated; new gangs can be hunted afterward.', options);
    }

    checkBounties() {
        this.bounties.filter(b => b.status === 'active').forEach(b => {
            const info = BOUNTIES.find(v => v.id === b.id);
            if (this.groupCleared('bounty-' + b.id + '-' + b.rounds, info.count)) {
                b.status = 'complete';
                this.player.money += info.reward;
                this.awardXp(info.xp);
                this.notify('BOUNTY PAID · ' + info.name + ' · $' + info.reward, 'quest');
                this.dirty = true;
            }
        });
    }

    buy(id) {
        if (this.phase !== 'play' || typeof id !== 'string') return false;
        const p = this.player;
        if (id.startsWith('perk_')) {
            const perk = PERKS.find(v => v.id === id.slice(5));
            if (!perk || p.perks.includes(perk.id) || p.perkPoints < 1) return false;
            p.perks.push(perk.id);
            p.perkPoints--;
            if (perk.id === 'vigor') { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); }
            this.notify(perk.name + ' learned.', 'level');
            this.dirty = true;
            return true;
        }
        const d = this.dialogue;
        if (!d || !d.items || !d.items.includes(id)) return false;
        const property = PROPERTIES.find(v => v.id === id);
        if (property) {
            const b = this.world.buildings.find(v => v.id === property.building);
            const june = this.world.npcs.find(v => v.id === 'june');
            if (distance(p, { x: b.x, y: b.y + b.d / 2 + 2 }) > 11 && !(id === 'saloon' && distance(p, june) < 11)) return false;
        } else {
            const npc = this.world.npcs.find(n => n.id === d.id);
            if (!npc || distance(npc, p) > T.interactDistance + 1) return false;
        }
        const item = WEAPONS.concat(UPGRADES, OUTFITS, PROPERTIES).find(v => v.id === id) || (id === 'ammo' ? { price: 8, name: '48 cartridges' } : id === 'medicine' ? { price: 10, name: 'Medicine tin' } : null);
        if (!item) return false;
        const owned = p.weapons.includes(id) || p.mods.includes(id) || p.outfits.includes(id) || p.properties.includes(id);
        if (owned) { this.notify('Already yours. Equip it from your kit.'); return false; }
        if (p.money < item.price) { this.notify('You need $' + (item.price - p.money) + ' more. Story jobs and bounties pay well.'); return false; }
        if (id === 'medicine' && p.medkits >= 20) { this.notify('Your medicine pouch is full.'); return false; }
        if (id === 'ammo' && p.reserve >= 999) { this.notify('Your cartridge satchel is full.'); return false; }
        p.money -= item.price;
        if (WEAPONS.some(v => v.id === id)) {
            p.weapons.push(id);
            this.magazines[id] = WEAPONS.find(v => v.id === id).clip;
            this.equip(id);
        } else if (UPGRADES.some(v => v.id === id)) p.mods.push(id);
        else if (OUTFITS.some(v => v.id === id)) { p.outfits.push(id); p.outfit = id; }
        else if (property) { p.properties.push(id); this.propertyIncome[id] = 0; this.property(id); }
        else if (id === 'ammo') p.reserve = Math.min(999, p.reserve + 48);
        else if (id === 'medicine') p.medkits = Math.min(20, p.medkits + 1);
        this.notify(item.name + ' is yours.', 'coin');
        this.dirty = true;
        return true;
    }

    equip(id) {
        if (this.phase !== 'play') return false;
        const p = this.player;
        if (p.weapons.includes(id)) {
            this.magazines[p.weapon] = p.ammo;
            p.weapon = id;
            p.ammo = Math.min(this.weaponStats().clip, this.magazines[id] || 0);
            p.reloading = 0;
            this.notify(this.weaponStats().name + ' equipped.', 'reload');
        } else if (p.outfits.includes(id)) { p.outfit = id; this.notify(OUTFITS.find(o => o.id === id).name + ' equipped.'); }
        else return false;
        this.dirty = true;
        return true;
    }

    serialize() {
        this.magazines[this.player.weapon] = this.player.ammo;
        return {
            version: 1, player: Object.assign({}, this.player, {
                weapons: this.player.weapons.slice(), mods: this.player.mods.slice(), outfits: this.player.outfits.slice(),
                properties: this.player.properties.slice(), perks: this.player.perks.slice(),
                mounted: this.player.mounted, aboard: this.player.aboard, moving: false,
                hurt: 0, dodge: 0, reloading: 0, focusTime: 0, fireCooldown: 0
            }),
            time: this.time, mission: this.mission, flags: Object.assign({}, this.flags), seed: this.seed,
            horse: Object.assign({}, this.horse), train: Object.assign({}, this.train),
            defeated: this.defeated.slice(-1000), bounties: this.bounties.map(b => Object.assign({}, b)),
            enemies: this.enemies.map(e => Object.assign({}, e, { windup: 0, cooldown: 1.5 })),
            loot: this.loot.map(l => Object.assign({}, l)), magazines: Object.assign({}, this.magazines),
            propertyIncome: Object.assign({}, this.propertyIncome), incomeClock: this.incomeClock, aboardOffset: this.aboardOffset
        };
    }

    load(data) {
        if (!data || typeof data !== 'object' || data.version !== 1 || !data.player || typeof data.player !== 'object') return false;
        const src = data.player, p = this.player;
        p.weapons = cleanIds(src.weapons, WEAPONS.map(v => v.id));
        if (!p.weapons.includes('revolver')) p.weapons.unshift('revolver');
        p.mods = cleanIds(src.mods, UPGRADES.map(v => v.id));
        p.outfits = cleanIds(src.outfits, OUTFITS.map(v => v.id));
        if (!p.outfits.includes('trailcoat')) p.outfits.unshift('trailcoat');
        p.properties = cleanIds(src.properties, PROPERTIES.map(v => v.id));
        p.perks = cleanIds(src.perks, PERKS.map(v => v.id));
        p.weapon = p.weapons.includes(src.weapon) ? src.weapon : 'revolver';
        p.outfit = p.outfits.includes(src.outfit) ? src.outfit : 'trailcoat';
        p.level = Math.floor(finite(src.level, 1, 1, 30));
        p.maxHp = T.playerHp + (p.level - 1) * 8 + (p.perks.includes('vigor') ? 25 : 0);
        p.hp = finite(src.hp, p.maxHp, 1, p.maxHp);
        p.x = finite(src.x, 62, 4, T.width - 4);
        p.y = finite(src.y, 67, 4, T.height - 4);
        if (this.solid(p.x, p.y, 1)) { p.x = 62; p.y = 67; }
        p.angle = finite(src.angle, 0, -Math.PI * 2, Math.PI * 2);
        p.stamina = finite(src.stamina, 100, 0, 100);
        p.focus = finite(src.focus, 100, 0, 100);
        p.money = Math.floor(finite(src.money, 65, 0, 999999));
        p.xp = Math.floor(finite(src.xp, 0, 0, p.level * 100 - 1));
        p.perkPoints = Math.floor(finite(src.perkPoints, 0, 0, 30));
        p.ammo = Math.floor(finite(src.ammo, this.weaponStats().clip, 0, this.weaponStats().clip));
        p.reserve = Math.floor(finite(src.reserve, 60, 0, 999));
        p.medkits = Math.floor(finite(src.medkits, 2, 0, 20));
        this.time = finite(data.time, 0, 0, 10000000);
        this.mission = Math.floor(finite(data.mission, 0, 0, MISSIONS.length));
        const flags = data.flags && typeof data.flags === 'object' ? data.flags : {};
        Object.keys(this.flags).forEach(key => { this.flags[key] = flags[key] === true; });
        // Reconstruct milestones so interrupted or older checkpoints remain coherent.
        this.flags.letter = this.mission > 1;
        this.flags.water = this.mission > 3;
        this.flags.prisoners = this.mission > 4;
        this.flags.dynamo = this.mission > 6;
        this.flags.finished = this.mission >= MISSIONS.length;
        if (this.mission > 2 && !p.mods.includes('brasscoil')) p.mods.push('brasscoil');
        this.seed = Math.floor(finite(data.seed, this.seed, 0, 4294967295));
        if (data.horse && typeof data.horse === 'object') {
            this.horse.x = finite(data.horse.x, p.x + 3, 4, T.width - 4);
            this.horse.y = finite(data.horse.y, p.y + 3, 4, T.height - 4);
            this.horse.angle = finite(data.horse.angle, 0, -7, 7);
        }
        if (data.train && typeof data.train === 'object') {
            this.train.x = finite(data.train.x, 141, T.trainLeft, T.trainRight);
            this.train.direction = data.train.direction === -1 ? -1 : 1;
            this.train.x = clamp(this.train.x, this.train.direction > 0 ? T.trainLeft + T.trainSpan : T.trainLeft, this.train.direction < 0 ? T.trainRight - T.trainSpan : T.trainRight);
            this.train.angle = this.train.direction < 0 ? Math.PI : 0;
        }
        p.aboard = src.aboard === true;
        p.mounted = src.mounted === true && !p.aboard;
        if (p.aboard) {
            this.aboardOffset = finite(data.aboardOffset, clamp((p.x - this.train.x) * this.train.direction, T.trainRear, 3), T.trainRear, 3);
            p.x = this.train.x + this.aboardOffset * this.train.direction;
            p.y = this.train.y - 1;
        }
        if (p.mounted) { this.horse.x = p.x; this.horse.y = p.y; this.horse.angle = p.angle; }
        this.defeated = Array.isArray(data.defeated) ? Array.from(new Set(data.defeated.filter(v => typeof v === 'string' && /^(mission-[1-7]|bounty-(rattler|opal|coyote)-\d{1,6})-\d$/.test(v)).slice(-1000))) : [];
        if (Array.isArray(data.bounties)) this.bounties.forEach(b => {
            const saved = data.bounties.find(v => v && v.id === b.id);
            if (saved) { b.status = ['available', 'active', 'complete'].includes(saved.status) ? saved.status : 'available'; b.rounds = Math.floor(finite(saved.rounds, 0, 0, 999999)); }
        });
        if (data.magazines && typeof data.magazines === 'object') p.weapons.forEach(id => {
            const weapon = WEAPONS.find(w => w.id === id);
            this.magazines[id] = Math.floor(finite(data.magazines[id], 0, 0, weapon.clip + (p.mods.includes('drummag') ? 4 : 0)));
        });
        this.magazines[p.weapon] = p.ammo;
        p.properties.forEach(id => { this.propertyIncome[id] = Math.floor(finite(data.propertyIncome && data.propertyIncome[id], 0, 0, 9999)); });
        this.incomeClock = finite(data.incomeClock, 0, 0, T.incomeInterval);
        if (Array.isArray(data.enemies)) data.enemies.slice(0, T.maxEnemies).forEach(e => {
            if (!e || typeof e.id !== 'string' || this.defeated.includes(e.id) || !/^(mission-[1-7]|bounty-(rattler|opal|coyote)-\d{1,6})-\d$/.test(e.id) || this.enemies.some(other => other.id === e.id)) return;
            const group = e.id.slice(0, e.id.lastIndexOf('-'));
            const activeGroup = group === 'mission-' + this.mission || this.bounties.some(b => b.status === 'active' && group === 'bounty-' + b.id + '-' + b.rounds);
            if (!activeGroup) return;
            const kind = ['raider', 'gunner', 'brute', 'boss'].includes(e.kind) ? e.kind : 'raider';
            const maxHp = kind === 'boss' ? 320 : kind === 'brute' ? 96 : kind === 'gunner' ? 70 : 55;
            const restored = { id: e.id, group: e.id.slice(0, e.id.lastIndexOf('-')), kind, x: finite(e.x, 120, 3, T.width - 3), y: finite(e.y, 65, 3, T.height - 3), angle: 0,
                homeX: finite(e.homeX, 120, 3, T.width - 3), homeY: finite(e.homeY, 65, 3, T.height - 3), hp: finite(e.hp, maxHp, 1, maxHp), maxHp, windup: 0, cooldown: 1.5, targetAngle: 0, alerted: e.alerted === true };
            if (restored.group === 'mission-4') restored.trainOffset = finite(e.trainOffset, -18, T.trainRear, 3);
            this.enemies.push(restored);
        });
        if (Array.isArray(data.loot)) data.loot.slice(0, T.maxLoot).forEach(l => {
            if (!l || !['money', 'ammo', 'medicine'].includes(l.kind)) return;
            this.drop(finite(l.x, 62, 3, T.width - 3), finite(l.y, 67, 3, T.height - 3), l.kind, Math.floor(finite(l.amount, 1, 1, l.kind === 'medicine' ? 3 : 100)));
        });
        this.hasSave = true;
        this.messageUntil = this.time + 8;
        return true;
    }
}

module.exports = { Frontier, clamp, distance };
