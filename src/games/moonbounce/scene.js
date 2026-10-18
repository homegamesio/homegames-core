const { LEVELS, POWERS } = require('./engine');
const { WORLDS } = require('./levels');
const { renderMenu, wrap } = require('./adventure-scenes');
const { C, TAU, fiveStar, display, moon, powerIcon, powerCharacter, gem, fallbackGarden, frame } = require('./decorations');
const ART = ['moonbounce_garden_v2', 'moonbounce_sunforge_v1', 'moonbounce_tideglass_v1', 'moonbounce_clockwork_v1', 'moonbounce_aurora_v1'];
const worldFor = e => e.phase === 'title' ? e.selectedWorld || 0 : (LEVELS[e.levelIndex] || {}).worldIndex || 0;
const artFor = e => ART[e.hasWorldArt ? worldFor(e) : 0] || ART[0];
const number = n => Math.floor(Number(n) || 0).toLocaleString('en-US');
const clock = e => e.reduced ? 0 : (e.uiTime || e.time || 0);
const currentPower = e => POWERS.find(power => power.id === e.powerId) || POWERS[0];
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));

function background(p, e) {
    if (e.hasArt) p.image(artFor(e), 0, 0, 160, 90);
    else fallbackGarden(p, clock(e));
    p.rect(0, 0, 160, 10.1, C.dark, .78);
    p.rect(0, 85.5, 160, 4.5, C.dark, .83);
    p.star(5.3, 5, 1, C.gold);

    if (e.phase === 'title') {
        p.button('FX ' + (e.reduced ? 'LOW' : 'FULL'), 114, 2.8, 18.5, 5.1, 'effects', false, true);
        p.button('SOUND ' + (e.sound ? 'ON' : 'OFF'), 136, 2.8, 20, 5.1, 'sound', false, true);
    } else {
        const level = LEVELS[e.levelIndex] || LEVELS[0];
        p.heading((e.mode === 'challenge' && e.challenge ? e.challenge.title : level.name).toUpperCase(), 76, 3.6, 2.1, C.gold, 'center');
        p.text(e.mode === 'challenge' ? 'TRIAL' : (level.worldIndex + 1) + '-' + String(level.stageIndex + 1).padStart(2, '0'), 111, 4.3, 1.5, C.cream, 'right');
        if (!e.paused && ['ready', 'flight'].includes(e.phase)) p.button('PAUSE', 135, 2.8, 20, 5.1, 'pause', false, true);
    }
}

function boardFrame(p, e) {
    const world = WORLDS[worldFor(e)] || WORLDS[0];
    frame(p, 5.3, 10.6, 107.4, 74.2, e.fever ? C.cream : world.color2 || C.gold);
    if (e.hasArt) {
        p.image(artFor(e), 7, 12, 104, 71, 1, { cropLeft: 4.375, cropTop: 13.333, cropRight: 30.625, cropBottom: 7.778 });
        p.rect(7, 12, 104, 71, [13, 33, 57], .62);
    } else p.rect(7, 12, 104, 71, [17, 46, 67], .93);
    p.line(7.1, 15, 7.1, 80, C.green, .19, .7);
    p.line(110.9, 15, 110.9, 80, C.green, .19, .7);
    for (const [x, y] of [[7.5, 13], [110.5, 13], [7.5, 82], [110.5, 82]]) {
        p.circle(x, y, .85, [148, 78, 70]); p.circle(x - .1, y - .15, .59, C.gold);
    }
    for (let i = 0; i < 7; i++) {
        const lit = e.fever || i < Math.ceil((1 - e.orangeRemaining / Math.max(1, e.orangeTotal)) * 7);
        p.circle(6.1, 25 + i * 7, .35, lit ? C.gold : C.teal);
        p.circle(111.9, 25 + i * 7, .35, lit ? C.gold : C.teal);
    }
}

