const { ROLES, ROUTES, UPGRADES, KITS, clamp, distance, random } = require('./settings');
const finite = (v, fallback, lo, hi) => Number.isFinite(v) ? clamp(v, lo, hi) : fallback;
const freshSave = data => ({ schema: 1, renown: Math.floor(finite(data?.renown, 0, 0, 100000)),
    voyages: Math.floor(finite(data?.voyages, 0, 0, 100000)), victories: Math.floor(finite(data?.victories, 0, 0, 100000)),
    rescued: Math.floor(finite(data?.rescued, 0, 0, 100000)), best: Math.floor(finite(data?.best, 0, 0, 100000)),
    name: typeof data?.name === 'string' ? data.name.replace(/[\x00-\x1f]/g, '').slice(0, 22) : 'The Sunwake',
    kit: KITS.some(k => k.id === data?.kit) ? data.kit : 'dawn' });

class Voyage {
    constructor(seed = Date.now(), saved) {
        this.seed = seed >>> 0; this.rng = random(this.seed); this.save = freshSave(saved);
        if (KITS.find(k => k.id === this.save.kit).requirement > this.save.renown) this.save.kit = 'dawn';
        this.players = new Map(); this.phase = 'harbor'; this.time = 0; this.events = []; this.news = [];
        this.ship = this.makeShip(); this.leg = 0; this.route = ROUTES[0]; this.islands = []; this.enemies = [];
        this.shots = []; this.loot = []; this.effects = []; this.warnings = []; this.votes = new Map(); this.serial = 0;
        this.stats = { kills: 0, rescued: 0, beacons: 0, salvage: 0, damage: 0, leviathans: 0 }; this.mods = { hull: 0, guns: 0, reactor: 0 };
    }
    makeShip() {
        const kit = KITS.find(k => k.id === this.save.kit) || KITS[0];
        return { x: 0, y: 0, vx: 0, vy: 0, angle: 0, hull: kit.hull, maxHull: kit.hull,
            shield: kit.shield, maxShield: kit.shield, energy: kit.energy, maxEnergy: kit.energy, speed: kit.speed,
            target: { x: 40, y: 0 }, boost: 0, anchor: false, hurt: 0, focus: 0, heat: 0, charge: 0, scrap: 12 };
    }
    emit(type, x = this.ship.x, y = this.ship.y) {
        this.events.push(type); if (this.events.length > 12) this.events.shift();
        if (this.effects.length < 18) this.effects.push({ type, x, y, life: .7, total: .7, id: ++this.serial });
    }
    announce(text) { this.news.unshift({ text, until: this.time + 6 }); this.news.length = Math.min(3, this.news.length); }
    addPlayer(id, name) {
        if (this.players.has(id) || this.players.size >= 6) return false;
        const available = ROLES.filter(r => r.id !== 'helm' || !this.occupied('helm'));
        const counts = available.map(r => [...this.players.values()].filter(p => p.role === r.id).length);
        const role = available[counts.indexOf(Math.min(...counts))].id;
        this.players.set(id, { id, name: String(name || `Crew ${id}`).slice(0, 16), role, keys: new Set(), held: false,
            aim: null, contribution: 0, joined: this.time, pingAt: -10 });
        this.announce(`${name || 'A crewmate'} came aboard`); return true;
    }
    removePlayer(id) { this.players.delete(id); this.votes.delete(id); }
    role(id, role) {
        const p = this.players.get(id); if (!p || !ROLES.some(r => r.id === role)) return false;
        if (role === 'helm' && [...this.players.values()].some(other => other.id !== id && other.role === role)) return false;
        p.role = role; p.keys.clear(); p.held = false; return true;
    }
    occupied(role) { return [...this.players.values()].some(p => p.role === role); }
    begin(id) {
        if (!this.players.has(id) || !['harbor', 'won', 'lost'].includes(this.phase)) return false;
        this.rng = random(++this.seed); this.time = 0; this.ship = this.makeShip(); this.leg = 0;
        this.mods = { hull: 0, guns: 0, reactor: 0 }; this.stats = { kills: 0, rescued: 0, beacons: 0, salvage: 0, damage: 0, leviathans: 0 };
        this.whale = null;
        this.events = []; this.news = []; this.shots = []; this.effects = []; this.warnings = [];
        this.cooldowns = { fire: 0, barrage: 0, patch: 0, tractor: 0, scan: 0, boost: 0 }; this.boss = null;
        for (const p of this.players.values()) { p.keys.clear(); p.held = false; p.aim = null; p.contribution = 0; }
        this.depart('refuge'); this.announce('Three dark beacons. One seed of daylight. Bring it home.'); return true;
    }
    depart(routeId) {
        this.route = ROUTES.find(r => r.id === routeId) || ROUTES[0]; this.phase = this.leg === 3 ? 'finale' : 'sail';
        this.ship.anchor = false; this.ship.charge = 0; this.ship.vx = this.ship.vy = 0;
        this.legStart = this.ship.x; this.goal = { x: this.ship.x + (this.leg === 3 ? 105 : 300), y: this.leg === 3 ? 0 : (this.rng() - .5) * 30, charge: 0 };
        this.ship.target = { x: this.ship.x + 30, y: 0 };
        this.islands = []; this.enemies = []; this.loot = []; this.shots = []; this.warnings = []; this.votes.clear();
        this.legTime = 0; this.spawnAt = 15; this.stormAt = 5;
        for (let i = 0; i < 22; i++) {
            const x = this.legStart - 25 + i * 16 + this.rng() * 6;
            const y = (this.rng() > .5 ? 1 : -1) * (19 + this.rng() * 45);
            this.islands.push({ x, y, r: 5 + this.rng() * 9, depth: 9 + this.rng() * 14, seed: this.rng(), trees: i % 3 === 0 });
        }
        if (this.leg < 3) {
            for (let i = 0; i < 8; i++) this.loot.push({ id: ++this.serial, x: this.legStart + 25 + i * 34,
                y: (this.rng() - .5) * 22, kind: i % (this.route.id === 'refuge' ? 2 : 3) === 0 ? 'survivor' : 'scrap', active: true });
            this.spawnEnemy('warden', this.goal.x - 14, this.goal.y + 6);
            this.spawnEnemy('raider', this.legStart + 75, -14);
            if (this.leg > 0 || this.route.id === 'ruins') this.spawnEnemy('raider', this.legStart + 135, 12);
            if (this.leg === 1) {
                this.whale = { x: this.legStart + 164, y: -20, free: false, song: 0 };
                this.spawnEnemy('chain', this.whale.x - 10, this.whale.y - 9);
                this.spawnEnemy('chain', this.whale.x + 10, this.whale.y + 9);
            }
            this.announce(`${this.route.name}: light the ${this.leg + 1}${['st', 'nd', 'rd'][this.leg]} beacon`);
        } else {
            this.boss = { x: this.goal.x, y: 0, hp: 380 + this.players.size * 25, maxHp: 380 + this.players.size * 25,
                exposed: 0, volley: 3.5, phase: 0, sweep: 8, angle: 0 };
            this.announce('THE ECLIPSE ENGINE. Break its three hearts. Free the dawn.'); this.emit('boss');
        }
        this.emit('depart');
    }
    spawnEnemy(kind, x, y) {
        if (this.enemies.filter(e => e.hp > 0).length >= 6) return;
        const hp = (kind === 'warden' ? 95 : kind === 'chain' ? 48 : 28) * (1 + Math.max(0, this.players.size - 1) * .09);
        this.enemies.push({ id: ++this.serial, kind, x, y, hp, maxHp: hp, fire: 1.6 + this.rng(), exposed: 0, angle: 0 });
    }
    aim(id, point, held = true) {
        const p = this.players.get(id); if (!p || !['sail', 'finale'].includes(this.phase) || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
        p.aim = { x: clamp(point.x, this.legStart - 25, this.goal.x + 25), y: clamp(point.y, -60, 60) }; p.held = held;
        if (p.role === 'helm') { this.ship.target = { ...p.aim }; this.ship.anchor = false; }
        if (p.role === 'scout' && this.time - p.pingAt > 1) { p.pingAt = this.time; this.ping = { ...p.aim, life: 4, name: p.name }; this.emit('ping', point.x, point.y); }
    }
    action(id, special = false) {
        const p = this.players.get(id); if (!p || !['sail', 'finale'].includes(this.phase)) return false;
        const s = this.ship;
        if (p.role === 'helm') {
            if (special) { s.anchor = !s.anchor; return true; }
            if (!this.spend('boost', 24, 5)) return false;
            s.boost = 2.2; s.anchor = false; p.contribution++; this.emit('boost'); return true;
        }
        if (p.role === 'gunner') return special ? this.barrage(p) : this.fire(p.aim, p);
        if (p.role === 'engineer') {
            if (special) { s.focus = (s.focus + 1) % 4; this.emit('switch'); return true; }
            return this.patch(p);
        }
        return special ? this.scan(p) : this.tractor(p);
    }
    spend(name, energy, seconds) {
        if ((this.cooldowns[name] || 0) > 0 || this.ship.energy < energy) return false;
        this.ship.energy -= energy; this.cooldowns[name] = seconds; return true;
    }
    nearestTarget() {
        return [...this.enemies.filter(e => e.hp > 0), ...(this.boss?.hp > 0 ? [this.boss] : [])]
            .filter(e => distance(e, this.ship) < 90).sort((a, b) => distance(a, this.ship) - distance(b, this.ship))[0];
    }
    fire(aim, player) {
        const target = aim || this.nearestTarget();
        const cooldown = (player ? .42 : .8) * (this.ship.focus === 2 ? .68 : 1) * (this.ship.heat > 85 ? 1.8 : 1);
        if (!target || !this.spend('fire', 2, cooldown)) return false;
        const angle = Math.atan2(target.y - this.ship.y, target.x - this.ship.x);
        this.projectile(this.ship.x, this.ship.y, angle, false, (player ? 15 : 10) * (1 + this.mods.guns * .3), 74);
        this.ship.heat = Math.min(110, this.ship.heat + 2.6);
        if (player) player.contribution += .1; this.emit('shot'); return true;
    }
    barrage(player) {
        const target = player.aim || this.nearestTarget(); if (!target || !this.spend('barrage', 32, 9)) return false;
        const a = Math.atan2(target.y - this.ship.y, target.x - this.ship.x);
        for (let i = -2; i <= 2; i++) this.projectile(this.ship.x, this.ship.y, a + i * .10, false, 24 * (1 + this.mods.guns * .3), 68);
        this.ship.heat = Math.min(110, this.ship.heat + 18);
        player.contribution += 2; this.emit('barrage'); return true;
    }
    patch(player) {
        if ((this.ship.hull >= this.ship.maxHull && this.ship.heat < 20) || !this.spend('patch', 16, player ? 3 : 6)) return false;
        const bonus = this.ship.scrap >= 2 ? 8 : 0; this.ship.scrap = Math.max(0, this.ship.scrap - 2);
        this.ship.hull = Math.min(this.ship.maxHull, this.ship.hull + (player ? 10 : 5) + bonus);
        this.ship.heat = Math.max(0, this.ship.heat - (player ? 35 : 22));
        if (player) player.contribution += 2; this.emit('repair'); return true;
    }
    scan(player) {
        if (!this.spend('scan', 12, player ? 7 : 12)) return false;
        const seconds = player ? 6 : 4;
        for (const e of this.enemies) if (distance(e, this.ship) < 100) e.exposed = seconds;
        if (this.boss && distance(this.boss, this.ship) < 110) this.boss.exposed = seconds;
        this.scanWave = 1; if (player) player.contribution++; this.emit('scan');
        this.announce(`Scan complete. Armor hearts exposed for ${seconds} seconds.`); return true;
    }
    tractor(player) {
        const target = this.loot.filter(l => l.active && distance(l, this.ship) < (player ? 55 : 25))
            .sort((a, b) => distance(a, player?.aim || this.ship) - distance(b, player?.aim || this.ship))[0];
        if (!target || !this.spend('tractor', 5, .7)) return false;
        target.active = false; this.tether = { x: target.x, y: target.y, life: .5 };
        if (target.kind === 'survivor') { this.stats.rescued++; this.ship.hull = Math.min(this.ship.maxHull, this.ship.hull + 5); this.announce('Survivor aboard. Another light to bring home.'); }
        else { const amount = this.route.id === 'ruins' ? 9 : 5; this.ship.scrap += amount; this.stats.salvage += amount; }
        if (player) player.contribution += 3; this.emit('salvage', target.x, target.y); return true;
    }
    projectile(x, y, angle, hostile, damage, speed = 23) {
        if (this.shots.length >= 42) return;
        this.shots.push({ x, y, previousX: x, previousY: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, hostile, damage, life: hostile ? 4.5 : 1.5 });
    }
    hurt(amount) {
        if (this.ship.boost > 0) amount *= .3;
        const absorbed = Math.min(this.ship.shield, amount); this.ship.shield -= absorbed;
        this.ship.hull = Math.max(0, this.ship.hull - amount + absorbed); this.ship.hurt = .4;
        this.stats.damage += amount; this.emit('hurt');
        if (this.ship.hull <= 0) this.finish(false);
    }
    hit(enemy, amount) {
        const armored = enemy.kind === 'warden' || enemy.kind === 'chain' || enemy === this.boss;
        enemy.hp -= amount * (armored && enemy.exposed <= 0 ? .28 : 1);
        this.emit('hit', enemy.x, enemy.y);
        if (enemy.hp > 0) return;
        enemy.hp = 0; this.emit('burst', enemy.x, enemy.y);
        if (enemy === this.boss) { this.finish(true); return; }
        this.stats.kills++; this.ship.scrap += enemy.kind === 'warden' ? 10 : 3;
        this.loot.push({ id: ++this.serial, x: enemy.x, y: enemy.y, kind: 'scrap', active: true });
        if (enemy.kind === 'warden') this.announce('Warden broken. Bring the ship close to light the beacon.');
        if (enemy.kind === 'chain' && this.whale && !this.whale.free && !this.enemies.some(e => e.kind === 'chain' && e.hp > 0)) {
            this.whale.free = true; this.stats.leviathans++;
            this.ship.maxShield += 20; this.ship.shield = this.ship.maxShield; this.ship.hull = Math.min(this.ship.maxHull, this.ship.hull + 30);
            this.announce('The skywhale is free. It remembers your kindness.'); this.emit('beacon', this.whale.x, this.whale.y);
        }
    }
    vote(id, index) {
        if (!this.players.has(id) || this.phase !== 'chart' || !Number.isInteger(index) || index < 0 || index > 2) return false;
        this.votes.set(id, index);
        if (this.votes.size >= this.players.size) this.resolveChart(); return true;
    }
    resolveChart() {
        if (this.phase !== 'chart') return;
        const tally = [0, 0, 0]; for (const value of this.votes.values()) tally[value]++;
        const choice = tally.indexOf(Math.max(...tally)); this.applyUpgrade(UPGRADES[choice].id);
        this.depart(ROUTES[choice].id);
    }
    applyUpgrade(id) {
        if (!Object.prototype.hasOwnProperty.call(this.mods, id)) return;
        this.mods[id]++;
        if (id === 'hull') { this.ship.maxHull += 25; this.ship.hull = this.ship.maxHull; }
        else this.ship.hull = Math.min(this.ship.maxHull, this.ship.hull + 15);
        this.ship.energy = this.ship.maxEnergy; this.ship.shield = this.ship.maxShield;
        this.announce(`Installed ${UPGRADES.find(u => u.id === id).name}`);
    }
    finish(won) {
        if (!['sail', 'finale'].includes(this.phase)) return;
        this.phase = won ? 'sunrise' : 'lost'; this.sunriseTime = 7; this.shots = []; this.warnings = [];
        const award = this.stats.beacons * 4 + this.stats.rescued * 2 + this.stats.leviathans * 8 + (won ? 15 : 2);
        this.award = award; this.score = this.stats.beacons * 250 + this.stats.rescued * 100 + this.stats.kills * 20 + (won ? 1000 : 0);
        this.save.renown += award; this.save.rescued += this.stats.rescued; this.save.voyages++;
        this.save.victories += won ? 1 : 0; this.save.best = Math.max(this.save.best, this.score);
        this.needsSave = true; this.emit(won ? 'victory' : 'defeat');
    }
    tick(dt = .05) {
        if (!this.players.size || !['sail', 'finale', 'chart', 'sunrise'].includes(this.phase)) return;
        dt = clamp(dt, 0, .1); this.time += dt;
        if (this.phase === 'sunrise') { this.sunriseTime -= dt; if (this.sunriseTime <= 0) this.phase = 'won'; return; }
        if (this.phase === 'chart') { this.chartTime -= dt; if (this.chartTime <= 0) this.resolveChart(); return; }
        this.legTime += dt; const s = this.ship;
        for (const key of Object.keys(this.cooldowns)) this.cooldowns[key] = Math.max(0, this.cooldowns[key] - dt);
        s.heat = Math.max(0, s.heat - dt * 2.5);
        s.energy = Math.min(s.maxEnergy, s.energy + dt * 7 * (1 + this.mods.reactor * .35) * (this.route.id === 'storm' ? 1.4 : 1) * (s.heat > 85 ? .5 : 1));
        s.shield = Math.min(s.maxShield, s.shield + dt * (s.focus === 3 ? 4.8 : 1.1));
        s.boost = Math.max(0, s.boost - dt); s.hurt = Math.max(0, s.hurt - dt);
        this.scanWave = Math.max(0, (this.scanWave || 0) - dt);
        if (this.tether) this.tether.life -= dt;
        if (this.ping) this.ping.life -= dt;
        this.effects.forEach(e => { e.life -= dt; }); this.effects = this.effects.filter(e => e.life > 0);
        this.news = this.news.filter(n => n.until > this.time);
        this.moveShip(dt);
        if (!this.occupied('gunner')) this.fire(null, null);
        for (const p of this.players.values()) if (p.role === 'gunner' && (p.held || p.keys.has(' '))) this.fire(p.aim, p);
        if (!this.occupied('engineer') && (s.hull < s.maxHull - 22 || s.heat > 80) && s.energy > 35) this.patch(null);
        if (!this.occupied('scout')) { this.tractor(null); if (this.nearestTarget() && s.energy > 45) this.scan(null); }
        this.updateEnemies(dt); if (!['sail', 'finale'].includes(this.phase)) return;
        this.updateWhale(dt); if (!['sail', 'finale'].includes(this.phase)) return;
        this.updateShots(dt); if (!['sail', 'finale'].includes(this.phase)) return;
        this.updateWeather(dt); if (!['sail', 'finale'].includes(this.phase)) return;
        for (const l of this.loot) if (l.active && distance(l, s) < 6) {
            // Close pickups are free; the scout's tractor reaches much farther.
            l.active = false;
            if (l.kind === 'survivor') { this.stats.rescued++; this.announce('Survivor aboard!'); }
            else { s.scrap += 4; this.stats.salvage += 4; }
            this.emit('salvage', l.x, l.y);
        }
        this.loot = this.loot.filter(l => l.active && l.x > s.x - 130).slice(-24);
        if (this.phase === 'sail') {
            const locked = this.enemies.some(e => e.kind === 'warden' && e.hp > 0);
            if (!locked && distance(s, this.goal) < 15) this.goal.charge = Math.min(1, this.goal.charge + dt / 5);
            if (this.goal.charge >= 1) {
                this.stats.beacons++; this.leg++; this.phase = 'chart'; this.chartTime = 22; this.votes.clear();
                this.emit('beacon', this.goal.x, this.goal.y); this.announce('A beacon burns again. Choose your next passage.');
            }
        }
        if (this.legTime > (this.phase === 'finale' ? 210 : 170)) {
            this.hurt(dt * 9);
            if (this.legTime % 5 < dt) this.announce('The dark is closing. Keep moving!');
        }
    }
    moveShip(dt) {
        const s = this.ship, pilot = [...this.players.values()].find(p => p.role === 'helm');
        let dx = s.target.x - s.x, dy = s.target.y - s.y;
        const keys = pilot?.keys;
        const kx = keys ? Number(keys.has('d') || keys.has('ArrowRight')) - Number(keys.has('a') || keys.has('ArrowLeft')) : 0;
        const ky = keys ? Number(keys.has('s') || keys.has('ArrowDown')) - Number(keys.has('w') || keys.has('ArrowUp')) : 0;
        if (kx || ky) { dx = (kx / .62 + ky / .25) * 5; dy = (ky / .25 - kx / .62) * 5; s.target = { x: s.x, y: s.y }; s.anchor = false; }
        if (!pilot) {
            s.target = this.boss ? { x: this.boss.x - 38, y: Math.sin(this.time * .4) * 18 } : { x: this.goal.x, y: this.goal.y };
            dx = s.target.x - s.x; dy = s.target.y - s.y;
        }
        const len = Math.hypot(dx, dy), speed = s.speed * (s.boost ? 2.3 : 1) * (s.focus === 1 ? 1.25 : 1);
        const moving = !s.anchor && len > 1;
        s.vx += ((moving ? dx / len * speed : 0) - s.vx) * Math.min(1, dt * 3);
        s.vy += ((moving ? dy / len * speed : 0) - s.vy) * Math.min(1, dt * 3);
        s.x = clamp(s.x + s.vx * dt, this.legStart - 25, this.goal.x + 25); s.y = clamp(s.y + s.vy * dt, -60, 60);
        if (Math.hypot(s.vx, s.vy) > .5) s.angle = Math.atan2(s.vy, s.vx);
        if (this.time >= (this.collisionAt || 0)) for (const island of this.islands) {
            if (distance(s, island) < island.r * .68 + 2) { this.collisionAt = this.time + 1.5; this.hurt(10); this.announce('Rock strike! Steer clear of the islands.'); break; }
        }
    }
    updateEnemies(dt) {
        for (const e of this.enemies) {
            if (e.hp <= 0) continue;
            e.exposed = Math.max(0, e.exposed - dt); const d = distance(e, this.ship);
            if (d > 85) continue;
            const angle = Math.atan2(this.ship.y - e.y, this.ship.x - e.x); e.angle = angle;
            if (e.kind === 'raider' && d > 25) { e.x += Math.cos(angle) * dt * 5; e.y += Math.sin(angle) * dt * 5; }
            if (e.kind === 'chain') continue;
            e.fire -= dt;
            if (e.fire <= 0) { e.fire = e.kind === 'warden' ? 2.8 : 2.3; this.projectile(e.x, e.y, angle, true, e.kind === 'warden' ? 13 : 8); }
        }
        this.enemies = this.enemies.filter(e => e.hp > 0 && e.x > this.ship.x - 130);
        if (this.phase === 'sail' && this.legTime > this.spawnAt && this.ship.x < this.goal.x - 45) {
            this.spawnAt += this.route.id === 'refuge' ? 22 : 15;
            this.spawnEnemy('raider', this.ship.x + 62, (this.rng() - .5) * 50);
        }
        if (!this.boss?.hp) return;
        const b = this.boss; b.exposed = Math.max(0, b.exposed - dt); b.angle += dt * .3; b.volley -= dt; b.sweep -= dt;
        const stage = Math.min(2, Math.floor((1 - b.hp / b.maxHp) * 3));
        if (stage > b.phase) {
            b.phase = stage; this.spawnEnemy('raider', b.x - 15, -28); this.spawnEnemy('raider', b.x - 15, 28);
            this.emit('burst', b.x, b.y); this.announce(`Heart ${stage} shattered. The Engine is calling reinforcements!`);
        }
        if (b.volley <= 0 && distance(b, this.ship) < 100) {
            b.volley = 3.6 - b.phase * .5; const a = Math.atan2(this.ship.y - b.y, this.ship.x - b.x);
            for (let i = -1 - b.phase; i <= 1 + b.phase; i++) this.projectile(b.x, b.y, a + i * .19, true, 11, 20);
        }
        if (b.sweep <= 0) {
            b.sweep = 8 - b.phase;
            this.warnings.push({ x: this.ship.x + this.ship.vx * .6, y: this.ship.y + this.ship.vy * .6, radius: 14, time: 2.4, boss: true });
            this.announce('Eclipse pulse charging. Get out of the red ring!');
        }
    }
    updateWhale(dt) {
        const w = this.whale; if (!w) return;
        if (!w.free) {
            if (!w.introduced && distance(w, this.ship) < 85) {
                w.introduced = true; this.announce('A skywhale in chains. Scan and break both anchors to free it.');
            }
            return;
        }
        w.x += (this.ship.x - 18 - w.x) * dt * .55;
        w.y += (this.ship.y - 27 + Math.sin(this.time * .4) * 5 - w.y) * dt * .55;
        w.song -= dt;
        if (w.song <= 0) {
            w.song = 10; this.ship.shield = Math.min(this.ship.maxShield, this.ship.shield + 12);
            const target = this.nearestTarget();
            if (target) { this.hit(target, 34); this.emit('scan', w.x, w.y); }
        }
    }
    updateShots(dt) {
        for (const shot of this.shots) {
            shot.previousX = shot.x; shot.previousY = shot.y; shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt;
            if (shot.hostile) {
                if (segmentDistance(shot, this.ship) < 4) { shot.life = 0; this.hurt(shot.damage); if (this.phase === 'lost') return; }
            } else for (const enemy of [...this.enemies, ...(this.boss ? [this.boss] : [])]) {
                if (enemy.hp > 0 && segmentDistance(shot, enemy) < (enemy === this.boss ? 15 : enemy.kind === 'warden' ? 7 : 4)) {
                    shot.life = 0; this.hit(enemy, shot.damage); if (this.phase === 'sunrise') return; break;
                }
            }
        }
        this.shots = this.shots.filter(s => s.life > 0);
    }
    updateWeather(dt) {
        if (this.route.id === 'storm' && this.legTime > this.stormAt) {
            this.stormAt += 5; this.warnings.push({ x: this.ship.x + 10 + this.rng() * 12, y: this.ship.y + (this.rng() - .5) * 20, radius: 10, time: 2.8 });
        }
        for (const w of this.warnings) {
            w.time -= dt;
            if (w.time <= 0 && !w.fired) {
                w.fired = true; this.emit('lightning', w.x, w.y);
                if (distance(w, this.ship) < w.radius) { this.hurt(w.boss ? 34 : 22); if (this.phase === 'lost') return; }
            }
        }
        this.warnings = this.warnings.filter(w => w.time > -.35).slice(-8);
    }
}
function segmentDistance(shot, p) {
    const dx = shot.x - shot.previousX, dy = shot.y - shot.previousY;
    const t = clamp(((p.x - shot.previousX) * dx + (p.y - shot.previousY) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(p.x - shot.previousX - dx * t, p.y - shot.previousY - dy * t);
}
module.exports = { Voyage, freshSave, segmentDistance };
