const { WORLD, UNIT_TYPES, BUILD_TYPES, ENEMY_TYPES, UPGRADES, WAVE_NAMES } = require('./settings');

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const active = entity => entity.hp > 0;
const point = (x, y, margin = 1) => ({ x: clamp(x, WORLD.left + margin, WORLD.right - margin), y: clamp(y, WORLD.top + margin, WORLD.bottom - margin) });

class Engine {
    constructor(seed = 731) { this._reset(seed); }

    _reset(seed) {
        this.seed = Number(seed) >>> 0 || 731;
        this.randomState = this.seed;
        this.nextId = 1;
        this.phase = 'title'; this.wave = 1; this.time = 0; this.waveTime = 0; this.waveDuration = 36;
        this.credits = 190; this.endless = false;
        this.base = { id: 'hq', type: 'hq', x: 18, y: 46, hp: 1100, maxHp: 1100, level: 1, radius: 5, angle: 0 };
        this.units = []; this.buildings = []; this.enemies = []; this.projectiles = []; this.effects = [];
        this.beacons = [{ x: 48, y: 30 }, { x: 70, y: 60 }, { x: 94, y: 30 }]
            .map((p, index) => ({ ...p, id: 'beacon' + index, owner: 'neutral', progress: 0, capturing: null, radius: 5 }));
        this.terrain = [{ x: 59, y: 43, radius: 4, kind: 'rock' },
            { x: 38, y: 65, radius: 3, kind: 'rock' }, { x: 87, y: 21, radius: 3.3, kind: 'rock' }];
        this.crates = [{ id: 'crate1', x: 43, y: 49, value: 45 }, { id: 'crate2', x: 81, y: 35, value: 65 }];
        this.rally = { x: 32, y: 46 };
        this.spawnQueue = []; this.upgrades = []; this.options = this.upgrades;
        this.stats = { kills: 0, waves: 0, spent: 0 };
        this.bonuses = { damage: 1, hp: 1, range: 0, supply: 0, income: 0, splash: 0, shellDamage: 1, healing: 1 };
        this.message = 'Build your front. Capture outposts. Keep HQ standing.'; this.messageTime = 8;
        this.buildingCap = 14; this.repairCost = 50;
        this._spawnUnit('ranger', 28, 40); this._spawnUnit('ranger', 30, 46); this._spawnUnit('ranger', 28, 52);
        this._spawnUnit('tank', 25, 46);
    }

    random() {
        let state = this.randomState;
        state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
        this.randomState = state >>> 0;
        return this.randomState / 4294967296;
    }
    get selected() { return this.units.filter(unit => unit.selected).map(unit => unit.id); }
    get unitCap() { return Math.min(42, 18 + (this.base.level - 1) * 4 + this.bonuses.supply); }
    get income() { return 3 + (this.base.level - 1) + this.bonuses.income
        + this.beacons.filter(beacon => beacon.owner === 'player').length * 2
        + this.buildings.filter(building => building.type === 'refinery' && active(building)).length * BUILD_TYPES.refinery.income; }
    get baseUpgradeCost() { return 160 + (this.base.level - 1) * 120; }
    get waveLabel() { return WAVE_NAMES[this.wave - 1] || 'Endless front ' + (this.wave - 6); }

    notify(message, duration = 3.5) { this.message = message; this.messageTime = duration; return false; }
    start() { if (this.phase !== 'title') return false; this.phase = 'prep'; return true; }
    restart(seed = this.seed) { this._reset(seed); this.start(); return true; }
    continueEndless() {
        if (this.phase !== 'won') return false;
        this.endless = true; this.wave++; this.phase = 'prep'; this.upgrades = []; this.options = this.upgrades;
        this.notify('The war goes on. Endless reinforcements are coming.', 5); return true;
    }
    _canManage() { return this.phase === 'prep' || this.phase === 'battle'; }