function obstacles(p, e) {
    const t = clock(e), world = WORLDS[worldFor(e)] || WORLDS[0];
    for (const bumper of e.bumpers || []) {
        const { x, y, r } = bumper, hit = bumper.hitTime > 0;
        if (hit) p.circle(x, y, r * 1.45, world.color2, null, .18);
        p.circle(x, y + .3, r * 1.05, C.dark, null, .7);
        p.circle(x, y, r, world.color2 || C.gold);
        p.circle(x, y - .15, r * .8, hit ? C.cream : C.coral);
        p.circle(x, y - .15, r * .56, C.panelLight);
        fiveStar(p, x, y - .15, r * .42, hit ? C.cream : C.gold);
    }
    for (const portal of e.portals || []) {
        const { x, y, r } = portal, color = portal.id % 2 ? C.coral : C.blue;
        p.circle(x, y, r, C.dark);
        p.arc(x, y, r * .94, t * (portal.id % 2 ? -1 : 1), TAU * .89, color, .38, .9);
        p.arc(x, y, r * .67, -t, TAU * .73, C.purple, .19, .65);
        p.star(x, y, r * .28, portal.hitTime > 0 ? C.cream : color);
        if (portal.hitTime > 0) p.arc(x, y, r * 1.3, 0, TAU, C.cream, .2, .6);
    }
    // A few faint rails explain moving pegs without competing with their hit
    // silhouettes; their physical positions always come from the simulation.
    for (const peg of (e.pegs || []).filter(item => item.motion && !item.removed).slice(0, 6)) {
        const m = peg.motion;
        if (m.kind === 'orbit') p.poly(Array.from({ length: 18 }, (_, i) => {
            const angle = i / 17 * TAU;
            return [m.cx + Math.cos(angle) * m.ax, m.cy + Math.sin(angle) * m.ay];
        }), null, C.purple, .07, .23);
        else p.line(m.cx - m.ax, m.cy - m.ay, m.cx + m.ax, m.cy + m.ay, C.purple, .13, .28);
    }
}

function challengeObjective(p, e) {
    if (e.mode !== 'challenge' || !e.challenge) return;
    const goal = e.challenge.goal, progress = Math.min(goal.target, e.challengeProgress || 0);
    const label = { score: 'SCORE', catches: 'BUCKET CATCHES', style: 'STYLE BONUSES' }[goal.kind] || 'GOAL';
    p.roundRect(23, 23.2, 72, 3.4, 1.3, C.dark, null, .78);
    p.heading(e.challengeComplete ? 'GOAL COMPLETE! CLEAR THE ORANGE PEGS.' : label + '  ' + number(progress) + ' / ' + number(goal.target) + '   +   CLEAR ORANGE',
        59, 24, 1.45, e.challengeComplete ? C.green : C.gold, 'center');
}

function launcher(p, e) {
    const { x = 59, y = 17 } = e.launcher || {}, angle = e.aimAngle || 0;
    const color = e.powerShots > 0 ? C.green : C.purple;
    const recoil = !e.reduced && e.phase === 'flight' ? Math.max(0, 1 - (e.shotAge || 0) / .24) * 1.1 : 0;
    const dx = Math.sin(angle), dy = Math.cos(angle), nx = Math.cos(angle), ny = -Math.sin(angle);
    const point = (along, across) => [x + dx * (along - recoil) + nx * across, y + dy * (along - recoil) + ny * across];
    p.arc(x, y, 5.2, .1, Math.PI - .2, C.gold, .28, .6);
    p.circle(x, y, 3.35, [104, 58, 80]); p.circle(x, y - .2, 2.85, C.gold);
    p.poly([point(-.5, -1.7), point(5, -1.32), point(5, 1.32), point(-.5, 1.7)], C.panelLight, C.gold, .19);
    p.poly([point(.1, -.95), point(4.8, -.85), point(4.8, -.35), point(.1, -.45)], C.purple, null, 0, .85);
    p.line(...point(4.8, -1.5), ...point(4.8, 1.5), C.gold, .68);
    p.line(...point(4.9, -1.1), ...point(4.9, 1.1), C.cream, .15);
    p.circle(x, y, 1.6, color); p.circle(x - .4, y - .5, .46, C.cream);
    if (e.phase === 'ready') p.circle(...point(3, 0), .64, C.cream);
    if (recoil > 0) p.star(...point(5.4, 0), 1.4 * recoil, C.gold, recoil);
    p.heading(e.phase === 'ready' ? e.aiming ? 'RELEASE!' : 'AIM AND RELEASE' : e.fastForward ? 'FAST FORWARD' : e.fever ? 'JACKPOT' : '',
        59, 12.2, 1.4, e.fever ? C.gold : C.cream, 'center');
}

