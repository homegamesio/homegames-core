const { C, BOUNDS: B, SECTORS } = require('./settings');
const TAU = Math.PI * 2;
const number = n => Math.floor(n).toLocaleString('en-US');
function ship(p, x, y, angle, scale = 1, color = C.teal) {
    const pts = [[2.5, 0], [-1.8, -1.55], [-.8, 0], [-1.8, 1.55], [2.5, 0]];
    p.poly(pts.map(([a, b]) => [x + (a * Math.cos(angle) - b * Math.sin(angle)) * scale,
        y + (a * Math.sin(angle) + b * Math.cos(angle)) * scale]), C.panel, color, .17, 1, true);
    p.ngon(x, y, .45 * scale, 4, angle, C.white);
}
function background(p, e) {
    p.rect(0, 0, 160, 90, C.bg);
    for (let i = 0; i < 22; i++) {
        const x = (i * 47.91 + 5) % 158, y = (i * 31.37 + 4) % 87;
        p.rect(x, y, i % 4 ? .1 : .22, i % 4 ? .1 : .22, C.muted, .2 + (i % 3) * .15);
    }

    p.text(e.device || '', 154, 4.5, 1.25, e.device ? C.teal : C.muted, 'right');
    p.line(6, 10, 154, 10, C.line);
}
function hero(p, e, x = 118, y = 43, scale = 1) {
    const t = e.reduced ? 0 : e.uiTime;
    for (let i = 0; i < 4; i++) p.arc(x, y, (12 + i * 5) * scale, t * .04 * (i % 2 ? -1 : 1), TAU * .91, i === 2 ? C.line : C.panel, .18);
    p.arc(x, y, 17 * scale, -.94, 1.88, C.teal, .7, .9, true);
    p.arc(x, y, 19 * scale, -.94, 1.88, C.teal, .15, .3);
    ship(p, x, y, -.08, 3 * scale);
    for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 + t * .3;
        p.ngon(x + Math.cos(a) * 12 * scale, y + Math.sin(a) * 12 * scale, .65 * scale, 4, a, i < 2 ? C.gold : C.teal, null, 1, true);
    }
    for (let i = 0; i < 3; i++) {
        const a = -.65 + i * .6, r = (24 + ((i * 6 - t * 8) % 12 + 12) % 12) * scale;
        p.line(x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(a) * (r + 2), y + Math.sin(a) * (r + 2), C.gold, .25);
    }

}
function title(p, e) {
    hero(p, e);

    p.text('Catch gold shots. Fire them back.', 8, 35, 2.6, C.white);
    p.button('PLAY', 8, 48, 36, 10, 'start', e.selected === 0);
    p.button('PRACTICE', 47, 48, 36, 10, 'practice', e.selected === 1);
    p.text('BEST  ' + number(e.best), 8, 76, 1.6, C.gold);
    p.text('D-pad: choose   /   A or Enter: launch   /   START: pause', 8, 82, 1.5, C.muted);
    p.text('M: sound ' + (e.sound ? 'on' : 'off') + '   /   V: reduced effects ' + (e.reduced ? 'on' : 'off'), 8, 86, 1.2, C.muted);
}
function arena(p, e) {
    p.rect(B.left, B.top, B.right - B.left, B.bottom - B.top, [8, 18, 28]);
    for (let x = B.left + 8; x < B.right; x += 8) p.line(x, B.top, x, B.bottom, C.line, .045, .3);
    for (let y = B.top + 8; y < B.bottom; y += 8) p.line(B.left, y, B.right, y, C.line, .045, .3);
    p.arc(67, 47, 23, 0, TAU, C.line, .075, .45);
    p.arc(67, 47, 29, 0, TAU, C.line, .075, .3);
    p.line(B.left, B.top, B.right, B.top, C.line); p.line(B.left, B.bottom, B.right, B.bottom, C.line);
    p.line(B.left, B.top, B.left, B.bottom, C.line); p.line(B.right, B.top, B.right, B.bottom, C.line);
    for (const [x, y, dx, dy] of [[7, 15, 1, 1], [127, 15, -1, 1], [7, 79, 1, -1], [127, 79, -1, -1]]) {
        p.line(x, y, x + dx * 3, y, C.teal, .22); p.line(x, y, x, y + dy * 3, C.teal, .22);
    }
    if (!e.reduced && e.shake > 0) { p.ox = Math.sin(e.time * 150) * e.shake; p.oy = Math.cos(e.time * 170) * e.shake; }
    for (const b of e.beams) {
        let length = 160;
        const dx = Math.cos(b.angle), dy = Math.sin(b.angle);
        if (dx > 0) length = Math.min(length, (B.right - b.x) / dx); else if (dx < 0) length = Math.min(length, (B.left - b.x) / dx);
        if (dy > 0) length = Math.min(length, (B.bottom - b.y) / dy); else if (dy < 0) length = Math.min(length, (B.top - b.y) / dy);
        const xx = b.x + dx * length, yy = b.y + dy * length;
        p.line(b.x, b.y, xx, yy, C.red, b.fired ? 1.7 : .18, b.fired ? .9 : .35 + b.age / b.duration * .4);
        if (b.fired) p.line(b.x, b.y, xx, yy, C.white, .35);
        else p.arc(b.x, b.y, 3.5, -Math.PI / 2, TAU * Math.min(1, b.age / b.duration), C.red, .3);
    }
    for (const s of e.shots) {
        const len = s.returned ? .045 : .028, color = s.perfect ? C.gold : s.returned ? C.teal : C.blue;
        p.line(s.x - s.vx * len, s.y - s.vy * len, s.x, s.y, color, s.returned ? .5 : .24);
    }
    for (const b of e.bullets) p.ngon(b.x, b.y, b.r, 6, e.time, b.heavy ? C.red : C.gold, null, 1, !e.reduced);
    for (const enemy of e.enemies) {
        const { x, y, type, r } = enemy, color = enemy.flash > 0 ? C.white : type === 'hunter' ? C.red : type === 'lance' ? C.violet : C.gold;
        if (enemy.warm > 0) {
            p.arc(x, y, 4 * enemy.warm + r, 0, TAU, color, .16, .55);
            p.line(x - 1, y, x + 1, y, color); p.line(x, y - 1, x, y + 1, color); continue;
        }
        if (type === 'boss') {
            const open = e.sectorTime % 9 >= 5;
            for (let i = 0; i < 6; i++) {
                const a = e.time * .25 + i * TAU / 6;
                p.ngon(x + Math.cos(a) * 8, y + Math.sin(a) * 8, 1.8, 3, a, C.panel, C.red);
            }
            p.arc(x, y, 6.9, e.time * -.2, TAU * .87, open ? C.teal : C.red, .4, .7);
            p.ngon(x, y, 5.3, 6, e.time * -.1, C.panel, C.gold, 1, true);
            p.ngon(x, y, 2.6 + Math.sin(e.time * 3) * .2, 6, e.time * .25, enemy.flash > 0 ? C.white : open ? C.teal : C.red, null, 1, true);
        } else {
            p.ngon(x, y, r, type === 'hunter' ? 3 : type === 'drifter' ? 4 : 6,
                type === 'hunter' ? Math.atan2(e.player.y - y, e.player.x - x) : enemy.age * .35, C.panel, color, 1, !e.reduced);
            p.ngon(x, y, .6, 4, 0, color);
            if (enemy.hp < enemy.maxHp) p.line(x - 2, y - 3.2, x - 2 + 4 * Math.max(0, enemy.hp / enemy.maxHp), y - 3.2, color, .25);
        }
    }
    for (const v of e.particles) if (!e.reduced) p.line(v.x, v.y, v.x - v.vx * .035, v.y - v.vy * .035, C[v.color], .18, Math.min(1, v.life * 3));
    for (const r of e.rings) p.arc(r.x, r.y, r.r, 0, TAU, C[r.color], .3, r.life / r.total);
    const a = e.player, radius = e.upgrades.has('capacity') ? 8 : 6.5;
    if (a.catching) {
        const full = a.orbit.length === a.capacity;
        p.arc(a.x, a.y, radius, a.angle - 1.06, 2.12, full ? C.red : a.captureAge < .22 ? C.gold : C.teal, .5, .85, !e.reduced);
        p.arc(a.x, a.y, radius + .7, a.angle - 1.06, 2.12, C.teal, .12, .2);
    } else p.arc(a.x, a.y, radius, a.angle - .27, .54, C.teal, .13, .45);
    for (let i = 0; i < a.orbit.length; i++) {
        const t = i * TAU / a.capacity + (e.reduced ? 0 : e.time * 2);
        p.ngon(a.x + Math.cos(t) * 3.8, a.y + Math.sin(t) * 3.8, .5, 4, t, a.orbit[i].perfect ? C.gold : C.teal, null, 1, !e.reduced);
    }
    if (Math.hypot(a.vx, a.vy) > 3) {
        const d = Math.atan2(a.vy, a.vx), length = a.dash > 0 ? 10 : 2 + Math.sin(e.time * 30) * .7;
        p.line(a.x, a.y, a.x - Math.cos(d) * length, a.y - Math.sin(d) * length, C.teal, a.dash > 0 ? 1.1 : .4, .5);
    }
    ship(p, a.x, a.y, a.angle, 1, a.inv > 0 && Math.floor(e.time * 14) % 2 ? C.white : C.teal);
    if (a.inv > 0) p.arc(a.x, a.y, 3, 0, TAU, C.teal, .13, .35);
    if (e.perfectFlash > 0) p.text('PERFECT', Math.max(14, Math.min(115, a.x)), Math.max(18, a.y - 10), 1.4, C.gold, 'center', e.perfectFlash / .7);
    p.ox = p.oy = 0;
}
function hud(p, e) {
    const a = e.player;
    p.text(e.practice ? 'FLIGHT SCHOOL' : '0' + (e.sector + 1) + '  /  ' + SECTORS[e.sector], 8, 11.5, 1.3, C.muted);
    p.text(e.practice ? 'HULL PROTECTED' : 'SCORE  ' + number(e.score), 126, 11.5, 1.3, C.gold, 'right');
    p.text('PILOT STATUS', 133, 16, 1.1, C.muted);
    p.text('HULL', 133, 21, 1.5, C.white);
    for (let i = 0; i < a.maxHp; i++) p.rect(133 + (i % 4) * 5.1, 25 + Math.floor(i / 4) * 2.5, 4.1, 1.5, i < Math.ceil(a.hp) ? C.teal : C.line);

    p.text(a.orbit.length + ' / ' + a.capacity, 133, 38, 3.5, a.orbit.length ? C.teal : C.muted);
    p.text(a.orbit.length === a.capacity ? 'FULL / RETURN FIRE' : 'LT  CATCH', 133, 44, 1.05, a.orbit.length === a.capacity ? C.gold : C.muted);
    p.line(133, 49, 153, 49, C.line);
    p.text('NOVA', 133, 53, 1.5, C.white);
    p.rect(133, 57, 20, 1.5, C.line); p.rect(133, 57, 20 * a.energy / 100, 1.5, a.energy >= 100 ? C.gold : C.teal);
    p.text(a.energy >= 100 ? 'LB  RELEASE' : Math.floor(a.energy) + '% CHARGED', 133, 61, 1.2, a.energy >= 100 ? C.gold : C.muted);
    p.text(a.dashCooldown <= 0 ? 'RB  DASH READY' : 'DASH RECHARGING', 133, 69, 1.05, a.dashCooldown <= 0 ? C.teal : C.muted);
    p.text('x' + (1 + Math.min(4, Math.floor(e.combo / 4))), 133, 74, 3, C.gold);
    p.text('CHAIN', 142, 75, 1.1, C.muted);
    if (e.boss && e.boss.hp > 0) {
        p.rect(36, 17, 62, 1, C.line); p.rect(36, 17, 62 * Math.max(0, e.boss.hp / e.boss.maxHp), 1, C.red);
        p.text(e.sectorTime % 9 >= 5 ? 'CORE EXPOSED' : 'HELIOPHAGE / RETURN ROUNDS PIERCE ITS SHIELD', 67, 20, 1.15, e.sectorTime % 9 >= 5 ? C.teal : C.red, 'center');
    }
    if (e.practice) {
        const steps = [
            ['01 / FEEL THE SHIP', 'Move with left stick. Turn your aim with right stick.'],
            ['02 / CATCH THE STORM', 'Face the turret. Hold LT and catch 3 gold rounds.  ' + Math.min(3, e.stats.catches) + '/3'],
            ['03 / RETURN TO SENDER', 'Hold RT to return your rounds. Destroy the turret.'],
            ['FLIGHT CHECK COMPLETE', 'A / Enter: deploy     RB: dash     LB: nova when charged'],
        ][e.training];
        p.rect(18, 66, 98, 10, C.bg, .9); p.text(steps[0], 22, 68, 1.5, C.gold); p.text(steps[1], 22, 72, 1.35, C.white);
    } else if (e.banner > 0) {
        p.rect(36, 34, 63, 17, C.bg, .9);
        p.text('SECTOR 0' + (e.sector + 1), 67.5, 37, 1.4, C.gold, 'center');
        p.text(SECTORS[e.sector], 67.5, 41, 3.8, C.white, 'center');
        p.text(e.sector === 0 ? 'GOLD FIRE IS AMMUNITION. CATCH IT.' : e.sector === 1 ? 'RED LASERS CANNOT BE CAUGHT. DASH.' : 'TURN ITS OWN STORM AGAINST IT.', 67.5, 47, 1.2, C.teal, 'center');
    }
    p.text(e.device ? 'LS  MOVE     RS  AIM     LT  CATCH     RT  RETURN     RB / A  DASH     LB / X  NOVA' : 'WASD  MOVE     ARROWS  AIM     C  CATCH     SPACE  RETURN     E  DASH     Q  NOVA', 8, 82, 1.35, C.white);
    p.text('Tap catch just before impact for a perfect return. Hold both triggers to catch and fire.', 8, 86, 1.15, C.muted);
    p.text('START / P   PAUSE', 153, 86, 1.1, C.muted, 'right');
}
function upgrade(p, e) {
    p.text('SECTOR SECURED', 8, 17, 1.7, C.gold);
    p.text('REWIRE YOUR ORBIT.', 8, 23, 6, C.white);
    p.text('Hull repaired +2. Choose one permanent upgrade for the next sector.', 8, 33, 1.7, C.muted);
    e.choices.forEach((choice, i) => {
        const x = 8 + i * 49, active = e.selected === i;
        p.rect(x, 42, 46, 33, C.panel);
        p.rect(x, 42, 46, .4, active ? C.teal : C.line);
        p.text('0' + (i + 1) + '  /  ' + choice.tag, x + 3, 46, 1.2, active ? C.teal : C.muted);
        p.text(choice.name, x + 3, 53, 2.5, C.white);
        choice.lines.forEach((line, j) => p.text(line, x + 3, 59 + j * 3, 1.7, C.muted));
        p.button(active ? 'INSTALL UPGRADE' : 'SELECT', x, 77, 46, 7, 'choose:' + i, active);
    });
    p.text('D-pad / left stick: choose     A / Enter: install', 8, 87, 1.25, C.muted);
}
function pause(p, e) {
    p.rect(0, 10, 160, 80, C.bg, .95);
    p.text('SIGNAL HELD', 80, 18, 5, C.white, 'center');
    p.text('Left stick moves. Right stick aims the ship AND magnetic shield.', 80, 29, 1.7, C.muted, 'center');
    p.text('LT catches gold fire. RT returns it. Red lasers demand a dash.', 80, 33, 1.7, C.muted, 'center');
    p.text('RB / A: dash     LB / X: nova     START: resume', 80, 39, 1.6, C.teal, 'center');
    const labels = ['RESUME FLIGHT', 'SOUND: ' + (e.sound ? 'ON' : 'OFF'), 'REDUCED EFFECTS: ' + (e.reduced ? 'ON' : 'OFF'), 'RETURN TO HANGAR'];
    labels.forEach((label, i) => p.button(label, 54, 46 + i * 9, 52, 7, ['resume', 'sound', 'effects', 'title'][i], e.selected === i));
}
function ending(p, e) {
    hero(p, e, 120, 43, .9);
    const won = e.phase === 'won';
    p.text(won ? 'THE SUN IS SILENT.' : 'SIGNAL LOST.', 8, 18, 1.8, won ? C.teal : C.red);
    p.text(won ? 'STORM' : 'ONE MORE', 7, 24, 9, C.white);
    p.text(won ? 'BREAKER.' : 'ORBIT.', 7, 34, 9, won ? C.teal : C.gold);
    p.text(number(e.score), 8, 49, 5, C.white);
    p.text('SCORE     /     BEST ' + number(e.best), 8, 56, 1.4, C.muted);
    p.text(e.stats.catches + ' CAUGHT   /   ' + e.stats.perfect + ' PERFECT   /   ' + e.stats.returns + ' RETURNED', 8, 61, 1.5, C.gold);
    p.text(won ? 'Three sectors. One ship. Every shot turned against them.' : 'Aim into the gold fire. Dash across the red. Keep your orbit full.', 8, 66, 1.45, C.muted);
    p.button('FLY AGAIN', 8, 73, 35, 8, 'start', e.selected === 0);
    p.button('HANGAR', 46, 73, 35, 8, 'title', e.selected === 1);
    p.text('D-pad: choose   /   A or Enter: confirm', 8, 85, 1.3, C.muted);
}
function render(p, e) {
    p.begin(); background(p, e);
    if (e.phase === 'title') title(p, e);
    else if (e.phase === 'upgrade') upgrade(p, e);
    else if (e.phase === 'play') { if (e.paused) pause(p, e); else { arena(p, e); hud(p, e); } }
    else ending(p, e);
    p.end();
}
module.exports = { render };
