const assert = require('assert');
const { performance } = require('perf_hooks');
const { War } = require('../../src/games/vector-siege/war');
const Game = require('../../src/games/vector-siege');
const { Squisher } = require('squish-144');
const { clamp, distance } = require('../../src/games/vector-siege/engine');
function command(w) {
    const owned = w.nodes.filter(n => n.owner === 1);
    for (const n of owned) {
        const b = n.battle, force = b.force(1, true);
        if (n.home && !n.sockets[1] && !n.queue.some(q=>q.socket===1)) w.queueUnit(n.id, 'rail', 1, 1);
        if (n.home && w.time > 25 && w.bank[1] > 60 && !n.sockets[2] && !n.queue.some(q=>q.socket===2)) w.queueUnit(n.id, 'pulse', 1, 2);
        const targets = w.adjacent(n.id).map(id => w.nodes[id]).filter(n => n.owner !== 1)
            .sort((a, b) => (a.battle.power(a.owner) + a.battle.core.hp / 80) - (b.battle.power(b.owner) + b.battle.core.hp / 80));
        if (force.length < 12 && n.queue.length < 2) {
            const kind = force.length % 5 === 4 ? 'warden' : force.length % 3 === 2 ? 'bastion' : 'seeker';
            w.queueUnit(n.id, kind);
        }
        if (b.contested()) continue;
        if (targets.length && force.length >= 4 && b.power(1) > targets[0].battle.power(targets[0].owner) * 1.2 + targets[0].battle.core.hp / 80) {
            w.sendFleet(n.id, targets[0].id, 1, 1);
        } else if (!targets.length && force.length >= 3) {
            const front = owned.filter(v => w.adjacent(v.id).some(id => w.nodes[id].owner !== 1))
                .sort((a, b) => Math.hypot(a.x - n.x, a.y - n.y) - Math.hypot(b.x - n.x, b.y - n.y))[0];
            if (front) w.sendFleet(n.id, front.id, 1, 1);
        }
    }
}
let strategicWins = 0;
for (const seed of [101, 712, 1938]) {
    const w = new War(seed); w.help = false; w.paused = false;
    for (let frame = 0; frame < 60 * 600 && !w.result; frame++) {
        if (frame % 120 === 0) command(w);
        w.step(1 / 60);
    }
    console.log(JSON.stringify({ seed, result: w.result, time: Math.round(w.time), owners: w.nodes.map(n => n.owner), bank: w.bank.map(Math.floor), captures: w.stats.captures, losses: w.stats.losses, dives: w.stats.dives }));
    assert.strictEqual(w.stats.dives, 0);
    assert(w.result, 'a strategic campaign must reach a result');
    if (w.result === 'won') strategicWins++;
    assert(w.bank.every(n => n >= 0));
}
assert(strategicWins > 0, 'verify a complete map-only victory without manual combat');
// Controlled comparison: one Seeker attacks the same neutral outpost. Only the
// second run receives a pilot; neither run purchases reinforcements.
const interventions = [];
for (const manual of [false, true]) {
    const w = new War(101); w.help = false; w.paused = false; w.aiTimer = 10000;
    for (let i = 0; i < 120; i++) w.step(1 / 120);
    w.sendFleet(1, 2, 1, 1, 1); if (manual) w.travelHero(2);
    for (let i = 0; i < 120 * 45 && w.nodes[2].owner !== 1; i++) {
        const b = w.activeBattle;
        if (b) {
            const p = b.player, target = b.enemies.filter(u => u.life > 0 && u.spawn <= 0).sort((a,c)=>distance(a,p)-distance(c,p))[0] || b.structures[0];
            b.input.fire = !!target;
            if (target) { const lead = distance(p,target)/165; b.input.aimX = target.x + (target.vx||0)*lead; b.input.aimY = target.y+(target.vy||0)*lead; }
            const t = w.time * .7; b.input.x = clamp((80 + Math.cos(t)*42-p.x)*.4,-1,1); b.input.y = clamp((46+Math.sin(t)*23-p.y)*.4,-1,1);
            if (b.flux >= 100) b.activateOverload();
        }
        w.step(1 / 120);
    }
    interventions.push({manual,captured:w.nodes[2].owner===1,seconds:Math.round(w.time),hull:w.pilot.player.hp,coreHull:Math.round(w.nodes[2].battle.core.hp)});
}
console.log(JSON.stringify({interventions}));
assert(!interventions[0].captured && interventions[1].captured, 'skill should change the outcome of an under-resourced attack');
const g = new Game(); g.handleNewPlayer({ playerId: 1 }); g.action('war'); g.warAction('pause');
const s = new Squisher({ game: g }); clearInterval(s._tickInterval); s.addListener(() => {});
const times = []; let shapes = 0, bytes = 0;
for (let frame = 0; frame < 900; frame++) {
    if (frame % 120 === 0) command(g.war);
    const start = performance.now(); g.tick(); s.flush(); times.push(performance.now() - start);
    assert.strictEqual(g.painter.overflow, 0); shapes = Math.max(shapes, g.painter.si); bytes = Math.max(bytes, s.state.flat().length);
}
times.sort((a,b)=>a-b);
console.log(JSON.stringify({ frames: times.length, meanMs: +(times.reduce((a,b)=>a+b)/times.length).toFixed(2), p95Ms:+times[Math.floor(times.length*.95)].toFixed(2), peakShapes:shapes, peakBytes:bytes }));
// Deliberately heavier than normal play: every outpost has both armies present.
g.war = new War(9001); g.war.help = false; g.war.paused = false; g.war.aiTimer = 10000;
for (const n of g.war.nodes) {
    n.battle.units = []; n.sockets = [null,null,null]; n.battle.core.hp = n.battle.core.maxHp = 50000;
    for (let i=0;i<40;i++) {
        const u=n.battle.addUnit(i%3===0?'warden':i%3===1?'bastion':'seeker',i%2?1:2,18+i%10*13,22+Math.floor(i/10)*15);
        u.spawn=0;u.hp=u.maxHp=250;
    }
}
g.war.dive(1); g.war.pilot.player.inv=100; const battle=g.war.activeBattle;
battle.weapon='lance'; for(let i=0;i<72;i++)battle.fireWeapon(); battle.burst(80,40,[255,120,140,255],120);
const crowded=[]; let maxShapes=0;
for(let i=0;i<120;i++) {const start=performance.now();g.tick();s.flush();crowded.push(performance.now()-start);assert.strictEqual(g.painter.overflow,0);maxShapes=Math.max(maxShapes,g.painter.si);}
crowded.sort((a,b)=>a-b);
console.log(JSON.stringify({stress:'480 units across 12 simultaneous battles',frames:crowded.length,p95Ms:+crowded[Math.floor(crowded.length*.95)].toFixed(2),peakShapes:maxShapes,peakBytes:s.state.flat().length}));
g.close();