function bucket(p, e) {
    const t = clock(e);
    if (e.fever) {
        ['10K', '25K', '50K', '25K', '10K'].forEach((label, i) => {
            const x = 7.4 + i * 20.7, color = [C.purple, C.coral, C.gold, C.coral, C.purple][i];
            p.roundRect(x, 77.3, 20.25, 5.7, 1, [44, 31, 75], color);
            p.roundRect(x + .5, 77.6, 19.25, 1.5, .7, color, null, .35);
            p.heading(label, x + 10.1, 79.1, i === 2 ? 2.6 : 2, color, 'center');
        });
        p.star(59, 75.6, e.reduced ? 1.1 : 1.1 + Math.sin(t * 8) * .2, C.gold); return;
    }
    const b = e.bucket || { x: 59, y: 79.8, width: 16 }, half = b.width / 2;
    const bounce = e.reaction === 'happy' && e.reactionTime > 0 && !e.reduced ? Math.abs(Math.sin(t * 15)) * .5 : 0;
    const y = b.y - bounce;
    p.line(8.5, 82.6, 109.5, 82.6, C.gold, .13, .55);
    p.poly([[b.x - half, y], [b.x - half + 1.1, y + 3.05], [b.x + half - 1.1, y + 3.05], [b.x + half, y]], [39, 149, 143], C.gold, .2);
    p.line(b.x - half + 1, y + .85, b.x + half - 1, y + .85, C.green, .3, .65);
    p.line(b.x - half, y, b.x - half + 2.2, y, C.cream, .52); p.line(b.x + half - 2.2, y, b.x + half, y, C.cream, .52);
    for (const sign of [-1, 1]) p.circle(b.x + sign * 1.8, y + 1.2, .35, C.dark);
    p.arc(b.x, y + 1.1, .9, .2, Math.PI - .4, C.dark, .16);
    p.heading('CATCH: +1 BALL', b.x, y - 2.25, 1.5, C.green, 'center');
}

function fever(p, e) {
    if (!e.fever) return;
    const t = clock(e), age = e.feverTime || 0;
    if (!e.reduced && !e.paused && e.phase === 'flight') {
        for (let i = 0; i < 10; i++) {
            const angle = i * TAU / 10 + t * .15;
            p.poly([[59, 45], [59 + Math.cos(angle - .07) * 47, 45 + Math.sin(angle - .07) * 31],
                [59 + Math.cos(angle + .07) * 47, 45 + Math.sin(angle + .07) * 31]], i % 2 ? C.purple : C.gold, null, 0, .12);
        }
        for (let i = 0; i < 27; i++) {
            const x = 11 + ((i * 19.7 + Math.sin(t * 2 + i) * 3) % 95 + 95) % 95;
            const y = 23 + ((age * (11 + i % 7) + i * 9.7) % 51);
            p.ngon(x, y, .32 + (i % 3) * .15, 4, t * 4 + i, [C.gold, C.coral, C.green, C.purple][i % 4]);
        }
    }
    if (e.phase === 'flight' && !e.paused && age < 1.8) {
        const alpha = Math.min(1, (1.8 - age) / .9), scale = e.reduced ? 1 : 1 + Math.max(0, .2 - age * .5);
        p.circle(59, 43, 22, C.panel, null, alpha * .34);
        display(p, 'ORANGE CLEARED', 59, 33, 4.8 * scale, C.cream, 'center', alpha);
        display(p, 'JACKPOT', 59, 39, 10.7 * scale, C.gold, 'center', alpha);
        p.heading('LAND IN A BONUS SLOT', 59, 53, 2.1, C.cream, 'center', alpha);
        fiveStar(p, 33, 44, 2.5, C.gold, alpha); fiveStar(p, 85, 44, 2.5, C.gold, alpha);
    }
}

