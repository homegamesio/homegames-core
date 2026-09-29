const { performance } = require('perf_hooks');
const assert = require('assert');
const Game = require('../../src/games/vector-siege');
const { Engine, clamp, distance } = require('../../src/games/vector-siege/engine');
const { WEAPONS } = require('../../src/games/vector-siege/settings');
const { Squisher } = require('squish-144');
function pilot(e) {
    const p = e.player;
    const enemies = e.enemies.filter(v => v.life > 0 && v.spawn <= 0).sort((a, b) => distance(a, p) - distance(b, p));
    const structures = e.structures.filter(v => v.hp > 0).sort((a, b) => distance(a, p) - distance(b, p));
    const nearest = enemies[0];
    const priority = structures.find(s => s.priority && e.mission.mode === 'raid');
    const warden = enemies.find(v => v.type === 'warden' && distance(v, p) < 35);
    const target = warden || (nearest && distance(nearest, p) < 24 ? nearest : priority || structures[0] || nearest || (e.boss && e.boss.hp > 0 ? e.boss : null));
    if (target) {
        const lead = distance(p, target) / WEAPONS.find(w => w.id === e.weapon).speed;
        e.input.aimX = target.x + (target.vx || 0) * lead;
        e.input.aimY = target.y + (target.vy || 0) * lead;
    }
    e.input.fire = !!target;
    const capture = !e.boss && !e.practice && !structures.length && !enemies.some(v => Math.hypot(v.x - 80, v.y - 44) < 15);
    const extract = e.mission.mode === 'raid' && !priority;
    const t = e.mission.time * .65;
    let cx = capture || extract ? 80 : 80 + Math.cos(t) * 47, cy = extract ? 69 : capture ? 44 : 46 + Math.sin(t) * 23;
    if (!capture && !extract && e.weapon === 'scatter' && target) {
        const radius = target === e.boss ? 27 : 13;
        cx = target.x + Math.cos(t) * radius; cy = target.y + Math.sin(t) * radius;
    }
    e.input.x = clamp((cx - p.x) * .3, -1, 1); e.input.y = clamp((cy - p.y) * .3, -1, 1);
    if (nearest && distance(nearest, p) < 4 && p.charges > 0) e.input.dash = true;
    if (e.flux >= 100 && (enemies.length > 3 || e.boss)) e.activateOverload();
}
function install(e) {
    const ranking = ['repair', 'arc', 'volatile', 'power', 'rapid', 'vampire', 'pierce', 'battery', 'magnet', 'split', 'dash', 'blade', 'frost', 'ricochet'];
    const choices = e.choices.map((v, i) => ({ i, rank: ranking.indexOf(v.id) + (v.id === 'repair' && e.player.hp >= 5 ? 8 : 0) }));
    e.choose(choices.sort((a, b) => a.rank - b.rank)[0].i);
}
for (const weapon of WEAPONS) for (const route of ['capture', 'raid', 'direct']) for (const seed of [101, 712, 1938]) {
    const e = new Engine(seed); e.start(); e.chooseWeapon(weapon.id);
    const routeMissions = route === 'direct' ? [3] : [0, 1, 2, 3];
    const results = [];
    for (const mission of routeMissions) {
        if (e.phase !== 'map') break;
        while (e.player.hp <= e.player.maxHp - 2 && e.repairHull()) {}
        while (e.salvage >= 80 && e.buyModule()) install(e);
        e.enter(mission, false, route === 'raid' && mission < 3 ? 'raid' : 'capture');
        for (let i = 0; i < 120 * 150 && e.phase === 'combat'; i++) { pilot(e); e.step(); }
        results.push({ mission, phase: e.phase, seconds: Math.round(e.mission.time), hull: e.player.hp, salvage: e.salvage });
        if (e.phase === 'upgrade') install(e);
        if (e.phase === 'report') e.phase = 'map';
        if (e.phase === 'combat') throw new Error('Pilot stalled in '+route+' / '+weapon.id+' / '+seed);
    }
    console.log(JSON.stringify({ seed, weapon: weapon.id, route, results, score: e.score }));
}
const g = new Game(); g.handleNewPlayer({ playerId: 1 }); g.engine.enter(0, true); g.draw();
const s = new Squisher({ game: g }); clearInterval(s._tickInterval); s.addListener(() => {});
const costs = []; let peakShapes = 0, peakBytes = 0;
for (let i = 0; i < 1800; i++) {
    const start = performance.now();
    pilot(g.engine); g.engine.step(); g.engine.step(); g.audio.tick(g.engine.events, 1 / 60, true); g.draw(); s.flush();
    costs.push(performance.now() - start);
    peakShapes = Math.max(peakShapes, g.painter.si); peakBytes = Math.max(peakBytes, s.state.flat().length);
    assert.strictEqual(g.painter.overflow, 0);
}
costs.sort((a, b) => a - b);
console.log(JSON.stringify({ frames: costs.length, meanMs: +(costs.reduce((a, b) => a + b) / costs.length).toFixed(2),
    p95Ms: +costs[Math.floor(costs.length * .95)].toFixed(2), peakShapes, peakBytes }));
// Saturate every pool together, including repeated shield links and chain effects.
const e = g.engine; e.start(); e.enter(3); e.practice = true; e.weapon = 'lance';
for (let i = 0; i < e.enemies.length; i++) e.spawn(i % 2 ? 'heavy' : 'warden', 40 + i % 9 * 7, 25 + Math.floor(i / 9) * 10, true, true);
e.updateEnemies(.01);
for (const enemy of e.enemies) { enemy.flash = .4; enemy.shieldFlash = .2; }
for (let i = 0; i < e.bullets.length; i++) e.fireWeapon();
for (let i = 0; i < e.hostile.length; i++) e.enemyShot(e.boss, i / 64 * Math.PI * 2, 20);
for (let i = 0; i < e.hazards.length; i++) e.hazard(i % 2 ? 'mine' : 'beam', 20 + i * 5, 30, i / 5);
for (let i = 0; i < e.gems.length; i++) Object.assign(e.gems[i], { x: 15 + i * 2, y: 60, angle: i, life: 10 });
for (let i = 0; i < 12; i++) { e.ring(80, 40, [255, 100, 100, 255]); e.link(60, 40, 80, 60, [90, 170, 255, 255]); }
e.burst(80, 40, [255, 100, 100, 255], 120); e.overload = 5; e.player.dash = .1; e.flash = .5;
const stressStart = performance.now(); g.draw(); s.flush();
console.log(JSON.stringify({ saturatedShapes: g.painter.si, saturatedBytes: s.state.flat().length, saturatedMs: +(performance.now() - stressStart).toFixed(2), overflow: g.painter.overflow }));
assert.strictEqual(g.painter.overflow, 0, 'critical visuals must survive saturated effects');
g.close();