    _spawnUnit(type, x = 26, y = 46) {
        if (!UNIT_TYPES[type] || this.units.length >= this.unitCap) return null;
        const spec = UNIT_TYPES[type];
        const unit = { id: 'u' + this.nextId++, type, ...point(x, y, spec.radius), hp: spec.hp * this.bonuses.hp,
            maxHp: spec.hp * this.bonuses.hp, selected: false, angle: 0, cooldown: 0, radius: spec.radius, order: null,
            anchor: point(x, y, spec.radius) };
        this.units.push(unit); return unit;
    }

    recruit(type) {
        if (!this._canManage() || !UNIT_TYPES[type]) return false;
        if (this.units.length >= this.unitCap) return this.notify('Army full. Upgrade HQ or draft Supply convoy.');
        const spec = UNIT_TYPES[type];
        if (this.credits < spec.cost) return this.notify('Need ' + spec.cost + ' credits for a ' + spec.name + '.');
        this.credits -= spec.cost; this.stats.spent += spec.cost;
        const unit = this._spawnUnit(type, 25 + this.random() * 4, 42 + this.random() * 8);
        unit.order = { type: 'move', ...point(this.rally.x + (this.random() - .5) * 6, this.rally.y + (this.random() - .5) * 6) };
        this._effect(unit.x, unit.y, 'spawn', 1, { radius: 4 });
        this.notify(spec.name + ' ready.', 2); return true;
    }

    canBuild(type, x, y) {
        const spec = BUILD_TYPES[type];
        if (!this._canManage() || !spec || !Number.isFinite(x) || !Number.isFinite(y) || this.buildings.length >= this.buildingCap) return false;
        const p = { x, y }, r = spec.radius;
        if (x < WORLD.left + r || x > 104 - r || y < WORLD.top + r || y > WORLD.bottom - r) return false;
        if (distance(p, this.base) < this.base.radius + r + 2) return false;
        if (this.buildings.some(building => distance(p, building) < building.radius + r + 1.5)) return false;
        if (this.beacons.some(beacon => distance(p, beacon) < beacon.radius + r)) return false;
        if (this.terrain.some(rock => distance(p, rock) < rock.radius + r)) return false;
        return true;
    }

    build(type, x, y) {
        if (!this._canManage() || !BUILD_TYPES[type]) return false;
        if (!this.canBuild(type, x, y)) return this.notify(this.buildings.length >= this.buildingCap
            ? 'Construction limit reached.' : 'Choose open ground away from HQ, rocks and outposts.');
        const spec = BUILD_TYPES[type];
        if (this.credits < spec.cost) return this.notify('Need ' + spec.cost + ' credits for a ' + spec.name + '.');
        this.credits -= spec.cost; this.stats.spent += spec.cost;
        this.buildings.push({ id: 'b' + this.nextId++, type, x, y, hp: spec.hp * this.bonuses.hp,
            maxHp: spec.hp * this.bonuses.hp, level: 1, angle: 0, cooldown: 0, radius: spec.radius });
        this._effect(x, y, 'spawn', 1, { radius: spec.radius + 2 });
        this.notify(spec.name + ' online.', 2); return true;
    }

    upgradeBase() {
        if (!this._canManage()) return false;
        if (this.base.level >= 4) return this.notify('HQ is fully upgraded.');
        const cost = this.baseUpgradeCost;
        if (this.credits < cost) return this.notify('HQ upgrade needs ' + cost + ' credits.');
        this.credits -= cost; this.stats.spent += cost; this.base.level++;
        this.base.maxHp += 350; this.base.hp = Math.min(this.base.maxHp, this.base.hp + 350);
        this._effect(this.base.x, this.base.y, 'heal', 1.5, { radius: 9 });
        this.notify('HQ level ' + this.base.level + ': more armor, income and army capacity.'); return true;
    }