function eventFeedback(p, e) {
    for (const ring of (e.rings || []).slice(-5)) {
        const alpha = clamp(ring.life / (ring.maxLife || 1), 0, 1);
        p.arc(ring.x, ring.y, ring.r, 0, TAU, ring.color || C.gold, e.reduced ? .2 : .38, alpha * .65);
    }
    const callout = e.callout;
    if (callout && callout.life > 0 && !e.fever) {
        const progress = callout.life / (callout.maxLife || 1), age = (callout.maxLife || 1) - callout.life;
        const alpha = Math.min(1, progress * 4), scale = e.reduced ? 1 : 1 + Math.max(0, .13 - age * .6), color = callout.color || C.gold;
        p.roundRect(26, 63, 66, 10, 2.7, C.dark, color, alpha * .82);
        display(p, callout.title, 59, 64.1, Math.min(4.2, 51 / Math.max(10, callout.title.length) * 1.7) * scale, color, 'center', alpha);
        p.text(callout.subtitle || '', 59, 69.8, 1.55, C.cream, 'center', alpha);
        if (/BALL|CATCH/.test(callout.title)) {
            p.circle(23, 67.4, 3.1, [163, 92, 48], null, alpha); p.circle(23, 67, 2.7, C.gold, null, alpha);
            fiveStar(p, 23, 67, 1.55, C.cream, alpha);
        }
    } else if (e.bannerTime > 0 && e.banner && !e.fever) {
        const firstShot = e.phase === 'ready' && !e.shotAge;
        p.roundRect(firstShot ? 17 : 28, firstShot ? 65 : 67, firstShot ? 84 : 62, firstShot ? 9.6 : 6.8, 2, C.dark, null, .84);
        p.heading(e.banner, 59, firstShot ? 66 : 69.1, String(e.banner).length > 26 ? 1.65 : 2.15, C.cream, 'center');
        if (firstShot) wrap(p, LEVELS[e.levelIndex].hint, 59, 69.4, 75, 1.55, C.muted, 'center', 2);
    }
}

function board(p, e) {
    const t = clock(e); boardFrame(p, e);
    const active = !e.paused && ['ready', 'flight'].includes(e.phase);
    const impact = e.impact;
    if (!e.reduced && impact && impact.life > 0) {
        const strength = Math.min(.4, impact.strength || .15) * impact.life / (impact.maxLife || 1);
        p.ox = Math.sin(t * 110) * strength; p.oy = Math.cos(t * 93) * strength;
    }
    fever(p, e); obstacles(p, e);
    if (e.orangeRemaining === 1 && !e.fever) {
        const last = e.pegs.find(peg => peg.type === 'orange' && !peg.hit && !peg.removed);
        if (last) {
            const radius = e.reduced ? 3.1 : 3.1 + Math.sin(t * 7) * .4;
            p.circle(last.x, last.y, radius + 1, C.orange, null, .14);
            p.arc(last.x, last.y, radius, t, TAU * .85, C.gold, .3, .95); p.star(last.x, last.y - radius - 1, .8, C.cream);
        }
    }
    for (const peg of e.pegs || []) if (!peg.removed) gem(p, peg, t, e.reduced);
    if (e.phase === 'ready' && !e.paused && typeof e.preview === 'function') {
        const preview = e.preview() || [], step = Math.max(1, Math.ceil(preview.length / 26));
        for (let i = 0; i < preview.length; i += step) {
            const dot = preview[i];
            if (dot.y > 23 && dot.y < 76 && dot.x > 9 && dot.x < 109) p.circle(dot.x, dot.y,
                .22 + .15 * (1 - i / preview.length), e.powerId === 'guide' && e.powerShots > 0 ? C.green : C.cream, null, .9 - .5 * i / preview.length);
        }
    }
    launcher(p, e); bucket(p, e); challengeObjective(p, e);
    for (const ball of e.ballsInPlay || []) {
        const trail = ball.trail || [];
        if (!e.reduced && active) for (let i = 0; i < Math.min(10, trail.length); i++) {
            const alpha = 1 - i / trail.length;
            p.circle(trail[i].x, trail[i].y, (ball.r || .68) * alpha, e.fever ? C.gold : C.purple, null, alpha * .52);
        }
        p.circle(ball.x, ball.y, (ball.r || .68) * 1.8, e.fever ? C.gold : C.blue, null, .22);
        p.circle(ball.x, ball.y, ball.r || .68, C.cream); p.circle(ball.x - .16, ball.y - .2, .2, [255, 255, 255]);
    }
    if (!e.reduced && active) for (const particle of (e.particles || []).slice(-38)) p.circle(particle.x, particle.y, particle.r || .25,
        particle.color || C.gold, null, clamp(particle.life / (particle.maxLife || 1), 0, 1));
    if (active) for (const popup of (e.popups || []).slice(-7)) p.heading(popup.text, popup.x, popup.y, 1.9,
        popup.color || C.gold, 'center', Math.min(1, popup.life / .35));
    if (active) eventFeedback(p, e); p.ox = p.oy = 0;
}

function hud(p, e) {
    const t = clock(e), power = currentPower(e), charged = e.powerShots > 0;
    frame(p, 116.8, 10.6, 38.2, 74.2, C.purple);
    p.roundRect(118.2, 12, 35.4, 71, 2.3, [36, 34, 76]);
    p.arc(136, 24, 11.5, Math.PI * 1.05, Math.PI * .9, C.gold, .25, .6);
    const reaction = e.phase === 'lost' ? 'sad' : e.fever ? 'wow' : e.reactionTime > 0 ? e.reaction : 'idle';
    moon(p, 136, 23, 8.5, reaction, t, C.gold, e.reduced);
    p.heading('SCORE', 136, 33.4, 2.1, C.muted, 'center');
    display(p, number(e.displayScore === undefined ? e.score : e.displayScore), 136, 36, e.score >= 1000000 ? 4.1 : 4.85, C.cream);
    p.line(122, 43, 150, 43, C.line, .16);
    const progress = clamp(1 - e.orangeRemaining / Math.max(1, e.orangeTotal), 0, 1);
    p.roundRect(122, 46, 4.3, 14.8, 2, C.dark, C.gold);
    if (progress > 0) p.roundRect(122.55, 46.5 + 13.8 * (1 - progress), 3.2, 13.8 * progress, 1.4, C.orange);
    p.line(123.2, 48, 123.2, 58, C.cream, .23, .3); fiveStar(p, 124.15, 45.6, 1.9, e.fever ? C.cream : C.gold);
    display(p, e.orangeRemaining, 140, 45.3, 5.8, e.orangeRemaining === 1 ? C.gold : C.orange);
    p.heading('ORANGE LEFT', 140, 52.3, 1.9, C.cream, 'center');
    p.roundRect(131, 55.5, 19.3, 5.3, 2.2, C.panelLight);
    p.heading('x' + (e.multiplier || 1), 136, 56.2, 3.1, C.gold, 'center'); p.text('POINTS', 146, 57.2, 1.6, C.cream, 'center');
    p.roundRect(120.5, 63, 30.5, 11.5, 2.7, [19, 31, 54], C.line);
    p.heading(e.balls + ' BALLS', 136, 64.1, 2.2, C.cream, 'center');
    for (let i = 0; i < Math.min(12, Math.max(0, e.balls)); i++) {
        const x = 124.5 + (i % 6) * 4.5, y = 69 + Math.floor(i / 6) * 2.7;
        p.circle(x, y + .18, 1.07, C.panelLight); p.circle(x, y, .9, i === 0 ? C.cream : C.purple);
        p.circle(x - .25, y - .28, .23, C.cream, null, .85);
    }
    p.roundRect(120.5, 76.2, 30.5, 6.2, 2, charged ? [34, 93, 89] : C.panelLight, charged ? C.green : null);
    powerIcon(p, power.id, 124, 79.4, 1.7, charged ? C.green : C.purple);
    p.heading(power.name, 127.4, 77.1, 2.0, C.cream);
    p.text(charged ? e.powerShots + ' charged shots' : 'Green: recharge', 127.4, 79.8, 1.65, charged ? C.green : C.muted);
    if (e.phase === 'flight') {
        const thresholds = [10000, 25000, 50000], next = thresholds.find(n => e.shotScore < n);
        const previous = next === 25000 ? 10000 : next === 50000 ? 25000 : 0, fraction = next ? (e.shotScore - previous) / (next - previous) : 1;
        p.roundRect(8, 85.8, 53, 3.6, 1.3, C.dark, null, .75);
        p.heading(number(e.displayShotScore === undefined ? e.shotScore : e.displayShotScore) + ' SHOT PTS', 9.5, 86.4, 1.6, C.gold);
        p.text(e.shotHits + ' PEG COMBO', 58.5, 86.5, 1.4, C.orange, 'right');
        p.roundRect(65, 87, 19, .65, .3, C.panelLight);
        if (fraction > 0) p.roundRect(65, 87, 19 * Math.min(1, fraction), .65, .3, C.green);
        p.text(next ? 'FREE BALL AT ' + number(next) : '3 BONUS BALLS EARNED!', 88, 86.6, 1.35, C.green);
        p.text(e.fastForward ? 'FAST FORWARD >>' : 'HOLD TO SPEED UP', 153, 86.5, 1.4, C.cream, 'right');
    } else {
        p.text('DRAG + RELEASE / ARROWS + SPACE / GAMEPAD A', 8, 86.3, 1.8, C.cream);
        p.text('P: PAUSE  M: SOUND', 153, 86.3, 1.8, C.muted, 'right');
    }
}