    repairBase() {
        if (!this._canManage()) return false;
        if (this.base.hp >= this.base.maxHp) return this.notify('HQ armor is already full.');
        if (this.credits < this.repairCost) return this.notify('HQ repair needs ' + this.repairCost + ' credits.');
        this.credits -= this.repairCost; this.stats.spent += this.repairCost;
        this.base.hp = Math.min(this.base.maxHp, this.base.hp + 350);
        this._effect(this.base.x, this.base.y, 'heal', 1.2, { radius: 8 });
        this.notify('HQ repaired +350 armor.'); return true;
    }

    selectAll() { this.units.forEach(unit => { unit.selected = true; }); return this.units.length; }
    selectAt(x, y, additive = false) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
        let closest = null, best = 4;
        for (const unit of this.units) {
            const d = distance(unit, { x, y });
            if (d <= Math.max(best, unit.radius + 1) && (!closest || d < best)) { closest = unit; best = d; }
        }
        if (!additive) this.units.forEach(unit => { unit.selected = false; });
        if (closest) closest.selected = additive ? !closest.selected : true;
        return this.selected.length;
    }
    selectRect(x1, y1, x2, y2, additive = false) {
        if (![x1, y1, x2, y2].every(Number.isFinite)) return 0;
        const left = Math.min(x1, x2), right = Math.max(x1, x2), top = Math.min(y1, y2), bottom = Math.max(y1, y2);
        this.units.forEach(unit => {
            const inside = unit.x >= left && unit.x <= right && unit.y >= top && unit.y <= bottom;
            unit.selected = inside || (additive && unit.selected);
        });
        return this.selected.length;
    }
    command(x, y) {
        if (!this._canManage() || !Number.isFinite(x) || !Number.isFinite(y)) return false;
        const destination = point(x, y, 3);
        const selected = this.units.filter(unit => unit.selected);
        let target = null, nearest = 6;
        for (const enemy of this.enemies) {
            const d = distance(enemy, destination);
            if (active(enemy) && d < nearest + enemy.radius) { nearest = d; target = enemy; }
        }
        if (!selected.length) {
            this.rally = destination; this._effect(x, y, 'rally', 1.2, { radius: 4 });
            this.notify('Rally point set for new recruits.', 2); return true;
        }
        const columns = Math.ceil(Math.sqrt(selected.length)), rows = Math.ceil(selected.length / columns);
        selected.forEach((unit, index) => {
            const at = point(destination.x + ((index % columns) - (columns - 1) / 2) * 4,
                destination.y + (Math.floor(index / columns) - (rows - 1) / 2) * 4, unit.radius);
            unit.order = target ? { type: 'attack', targetId: target.id, x: target.x, y: target.y } : { type: 'move', ...at };
        });
        this._effect(destination.x, destination.y, target ? 'attack' : 'move', 1.1, { radius: 4 });
        return true;
    }

    startWave() {
        if (this.phase !== 'prep') return false;
        this.phase = 'battle'; this.waveTime = 0; this.spawnQueue = [];
        const count = 9 + this.wave * 4;
        const lastSpawn = Math.min(29, 17 + this.wave * 2);
        this.waveDuration = lastSpawn + 17;
        for (let index = 0; index < Math.min(90, count); index++) {
            let type = 'grunt';
            const roll = this.random();
            if (this.wave >= 4 && roll < .22) type = 'artillery';
            else if (this.wave >= 3 && roll < .38) type = 'tank';
            else if (this.wave >= 2 && roll < .64) type = 'runner';
            this.spawnQueue.push({ at: index * lastSpawn / Math.max(1, count - 1), type,
                y: [25, 46, 67][index % 3] + (this.random() - .5) * 5 });
        }
        if (this.wave >= 6) this.spawnQueue.push({ at: 11, type: 'boss', y: 46 });
        if (this.wave >= 10) this.spawnQueue.push({ at: 22, type: 'boss', y: 30 });
        this.spawnQueue.sort((a, b) => a.at - b.at);
        this.notify('Wave ' + this.wave + ' · ' + this.waveLabel, 5);
        return true;
    }

    _spawnEnemy(type, y) {
        const spec = ENEMY_TYPES[type];
        const scale = 1 + Math.max(0, this.wave - 1) * .095;
        const enemy = { id: 'e' + this.nextId++, type, x: 114, y: clamp(y, 20, 72),
            hp: spec.hp * scale, maxHp: spec.hp * scale, angle: Math.PI, cooldown: .2 + this.random() * .5,
            radius: spec.radius, damage: spec.damage * (1 + Math.max(0, this.wave - 1) * .05), speed: spec.speed };
        this.enemies.push(enemy);
        this._effect(enemy.x, enemy.y, 'spawn', .8, { from: 'enemy', radius: enemy.radius + 1 });
        return enemy;
    }

    update(dt = 1 / 60) {
        if (!Number.isFinite(dt) || dt <= 0 || this.phase === 'title') return;
        let remaining = Math.min(dt, .5);
        while (remaining > 1e-8) {
            const step = Math.min(remaining, 1 / 30); remaining -= step;
            this._step(step);
        }
    }
    _step(dt) {
        this.time += dt; this.messageTime = Math.max(0, this.messageTime - dt);
        this.effects.forEach(effect => { effect.life -= dt; });
        this.effects = this.effects.filter(effect => effect.life > 0);
        if (!this._canManage()) return;
        if (this.phase === 'battle') {
            this.waveTime += dt; this.credits += this.income * dt;
            while (this.spawnQueue.length && this.spawnQueue[0].at <= this.waveTime && this.enemies.length < 70) {
                const spawn = this.spawnQueue.shift(); this._spawnEnemy(spawn.type, spawn.y);
            }
        }
        for (const unit of this.units) this._updateUnit(unit, dt);
        this._separate(this.units, dt);
        this._capture(dt);
        this._collectCrates();
        if (this.phase !== 'battle') return;
        for (const building of this.buildings) if (active(building) && building.type !== 'refinery') {
            building.cooldown -= dt;
            const spec = BUILD_TYPES[building.type];
            const target = this._nearest(building, this.enemies, spec.range + this.bonuses.range);
            if (target) { building.angle = Math.atan2(target.y - building.y, target.x - building.x); this._fire(building, target, spec, 'player'); }
        }
        for (const enemy of this.enemies) this._updateEnemy(enemy, dt);
        this._separate(this.enemies, dt);
        this._updateProjectiles(dt);
        this._cleanDead();
        if (this.base.hp <= 0) {
            this.base.hp = 0; this.phase = 'lost'; this.projectiles = [];
            this._effect(this.base.x, this.base.y, 'explosion', 2.5, { radius: 14, from: 'enemy' });
            this.notify('HQ lost. Regroup and build a stronger front.', 20); return;
        }
        if (!this.spawnQueue.length && !this.enemies.length) this._winWave();
    }

    _nearest(entity, candidates, maxRange = Infinity, predicate = active) {
        let nearest = null, best = maxRange;
        for (const candidate of candidates) {
            if (candidate === entity || !predicate(candidate)) continue;
            const d = distance(entity, candidate);
            if (d < best) { best = d; nearest = candidate; }
        }
        return nearest;
    }
    _move(entity, target, speed, dt, stop = .35) {
        const dx = target.x - entity.x, dy = target.y - entity.y, d = Math.hypot(dx, dy);
        if (d <= stop) return true;
        const length = Math.min(speed * dt, d - stop);
        entity.x += dx / d * length; entity.y += dy / d * length;
        entity.angle = Math.atan2(dy, dx);
        Object.assign(entity, point(entity.x, entity.y, entity.radius));
        return false;
    }
    _updateUnit(unit, dt) {
        if (!active(unit)) return;
        const spec = UNIT_TYPES[unit.type];
        unit.cooldown = Math.max(0, unit.cooldown - dt);
        const inBattle = this.phase === 'battle';
        let target = null;
        if (unit.order?.type === 'attack') {
            target = this.enemies.find(enemy => enemy.id === unit.order.targetId && active(enemy));
            if (!target) { unit.order = null; unit.anchor = { x: unit.x, y: unit.y }; }
        }
        // Nearby idle troops close the small gap to an enemy siege gun instead
        // of accepting an endless exchange just outside their own gun range.
        if (inBattle && !unit.order && unit.type !== 'medic') {
            target = this.enemies.find(enemy => enemy.id === unit.attackerId && active(enemy)
                && distance(unit, enemy) < spec.range + this.bonuses.range + 20)
                || this._nearest(unit, this.enemies, spec.range + this.bonuses.range + 14);
        }
        if (unit.order?.type === 'move') {
            if (this._move(unit, unit.order, spec.speed, dt)) { unit.order = null; unit.anchor = { x: unit.x, y: unit.y }; }
        } else if (target) {
            const firingRange = Math.max(3, spec.range + this.bonuses.range - 2);
            if (unit.order?.type === 'attack' || unit.attackerId === target.id) this._move(unit, target, spec.speed, dt, firingRange);
            else if (distance(unit, target) > firingRange) {
                const anchor = unit.anchor || unit, d = distance(anchor, target);
                const destination = { x: anchor.x + (target.x - anchor.x) * Math.min(1, 10 / d),
                    y: anchor.y + (target.y - anchor.y) * Math.min(1, 10 / d) };
                this._move(unit, destination, spec.speed, dt);
            }
        }
        if (!inBattle) return;
        if (unit.type === 'medic') {
            const patient = this._nearest(unit, this.units, spec.range + this.bonuses.range, ally => active(ally) && ally.hp < ally.maxHp - .5);
            if (patient && unit.cooldown <= 0) {
                patient.hp = Math.min(patient.maxHp, patient.hp + spec.healing * this.bonuses.healing);
                unit.cooldown = spec.rate; unit.angle = Math.atan2(patient.y - unit.y, patient.x - unit.x);
                this._effect(patient.x, patient.y, 'heal', .5, { radius: 2.5 });
                this._effect(unit.x, unit.y, 'heal', .3, { radius: 1 });
            }
            return;
        }
        if (!target || distance(unit, target) > spec.range + this.bonuses.range) target = this._nearest(unit, this.enemies, spec.range + this.bonuses.range);
        if (target) { unit.angle = Math.atan2(target.y - unit.y, target.x - unit.x); this._fire(unit, target, spec, 'player'); }
    }
    _updateEnemy(enemy, dt) {
        if (!active(enemy)) return;
        const spec = ENEMY_TYPES[enemy.type];
        enemy.cooldown -= dt;
        // Keep pushing toward military targets: two unarmed medics must not
        // indefinitely distract an entire siege force by healing one another.
        const allies = [...this.units.filter(unit => unit.type !== 'medic'), ...this.buildings, this.base];
        // Siege guns pressure structures; other troops engage the closest threat.
        let target = this._nearest(enemy, enemy.type === 'artillery' ? [...this.buildings, this.base] : allies, spec.range + 6);
        if (!target) target = this._nearest(enemy, allies);
        if (!target) return;
        this._move(enemy, target, enemy.speed, dt, Math.max(2, spec.range - 1));
        if (distance(enemy, target) <= spec.range + target.radius * .25) {
            enemy.angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
            this._fire(enemy, target, { ...spec, damage: enemy.damage }, 'enemy');
        }
    }

    _fire(shooter, target, spec, from) {
        if (shooter.cooldown > 0 || this.projectiles.length >= 180 || !active(target)) return;
        shooter.cooldown = spec.rate;
        const shell = !!spec.splash;
        const bonus = from === 'player' ? this.bonuses.damage * (shell ? this.bonuses.shellDamage : 1) : 1;
        this.projectiles.push({ id: 'p' + this.nextId++, x: shooter.x, y: shooter.y, tx: target.x, ty: target.y,
            targetId: target.id, shooterId: shooter.id, from, type: shell ? 'shell' : 'bullet', damage: spec.damage * bonus,
            splash: shell ? spec.splash + (from === 'player' ? this.bonuses.splash : 0) : 0,
            speed: shell ? 38 : 80, life: 3, radius: shell ? .75 : .32 });
        this._effect(shooter.x, shooter.y, 'shot', .16, { radius: shell ? 1.5 : .8, from });
    }
    _updateProjectiles(dt) {
        for (const projectile of this.projectiles) {
            projectile.life -= dt;
            if (projectile.life <= 0) continue;
            const targets = projectile.from === 'player' ? this.enemies : [...this.units, ...this.buildings, this.base];
            const target = targets.find(entity => entity.id === projectile.targetId && active(entity));
            // Rifle shots track a target. Shells land on the position aimed at.
            if (!projectile.splash && target) { projectile.tx = target.x; projectile.ty = target.y; }
            const dx = projectile.tx - projectile.x, dy = projectile.ty - projectile.y, d = Math.hypot(dx, dy);
            if (d <= projectile.speed * dt) {
                projectile.x = projectile.tx; projectile.y = projectile.ty; projectile.life = 0;
                if (projectile.splash) {
                    for (const entity of targets) if (active(entity)) {
                        const hitDistance = distance(entity, projectile);
                        if (hitDistance <= projectile.splash + entity.radius * .5) {
                            entity.hp -= projectile.damage * Math.max(.4, 1 - hitDistance / (projectile.splash * 1.6));
                            entity.attackerId = projectile.shooterId;
                        }
                    }
                } else if (target) { target.hp -= projectile.damage; target.attackerId = projectile.shooterId; }
                this._effect(projectile.x, projectile.y, projectile.splash ? 'explosion' : 'hit', projectile.splash ? .5 : .2,
                    { radius: projectile.splash || 1.4, from: projectile.from });
            } else { projectile.x += dx / d * projectile.speed * dt; projectile.y += dy / d * projectile.speed * dt; }
        }
        this.projectiles = this.projectiles.filter(projectile => projectile.life > 0);
    }
    _separate(entities, dt) {
        for (let i = 0; i < entities.length; i++) for (let j = i + 1; j < entities.length; j++) {
            const a = entities[i], b = entities[j];
            const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), minimum = (a.radius + b.radius) * .88;
            if (d >= minimum) continue;
            const amount = Math.min((minimum - d) / 2, dt * 3);
            const nx = d > .001 ? dx / d : 1, ny = d > .001 ? dy / d : 0;
            Object.assign(a, point(a.x - nx * amount, a.y - ny * amount, a.radius));
            Object.assign(b, point(b.x + nx * amount, b.y + ny * amount, b.radius));
        }
    }
    _capture(dt) {
        for (const beacon of this.beacons) {
            const friendly = this.units.some(unit => active(unit) && unit.type !== 'medic' && distance(unit, beacon) < 7);
            const hostile = this.enemies.some(enemy => active(enemy) && distance(enemy, beacon) < 7);
            const side = friendly && !hostile ? 'player' : hostile && !friendly ? 'enemy' : null;
            if (!side || side === beacon.owner) { beacon.capturing = null; beacon.progress = 0; continue; }
            if (beacon.capturing !== side) { beacon.capturing = side; beacon.progress = 0; }
            beacon.progress += dt / 3.5;
            if (beacon.progress >= 1) {
                beacon.owner = side; beacon.progress = 0; beacon.capturing = null;
                this._effect(beacon.x, beacon.y, 'capture', 1.6, { radius: 8, from: side });
                if (side === 'player') this.notify('Outpost captured. +2 credits per battle second.', 3);
            }
        }
    }
    _collectCrates() {
        this.crates = this.crates.filter(crate => {
            if (!this.units.some(unit => active(unit) && distance(unit, crate) < 3.5)) return true;
            this.credits += crate.value;
            this._effect(crate.x, crate.y, 'coin', 1.3, { radius: 3, text: '+' + crate.value });
            this.notify('Salvage secured: +' + crate.value + ' credits.', 2); return false;
        });
    }
    _cleanDead() {
        for (const enemy of this.enemies) if (!active(enemy)) {
            this.stats.kills++; this.credits += ENEMY_TYPES[enemy.type].reward;
            this._effect(enemy.x, enemy.y, 'explosion', .7, { radius: enemy.radius + 1.5, from: 'enemy' });
        }
        for (const entity of [...this.units, ...this.buildings]) if (!active(entity)) {
            this._effect(entity.x, entity.y, 'explosion', .7, { radius: entity.radius + 1, from: 'player' });
        }
        this.enemies = this.enemies.filter(active); this.units = this.units.filter(active); this.buildings = this.buildings.filter(active);
    }
    _effect(x, y, kind, life, extra = {}) {
        if (this.effects.length >= 180) this.effects.shift();
        this.effects.push({ id: 'fx' + this.nextId++, x, y, kind, life, maxLife: life, radius: 2, ...extra });
    }

    _winWave() {
        this.stats.waves++; this.projectiles = [];
        const reward = 65 + this.wave * 15;
        this.credits += reward; this.base.hp = Math.min(this.base.maxHp, this.base.hp + 100);
        this.units.forEach(unit => { unit.hp = Math.min(unit.maxHp, unit.hp + unit.maxHp * .2); unit.order = null;
            unit.attackerId = null; unit.anchor = { x: unit.x, y: unit.y }; });
        this.buildings.forEach(building => { building.hp = Math.min(building.maxHp, building.hp + building.maxHp * .15); });
        if (this.wave >= 6 && !this.endless) {
            this.phase = 'won'; this.notify('Dreadnought down! The pocket is yours.', 30); return;
        }
        const choices = UPGRADES.map(upgrade => ({ ...upgrade }));
        for (let i = choices.length - 1; i > 0; i--) {
            const j = Math.floor(this.random() * (i + 1)); [choices[i], choices[j]] = [choices[j], choices[i]];
        }
        this.upgrades = choices.slice(0, 3); this.options = this.upgrades; this.phase = 'upgrade';
        this.notify('Wave clear! +' + reward + ' credits. Choose a field upgrade.', 20);
    }
    chooseUpgrade(index) {
        if (this.phase !== 'upgrade' || !Number.isInteger(index) || !this.upgrades[index]) return false;
        const upgrade = this.upgrades[index];
        switch (upgrade.id) {
            case 'weapons': this.bonuses.damage *= 1.2; break;
            case 'range': this.bonuses.range += 3; break;
            case 'armor':
                this.bonuses.hp *= 1.2;
                for (const entity of [...this.units, ...this.buildings]) { const hp = entity.maxHp * .2; entity.maxHp += hp; entity.hp += hp; }
                break;
            case 'supply': this.bonuses.supply += 4; this.credits += 80; break;
            case 'economy': this.bonuses.income += 2; this.credits += 50; break;
            case 'shells': this.bonuses.splash += 2; this.bonuses.shellDamage *= 1.15; break;
            case 'triage': this.bonuses.healing *= 1.4; this._spawnUnit('medic', 26, 50); break;
            case 'fortify': this.base.maxHp += 250; this.base.hp += 250; break;
            case 'reinforce':
                this._spawnUnit('ranger', 27, 42); this._spawnUnit('ranger', 27, 50); this.credits += 60;
                this.units.forEach(unit => { unit.hp = Math.min(unit.maxHp, unit.hp + unit.maxHp * .25); });
                break;
        }
        this.wave++; this.phase = 'prep'; this.upgrades = []; this.options = this.upgrades;
        this.notify(upgrade.name + ' equipped. Prepare for wave ' + this.wave + '.', 5);
        return true;
    }
}

module.exports = Engine;
module.exports.Engine = Engine;
module.exports.UNIT_TYPES = UNIT_TYPES;
module.exports.BUILD_TYPES = BUILD_TYPES;
module.exports.UPGRADES = UPGRADES;