function results(p, e) {
    const paused = e.paused, won = e.phase === 'won', lost = e.phase === 'lost';
    p.rect(0, 10, 160, 75.5, C.dark, .72);
    frame(p, 32, 16, 96, 66, won || !lost && !paused ? C.gold : C.purple);
    p.roundRect(33.5, 17.5, 93, 62.5, 2.7, [41, 33, 81]);
    if (paused) {
        moon(p, 80, 27, 5.2, 'idle', clock(e), C.gold, e.reduced);
        display(p, 'PAUSED', 80, 31, 5, C.cream);
        p.text('Clear orange pegs. Green pegs recharge your power.', 80, 39, 2.15, C.cream, 'center');
        p.text('Hold Space, RT, or the board to speed up a shot.', 80, 43, 2, C.cream, 'center');
        p.text('On a phone? Turn sideways.', 80, 47, 2.2, C.gold, 'center');
        p.button('RESUME', 51, 50.5, 58, 7.8, 'resume', true);
        p.button('SOUND ' + (e.sound ? 'ON' : 'OFF'), 40, 61.5, 25, 6.5, 'sound', false, true);
        p.button('MUSIC ' + (e.music !== false ? 'ON' : 'OFF'), 67.5, 61.5, 25, 6.5, 'music', false, true);
        p.button('FX ' + (e.reduced ? 'LOW' : 'FULL'), 95, 61.5, 25, 6.5, 'effects', false, true);
        p.button('RETRY BOARD', 41, 72, 37, 5.5, 'retry', false, true);
        p.button(e.mode === 'challenge' ? 'CHALLENGES' : 'WORLD MAP', 82, 72, 37, 5.5, 'title', false, true); return;
    }
    const result = e.result || {}, last = e.phase === 'cleared' && e.levelIndex === LEVELS.length - 1;
    const challenge = e.mode === 'challenge', level = LEVELS[e.levelIndex], world = WORLDS[level.worldIndex];
    const progress = e.progress || { totalStars: 0, completedChallenges: 0, achievements: [] };
    const age = e.resultAge === undefined ? 5 : e.resultAge;
    const heading = lost ? challenge ? 'CHALLENGE INCOMPLETE' : 'OUT OF BALLS' : won ? 'ADVENTURE COMPLETE' : challenge ? 'CHALLENGE COMPLETE' : last ? 'ADVENTURE COMPLETE' : level.finale ? 'WORLD COMPLETE' : 'BOARD COMPLETE';
    display(p, heading, 80, 21, heading.length > 19 ? 4.2 : 5.1, lost ? C.cream : C.gold);
    if (lost) {
        moon(p, 80, 37, 6.8, 'sad', clock(e), C.gold, e.reduced);
        if (challenge) {
            wrap(p, result.reason || 'Clear every orange peg and complete the challenge goal.', 80, 47.8, 62, 1.9, C.cream, 'center', 2);
            const goal = result.objective || {};
            p.heading('CHALLENGE GOAL  ' + number(goal.progress || e.challengeProgress) + ' / ' + number(goal.target || (e.challenge || {}).goal?.target),
                80, 55, 1.85, C.gold, 'center');
        } else {
            p.heading(e.orangeRemaining + ' orange pegs remaining', 80, 48, 2.5, C.cream, 'center');
            p.text('Retry to start this board again.', 80, 53, 2.2, C.muted, 'center');
        }
        display(p, number(e.score), 80, 59.5, 5.2, C.gold);
    } else {
        const stars = result.stars || (won ? 3 : 1);
        for (let i = 0; i < 3; i++) {
            const lit = i < stars && (e.reduced || age >= .22 + i * .28);
            const pop = e.reduced ? 1 : 1 + Math.max(0, .16 - Math.abs(age - (.28 + i * .28)) * .8), x = 68 + i * 12, y = i === 1 ? 36.3 : 38.2;
            fiveStar(p, x, y + .6, 5.1 * pop, [28, 25, 58]); fiveStar(p, x, y, 4.75 * pop, lit ? C.gold : C.line);
            if (lit) fiveStar(p, x - .5, y - .65, 2.1, C.cream, .45);
        }
        const unlocks = e.newUnlocks || [], powerUnlock = unlocks.find(item => item.type === 'power');
        const firstUnlock = powerUnlock || unlocks.find(item => item.type === 'world') || unlocks[0];
        if (firstUnlock && !won) {
            const friend = POWERS.find(item => powerUnlock && item.id === powerUnlock.id);
            if (friend) powerCharacter(p, friend.id, 47, 37, 3.7, friend.color, clock(e));
            p.roundRect(39, 43.1, 82, 4.5, 1.6, [36, 94, 83], C.green);
            p.heading((firstUnlock.type === 'achievement' ? 'TROPHY EARNED: ' : 'UNLOCKED: ') + firstUnlock.title.toUpperCase(), 80, 44.4, 1.8, C.cream, 'center');
        } else p.text(won ? 'All 40 boards complete.' : challenge ? e.challenge.title + ' complete' : last ? 'All ' + LEVELS.length + ' boards complete.' : level.finale ? world.name + ' complete' : level.name + ' complete!',
            80, 44.7, won ? 1.75 : 1.95, C.cream, 'center');
        const rows = won ? [['CONSTELLATIONS', '40 / 40'], ['ADVENTURE STARS', progress.totalStars + ' / 120'], ['CHALLENGES', progress.completedChallenges + ' / 15'], ['TROPHIES', progress.achievements.length + ' / 12']] :
            [['PEG POINTS', result.pegPoints || 0], ['STYLE BONUS', result.stylePoints || 0], ['JACKPOT', result.jackpot || e.jackpot || 0], ['BALLS SAVED', result.reserveBonus || 0]];
        rows.forEach(([label, value], i) => {
            const col = i % 2, row = Math.floor(i / 2), x = col ? 84 : 43, y = 49.5 + row * 4.1;
            p.text(label, x, y, 1.45, C.muted); p.heading(typeof value === 'string' ? value : number(value), x + 33, y - .15, 1.75, C.cream, 'right');
        });
        p.line(44, 59, 116, 59, C.line, .16); p.heading(won ? 'SESSION SCORE' : 'BOARD SCORE', 48, 62, 1.6, C.gold);
        display(p, number(won ? e.score : result.boardScore || e.score - (e.levelStartScore || 0)), 111, 59.8, 5, C.gold, 'right');
        const goal = won ? progress.totalStars < 120 ? 'REPLAY BOARDS TO EARN MORE STARS.' : progress.completedChallenges < 15 ? '15 BONUS CHALLENGES AVAILABLE.' : 'ALL WORLDS AND CHALLENGES COMPLETE.' :
            challenge ? stars >= 3 ? 'THREE STARS EARNED' : 'REPLAY TO EARN MORE STARS.' :
                stars >= 3 ? 'THREE STARS EARNED' : 'NEXT STAR AT ' + number(level.parScore * (stars === 2 ? 1.6 : 1));
        p.heading(goal,
            80, 67.1, 1.55, stars >= 3 ? C.green : C.purple, 'center');
    }
    p.button(lost ? 'RETRY BOARD' : won ? 'BACK TO THE WORLD MAP' : challenge ? 'REPLAY CHALLENGE' : last ? 'FINISH ADVENTURE' : level.finale ? 'NEXT WORLD' : 'NEXT LEVEL',
        40, 71, 58, 7.5, lost || challenge ? 'retry' : won ? 'title' : 'next', true);
    p.button(won ? 'HOME' : challenge ? 'CHALLENGES' : 'WORLD MAP', 102, 71, 22, 7.5, won ? 'home' : 'title', false, true);
}

function render(p, e) {
    p.begin(); p.focusAction = e.focusAction; p.hoverAction = e.hoverAction;
    background(p, e);
    if (e.phase === 'title') renderMenu(p, e);
    else {
        board(p, e); hud(p, e);
        if (e.paused || ['cleared', 'lost', 'won'].includes(e.phase)) { p.buttons = []; results(p, e); }
    }
    if (e.saveFailed) {
        // A failed write stays visible during play, menus and results.
        p.roundRect(3, 10.8, 154, 13.5, 2, C.dark, C.coral);
        p.heading('Progress could not be saved.', 7, 13, 2.3, C.cream);
        p.text('Use Retry save to try again.', 7, 18, 2.1, C.cream);
        p.button('RETRY SAVE', 119, 13.5, 34, 8, 'retrySave', true, true);
    }
    p.end();
}
module.exports = { render, C };
